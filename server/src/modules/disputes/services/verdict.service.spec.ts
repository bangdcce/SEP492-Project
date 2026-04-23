import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisputeEntity,
  DisputeType,
  EscrowEntity,
  EscrowStatus,
  ProjectEntity,
  ProjectStatus,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  WalletEntity,
  WalletStatus,
} from 'src/database/entities';
import { VerdictService } from './verdict.service';

describe('VerdictService accounting', () => {
  let service: VerdictService;

  beforeEach(() => {
    service = new VerdictService(
      {} as any,
      {} as any,
      { emit: jest.fn() } as unknown as EventEmitter2,
      {} as any,
      {} as any,
    );
  });

  const buildWallet = (overrides: Partial<WalletEntity>): WalletEntity =>
    ({
      id: overrides.id || `wallet-${overrides.userId}`,
      userId: overrides.userId || 'user-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      ...overrides,
    }) as WalletEntity;

  it('transfers the platform fee and only counts unrecovered escrow outflow as client spend', async () => {
    const savedTransactions: Array<Record<string, any>> = [];
    const wallets = new Map<string, WalletEntity>([
      [
        'client-1',
        buildWallet({
          id: 'wallet-client',
          userId: 'client-1',
          heldBalance: 120,
        }),
      ],
      [
        'freelancer-1',
        buildWallet({
          id: 'wallet-freelancer',
          userId: 'freelancer-1',
        }),
      ],
    ]);

    const walletRepo = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        let currentUserId: string | null = null;
        const builder = {
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockImplementation((_clause: string, params: { userId: string }) => {
            currentUserId = params.userId;
            return builder;
          }),
          getOne: jest.fn().mockImplementation(async () =>
            currentUserId ? wallets.get(currentUserId) || null : null,
          ),
        };
        return builder;
      }),
      create: jest.fn().mockImplementation((payload) => buildWallet(payload)),
      save: jest.fn().mockImplementation(async (wallet: WalletEntity) => {
        wallets.set(wallet.userId, wallet);
        return wallet;
      }),
    };

    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'platform-owner',
      } as UserEntity),
    };

    const queryRunner = {
      manager: {
        findOne: jest.fn().mockImplementation(async (entity, options) => {
          if (entity === EscrowEntity) {
            return {
              id: 'escrow-1',
              projectId: 'project-1',
              clientWalletId: 'wallet-client',
              fundedAmount: 120,
              totalAmount: 120,
              currency: 'USD',
              status: EscrowStatus.DISPUTED,
            } as EscrowEntity;
          }

          if (entity === WalletEntity && options?.where?.id) {
            return (
              Array.from(wallets.values()).find((wallet) => wallet.id === options.where.id) || null
            );
          }

          if (entity === ProjectEntity) {
            return {
              id: 'project-1',
              clientId: 'client-1',
            } as ProjectEntity;
          }

          return null;
        }),
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === WalletEntity) {
            return walletRepo;
          }

          if (entity === UserEntity) {
            return userRepo;
          }

          throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`);
        }),
        create: jest.fn().mockImplementation((_entity, payload) => payload),
        save: jest.fn().mockImplementation(async (entity, value) => {
          if (value == null && entity && typeof entity === 'object' && 'walletId' in entity) {
            const transaction = {
              id: `tx-${savedTransactions.length + 1}`,
              ...entity,
            };
            savedTransactions.push(transaction);
            return transaction;
          }

          if (entity === WalletEntity) {
            wallets.set(value.userId, value);
            return value;
          }

          if (entity === TransactionEntity) {
            const transaction = {
              id: `tx-${savedTransactions.length + 1}`,
              ...value,
            };
            savedTransactions.push(transaction);
            return transaction;
          }

          return value;
        }),
      },
    } as any;

    const dispute = {
      id: 'dispute-1',
      disputeType: DisputeType.CLIENT_VS_FREELANCER,
    } as DisputeEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      freelancerId: 'freelancer-1',
      brokerId: null,
      currency: 'USD',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;
    const escrow = {
      id: 'escrow-1',
      projectId: 'project-1',
      clientWalletId: 'wallet-client',
      fundedAmount: 120,
      totalAmount: 120,
      currency: 'USD',
      status: EscrowStatus.DISPUTED,
    } as EscrowEntity;

    const transactions = await (service as any).queueTransfers(
      queryRunner,
      {
        clientAmount: 40,
        freelancerAmount: 60,
        brokerAmount: 0,
        platformFee: 20,
        totalAmount: 120,
      },
      dispute,
      project,
      escrow,
      { disputeId: dispute.id },
      false,
    );

    expect(transactions).toHaveLength(3);
    expect(savedTransactions.map((tx) => tx.type)).toEqual(
      expect.arrayContaining([
        TransactionType.REFUND,
        TransactionType.ESCROW_RELEASE,
        TransactionType.FEE_DEDUCTION,
      ]),
    );
    expect(wallets.get('client-1')).toEqual(
      expect.objectContaining({
        heldBalance: 0,
        balance: 40,
        totalSpent: 80,
      }),
    );
    expect(wallets.get('freelancer-1')).toEqual(
      expect.objectContaining({
        balance: 60,
        totalEarned: 60,
      }),
    );
    expect(wallets.get('platform-owner')).toEqual(
      expect.objectContaining({
        balance: 20,
        totalEarned: 20,
      }),
    );
  });

  it('finalizes pending verdict transfers without counting refunds as extra client spend', async () => {
    const walletsById = new Map<string, WalletEntity>([
      [
        'wallet-client',
        buildWallet({
          id: 'wallet-client',
          userId: 'client-1',
          heldBalance: 120,
          pendingBalance: 40,
        }),
      ],
      [
        'wallet-freelancer',
        buildWallet({
          id: 'wallet-freelancer',
          userId: 'freelancer-1',
          pendingBalance: 60,
        }),
      ],
      [
        'wallet-platform',
        buildWallet({
          id: 'wallet-platform',
          userId: 'platform-owner',
          pendingBalance: 20,
        }),
      ],
    ]);

    const pendingTransactions = [
      {
        id: 'tx-1',
        walletId: 'wallet-client',
        amount: 40,
        type: TransactionType.REFUND,
        status: TransactionStatus.PENDING,
        referenceType: 'Escrow',
        referenceId: 'escrow-1',
        metadata: { disputeId: 'dispute-1', pendingVerdict: true },
      },
      {
        id: 'tx-2',
        walletId: 'wallet-freelancer',
        amount: 60,
        type: TransactionType.ESCROW_RELEASE,
        status: TransactionStatus.PENDING,
        referenceType: 'Escrow',
        referenceId: 'escrow-1',
        metadata: { disputeId: 'dispute-1', pendingVerdict: true },
      },
      {
        id: 'tx-3',
        walletId: 'wallet-platform',
        amount: 20,
        type: TransactionType.FEE_DEDUCTION,
        status: TransactionStatus.PENDING,
        referenceType: 'Escrow',
        referenceId: 'escrow-1',
        metadata: {
          disputeId: 'dispute-1',
          pendingVerdict: true,
          countAsEarned: true,
          role: 'PLATFORM',
        },
      },
    ] as TransactionEntity[];

    const transactionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(pendingTransactions),
      }),
    };

    const queryRunner = {
      manager: {
        findOne: jest.fn().mockImplementation(async (entity, options) => {
          if (entity === EscrowEntity) {
            return {
              id: 'escrow-1',
              clientWalletId: 'wallet-client',
              status: EscrowStatus.DISPUTED,
            } as EscrowEntity;
          }

          if (entity === WalletEntity) {
            return walletsById.get(options?.where?.id) || null;
          }

          if (entity === ProjectEntity) {
            return {
              id: 'project-1',
              clientId: 'client-1',
            } as ProjectEntity;
          }

          return null;
        }),
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === TransactionEntity) {
            return transactionRepo;
          }

          throw new Error(`Unexpected repository: ${entity?.name ?? 'unknown'}`);
        }),
        save: jest.fn().mockImplementation(async (entity, value) => {
          if (entity === WalletEntity) {
            walletsById.set(value.id, value);
          }
          return value;
        }),
      },
    } as any;

    const completedIds = await (service as any).finalizePendingVerdictTransactions(
      queryRunner,
      'dispute-1',
      'APPEAL_DEADLINE',
    );

    expect(completedIds).toEqual(['tx-1', 'tx-2', 'tx-3']);
    expect(walletsById.get('wallet-client')).toEqual(
      expect.objectContaining({
        heldBalance: 0,
        pendingBalance: 0,
        balance: 40,
        totalSpent: 80,
      }),
    );
    expect(walletsById.get('wallet-freelancer')).toEqual(
      expect.objectContaining({
        pendingBalance: 0,
        balance: 60,
        totalEarned: 60,
      }),
    );
    expect(walletsById.get('wallet-platform')).toEqual(
      expect.objectContaining({
        pendingBalance: 0,
        balance: 20,
        totalEarned: 20,
      }),
    );
    expect(
      pendingTransactions.every((transaction) => transaction.status === TransactionStatus.COMPLETED),
    ).toBe(true);
  });
});
