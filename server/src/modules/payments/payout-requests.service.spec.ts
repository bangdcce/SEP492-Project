import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  FeeConfigEntity,
  PayoutMethodEntity,
  PayoutMethodType,
  PayoutRequestEntity,
  PayoutStatus,
  TransactionEntity,
  TransactionStatus,
  WalletEntity,
  WalletStatus,
  UserRole,
} from '../../database/entities';
import { CreatePayoutRequestDto, PayoutRequestsQueryDto } from './dto';
import { PayPalPayoutsGateway } from './pay-pal-payouts.gateway';
import { PayoutRequestsService } from './payout-requests.service';
import { WalletService } from './wallet.service';

describe('PayoutRequestsService', () => {
  let service: PayoutRequestsService;

  const payoutRequestRepository = {
    findAndCount: jest.fn(),
  };
  const payoutMethodRepo = {
    findOne: jest.fn(),
  };
  const payoutRequestRepoInTransaction = {
    save: jest.fn(),
    create: jest.fn((data: Partial<PayoutRequestEntity>) => data),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const transactionRepo = {
    save: jest.fn(),
    create: jest.fn((data: Partial<TransactionEntity>) => data),
    findOne: jest.fn(),
  };
  const feeConfigRepo = {
    findOne: jest.fn(),
  };
  const walletRepo = {
    save: jest.fn(),
  };
  const walletService = {
    getOrCreateWallet: jest.fn(),
    toWalletSnapshot: jest.fn(),
    buildWalletSnapshot: jest.fn(),
    reserveWithdrawal: jest.fn(),
    finalizeWithdrawal: jest.fn(),
    releaseWithdrawal: jest.fn(),
    recordPlatformCashoutMirror: jest.fn(),
  };
  const payoutGateway = {
    payout: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === PayoutRequestEntity) return payoutRequestRepoInTransaction;
      if (entity === PayoutMethodEntity) return payoutMethodRepo;
      if (entity === TransactionEntity) return transactionRepo;
      if (entity === FeeConfigEntity) return feeConfigRepo;
      if (entity === WalletEntity) return walletRepo;
      throw new Error('Unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (entityManager: typeof manager) => Promise<unknown>) =>
      callback(manager),
    ),
  };

  const makeWallet = (overrides: Partial<WalletEntity> = {}): WalletEntity =>
    ({
      id: 'wallet-1',
      userId: 'user-1',
      balance: 100,
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
      ...overrides,
    }) as WalletEntity;

  beforeEach(async () => {
    jest.clearAllMocks();
    payoutRequestRepoInTransaction.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    });
    walletService.getOrCreateWallet.mockImplementation((userId: string) =>
      makeWallet({ userId }),
    );
    walletService.toWalletSnapshot.mockImplementation((wallet: WalletEntity) => ({
      id: wallet.id,
      userId: wallet.userId,
      availableBalance: Number(wallet.balance || 0),
      pendingBalance: Number(wallet.pendingBalance || 0),
      heldBalance: Number(wallet.heldBalance || 0),
      awaitingReleaseAmount: 0,
      totalDeposited: Number(wallet.totalDeposited || 0),
      totalWithdrawn: Number(wallet.totalWithdrawn || 0),
      totalEarned: Number(wallet.totalEarned || 0),
      totalSpent: Number(wallet.totalSpent || 0),
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }));
    walletService.buildWalletSnapshot.mockImplementation(async (wallet: WalletEntity) =>
      walletService.toWalletSnapshot(wallet),
    );
    walletService.reserveWithdrawal.mockImplementation(async (wallet: WalletEntity, amount: number) => {
      wallet.balance -= amount;
      wallet.pendingBalance += amount;
      return wallet;
    });
    walletService.finalizeWithdrawal.mockImplementation(async (wallet: WalletEntity, amount: number) => {
      wallet.pendingBalance -= amount;
      wallet.totalWithdrawn += amount;
      return wallet;
    });
    walletService.releaseWithdrawal.mockImplementation(async (wallet: WalletEntity, amount: number) => {
      wallet.pendingBalance -= amount;
      wallet.balance += amount;
      return wallet;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutRequestsService,
        {
          provide: getRepositoryToken(PayoutRequestEntity),
          useValue: payoutRequestRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: WalletService,
          useValue: walletService,
        },
        {
          provide: PayPalPayoutsGateway,
          useValue: payoutGateway,
        },
      ],
    }).compile();

    service = module.get(PayoutRequestsService);
  });

  it('creates and completes a cashout request while moving funds through pending balance', async () => {
    const wallet = makeWallet({ balance: 100 });
    walletService.getOrCreateWallet.mockResolvedValue(wallet);
    payoutMethodRepo.findOne.mockResolvedValue({
      id: 'method-1',
      userId: 'user-1',
      type: PayoutMethodType.PAYPAL_EMAIL,
      paypalEmail: 'cashout@example.com',
      bankName: null,
      accountNumber: null,
      accountHolderName: null,
      isDefault: true,
      isVerified: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    feeConfigRepo.findOne.mockResolvedValue(null);
    payoutRequestRepoInTransaction.save.mockImplementation((value) => ({
      id: value.id || 'payout-1',
      requestedAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T00:00:00.000Z'),
      ...value,
    }));
    transactionRepo.save.mockImplementation((value) => ({
      id: value.id || 'tx-1',
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      ...value,
    }));
    payoutGateway.payout.mockResolvedValue({
      providerReference: 'sandbox:payout:payout-1',
      nextAction: { type: 'SANDBOX_PAYOUT_COMPLETED' },
      sandboxFallback: true,
    });

    const result = await service.createForUser(
      { id: 'user-1', role: UserRole.BROKER } as never,
      {
        payoutMethodId: 'method-1',
        amount: 40,
        note: 'Cashout',
      } as CreatePayoutRequestDto,
    );

    expect(result.request.status).toBe(PayoutStatus.COMPLETED);
    expect(result.wallet.availableBalance).toBe(60);
    expect(result.wallet.pendingBalance).toBe(0);
    expect(result.wallet.totalWithdrawn).toBe(40);
    expect(payoutGateway.payout).toHaveBeenCalled();
    expect(walletService.recordPlatformCashoutMirror).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'payout-1',
        transactionId: 'tx-1',
        paypalEmail: 'cashout@example.com',
        providerReference: 'sandbox:payout:payout-1',
      }),
      manager,
    );
  });

  it('rolls back the reserved balance when payout processing fails', async () => {
    const wallet = makeWallet({ balance: 100 });
    walletService.getOrCreateWallet.mockResolvedValue(wallet);
    payoutMethodRepo.findOne.mockResolvedValue({
      id: 'method-1',
      userId: 'user-1',
      type: PayoutMethodType.PAYPAL_EMAIL,
      displayName: 'Primary cashout PayPal',
      paypalEmail: 'cashout@example.com',
      bankName: null,
      accountNumber: null,
      accountHolderName: null,
      isDefault: true,
      isVerified: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    feeConfigRepo.findOne.mockResolvedValue(null);
    payoutRequestRepoInTransaction.save.mockImplementation((value) => ({
      id: value.id || 'payout-2',
      requestedAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T00:00:00.000Z'),
      ...value,
    }));
    transactionRepo.save.mockImplementation((value) => ({
      id: value.id || 'tx-2',
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      ...value,
    }));
    payoutGateway.payout.mockRejectedValue(new Error('gateway unavailable'));

    const result = await service.createForUser(
      { id: 'user-1', role: UserRole.FREELANCER } as never,
      {
        payoutMethodId: 'method-1',
        amount: 40,
      } as CreatePayoutRequestDto,
    );

    expect(result.request.status).toBe(PayoutStatus.FAILED);
    expect(result.wallet.availableBalance).toBe(100);
    expect(result.wallet.pendingBalance).toBe(0);
    expect(result.request.failureReason).toContain('gateway unavailable');
    expect(transactionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: TransactionStatus.FAILED }));
  });

  it('rejects bank payout methods for cashout while PayPal-only payout is active', async () => {
    const wallet = makeWallet({ balance: 100 });
    walletService.getOrCreateWallet.mockResolvedValue(wallet);
    payoutMethodRepo.findOne.mockResolvedValue({
      id: 'method-1',
      userId: 'user-1',
      type: PayoutMethodType.BANK_ACCOUNT,
      displayName: 'Broker bank payout',
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      accountHolderName: 'Nguyen Van A',
      isDefault: true,
      isVerified: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });

    await expect(
      service.createForUser(
        { id: 'user-1', role: UserRole.BROKER } as never,
        {
          payoutMethodId: 'method-1',
          amount: 20,
        } as CreatePayoutRequestDto,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a pending payout request and restores the wallet balance', async () => {
    const wallet = makeWallet({ balance: 60, pendingBalance: 40 });
    walletService.getOrCreateWallet.mockResolvedValue(wallet);
    payoutRequestRepoInTransaction.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'payout-3',
        walletId: wallet.id,
        wallet,
        payoutMethod: {
          id: 'method-1',
          type: PayoutMethodType.PAYPAL_EMAIL,
          paypalEmail: 'cashout@example.com',
          bankName: null,
          bankCode: null,
          branchName: null,
          accountHolderName: null,
          accountNumber: null,
        },
        payoutMethodId: 'method-1',
        amount: 40,
        fee: 0,
        netAmount: 40,
        currency: 'USD',
        status: PayoutStatus.PENDING,
        transactionId: 'tx-3',
      }),
    });
    transactionRepo.findOne.mockResolvedValue({
      id: 'tx-3',
      walletId: wallet.id,
      status: TransactionStatus.PROCESSING,
      failureReason: null,
      completedAt: null,
    });
    transactionRepo.save.mockImplementation((value) => value);

    const result = await service.rejectForAdmin(
      'payout-3',
      { id: 'admin-1', role: UserRole.ADMIN } as never,
      'Manual review failed',
    );

    expect(result.request.status).toBe(PayoutStatus.REJECTED);
    expect(result.wallet.availableBalance).toBe(100);
    expect(result.wallet.pendingBalance).toBe(0);
    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TransactionStatus.CANCELLED,
        failureReason: 'Manual review failed',
      }),
    );
  });

  it('returns payout history with the wallet snapshot', async () => {
    const wallet = makeWallet({ balance: 82, pendingBalance: 18 });
    walletService.getOrCreateWallet.mockResolvedValue(wallet);
    payoutRequestRepository.findAndCount.mockResolvedValue([
      [
        {
          id: 'payout-4',
          walletId: wallet.id,
          payoutMethodId: 'method-1',
          amount: 18,
          fee: 0,
          netAmount: 18,
          currency: 'USD',
          status: PayoutStatus.COMPLETED,
          approvedAt: new Date('2026-03-14T00:00:00.000Z'),
          approvedBy: 'user-1',
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null,
          processedAt: new Date('2026-03-14T00:00:00.000Z'),
          processedBy: 'system',
          externalReference: 'sandbox:payout:payout-4',
          transactionId: 'tx-4',
          note: 'Cashout',
          adminNote: null,
          requestedAt: new Date('2026-03-14T00:00:00.000Z'),
          updatedAt: new Date('2026-03-14T00:00:00.000Z'),
          payoutMethod: {
            id: 'method-1',
            type: PayoutMethodType.PAYPAL_EMAIL,
            displayName: 'Primary cashout PayPal',
            isDefault: true,
            isVerified: true,
            paypalEmail: 'cashout@example.com',
            bankName: null,
            bankCode: null,
            branchName: null,
            accountHolderName: null,
            accountNumber: null,
            createdAt: new Date('2026-03-13T00:00:00.000Z'),
            updatedAt: new Date('2026-03-13T00:00:00.000Z'),
          },
        } as PayoutRequestEntity,
      ],
      1,
    ]);

    const result = await service.listForUser('user-1', {
      page: 1,
      limit: 10,
    } as PayoutRequestsQueryDto);

    expect(result.total).toBe(1);
    expect(result.wallet.availableBalance).toBe(82);
    expect(result.items[0]).toMatchObject({
      id: 'payout-4',
      status: PayoutStatus.COMPLETED,
      payoutMethod: {
        type: PayoutMethodType.PAYPAL_EMAIL,
        paypalEmail: 'cashout@example.com',
      },
    });
  });

  it('allows clients to cash out verdict funds through the same wallet lane', async () => {
    const wallet = makeWallet({ userId: 'user-2', balance: 25 });
    walletService.getOrCreateWallet.mockResolvedValue(wallet);
    payoutMethodRepo.findOne.mockResolvedValue({
      id: 'method-1',
      userId: 'user-2',
      type: PayoutMethodType.PAYPAL_EMAIL,
      paypalEmail: 'client@example.com',
      bankName: null,
      accountNumber: null,
      accountHolderName: null,
      isDefault: true,
      isVerified: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    feeConfigRepo.findOne.mockResolvedValue(null);
    payoutRequestRepoInTransaction.save.mockImplementation((value) => ({
      id: value.id || 'payout-client-1',
      requestedAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-14T00:00:00.000Z'),
      ...value,
    }));
    transactionRepo.save.mockImplementation((value) => ({
      id: value.id || 'tx-client-1',
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      ...value,
    }));
    payoutGateway.payout.mockResolvedValue({
      providerReference: 'sandbox:payout:payout-client-1',
      nextAction: { type: 'SANDBOX_PAYOUT_COMPLETED' },
      sandboxFallback: true,
    });

    const result = await service.createForUser(
      { id: 'user-2', role: UserRole.CLIENT } as never,
      {
        payoutMethodId: 'method-1',
        amount: 10,
      } as CreatePayoutRequestDto,
    );

    expect(result.request.status).toBe(PayoutStatus.COMPLETED);
    expect(result.wallet.availableBalance).toBe(15);
    expect(result.wallet.totalWithdrawn).toBe(10);
  });
});
