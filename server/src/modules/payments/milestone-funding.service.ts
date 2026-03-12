import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  EscrowEntity,
  EscrowStatus,
  FundingGateway,
  FundingIntentEntity,
  FundingIntentStatus,
  MilestoneEntity,
  PaymentMethodEntity,
  PaymentMethodType,
  ProjectEntity,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  WalletEntity,
} from '../../database/entities';
import { WalletService } from './wallet.service';
import { FundingGatewayResult } from './interfaces/payment-gateway.interface';
import { InternalSandboxGateway } from './internal-sandbox.gateway';
import {
  FundingTransactionsView,
  MilestoneFundingResult,
  WalletSnapshot,
} from './payments.types';

export interface FundMilestoneInput {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  gateway: FundingGateway;
  idempotencyKey: string;
}

@Injectable()
export class MilestoneFundingService {
  constructor(
    @InjectRepository(FundingIntentEntity)
    private readonly fundingIntentRepository: Repository<FundingIntentEntity>,
    private readonly dataSource: DataSource,
    private readonly walletService: WalletService,
    private readonly internalSandboxGateway: InternalSandboxGateway,
  ) {}

  async fundMilestone(input: FundMilestoneInput): Promise<MilestoneFundingResult> {
    const normalizedKey = input.idempotencyKey.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const milestone = await manager.getRepository(MilestoneEntity).findOne({
        where: { id: input.milestoneId },
      });
      if (!milestone) {
        throw new NotFoundException(`Milestone ${input.milestoneId} not found`);
      }

      const escrow = await manager
        .getRepository(EscrowEntity)
        .createQueryBuilder('escrow')
        .setLock('pessimistic_write')
        .where('escrow.milestoneId = :milestoneId', { milestoneId: input.milestoneId })
        .getOne();
      if (!escrow) {
        throw new NotFoundException(`Escrow for milestone ${input.milestoneId} not found`);
      }

      const existingIntent = await manager.getRepository(FundingIntentEntity).findOne({
        where: {
          payerId: input.payerId,
          milestoneId: input.milestoneId,
          idempotencyKey: normalizedKey,
        },
      });
      if (existingIntent) {
        return this.buildExistingIntentResponse(manager, existingIntent, escrow, input.payerId);
      }

      const project = await manager.getRepository(ProjectEntity).findOne({
        where: { id: escrow.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project ${escrow.projectId} not found`);
      }
      if (project.clientId !== input.payerId) {
        throw new ForbiddenException('Only the project client can fund a milestone');
      }

      this.assertEscrowCanBeFunded(escrow);
      this.assertMilestoneAmountMatchesEscrow(milestone, escrow);

      const paymentMethod = await manager.getRepository(PaymentMethodEntity).findOne({
        where: { id: input.paymentMethodId, userId: input.payerId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(`Payment method ${input.paymentMethodId} not found`);
      }
      if (paymentMethod.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
        throw new BadRequestException('Only PAYPAL_ACCOUNT methods can be used for milestone funding');
      }

      const amount = new Decimal(escrow.totalAmount || milestone.amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      const currency = escrow.currency || project.currency || 'USD';

      const fundingIntent = await manager.getRepository(FundingIntentEntity).save(
        manager.getRepository(FundingIntentEntity).create({
          milestoneId: milestone.id,
          payerId: input.payerId,
          paymentMethodId: paymentMethod.id,
          gateway: input.gateway,
          amount,
          currency,
          status: FundingIntentStatus.PENDING,
          idempotencyKey: normalizedKey,
        }),
      );

      const gatewayResult = await this.resolveGateway(input.gateway).fund(fundingIntent, paymentMethod, {
        milestoneId: milestone.id,
        escrowId: escrow.id,
        projectId: project.id,
        currency,
        amount,
      });

      const wallet = await this.walletService.getOrCreateWallet(input.payerId, currency, manager);
      const depositTransaction = await this.createDepositTransaction(
        manager,
        wallet,
        fundingIntent,
        milestone,
        escrow,
        paymentMethod,
        gatewayResult,
      );
      const holdTransaction = await this.createEscrowHoldTransaction(
        manager,
        wallet,
        fundingIntent,
        milestone,
        escrow,
        paymentMethod,
        gatewayResult,
        depositTransaction,
      );

      escrow.status = EscrowStatus.FUNDED;
      escrow.fundedAmount = amount;
      escrow.fundedAt = new Date();
      escrow.clientWalletId = wallet.id;
      escrow.holdTransactionId = holdTransaction.id;
      await manager.getRepository(EscrowEntity).save(escrow);

      fundingIntent.status = FundingIntentStatus.COMPLETED;
      fundingIntent.providerReference = gatewayResult.providerReference;
      fundingIntent.completedAt = new Date();
      await manager.getRepository(FundingIntentEntity).save(fundingIntent);

      return {
        fundingIntentId: fundingIntent.id,
        milestoneId: milestone.id,
        escrowId: escrow.id,
        escrowStatus: escrow.status,
        walletSnapshot: this.walletService.toWalletSnapshot(wallet),
        transactions: {
          depositTransactionId: depositTransaction.id,
          holdTransactionId: holdTransaction.id,
        },
        nextAction: gatewayResult.nextAction,
        gateway: fundingIntent.gateway,
      };
    });
  }

  private async buildExistingIntentResponse(
    manager: EntityManager,
    fundingIntent: FundingIntentEntity,
    escrow: EscrowEntity,
    payerId: string,
  ): Promise<MilestoneFundingResult> {
    if (fundingIntent.status === FundingIntentStatus.COMPLETED) {
      const wallet = await this.walletService.getOrCreateWallet(
        payerId,
        fundingIntent.currency,
        manager,
      );
      const transactions = await this.loadFundingTransactions(manager, fundingIntent.id);

      return {
        fundingIntentId: fundingIntent.id,
        milestoneId: fundingIntent.milestoneId,
        escrowId: escrow.id,
        escrowStatus: escrow.status,
        walletSnapshot: this.walletService.toWalletSnapshot(wallet),
        transactions,
        nextAction: {
          type: 'IDEMPOTENT_REPLAY',
          message: 'Existing successful funding intent reused.',
        },
        gateway: fundingIntent.gateway,
      };
    }

    if (fundingIntent.status === FundingIntentStatus.PENDING) {
      throw new ConflictException(
        `Funding attempt ${fundingIntent.id} is still pending. Retry later with the same Idempotency-Key.`,
      );
    }

    throw new ConflictException(
      `Funding attempt ${fundingIntent.id} is ${fundingIntent.status}. Use a new Idempotency-Key to retry.`,
    );
  }

  private async createDepositTransaction(
    manager: EntityManager,
    wallet: WalletEntity,
    fundingIntent: FundingIntentEntity,
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
    paymentMethod: PaymentMethodEntity,
    gatewayResult: FundingGatewayResult,
  ): Promise<TransactionEntity> {
    const amount = new Decimal(fundingIntent.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    wallet.balance = new Decimal(wallet.balance || 0).plus(amount).toNumber();
    wallet.totalDeposited = new Decimal(wallet.totalDeposited || 0).plus(amount).toNumber();
    await manager.getRepository(WalletEntity).save(wallet);

    return manager.getRepository(TransactionEntity).save(
      manager.getRepository(TransactionEntity).create({
        walletId: wallet.id,
        amount: amount.toNumber(),
        fee: 0,
        netAmount: amount.toNumber(),
        currency: fundingIntent.currency,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        referenceType: 'FundingIntent',
        referenceId: fundingIntent.id,
        paymentMethod: paymentMethod.type,
        externalTransactionId: gatewayResult.providerReference,
        metadata: {
          milestoneId: milestone.id,
          escrowId: escrow.id,
          paymentMethodId: paymentMethod.id,
          gateway: fundingIntent.gateway,
          stage: 'deposit',
        },
        description: `Deposit for milestone "${milestone.title}"`,
        balanceAfter: wallet.balance,
        initiatedBy: 'user',
        completedAt: new Date(),
      }),
    );
  }

  private async createEscrowHoldTransaction(
    manager: EntityManager,
    wallet: WalletEntity,
    fundingIntent: FundingIntentEntity,
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
    paymentMethod: PaymentMethodEntity,
    gatewayResult: FundingGatewayResult,
    depositTransaction: TransactionEntity,
  ): Promise<TransactionEntity> {
    const amount = new Decimal(fundingIntent.amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    wallet.balance = new Decimal(wallet.balance || 0).minus(amount).toNumber();
    wallet.heldBalance = new Decimal(wallet.heldBalance || 0).plus(amount).toNumber();
    await manager.getRepository(WalletEntity).save(wallet);

    const holdTransaction = await manager.getRepository(TransactionEntity).save(
      manager.getRepository(TransactionEntity).create({
        walletId: wallet.id,
        amount: amount.toNumber(),
        fee: 0,
        netAmount: amount.toNumber(),
        currency: fundingIntent.currency,
        type: TransactionType.ESCROW_HOLD,
        status: TransactionStatus.COMPLETED,
        referenceType: 'FundingIntent',
        referenceId: fundingIntent.id,
        paymentMethod: paymentMethod.type,
        externalTransactionId: gatewayResult.providerReference,
        metadata: {
          milestoneId: milestone.id,
          escrowId: escrow.id,
          paymentMethodId: paymentMethod.id,
          gateway: fundingIntent.gateway,
          stage: 'hold',
          depositTransactionId: depositTransaction.id,
        },
        description: `Escrow hold for milestone "${milestone.title}"`,
        balanceAfter: wallet.balance,
        initiatedBy: 'user',
        relatedTransactionId: depositTransaction.id,
        completedAt: new Date(),
      }),
    );

    depositTransaction.relatedTransactionId = holdTransaction.id;
    await manager.getRepository(TransactionEntity).save(depositTransaction);
    return holdTransaction;
  }

  private async loadFundingTransactions(
    manager: EntityManager,
    fundingIntentId: string,
  ): Promise<FundingTransactionsView> {
    const transactions = await manager.getRepository(TransactionEntity).find({
      where: {
        referenceType: 'FundingIntent',
        referenceId: fundingIntentId,
      },
      order: { createdAt: 'ASC' },
    });

    const depositTransaction = transactions.find((item) => item.type === TransactionType.DEPOSIT);
    const holdTransaction = transactions.find((item) => item.type === TransactionType.ESCROW_HOLD);

    if (!depositTransaction || !holdTransaction) {
      throw new InternalServerErrorException(
        `Funding intent ${fundingIntentId} is missing deposit/hold transactions`,
      );
    }

    return {
      depositTransactionId: depositTransaction.id,
      holdTransactionId: holdTransaction.id,
    };
  }

  private assertEscrowCanBeFunded(escrow: EscrowEntity): void {
    if (escrow.status === EscrowStatus.DISPUTED) {
      throw new BadRequestException('Disputed escrow cannot be funded');
    }

    if (
      escrow.status === EscrowStatus.FUNDED ||
      escrow.status === EscrowStatus.RELEASED ||
      escrow.status === EscrowStatus.REFUNDED
    ) {
      throw new BadRequestException(`Escrow ${escrow.id} is already ${escrow.status}`);
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new BadRequestException(`Escrow ${escrow.id} is not open for funding`);
    }
  }

  private assertMilestoneAmountMatchesEscrow(
    milestone: MilestoneEntity,
    escrow: EscrowEntity,
  ): void {
    const milestoneAmount = new Decimal(milestone.amount || 0).toDecimalPlaces(2);
    const escrowAmount = new Decimal(escrow.totalAmount || 0).toDecimalPlaces(2);
    if (!milestoneAmount.equals(escrowAmount)) {
      throw new ConflictException('Milestone amount does not match escrow totalAmount');
    }
  }

  private resolveGateway(gateway: FundingGateway): InternalSandboxGateway {
    if (gateway === FundingGateway.INTERNAL_SANDBOX) {
      return this.internalSandboxGateway;
    }

    throw new NotImplementedException(`Gateway ${gateway} is not wired yet`);
  }
}
