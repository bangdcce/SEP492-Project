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
  FeeConfigEntity,
  FeeType,
  PayoutMethodEntity,
  PayoutMethodType,
  PayoutRequestEntity,
  PayoutStatus,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  WalletEntity,
  WalletStatus,
} from '../../database/entities';
import { CreatePayoutRequestDto, PayoutRequestsQueryDto } from './dto';
import { PayPalPayoutsGateway } from './pay-pal-payouts.gateway';
import {
  CashoutQuoteView,
  PayoutRequestMutationResult,
  PayoutRequestView,
  PayoutRequestsResult,
} from './payments.types';
import { WalletService } from './wallet.service';

@Injectable()
export class PayoutRequestsService {
  constructor(
    @InjectRepository(PayoutRequestEntity)
    private readonly payoutRequestRepository: Repository<PayoutRequestEntity>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly payoutGateway: PayPalPayoutsGateway,
  ) {}

  async listForUser(userId: string, query: PayoutRequestsQueryDto = {}): Promise<PayoutRequestsResult> {
    const page = Number.isFinite(query.page) && (query.page ?? 1) > 0 ? query.page ?? 1 : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 20) > 0 ? Math.min(query.limit ?? 20, 100) : 20;
    const wallet = await this.walletService.getOrCreateWallet(userId);

    const [items, total] = await this.payoutRequestRepository.findAndCount({
      where: {
        walletId: wallet.id,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: ['payoutMethod'],
      order: { requestedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      wallet: this.walletService.toWalletSnapshot(wallet),
      items: items.map((item) => this.toPayoutRequestView(item, item.payoutMethod)),
      total,
      page,
      limit,
    };
  }

  async quoteForUser(
    user: UserEntity,
    payoutMethodId: string,
    amountInput: number,
  ): Promise<CashoutQuoteView> {
    this.assertCanCashOut(user);

    const amount = new Decimal(amountInput).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (amount.lte(0)) {
      throw new BadRequestException('Payout amount must be greater than 0');
    }

    const wallet = await this.walletService.getOrCreateWallet(user.id);
    this.assertWalletCanPayout(wallet);

    const payoutMethod = await this.dataSource.getRepository(PayoutMethodEntity).findOne({
      where: { id: payoutMethodId, userId: user.id },
    });
    if (!payoutMethod) {
      throw new NotFoundException(`Payout method ${payoutMethodId} not found`);
    }

    this.assertPayoutMethodMatchesLane(payoutMethod);

    const fee = await this.resolveWithdrawalFee(this.dataSource.manager, amount.toNumber());
    const feeValue = new Decimal(fee).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const netAmount = amount.minus(feeValue).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (netAmount.lte(0)) {
      throw new BadRequestException('Withdrawal fee is larger than or equal to payout amount');
    }
    const processing = this.payoutGateway.describeProcessingMode(payoutMethod.type);

    return {
      amount: amount.toNumber(),
      fee: feeValue.toNumber(),
      netAmount: netAmount.toNumber(),
      currency: wallet.currency || 'USD',
      availableBalance: Number(wallet.balance || 0),
      minimumAmount: 1,
      maximumAmount: Number(wallet.balance || 0),
      processingMode: processing.processingMode,
      processingDescription: processing.processingDescription,
    };
  }

  async createForUser(
    user: UserEntity,
    dto: CreatePayoutRequestDto,
  ): Promise<PayoutRequestMutationResult> {
    this.assertCanCashOut(user);

    return this.dataSource.transaction(async (manager) => {
      const wallet = await this.walletService.getOrCreateWallet(user.id, undefined, manager);
      this.assertWalletCanPayout(wallet);

      const payoutMethod = await manager.getRepository(PayoutMethodEntity).findOne({
        where: { id: dto.payoutMethodId, userId: user.id },
      });
      if (!payoutMethod) {
        throw new NotFoundException(`Payout method ${dto.payoutMethodId} not found`);
      }

      this.assertPayoutMethodMatchesLane(payoutMethod);

      const amount = new Decimal(dto.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (amount.lte(0)) {
        throw new BadRequestException('Payout amount must be greater than 0');
      }

      const fee = await this.resolveWithdrawalFee(manager, amount.toNumber());
      const feeValue = new Decimal(fee).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const netAmount = amount.minus(feeValue).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (netAmount.lte(0)) {
        throw new BadRequestException('Withdrawal fee is larger than or equal to payout amount');
      }
      if (new Decimal(wallet.balance || 0).lessThan(amount)) {
        throw new ConflictException('Insufficient available balance for cashout request');
      }

      const request = await manager.getRepository(PayoutRequestEntity).save(
        manager.getRepository(PayoutRequestEntity).create({
          walletId: wallet.id,
          payoutMethodId: payoutMethod.id,
          amount: amount.toNumber(),
          fee: feeValue.toNumber(),
          netAmount: netAmount.toNumber(),
          currency: wallet.currency || 'USD',
          status: PayoutStatus.PROCESSING,
          note: dto.note?.trim() || null,
        }),
      );

      await this.walletService.reserveWithdrawal(wallet, amount.toNumber(), manager);

      const transaction = await manager.getRepository(TransactionEntity).save(
        manager.getRepository(TransactionEntity).create({
          walletId: wallet.id,
          amount: amount.toNumber(),
          fee: feeValue.toNumber(),
          netAmount: netAmount.toNumber(),
          currency: request.currency,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PROCESSING,
          referenceType: 'PayoutRequest',
          referenceId: request.id,
          paymentMethod: payoutMethod.type,
          metadata: {
            payoutRequestId: request.id,
            payoutMethodId: payoutMethod.id,
            payoutMethodType: payoutMethod.type,
            lane: payoutMethod.type,
            requestedAt: new Date().toISOString(),
            note: request.note,
          },
          description: `Cashout request for ${payoutMethod.type === PayoutMethodType.PAYPAL_EMAIL ? payoutMethod.paypalEmail : payoutMethod.bankName}`,
          balanceAfter: wallet.balance,
          initiatedBy: 'user',
        }),
      );

      request.transactionId = transaction.id;
      await manager.getRepository(PayoutRequestEntity).save(request);

      try {
        const gatewayResult = await this.payoutGateway.payout(request, payoutMethod, {
          currency: request.currency,
          amount: amount.toNumber(),
          fee: feeValue.toNumber(),
          netAmount: netAmount.toNumber(),
          note: request.note,
        });

        await this.walletService.finalizeWithdrawal(wallet, amount.toNumber(), manager);

        transaction.status = TransactionStatus.COMPLETED;
        transaction.externalTransactionId = gatewayResult.providerReference;
        transaction.completedAt = new Date();
        transaction.metadata = {
          ...(transaction.metadata ?? {}),
          gatewayResult,
        };
        await manager.getRepository(TransactionEntity).save(transaction);

        request.status = PayoutStatus.COMPLETED;
        request.processedAt = new Date();
        request.processedBy = 'system';
        request.externalReference = gatewayResult.providerReference;
        request.errorCode = null;
        request.failureReason = null;
        request.adminNote = gatewayResult.sandboxFallback
          ? 'Sandbox fallback used because PayPal Payouts credentials were not configured.'
          : null;
        await manager.getRepository(PayoutRequestEntity).save(request);

        await this.walletService.recordPlatformCashoutMirror(
          {
            requestId: request.id,
            transactionId: transaction.id,
            currency: request.currency,
            amount: amount.toNumber(),
            fee: feeValue.toNumber(),
            netAmount: netAmount.toNumber(),
            paypalEmail: payoutMethod.paypalEmail,
            providerReference: gatewayResult.providerReference,
            sandboxFallback: gatewayResult.sandboxFallback,
            note: request.note,
          },
          manager,
        );

        return {
          request: this.toPayoutRequestView(request, payoutMethod),
          wallet: this.walletService.toWalletSnapshot(wallet),
        };
      } catch (error) {
        await this.walletService.releaseWithdrawal(wallet, amount.toNumber(), manager);

        transaction.status = TransactionStatus.FAILED;
        transaction.failureReason = error instanceof Error ? error.message : 'Payout processing failed';
        transaction.completedAt = new Date();
        transaction.metadata = {
          ...(transaction.metadata ?? {}),
          payoutFailure: true,
        };
        await manager.getRepository(TransactionEntity).save(transaction);

        request.status = PayoutStatus.FAILED;
        request.processedAt = new Date();
        request.processedBy = 'system';
        request.errorCode = 'PAYPAL_PAYOUT_FAILED';
        request.failureReason =
          error instanceof Error ? error.message : 'Payout processing failed';
        request.adminNote = request.failureReason;
        await manager.getRepository(PayoutRequestEntity).save(request);

        return {
          request: this.toPayoutRequestView(request, payoutMethod),
          wallet: this.walletService.toWalletSnapshot(wallet),
        };
      }
    });
  }

  async rejectForAdmin(
    requestId: string,
    admin: UserEntity,
    reason: string,
  ): Promise<PayoutRequestMutationResult> {
    if (!this.isStaffOrAdmin(admin)) {
      throw new ForbiddenException('Only staff or admin users can reject payout requests');
    }

    return this.dataSource.transaction(async (manager) => {
      const request = await manager
        .getRepository(PayoutRequestEntity)
        .createQueryBuilder('request')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('request.wallet', 'wallet')
        .leftJoinAndSelect('request.payoutMethod', 'payoutMethod')
        .leftJoinAndSelect('request.transaction', 'transaction')
        .where('request.id = :requestId', { requestId })
        .getOne();

      if (!request) {
        throw new NotFoundException(`Payout request ${requestId} not found`);
      }

      if (
        request.status === PayoutStatus.COMPLETED
        || request.status === PayoutStatus.REJECTED
        || request.status === PayoutStatus.CANCELLED
      ) {
        throw new ConflictException(`Payout request ${requestId} is already finalized`);
      }

      const wallet = await this.walletService.getOrCreateWallet(request.wallet.userId, request.currency, manager);
      await this.walletService.releaseWithdrawal(wallet, request.amount, manager);

      if (request.transactionId) {
        const transaction = await manager.getRepository(TransactionEntity).findOne({
          where: { id: request.transactionId },
        });
        if (transaction) {
          transaction.status = TransactionStatus.CANCELLED;
          transaction.failureReason = reason;
          transaction.completedAt = new Date();
          await manager.getRepository(TransactionEntity).save(transaction);
        }
      }

      request.status = PayoutStatus.REJECTED;
      request.rejectedAt = new Date();
      request.rejectedBy = admin.id;
      request.rejectionReason = reason;
      request.errorCode = 'MANUAL_REJECTED';
      request.failureReason = reason;
      request.adminNote = reason;
      await manager.getRepository(PayoutRequestEntity).save(request);

      return {
        request: this.toPayoutRequestView(request, request.payoutMethod),
        wallet: this.walletService.toWalletSnapshot(wallet),
      };
    });
  }

  private assertCanCashOut(user: UserEntity): void {
    if (this.isBrokerOrFreelancer(user)) {
      return;
    }

    throw new ForbiddenException('Only broker and freelancer accounts can request cashouts');
  }

  private isBrokerOrFreelancer(user: UserEntity): boolean {
    return [ 'BROKER', 'FREELANCER' ].includes(String(user?.role || '').toUpperCase());
  }

  private isStaffOrAdmin(user: UserEntity): boolean {
    return [ 'ADMIN', 'STAFF' ].includes(String(user?.role || '').toUpperCase());
  }

  private assertWalletCanPayout(wallet: WalletEntity): void {
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new ConflictException('Wallet is not active');
    }
  }

  private assertPayoutMethodMatchesLane(method: PayoutMethodEntity): void {
    if (method.type === PayoutMethodType.PAYPAL_EMAIL) {
      if (!method.paypalEmail?.trim()) {
        throw new BadRequestException('PayPal payout methods require a paypalEmail');
      }
      return;
    }

    if (method.type === PayoutMethodType.BANK_ACCOUNT) {
      throw new BadRequestException(
        'Cashout is only available through PayPal payout methods right now',
      );
    }

    throw new BadRequestException('Unsupported payout method lane');
  }

  private async resolveWithdrawalFee(
    manager: EntityManager,
    amount: number,
  ): Promise<number> {
    const feeConfig = await manager.getRepository(FeeConfigEntity).findOne({
      where: {
        feeType: FeeType.WITHDRAWAL_FEE,
        isActive: true,
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    if (!feeConfig) {
      return 0;
    }

    let fee = new Decimal(amount).mul(feeConfig.percentage).div(100);
    if (feeConfig.minAmount != null) {
      fee = Decimal.max(fee, new Decimal(feeConfig.minAmount));
    }
    if (feeConfig.maxAmount != null) {
      fee = Decimal.min(fee, new Decimal(feeConfig.maxAmount));
    }

    return fee.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  private toPayoutRequestView(
    request: PayoutRequestEntity,
    payoutMethod?: PayoutMethodEntity | null,
  ): PayoutRequestView {
    const requestMethod =
      payoutMethod
      ?? (request as PayoutRequestEntity & { payoutMethod?: PayoutMethodEntity | null }).payoutMethod
      ?? null;
    return {
      id: request.id,
      walletId: request.walletId,
      payoutMethodId: request.payoutMethodId,
      amount: Number(request.amount || 0),
      fee: Number(request.fee || 0),
      netAmount: Number(request.netAmount || 0),
      currency: request.currency,
      status: request.status,
      approvedAt: request.approvedAt || null,
      approvedBy: request.approvedBy || null,
      rejectedAt: request.rejectedAt || null,
      rejectedBy: request.rejectedBy || null,
      rejectionReason: request.rejectionReason || null,
      processedAt: request.processedAt || null,
      processedBy: request.processedBy || null,
      externalReference: request.externalReference || null,
      errorCode: request.errorCode || null,
      failureReason: request.failureReason || null,
      transactionId: request.transactionId || null,
      note: request.note || null,
      adminNote: request.adminNote || null,
      requestedAt: request.requestedAt,
      updatedAt: request.updatedAt,
      payoutMethod: requestMethod ? this.toPayoutMethodView(requestMethod) : null,
    };
  }

  private toPayoutMethodView(method: PayoutMethodEntity) {
    return {
      id: method.id,
      type: method.type,
      displayName: method.displayName ?? this.buildDisplayNameFromMethod(method),
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      canDelete: true,
      paypalEmail: method.paypalEmail,
      bankName: method.bankName,
      bankCode: method.bankCode,
      branchName: method.branchName,
      accountNumberMasked: method.accountNumber
        ? `${'*'.repeat(Math.max(0, method.accountNumber.trim().length - 4))}${method.accountNumber.trim().slice(-4)}`
        : null,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private buildDisplayNameFromMethod(method: PayoutMethodEntity): string {
    if (method.type === PayoutMethodType.PAYPAL_EMAIL) {
      return method.paypalEmail?.trim() || 'PayPal payout';
    }

    const bankName = method.bankName?.trim() || 'Bank payout';
    const masked = this.maskAccountNumber(method.accountNumber) ?? 'account';
    return `${bankName} ${masked}`.trim();
  }

  private maskAccountNumber(accountNumber: string | null): string | null {
    if (!accountNumber) {
      return null;
    }

    const trimmed = accountNumber.trim();
    if (trimmed.length <= 4) {
      return trimmed;
    }

    return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
  }
}
