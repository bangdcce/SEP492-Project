import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  EscrowEntity,
  EscrowStatus,
  FundingGateway,
  MilestoneEntity,
  MilestoneStatus,
  ProjectEntity,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  UserRole,
  UserStatus,
  WalletEntity,
} from '../../database/entities';
import {
  EscrowRefundResult,
  EscrowRefundMode,
  MilestoneReleaseRecipientView,
  MilestoneReleaseResult,
} from './payments.types';
import { PayPalCheckoutService } from './pay-pal-checkout.service';
import { WalletService } from './wallet.service';

export interface EscrowFullReleasePlan {
  milestoneId: string;
  escrowId: string;
  totalAmount: number;
  developerAmount: number;
  brokerAmount: number;
  platformFee: number;
  currency: string;
}

export interface RetentionReleaseOptions {
  releasedByRole?: UserRole;
  bypassWarranty?: boolean;
  skipAuthorization?: boolean;
  initiatedBy?: 'system' | 'user';
  reason?: string;
}

export interface DueRetentionReleaseResult {
  scanned: number;
  released: number;
  failed: number;
  failures: Array<{ milestoneId: string; reason: string }>;
}

const DEFAULT_RETENTION_WARRANTY_DAYS = 30;

@Injectable()
export class EscrowReleaseService {
  constructor(
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly payPalCheckoutService: PayPalCheckoutService,
  ) {}

  async buildFullReleasePlanForMilestone(
    milestoneId: string,
    manager?: EntityManager,
  ): Promise<EscrowFullReleasePlan> {
    const { milestone, escrow } = await this.loadReleaseContext(milestoneId, manager, false);
    this.assertCanFullyRelease(milestone, escrow);
    return this.toReleasePlan(milestoneId, escrow);
  }

  async releaseForApprovedMilestone(
    milestoneId: string,
    approvedBy: string,
    manager?: EntityManager,
  ): Promise<MilestoneReleaseResult> {
    if (manager) {
      return this.releaseWithinManager(milestoneId, approvedBy, manager);
    }

    return this.dataSource.transaction((transactionManager) =>
      this.releaseWithinManager(milestoneId, approvedBy, transactionManager),
    );
  }

  async releaseRetentionForMilestone(
    milestoneId: string,
    releasedBy: string,
    options?: RetentionReleaseOptions,
    manager?: EntityManager,
  ): Promise<MilestoneReleaseResult> {
    if (manager) {
      return this.releaseRetentionWithinManager(milestoneId, releasedBy, manager, options);
    }

    return this.dataSource.transaction((transactionManager) =>
      this.releaseRetentionWithinManager(milestoneId, releasedBy, transactionManager, options),
    );
  }

  async releaseDueRetentions(now = new Date()): Promise<DueRetentionReleaseResult> {
    const deadline = new Date(
      now.getTime() - DEFAULT_RETENTION_WARRANTY_DAYS * 24 * 60 * 60 * 1000,
    );

    const rows = await this.escrowRepository
      .createQueryBuilder('escrow')
      .innerJoin(MilestoneEntity, 'milestone', 'milestone.id = escrow.milestoneId')
      .select('escrow.milestoneId', 'milestoneId')
      .where('escrow.status = :status', { status: EscrowStatus.FUNDED })
      .andWhere('COALESCE(escrow.fundedAmount, 0) > 0')
      .andWhere('COALESCE(escrow.releasedAmount, 0) > 0')
      .andWhere('escrow.disputeId IS NULL')
      .andWhere('milestone.status = :milestoneStatus', {
        milestoneStatus: MilestoneStatus.PAID,
      })
      .andWhere(
        'COALESCE(escrow.releasedAt, milestone.dueDate, milestone.createdAt) <= :deadline',
        {
          deadline,
        },
      )
      .getRawMany<{ milestoneId: string }>();

    const uniqueMilestoneIds = Array.from(
      new Set(rows.map((row) => row.milestoneId).filter(Boolean)),
    );

    const failures: Array<{ milestoneId: string; reason: string }> = [];
    let released = 0;

    for (const milestoneId of uniqueMilestoneIds) {
      try {
        await this.releaseRetentionForMilestone(milestoneId, 'system', {
          skipAuthorization: true,
          bypassWarranty: true,
          initiatedBy: 'system',
          reason: 'auto_warranty_release',
        });
        released += 1;
      } catch (error) {
        failures.push({
          milestoneId,
          reason: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }

    return {
      scanned: uniqueMilestoneIds.length,
      released,
      failed: failures.length,
      failures,
    };
  }

  async refundCancelledEscrow(
    project: ProjectEntity,
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
    cancelledBy: string,
    manager?: EntityManager,
  ): Promise<EscrowRefundResult> {
    if (manager) {
      return this.refundWithinManager(project, milestone, escrow, cancelledBy, manager);
    }

    return this.dataSource.transaction((transactionManager) =>
      this.refundWithinManager(project, milestone, escrow, cancelledBy, transactionManager),
    );
  }

  private async releaseWithinManager(
    milestoneId: string,
    approvedBy: string,
    manager: EntityManager,
  ): Promise<MilestoneReleaseResult> {
    const { milestone, escrow, project } = await this.loadReleaseContext(
      milestoneId,
      manager,
      true,
    );
    this.assertCanFullyRelease(milestone, escrow);

    const fundedAmount = new Decimal(escrow.fundedAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const retentionAmount = new Decimal(milestone.retentionAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const retentionToHold = Decimal.min(retentionAmount, fundedAmount);
    const payableNow = fundedAmount
      .minus(retentionToHold)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    if (payableNow.lessThanOrEqualTo(0)) {
      throw new ConflictException(
        `Milestone ${milestone.id} has no payable amount after retention hold.`,
      );
    }

    return this.releaseEscrowAmountWithinManager({
      manager,
      milestone,
      escrow,
      project,
      releasedBy: approvedBy,
      releaseAmount: payableNow,
      stage: retentionToHold.greaterThan(0) ? 'release_payable_now' : 'release_full',
      initiatedBy: 'user',
      reason: retentionToHold.greaterThan(0)
        ? `retention_held:${retentionToHold.toFixed(2)}`
        : 'full_release_no_retention',
    });
  }

  private async releaseRetentionWithinManager(
    milestoneId: string,
    releasedBy: string,
    manager: EntityManager,
    options?: RetentionReleaseOptions,
  ): Promise<MilestoneReleaseResult> {
    const { milestone, escrow, project } = await this.loadReleaseContext(
      milestoneId,
      manager,
      true,
    );

    this.assertCanReleaseRetention(milestone, escrow);

    if (!project) {
      throw new NotFoundException(`Project ${escrow.projectId} not found`);
    }

    if (!options?.skipAuthorization) {
      await this.assertRetentionReleaseAuthorization(
        project,
        releasedBy,
        options?.releasedByRole,
        manager,
      );
    }

    if (!options?.bypassWarranty) {
      this.assertWarrantyWindowElapsed(escrow, milestone, new Date());
    }

    const retentionAmount = new Decimal(escrow.fundedAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );

    if (retentionAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        `Milestone ${milestone.id} has no retention balance available for release.`,
      );
    }

    return this.releaseEscrowAmountWithinManager({
      manager,
      milestone,
      escrow,
      project,
      releasedBy,
      releaseAmount: retentionAmount,
      stage: 'release_retention',
      initiatedBy: options?.initiatedBy ?? 'user',
      reason: options?.reason,
    });
  }

  private async releaseEscrowAmountWithinManager(input: {
    manager: EntityManager;
    milestone: MilestoneEntity;
    escrow: EscrowEntity;
    project: ProjectEntity | null;
    releasedBy: string;
    releaseAmount: Decimal;
    stage: 'release_full' | 'release_payable_now' | 'release_retention';
    initiatedBy: 'system' | 'user';
    reason?: string;
  }): Promise<MilestoneReleaseResult> {
    const {
      manager,
      milestone,
      escrow,
      project,
      releasedBy,
      releaseAmount,
      stage,
      initiatedBy,
      reason,
    } = input;

    if (!project) {
      throw new NotFoundException(`Project ${escrow.projectId} not found`);
    }

    const currency = escrow.currency || project.currency || 'USD';
    const releaseValue = releaseAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const fundedBalance = new Decimal(escrow.fundedAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );

    if (releaseValue.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Release amount must be greater than 0');
    }

    if (fundedBalance.lessThan(releaseValue)) {
      throw new ConflictException(
        `Escrow ${escrow.id} has insufficient funded balance. Available ${fundedBalance.toFixed(2)}, requested ${releaseValue.toFixed(2)}.`,
      );
    }

    const { developerAmount, brokerAmount, platformFee } = this.allocateSharesForReleaseAmount(
      escrow,
      releaseValue,
    );

    if (developerAmount.greaterThan(0) && !project.freelancerId) {
      throw new ConflictException(
        'Cannot release developer share because project has no freelancer',
      );
    }

    if (brokerAmount.greaterThan(0) && !project.brokerId) {
      throw new ConflictException('Cannot release broker share because project has no broker');
    }

    const clientWallet = await this.walletService.getOrCreateWallet(
      project.clientId,
      currency,
      manager,
    );
    const heldBalance = new Decimal(clientWallet.heldBalance || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    if (heldBalance.lessThan(releaseValue)) {
      throw new ConflictException(
        `Client wallet held balance is insufficient for release. Held ${heldBalance.toFixed(2)}, needed ${releaseValue.toFixed(2)}.`,
      );
    }

    const now = new Date();
    const transactionRepo = manager.getRepository(TransactionEntity);
    const recipients: MilestoneReleaseRecipientView[] = [];

    clientWallet.heldBalance = heldBalance.minus(releaseValue).toNumber();
    clientWallet.totalSpent = new Decimal(clientWallet.totalSpent || 0)
      .plus(releaseValue)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    await manager.getRepository(WalletEntity).save(clientWallet);

    const clientSettlementTransaction = await transactionRepo.save(
      transactionRepo.create({
        walletId: clientWallet.id,
        amount: releaseValue.toNumber(),
        fee: 0,
        netAmount: releaseValue.toNumber(),
        currency,
        type: TransactionType.ESCROW_RELEASE,
        status: TransactionStatus.COMPLETED,
        referenceType: 'Escrow',
        referenceId: escrow.id,
        description: `Escrow released for milestone "${milestone.title}"`,
        balanceAfter: clientWallet.balance,
        initiatedBy,
        completedAt: now,
        metadata: {
          milestoneId: milestone.id,
          projectId: project.id,
          releasedBy,
          stage,
          reason: reason ?? null,
          role: 'CLIENT',
          releaseAmount: releaseValue.toNumber(),
          developerAmount: developerAmount.toNumber(),
          brokerAmount: brokerAmount.toNumber(),
          platformFee: platformFee.toNumber(),
          retainedBalanceAfterRelease: new Decimal(escrow.fundedAmount || 0)
            .minus(releaseValue)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toNumber(),
        },
      }),
    );

    recipients.push({
      userId: project.clientId,
      walletId: clientWallet.id,
      amount: releaseValue.toNumber(),
      role: 'CLIENT',
      transactionId: clientSettlementTransaction.id,
    });

    const newReleaseIds = [clientSettlementTransaction.id];

    if (developerAmount.greaterThan(0)) {
      const freelancerWallet = await this.walletService.getOrCreateWallet(
        project.freelancerId,
        currency,
        manager,
      );
      freelancerWallet.balance = new Decimal(freelancerWallet.balance || 0)
        .plus(developerAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      freelancerWallet.totalEarned = new Decimal(freelancerWallet.totalEarned || 0)
        .plus(developerAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      await manager.getRepository(WalletEntity).save(freelancerWallet);

      const freelancerTransaction = await transactionRepo.save(
        transactionRepo.create({
          walletId: freelancerWallet.id,
          amount: developerAmount.toNumber(),
          fee: 0,
          netAmount: developerAmount.toNumber(),
          currency,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: escrow.id,
          description:
            stage === 'release_retention'
              ? `Retention released for milestone "${milestone.title}"`
              : `Milestone payout for "${milestone.title}"`,
          balanceAfter: freelancerWallet.balance,
          initiatedBy,
          relatedTransactionId: clientSettlementTransaction.id,
          completedAt: now,
          metadata: {
            milestoneId: milestone.id,
            projectId: project.id,
            releasedBy,
            stage,
            role: 'FREELANCER',
            sourceWalletId: clientWallet.id,
          },
        }),
      );

      newReleaseIds.push(freelancerTransaction.id);
      recipients.push({
        userId: project.freelancerId,
        walletId: freelancerWallet.id,
        amount: developerAmount.toNumber(),
        role: 'FREELANCER',
        transactionId: freelancerTransaction.id,
      });

      escrow.developerWalletId = freelancerWallet.id;
    }

    if (brokerAmount.greaterThan(0)) {
      const brokerWallet = await this.walletService.getOrCreateWallet(
        project.brokerId,
        currency,
        manager,
      );
      brokerWallet.balance = new Decimal(brokerWallet.balance || 0)
        .plus(brokerAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      brokerWallet.totalEarned = new Decimal(brokerWallet.totalEarned || 0)
        .plus(brokerAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      await manager.getRepository(WalletEntity).save(brokerWallet);

      const brokerTransaction = await transactionRepo.save(
        transactionRepo.create({
          walletId: brokerWallet.id,
          amount: brokerAmount.toNumber(),
          fee: 0,
          netAmount: brokerAmount.toNumber(),
          currency,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: escrow.id,
          description: `Broker commission for milestone "${milestone.title}"`,
          balanceAfter: brokerWallet.balance,
          initiatedBy,
          relatedTransactionId: clientSettlementTransaction.id,
          completedAt: now,
          metadata: {
            milestoneId: milestone.id,
            projectId: project.id,
            releasedBy,
            stage,
            role: 'BROKER',
            sourceWalletId: clientWallet.id,
          },
        }),
      );

      newReleaseIds.push(brokerTransaction.id);
      recipients.push({
        userId: project.brokerId,
        walletId: brokerWallet.id,
        amount: brokerAmount.toNumber(),
        role: 'BROKER',
        transactionId: brokerTransaction.id,
      });

      escrow.brokerWalletId = brokerWallet.id;
    }

    if (platformFee.greaterThan(0)) {
      const platformOwner = await this.resolvePlatformWalletOwner(manager);
      const platformWallet = await this.walletService.getOrCreateWallet(
        platformOwner.id,
        currency,
        manager,
      );
      platformWallet.balance = new Decimal(platformWallet.balance || 0)
        .plus(platformFee)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      platformWallet.totalEarned = new Decimal(platformWallet.totalEarned || 0)
        .plus(platformFee)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      await manager.getRepository(WalletEntity).save(platformWallet);

      const platformTransaction = await transactionRepo.save(
        transactionRepo.create({
          walletId: platformWallet.id,
          amount: platformFee.toNumber(),
          fee: 0,
          netAmount: platformFee.toNumber(),
          currency,
          type: TransactionType.FEE_DEDUCTION,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: escrow.id,
          description: `Platform fee for milestone "${milestone.title}"`,
          balanceAfter: platformWallet.balance,
          initiatedBy,
          relatedTransactionId: clientSettlementTransaction.id,
          completedAt: now,
          metadata: {
            milestoneId: milestone.id,
            projectId: project.id,
            releasedBy,
            stage,
            role: 'PLATFORM',
            sourceWalletId: clientWallet.id,
            platformOwnerUserId: platformOwner.id,
          },
        }),
      );

      newReleaseIds.push(platformTransaction.id);
      recipients.push({
        userId: platformOwner.id,
        walletId: platformWallet.id,
        amount: platformFee.toNumber(),
        role: 'PLATFORM',
        transactionId: platformTransaction.id,
      });
    }

    const existingReleaseIds = Array.isArray(escrow.releaseTransactionIds)
      ? escrow.releaseTransactionIds
      : [];
    const releaseTransactionIds = [...existingReleaseIds, ...newReleaseIds];

    clientSettlementTransaction.metadata = {
      ...(clientSettlementTransaction.metadata || {}),
      releaseTransactionIds,
    };
    await transactionRepo.save(clientSettlementTransaction);

    const previousReleasedAmount = new Decimal(escrow.releasedAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const remainingFundedAmount = fundedBalance
      .minus(releaseValue)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    escrow.fundedAmount = remainingFundedAmount.toNumber();
    escrow.releasedAmount = previousReleasedAmount.plus(releaseValue).toNumber();
    escrow.status = remainingFundedAmount.greaterThan(0)
      ? EscrowStatus.FUNDED
      : EscrowStatus.RELEASED;
    escrow.releasedAt = escrow.releasedAt || now;
    escrow.clientApproved = true;
    escrow.clientApprovedAt = escrow.clientApprovedAt || now;
    escrow.clientWalletId = clientWallet.id;
    escrow.releaseTransactionIds = releaseTransactionIds;
    await manager.getRepository(EscrowEntity).save(escrow);

    return {
      milestoneId: milestone.id,
      escrowId: escrow.id,
      escrowStatus: escrow.status,
      releasedAmount: releaseValue.toNumber(),
      clientWalletSnapshot: this.walletService.toWalletSnapshot(clientWallet),
      releaseTransactionIds,
      recipients,
    };
  }

  private allocateSharesForReleaseAmount(
    escrow: EscrowEntity,
    releaseAmount: Decimal,
  ): {
    developerAmount: Decimal;
    brokerAmount: Decimal;
    platformFee: Decimal;
  } {
    const totalEscrowAmount = new Decimal(escrow.totalAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    if (totalEscrowAmount.lessThanOrEqualTo(0)) {
      throw new ConflictException(`Escrow ${escrow.id} has invalid totalAmount`);
    }

    const developerShare = new Decimal(escrow.developerShare || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const brokerShare = new Decimal(escrow.brokerShare || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );

    let developerAmount = releaseAmount
      .times(developerShare)
      .div(totalEscrowAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    let brokerAmount = releaseAmount
      .times(brokerShare)
      .div(totalEscrowAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    let platformFee = releaseAmount
      .minus(developerAmount)
      .minus(brokerAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    if (platformFee.lessThan(0)) {
      const deficit = platformFee.abs();
      if (brokerAmount.greaterThanOrEqualTo(deficit)) {
        brokerAmount = brokerAmount.minus(deficit).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      } else {
        const remainingDeficit = deficit.minus(brokerAmount);
        brokerAmount = new Decimal(0);
        developerAmount = Decimal.max(
          new Decimal(0),
          developerAmount.minus(remainingDeficit),
        ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
      platformFee = new Decimal(0);
    }

    const distributedTotal = developerAmount.plus(brokerAmount).plus(platformFee);
    if (!distributedTotal.equals(releaseAmount)) {
      const delta = releaseAmount.minus(distributedTotal);
      platformFee = platformFee.plus(delta).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    if (developerAmount.lessThan(0) || brokerAmount.lessThan(0) || platformFee.lessThan(0)) {
      throw new ConflictException(
        `Escrow ${escrow.id} produced an invalid payout distribution for ${releaseAmount.toFixed(2)}.`,
      );
    }

    return {
      developerAmount,
      brokerAmount,
      platformFee,
    };
  }

  private async assertRetentionReleaseAuthorization(
    project: ProjectEntity,
    releasedBy: string,
    releasedByRole?: UserRole,
    manager?: EntityManager,
  ): Promise<void> {
    if (!releasedBy?.trim()) {
      throw new ForbiddenException('Retention release actor is required');
    }

    if (releasedBy === project.clientId || releasedBy === project.brokerId) {
      return;
    }

    if (releasedByRole === UserRole.ADMIN || releasedByRole === UserRole.STAFF) {
      return;
    }

    const userRepo = manager?.getRepository(UserEntity) ?? this.userRepository;
    const actor = await userRepo.findOne({ where: { id: releasedBy } });
    if (actor && [UserRole.ADMIN, UserRole.STAFF].includes(actor.role as UserRole)) {
      return;
    }

    throw new ForbiddenException(
      'Only client, assigned broker, admin, or staff can release retention funds',
    );
  }

  private assertCanReleaseRetention(milestone: MilestoneEntity, escrow: EscrowEntity): void {
    if (milestone.status !== MilestoneStatus.PAID) {
      throw new BadRequestException(
        `Milestone ${milestone.id} must be PAID before releasing retention`,
      );
    }

    if (escrow.status === EscrowStatus.DISPUTED) {
      throw new BadRequestException('Cannot release retention while escrow is disputed');
    }

    if (escrow.status === EscrowStatus.REFUNDED) {
      throw new BadRequestException('Cannot release retention for refunded escrow');
    }

    if (escrow.status === EscrowStatus.RELEASED) {
      throw new BadRequestException('Retention has already been released for this milestone');
    }

    const fundedAmount = new Decimal(escrow.fundedAmount || 0).toDecimalPlaces(2);
    if (fundedAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('No retention balance remains in escrow');
    }
  }

  private assertWarrantyWindowElapsed(
    escrow: EscrowEntity,
    milestone: MilestoneEntity,
    now: Date,
  ): void {
    const anchor = escrow.releasedAt || milestone.dueDate || milestone.createdAt;
    if (!anchor) {
      throw new BadRequestException('Cannot determine warranty anchor time for retention release');
    }

    const dueAt = new Date(anchor);
    dueAt.setDate(dueAt.getDate() + DEFAULT_RETENTION_WARRANTY_DAYS);

    if (now < dueAt) {
      throw new BadRequestException(
        `Retention warranty window is still active until ${dueAt.toISOString()}`,
      );
    }
  }

  private async refundWithinManager(
    project: ProjectEntity,
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
    cancelledBy: string,
    manager: EntityManager,
  ): Promise<EscrowRefundResult> {
    if (escrow.projectId !== project.id) {
      throw new ConflictException(`Escrow ${escrow.id} does not belong to project ${project.id}`);
    }

    if (escrow.milestoneId !== milestone.id) {
      throw new ConflictException(
        `Escrow ${escrow.id} does not belong to milestone ${milestone.id}`,
      );
    }

    if (escrow.status === EscrowStatus.RELEASED || escrow.status === EscrowStatus.REFUNDED) {
      throw new BadRequestException(`Escrow ${escrow.id} is already ${escrow.status}`);
    }

    if (escrow.status === EscrowStatus.DISPUTED) {
      throw new BadRequestException('Disputed escrow cannot be refunded');
    }

    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new BadRequestException(`Escrow ${escrow.id} must be FUNDED before refund`);
    }

    const refundAmount = new Decimal(
      escrow.fundedAmount || escrow.totalAmount || 0,
    ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (refundAmount.lessThanOrEqualTo(0)) {
      throw new ConflictException(`Escrow ${escrow.id} has no refundable balance`);
    }

    const currency = escrow.currency || project.currency || 'USD';
    const clientWallet = await this.walletService.getOrCreateWallet(
      project.clientId,
      currency,
      manager,
    );
    const heldBalance = new Decimal(clientWallet.heldBalance || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    if (heldBalance.lessThan(refundAmount)) {
      throw new ConflictException(
        `Client wallet held balance is insufficient for refund. Held ${heldBalance.toFixed(2)}, needed ${refundAmount.toFixed(2)}.`,
      );
    }

    const providerRefund = await this.resolveRefundExecution(
      project,
      milestone,
      escrow,
      refundAmount.toNumber(),
      currency,
      manager,
    );
    const now = new Date();
    if (providerRefund.creditedToInternalWallet) {
      clientWallet.balance = new Decimal(clientWallet.balance || 0)
        .plus(refundAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
    }
    clientWallet.heldBalance = heldBalance
      .minus(refundAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    await manager.getRepository(WalletEntity).save(clientWallet);

    const transactionRepo = manager.getRepository(TransactionEntity);
    const refundTransaction = await transactionRepo.save(
      transactionRepo.create({
        walletId: clientWallet.id,
        amount: refundAmount.toNumber(),
        fee: 0,
        netAmount: providerRefund.creditedToInternalWallet ? refundAmount.toNumber() : 0,
        currency,
        type: TransactionType.REFUND,
        status: TransactionStatus.COMPLETED,
        referenceType: 'Escrow',
        referenceId: escrow.id,
        paymentMethod: providerRefund.paymentMethod,
        externalTransactionId: providerRefund.externalRefundReference,
        description:
          providerRefund.refundMode === 'PAYPAL_CAPTURE_REFUND'
            ? `PayPal refund for canceled project milestone "${milestone.title}"`
            : `Escrow refund for canceled project milestone "${milestone.title}"`,
        balanceAfter: clientWallet.balance,
        initiatedBy: 'system',
        relatedTransactionId: escrow.holdTransactionId || null,
        completedAt: now,
        metadata: {
          milestoneId: milestone.id,
          projectId: project.id,
          cancelledBy,
          stage: 'refund',
          sourceWalletId: clientWallet.id,
          holdTransactionId: escrow.holdTransactionId || null,
          refundMode: providerRefund.refundMode,
          creditedToInternalWallet: providerRefund.creditedToInternalWallet,
          externalRefundReference: providerRefund.externalRefundReference,
          providerCaptureId: providerRefund.providerCaptureId,
          providerStatus: providerRefund.providerStatus,
        },
      }),
    );

    escrow.status = EscrowStatus.REFUNDED;
    escrow.fundedAmount = refundAmount.toNumber();
    escrow.releasedAmount = 0;
    escrow.clientApproved = false;
    escrow.clientApprovedAt = null;
    escrow.refundedAt = now;
    escrow.refundTransactionId = refundTransaction.id;
    escrow.clientWalletId = clientWallet.id;
    await manager.getRepository(EscrowEntity).save(escrow);

    return {
      milestoneId: milestone.id,
      escrowId: escrow.id,
      escrowStatus: escrow.status,
      refundedAmount: refundAmount.toNumber(),
      refundMode: providerRefund.refundMode,
      externalRefundReference: providerRefund.externalRefundReference,
      creditedToInternalWallet: providerRefund.creditedToInternalWallet,
      clientWalletSnapshot: this.walletService.toWalletSnapshot(clientWallet),
      refundTransactionId: refundTransaction.id,
    };
  }

  private async resolveRefundExecution(
    project: ProjectEntity,
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
    refundAmount: number,
    currency: string,
    manager: EntityManager,
  ): Promise<{
    refundMode: EscrowRefundMode;
    externalRefundReference: string | null;
    creditedToInternalWallet: boolean;
    paymentMethod: string | null;
    providerCaptureId: string | null;
    providerStatus: string | null;
  }> {
    if (!escrow.holdTransactionId) {
      return {
        refundMode: 'INTERNAL_LEDGER',
        externalRefundReference: null,
        creditedToInternalWallet: true,
        paymentMethod: null,
        providerCaptureId: null,
        providerStatus: null,
      };
    }

    const holdTransaction = await manager.getRepository(TransactionEntity).findOne({
      where: { id: escrow.holdTransactionId },
    });
    const gateway =
      holdTransaction?.metadata &&
      typeof holdTransaction.metadata === 'object' &&
      typeof holdTransaction.metadata.gateway === 'string'
        ? holdTransaction.metadata.gateway
        : null;
    const providerCaptureId = holdTransaction?.externalTransactionId?.trim() || null;

    if (gateway !== FundingGateway.PAYPAL || !providerCaptureId) {
      return {
        refundMode: 'INTERNAL_LEDGER',
        externalRefundReference: null,
        creditedToInternalWallet: true,
        paymentMethod: holdTransaction?.paymentMethod || null,
        providerCaptureId,
        providerStatus: null,
      };
    }

    const providerRefund = await this.payPalCheckoutService.refundCapture({
      captureId: providerCaptureId,
      currency,
      amount: refundAmount,
      requestId: `escrow-${escrow.id}-cancel-refund`,
    });

    return {
      refundMode: 'PAYPAL_CAPTURE_REFUND',
      externalRefundReference: providerRefund.refundId,
      creditedToInternalWallet: false,
      paymentMethod: holdTransaction?.paymentMethod || 'PAYPAL_ACCOUNT',
      providerCaptureId,
      providerStatus: providerRefund.status,
    };
  }

  private async resolvePlatformWalletOwner(manager?: EntityManager): Promise<UserEntity> {
    const userRepo = manager?.getRepository(UserEntity) ?? this.userRepository;
    const platformOwner = await userRepo.findOne({
      where: [
        { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        { role: UserRole.STAFF, status: UserStatus.ACTIVE },
      ],
      order: { createdAt: 'ASC' },
    });

    if (!platformOwner) {
      throw new ConflictException(
        'Cannot release platform fee because no active ADMIN/STAFF platform owner is available',
      );
    }

    return platformOwner;
  }

  private async loadReleaseContext(
    milestoneId: string,
    manager?: EntityManager,
    lockRows = false,
  ): Promise<{
    milestone: MilestoneEntity;
    escrow: EscrowEntity;
    project: ProjectEntity | null;
  }> {
    const milestoneRepo = manager?.getRepository(MilestoneEntity) ?? this.milestoneRepository;
    const escrowRepo = manager?.getRepository(EscrowEntity) ?? this.escrowRepository;
    const projectRepo = manager?.getRepository(ProjectEntity) ?? this.projectRepository;

    const milestoneQuery = milestoneRepo
      .createQueryBuilder('milestone')
      .where('milestone.id = :id', {
        id: milestoneId,
      });
    if (lockRows && manager) {
      milestoneQuery.setLock('pessimistic_write');
    }
    const milestone = await milestoneQuery.getOne();
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    const escrowQuery = escrowRepo
      .createQueryBuilder('escrow')
      .where('escrow.milestoneId = :milestoneId', { milestoneId });
    if (lockRows && manager) {
      escrowQuery.setLock('pessimistic_write');
    }
    const escrow = await escrowQuery.getOne();
    if (!escrow) {
      throw new NotFoundException(`Escrow for milestone ${milestoneId} not found`);
    }

    const project =
      milestone.projectId || escrow.projectId
        ? await projectRepo.findOne({
            where: { id: milestone.projectId || escrow.projectId },
          })
        : null;

    return { milestone, escrow, project };
  }

  private toReleasePlan(milestoneId: string, escrow: EscrowEntity): EscrowFullReleasePlan {
    return {
      milestoneId,
      escrowId: escrow.id,
      totalAmount: Number(escrow.fundedAmount || escrow.totalAmount || 0),
      developerAmount: Number(escrow.developerShare || 0),
      brokerAmount: Number(escrow.brokerShare || 0),
      platformFee: Number(escrow.platformFee || 0),
      currency: escrow.currency,
    };
  }

  private assertCanFullyRelease(milestone: MilestoneEntity, escrow: EscrowEntity): void {
    if (milestone.status !== MilestoneStatus.COMPLETED) {
      throw new BadRequestException(
        `Milestone ${milestone.id} must be COMPLETED before funds can be released`,
      );
    }

    if (escrow.status === EscrowStatus.DISPUTED) {
      throw new BadRequestException('Disputed escrow cannot be released');
    }

    if (escrow.status === EscrowStatus.RELEASED || escrow.status === EscrowStatus.REFUNDED) {
      throw new BadRequestException(`Escrow ${escrow.id} is already ${escrow.status}`);
    }

    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new BadRequestException(`Escrow ${escrow.id} must be FUNDED before release`);
    }

    const fundedAmount = new Decimal(escrow.fundedAmount || 0).toDecimalPlaces(2);
    const totalAmount = new Decimal(escrow.totalAmount || 0).toDecimalPlaces(2);
    if (!fundedAmount.equals(totalAmount)) {
      throw new BadRequestException('Only fully funded escrows can be released in V1');
    }
  }
}
