import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';

import {
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeResult,
  DisputeStatus,
  DisputeType,
  DisputeVerdictEntity,
  EscrowEntity,
  EscrowStatus,
  FaultType,
  LegalActionType,
  LegalSignatureEntity,
  MilestoneEntity,
  MilestoneStatus,
  ProjectEntity,
  ProjectStatus,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  UserRole,
  WalletEntity,
} from 'src/database/entities';
import { AdminVerdictDto, AppealVerdictDto, VerdictReasoningDto } from '../dto/verdict.dto';
import { DisputeStateMachine, determineLoser } from '../dispute-state-machine';
import { StaffAssignmentService } from './staff-assignment.service';
import type { MoneyDistribution } from '../interfaces/resolution.interface';

export interface VerdictReasoningValidationResult {
  valid: boolean;
  errors: string[];
}

export interface MoneyDistributionValidationResult {
  valid: boolean;
  error?: string;
  breakdown?: {
    amountToFreelancer: number;
    amountToClient: number;
    platformFee: number;
    total: number;
  };
}

type PenaltySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

const POLICY_FORMAT = /^[A-Z0-9]+-\d+(?:\.\d+)*:\s.+/;

const TRUST_SCORE_PENALTY_RULES: Record<
  FaultType,
  {
    min: number;
    max: number;
    default: number;
    severity?: Record<PenaltySeverity, number>;
  }
> = {
  [FaultType.FRAUD]: { min: 100, max: 100, default: 100 },
  [FaultType.GHOSTING]: { min: 40, max: 60, default: 50 },
  [FaultType.NON_DELIVERY]: {
    min: 30,
    max: 50,
    default: 40,
    severity: { LOW: 30, MEDIUM: 40, HIGH: 50 },
  },
  [FaultType.QUALITY_MISMATCH]: {
    min: 20,
    max: 40,
    default: 30,
    severity: { LOW: 20, MEDIUM: 30, HIGH: 40 },
  },
  [FaultType.DEADLINE_MISSED]: {
    min: 10,
    max: 30,
    default: 20,
    severity: { LOW: 10, MEDIUM: 20, HIGH: 30 },
  },
  [FaultType.SCOPE_CHANGE_CONFLICT]: {
    min: 10,
    max: 25,
    default: 15,
    severity: { LOW: 10, MEDIUM: 15, HIGH: 25 },
  },
  [FaultType.PAYMENT_ISSUE]: {
    min: 15,
    max: 40,
    default: 25,
    severity: { LOW: 15, MEDIUM: 25, HIGH: 40 },
  },
  [FaultType.MUTUAL_FAULT]: { min: 10, max: 10, default: 10 },
  [FaultType.NO_FAULT]: { min: 0, max: 0, default: 0 },
  [FaultType.OTHER]: { min: 5, max: 20, default: 10 },
};

const VERDICT_CONFIG = {
  APPEAL_WINDOW_DAYS: 3,
  APPEAL_MIN_REASON_LENGTH: 200,
  APPEAL_FEE_AMOUNT: 10,
  APPEAL_FEE_CURRENCY: 'USD',
} as const;

const TRUST_SCORE_MAX = 5;

export interface LegalSignatureContext {
  termsContentSnapshot?: string;
  termsVersion?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

@Injectable()
export class VerdictService {
  private readonly logger = new Logger(VerdictService.name);

  constructor(
    @InjectRepository(DisputeEvidenceEntity)
    private readonly evidenceRepo: Repository<DisputeEvidenceEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly staffAssignmentService: StaffAssignmentService,
  ) {}

  private determineTransferRecipients(
    disputeType: DisputeType,
    project: ProjectEntity,
  ): { clientSideRecipient: string; freelancerSideRecipient: string } {
    switch (disputeType) {
      case DisputeType.CLIENT_VS_FREELANCER:
      case DisputeType.FREELANCER_VS_CLIENT:
        return {
          clientSideRecipient: project.clientId,
          freelancerSideRecipient: project.freelancerId,
        };
      case DisputeType.CLIENT_VS_BROKER:
      case DisputeType.BROKER_VS_CLIENT:
        return {
          clientSideRecipient: project.clientId,
          freelancerSideRecipient: project.brokerId,
        };
      case DisputeType.FREELANCER_VS_BROKER:
        return {
          clientSideRecipient: project.freelancerId,
          freelancerSideRecipient: project.brokerId,
        };
      case DisputeType.BROKER_VS_FREELANCER:
        return {
          clientSideRecipient: project.brokerId,
          freelancerSideRecipient: project.freelancerId,
        };
      default:
        return {
          clientSideRecipient: project.clientId,
          freelancerSideRecipient: project.freelancerId,
        };
    }
  }

  private buildVerdictDistribution(
    amountToFreelancer: number,
    amountToClient: number,
    escrow: EscrowEntity,
    dispute: DisputeEntity,
    project: ProjectEntity,
    platformFee: number,
  ): MoneyDistribution {
    const freelancerSideTotal = new Decimal(amountToFreelancer).toDecimalPlaces(2);
    const clientAmount = new Decimal(amountToClient).toDecimalPlaces(2);
    const platformFeeAmount = new Decimal(platformFee).toDecimalPlaces(2);

    let freelancerAmount = freelancerSideTotal;
    let brokerAmount = new Decimal(0);

    const isDisputeInvolvingBroker = [
      DisputeType.CLIENT_VS_BROKER,
      DisputeType.BROKER_VS_CLIENT,
      DisputeType.FREELANCER_VS_BROKER,
      DisputeType.BROKER_VS_FREELANCER,
    ].includes(dispute.disputeType);

    if (project.brokerId && !isDisputeInvolvingBroker && freelancerSideTotal.greaterThan(0)) {
      const developerPercent = new Decimal(escrow.developerPercentage || 0);
      const brokerPercent = new Decimal(escrow.brokerPercentage || 0);
      const denominator = developerPercent.plus(brokerPercent);

      if (denominator.greaterThan(0)) {
        freelancerAmount = freelancerSideTotal
          .times(developerPercent)
          .dividedBy(denominator)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        brokerAmount = freelancerSideTotal
          .minus(freelancerAmount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
    }

    const totalAmount = freelancerSideTotal.plus(clientAmount).plus(platformFeeAmount).toNumber();

    return {
      clientAmount: clientAmount.toNumber(),
      freelancerAmount: freelancerAmount.toNumber(),
      brokerAmount: brokerAmount.toNumber(),
      platformFee: platformFeeAmount.toNumber(),
      totalAmount,
    };
  }

  private buildSignatureContext(context?: LegalSignatureContext) {
    return {
      termsContentSnapshot: context?.termsContentSnapshot || 'Terms snapshot not provided',
      termsVersion: context?.termsVersion || 'v1',
      ipAddress: context?.ipAddress || '0.0.0.0',
      userAgent: context?.userAgent || 'system',
      deviceFingerprint: context?.deviceFingerprint,
    };
  }

  private async createLegalSignature(
    queryRunner: QueryRunner,
    dispute: DisputeEntity,
    signerId: string,
    signerRole: UserRole,
    actionType: LegalActionType,
    referenceType?: string,
    referenceId?: string,
    context?: LegalSignatureContext,
  ): Promise<void> {
    const signatureContext = this.buildSignatureContext(context);

    const signature = queryRunner.manager.create(LegalSignatureEntity, {
      disputeId: dispute.id,
      signerId,
      signerRole,
      actionType,
      termsContentSnapshot: signatureContext.termsContentSnapshot,
      termsVersion: signatureContext.termsVersion,
      referenceType,
      referenceId,
      ipAddress: signatureContext.ipAddress,
      userAgent: signatureContext.userAgent,
      deviceFingerprint: signatureContext.deviceFingerprint,
    });

    await queryRunner.manager.save(signature);
  }

  async createDisputeSignature(
    queryRunner: QueryRunner,
    dispute: DisputeEntity,
    signerId: string,
    signerRole: UserRole,
    context?: LegalSignatureContext,
  ): Promise<void> {
    await this.createLegalSignature(
      queryRunner,
      dispute,
      signerId,
      signerRole,
      LegalActionType.CREATE_DISPUTE,
      'Dispute',
      dispute.id,
      context,
    );
  }

  private async createPendingTransfer(
    queryRunner: QueryRunner,
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceType: string,
    referenceId: string,
    metadata: Record<string, any>,
  ): Promise<TransactionEntity | null> {
    if (amount <= 0) {
      return null;
    }

    const wallet = await queryRunner.manager.findOne(WalletEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet for user ${userId} not found`);
    }

    wallet.pendingBalance = new Decimal(wallet.pendingBalance)
      .plus(amount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    await queryRunner.manager.save(WalletEntity, wallet);

    const transaction = queryRunner.manager.create(TransactionEntity, {
      walletId: wallet.id,
      amount,
      fee: 0,
      netAmount: amount,
      currency: wallet.currency || VERDICT_CONFIG.APPEAL_FEE_CURRENCY,
      type,
      status: TransactionStatus.PENDING,
      referenceType,
      referenceId,
      description,
      metadata,
    });

    return queryRunner.manager.save(transaction);
  }

  private async createCompletedTransfer(
    queryRunner: QueryRunner,
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    referenceType: string,
    referenceId: string,
    metadata: Record<string, any>,
    adjustHeldBalance: boolean,
  ): Promise<TransactionEntity | null> {
    if (amount <= 0) {
      return null;
    }

    const wallet = await queryRunner.manager.findOne(WalletEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet for user ${userId} not found`);
    }

    wallet.balance = new Decimal(wallet.balance)
      .plus(amount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    if (adjustHeldBalance) {
      const newHeld = new Decimal(wallet.heldBalance)
        .minus(amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      wallet.heldBalance = Math.max(0, newHeld);
    }

    if (type === TransactionType.ESCROW_RELEASE) {
      wallet.totalEarned = new Decimal(wallet.totalEarned)
        .plus(amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
    }

    await queryRunner.manager.save(WalletEntity, wallet);

    const transaction = queryRunner.manager.create(TransactionEntity, {
      walletId: wallet.id,
      amount,
      fee: 0,
      netAmount: amount,
      currency: wallet.currency || VERDICT_CONFIG.APPEAL_FEE_CURRENCY,
      type,
      status: TransactionStatus.COMPLETED,
      referenceType,
      referenceId,
      description,
      metadata,
      completedAt: new Date(),
    });

    return queryRunner.manager.save(transaction);
  }

  private async queueTransfers(
    queryRunner: QueryRunner,
    distribution: MoneyDistribution,
    dispute: DisputeEntity,
    project: ProjectEntity,
    escrow: EscrowEntity,
    metadata: Record<string, any>,
    pending: boolean,
  ): Promise<TransactionEntity[]> {
    const transactions: TransactionEntity[] = [];
    const { clientSideRecipient, freelancerSideRecipient } = this.determineTransferRecipients(
      dispute.disputeType,
      project,
    );

    if (distribution.clientAmount > 0) {
      const type =
        clientSideRecipient === project.clientId
          ? TransactionType.REFUND
          : TransactionType.ESCROW_RELEASE;
      const adjustHeld = type === TransactionType.REFUND;
      const transaction = pending
        ? await this.createPendingTransfer(
            queryRunner,
            clientSideRecipient,
            distribution.clientAmount,
            type,
            `Verdict payout for dispute ${dispute.id}`,
            'Escrow',
            escrow.id,
            metadata,
          )
        : await this.createCompletedTransfer(
            queryRunner,
            clientSideRecipient,
            distribution.clientAmount,
            type,
            `Verdict payout for dispute ${dispute.id}`,
            'Escrow',
            escrow.id,
            metadata,
            adjustHeld,
          );
      if (transaction) {
        transactions.push(transaction);
      }
    }

    if (distribution.freelancerAmount > 0) {
      const transaction = pending
        ? await this.createPendingTransfer(
            queryRunner,
            freelancerSideRecipient,
            distribution.freelancerAmount,
            TransactionType.ESCROW_RELEASE,
            `Verdict payout for dispute ${dispute.id}`,
            'Escrow',
            escrow.id,
            metadata,
          )
        : await this.createCompletedTransfer(
            queryRunner,
            freelancerSideRecipient,
            distribution.freelancerAmount,
            TransactionType.ESCROW_RELEASE,
            `Verdict payout for dispute ${dispute.id}`,
            'Escrow',
            escrow.id,
            metadata,
            false,
          );
      if (transaction) {
        transactions.push(transaction);
      }
    }

    if (distribution.brokerAmount > 0 && project.brokerId) {
      const transaction = pending
        ? await this.createPendingTransfer(
            queryRunner,
            project.brokerId,
            distribution.brokerAmount,
            TransactionType.ESCROW_RELEASE,
            `Verdict commission for dispute ${dispute.id}`,
            'Escrow',
            escrow.id,
            metadata,
          )
        : await this.createCompletedTransfer(
            queryRunner,
            project.brokerId,
            distribution.brokerAmount,
            TransactionType.ESCROW_RELEASE,
            `Verdict commission for dispute ${dispute.id}`,
            'Escrow',
            escrow.id,
            metadata,
            false,
          );
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  private async lockPendingVerdictTransactions(
    queryRunner: QueryRunner,
    disputeId: string,
  ): Promise<void> {
    const pendingTransactions = await queryRunner.manager
      .getRepository(TransactionEntity)
      .createQueryBuilder('tx')
      .where("tx.metadata ->> 'disputeId' = :disputeId", { disputeId })
      .andWhere("tx.metadata ->> 'pendingVerdict' = :pending", { pending: 'true' })
      .andWhere('tx.status = :status', { status: TransactionStatus.PENDING })
      .getMany();

    for (const transaction of pendingTransactions) {
      transaction.status = TransactionStatus.PROCESSING;
      transaction.metadata = {
        ...(transaction.metadata || {}),
        appealLocked: true,
      };
      await queryRunner.manager.save(TransactionEntity, transaction);
    }
  }

  private async cancelPendingVerdictTransactions(
    queryRunner: QueryRunner,
    disputeId: string,
    reason: string,
  ): Promise<string[]> {
    const repo = queryRunner.manager.getRepository(TransactionEntity);

    const completedTransactions = await repo
      .createQueryBuilder('tx')
      .where("tx.metadata ->> 'disputeId' = :disputeId", { disputeId })
      .andWhere("tx.metadata ->> 'pendingVerdict' = :pending", { pending: 'true' })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getMany();

    if (completedTransactions.length > 0) {
      throw new BadRequestException(
        'Cannot reverse completed verdict transfers. Manual intervention required.',
      );
    }

    const pendingTransactions = await repo
      .createQueryBuilder('tx')
      .where("tx.metadata ->> 'disputeId' = :disputeId", { disputeId })
      .andWhere("tx.metadata ->> 'pendingVerdict' = :pending", { pending: 'true' })
      .andWhere('tx.status IN (:...statuses)', {
        statuses: [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      })
      .getMany();

    const cancelledIds: string[] = [];

    for (const transaction of pendingTransactions) {
      const wallet = await queryRunner.manager.findOne(WalletEntity, {
        where: { id: transaction.walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (wallet) {
        const newPending = new Decimal(wallet.pendingBalance)
          .minus(transaction.amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
        wallet.pendingBalance = Math.max(0, newPending);
        await queryRunner.manager.save(WalletEntity, wallet);
      }

      transaction.status = TransactionStatus.CANCELLED;
      transaction.failureReason = reason;
      transaction.metadata = {
        ...(transaction.metadata || {}),
        cancelledByAppeal: true,
      };
      await queryRunner.manager.save(TransactionEntity, transaction);
      cancelledIds.push(transaction.id);
    }

    return cancelledIds;
  }

  private async finalizePendingVerdictTransactions(
    queryRunner: QueryRunner,
    disputeId: string,
  ): Promise<string[]> {
    const repo = queryRunner.manager.getRepository(TransactionEntity);
    const pendingTransactions = await repo
      .createQueryBuilder('tx')
      .where("tx.metadata ->> 'disputeId' = :disputeId", { disputeId })
      .andWhere("tx.metadata ->> 'pendingVerdict' = :pending", { pending: 'true' })
      .andWhere('tx.status IN (:...statuses)', {
        statuses: [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      })
      .getMany();

    const completedIds: string[] = [];
    const now = new Date();

    for (const transaction of pendingTransactions) {
      const wallet = await queryRunner.manager.findOne(WalletEntity, {
        where: { id: transaction.walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException(`Wallet ${transaction.walletId} not found`);
      }

      wallet.pendingBalance = Math.max(
        0,
        new Decimal(wallet.pendingBalance)
          .minus(transaction.amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber(),
      );

      wallet.balance = new Decimal(wallet.balance)
        .plus(transaction.amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      if (transaction.type === TransactionType.REFUND) {
        wallet.heldBalance = Math.max(
          0,
          new Decimal(wallet.heldBalance)
            .minus(transaction.amount)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toNumber(),
        );
      } else if (transaction.type === TransactionType.ESCROW_RELEASE) {
        wallet.totalEarned = new Decimal(wallet.totalEarned)
          .plus(transaction.amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      await queryRunner.manager.save(WalletEntity, wallet);

      transaction.status = TransactionStatus.COMPLETED;
      transaction.completedAt = now;
      transaction.metadata = {
        ...(transaction.metadata || {}),
        finalizedByAppealVerdict: true,
      };
      await queryRunner.manager.save(TransactionEntity, transaction);
      completedIds.push(transaction.id);
    }

    return completedIds;
  }

  private async chargeAppealFee(
    queryRunner: QueryRunner,
    appellantId: string,
    disputeId: string,
  ): Promise<TransactionEntity | null> {
    if (VERDICT_CONFIG.APPEAL_FEE_AMOUNT <= 0) {
      return null;
    }

    const wallet = await queryRunner.manager.findOne(WalletEntity, {
      where: { userId: appellantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const feeAmount = new Decimal(VERDICT_CONFIG.APPEAL_FEE_AMOUNT);
    if (new Decimal(wallet.balance).lessThan(feeAmount)) {
      throw new BadRequestException('Insufficient balance to pay appeal fee');
    }

    wallet.balance = new Decimal(wallet.balance)
      .minus(feeAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    wallet.totalSpent = new Decimal(wallet.totalSpent)
      .plus(feeAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    await queryRunner.manager.save(WalletEntity, wallet);

    const transaction = queryRunner.manager.create(TransactionEntity, {
      walletId: wallet.id,
      amount: feeAmount.toNumber(),
      fee: 0,
      netAmount: feeAmount.toNumber(),
      currency: wallet.currency || VERDICT_CONFIG.APPEAL_FEE_CURRENCY,
      type: TransactionType.FEE_DEDUCTION,
      status: TransactionStatus.COMPLETED,
      referenceType: 'DisputeAppeal',
      referenceId: disputeId,
      description: `Appeal fee for dispute ${disputeId}`,
      metadata: {
        disputeId,
        appealFee: true,
      },
      completedAt: new Date(),
    });

    return queryRunner.manager.save(TransactionEntity, transaction);
  }

  private async refundAppealFee(
    queryRunner: QueryRunner,
    appellantId: string,
    disputeId: string,
  ): Promise<TransactionEntity | null> {
    if (VERDICT_CONFIG.APPEAL_FEE_AMOUNT <= 0) {
      return null;
    }

    const wallet = await queryRunner.manager.findOne(WalletEntity, {
      where: { userId: appellantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const amount = new Decimal(VERDICT_CONFIG.APPEAL_FEE_AMOUNT);
    wallet.balance = new Decimal(wallet.balance)
      .plus(amount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    await queryRunner.manager.save(WalletEntity, wallet);

    const transaction = queryRunner.manager.create(TransactionEntity, {
      walletId: wallet.id,
      amount: amount.toNumber(),
      fee: 0,
      netAmount: amount.toNumber(),
      currency: wallet.currency || VERDICT_CONFIG.APPEAL_FEE_CURRENCY,
      type: TransactionType.REFUND,
      status: TransactionStatus.COMPLETED,
      referenceType: 'DisputeAppeal',
      referenceId: disputeId,
      description: `Appeal fee refund for dispute ${disputeId}`,
      metadata: {
        disputeId,
        appealFeeRefund: true,
      },
      completedAt: new Date(),
    });

    return queryRunner.manager.save(TransactionEntity, transaction);
  }

  private getProjectMilestoneStatus(verdict: DisputeResult): {
    newProjectStatus: ProjectStatus;
    newMilestoneStatus: MilestoneStatus;
  } {
    switch (verdict) {
      case DisputeResult.WIN_CLIENT:
        return {
          newProjectStatus: ProjectStatus.CANCELED,
          newMilestoneStatus: MilestoneStatus.PENDING,
        };
      case DisputeResult.WIN_FREELANCER:
      case DisputeResult.SPLIT:
        return {
          newProjectStatus: ProjectStatus.COMPLETED,
          newMilestoneStatus: MilestoneStatus.PAID,
        };
      default:
        throw new BadRequestException(`Invalid verdict: ${verdict}`);
    }
  }

  async validateVerdictReasoning(
    disputeId: string,
    reasoning: VerdictReasoningDto,
  ): Promise<VerdictReasoningValidationResult> {
    const errors: string[] = [];

    if (!reasoning) {
      return { valid: false, errors: ['Reasoning is required'] };
    }

    const violatedPolicies = reasoning.violatedPolicies || [];
    if (violatedPolicies.length === 0) {
      errors.push('violatedPolicies must contain at least one item');
    } else {
      violatedPolicies.forEach((policy, index) => {
        const trimmed = policy?.trim() || '';
        if (!POLICY_FORMAT.test(trimmed)) {
          errors.push(`violatedPolicies[${index}] must match "CODE-X.Y: Description"`);
        }
      });
    }

    if ((reasoning.factualFindings || '').trim().length < 100) {
      errors.push('factualFindings must be at least 100 characters');
    }

    if ((reasoning.legalAnalysis || '').trim().length < 100) {
      errors.push('legalAnalysis must be at least 100 characters');
    }

    if ((reasoning.conclusion || '').trim().length < 50) {
      errors.push('conclusion must be at least 50 characters');
    }

    if (reasoning.supportingEvidenceIds && reasoning.supportingEvidenceIds.length > 0) {
      const uniqueIds = Array.from(new Set(reasoning.supportingEvidenceIds));
      const evidence = await this.evidenceRepo.find({
        where: {
          id: In(uniqueIds),
          disputeId,
        },
        select: ['id'],
      });
      const existingIds = new Set(evidence.map((item) => item.id));
      const missing = uniqueIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) {
        errors.push(`supportingEvidenceIds not found in dispute: ${missing.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateMoneyDistribution(
    amountToFreelancer: number,
    amountToClient: number,
    escrowFundedAmount: number,
    fixedPlatformFee: number,
  ): MoneyDistributionValidationResult {
    const freelancerAmount = new Decimal(amountToFreelancer).toDecimalPlaces(2);
    const clientAmount = new Decimal(amountToClient).toDecimalPlaces(2);
    const platformFee = new Decimal(fixedPlatformFee).toDecimalPlaces(2);
    const fundedAmount = new Decimal(escrowFundedAmount).toDecimalPlaces(2);

    if (freelancerAmount.lessThan(0)) {
      return { valid: false, error: 'Freelancer amount cannot be negative' };
    }
    if (clientAmount.lessThan(0)) {
      return { valid: false, error: 'Client amount cannot be negative' };
    }
    if (platformFee.lessThan(0)) {
      return { valid: false, error: 'Platform fee cannot be negative' };
    }

    if (fundedAmount.lessThanOrEqualTo(0)) {
      return { valid: false, error: 'Escrow funded amount must be greater than 0' };
    }

    const sum = freelancerAmount.plus(clientAmount).plus(platformFee);
    if (!sum.equals(fundedAmount)) {
      const diff = fundedAmount.minus(sum);
      return {
        valid: false,
        error: diff.greaterThan(0)
          ? `Distribution is short by ${diff.toFixed(2)}`
          : `Distribution exceeds funded amount by ${diff.abs().toFixed(2)}`,
      };
    }

    return {
      valid: true,
      breakdown: {
        amountToFreelancer: freelancerAmount.toNumber(),
        amountToClient: clientAmount.toNumber(),
        platformFee: platformFee.toNumber(),
        total: fundedAmount.toNumber(),
      },
    };
  }

  calculateTrustScorePenalty(
    faultType: FaultType,
    options?: { severity?: PenaltySeverity; overridePenalty?: number },
  ): number {
    const rule = TRUST_SCORE_PENALTY_RULES[faultType];
    if (!rule) {
      throw new BadRequestException('Invalid fault type for trust score penalty');
    }

    const severityPenalty = options?.severity ? rule.severity?.[options.severity] : undefined;
    const suggested = severityPenalty ?? rule.default;

    if (options?.overridePenalty !== undefined) {
      const override = options.overridePenalty;
      if (override < rule.min || override > rule.max) {
        throw new BadRequestException(
          `Override penalty must be between ${rule.min} and ${rule.max} for ${faultType}`,
        );
      }
      return override;
    }

    return suggested;
  }

  private getAppealDeadline(from: Date): Date {
    return new Date(from.getTime() + VERDICT_CONFIG.APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  private getFundedAmount(escrow: EscrowEntity): number {
    return escrow.fundedAmount && escrow.fundedAmount > 0
      ? escrow.fundedAmount
      : escrow.totalAmount;
  }

  private resolvePenaltyTargets(dispute: DisputeEntity, faultyParty: string): string[] {
    const normalized = faultyParty?.toLowerCase().trim();
    if (normalized === 'raiser') {
      return [dispute.raisedById];
    }
    if (normalized === 'defendant') {
      return [dispute.defendantId];
    }
    if (normalized === 'both') {
      return [dispute.raisedById, dispute.defendantId];
    }
    return [];
  }

  private scalePenaltyToTrustScore(penalty: number): number {
    return new Decimal(penalty)
      .dividedBy(100)
      .times(TRUST_SCORE_MAX)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  private async applyTrustScorePenalty(
    queryRunner: QueryRunner,
    userIds: string[],
    penalty: number,
    direction: 'apply' | 'revert',
  ): Promise<void> {
    if (userIds.length === 0 || penalty <= 0) {
      return;
    }

    const delta = this.scalePenaltyToTrustScore(penalty);
    const signedDelta = direction === 'apply' ? -delta : delta;

    for (const userId of userIds) {
      const user = await queryRunner.manager.findOne(UserEntity, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const updated = new Decimal(user.currentTrustScore)
        .plus(signedDelta)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      user.currentTrustScore = Math.max(0, Math.min(TRUST_SCORE_MAX, updated));
      await queryRunner.manager.save(UserEntity, user);
    }
  }

  private async applyBan(
    queryRunner: QueryRunner,
    userIds: string[],
    banDurationDays: number | undefined,
    adjudicatorId: string,
    reason?: string,
  ): Promise<void> {
    if (!banDurationDays || banDurationDays <= 0 || userIds.length === 0) {
      return;
    }

    for (const userId of userIds) {
      const user = await queryRunner.manager.findOne(UserEntity, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      user.isBanned = true;
      user.bannedAt = new Date();
      user.bannedBy = adjudicatorId;
      user.banReason = reason || 'Banned by verdict';
      await queryRunner.manager.save(UserEntity, user);
    }
  }

  async issueVerdict(
    dto: AdminVerdictDto,
    adjudicatorId: string,
    adjudicatorRole: UserRole,
    signatureContext?: LegalSignatureContext,
  ): Promise<{
    verdict: DisputeVerdictEntity;
    distribution: MoneyDistribution;
    transfers: TransactionEntity[];
  }> {
    if (!dto.disputeId) {
      throw new BadRequestException('disputeId is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispute = await queryRunner.manager.findOne(DisputeEntity, {
        where: { id: dto.disputeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!dispute) {
        throw new NotFoundException(`Dispute ${dto.disputeId} not found`);
      }

      if (!DisputeStateMachine.canTransition(dispute.status, DisputeStatus.RESOLVED)) {
        throw new BadRequestException(
          `Dispute is in "${dispute.status}" status and cannot issue verdict`,
        );
      }

      const existingVerdict = await queryRunner.manager.findOne(DisputeVerdictEntity, {
        where: { disputeId: dispute.id, isAppealVerdict: false },
      });
      if (existingVerdict) {
        throw new BadRequestException('Tier 1 verdict already exists for this dispute');
      }

      const escrow = await queryRunner.manager.findOne(EscrowEntity, {
        where: { milestoneId: dispute.milestoneId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!escrow) {
        throw new NotFoundException('Escrow not found');
      }

      const project = await queryRunner.manager.findOne(ProjectEntity, {
        where: { id: dispute.projectId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const reasoningResult = await this.validateVerdictReasoning(dispute.id, dto.reasoning);
      if (!reasoningResult.valid) {
        throw new BadRequestException({
          message: 'Invalid verdict reasoning',
          errors: reasoningResult.errors,
        });
      }

      const fundedAmount = this.getFundedAmount(escrow);
      const moneyResult = this.validateMoneyDistribution(
        dto.amountToFreelancer,
        dto.amountToClient,
        fundedAmount,
        escrow.platformFee,
      );
      if (!moneyResult.valid) {
        throw new BadRequestException(moneyResult.error);
      }

      const penalty = this.calculateTrustScorePenalty(dto.faultType, {
        overridePenalty: dto.trustScorePenalty,
      });

      const distribution = this.buildVerdictDistribution(
        dto.amountToFreelancer,
        dto.amountToClient,
        escrow,
        dispute,
        project,
        moneyResult.breakdown?.platformFee ?? escrow.platformFee,
      );

      const now = new Date();
      const appealDeadline = this.getAppealDeadline(now);
      const tier = adjudicatorRole === UserRole.ADMIN ? 2 : 1;

      const verdict = queryRunner.manager.create(DisputeVerdictEntity, {
        disputeId: dispute.id,
        adjudicatorId,
        adjudicatorRole,
        faultType: dto.faultType,
        faultyParty: dto.faultyParty,
        reasoning: dto.reasoning,
        amountToFreelancer: distribution.freelancerAmount,
        amountToClient: distribution.clientAmount,
        platformFee: distribution.platformFee,
        trustScorePenalty: penalty,
        isBanTriggered: dto.banUser || false,
        banDurationDays: dto.banDurationDays || 0,
        warningMessage: dto.warningMessage,
        tier,
        isAppealVerdict: false,
      });

      const savedVerdict = await queryRunner.manager.save(DisputeVerdictEntity, verdict);

      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.RESOLVED);
      dispute.result = dto.result;
      dispute.resolvedAt = now;
      dispute.resolvedById = adjudicatorId;
      dispute.appealDeadline = appealDeadline;
      dispute.currentTier = tier;
      dispute.isAppealed = false;
      if (dto.adminComment) {
        dispute.adminComment = dto.adminComment;
      } else if (!dispute.adminComment && dto.reasoning?.conclusion) {
        dispute.adminComment = dto.reasoning.conclusion;
      }

      await queryRunner.manager.save(DisputeEntity, dispute);

      const transfers = await this.queueTransfers(
        queryRunner,
        distribution,
        dispute,
        project,
        escrow,
        {
          disputeId: dispute.id,
          verdictId: savedVerdict.id,
          pendingVerdict: true,
          appealDeadline: appealDeadline.toISOString(),
        },
        true,
      );

      const penaltyTargets = this.resolvePenaltyTargets(dispute, dto.faultyParty);
      await this.applyTrustScorePenalty(queryRunner, penaltyTargets, penalty, 'apply');

      if (dto.banUser && dto.banDurationDays) {
        await this.applyBan(
          queryRunner,
          penaltyTargets,
          dto.banDurationDays,
          adjudicatorId,
          dto.warningMessage,
        );
      }

      await this.createLegalSignature(
        queryRunner,
        dispute,
        dispute.raisedById,
        dispute.raiserRole,
        LegalActionType.ACCEPT_VERDICT,
        'Verdict',
        savedVerdict.id,
        signatureContext,
      );

      await this.createLegalSignature(
        queryRunner,
        dispute,
        dispute.defendantId,
        dispute.defendantRole,
        LegalActionType.ACCEPT_VERDICT,
        'Verdict',
        savedVerdict.id,
        signatureContext,
      );

      if (dispute.assignedStaffId) {
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await this.staffAssignmentService.updateStaffPerformanceWithAppealExclusion(
          dispute.assignedStaffId,
          period,
        );
      }

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('verdict.issued', {
        disputeId: dispute.id,
        verdictId: savedVerdict.id,
        adjudicatorId,
        appealDeadline,
      });

      return {
        verdict: savedVerdict,
        distribution,
        transfers,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async appealVerdict(
    disputeId: string,
    appellantId: string,
    appealReason: string,
    signatureContext?: LegalSignatureContext,
  ): Promise<DisputeEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispute = await queryRunner.manager.findOne(DisputeEntity, {
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!dispute) {
        throw new NotFoundException(`Dispute ${disputeId} not found`);
      }

      if (dispute.status !== DisputeStatus.RESOLVED) {
        throw new BadRequestException('Dispute is not eligible for appeal');
      }

      if (dispute.currentTier && dispute.currentTier >= 2) {
        throw new BadRequestException('Dispute is already at final tier');
      }

      if (dispute.isAppealed) {
        throw new BadRequestException('Dispute has already been appealed');
      }

      if (dispute.raisedById !== appellantId && dispute.defendantId !== appellantId) {
        throw new ForbiddenException('Only dispute participants can appeal');
      }

      if (!appealReason || appealReason.trim().length < VERDICT_CONFIG.APPEAL_MIN_REASON_LENGTH) {
        throw new BadRequestException(
          `Appeal reason must be at least ${VERDICT_CONFIG.APPEAL_MIN_REASON_LENGTH} characters`,
        );
      }

      const now = new Date();
      if (dispute.appealDeadline && now > dispute.appealDeadline) {
        throw new BadRequestException('Appeal deadline has passed');
      }

      const verdict = await queryRunner.manager.findOne(DisputeVerdictEntity, {
        where: { disputeId: dispute.id, isAppealVerdict: false },
      });
      if (!verdict) {
        throw new BadRequestException('Tier 1 verdict not found');
      }

      await this.chargeAppealFee(queryRunner, appellantId, disputeId);

      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.APPEALED);
      dispute.currentTier = 2;
      dispute.escalatedAt = now;
      dispute.escalationReason = appealReason;
      dispute.appealReason = appealReason;
      dispute.appealedAt = now;
      dispute.isAppealed = true;

      if (!dispute.escalatedToAdminId) {
        const admin = await queryRunner.manager.findOne(UserEntity, {
          where: { role: UserRole.ADMIN, isBanned: false },
          order: { createdAt: 'ASC' },
        });
        if (admin) {
          dispute.escalatedToAdminId = admin.id;
        } else {
          this.logger.warn(`No admin available for appeal dispute ${dispute.id}`);
        }
      }

      await queryRunner.manager.save(DisputeEntity, dispute);

      await this.lockPendingVerdictTransactions(queryRunner, dispute.id);

      const appellantRole =
        dispute.raisedById === appellantId ? dispute.raiserRole : dispute.defendantRole;

      await this.createLegalSignature(
        queryRunner,
        dispute,
        appellantId,
        appellantRole,
        LegalActionType.APPEAL_SUBMISSION,
        'Verdict',
        verdict.id,
        signatureContext,
      );

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('verdict.appealed', {
        disputeId: dispute.id,
        verdictId: verdict.id,
        appellantId,
      });

      return dispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async finalizeAppealDeadline(
    disputeId: string,
  ): Promise<{ finalized: boolean; transferIds?: string[]; reason?: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispute = await queryRunner.manager.findOne(DisputeEntity, {
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!dispute) {
        throw new NotFoundException(`Dispute ${disputeId} not found`);
      }

      if (dispute.status !== DisputeStatus.RESOLVED) {
        return { finalized: false, reason: 'Dispute is not resolved' };
      }

      if (dispute.isAppealed || dispute.currentTier >= 2) {
        return { finalized: false, reason: 'Dispute is already under appeal' };
      }

      const now = new Date();
      if (dispute.appealDeadline && now < dispute.appealDeadline) {
        return { finalized: false, reason: 'Appeal deadline has not passed' };
      }

      const tier1Verdict = await queryRunner.manager.findOne(DisputeVerdictEntity, {
        where: { disputeId: dispute.id, isAppealVerdict: false },
        order: { issuedAt: 'DESC' },
      });

      if (!tier1Verdict) {
        throw new BadRequestException('Tier 1 verdict not found');
      }

      const escrow = await queryRunner.manager.findOne(EscrowEntity, {
        where: { milestoneId: dispute.milestoneId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!escrow) {
        throw new NotFoundException('Escrow not found');
      }

      const project = await queryRunner.manager.findOne(ProjectEntity, {
        where: { id: dispute.projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const milestone = await queryRunner.manager.findOne(MilestoneEntity, {
        where: { id: dispute.milestoneId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone not found');
      }

      const transferIds = await this.finalizePendingVerdictTransactions(queryRunner, dispute.id);

      escrow.disputeId = dispute.id;
      if (dispute.result === DisputeResult.WIN_CLIENT) {
        escrow.status = EscrowStatus.REFUNDED;
        escrow.refundedAt = now;
        if (transferIds.length > 0) {
          escrow.refundTransactionId = transferIds[0];
        }
      } else {
        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = now;
        if (transferIds.length > 0) {
          escrow.releaseTransactionIds = transferIds;
        }
      }

      await queryRunner.manager.save(EscrowEntity, escrow);

      const { newProjectStatus, newMilestoneStatus } = this.getProjectMilestoneStatus(
        dispute.result,
      );
      project.status = newProjectStatus;
      milestone.status = newMilestoneStatus;
      await queryRunner.manager.save([project, milestone]);

      await queryRunner.commitTransaction();

      return { finalized: true, transferIds };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async issueAppealVerdict(
    dto: AppealVerdictDto,
    adjudicatorId: string,
    adjudicatorRole: UserRole,
    signatureContext?: LegalSignatureContext,
  ): Promise<{
    verdict: DisputeVerdictEntity;
    distribution: MoneyDistribution;
  }> {
    if (!dto.disputeId) {
      throw new BadRequestException('disputeId is required');
    }

    if (adjudicatorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can issue appeal verdict');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispute = await queryRunner.manager.findOne(DisputeEntity, {
        where: { id: dto.disputeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!dispute) {
        throw new NotFoundException(`Dispute ${dto.disputeId} not found`);
      }

      if (dispute.status !== DisputeStatus.APPEALED) {
        throw new BadRequestException('Dispute is not in appeal status');
      }

      const tier1Verdict = await queryRunner.manager.findOne(DisputeVerdictEntity, {
        where: { id: dto.overridesVerdictId, disputeId: dispute.id },
      });
      if (!tier1Verdict) {
        throw new BadRequestException('Tier 1 verdict not found for override');
      }

      const escrow = await queryRunner.manager.findOne(EscrowEntity, {
        where: { milestoneId: dispute.milestoneId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!escrow) {
        throw new NotFoundException('Escrow not found');
      }

      const project = await queryRunner.manager.findOne(ProjectEntity, {
        where: { id: dispute.projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const milestone = await queryRunner.manager.findOne(MilestoneEntity, {
        where: { id: dispute.milestoneId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone not found');
      }

      const reasoningResult = await this.validateVerdictReasoning(dispute.id, dto.reasoning);
      if (!reasoningResult.valid) {
        throw new BadRequestException({
          message: 'Invalid verdict reasoning',
          errors: reasoningResult.errors,
        });
      }

      const fundedAmount = this.getFundedAmount(escrow);
      const moneyResult = this.validateMoneyDistribution(
        dto.amountToFreelancer,
        dto.amountToClient,
        fundedAmount,
        escrow.platformFee,
      );
      if (!moneyResult.valid) {
        throw new BadRequestException(moneyResult.error);
      }

      const penalty = this.calculateTrustScorePenalty(dto.faultType, {
        overridePenalty: dto.trustScorePenalty,
      });

      const distribution = this.buildVerdictDistribution(
        dto.amountToFreelancer,
        dto.amountToClient,
        escrow,
        dispute,
        project,
        moneyResult.breakdown?.platformFee ?? escrow.platformFee,
      );

      const previousClientAmount = new Decimal(tier1Verdict.amountToClient || 0)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      const previousFreelancerAmount = new Decimal(tier1Verdict.amountToFreelancer || 0)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      const resultChanged = dispute.result !== dto.result;
      const transferChanged =
        resultChanged ||
        previousClientAmount !== distribution.clientAmount ||
        previousFreelancerAmount !== distribution.freelancerAmount;
      const penaltyChanged =
        tier1Verdict.faultType !== dto.faultType ||
        tier1Verdict.faultyParty !== dto.faultyParty ||
        new Decimal(tier1Verdict.trustScorePenalty || 0).toNumber() !== penalty;

      let transferIds: string[] = [];

      if (transferChanged) {
        await this.cancelPendingVerdictTransactions(
          queryRunner,
          dispute.id,
          'Overturned by appeal verdict',
        );
      } else {
        transferIds = await this.finalizePendingVerdictTransactions(queryRunner, dispute.id);
      }

      const reasoningPayload = {
        ...dto.reasoning,
        overrideReason: dto.overrideReason,
      };

      const appealVerdict = queryRunner.manager.create(DisputeVerdictEntity, {
        disputeId: dispute.id,
        adjudicatorId,
        adjudicatorRole,
        faultType: dto.faultType,
        faultyParty: dto.faultyParty,
        reasoning: reasoningPayload,
        amountToFreelancer: distribution.freelancerAmount,
        amountToClient: distribution.clientAmount,
        platformFee: distribution.platformFee,
        trustScorePenalty: penalty,
        isBanTriggered: dto.banUser || false,
        banDurationDays: dto.banDurationDays || 0,
        warningMessage: dto.warningMessage,
        tier: 2,
        isAppealVerdict: true,
        overridesVerdictId: tier1Verdict.id,
      });

      const savedVerdict = await queryRunner.manager.save(DisputeVerdictEntity, appealVerdict);

      if (transferChanged) {
        const transfers = await this.queueTransfers(
          queryRunner,
          distribution,
          dispute,
          project,
          escrow,
          {
            disputeId: dispute.id,
            verdictId: savedVerdict.id,
            appealFinal: true,
          },
          false,
        );
        transferIds = transfers.map((transfer) => transfer.id);
      }

      if (penaltyChanged) {
        const previousPenaltyTargets = this.resolvePenaltyTargets(
          dispute,
          tier1Verdict.faultyParty,
        );
        await this.applyTrustScorePenalty(
          queryRunner,
          previousPenaltyTargets,
          tier1Verdict.trustScorePenalty,
          'revert',
        );

        const newPenaltyTargets = this.resolvePenaltyTargets(dispute, dto.faultyParty);
        await this.applyTrustScorePenalty(queryRunner, newPenaltyTargets, penalty, 'apply');
      }

      if (dto.banUser && dto.banDurationDays) {
        const newPenaltyTargets = this.resolvePenaltyTargets(dispute, dto.faultyParty);
        await this.applyBan(
          queryRunner,
          newPenaltyTargets,
          dto.banDurationDays,
          adjudicatorId,
          dto.warningMessage,
        );
      }

      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.RESOLVED);
      dispute.result = dto.result;
      dispute.resolvedById = adjudicatorId;
      dispute.appealResolvedById = adjudicatorId;
      dispute.appealResolvedAt = new Date();
      dispute.appealResolution = dto.overrideReason;
      dispute.currentTier = 2;
      dispute.isAppealed = true;

      await queryRunner.manager.save(DisputeEntity, dispute);

      escrow.disputeId = dispute.id;
      if (dto.result === DisputeResult.WIN_CLIENT) {
        escrow.status = EscrowStatus.REFUNDED;
        escrow.refundedAt = new Date();
        if (transferIds.length > 0) {
          escrow.refundTransactionId = transferIds[0];
        }
      } else {
        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = new Date();
        if (transferIds.length > 0) {
          escrow.releaseTransactionIds = transferIds;
        }
      }

      await queryRunner.manager.save(EscrowEntity, escrow);

      const { newProjectStatus, newMilestoneStatus } = this.getProjectMilestoneStatus(dto.result);
      project.status = newProjectStatus;
      milestone.status = newMilestoneStatus;
      await queryRunner.manager.save([project, milestone]);

      const appealSignature = await queryRunner.manager.findOne(LegalSignatureEntity, {
        where: {
          disputeId: dispute.id,
          actionType: LegalActionType.APPEAL_SUBMISSION,
        },
        order: { signedAt: 'DESC' },
      });

      if (appealSignature && resultChanged) {
        const { winnerId } = determineLoser(
          dto.result,
          dispute.raisedById,
          dispute.defendantId,
          dispute.disputeType,
        );

        if (winnerId && winnerId === appealSignature.signerId) {
          await this.refundAppealFee(queryRunner, appealSignature.signerId, dispute.id);
        }
      }

      await this.createLegalSignature(
        queryRunner,
        dispute,
        dispute.raisedById,
        dispute.raiserRole,
        LegalActionType.ACCEPT_VERDICT,
        'Verdict',
        savedVerdict.id,
        signatureContext,
      );

      await this.createLegalSignature(
        queryRunner,
        dispute,
        dispute.defendantId,
        dispute.defendantRole,
        LegalActionType.ACCEPT_VERDICT,
        'Verdict',
        savedVerdict.id,
        signatureContext,
      );

      if (dispute.assignedStaffId) {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await this.staffAssignmentService.updateStaffPerformanceWithAppealExclusion(
          dispute.assignedStaffId,
          period,
        );
      }

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('verdict.appealResolved', {
        disputeId: dispute.id,
        verdictId: savedVerdict.id,
        adjudicatorId,
      });

      return {
        verdict: savedVerdict,
        distribution,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
