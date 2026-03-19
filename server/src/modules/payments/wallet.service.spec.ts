import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  WalletEntity,
  WalletStatus,
} from '../../database/entities';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepository: jest.Mocked<Repository<WalletEntity>>;
  let transactionRepository: jest.Mocked<Repository<TransactionEntity>>;

  beforeEach(async () => {
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
          },
        },
      ],
    }).compile();

    service = module.get(WalletService);
    walletRepository = module.get(getRepositoryToken(WalletEntity));
    transactionRepository = module.get(getRepositoryToken(TransactionEntity));
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
    expect(result.items[0]).toMatchObject({
      id: 'tx-1',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
    });
  });
});
