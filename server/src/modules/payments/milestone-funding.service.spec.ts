import { BadRequestException, ConflictException, ForbiddenException, NotImplementedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
  TaskEntity,
  TaskHistoryEntity,
  TaskStatus,
  TransactionEntity,
  UserEntity,
  WalletEntity,
  WalletStatus,
} from '../../database/entities';
import { InternalSandboxGateway } from './internal-sandbox.gateway';
import { MilestoneFundingService } from './milestone-funding.service';
import { PayPalCheckoutService } from './pay-pal-checkout.service';
import { StripeCheckoutService } from './stripe-checkout.service';
import { WalletService } from './wallet.service';

const createQueryBuilderMock = (result: unknown) => ({
  setLock: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
});

describe('MilestoneFundingService', () => {
  let service: MilestoneFundingService;
  const wallet = {
    id: 'wallet-1',
    userId: 'client-1',
    balance: 0,
    pendingBalance: 0,
    heldBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalEarned: 0,
    totalSpent: 0,
    currency: 'USD',
    status: WalletStatus.ACTIVE,
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T00:00:00.000Z'),
  } as WalletEntity;

  const walletServiceMock = {
    getOrCreateWallet: jest.fn(),
    toWalletSnapshot: jest.fn(),
    recordPlatformFundingMirror: jest.fn(),
    recordPlatformGatewayFee: jest.fn(),
  };
  const internalSandboxGatewayMock = {
    gateway: FundingGateway.INTERNAL_SANDBOX,
    fund: jest.fn(),
  };
  const payPalCheckoutServiceMock = {
    createMilestoneOrder: jest.fn(),
    captureOrder: jest.fn(),
  };
  const stripeCheckoutServiceMock = {
    createMilestoneCheckoutSession: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
  };
  const eventEmitterMock = {
    emit: jest.fn(),
  };

  const fundingIntentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data) => data),
  };
  const milestoneRepo = {
    findOne: jest.fn(),
  };
  const escrowRepo = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const projectRepo = {
    findOne: jest.fn(),
  };
  const paymentMethodRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const walletRepo = {
    save: jest.fn(),
  };
  const taskRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };
  const taskHistoryRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(),
  };
  const transactionRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(),
    find: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === FundingIntentEntity) return fundingIntentRepo;
      if (entity === MilestoneEntity) return milestoneRepo;
      if (entity === EscrowEntity) return escrowRepo;
      if (entity === ProjectEntity) return projectRepo;
      if (entity === PaymentMethodEntity) return paymentMethodRepo;
      if (entity === WalletEntity) return walletRepo;
      if (entity === TaskEntity) return taskRepo;
      if (entity === TaskHistoryEntity) return taskHistoryRepo;
      if (entity === TransactionEntity) return transactionRepo;
      throw new Error(`Unexpected repository ${entity?.name}`);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    wallet.balance = 0;
    wallet.heldBalance = 0;
    wallet.totalDeposited = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestoneFundingService,
        {
          provide: getRepositoryToken(FundingIntentEntity),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((callback) => callback(manager)),
          },
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
        {
          provide: WalletService,
          useValue: walletServiceMock,
        },
        {
          provide: InternalSandboxGateway,
          useValue: internalSandboxGatewayMock,
        },
        {
          provide: PayPalCheckoutService,
          useValue: payPalCheckoutServiceMock,
        },
        {
          provide: StripeCheckoutService,
          useValue: stripeCheckoutServiceMock,
        },
      ],
    }).compile();

    service = module.get(MilestoneFundingService);

    milestoneRepo.findOne.mockResolvedValue({
      id: 'milestone-1',
      amount: 100,
      title: 'Kickoff',
    } as MilestoneEntity);
    escrowRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'escrow-1',
        milestoneId: 'milestone-1',
        projectId: 'project-1',
        totalAmount: 100,
        fundedAmount: 0,
        status: EscrowStatus.PENDING,
        currency: 'USD',
      } as EscrowEntity),
    );
    fundingIntentRepo.findOne.mockResolvedValue(null);
    fundingIntentRepo.save.mockImplementation(async (value) =>
      value.id ? value : { ...value, id: 'intent-1' },
    );
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      clientId: 'client-1',
      currency: 'USD',
    } as ProjectEntity);
    paymentMethodRepo.findOne.mockResolvedValue({
      id: 'method-1',
      userId: 'client-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      paypalEmail: 'client@example.com',
      metadata: null,
      isVerified: false,
      verifiedAt: null,
    } as PaymentMethodEntity);
    paymentMethodRepo.save.mockImplementation(async (value) => value);
    walletServiceMock.getOrCreateWallet.mockResolvedValue(wallet);
    walletServiceMock.toWalletSnapshot.mockImplementation((value: WalletEntity) => ({
      id: value.id,
      userId: value.userId,
      availableBalance: value.balance,
      pendingBalance: value.pendingBalance,
      heldBalance: value.heldBalance,
      totalDeposited: value.totalDeposited,
      totalWithdrawn: value.totalWithdrawn,
      totalEarned: value.totalEarned,
      totalSpent: value.totalSpent,
      currency: value.currency,
      status: value.status,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    }));
    walletServiceMock.recordPlatformFundingMirror.mockResolvedValue(null);
    walletServiceMock.recordPlatformGatewayFee.mockResolvedValue(null);
    internalSandboxGatewayMock.fund.mockResolvedValue({
      providerReference: 'sandbox:intent-1',
      nextAction: null,
    });
    payPalCheckoutServiceMock.createMilestoneOrder.mockResolvedValue({
      orderId: 'PAYPAL-ORDER-NEW',
      status: 'PAYER_ACTION_REQUIRED',
      vaultRequested: true,
    });
    payPalCheckoutServiceMock.captureOrder.mockResolvedValue({
      id: 'PAYPAL-ORDER-FETCHED',
      status: 'COMPLETED',
      payer: {
        email_address: 'buyer-sandbox@example.com',
        payer_id: 'BUYER123',
      },
      payment_source: {
        paypal: {
          attributes: {
            vault: {
              id: 'vault-1',
              status: 'VAULTED',
              customer: {
                id: 'customer-1',
              },
            },
          },
        },
      },
      purchase_units: [
        {
          custom_id: 'milestone-1',
          amount: {
            currency_code: 'USD',
            value: '100.00',
          },
          payments: {
            captures: [
              {
                id: 'CAPTURE-1',
                status: 'COMPLETED',
                amount: {
                  currency_code: 'USD',
                  value: '100.00',
                },
              },
            ],
          },
        },
      ],
    });
    stripeCheckoutServiceMock.createMilestoneCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    stripeCheckoutServiceMock.retrieveCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_123',
      status: 'complete',
      paymentStatus: 'paid',
      amount: 100,
      currency: 'USD',
      paymentIntentId: 'pi_123',
      customerEmail: 'client@example.com',
      metadata: {
        milestoneId: 'milestone-1',
        paymentMethodId: 'card-method-1',
        payerId: 'client-1',
      },
    });
    walletRepo.save.mockImplementation(async (value) => value);
    taskRepo.find.mockResolvedValue([]);
    taskRepo.save.mockImplementation(async (value) => value);
    taskHistoryRepo.save.mockImplementation(async (value) => value);
    transactionRepo.save.mockImplementation(async (value) => {
      if (!value.id) {
        if (value.type === 'DEPOSIT') {
          return { ...value, id: 'tx-deposit' };
        }
        return { ...value, id: 'tx-hold' };
      }
      return value;
    });
  });

  it('funds a milestone successfully with one deposit and one hold transaction', async () => {
    const result = await service.fundMilestone({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      idempotencyKey: 'idem-1',
    });

    expect(result).toMatchObject({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: EscrowStatus.FUNDED,
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
    });
    expect(result.walletSnapshot.availableBalance).toBe(0);
    expect(result.walletSnapshot.heldBalance).toBe(100);
    expect(result.walletSnapshot.totalDeposited).toBe(100);
    expect(internalSandboxGatewayMock.fund).toHaveBeenCalled();
  });

  it('funds a milestone with a saved card method through the sandbox flow', async () => {
    paymentMethodRepo.findOne.mockResolvedValue({
      id: 'card-method-1',
      userId: 'client-1',
      type: PaymentMethodType.CARD_ACCOUNT,
      cardBrand: 'Visa',
      cardLast4: '4242',
      metadata: null,
    } as PaymentMethodEntity);

    const result = await service.fundMilestone({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'card-method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      idempotencyKey: 'idem-card-1',
    });

    expect(result).toMatchObject({
      fundingIntentId: 'intent-1',
      escrowStatus: EscrowStatus.FUNDED,
      gateway: FundingGateway.INTERNAL_SANDBOX,
    });
    expect(internalSandboxGatewayMock.fund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethodId: 'card-method-1' }),
      expect.objectContaining({ type: PaymentMethodType.CARD_ACCOUNT }),
      expect.any(Object),
    );
  });

  it('creates a Stripe Checkout Session for a saved card method', async () => {
    paymentMethodRepo.findOne.mockResolvedValue({
      id: 'card-method-1',
      userId: 'client-1',
      type: PaymentMethodType.CARD_ACCOUNT,
      cardBrand: 'Visa',
      cardLast4: '4242',
      metadata: null,
    } as PaymentMethodEntity);
    manager.getRepository.mockImplementation((entity) => {
      if (entity === FundingIntentEntity) return fundingIntentRepo;
      if (entity === MilestoneEntity) return milestoneRepo;
      if (entity === EscrowEntity) return escrowRepo;
      if (entity === ProjectEntity) return projectRepo;
      if (entity === PaymentMethodEntity) return paymentMethodRepo;
      if (entity === WalletEntity) return walletRepo;
      if (entity === TaskEntity) return taskRepo;
      if (entity === TaskHistoryEntity) return taskHistoryRepo;
      if (entity === TransactionEntity) return transactionRepo;
      if (entity === UserEntity) {
        return {
          findOne: jest.fn().mockResolvedValue({
            id: 'client-1',
            email: 'client@example.com',
          }),
        };
      }
      throw new Error(`Unexpected repository ${entity?.name}`);
    });

    const result = await service.createStripeMilestoneCheckoutSession({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'card-method-1',
      gateway: FundingGateway.STRIPE,
      returnUrl:
        'https://localhost:5173/client/workspace/project-1?view=board&milestone=milestone-1',
    });

    expect(result).toEqual({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    expect(stripeCheckoutServiceMock.createMilestoneCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        milestoneId: 'milestone-1',
        paymentMethodId: 'card-method-1',
        customerEmail: 'client@example.com',
      }),
    );
  });

  it('completes a paid Stripe Checkout Session and syncs it into escrow', async () => {
    taskRepo.find.mockResolvedValue([
      {
        id: 'task-funding-1',
        milestoneId: 'milestone-1',
        parentTaskId: null,
        title: 'Capture Stripe Checkout payment',
        description: 'Fund the milestone in the browser using the selected payment method.',
        status: TaskStatus.TODO,
        submittedAt: null,
      } as TaskEntity,
    ]);
    paymentMethodRepo.findOne.mockResolvedValue({
      id: 'card-method-1',
      userId: 'client-1',
      type: PaymentMethodType.CARD_ACCOUNT,
      cardBrand: 'Visa',
      cardLast4: '4242',
      metadata: null,
    } as PaymentMethodEntity);

    const result = await service.completeStripeMilestoneFunding({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'card-method-1',
      gateway: FundingGateway.STRIPE,
      sessionId: 'cs_test_123',
    });

    expect(result).toMatchObject({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      escrowStatus: EscrowStatus.FUNDED,
      gateway: FundingGateway.STRIPE,
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
      nextAction: {
        type: 'STRIPE_CHECKOUT_COMPLETED',
        sessionId: 'cs_test_123',
        paymentIntentId: 'pi_123',
        customerEmail: 'client@example.com',
      },
    });
    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-funding-1',
        status: TaskStatus.DONE,
      }),
    );
  });

  it('completes a captured PayPal order and syncs it into escrow', async () => {
    taskRepo.find.mockResolvedValue([
      {
        id: 'task-funding-1',
        milestoneId: 'milestone-1',
        parentTaskId: null,
        title: 'Capture PayPal Sandbox payment',
        description: 'Fund the milestone in the browser using the saved PayPal method.',
        status: TaskStatus.TODO,
        submittedAt: null,
      } as TaskEntity,
    ]);

    const result = await service.completePayPalMilestoneFunding({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.PAYPAL,
      order: {
        id: 'PAYPAL-ORDER-1',
        status: 'COMPLETED',
      payer: {
        email_address: 'buyer-sandbox@example.com',
        payer_id: 'BUYER123',
      },
      payment_source: {
        paypal: {
          attributes: {
            vault: {
              id: 'vault-1',
              status: 'VAULTED',
              customer: {
                id: 'customer-1',
              },
            },
          },
        },
      },
      purchase_units: [
          {
            custom_id: 'milestone-1',
            amount: {
              currency_code: 'USD',
              value: '100.00',
            },
            payments: {
              captures: [
                {
                  id: 'CAPTURE-1',
                  status: 'COMPLETED',
                  amount: {
                    currency_code: 'USD',
                    value: '100.00',
                  },
                  seller_receivable_breakdown: {
                    paypal_fee: {
                      currency_code: 'USD',
                      value: '3.80',
                    },
                    net_amount: {
                      currency_code: 'USD',
                      value: '96.20',
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      escrowStatus: EscrowStatus.FUNDED,
      gateway: FundingGateway.PAYPAL,
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
      nextAction: {
        type: 'PAYPAL_CAPTURE_COMPLETED',
        orderId: 'PAYPAL-ORDER-1',
        captureId: 'CAPTURE-1',
        payerEmail: 'buyer-sandbox@example.com',
      },
    });

    expect(internalSandboxGatewayMock.fund).not.toHaveBeenCalled();
    expect(taskRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-funding-1',
        status: TaskStatus.DONE,
      }),
    );
    expect(taskHistoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-funding-1',
        actorId: 'client-1',
        fieldChanged: 'status',
        oldValue: TaskStatus.TODO,
        newValue: TaskStatus.DONE,
      }),
    );
    expect(paymentMethodRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        paypalEmail: 'buyer-sandbox@example.com',
        isVerified: true,
        metadata: expect.objectContaining({
          paypalVault: expect.objectContaining({
            customerId: 'customer-1',
            vaultId: 'vault-1',
            status: 'VAULTED',
          }),
        }),
      }),
    );
    expect(walletServiceMock.recordPlatformGatewayFee).toHaveBeenCalledWith(
      expect.objectContaining({
        fundingIntentId: 'intent-1',
        milestoneId: 'milestone-1',
        escrowId: 'escrow-1',
        feeAmount: 3.8,
        grossAmount: 100,
        netMerchantAmount: 96.2,
        providerReference: 'CAPTURE-1',
      }),
      manager,
    );
    expect(walletServiceMock.recordPlatformFundingMirror).toHaveBeenCalledWith(
      expect.objectContaining({
        fundingIntentId: 'intent-1',
        milestoneId: 'milestone-1',
        milestoneTitle: 'Kickoff',
        escrowId: 'escrow-1',
        amount: 100,
        paymentMethod: PaymentMethodType.PAYPAL_ACCOUNT,
        providerReference: 'CAPTURE-1',
        gateway: FundingGateway.PAYPAL,
        payerUserId: 'client-1',
        payerEmail: 'buyer-sandbox@example.com',
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      }),
      manager,
    );
  });

  it('creates a PayPal order through the server-side checkout service', async () => {
    const result = await service.createPayPalMilestoneOrder({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.PAYPAL,
      source: 'paypal',
      returnUrl: 'https://localhost:5173/client/workspace/project-1',
      cancelUrl: 'https://localhost:5173/client/workspace/project-1',
    });

    expect(result).toEqual({
      orderId: 'PAYPAL-ORDER-NEW',
      status: 'PAYER_ACTION_REQUIRED',
      vaultRequested: true,
    });
    expect(payPalCheckoutServiceMock.createMilestoneOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        milestoneId: 'milestone-1',
        paymentMethodId: 'method-1',
        amount: 100,
        currency: 'USD',
      }),
    );
  });

  it('captures a PayPal order by order id through the server-side checkout service', async () => {
    const result = await service.completePayPalMilestoneFunding({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.PAYPAL,
      orderId: 'PAYPAL-ORDER-FETCHED',
    });

    expect(payPalCheckoutServiceMock.captureOrder).toHaveBeenCalledWith('PAYPAL-ORDER-FETCHED');
    expect(result.nextAction).toMatchObject({
      type: 'PAYPAL_CAPTURE_COMPLETED',
      orderId: 'PAYPAL-ORDER-FETCHED',
      captureId: 'CAPTURE-1',
      payerEmail: 'buyer-sandbox@example.com',
    });
  });

  it('replays a completed funding intent idempotently', async () => {
    fundingIntentRepo.findOne.mockResolvedValue({
      id: 'intent-1',
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      amount: 100,
      currency: 'USD',
      status: FundingIntentStatus.COMPLETED,
      idempotencyKey: 'idem-1',
    } as FundingIntentEntity);
    transactionRepo.find.mockResolvedValue([
      { id: 'tx-deposit', type: 'DEPOSIT' },
      { id: 'tx-hold', type: 'ESCROW_HOLD' },
    ]);

    const result = await service.fundMilestone({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      idempotencyKey: 'idem-1',
    });

    expect(result.transactions.depositTransactionId).toBe('tx-deposit');
    expect(result.nextAction).toMatchObject({ type: 'IDEMPOTENT_REPLAY' });
    expect(internalSandboxGatewayMock.fund).not.toHaveBeenCalled();
  });

  it('rejects idempotency key reuse when the payment method changes', async () => {
    fundingIntentRepo.findOne.mockResolvedValue({
      id: 'intent-1',
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      amount: 100,
      currency: 'USD',
      status: FundingIntentStatus.COMPLETED,
      idempotencyKey: 'idem-1',
    } as FundingIntentEntity);

    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'client-1',
        paymentMethodId: 'method-2',
        gateway: FundingGateway.INTERNAL_SANDBOX,
        idempotencyKey: 'idem-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects bank methods for milestone funding', async () => {
    paymentMethodRepo.findOne.mockResolvedValue({
      id: 'method-1',
      userId: 'client-1',
      type: PaymentMethodType.BANK_ACCOUNT,
    } as PaymentMethodEntity);

    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'client-1',
        paymentMethodId: 'method-1',
        gateway: FundingGateway.INTERNAL_SANDBOX,
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-client users', async () => {
    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'someone-else',
        paymentMethodId: 'method-1',
        gateway: FundingGateway.INTERNAL_SANDBOX,
        idempotencyKey: 'idem-3',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unsupported gateways until adapters are wired', async () => {
    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'client-1',
        paymentMethodId: 'method-1',
        gateway: FundingGateway.PAYPAL,
        idempotencyKey: 'idem-4',
      }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('rejects escrow that is already funded', async () => {
    escrowRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'escrow-1',
        milestoneId: 'milestone-1',
        projectId: 'project-1',
        totalAmount: 100,
        fundedAmount: 100,
        status: EscrowStatus.FUNDED,
        currency: 'USD',
      } as EscrowEntity),
    );

    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'client-1',
        paymentMethodId: 'method-1',
        gateway: FundingGateway.INTERNAL_SANDBOX,
        idempotencyKey: 'idem-5',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects disputed escrow funding attempts', async () => {
    escrowRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'escrow-1',
        milestoneId: 'milestone-1',
        projectId: 'project-1',
        totalAmount: 100,
        fundedAmount: 100,
        status: EscrowStatus.DISPUTED,
        currency: 'USD',
      } as EscrowEntity),
    );

    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'client-1',
        paymentMethodId: 'method-1',
        gateway: FundingGateway.INTERNAL_SANDBOX,
        idempotencyKey: 'idem-disputed',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects mismatched milestone and escrow amounts', async () => {
    milestoneRepo.findOne.mockResolvedValue({
      id: 'milestone-1',
      amount: 150,
      title: 'Kickoff',
    } as MilestoneEntity);

    await expect(
      service.fundMilestone({
        milestoneId: 'milestone-1',
        payerId: 'client-1',
        paymentMethodId: 'method-1',
        gateway: FundingGateway.INTERNAL_SANDBOX,
        idempotencyKey: 'idem-6',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
