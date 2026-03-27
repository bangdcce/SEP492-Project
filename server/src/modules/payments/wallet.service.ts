import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Between, EntityManager, Repository } from 'typeorm';
import {
  EscrowEntity,
  EscrowStatus,
  ProjectEntity,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  WalletEntity,
} from '../../database/entities';
import { UserRole, UserStatus } from '../../database/entities/user.entity';
import {
  PlatformWalletOwnerView,
  PlatformWalletSnapshotResult,
  PlatformWalletTransactionsResult,
  WalletSnapshot,
  WalletTransactionItem,
  WalletTransactionsResult,
} from './payments.types';
import { PayPalPayoutsGateway } from './pay-pal-payouts.gateway';
import { WalletTransactionRange } from './dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly payPalPayoutsGateway: PayPalPayoutsGateway,
  ) {}

  async getOrCreateWallet(
    userId: string,
    currency = 'USD',
    manager?: EntityManager,
  ): Promise<WalletEntity> {
    const walletRepo = manager?.getRepository(WalletEntity) ?? this.walletRepository;
    const existing = manager
      ? await walletRepo
          .createQueryBuilder('wallet')
          .setLock('pessimistic_write')
          .where('wallet.userId = :userId', { userId })
          .getOne()
      : await walletRepo.findOne({
          where: { userId },
        });

    if (existing) {
      if (existing.currency !== currency) {
        if (this.hasFinancialActivity(existing)) {
          throw new BadRequestException(
            `Wallet currency mismatch. Expected ${existing.currency}, received ${currency}.`,
          );
        }
        existing.currency = currency;
        return walletRepo.save(existing);
      }
      return existing;
    }

    const wallet = walletRepo.create({
      userId,
      balance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency,
    });
    return walletRepo.save(wallet);
  }

  async reserveWithdrawal(
    wallet: WalletEntity,
    amount: number,
    manager?: EntityManager,
  ): Promise<WalletEntity> {
    const walletRepo = manager?.getRepository(WalletEntity) ?? this.walletRepository;
    const value = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    wallet.balance = new Decimal(wallet.balance || 0).minus(value).toNumber();
    wallet.pendingBalance = new Decimal(wallet.pendingBalance || 0).plus(value).toNumber();
    return walletRepo.save(wallet);
  }

  async finalizeWithdrawal(
    wallet: WalletEntity,
    amount: number,
    manager?: EntityManager,
  ): Promise<WalletEntity> {
    const walletRepo = manager?.getRepository(WalletEntity) ?? this.walletRepository;
    const value = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    wallet.pendingBalance = new Decimal(wallet.pendingBalance || 0).minus(value).toNumber();
    wallet.totalWithdrawn = new Decimal(wallet.totalWithdrawn || 0).plus(value).toNumber();
    return walletRepo.save(wallet);
  }

  async releaseWithdrawal(
    wallet: WalletEntity,
    amount: number,
    manager?: EntityManager,
  ): Promise<WalletEntity> {
    const walletRepo = manager?.getRepository(WalletEntity) ?? this.walletRepository;
    const value = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    wallet.pendingBalance = new Decimal(wallet.pendingBalance || 0).minus(value).toNumber();
    wallet.balance = new Decimal(wallet.balance || 0).plus(value).toNumber();
    return walletRepo.save(wallet);
  }

  async getWalletSnapshot(user: Pick<UserEntity, 'id' | 'role'> | string): Promise<WalletSnapshot> {
    const userId = typeof user === 'string' ? user : user.id;
    const wallet = await this.getOrCreateWallet(userId);
    return this.buildWalletSnapshot(wallet, typeof user === 'string' ? undefined : user.role);
  }

  async getPlatformWalletSnapshot(): Promise<PlatformWalletSnapshotResult> {
    const owner = await this.resolvePlatformWalletOwner();
    const wallet = await this.getOrCreateWallet(owner.id);

    return {
      owner: this.toPlatformWalletOwner(owner),
      wallet: this.toWalletSnapshot(wallet),
      merchantBalance: await this.payPalPayoutsGateway.getMerchantBalance(),
    };
  }

  async listTransactions(
    user: Pick<UserEntity, 'id' | 'role'> | string,
    page = 1,
    limit = 20,
    range?: WalletTransactionRange,
  ): Promise<WalletTransactionsResult> {
    const userId = typeof user === 'string' ? user : user.id;
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const wallet = await this.getOrCreateWallet(userId);
    const where: {
      walletId: string;
      createdAt?: ReturnType<typeof Between>;
    } = {
      walletId: wallet.id,
    };

    if (range) {
      where.createdAt = Between(this.getRangeStart(range), new Date());
    }

    const [items, total] = await this.transactionRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      wallet: await this.buildWalletSnapshot(
        wallet,
        typeof user === 'string' ? undefined : user.role,
      ),
      items: items.map((item) => this.toWalletTransaction(item)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async listPlatformTransactions(
    page = 1,
    limit = 20,
    range?: WalletTransactionRange,
  ): Promise<PlatformWalletTransactionsResult> {
    const owner = await this.resolvePlatformWalletOwner();
    const result = await this.listTransactions(owner.id, page, limit, range);

    return {
      owner: this.toPlatformWalletOwner(owner),
      ...result,
    };
  }

  async buildWalletSnapshot(
    wallet: WalletEntity,
    role?: UserRole,
    manager?: EntityManager,
  ): Promise<WalletSnapshot> {
    const awaitingReleaseAmount = await this.resolveAwaitingReleaseAmount(
      wallet.userId,
      role,
      manager,
    );

    return this.toWalletSnapshot(wallet, { awaitingReleaseAmount });
  }

  async recordPlatformGatewayFee(
    params: {
      fundingIntentId: string;
      milestoneId: string;
      escrowId: string;
      milestoneTitle: string;
      currency: string;
      grossAmount: number;
      feeAmount: number;
      netMerchantAmount: number | null;
      providerReference: string;
    },
    manager?: EntityManager,
  ): Promise<TransactionEntity | null> {
    const feeAmount = new Decimal(params.feeAmount || 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );

    if (feeAmount.lte(0)) {
      return null;
    }

    const owner = await this.resolvePlatformWalletOwner(manager);
    const wallet = await this.getOrCreateWallet(owner.id, params.currency, manager);
    const walletRepo = manager?.getRepository(WalletEntity) ?? this.walletRepository;
    const transactionRepo = manager?.getRepository(TransactionEntity) ?? this.transactionRepository;

    wallet.balance = new Decimal(wallet.balance || 0)
      .minus(feeAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    wallet.totalSpent = new Decimal(wallet.totalSpent || 0)
      .plus(feeAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    await walletRepo.save(wallet);

    return transactionRepo.save(
      transactionRepo.create({
        walletId: wallet.id,
        amount: feeAmount.toNumber(),
        fee: 0,
        netAmount: feeAmount.negated().toNumber(),
        currency: params.currency,
        type: TransactionType.FEE_DEDUCTION,
        status: TransactionStatus.COMPLETED,
        referenceType: 'FundingIntent',
        referenceId: params.fundingIntentId,
        paymentMethod: 'PAYPAL',
        externalTransactionId: params.providerReference,
        metadata: {
          gatewayFee: true,
          provider: 'PAYPAL',
          stage: 'gateway_fee',
          milestoneId: params.milestoneId,
          escrowId: params.escrowId,
          grossAmount: params.grossAmount,
          feeAmount: feeAmount.toNumber(),
          netMerchantAmount: params.netMerchantAmount,
          platformOwnerUserId: owner.id,
        },
        description: `PayPal processing fee for milestone "${params.milestoneTitle}"`,
        balanceAfter: wallet.balance,
        initiatedBy: 'system',
        completedAt: new Date(),
      }),
    );
  }

  async recordPlatformFundingMirror(
    params: {
      fundingIntentId: string;
      milestoneId: string;
      milestoneTitle: string;
      escrowId: string;
      currency: string;
      amount: number;
      paymentMethod: string | null;
      providerReference: string;
      gateway: string;
      payerUserId: string;
      payerEmail: string | null;
      depositTransactionId: string;
      holdTransactionId: string;
    },
    manager?: EntityManager,
  ): Promise<TransactionEntity> {
    const owner = await this.resolvePlatformWalletOwner(manager);
    const wallet = await this.getOrCreateWallet(owner.id, params.currency, manager);
    const transactionRepo = manager?.getRepository(TransactionEntity) ?? this.transactionRepository;

    return transactionRepo.save(
      transactionRepo.create({
        walletId: wallet.id,
        amount: new Decimal(params.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        fee: 0,
        netAmount: new Decimal(params.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
        currency: params.currency,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        referenceType: 'FundingIntent',
        referenceId: params.fundingIntentId,
        paymentMethod: params.paymentMethod,
        externalTransactionId: params.providerReference,
        metadata: {
          mirroredFundingInflow: true,
          informationalOnly: true,
          milestoneId: params.milestoneId,
          escrowId: params.escrowId,
          gateway: params.gateway,
          payerUserId: params.payerUserId,
          payerEmail: params.payerEmail,
          depositTransactionId: params.depositTransactionId,
          holdTransactionId: params.holdTransactionId,
        },
        description: `Escrow funding captured for milestone "${params.milestoneTitle}"`,
        balanceAfter: wallet.balance,
        initiatedBy: 'system',
        relatedTransactionId: params.holdTransactionId,
        completedAt: new Date(),
      }),
    );
  }

  toWalletSnapshot(
    wallet: WalletEntity,
    options?: {
      awaitingReleaseAmount?: number;
    },
  ): WalletSnapshot {
    return {
      id: wallet.id,
      userId: wallet.userId,
      availableBalance: Number(wallet.balance || 0),
      pendingBalance: Number(wallet.pendingBalance || 0),
      heldBalance: Number(wallet.heldBalance || 0),
      awaitingReleaseAmount: Number(options?.awaitingReleaseAmount || 0),
      totalDeposited: Number(wallet.totalDeposited || 0),
      totalWithdrawn: Number(wallet.totalWithdrawn || 0),
      totalEarned: Number(wallet.totalEarned || 0),
      totalSpent: Number(wallet.totalSpent || 0),
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  toWalletTransaction(transaction: TransactionEntity): WalletTransactionItem {
    return {
      id: transaction.id,
      amount: Number(transaction.amount || 0),
      fee: Number(transaction.fee || 0),
      netAmount: transaction.netAmount === null ? null : Number(transaction.netAmount || 0),
      currency: transaction.currency,
      type: transaction.type,
      status: transaction.status,
      referenceType: transaction.referenceType || null,
      referenceId: transaction.referenceId || null,
      paymentMethod: transaction.paymentMethod || null,
      externalTransactionId: transaction.externalTransactionId || null,
      balanceAfter:
        transaction.balanceAfter === null ? null : Number(transaction.balanceAfter || 0),
      description: transaction.description || null,
      failureReason: transaction.failureReason || null,
      metadata: (transaction.metadata as Record<string, unknown> | null) ?? null,
      relatedTransactionId: transaction.relatedTransactionId || null,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt || null,
    };
  }

  async recordPlatformCashoutMirror(
    params: {
      requestId: string;
      transactionId: string;
      currency: string;
      amount: number;
      fee: number;
      netAmount: number;
      paypalEmail: string | null;
      providerReference: string;
      sandboxFallback: boolean;
      note: string | null;
    },
    manager?: EntityManager,
  ): Promise<TransactionEntity> {
    const owner = await this.resolvePlatformWalletOwner(manager);
    const wallet = await this.getOrCreateWallet(owner.id, params.currency, manager);
    const transactionRepo = manager?.getRepository(TransactionEntity) ?? this.transactionRepository;

    return transactionRepo.save(
      transactionRepo.create({
        walletId: wallet.id,
        amount: params.netAmount,
        fee: params.fee,
        netAmount: params.netAmount,
        currency: params.currency,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.COMPLETED,
        referenceType: 'PayoutRequest',
        referenceId: params.requestId,
        paymentMethod: 'PAYPAL_PAYOUTS',
        externalTransactionId: params.providerReference,
        metadata: {
          mirroredProviderOutflow: true,
          informationalOnly: true,
          recipientPaypalEmail: params.paypalEmail,
          grossAmount: params.amount,
          retainedFee: params.fee,
          sandboxFallback: params.sandboxFallback,
          note: params.note,
        },
        description: params.paypalEmail
          ? `Mirrored PayPal payout to ${params.paypalEmail}`
          : 'Mirrored PayPal payout',
        balanceAfter: wallet.balance,
        initiatedBy: 'system',
        relatedTransactionId: params.transactionId,
        completedAt: new Date(),
      }),
    );
  }

  private toPlatformWalletOwner(user: UserEntity): PlatformWalletOwnerView {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
  }

  private async resolveAwaitingReleaseAmount(
    userId: string,
    role?: UserRole,
    manager?: EntityManager,
  ): Promise<number> {
    if (role !== UserRole.BROKER && role !== UserRole.FREELANCER) {
      return 0;
    }

    const escrowRepo = manager?.getRepository(EscrowEntity) ?? this.escrowRepository;
    const shareColumn =
      role === UserRole.BROKER ? 'escrow.brokerShare' : 'escrow.developerShare';
    const projectRoleColumn =
      role === UserRole.BROKER ? 'project.brokerId' : 'project.freelancerId';

    const result = await escrowRepo
      .createQueryBuilder('escrow')
      .innerJoin(ProjectEntity, 'project', 'project.id = escrow.projectId')
      .select(`COALESCE(SUM(${shareColumn}), 0)`, 'total')
      .where('escrow.status IN (:...statuses)', {
        statuses: [EscrowStatus.FUNDED, EscrowStatus.DISPUTED],
      })
      .andWhere(`${projectRoleColumn} = :userId`, { userId })
      .getRawOne<{ total: string | number | null }>();

    return new Decimal(result?.total ?? 0)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  private async resolvePlatformWalletOwner(manager?: EntityManager): Promise<UserEntity> {
    const userRepo = manager?.getRepository(UserEntity) ?? this.userRepository;
    const owner = await userRepo.findOne({
      where: [
        {
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
        {
          role: UserRole.STAFF,
          status: UserStatus.ACTIVE,
        },
      ],
      order: {
        createdAt: 'ASC',
      },
    });

    if (!owner) {
      throw new ConflictException(
        'Cannot resolve platform treasury wallet because no active ADMIN/STAFF owner is available',
      );
    }

    return owner;
  }

  private hasFinancialActivity(wallet: WalletEntity): boolean {
    return [
      wallet.balance,
      wallet.pendingBalance,
      wallet.heldBalance,
      wallet.totalDeposited,
      wallet.totalWithdrawn,
      wallet.totalEarned,
      wallet.totalSpent,
    ].some((value) => Number(value || 0) !== 0);
  }

  private getRangeStart(range: WalletTransactionRange): Date {
    const now = new Date();
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
}
