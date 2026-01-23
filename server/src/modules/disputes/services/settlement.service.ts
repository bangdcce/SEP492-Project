// ============================================================================
// SETTLEMENT SERVICE - Pre-Hearing Negotiation System
// ============================================================================
// Pattern: Unit Functions → Compose Functions
// Money Handling: Decimal.js for precision (0.1 + 0.2 === 0.3)
// Currency: USD only (platform-wide standard)
// ============================================================================

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';

// Entities
import {
  DisputeSettlementEntity,
  SettlementStatus,
} from '../../../database/entities/dispute-settlement.entity';
import { DisputeEntity, DisputeStatus } from '../../../database/entities/dispute.entity';
import { EscrowEntity } from '../../../database/entities/escrow.entity';
import { UserEntity } from '../../../database/entities/user.entity';

// DTOs
import { CreateSettlementOfferDto } from '../dto/settlement/create-settlement-offer.dto';
import { RespondToSettlementDto } from '../dto/settlement/respond-to-settlement.dto';

// Interfaces - Export for external use (controller, tests)
import type {
  FeeBreakdown,
  MoneyValidationResult,
  SettlementEligibilityResult,
  NonComplianceRecord,
  ChatLockStatus,
  StaffSuggestion,
  NonComplianceSummary,
} from '../interfaces/settlement.interface';

export type {
  FeeBreakdown,
  MoneyValidationResult,
  SettlementEligibilityResult,
  NonComplianceRecord,
  ChatLockStatus,
  StaffSuggestion,
  NonComplianceSummary,
};

// =============================================================================
// CONSTANTS
// =============================================================================

const SETTLEMENT_CONFIG = {
  MAX_ATTEMPTS_PER_USER: 3,
  DEFAULT_EXPIRY_HOURS: 48,
  MIN_EXPIRY_HOURS: 24,
  MAX_EXPIRY_HOURS: 72,
  CANCEL_WINDOW_HOURS: 1, // Can only cancel within 1 hour of creation
  MINIMUM_SETTLEMENT_AMOUNT: 10, // $10 USD minimum

  // Fee percentages (can be made dynamic via FeeConfig later)
  FREELANCER_FEE_PERCENTAGE: 5, // 5% platform fee on freelancer earnings
  CLIENT_FEE_PERCENTAGE: 0, // No fee for client refunds

  // =========================================================================
  // EDGE CASE CONFIG: "Silent Treatment" Prevention
  // =========================================================================
  MANDATORY_RESPONSE_HOURS: 24, // Responder must respond within 24h or face consequences
  CHAT_LOCK_ENABLED: true, // Lock chat for responder until they respond to pending offer
  MAX_IGNORED_OFFERS: 2, // After ignoring 2 offers, auto-flag as "non-cooperative"
  NON_COMPLIANCE_PENALTY_WEIGHT: 1.5, // Weight multiplier for verdict (ignored offers = bad)
} as const;

// Allowed statuses for creating new settlement
// Note: DisputeStatus enum may not have all these statuses yet
// Using string comparison for flexibility
const SETTLEMENT_ALLOWED_STATUSES = ['OPEN', 'UNDER_REVIEW', 'IN_MEDIATION'];
const SETTLEMENT_CLOSED_STATUSES = ['RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED'];

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(DisputeSettlementEntity)
    private readonly settlementRepository: Repository<DisputeSettlementEntity>,

    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,

    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ===========================================================================
  // UNIT FUNCTIONS
  // ===========================================================================

  /**
   * Unit Function 2.1.1: Validate money logic using Decimal.js
   *
   * CRITICAL: amountToFreelancer + amountToClient MUST === escrowFundedAmount
   * No more, no less. Platform fee is deducted from the distribution.
   */
  validateMoneyLogic(
    amountToFreelancer: number,
    amountToClient: number,
    escrowFundedAmount: number,
  ): MoneyValidationResult {
    // Convert to Decimal for precise arithmetic
    const freelancerAmount = new Decimal(amountToFreelancer);
    const clientAmount = new Decimal(amountToClient);
    const fundedAmount = new Decimal(escrowFundedAmount);

    // Validation 1: No negative amounts
    if (freelancerAmount.lessThan(0)) {
      return { valid: false, error: 'Freelancer amount cannot be negative' };
    }
    if (clientAmount.lessThan(0)) {
      return { valid: false, error: 'Client amount cannot be negative' };
    }

    // Validation 2: Sum must equal funded amount exactly
    const sum = freelancerAmount.plus(clientAmount);
    if (!sum.equals(fundedAmount)) {
      const diff = fundedAmount.minus(sum);
      if (diff.greaterThan(0)) {
        return {
          valid: false,
          error: `Must distribute entire escrow balance. Missing: $${diff.toFixed(2)}`,
        };
      } else {
        return {
          valid: false,
          error: `Cannot distribute more than escrow balance. Excess: $${diff.abs().toFixed(2)}`,
        };
      }
    }

    // Validation 3: Minimum settlement amount
    if (fundedAmount.lessThan(SETTLEMENT_CONFIG.MINIMUM_SETTLEMENT_AMOUNT)) {
      return {
        valid: false,
        error: `Settlement amount too small. Minimum: $${SETTLEMENT_CONFIG.MINIMUM_SETTLEMENT_AMOUNT}`,
      };
    }

    // Calculate fee breakdown
    const freelancerFeePercent = new Decimal(SETTLEMENT_CONFIG.FREELANCER_FEE_PERCENTAGE).dividedBy(
      100,
    );
    const clientFeePercent = new Decimal(SETTLEMENT_CONFIG.CLIENT_FEE_PERCENTAGE).dividedBy(100);

    const freelancerFee = freelancerAmount
      .times(freelancerFeePercent)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const clientFee = clientAmount
      .times(clientFeePercent)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalPlatformFee = freelancerFee.plus(clientFee);

    const freelancerNetAmount = freelancerAmount.minus(freelancerFee);
    const clientNetAmount = clientAmount.minus(clientFee);

    const breakdown: FeeBreakdown = {
      amountToFreelancer: freelancerAmount.toNumber(),
      amountToClient: clientAmount.toNumber(),
      freelancerFee: freelancerFee.toNumber(),
      clientFee: clientFee.toNumber(),
      totalPlatformFee: totalPlatformFee.toNumber(),
      freelancerNetAmount: freelancerNetAmount.toNumber(),
      clientNetAmount: clientNetAmount.toNumber(),
    };

    return { valid: true, breakdown };
  }

  /**
   * Unit Function 2.1.2: Calculate expiry time for settlement offer
   *
   * Default: 48 hours from now
   * Config options: excludeWeekends (for business-focused platforms)
   */
  calculateExpiryTime(options?: { expiryHours?: number; excludeWeekends?: boolean }): Date {
    const hours = options?.expiryHours ?? SETTLEMENT_CONFIG.DEFAULT_EXPIRY_HOURS;

    // Clamp to valid range
    const clampedHours = Math.max(
      SETTLEMENT_CONFIG.MIN_EXPIRY_HOURS,
      Math.min(hours, SETTLEMENT_CONFIG.MAX_EXPIRY_HOURS),
    );

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + clampedHours);

    // Optional: Exclude weekends (push to Monday 9 AM)
    if (options?.excludeWeekends) {
      const dayOfWeek = expiryDate.getDay();
      if (dayOfWeek === 0) {
        // Sunday → Monday 9 AM
        expiryDate.setDate(expiryDate.getDate() + 1);
        expiryDate.setHours(9, 0, 0, 0);
      } else if (dayOfWeek === 6) {
        // Saturday → Monday 9 AM
        expiryDate.setDate(expiryDate.getDate() + 2);
        expiryDate.setHours(9, 0, 0, 0);
      }
    }

    return expiryDate;
  }

  /**
   * Unit Function 2.1.3: Check if settlement can be created
   *
   * IMPORTANT: Uses per-user attempt tracking, not total count
   * Race condition handled via pessimistic locking in compose function
   */
  async checkSettlementEligibility(
    disputeId: string,
    proposerId: string,
  ): Promise<SettlementEligibilityResult> {
    // Load dispute
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      return { eligible: false, reason: 'Dispute not found' };
    }

    // Status check using string comparison for flexibility
    const statusStr = dispute.status as string;

    if (SETTLEMENT_CLOSED_STATUSES.includes(statusStr)) {
      return { eligible: false, reason: 'Dispute is already closed' };
    }

    if (statusStr === 'IN_VERDICT_PROCESS') {
      return { eligible: false, reason: 'Cannot settle during verdict process' };
    }

    if (statusStr === 'AWAITING_VERDICT') {
      return { eligible: false, reason: 'Hearing completed, awaiting verdict' };
    }

    if (!SETTLEMENT_ALLOWED_STATUSES.includes(statusStr)) {
      return { eligible: false, reason: `Settlement not allowed in status: ${dispute.status}` };
    }

    // Check for existing PENDING settlement
    const pendingSettlement = await this.settlementRepository.findOne({
      where: { disputeId, status: SettlementStatus.PENDING },
    });

    if (pendingSettlement) {
      return {
        eligible: false,
        reason: 'A pending settlement offer already exists',
        pendingSettlement,
      };
    }

    // Per-user attempt check
    const userAttempts = await this.settlementRepository.count({
      where: { disputeId, proposerId },
    });

    if (userAttempts >= SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER) {
      return {
        eligible: false,
        reason: 'You have reached maximum settlement attempts (3)',
        remainingAttempts: 0,
      };
    }

    return {
      eligible: true,
      remainingAttempts: SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER - userAttempts,
    };
  }

  /**
   * Unit Function: Verify user is party to dispute
   */
  verifyDisputeParty(
    dispute: DisputeEntity,
    userId: string,
  ): { isParty: boolean; role: 'raiser' | 'defendant' | null } {
    if (dispute.raisedById === userId) {
      return { isParty: true, role: 'raiser' };
    }
    if (dispute.defendantId === userId) {
      return { isParty: true, role: 'defendant' };
    }
    return { isParty: false, role: null };
  }

  /**
   * Unit Function: Get the other party in the dispute
   */
  getResponderId(dispute: DisputeEntity, proposerId: string): string {
    return dispute.raisedById === proposerId ? dispute.defendantId : dispute.raisedById;
  }

  /**
   * Unit Function: Check if user can cancel their settlement offer
   * Only allowed within CANCEL_WINDOW_HOURS of creation
   */
  canCancelSettlement(
    settlement: DisputeSettlementEntity,
    userId: string,
  ): { canCancel: boolean; reason?: string } {
    if (settlement.proposerId !== userId) {
      return { canCancel: false, reason: 'Only the proposer can cancel' };
    }

    if (settlement.status !== SettlementStatus.PENDING) {
      return { canCancel: false, reason: 'Settlement is not pending' };
    }

    const createdAt = new Date(settlement.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > SETTLEMENT_CONFIG.CANCEL_WINDOW_HOURS) {
      return { canCancel: false, reason: 'Cancel window has expired (1 hour)' };
    }

    return { canCancel: true };
  }

  // ===========================================================================
  // EDGE CASE UNIT FUNCTIONS
  // ===========================================================================

  /**
   * EDGE CASE 1: "Silent Treatment" Prevention
   *
   * Unit Function: Check if responder's chat is locked due to pending settlement
   * When a settlement offer exists, the responder MUST respond before chatting
   */
  async checkChatLockStatus(disputeId: string, userId: string): Promise<ChatLockStatus> {
    if (!SETTLEMENT_CONFIG.CHAT_LOCK_ENABLED) {
      return { isLocked: false };
    }

    // Find pending settlement where this user is the responder
    const pendingSettlement = await this.settlementRepository.findOne({
      where: {
        disputeId,
        status: SettlementStatus.PENDING,
      },
    });

    if (!pendingSettlement) {
      return { isLocked: false };
    }

    // Load dispute to determine who is the responder
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      return { isLocked: false };
    }

    const expectedResponderId = this.getResponderId(dispute, pendingSettlement.proposerId);

    // Only lock the responder, not the proposer
    if (userId !== expectedResponderId) {
      return { isLocked: false };
    }

    // Calculate mandatory response deadline
    const createdAt = new Date(pendingSettlement.createdAt);
    const mandatoryDeadline = new Date(createdAt);
    mandatoryDeadline.setHours(
      mandatoryDeadline.getHours() + SETTLEMENT_CONFIG.MANDATORY_RESPONSE_HOURS,
    );

    return {
      isLocked: true,
      lockedUntil: mandatoryDeadline,
      pendingSettlementId: pendingSettlement.id,
      reason:
        'You must respond to the pending settlement offer (Accept or Reject) before you can chat or upload evidence.',
    };
  }

  /**
   * EDGE CASE 1: Count ignored (expired) offers for a user
   * Used to determine "non-cooperative" behavior
   */
  async countIgnoredOffers(disputeId: string, userId: string): Promise<number> {
    // An "ignored" offer is one where:
    // - The user was the expected responder
    // - Status = EXPIRED (they let it expire without responding)
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) return 0;

    const allExpired = await this.settlementRepository.find({
      where: {
        disputeId,
        status: SettlementStatus.EXPIRED,
      },
    });

    // Count only those where userId was the expected responder
    let ignoredCount = 0;
    for (const settlement of allExpired) {
      const expectedResponder = this.getResponderId(dispute, settlement.proposerId);
      if (expectedResponder === userId) {
        ignoredCount++;
      }
    }

    return ignoredCount;
  }

  /**
   * EDGE CASE 1: Check if user should be flagged as non-cooperative
   */
  async isUserNonCooperative(
    disputeId: string,
    userId: string,
  ): Promise<{
    isNonCooperative: boolean;
    ignoredOffers: number;
    threshold: number;
  }> {
    const ignoredOffers = await this.countIgnoredOffers(disputeId, userId);
    return {
      isNonCooperative: ignoredOffers >= SETTLEMENT_CONFIG.MAX_IGNORED_OFFERS,
      ignoredOffers,
      threshold: SETTLEMENT_CONFIG.MAX_IGNORED_OFFERS,
    };
  }

  /**
   * EDGE CASE 2: Validate rejection reason quality
   * Must be meaningful (min 50 chars) to prevent "cộc lốc" rejections
   */
  validateRejectionReason(reason?: string): { valid: boolean; error?: string } {
    if (!reason || reason.trim().length === 0) {
      return {
        valid: false,
        error: 'Rejection reason is required. Please explain why you are rejecting this offer.',
      };
    }

    if (reason.trim().length < 50) {
      return {
        valid: false,
        error: `Rejection reason must be at least 50 characters. Current: ${reason.trim().length}. Please provide a detailed explanation to help the other party understand your position.`,
      };
    }

    // Check for spam/low-quality responses
    const spamPatterns = [/^(no|nope|reject|refuse)+$/i, /^(.)\1{10,}$/];
    for (const pattern of spamPatterns) {
      if (pattern.test(reason.trim())) {
        return {
          valid: false,
          error:
            'Please provide a meaningful rejection reason, not spam. This helps the other party make a better counter-offer.',
        };
      }
    }

    return { valid: true };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS
  // ===========================================================================

  /**
   * Compose Function 2.2.1: Create Settlement Offer
   *
   * Uses pessimistic locking (SELECT FOR UPDATE) to prevent race conditions
   * when two users try to create offers simultaneously.
   */
  async createSettlementOffer(
    disputeId: string,
    dto: CreateSettlementOfferDto,
    proposerId: string,
  ): Promise<DisputeSettlementEntity> {
    return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // 1. Load dispute with lock
      const dispute = await manager
        .getRepository(DisputeEntity)
        .createQueryBuilder('dispute')
        .setLock('pessimistic_write')
        .where('dispute.id = :id', { id: disputeId })
        .getOne();

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      // 2. Verify proposer is party to dispute
      const partyCheck = this.verifyDisputeParty(dispute, proposerId);
      if (!partyCheck.isParty) {
        throw new ForbiddenException('Only dispute parties can create settlement offers');
      }

      // 3. Check eligibility (within same transaction for consistency)
      const eligibility = await this.checkSettlementEligibility(disputeId, proposerId);
      if (!eligibility.eligible) {
        throw new BadRequestException(eligibility.reason);
      }

      // 4. Load escrow for funded amount
      const escrow = await manager.getRepository(EscrowEntity).findOne({
        where: { milestoneId: dispute.milestoneId },
      });

      if (!escrow) {
        throw new NotFoundException('Escrow not found for this dispute');
      }

      // 5. Validate money logic
      const moneyValidation = this.validateMoneyLogic(
        dto.amountToFreelancer,
        dto.amountToClient,
        escrow.fundedAmount,
      );

      if (!moneyValidation.valid) {
        throw new BadRequestException(moneyValidation.error);
      }

      // 6. Calculate expiry
      const expiresAt = this.calculateExpiryTime({
        expiryHours: dto.expiryHours,
        excludeWeekends: dto.excludeWeekends,
      });

      // 7. Create settlement entity
      const settlementRepo = manager.getRepository(DisputeSettlementEntity);
      const settlement = settlementRepo.create({
        disputeId,
        proposerId,
        proposerRole: partyCheck.role!,
        amountToFreelancer: dto.amountToFreelancer,
        amountToClient: dto.amountToClient,
        platformFee: moneyValidation.breakdown!.totalPlatformFee,
        terms: dto.terms,
        status: SettlementStatus.PENDING,
        expiresAt,
      });

      const savedSettlement = await settlementRepo.save(settlement);

      // 8. Update dispute status if needed
      if ([DisputeStatus.OPEN, DisputeStatus.PENDING_REVIEW].includes(dispute.status)) {
        dispute.status = DisputeStatus.IN_MEDIATION;
        await manager.save(dispute);
      }

      this.logger.log(`Settlement offer created: ${savedSettlement.id} for dispute: ${disputeId}`);

      // 9. Emit event (after transaction commits)
      this.eventEmitter.emit('settlement.offered', {
        settlementId: savedSettlement.id,
        disputeId,
        proposerId,
        responderId: this.getResponderId(dispute, proposerId),
        amount: {
          toFreelancer: dto.amountToFreelancer,
          toClient: dto.amountToClient,
        },
        expiresAt,
      });

      return savedSettlement;
    });
  }

  /**
   * Compose Function 2.2.2: Respond to Settlement (Accept/Reject)
   */
  async respondToSettlement(
    settlementId: string,
    dto: RespondToSettlementDto,
    responderId: string,
  ): Promise<DisputeSettlementEntity> {
    return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // 1. Load settlement with lock
      const settlement = await manager
        .getRepository(DisputeSettlementEntity)
        .createQueryBuilder('settlement')
        .setLock('pessimistic_write')
        .where('settlement.id = :id', { id: settlementId })
        .getOne();

      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }

      // 2. Check status
      if (settlement.status !== SettlementStatus.PENDING) {
        throw new BadRequestException(`Settlement is ${settlement.status}, cannot respond`);
      }

      // 3. Check expiry
      if (new Date() > new Date(settlement.expiresAt)) {
        // Auto-expire
        settlement.status = SettlementStatus.EXPIRED;
        await manager.save(settlement);
        throw new BadRequestException('Settlement offer has expired');
      }

      // 4. Load dispute to verify responder
      const dispute = await manager.getRepository(DisputeEntity).findOne({
        where: { id: settlement.disputeId },
      });

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      // Responder must be the other party
      const expectedResponderId = this.getResponderId(dispute, settlement.proposerId);
      if (responderId !== expectedResponderId) {
        throw new ForbiddenException('Only the other dispute party can respond');
      }

      // 5. Process response
      settlement.responderId = responderId;
      settlement.respondedAt = new Date();

      if (dto.accept) {
        return await this.processAcceptSettlement(manager, settlement, dispute);
      } else {
        return await this.processRejectSettlement(manager, settlement, dispute, dto.rejectedReason);
      }
    });
  }

  /**
   * Helper: Process settlement acceptance
   */
  private async processAcceptSettlement(
    manager: EntityManager,
    settlement: DisputeSettlementEntity,
    dispute: DisputeEntity,
  ): Promise<DisputeSettlementEntity> {
    settlement.status = SettlementStatus.ACCEPTED;

    // Update dispute
    dispute.status = DisputeStatus.RESOLVED;
    dispute.acceptedSettlementId = settlement.id;
    dispute.resolvedAt = new Date();

    await manager.save(settlement);
    await manager.save(dispute);

    this.logger.log(`Settlement accepted: ${settlement.id}, dispute resolved: ${dispute.id}`);

    // TODO: Execute money transfer
    // This will be implemented when Wallet/Transaction services are ready
    // - Transfer amountToFreelancer - freelancerFee → Freelancer wallet
    // - Transfer amountToClient - clientFee → Client wallet
    // - Transfer totalPlatformFee → Platform wallet

    // Emit event
    this.eventEmitter.emit('settlement.accepted', {
      settlementId: settlement.id,
      disputeId: dispute.id,
      proposerId: settlement.proposerId,
      responderId: settlement.responderId,
      amounts: {
        freelancer: settlement.amountToFreelancer,
        client: settlement.amountToClient,
        platformFee: settlement.platformFee,
      },
    });

    return settlement;
  }

  /**
   * Helper: Process settlement rejection
   *
   * EDGE CASE 2: "Từ chối cộc lốc" (No-Reason Rejection)
   * - Validates rejection reason (min 50 chars, meaningful content)
   * - Unlocks chat for responder after rejection
   * - Prompts for counter-offer via event
   */
  private async processRejectSettlement(
    manager: EntityManager,
    settlement: DisputeSettlementEntity,
    dispute: DisputeEntity,
    rejectedReason?: string,
  ): Promise<DisputeSettlementEntity> {
    // EDGE CASE 2: Validate rejection reason quality
    const reasonValidation = this.validateRejectionReason(rejectedReason);
    if (!reasonValidation.valid) {
      throw new BadRequestException(reasonValidation.error);
    }

    settlement.status = SettlementStatus.REJECTED;
    settlement.rejectedReason = rejectedReason!.trim();

    await manager.save(settlement);

    this.logger.log(`Settlement rejected: ${settlement.id} with reason: ${rejectedReason}`);

    // Check if both parties have exhausted their attempts
    const [raiserAttempts, defendantAttempts] = await Promise.all([
      manager.getRepository(DisputeSettlementEntity).count({
        where: { disputeId: dispute.id, proposerId: dispute.raisedById },
      }),
      manager.getRepository(DisputeSettlementEntity).count({
        where: { disputeId: dispute.id, proposerId: dispute.defendantId },
      }),
    ]);

    const shouldEscalate =
      raiserAttempts >= SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER &&
      defendantAttempts >= SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER;

    if (shouldEscalate) {
      this.logger.log(
        `Both parties exhausted settlement attempts for dispute: ${dispute.id}, escalating to hearing`,
      );

      // Emit escalation event
      this.eventEmitter.emit('settlement.exhausted', {
        disputeId: dispute.id,
        raiserAttempts,
        defendantAttempts,
      });
    }

    // EDGE CASE: Emit rejection event with counter-offer prompt
    this.eventEmitter.emit('settlement.rejected', {
      settlementId: settlement.id,
      disputeId: dispute.id,
      proposerId: settlement.proposerId,
      responderId: settlement.responderId,
      reason: settlement.rejectedReason,
      remainingAttempts: {
        raiser: SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER - raiserAttempts,
        defendant: SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER - defendantAttempts,
      },
      // NEW: Include counter-offer prompt data
      counterOfferPrompt: {
        enabled: true,
        message:
          'Your settlement was rejected. Would you like to create a counter-offer based on their feedback?',
        rejectionFeedback: settlement.rejectedReason,
      },
    });

    // EDGE CASE 1: Chat is now unlocked for responder (they responded)
    this.eventEmitter.emit('settlement.chatUnlocked', {
      disputeId: dispute.id,
      userId: settlement.responderId,
      reason: 'Settlement offer has been rejected, chat is now unlocked',
    });

    return settlement;
  }

  /**
   * Compose Function 2.2.3: Cancel Settlement Offer
   *
   * Only proposer can cancel, within 1 hour of creation
   */
  async cancelSettlement(settlementId: string, userId: string): Promise<DisputeSettlementEntity> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    const cancelCheck = this.canCancelSettlement(settlement, userId);
    if (!cancelCheck.canCancel) {
      throw new BadRequestException(cancelCheck.reason);
    }

    settlement.status = SettlementStatus.CANCELLED;
    const savedSettlement = await this.settlementRepository.save(settlement);

    this.logger.log(`Settlement cancelled: ${settlementId} by user: ${userId}`);

    this.eventEmitter.emit('settlement.cancelled', {
      settlementId: settlement.id,
      disputeId: settlement.disputeId,
      cancelledBy: userId,
    });

    return savedSettlement;
  }

  /**
   * Compose Function 2.2.4: Expire Old Settlements (Cron Job)
   *
   * Called by scheduler every 15 minutes
   *
   * EDGE CASE 1: "Im lặng là vàng" (Silent Treatment)
   * - Tracks non-compliance when responder ignores offers
   * - Logs "Bad Mark" for verdict consideration
   * - Notifies proposer they can request immediate staff decision
   * - Unlocks chat for responder
   */
  async expireOldSettlements(): Promise<{
    expiredCount: number;
    nonComplianceRecords: NonComplianceRecord[];
  }> {
    const now = new Date();
    const nonComplianceRecords: NonComplianceRecord[] = [];

    // Find all expired pending settlements
    const expiredSettlements = await this.settlementRepository.find({
      where: {
        status: SettlementStatus.PENDING,
      },
    });

    const toExpire = expiredSettlements.filter((s) => new Date(s.expiresAt) < now);

    if (toExpire.length === 0) {
      return { expiredCount: 0, nonComplianceRecords: [] };
    }

    // Load disputes for all expired settlements (batch query)
    const disputeIds = [...new Set(toExpire.map((s) => s.disputeId))];
    const disputes = await this.disputeRepository.findByIds(disputeIds);
    const disputeMap = new Map(disputes.map((d) => [d.id, d]));

    // Update each and emit events
    for (const settlement of toExpire) {
      settlement.status = SettlementStatus.EXPIRED;
      await this.settlementRepository.save(settlement);

      const dispute = disputeMap.get(settlement.disputeId);
      if (!dispute) continue;

      // EDGE CASE 1: Identify the "ignorer" (responder who let it expire)
      const ignorerId = this.getResponderId(dispute, settlement.proposerId);

      // Create non-compliance record
      const nonCompliance: NonComplianceRecord = {
        disputeId: settlement.disputeId,
        userId: ignorerId,
        settlementId: settlement.id,
        type: 'IGNORED_OFFER',
        timestamp: now,
        description: `User ${ignorerId} ignored settlement offer #${settlement.id} (Amount: $${settlement.amountToFreelancer} to Freelancer, $${settlement.amountToClient} to Client). Offer expired without response.`,
      };
      nonComplianceRecords.push(nonCompliance);

      // Check total ignored count for this user
      const ignoredCount = await this.countIgnoredOffers(settlement.disputeId, ignorerId);
      const isNonCooperative = ignoredCount >= SETTLEMENT_CONFIG.MAX_IGNORED_OFFERS;

      this.logger.warn(
        `Settlement expired: ${settlement.id}. ` +
          `User ${ignorerId} has ignored ${ignoredCount} offer(s). ` +
          `Non-cooperative flag: ${isNonCooperative}`,
      );

      // Emit settlement expired event with non-compliance data
      this.eventEmitter.emit('settlement.expired', {
        settlementId: settlement.id,
        disputeId: settlement.disputeId,
        proposerId: settlement.proposerId,
        expiredAt: settlement.expiresAt,
        // NEW: Non-compliance tracking
        nonCompliance: {
          ignorerId,
          ignoredCount,
          isNonCooperative,
          description: nonCompliance.description,
        },
      });

      // EDGE CASE 1: Notify proposer they can request immediate staff decision
      this.eventEmitter.emit('settlement.proposerNotification', {
        disputeId: settlement.disputeId,
        proposerId: settlement.proposerId,
        type: 'OFFER_IGNORED',
        message:
          'The other party did not respond to your settlement offer. ' +
          'You have the right to request an immediate staff decision. ' +
          'Their non-response will be noted in the dispute record.',
        canRequestStaffDecision: true,
        ignoredOfferDetails: {
          settlementId: settlement.id,
          amountToFreelancer: settlement.amountToFreelancer,
          amountToClient: settlement.amountToClient,
          expiredAt: settlement.expiresAt,
        },
      });

      // EDGE CASE 1: Unlock chat for the responder (expired = no longer locked)
      this.eventEmitter.emit('settlement.chatUnlocked', {
        disputeId: settlement.disputeId,
        userId: ignorerId,
        reason:
          'Settlement offer has expired. Chat is unlocked but non-compliance has been recorded.',
      });
    }

    // Check for disputes where both parties exhausted attempts
    for (const disputeId of disputeIds) {
      await this.checkAndEmitExhaustedAttempts(disputeId);
    }

    return { expiredCount: toExpire.length, nonComplianceRecords };
  }

  /**
   * Helper: Check if both parties exhausted attempts and emit event
   */
  private async checkAndEmitExhaustedAttempts(disputeId: string): Promise<void> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) return;

    // Skip if already resolved/closed
    const statusStr = dispute.status as string;
    if (SETTLEMENT_CLOSED_STATUSES.includes(statusStr)) {
      return;
    }

    const [raiserAttempts, defendantAttempts] = await Promise.all([
      this.settlementRepository.count({
        where: { disputeId, proposerId: dispute.raisedById },
      }),
      this.settlementRepository.count({
        where: { disputeId, proposerId: dispute.defendantId },
      }),
    ]);

    if (
      raiserAttempts >= SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER &&
      defendantAttempts >= SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER
    ) {
      // Check no pending settlements
      const pending = await this.settlementRepository.count({
        where: { disputeId, status: SettlementStatus.PENDING },
      });

      if (pending === 0) {
        this.eventEmitter.emit('settlement.exhausted', {
          disputeId,
          raiserAttempts,
          defendantAttempts,
        });
      }
    }
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get settlement by ID with access check
   */
  async getSettlementById(
    settlementId: string,
    userId: string,
    userRoles: string[],
  ): Promise<DisputeSettlementEntity> {
    const settlement = await this.settlementRepository.findOne({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    // Staff/Admin can view any settlement
    const isStaffOrAdmin = userRoles.some((r) => ['STAFF', 'ADMIN'].includes(r));
    if (isStaffOrAdmin) {
      return settlement;
    }

    // Parties can view their settlements
    if (settlement.proposerId !== userId && settlement.responderId !== userId) {
      // Need to check dispute parties
      const dispute = await this.disputeRepository.findOne({
        where: { id: settlement.disputeId },
      });

      if (!dispute || (dispute.raisedById !== userId && dispute.defendantId !== userId)) {
        throw new ForbiddenException('You do not have access to this settlement');
      }
    }

    return settlement;
  }

  /**
   * Get all settlements for a dispute
   */
  async getSettlementsByDispute(
    disputeId: string,
    userId: string,
    userRoles: string[],
  ): Promise<DisputeSettlementEntity[]> {
    // First verify access to dispute
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const isStaffOrAdmin = userRoles.some((r) => ['STAFF', 'ADMIN'].includes(r));
    const isParty = dispute.raisedById === userId || dispute.defendantId === userId;

    if (!isStaffOrAdmin && !isParty) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    return this.settlementRepository.find({
      where: { disputeId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get settlement attempts summary for a dispute
   */
  async getSettlementAttemptsSummary(disputeId: string): Promise<{
    raiserAttempts: number;
    defendantAttempts: number;
    raiserRemaining: number;
    defendantRemaining: number;
    hasPending: boolean;
  }> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const [raiserAttempts, defendantAttempts, pending] = await Promise.all([
      this.settlementRepository.count({
        where: { disputeId, proposerId: dispute.raisedById },
      }),
      this.settlementRepository.count({
        where: { disputeId, proposerId: dispute.defendantId },
      }),
      this.settlementRepository.findOne({
        where: { disputeId, status: SettlementStatus.PENDING },
      }),
    ]);

    return {
      raiserAttempts,
      defendantAttempts,
      raiserRemaining: Math.max(0, SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER - raiserAttempts),
      defendantRemaining: Math.max(0, SETTLEMENT_CONFIG.MAX_ATTEMPTS_PER_USER - defendantAttempts),
      hasPending: !!pending,
    };
  }

  // ===========================================================================
  // EDGE CASE 3: STAFF SUGGESTION (Invisible Staff Problem)
  // ===========================================================================

  /**
   * EDGE CASE 3: "Staff vô hình" (Invisible Staff)
   *
   * Staff can provide a non-binding suggestion to help parties negotiate.
   * This is NOT a formal offer, just guidance based on similar cases.
   *
   * NOTE: In this MVP implementation, suggestions are stored in metadata/events.
   * A dedicated StaffSuggestionEntity could be added later for persistent storage.
   */
  async createStaffSuggestion(
    disputeId: string,
    staffId: string,
    suggestion: {
      suggestedAmountToFreelancer: number;
      suggestedAmountToClient: number;
      reasoning: string;
      similarCaseReferences?: string;
    },
  ): Promise<StaffSuggestion> {
    // 1. Verify dispute exists and is in mediation
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // 2. Check dispute is in a status where suggestions make sense
    const statusStr = dispute.status as string;
    if (SETTLEMENT_CLOSED_STATUSES.includes(statusStr)) {
      throw new BadRequestException('Cannot suggest settlement for closed dispute');
    }

    // 3. Verify staff is assigned to this dispute (optional, depending on business rules)
    // For now, any staff can suggest. Can add: if (dispute.assignedStaffId !== staffId) throw...

    // 4. Load escrow to validate suggested amounts
    const escrow = await this.escrowRepository.findOne({
      where: { milestoneId: dispute.milestoneId },
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found for this dispute');
    }

    // 5. Validate money logic for suggestion
    const moneyValidation = this.validateMoneyLogic(
      suggestion.suggestedAmountToFreelancer,
      suggestion.suggestedAmountToClient,
      escrow.fundedAmount,
    );

    if (!moneyValidation.valid) {
      throw new BadRequestException(`Invalid suggestion: ${moneyValidation.error}`);
    }

    // 6. Create suggestion object (stored via event for now)
    const staffSuggestion: StaffSuggestion = {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      disputeId,
      staffId,
      suggestedAmountToFreelancer: suggestion.suggestedAmountToFreelancer,
      suggestedAmountToClient: suggestion.suggestedAmountToClient,
      reasoning: suggestion.reasoning,
      similarCaseReferences: suggestion.similarCaseReferences,
      createdAt: new Date(),
    };

    this.logger.log(
      `Staff suggestion created for dispute ${disputeId}: ` +
        `$${suggestion.suggestedAmountToFreelancer} to Freelancer, ` +
        `$${suggestion.suggestedAmountToClient} to Client`,
    );

    // 7. Emit event to notify both parties
    this.eventEmitter.emit('settlement.staffSuggestion', {
      ...staffSuggestion,
      feeBreakdown: moneyValidation.breakdown,
      message:
        'A staff member has provided a suggested settlement based on similar cases. ' +
        'This is a non-binding recommendation to help you reach an agreement.',
    });

    // 8. Notify both parties individually
    this.eventEmitter.emit('notification.settlement', {
      disputeId,
      targetUserIds: [dispute.raisedById, dispute.defendantId],
      type: 'STAFF_SUGGESTION',
      title: 'Staff Settlement Suggestion',
      body:
        `Staff suggests: $${suggestion.suggestedAmountToFreelancer} to Freelancer, ` +
        `$${suggestion.suggestedAmountToClient} to Client. ` +
        `Reasoning: ${suggestion.reasoning.substring(0, 100)}...`,
    });

    return staffSuggestion;
  }

  /**
   * Get non-compliance summary for a dispute (used in verdict decisions)
   */
  async getNonComplianceSummary(disputeId: string): Promise<{
    raiserIgnoredOffers: number;
    defendantIgnoredOffers: number;
    raiserIsNonCooperative: boolean;
    defendantIsNonCooperative: boolean;
    recommendation: string | null;
  }> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const [raiserIgnored, defendantIgnored] = await Promise.all([
      this.countIgnoredOffers(disputeId, dispute.raisedById),
      this.countIgnoredOffers(disputeId, dispute.defendantId),
    ]);

    const raiserIsNonCooperative = raiserIgnored >= SETTLEMENT_CONFIG.MAX_IGNORED_OFFERS;
    const defendantIsNonCooperative = defendantIgnored >= SETTLEMENT_CONFIG.MAX_IGNORED_OFFERS;

    // Generate recommendation for staff/verdict
    let recommendation: string | null = null;
    if (raiserIsNonCooperative && !defendantIsNonCooperative) {
      recommendation = `Raiser has ignored ${raiserIgnored} settlement offers, showing non-cooperative behavior. Consider this in verdict.`;
    } else if (!raiserIsNonCooperative && defendantIsNonCooperative) {
      recommendation = `Defendant has ignored ${defendantIgnored} settlement offers, showing non-cooperative behavior. Consider this in verdict.`;
    } else if (raiserIsNonCooperative && defendantIsNonCooperative) {
      recommendation = `Both parties have been non-cooperative (Raiser: ${raiserIgnored}, Defendant: ${defendantIgnored} ignored offers). Consider escalating to hearing.`;
    }

    return {
      raiserIgnoredOffers: raiserIgnored,
      defendantIgnoredOffers: defendantIgnored,
      raiserIsNonCooperative,
      defendantIsNonCooperative,
      recommendation,
    };
  }
}
