import {
  BadRequestException,
  ConflictException,
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

    const releasePlan = this.toReleasePlan(milestoneId, escrow);
    const totalAmount = new Decimal(releasePlan.totalAmount).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const developerAmount = new Decimal(releasePlan.developerAmount).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const brokerAmount = new Decimal(releasePlan.brokerAmount).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const platformFee = new Decimal(releasePlan.platformFee).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );

    const distributedTotal = developerAmount.plus(brokerAmount).plus(platformFee);
    if (!distributedTotal.equals(totalAmount)) {
      throw new ConflictException(
        `Escrow ${escrow.id} distribution mismatch. Expected ${totalAmount.toFixed(2)}, received ${distributedTotal.toFixed(2)}.`,
      );
    }

    if (!project) {
      throw new NotFoundException(`Project ${escrow.projectId} not found`);
    }

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
      releasePlan.currency,
      manager,
    );
    const heldBalance = new Decimal(clientWallet.heldBalance || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    if (heldBalance.lessThan(totalAmount)) {
      throw new ConflictException(
        `Client wallet held balance is insufficient for release. Held ${heldBalance.toFixed(2)}, needed ${totalAmount.toFixed(2)}.`,
      );
    }

    const now = new Date();
    const transactionRepo = manager.getRepository(TransactionEntity);
    const recipients: MilestoneReleaseRecipientView[] = [];

    clientWallet.heldBalance = heldBalance.minus(totalAmount).toNumber();
    clientWallet.totalSpent = new Decimal(clientWallet.totalSpent || 0)
      .plus(totalAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    await manager.getRepository(WalletEntity).save(clientWallet);

    const clientSettlementTransaction = await transactionRepo.save(
      transactionRepo.create({
        walletId: clientWallet.id,
        amount: totalAmount.toNumber(),
        fee: 0,
        netAmount: totalAmount.toNumber(),
        currency: releasePlan.currency,
        type: TransactionType.ESCROW_RELEASE,
        status: TransactionStatus.COMPLETED,
        referenceType: 'Escrow',
        referenceId: escrow.id,
        description: `Escrow released for milestone "${milestone.title}"`,
        balanceAfter: clientWallet.balance,
        initiatedBy: 'system',
        completedAt: now,
        metadata: {
          milestoneId: milestone.id,
          projectId: project.id,
          approvedBy,
          stage: 'release_debit',
          role: 'CLIENT',
          developerAmount: developerAmount.toNumber(),
          brokerAmount: brokerAmount.toNumber(),
          platformFee: platformFee.toNumber(),
        },
      }),
    );

    recipients.push({
      userId: project.clientId,
      walletId: clientWallet.id,
      amount: totalAmount.toNumber(),
      role: 'CLIENT',
      transactionId: clientSettlementTransaction.id,
    });

    const relatedReleaseIds = [clientSettlementTransaction.id];

    if (developerAmount.greaterThan(0)) {
      const freelancerWallet = await this.walletService.getOrCreateWallet(
        project.freelancerId,
        releasePlan.currency,
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
          currency: releasePlan.currency,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: escrow.id,
          description: `Milestone payout for "${milestone.title}"`,
          balanceAfter: freelancerWallet.balance,
          initiatedBy: 'system',
          relatedTransactionId: clientSettlementTransaction.id,
          completedAt: now,
          metadata: {
            milestoneId: milestone.id,
            projectId: project.id,
            approvedBy,
            stage: 'release_credit',
            role: 'FREELANCER',
            sourceWalletId: clientWallet.id,
          },
        }),
      );

      relatedReleaseIds.push(freelancerTransaction.id);
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
        releasePlan.currency,
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
          currency: releasePlan.currency,
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: escrow.id,
          description: `Broker commission for milestone "${milestone.title}"`,
          balanceAfter: brokerWallet.balance,
          initiatedBy: 'system',
          relatedTransactionId: clientSettlementTransaction.id,
          completedAt: now,
          metadata: {
            milestoneId: milestone.id,
            projectId: project.id,
            approvedBy,
            stage: 'release_credit',
            role: 'BROKER',
            sourceWalletId: clientWallet.id,
          },
        }),
      );

      relatedReleaseIds.push(brokerTransaction.id);
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
        releasePlan.currency,
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
          currency: releasePlan.currency,
          type: TransactionType.FEE_DEDUCTION,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: escrow.id,
          description: `Platform fee for milestone "${milestone.title}"`,
          balanceAfter: platformWallet.balance,
          initiatedBy: 'system',
          relatedTransactionId: clientSettlementTransaction.id,
          completedAt: now,
          metadata: {
            milestoneId: milestone.id,
            projectId: project.id,
            approvedBy,
            stage: 'release_fee',
            role: 'PLATFORM',
            sourceWalletId: clientWallet.id,
            platformOwnerUserId: platformOwner.id,
          },
        }),
      );

      relatedReleaseIds.push(platformTransaction.id);
      recipients.push({
        userId: platformOwner.id,
        walletId: platformWallet.id,
        amount: platformFee.toNumber(),
        role: 'PLATFORM',
        transactionId: platformTransaction.id,
      });
    }

    clientSettlementTransaction.metadata = {
      ...(clientSettlementTransaction.metadata || {}),
      releaseTransactionIds: relatedReleaseIds,
    };
    await transactionRepo.save(clientSettlementTransaction);

    escrow.status = EscrowStatus.RELEASED;
    escrow.releasedAmount = totalAmount.toNumber();
    escrow.releasedAt = now;
    escrow.clientApproved = true;
    escrow.clientApprovedAt = now;
    escrow.clientWalletId = clientWallet.id;
    escrow.releaseTransactionIds = relatedReleaseIds;
    await manager.getRepository(EscrowEntity).save(escrow);

    return {
      milestoneId: milestone.id,
      escrowId: escrow.id,
      escrowStatus: escrow.status,
      releasedAmount: totalAmount.toNumber(),
      clientWalletSnapshot: this.walletService.toWalletSnapshot(clientWallet),
      releaseTransactionIds: relatedReleaseIds,
      recipients,
    };
  }

  private async refundWithinManager(
    project: ProjectEntity,
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
    cancelledBy: string,
    manager: EntityManager,
  ): Promise<EscrowRefundResult> {
    if (escrow.projectId !== project.id) {
      throw new ConflictException(
        `Escrow ${escrow.id} does not belong to project ${project.id}`,
      );
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

    const refundAmount = new Decimal(escrow.fundedAmount || escrow.totalAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
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
        description: providerRefund.refundMode === 'PAYPAL_CAPTURE_REFUND'
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
      holdTransaction?.metadata
      && typeof holdTransaction.metadata === 'object'
      && typeof holdTransaction.metadata.gateway === 'string'
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
