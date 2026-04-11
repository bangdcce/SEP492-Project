import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  MilestoneStatus,
  PaymentMethodEntity,
  PaymentMethodType,
  ProjectEntity,
  ProjectStatus,
  TaskEntity,
  TaskHistoryEntity,
  TaskStatus,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  WalletEntity,
} from '../../database/entities';
import { WalletService } from './wallet.service';
import { FundingGatewayResult } from './interfaces/payment-gateway.interface';
import { InternalSandboxGateway } from './internal-sandbox.gateway';
import {
  FundingTransactionsView,
  MilestoneFundingResult,
  StripeCheckoutSessionView,
  WalletSnapshot,
} from './payments.types';
import {
  StripeCheckoutService,
  StripeCheckoutSessionDetails,
} from './stripe-checkout.service';
import {
  CreatePayPalMilestoneOrderInput,
  PayPalCheckoutService,
} from './pay-pal-checkout.service';

export interface FundMilestoneInput {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  gateway: FundingGateway;
  idempotencyKey: string;
}

export interface CompletePayPalMilestoneFundingInput {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  gateway: FundingGateway.PAYPAL;
  orderId?: string;
  order?: Record<string, unknown>;
}

export interface CreatePayPalMilestoneOrderInputForFunding {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  gateway: FundingGateway.PAYPAL;
  source?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreateStripeMilestoneCheckoutInput {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  gateway: FundingGateway.STRIPE;
  returnUrl: string;
}

export interface CompleteStripeMilestoneFundingInput {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  gateway: FundingGateway.STRIPE;
  sessionId: string;
}

@Injectable()
export class MilestoneFundingService {
  constructor(
    @InjectRepository(FundingIntentEntity)
    private readonly fundingIntentRepository: Repository<FundingIntentEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly walletService: WalletService,
    private readonly internalSandboxGateway: InternalSandboxGateway,
    private readonly payPalCheckoutService: PayPalCheckoutService,
    private readonly stripeCheckoutService: StripeCheckoutService,
  ) {}

  async fundMilestone(input: FundMilestoneInput): Promise<MilestoneFundingResult> {
    const normalizedKey = input.idempotencyKey.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    let fundedProject: Pick<
      ProjectEntity,
      'id' | 'requestId' | 'clientId' | 'brokerId' | 'freelancerId' | 'staffId'
    > | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
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
        this.assertExistingIntentMatchesInput(existingIntent, input);
        return this.buildExistingIntentResponse(manager, existingIntent, escrow, input.payerId);
      }

      const project = await manager.getRepository(ProjectEntity).findOne({
        where: { id: escrow.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project ${escrow.projectId} not found`);
      }
      fundedProject = project;
      if (project.clientId !== input.payerId) {
        throw new ForbiddenException('Only the project client can fund a milestone');
      }

      this.assertProjectCanBeFunded(project);
      this.assertMilestoneCanBeFunded(milestone);
      this.assertEscrowCanBeFunded(escrow);
      this.assertMilestoneAmountMatchesEscrow(milestone, escrow);

      const paymentMethod = await manager.getRepository(PaymentMethodEntity).findOne({
        where: { id: input.paymentMethodId, userId: input.payerId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(`Payment method ${input.paymentMethodId} not found`);
      }
      if (
        paymentMethod.type !== PaymentMethodType.PAYPAL_ACCOUNT
        && paymentMethod.type !== PaymentMethodType.CARD_ACCOUNT
      ) {
        throw new BadRequestException(
          'Only PAYPAL_ACCOUNT and CARD_ACCOUNT methods can be used for milestone funding',
        );
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

      await this.walletService.recordPlatformFundingMirror(
        {
          fundingIntentId: fundingIntent.id,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          escrowId: escrow.id,
          currency,
          amount,
          paymentMethod: paymentMethod.type,
          providerReference: gatewayResult.providerReference,
          gateway: fundingIntent.gateway,
          payerUserId: input.payerId,
          payerEmail: paymentMethod.paypalEmail ?? null,
          depositTransactionId: depositTransaction.id,
          holdTransactionId: holdTransaction.id,
        },
        manager,
      );

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

    if (fundedProject) {
      this.emitProjectUpdated(fundedProject);
    }

    return result;
  }

  async completePayPalMilestoneFunding(
    input: CompletePayPalMilestoneFundingInput,
  ): Promise<MilestoneFundingResult> {
    const capturedOrder = input.order
      ?? (input.orderId
        ? await this.payPalCheckoutService.captureOrder(input.orderId)
        : null);
    if (!capturedOrder) {
      throw new BadRequestException('A PayPal order payload or orderId is required');
    }

    const orderDetails = this.extractCompletedPayPalOrder(capturedOrder, input.milestoneId);
    const normalizedKey = orderDetails.orderId.trim();

    let fundedProject: Pick<
      ProjectEntity,
      'id' | 'requestId' | 'clientId' | 'brokerId' | 'freelancerId' | 'staffId'
    > | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
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
        this.assertExistingIntentMatchesInput(existingIntent, {
          milestoneId: input.milestoneId,
          payerId: input.payerId,
          paymentMethodId: input.paymentMethodId,
          gateway: FundingGateway.PAYPAL,
          idempotencyKey: normalizedKey,
        });
        return this.buildExistingIntentResponse(manager, existingIntent, escrow, input.payerId);
      }

      const project = await manager.getRepository(ProjectEntity).findOne({
        where: { id: escrow.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project ${escrow.projectId} not found`);
      }
      fundedProject = project;
      if (project.clientId !== input.payerId) {
        throw new ForbiddenException('Only the project client can fund a milestone');
      }

      this.assertProjectCanBeFunded(project);
      this.assertMilestoneCanBeFunded(milestone);
      this.assertEscrowCanBeFunded(escrow);
      this.assertMilestoneAmountMatchesEscrow(milestone, escrow);
      this.assertPayPalOrderMatchesEscrow(orderDetails, escrow, project);

      const paymentMethod = await manager.getRepository(PaymentMethodEntity).findOne({
        where: { id: input.paymentMethodId, userId: input.payerId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(`Payment method ${input.paymentMethodId} not found`);
      }
      if (paymentMethod.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
        throw new BadRequestException('Only PAYPAL_ACCOUNT methods can complete PayPal checkout');
      }

      await this.syncPayPalMethodVaultMetadata(manager, paymentMethod, orderDetails);

      const fundingIntent = await manager.getRepository(FundingIntentEntity).save(
        manager.getRepository(FundingIntentEntity).create({
          milestoneId: milestone.id,
          payerId: input.payerId,
          paymentMethodId: paymentMethod.id,
          gateway: FundingGateway.PAYPAL,
          amount: orderDetails.amount,
          currency: orderDetails.currency,
          status: FundingIntentStatus.PENDING,
          idempotencyKey: normalizedKey,
        }),
      );

      const gatewayResult: FundingGatewayResult = {
        providerReference: orderDetails.captureId,
        nextAction: {
          type: 'PAYPAL_CAPTURE_COMPLETED',
          orderId: orderDetails.orderId,
          captureId: orderDetails.captureId,
          payerEmail: orderDetails.payerEmail,
        },
      };

      const wallet = await this.walletService.getOrCreateWallet(
        input.payerId,
        orderDetails.currency,
        manager,
      );
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
      escrow.fundedAmount = orderDetails.amount;
      escrow.fundedAt = new Date();
      escrow.clientWalletId = wallet.id;
      escrow.holdTransactionId = holdTransaction.id;
      await manager.getRepository(EscrowEntity).save(escrow);

      fundingIntent.status = FundingIntentStatus.COMPLETED;
      fundingIntent.providerReference = orderDetails.captureId;
      fundingIntent.completedAt = new Date();
      await manager.getRepository(FundingIntentEntity).save(fundingIntent);

      await this.walletService.recordPlatformFundingMirror(
        {
          fundingIntentId: fundingIntent.id,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          escrowId: escrow.id,
          currency: orderDetails.currency,
          amount: orderDetails.amount,
          paymentMethod: paymentMethod.type,
          providerReference: orderDetails.captureId,
          gateway: fundingIntent.gateway,
          payerUserId: input.payerId,
          payerEmail: orderDetails.payerEmail ?? paymentMethod.paypalEmail ?? null,
          depositTransactionId: depositTransaction.id,
          holdTransactionId: holdTransaction.id,
        },
        manager,
      );

      await this.walletService.recordPlatformGatewayFee(
        {
          fundingIntentId: fundingIntent.id,
          milestoneId: milestone.id,
          escrowId: escrow.id,
          milestoneTitle: milestone.title,
          currency: orderDetails.currency,
          grossAmount: orderDetails.amount,
          feeAmount: orderDetails.paypalFeeAmount,
          netMerchantAmount: orderDetails.netMerchantAmount,
          providerReference: orderDetails.captureId,
        },
        manager,
      );

      await this.completeFundingHelperTasks(manager, milestone, input.payerId);

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

    if (fundedProject) {
      this.emitProjectUpdated(fundedProject);
    }

    return result;
  }

  async createPayPalMilestoneOrder(
    input: CreatePayPalMilestoneOrderInputForFunding,
  ): Promise<{ orderId: string; status: string; vaultRequested: boolean }> {
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

      const project = await manager.getRepository(ProjectEntity).findOne({
        where: { id: escrow.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project ${escrow.projectId} not found`);
      }
      if (project.clientId !== input.payerId) {
        throw new ForbiddenException('Only the project client can fund a milestone');
      }

      this.assertProjectCanBeFunded(project);
      this.assertMilestoneCanBeFunded(milestone);
      this.assertEscrowCanBeFunded(escrow);
      this.assertMilestoneAmountMatchesEscrow(milestone, escrow);

      const paymentMethod = await manager.getRepository(PaymentMethodEntity).findOne({
        where: { id: input.paymentMethodId, userId: input.payerId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(`Payment method ${input.paymentMethodId} not found`);
      }
      if (paymentMethod.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
        throw new BadRequestException(
          'Only PAYPAL_ACCOUNT methods can start PayPal checkout',
        );
      }

      const amount = new Decimal(escrow.totalAmount || milestone.amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      const currency = escrow.currency || project.currency || 'USD';

      return this.payPalCheckoutService.createMilestoneOrder({
        milestoneId: milestone.id,
        payerId: input.payerId,
        paymentMethodId: paymentMethod.id,
        milestoneTitle: milestone.title,
        amount,
        currency,
        source: input.source,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      } satisfies CreatePayPalMilestoneOrderInput);
    });
  }

  async createStripeMilestoneCheckoutSession(
    input: CreateStripeMilestoneCheckoutInput,
  ): Promise<StripeCheckoutSessionView> {
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

      const project = await manager.getRepository(ProjectEntity).findOne({
        where: { id: escrow.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project ${escrow.projectId} not found`);
      }
      if (project.clientId !== input.payerId) {
        throw new ForbiddenException('Only the project client can fund a milestone');
      }

      this.assertProjectCanBeFunded(project);
      this.assertMilestoneCanBeFunded(milestone);
      this.assertEscrowCanBeFunded(escrow);
      this.assertMilestoneAmountMatchesEscrow(milestone, escrow);

      const paymentMethod = await manager.getRepository(PaymentMethodEntity).findOne({
        where: { id: input.paymentMethodId, userId: input.payerId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(`Payment method ${input.paymentMethodId} not found`);
      }
      if (paymentMethod.type !== PaymentMethodType.CARD_ACCOUNT) {
        throw new BadRequestException(
          'Only CARD_ACCOUNT methods can start Stripe card checkout',
        );
      }

      const payer = await manager.getRepository(UserEntity).findOne({
        where: { id: input.payerId },
      });

      const amount = new Decimal(escrow.totalAmount || milestone.amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      const currency = escrow.currency || project.currency || 'USD';

      return this.stripeCheckoutService.createMilestoneCheckoutSession({
        milestoneId: milestone.id,
        escrowId: escrow.id,
        projectId: project.id,
        payerId: input.payerId,
        paymentMethodId: paymentMethod.id,
        milestoneTitle: milestone.title,
        amount,
        currency,
        returnUrl: input.returnUrl,
        customerEmail: typeof payer?.email === 'string' ? payer.email : null,
      });
    });
  }

  async completeStripeMilestoneFunding(
    input: CompleteStripeMilestoneFundingInput,
  ): Promise<MilestoneFundingResult> {
    let sessionDetails: StripeCheckoutSessionDetails;
    try {
      sessionDetails = await this.stripeCheckoutService.retrieveCheckoutSession(input.sessionId);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw error;
    }

    const normalizedKey = sessionDetails.sessionId.trim();

    let fundedProject: Pick<
      ProjectEntity,
      'id' | 'requestId' | 'clientId' | 'brokerId' | 'freelancerId' | 'staffId'
    > | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
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
        this.assertExistingIntentMatchesInput(existingIntent, {
          milestoneId: input.milestoneId,
          payerId: input.payerId,
          paymentMethodId: input.paymentMethodId,
          gateway: FundingGateway.STRIPE,
          idempotencyKey: normalizedKey,
        });
        return this.buildExistingIntentResponse(manager, existingIntent, escrow, input.payerId);
      }

      const project = await manager.getRepository(ProjectEntity).findOne({
        where: { id: escrow.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project ${escrow.projectId} not found`);
      }
      fundedProject = project;
      if (project.clientId !== input.payerId) {
        throw new ForbiddenException('Only the project client can fund a milestone');
      }

      this.assertProjectCanBeFunded(project);
      this.assertMilestoneCanBeFunded(milestone);
      this.assertEscrowCanBeFunded(escrow);
      this.assertMilestoneAmountMatchesEscrow(milestone, escrow);
      this.assertStripeSessionMatchesEscrow(sessionDetails, escrow, project, input);

      const paymentMethod = await manager.getRepository(PaymentMethodEntity).findOne({
        where: { id: input.paymentMethodId, userId: input.payerId },
      });
      if (!paymentMethod) {
        throw new NotFoundException(`Payment method ${input.paymentMethodId} not found`);
      }
      if (paymentMethod.type !== PaymentMethodType.CARD_ACCOUNT) {
        throw new BadRequestException('Only CARD_ACCOUNT methods can complete Stripe checkout');
      }

      const fundingIntent = await manager.getRepository(FundingIntentEntity).save(
        manager.getRepository(FundingIntentEntity).create({
          milestoneId: milestone.id,
          payerId: input.payerId,
          paymentMethodId: paymentMethod.id,
          gateway: FundingGateway.STRIPE,
          amount: sessionDetails.amount,
          currency: sessionDetails.currency,
          status: FundingIntentStatus.PENDING,
          idempotencyKey: normalizedKey,
        }),
      );

      const gatewayResult: FundingGatewayResult = {
        providerReference: sessionDetails.paymentIntentId ?? sessionDetails.sessionId,
        nextAction: {
          type: 'STRIPE_CHECKOUT_COMPLETED',
          sessionId: sessionDetails.sessionId,
          paymentIntentId: sessionDetails.paymentIntentId,
          customerEmail: sessionDetails.customerEmail,
        },
      };

      const wallet = await this.walletService.getOrCreateWallet(
        input.payerId,
        sessionDetails.currency,
        manager,
      );
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
      escrow.fundedAmount = sessionDetails.amount;
      escrow.fundedAt = new Date();
      escrow.clientWalletId = wallet.id;
      escrow.holdTransactionId = holdTransaction.id;
      await manager.getRepository(EscrowEntity).save(escrow);

      fundingIntent.status = FundingIntentStatus.COMPLETED;
      fundingIntent.providerReference = gatewayResult.providerReference;
      fundingIntent.completedAt = new Date();
      await manager.getRepository(FundingIntentEntity).save(fundingIntent);

      await this.walletService.recordPlatformFundingMirror(
        {
          fundingIntentId: fundingIntent.id,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          escrowId: escrow.id,
          currency: sessionDetails.currency,
          amount: sessionDetails.amount,
          paymentMethod: paymentMethod.type,
          providerReference: gatewayResult.providerReference,
          gateway: fundingIntent.gateway,
          payerUserId: input.payerId,
          payerEmail: sessionDetails.customerEmail ?? null,
          depositTransactionId: depositTransaction.id,
          holdTransactionId: holdTransaction.id,
        },
        manager,
      );

      await this.completeFundingHelperTasks(manager, milestone, input.payerId);

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

    if (fundedProject) {
      this.emitProjectUpdated(fundedProject);
    }

    return result;
  }

  private emitProjectUpdated(
    project: Pick<
      ProjectEntity,
      'id' | 'requestId' | 'clientId' | 'brokerId' | 'freelancerId' | 'staffId'
    >,
  ): void {
    const userIds = Array.from(
      new Set(
        [
          project.clientId,
          project.brokerId,
          project.freelancerId,
          project.staffId,
        ].filter(Boolean),
      ),
    ) as string[];

    userIds.forEach((userId) => {
      this.eventEmitter.emit('project.updated', {
        userId,
        projectId: project.id,
        requestId: project.requestId ?? null,
        entityType: 'Project',
        entityId: project.id,
      });
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

  private async completeFundingHelperTasks(
    manager: EntityManager,
    milestone: MilestoneEntity,
    actorId: string,
  ): Promise<void> {
    const taskRepository = manager.getRepository(TaskEntity);
    const historyRepository = manager.getRepository(TaskHistoryEntity);
    const tasks = await taskRepository.find({
      where: { milestoneId: milestone.id },
    });

    const fundingHelperTasks = tasks.filter(
      (task) =>
        !task.parentTaskId
        && task.status !== TaskStatus.DONE
        && this.isFundingHelperTask(task),
    );

    if (fundingHelperTasks.length === 0) {
      return;
    }

    const completedAt = new Date();
    for (const task of fundingHelperTasks) {
      const previousStatus = task.status;
      task.status = TaskStatus.DONE;
      task.submittedAt = completedAt;
      await taskRepository.save(task);

      await historyRepository.save(
        historyRepository.create({
          taskId: task.id,
          actorId,
          fieldChanged: 'status',
          oldValue: previousStatus,
          newValue: TaskStatus.DONE,
          createdAt: completedAt,
        }),
      );
    }
  }

  private isFundingHelperTask(task: TaskEntity): boolean {
    const normalizedTitle = String(task.title || '').trim().toLowerCase();
    const normalizedDescription = String(task.description || '').trim().toLowerCase();

    return (
      normalizedTitle === 'capture paypal sandbox payment'
      || normalizedTitle === 'capture stripe checkout payment'
      || normalizedTitle === 'capture milestone funding payment'
      || normalizedDescription === 'fund the milestone in the browser using the saved paypal method.'
      || normalizedDescription === 'fund the milestone in the browser using the selected payment method.'
    );
  }

  private assertExistingIntentMatchesInput(
    fundingIntent: FundingIntentEntity,
    input: FundMilestoneInput,
  ): void {
    if (fundingIntent.paymentMethodId !== input.paymentMethodId) {
      throw new ConflictException(
        `Idempotency-Key ${input.idempotencyKey} is already bound to a different payment method`,
      );
    }

    if (fundingIntent.gateway !== input.gateway) {
      throw new ConflictException(
        `Idempotency-Key ${input.idempotencyKey} is already bound to a different gateway`,
      );
    }
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

  private assertProjectCanBeFunded(project: ProjectEntity): void {
    const nonFundableStatuses = new Set<ProjectStatus>([
      ProjectStatus.CANCELED,
      ProjectStatus.PAID,
      ProjectStatus.COMPLETED,
      ProjectStatus.DISPUTED,
    ]);

    if (nonFundableStatuses.has(project.status)) {
      throw new BadRequestException(
        `Cannot fund milestone while project is ${project.status}`,
      );
    }
  }

  private assertMilestoneCanBeFunded(milestone: MilestoneEntity): void {
    const nonFundableStatuses = new Set<MilestoneStatus>([
      MilestoneStatus.LOCKED,
      MilestoneStatus.COMPLETED,
      MilestoneStatus.PAID,
    ]);

    if (nonFundableStatuses.has(milestone.status)) {
      throw new BadRequestException(
        `Cannot fund milestone while milestone is ${milestone.status}`,
      );
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

  private extractCompletedPayPalOrder(
    order: Record<string, unknown>,
    milestoneId: string,
  ): {
    orderId: string;
    captureId: string;
    amount: number;
    currency: string;
    paypalFeeAmount: number;
    netMerchantAmount: number | null;
    payerEmail: string | null;
    payerId: string | null;
    vaultId: string | null;
    vaultStatus: string | null;
    customerId: string | null;
  } {
    const orderId = typeof order.id === 'string' ? order.id : null;
    if (!orderId) {
      throw new BadRequestException('PayPal order id is missing from capture payload');
    }

    const orderStatus =
      typeof order.status === 'string' ? order.status.toUpperCase() : null;
    if (orderStatus && orderStatus !== 'COMPLETED') {
      throw new ConflictException(`PayPal order ${orderId} is ${orderStatus}, not COMPLETED`);
    }

    const payer =
      order.payer && typeof order.payer === 'object'
        ? (order.payer as Record<string, unknown>)
        : null;
    const payerEmail =
      payer && typeof payer.email_address === 'string' ? payer.email_address : null;
    const payerId =
      payer && typeof payer.payer_id === 'string' ? payer.payer_id : null;

    const paymentSource =
      order.payment_source && typeof order.payment_source === 'object'
        ? (order.payment_source as Record<string, unknown>)
        : null;
    const paypalSource =
      paymentSource?.paypal && typeof paymentSource.paypal === 'object'
        ? (paymentSource.paypal as Record<string, unknown>)
        : null;
    const attributesSource =
      paypalSource?.attributes && typeof paypalSource.attributes === 'object'
        ? (paypalSource.attributes as Record<string, unknown>)
        : paypalSource?.attribute && typeof paypalSource.attribute === 'object'
          ? (paypalSource.attribute as Record<string, unknown>)
          : null;
    const vaultSource =
      attributesSource?.vault && typeof attributesSource.vault === 'object'
        ? (attributesSource.vault as Record<string, unknown>)
        : null;
    const vaultId =
      vaultSource && typeof vaultSource.id === 'string' ? vaultSource.id : null;
    const vaultStatus =
      vaultSource && typeof vaultSource.status === 'string' ? vaultSource.status : null;
    const customerSource =
      vaultSource?.customer && typeof vaultSource.customer === 'object'
        ? (vaultSource.customer as Record<string, unknown>)
        : null;
    const customerId =
      customerSource && typeof customerSource.id === 'string'
        ? customerSource.id
        : null;

    const purchaseUnits = Array.isArray(order.purchase_units)
      ? order.purchase_units
      : null;
    if (!purchaseUnits || purchaseUnits.length === 0) {
      throw new BadRequestException('PayPal order is missing purchase units');
    }

    const purchaseUnit =
      purchaseUnits[0] && typeof purchaseUnits[0] === 'object'
        ? (purchaseUnits[0] as Record<string, unknown>)
        : null;
    if (!purchaseUnit) {
      throw new BadRequestException('PayPal purchase unit payload is invalid');
    }

    const customId =
      typeof purchaseUnit.custom_id === 'string' ? purchaseUnit.custom_id : null;
    if (customId && customId !== milestoneId) {
      throw new ConflictException(
        `PayPal order ${orderId} is bound to milestone ${customId}, not ${milestoneId}`,
      );
    }

    const payments =
      purchaseUnit.payments && typeof purchaseUnit.payments === 'object'
        ? (purchaseUnit.payments as Record<string, unknown>)
        : null;
    const captures = payments && Array.isArray(payments.captures) ? payments.captures : null;
    if (!captures || captures.length === 0) {
      throw new BadRequestException('PayPal order is missing capture details');
    }

    const capture =
      captures[0] && typeof captures[0] === 'object'
        ? (captures[0] as Record<string, unknown>)
        : null;
    if (!capture) {
      throw new BadRequestException('PayPal capture payload is invalid');
    }

    const captureId = typeof capture.id === 'string' ? capture.id : null;
    if (!captureId) {
      throw new BadRequestException('PayPal capture id is missing');
    }

    const captureStatus =
      typeof capture.status === 'string' ? capture.status.toUpperCase() : null;
    if (captureStatus && captureStatus !== 'COMPLETED') {
      throw new ConflictException(
        `PayPal capture ${captureId} is ${captureStatus}, not COMPLETED`,
      );
    }

    const amountSource =
      capture.amount && typeof capture.amount === 'object'
        ? (capture.amount as Record<string, unknown>)
        : purchaseUnit.amount && typeof purchaseUnit.amount === 'object'
          ? (purchaseUnit.amount as Record<string, unknown>)
          : null;
    if (!amountSource) {
      throw new BadRequestException('PayPal amount details are missing');
    }

    const currency =
      typeof amountSource.currency_code === 'string' ? amountSource.currency_code : null;
    const value = typeof amountSource.value === 'string' ? amountSource.value : null;
    if (!currency || !value) {
      throw new BadRequestException('PayPal amount payload is incomplete');
    }

    const amount = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

    const receivableBreakdown =
      capture.seller_receivable_breakdown
      && typeof capture.seller_receivable_breakdown === 'object'
        ? (capture.seller_receivable_breakdown as Record<string, unknown>)
        : null;
    const paypalFeeSource =
      receivableBreakdown?.paypal_fee && typeof receivableBreakdown.paypal_fee === 'object'
        ? (receivableBreakdown.paypal_fee as Record<string, unknown>)
        : null;
    const netAmountSource =
      receivableBreakdown?.net_amount && typeof receivableBreakdown.net_amount === 'object'
        ? (receivableBreakdown.net_amount as Record<string, unknown>)
        : null;

    const paypalFeeValue =
      paypalFeeSource && typeof paypalFeeSource.value === 'string'
        ? new Decimal(paypalFeeSource.value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
        : 0;
    const netMerchantAmount =
      netAmountSource && typeof netAmountSource.value === 'string'
        ? new Decimal(netAmountSource.value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
        : null;

    return {
      orderId,
      captureId,
      amount,
      currency,
      paypalFeeAmount: paypalFeeValue,
      netMerchantAmount,
      payerEmail,
      payerId,
      vaultId,
      vaultStatus,
      customerId,
    };
  }

  private async syncPayPalMethodVaultMetadata(
    manager: EntityManager,
    paymentMethod: PaymentMethodEntity,
    orderDetails: {
      payerEmail: string | null;
      payerId: string | null;
      orderId: string;
      captureId: string;
      vaultId: string | null;
      vaultStatus: string | null;
      customerId: string | null;
    },
  ): Promise<void> {
    const existingMetadata =
      paymentMethod.metadata && typeof paymentMethod.metadata === 'object'
        ? paymentMethod.metadata
        : {};
    const existingVault =
      existingMetadata.paypalVault && typeof existingMetadata.paypalVault === 'object'
        ? (existingMetadata.paypalVault as Record<string, unknown>)
        : {};

    paymentMethod.paypalEmail = orderDetails.payerEmail ?? paymentMethod.paypalEmail;
    paymentMethod.metadata = {
      ...existingMetadata,
      paypalVault: {
        ...existingVault,
        customerId: orderDetails.customerId ?? existingVault.customerId ?? null,
        vaultId: orderDetails.vaultId ?? existingVault.vaultId ?? null,
        payerId: orderDetails.payerId ?? existingVault.payerId ?? null,
        payerEmail: orderDetails.payerEmail ?? existingVault.payerEmail ?? null,
        status: orderDetails.vaultStatus ?? existingVault.status ?? null,
        lastOrderId: orderDetails.orderId,
        lastCaptureId: orderDetails.captureId,
        lastCapturedAt: new Date().toISOString(),
      },
    };

    if (orderDetails.payerEmail || orderDetails.customerId || orderDetails.vaultId) {
      paymentMethod.isVerified = true;
      paymentMethod.verifiedAt = paymentMethod.verifiedAt ?? new Date();
    }

    await manager.getRepository(PaymentMethodEntity).save(paymentMethod);
  }

  private assertPayPalOrderMatchesEscrow(
    orderDetails: { amount: number; currency: string },
    escrow: EscrowEntity,
    project: ProjectEntity,
  ): void {
    const expectedAmount = new Decimal(escrow.totalAmount || 0).toDecimalPlaces(2);
    const capturedAmount = new Decimal(orderDetails.amount || 0).toDecimalPlaces(2);
    if (!expectedAmount.equals(capturedAmount)) {
      throw new ConflictException('Captured PayPal amount does not match escrow totalAmount');
    }

    const expectedCurrency = escrow.currency || project.currency || 'USD';
    if (orderDetails.currency !== expectedCurrency) {
      throw new ConflictException('Captured PayPal currency does not match milestone currency');
    }
  }

  private assertStripeSessionMatchesEscrow(
    sessionDetails: StripeCheckoutSessionDetails,
    escrow: EscrowEntity,
    project: ProjectEntity,
    input: CompleteStripeMilestoneFundingInput,
  ): void {
    if (sessionDetails.status && sessionDetails.status !== 'complete') {
      throw new ConflictException(
        `Stripe Checkout session ${sessionDetails.sessionId} is ${sessionDetails.status}, not complete`,
      );
    }

    if (sessionDetails.paymentStatus !== 'paid') {
      throw new ConflictException(
        `Stripe Checkout session ${sessionDetails.sessionId} is ${sessionDetails.paymentStatus ?? 'unpaid'}, not paid`,
      );
    }

    const metadataMilestoneId = sessionDetails.metadata.milestoneId;
    if (metadataMilestoneId && metadataMilestoneId !== input.milestoneId) {
      throw new ConflictException(
        `Stripe Checkout session ${sessionDetails.sessionId} is bound to milestone ${metadataMilestoneId}, not ${input.milestoneId}`,
      );
    }

    const metadataPaymentMethodId = sessionDetails.metadata.paymentMethodId;
    if (metadataPaymentMethodId && metadataPaymentMethodId !== input.paymentMethodId) {
      throw new ConflictException(
        `Stripe Checkout session ${sessionDetails.sessionId} is bound to a different payment method`,
      );
    }

    const metadataPayerId = sessionDetails.metadata.payerId;
    if (metadataPayerId && metadataPayerId !== input.payerId) {
      throw new ConflictException(
        `Stripe Checkout session ${sessionDetails.sessionId} is bound to a different payer`,
      );
    }

    const expectedAmount = new Decimal(escrow.totalAmount || 0).toDecimalPlaces(2);
    const paidAmount = new Decimal(sessionDetails.amount || 0).toDecimalPlaces(2);
    if (!expectedAmount.equals(paidAmount)) {
      throw new ConflictException('Paid Stripe amount does not match escrow totalAmount');
    }

    const expectedCurrency = (escrow.currency || project.currency || 'USD').toUpperCase();
    if (sessionDetails.currency.toUpperCase() !== expectedCurrency) {
      throw new ConflictException('Paid Stripe currency does not match milestone currency');
    }
  }
}
