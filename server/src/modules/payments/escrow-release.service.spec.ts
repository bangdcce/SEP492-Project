import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  EscrowEntity,
  EscrowStatus,
  FundingGateway,
  MilestoneEntity,
  MilestoneStatus,
  ProjectEntity,
  TransactionEntity,
  UserEntity,
  UserRole,
  UserStatus,
  WalletEntity,
  WalletStatus,
} from '../../database/entities';
import { EscrowReleaseService } from './escrow-release.service';
import { PayPalCheckoutService } from './pay-pal-checkout.service';
import { WalletService } from './wallet.service';

const createQueryBuilderMock = (result: unknown) => ({
  setLock: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
});

describe('EscrowReleaseService', () => {
  let service: EscrowReleaseService;

  const escrowRepository = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const milestoneRepository = {
    createQueryBuilder: jest.fn(),
  };
  const projectRepository = {
    findOne: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(),
  };
  const walletService = {
    getOrCreateWallet: jest.fn(),
    toWalletSnapshot: jest.fn(),
  };
  const payPalCheckoutService = {
    refundCapture: jest.fn(),
  };
  const walletRepository = {
    save: jest.fn(),
  };
  const transactionRepository = {
    create: jest.fn((data: Partial<TransactionEntity>) => data),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === MilestoneEntity) return milestoneRepository;
      if (entity === EscrowEntity) return escrowRepository;
      if (entity === ProjectEntity) return projectRepository;
      if (entity === UserEntity) return userRepository;
      if (entity === WalletEntity) return walletRepository;
      if (entity === TransactionEntity) return transactionRepository;
      throw new Error('Unexpected repository');
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowReleaseService,
        {
          provide: getRepositoryToken(EscrowEntity),
          useValue: escrowRepository,
        },
        {
          provide: getRepositoryToken(MilestoneEntity),
          useValue: milestoneRepository,
        },
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((callback: (entityManager: typeof manager) => Promise<unknown>) =>
              callback(manager),
            ),
          },
        },
        {
          provide: WalletService,
          useValue: walletService,
        },
        {
          provide: PayPalCheckoutService,
          useValue: payPalCheckoutService,
        },
      ],
    }).compile();

    service = module.get(EscrowReleaseService);
  });

  it('builds a full release plan for a completed + funded milestone', async () => {
    milestoneRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'milestone-1',
        status: MilestoneStatus.COMPLETED,
      } as MilestoneEntity),
    );
    escrowRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'escrow-1',
        milestoneId: 'milestone-1',
        status: EscrowStatus.FUNDED,
        totalAmount: 100,
        fundedAmount: 100,
        developerShare: 85,
        brokerShare: 10,
        platformFee: 5,
        currency: 'USD',
      } as EscrowEntity),
    );
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
    } as ProjectEntity);

    const plan = await service.buildFullReleasePlanForMilestone('milestone-1', manager as never);

    expect(plan).toMatchObject({
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      totalAmount: 100,
      developerAmount: 85,
      brokerAmount: 10,
      platformFee: 5,
      currency: 'USD',
    });
  });

  it('releases a funded escrow and updates wallet snapshots consistently', async () => {
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      projectId: 'project-1',
      status: MilestoneStatus.COMPLETED,
    } as MilestoneEntity;
    const escrow = {
      id: 'escrow-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      status: EscrowStatus.FUNDED,
      totalAmount: 100,
      fundedAmount: 100,
      developerShare: 85,
      brokerShare: 10,
      platformFee: 5,
      currency: 'USD',
      clientApproved: false,
    } as EscrowEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
    } as ProjectEntity;
    const clientWallet = {
      id: 'wallet-client',
      userId: 'client-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 100,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity;
    const freelancerWallet = {
      id: 'wallet-freelancer',
      userId: 'freelancer-1',
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
    const brokerWallet = {
      id: 'wallet-broker',
      userId: 'broker-1',
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
    const platformWallet = {
      id: 'wallet-platform',
      userId: 'admin-1',
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

    milestoneRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock(milestone));
    escrowRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock(escrow));
    projectRepository.findOne.mockResolvedValue(project);
    userRepository.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
    } as UserEntity);
    walletService.getOrCreateWallet.mockImplementation((userId: string) => {
      if (userId === 'client-1') return clientWallet;
      if (userId === 'freelancer-1') return freelancerWallet;
      if (userId === 'broker-1') return brokerWallet;
      if (userId === 'admin-1') return platformWallet;
      throw new Error(`Unexpected wallet lookup for ${userId}`);
    });
    walletService.toWalletSnapshot.mockImplementation((wallet: WalletEntity) => ({
      id: wallet.id,
      userId: wallet.userId,
      availableBalance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      heldBalance: wallet.heldBalance,
      totalDeposited: wallet.totalDeposited,
      totalWithdrawn: wallet.totalWithdrawn,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }));
    walletRepository.save.mockImplementation((wallet: WalletEntity) => wallet);
    transactionRepository.save.mockImplementation((transaction: Partial<TransactionEntity>) => {
      if (!transaction.id) {
        if (transaction.walletId === 'wallet-client') {
          return { ...transaction, id: 'tx-client' };
        }
        if (transaction.walletId === 'wallet-freelancer') {
          return { ...transaction, id: 'tx-freelancer' };
        }
        if (transaction.walletId === 'wallet-platform') {
          return { ...transaction, id: 'tx-platform' };
        }
        return { ...transaction, id: 'tx-broker' };
      }
      return transaction;
    });
    escrowRepository.save.mockImplementation((value: EscrowEntity) => value);

    const result = await service.releaseForApprovedMilestone(
      'milestone-1',
      'client-1',
      manager as never,
    );

    expect(result).toMatchObject({
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: EscrowStatus.RELEASED,
      releasedAmount: 100,
      releaseTransactionIds: ['tx-client', 'tx-freelancer', 'tx-broker', 'tx-platform'],
    });
    expect(clientWallet.heldBalance).toBe(0);
    expect(clientWallet.totalSpent).toBe(100);
    expect(freelancerWallet.balance).toBe(85);
    expect(freelancerWallet.totalEarned).toBe(85);
    expect(brokerWallet.balance).toBe(10);
    expect(brokerWallet.totalEarned).toBe(10);
    expect(platformWallet.balance).toBe(5);
    expect(platformWallet.totalEarned).toBe(5);
    expect(escrow.status).toBe(EscrowStatus.RELEASED);
    expect(escrow.clientApproved).toBe(true);
  });

  it('refunds a funded escrow back to the client wallet when a project is cancelled', async () => {
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
    } as ProjectEntity;
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      projectId: 'project-1',
    } as MilestoneEntity;
    const escrow = {
      id: 'escrow-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      status: EscrowStatus.FUNDED,
      totalAmount: 100,
      fundedAmount: 100,
      releasedAmount: 0,
      currency: 'USD',
      holdTransactionId: 'tx-hold',
    } as EscrowEntity;
    const clientWallet = {
      id: 'wallet-client',
      userId: 'client-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 100,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity;

    walletService.getOrCreateWallet.mockResolvedValue(clientWallet);
    walletService.toWalletSnapshot.mockReturnValue({
      id: clientWallet.id,
      userId: clientWallet.userId,
      availableBalance: 100,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: clientWallet.createdAt,
      updatedAt: clientWallet.updatedAt,
    });
    transactionRepository.findOne.mockResolvedValue({
      id: 'tx-hold',
      paymentMethod: 'PAYPAL_ACCOUNT',
      externalTransactionId: null,
      metadata: {
        gateway: FundingGateway.INTERNAL_SANDBOX,
      },
    } as Partial<TransactionEntity>);
    walletRepository.save.mockImplementation((wallet: WalletEntity) => wallet);
    transactionRepository.save.mockImplementation((transaction: Partial<TransactionEntity>) => ({
      ...(transaction as TransactionEntity),
      id: 'tx-refund',
    }));
    escrowRepository.save.mockImplementation((value: EscrowEntity) => value);

    const result = await service.refundCancelledEscrow(
      project,
      milestone,
      escrow,
      'client-1',
      manager as never,
    );

    expect(walletService.getOrCreateWallet).toHaveBeenCalledWith('client-1', 'USD', manager);
    expect(walletRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        balance: 100,
        heldBalance: 0,
      }),
    );
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REFUND',
        referenceId: 'escrow-1',
        relatedTransactionId: 'tx-hold',
        externalTransactionId: null,
      }),
    );
    expect(escrowRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: EscrowStatus.REFUNDED,
        refundedAt: expect.any(Date),
        refundTransactionId: 'tx-refund',
        clientWalletId: 'wallet-client',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        escrowId: 'escrow-1',
        milestoneId: 'milestone-1',
        escrowStatus: EscrowStatus.REFUNDED,
        refundedAmount: 100,
        refundMode: 'INTERNAL_LEDGER',
        externalRefundReference: null,
        creditedToInternalWallet: true,
        refundTransactionId: 'tx-refund',
      }),
    );
  });

  it('refunds a PayPal-funded escrow back to PayPal without re-crediting the internal wallet', async () => {
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
    } as ProjectEntity;
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      projectId: 'project-1',
    } as MilestoneEntity;
    const escrow = {
      id: 'escrow-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      status: EscrowStatus.FUNDED,
      totalAmount: 100,
      fundedAmount: 100,
      releasedAmount: 0,
      currency: 'USD',
      holdTransactionId: 'tx-hold',
    } as EscrowEntity;
    const clientWallet = {
      id: 'wallet-client',
      userId: 'client-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 100,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity;

    walletService.getOrCreateWallet.mockResolvedValue(clientWallet);
    walletService.toWalletSnapshot.mockReturnValue({
      id: clientWallet.id,
      userId: clientWallet.userId,
      availableBalance: 0,
      pendingBalance: 0,
      heldBalance: 0,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: clientWallet.createdAt,
      updatedAt: clientWallet.updatedAt,
    });
    transactionRepository.findOne.mockResolvedValue({
      id: 'tx-hold',
      paymentMethod: 'PAYPAL_ACCOUNT',
      externalTransactionId: 'CAPTURE-1',
      metadata: {
        gateway: FundingGateway.PAYPAL,
      },
    } as Partial<TransactionEntity>);
    payPalCheckoutService.refundCapture.mockResolvedValue({
      refundId: 'REFUND-1',
      status: 'COMPLETED',
      captureId: 'CAPTURE-1',
    });
    walletRepository.save.mockImplementation((wallet: WalletEntity) => wallet);
    transactionRepository.save.mockImplementation((transaction: Partial<TransactionEntity>) => ({
      ...(transaction as TransactionEntity),
      id: 'tx-refund',
    }));
    escrowRepository.save.mockImplementation((value: EscrowEntity) => value);

    const result = await service.refundCancelledEscrow(
      project,
      milestone,
      escrow,
      'client-1',
      manager as never,
    );

    expect(payPalCheckoutService.refundCapture).toHaveBeenCalledWith({
      captureId: 'CAPTURE-1',
      currency: 'USD',
      amount: 100,
      requestId: 'escrow-escrow-1-cancel-refund',
    });
    expect(walletRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        balance: 0,
        heldBalance: 0,
      }),
    );
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REFUND',
        externalTransactionId: 'REFUND-1',
        netAmount: 0,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        escrowId: 'escrow-1',
        milestoneId: 'milestone-1',
        escrowStatus: EscrowStatus.REFUNDED,
        refundedAmount: 100,
        refundMode: 'PAYPAL_CAPTURE_REFUND',
        externalRefundReference: 'REFUND-1',
        creditedToInternalWallet: false,
        refundTransactionId: 'tx-refund',
      }),
    );
  });

  it('rejects release when client held balance is insufficient', async () => {
    milestoneRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'milestone-1',
        title: 'Kickoff',
        projectId: 'project-1',
        status: MilestoneStatus.COMPLETED,
      } as MilestoneEntity),
    );
    escrowRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'escrow-1',
        milestoneId: 'milestone-1',
        projectId: 'project-1',
        status: EscrowStatus.FUNDED,
        totalAmount: 100,
        fundedAmount: 100,
        developerShare: 85,
        brokerShare: 10,
        platformFee: 5,
        currency: 'USD',
      } as EscrowEntity),
    );
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
    } as ProjectEntity);
    walletService.getOrCreateWallet.mockResolvedValue({
      id: 'wallet-client',
      userId: 'client-1',
      balance: 0,
      pendingBalance: 0,
      heldBalance: 50,
      totalDeposited: 100,
      totalWithdrawn: 0,
      totalEarned: 0,
      totalSpent: 0,
      currency: 'USD',
      status: WalletStatus.ACTIVE,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as WalletEntity);

    await expect(
      service.releaseForApprovedMilestone('milestone-1', 'client-1', manager as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects disputed escrows', async () => {
    milestoneRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'milestone-1',
        status: MilestoneStatus.COMPLETED,
      } as MilestoneEntity),
    );
    escrowRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({
        id: 'escrow-1',
        milestoneId: 'milestone-1',
        status: EscrowStatus.DISPUTED,
        totalAmount: 100,
        fundedAmount: 100,
      } as EscrowEntity),
    );
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
    } as ProjectEntity);

    await expect(
      service.buildFullReleasePlanForMilestone('milestone-1', manager as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when milestone does not exist', async () => {
    milestoneRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock(null));
    escrowRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock(null));

    await expect(
      service.buildFullReleasePlanForMilestone('missing', manager as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
