import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EscrowEntity,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  UserRole,
  UserStatus,
  WalletEntity,
  WalletStatus,
} from '../../database/entities';
import { PayPalPayoutsGateway } from './pay-pal-payouts.gateway';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepository: jest.Mocked<Repository<WalletEntity>>;
  let transactionRepository: jest.Mocked<Repository<TransactionEntity>>;
  let escrowRepository: jest.Mocked<Repository<EscrowEntity>>;
  let userRepository: jest.Mocked<Repository<UserEntity>>;
  let escrowQueryBuilder: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawOne: jest.Mock;
  };
  const payPalPayoutsGateway = {
    getMerchantBalance: jest.fn(),
  };

  beforeEach(async () => {
    escrowQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(WalletEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((data) => data),
          },
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: {
            findAndCount: jest.fn(),
            findBy: jest.fn(),
            create: jest.fn((data) => data),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EscrowEntity),
          useValue: {
            createQueryBuilder: jest.fn(() => escrowQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PayPalPayoutsGateway,
          useValue: payPalPayoutsGateway,
        },
      ],
    }).compile();

    service = module.get(WalletService);
    walletRepository = module.get(getRepositoryToken(WalletEntity));
    transactionRepository = module.get(getRepositoryToken(TransactionEntity));
    escrowRepository = module.get(getRepositoryToken(EscrowEntity));
    userRepository = module.get(getRepositoryToken(UserEntity));
    payPalPayoutsGateway.getMerchantBalance.mockResolvedValue({
      provider: 'PAYPAL',
      environment: 'sandbox',
      status: 'UNAVAILABLE',
      checkedAt: new Date('2026-03-27T00:00:00.000Z'),
      message: 'Unavailable in tests',
      errorCode: 'TEST',
      balances: [],
    });
  });

  it('creates a wallet when none exists', async () => {
    walletRepository.findOne.mockResolvedValueOnce(null);
    walletRepository.save.mockImplementation(async (wallet) => ({
      id: 'wallet-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      ...wallet,
    }));

    const result = await service.getWalletSnapshot('user-1');

    expect(walletRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
    });
    expect(result).toMatchObject({
      id: 'wallet-1',
      userId: 'user-1',
      availableBalance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      awaitingReleaseAmount: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
    });
  });

  it('lists wallet transactions with pagination metadata', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 10,
      pendingBalance: 5,
      heldBalance: 25,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    transactionRepository.findAndCount.mockResolvedValueOnce([
      [
        {
          id: 'tx-1',
          walletId: 'wallet-1',
          amount: 100,
          fee: 0,
          netAmount: 100,
          currency: 'USD',
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          referenceType: 'FundingIntent',
          referenceId: 'intent-1',
          paymentMethod: 'PAYPAL_ACCOUNT',
          externalTransactionId: 'sandbox:intent-1',
          balanceAfter: 100,
          description: 'Deposit',
          failureReason: null,
          metadata: { stage: 'deposit' },
          relatedTransactionId: null,
          createdAt: new Date('2026-03-13T00:00:00.000Z'),
          completedAt: new Date('2026-03-13T00:00:00.000Z'),
        } as TransactionEntity,
      ],
      1,
    ]);

    const result = await service.listTransactions('user-1', 1, 10);

    expect(result.total).toBe(1);
    expect(result.wallet.availableBalance).toBe(10);
    expect(result.wallet.awaitingReleaseAmount).toBe(0);
    expect(result.items[0]).toMatchObject({
      id: 'tx-1',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
    });
  });

  it('enriches release recipient rows with shared release breakdown metadata', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-freelancer',
      userId: 'freelancer-1',
      balance: 85,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 85,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    transactionRepository.findAndCount.mockResolvedValueOnce([
      [
        {
          id: 'tx-freelancer',
          walletId: 'wallet-freelancer',
          amount: 85,
          fee: 0,
          netAmount: 85,
          currency: 'USD',
          type: TransactionType.ESCROW_RELEASE,
          status: TransactionStatus.COMPLETED,
          referenceType: 'Escrow',
          referenceId: 'escrow-1',
          paymentMethod: null,
          externalTransactionId: null,
          balanceAfter: 85,
          description: 'Milestone payout for "Kickoff"',
          failureReason: null,
          metadata: {
            milestoneId: 'milestone-1',
            role: 'FREELANCER',
            sourceWalletId: 'wallet-client',
          },
          relatedTransactionId: 'tx-client',
          createdAt: new Date('2026-03-13T00:00:00.000Z'),
          completedAt: new Date('2026-03-13T00:00:00.000Z'),
        } as TransactionEntity,
      ],
      1,
    ]);
    transactionRepository.findBy.mockResolvedValueOnce([
      {
        id: 'tx-client',
        walletId: 'wallet-client',
        amount: 100,
        fee: 0,
        netAmount: 100,
        currency: 'USD',
        type: TransactionType.ESCROW_RELEASE,
        status: TransactionStatus.COMPLETED,
        referenceType: 'Escrow',
        referenceId: 'escrow-1',
        paymentMethod: null,
        externalTransactionId: null,
        balanceAfter: 0,
        description: 'Escrow released for milestone "Kickoff"',
        failureReason: null,
        metadata: {
          milestoneId: 'milestone-1',
          projectId: 'project-1',
          stage: 'release_full',
          releaseAmount: 100,
          developerAmount: 85,
          brokerAmount: 10,
          platformFee: 5,
          retainedBalanceAfterRelease: 0,
        },
        relatedTransactionId: null,
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        completedAt: new Date('2026-03-13T00:00:00.000Z'),
      } as TransactionEntity,
    ]);

    const result = await service.listTransactions('freelancer-1', 1, 10);

    expect(transactionRepository.findBy).toHaveBeenCalledTimes(1);
    expect(result.items[0]).toMatchObject({
      id: 'tx-freelancer',
      metadata: expect.objectContaining({
        role: 'FREELANCER',
        stage: 'release_full',
        releaseAmount: 100,
        developerAmount: 85,
        brokerAmount: 10,
        platformFee: 5,
      }),
    });
  });

  it('normalizes invalid paging input and applies the requested range filter', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 10,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    transactionRepository.findAndCount.mockResolvedValueOnce([[], 0]);

    const result = await service.listTransactions('user-1', 0, 250, '30d');

    expect(transactionRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
        where: expect.objectContaining({
          walletId: 'wallet-1',
          createdAt: expect.anything(),
        }),
      }),
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  it('normalizes invalid pagination inputs before querying wallet transactions', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 10,
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
    } as WalletEntity);
    transactionRepository.findAndCount.mockResolvedValueOnce([[], 0]);

    const result = await service.listTransactions('user-1', 0, 999);

    expect(transactionRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  it('applies the requested date range when listing wallet transactions', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 10,
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
    } as WalletEntity);
    transactionRepository.findAndCount.mockResolvedValueOnce([[], 0]);

    await service.listTransactions('user-1', 2, 20, '30d');

    expect(transactionRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          walletId: 'wallet-1',
          createdAt: expect.anything(),
        }),
        skip: 20,
        take: 20,
      }),
    );
  });

  it('returns the platform treasury wallet using the earliest active admin/staff owner', async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'platform@example.com',
      fullName: 'Platform Owner',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    } as UserEntity);
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-platform',
      userId: 'admin-1',
      balance: 25,
      pendingBalance: 5,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 10,
      totalEarned: 35,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);

    const result = await service.getPlatformWalletSnapshot();

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: [
        { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        { role: UserRole.STAFF, status: UserStatus.ACTIVE },
      ],
      order: { createdAt: 'ASC' },
    });
    expect(result.owner).toMatchObject({
      id: 'admin-1',
      email: 'platform@example.com',
      fullName: 'Platform Owner',
      role: UserRole.ADMIN,
    });
    expect(result.wallet).toMatchObject({
      id: 'wallet-platform',
      userId: 'admin-1',
      availableBalance: 25,
      pendingBalance: 5,
      awaitingReleaseAmount: 0,
      totalEarned: 35,
    });
    expect(result.merchantBalance).toMatchObject({
      provider: 'PAYPAL',
      status: 'UNAVAILABLE',
      errorCode: 'TEST',
    });
  });

  it('records a PayPal gateway fee against the platform wallet', async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'platform@example.com',
      fullName: 'Platform Owner',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    } as UserEntity);
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-platform',
      userId: 'admin-1',
      balance: 55,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 55,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    walletRepository.save.mockImplementation(async (value) => value as WalletEntity);
    transactionRepository.save.mockImplementation(async (value) => ({
      id: 'tx-fee-1',
      ...value,
    }) as TransactionEntity);

    const transaction = await service.recordPlatformGatewayFee({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      milestoneTitle: 'Kickoff',
      currency: 'USD',
      grossAmount: 100,
      feeAmount: 3.8,
      netMerchantAmount: 96.2,
      providerReference: 'CAPTURE-1',
    });

    expect(walletRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        balance: 51.2,
        totalSpent: 3.8,
      }),
    );
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3.8,
        type: TransactionType.FEE_DEDUCTION,
        paymentMethod: 'PAYPAL',
        externalTransactionId: 'CAPTURE-1',
        metadata: expect.objectContaining({
          stage: 'gateway_fee',
          feeAmount: 3.8,
          grossAmount: 100,
          netMerchantAmount: 96.2,
        }),
      }),
    );
    expect(transaction).toMatchObject({
      id: 'tx-fee-1',
      amount: 3.8,
    });
  });

  it('records a funding inflow mirror without changing the treasury balance', async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'platform@example.com',
      fullName: 'Platform Owner',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    } as UserEntity);
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-platform',
      userId: 'admin-1',
      balance: 25,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 35,
      totalSpent: 3.8,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    transactionRepository.save.mockImplementation(async (value) => ({
      id: 'tx-funding-mirror-1',
      ...value,
    }) as TransactionEntity);

    const transaction = await service.recordPlatformFundingMirror({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      milestoneTitle: 'Kickoff',
      escrowId: 'escrow-1',
      currency: 'USD',
      amount: 100,
      paymentMethod: 'PAYPAL_ACCOUNT',
      providerReference: 'CAPTURE-1',
      gateway: 'PAYPAL',
      payerUserId: 'client-1',
      payerEmail: 'buyer@example.com',
      depositTransactionId: 'tx-deposit-1',
      holdTransactionId: 'tx-hold-1',
    });

    expect(walletRepository.save).not.toHaveBeenCalled();
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100,
        type: TransactionType.DEPOSIT,
        paymentMethod: 'PAYPAL_ACCOUNT',
        externalTransactionId: 'CAPTURE-1',
        metadata: expect.objectContaining({
          mirroredFundingInflow: true,
          informationalOnly: true,
          milestoneId: 'milestone-1',
          escrowId: 'escrow-1',
          payerEmail: 'buyer@example.com',
        }),
        balanceAfter: 25,
      }),
    );
    expect(transaction).toMatchObject({
      id: 'tx-funding-mirror-1',
      amount: 100,
    });
  });

  it('computes awaiting release for freelancer snapshots from funded and disputed escrows', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-freelancer',
      userId: 'freelancer-1',
      balance: 740,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 120,
      totalEarned: 860,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    escrowQueryBuilder.getRawOne.mockResolvedValueOnce({ total: '180.50' });

    const result = await service.getWalletSnapshot({
      id: 'freelancer-1',
      role: UserRole.FREELANCER,
    } as UserEntity);

    expect(escrowRepository.createQueryBuilder).toHaveBeenCalledWith('escrow');
    expect(escrowQueryBuilder.andWhere).toHaveBeenCalledWith(
      'project.freelancerId = :userId',
      { userId: 'freelancer-1' },
    );
    expect(result.awaitingReleaseAmount).toBe(180.5);
  });

  it('computes awaiting release for broker snapshots from funded and disputed escrows', async () => {
    walletRepository.findOne.mockResolvedValueOnce({
      id: 'wallet-broker',
      userId: 'broker-1',
      balance: 80,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 40,
      totalEarned: 120,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);
    escrowQueryBuilder.getRawOne.mockResolvedValueOnce({ total: '50.00' });

    const result = await service.getWalletSnapshot({
      id: 'broker-1',
      role: UserRole.BROKER,
    } as UserEntity);

    expect(escrowQueryBuilder.andWhere).toHaveBeenCalledWith(
      'project.brokerId = :userId',
      { userId: 'broker-1' },
    );
    expect(result.awaitingReleaseAmount).toBe(50);
  });
});
