import { BadRequestException, ConflictException, ForbiddenException, NotImplementedException } from '@nestjs/common';
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
  TransactionEntity,
  WalletEntity,
  WalletStatus,
} from '../../database/entities';
import { InternalSandboxGateway } from './internal-sandbox.gateway';
import { MilestoneFundingService } from './milestone-funding.service';
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
  };
  const internalSandboxGatewayMock = {
    gateway: FundingGateway.INTERNAL_SANDBOX,
    fund: jest.fn(),
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
  };
  const walletRepo = {
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
          provide: WalletService,
          useValue: walletServiceMock,
        },
        {
          provide: InternalSandboxGateway,
          useValue: internalSandboxGatewayMock,
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
    } as PaymentMethodEntity);
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
    internalSandboxGatewayMock.fund.mockResolvedValue({
      providerReference: 'sandbox:intent-1',
      nextAction: null,
    });
    walletRepo.save.mockImplementation(async (value) => value);
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
