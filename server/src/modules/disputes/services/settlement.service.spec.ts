import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DisputeEntity,
  DisputeResult,
  DisputeStatus,
  DisputeType,
  EscrowEntity,
  EscrowStatus,
  MilestoneEntity,
  MilestoneStatus,
  ProjectEntity,
  ProjectStatus,
  TransactionEntity,
  TransactionType,
  UserEntity,
  WalletEntity,
  WalletStatus,
} from 'src/database/entities';
import {
  DisputeSettlementEntity,
  SettlementStatus,
} from 'src/database/entities/dispute-settlement.entity';
import { SettlementService } from './settlement.service';
import { recordEvidence } from '../../../../test/fe16-fe18/evidence-recorder';

describe('SettlementService', () => {
  let service: SettlementService;
  let settlementRepository: any;
  let disputeRepository: any;
  let eventEmitter: any;

  const repoMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: getRepositoryToken(DisputeSettlementEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EscrowEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(SettlementService);
    settlementRepository = module.get(getRepositoryToken(DisputeSettlementEntity));
    disputeRepository = module.get(getRepositoryToken(DisputeEntity));
    eventEmitter = module.get(EventEmitter2);
  });

  it('validates exact settlement distribution and computes the fee breakdown', () => {
    const result = service.validateMoneyLogic(95, 25, 120);

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        breakdown: expect.objectContaining({
          amountToFreelancer: 95,
          amountToClient: 25,
          freelancerFee: 4.75,
          clientFee: 0,
          totalPlatformFee: 4.75,
          freelancerNetAmount: 90.25,
          clientNetAmount: 25,
        }),
      }),
    );
    recordEvidence({
      id: 'FE17-SET-01',
      evidenceRef: 'settlement.service.spec.ts::validateMoneyLogic',
      actualResults:
        'SettlementService.validateMoneyLogic accepted a 95/25 split over a 120 funded balance and returned a precise fee breakdown with freelancerFee=4.75, totalPlatformFee=4.75, and freelancerNetAmount=90.25.',
    });
  });

  it('blocks settlement eligibility when a pending offer already exists', async () => {
    disputeRepository.findOne.mockResolvedValue({
      id: 'dispute-1',
      status: DisputeStatus.OPEN,
      raisedById: 'client-1',
      defendantId: 'freelancer-1',
    });
    settlementRepository.findOne.mockResolvedValue({
      id: 'settlement-1',
      disputeId: 'dispute-1',
      status: SettlementStatus.PENDING,
    });

    const result = await service.checkSettlementEligibility('dispute-1', 'client-1');

    expect(result).toEqual(
      expect.objectContaining({
        eligible: false,
        reason: 'A pending settlement offer already exists',
      }),
    );
    recordEvidence({
      id: 'FE17-SET-02',
      evidenceRef: 'settlement.service.spec.ts::checkSettlementEligibility pending offer',
      actualResults:
        'SettlementService.checkSettlementEligibility returned eligible=false with reason=\"A pending settlement offer already exists\" when the dispute already had a pending settlement row.',
    });
  });

  it('executes settlement transfers and finalizes escrow on acceptance', async () => {
    const settlement = {
      id: 'settlement-1',
      amountToFreelancer: 95,
      amountToClient: 25,
      platformFee: 4.75,
    } as DisputeSettlementEntity;

    const dispute = {
      id: 'dispute-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      disputeType: DisputeType.CLIENT_VS_FREELANCER,
    } as DisputeEntity;

    const escrow = {
      id: 'escrow-1',
      milestoneId: 'milestone-1',
      fundedAmount: 120,
      totalAmount: 120,
      currency: 'USD',
      status: EscrowStatus.DISPUTED,
      releasedAmount: 0,
      releaseTransactionIds: [],
    } as unknown as EscrowEntity;

    const project = {
      id: 'project-1',
      clientId: 'client-1',
      freelancerId: 'freelancer-1',
      brokerId: null,
      status: ProjectStatus.IN_PROGRESS,
      currency: 'USD',
    } as ProjectEntity;

    const milestone = {
      id: 'milestone-1',
      status: MilestoneStatus.IN_PROGRESS,
    } as MilestoneEntity;

    const wallets = new Map<string, any>([
      [
        'client-1',
        {
          id: 'wallet-client',
          userId: 'client-1',
          balance: 0,
          pendingBalance: 0,
          heldBalance: 120,
          totalSpent: 0,
          totalEarned: 0,
          currency: 'USD',
          status: WalletStatus.ACTIVE,
        },
      ],
    ]);

    const savedTransactions: any[] = [];

    const escrowQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(escrow),
    };

    const walletQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation((_clause: string, params: { userId: string }) => {
        (walletQueryBuilder as any).__userId = params.userId;
        return walletQueryBuilder;
      }),
      getOne: jest
        .fn()
        .mockImplementation(async () => wallets.get((walletQueryBuilder as any).__userId) || null),
    };

    const escrowRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(escrowQueryBuilder),
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const projectRepo = {
      findOne: jest.fn().mockResolvedValue(project),
    };

    const milestoneRepo = {
      findOne: jest.fn().mockResolvedValue(milestone),
    };

    const walletRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(walletQueryBuilder),
      create: jest.fn().mockImplementation((payload) => ({
        id: `wallet-${payload.userId}`,
        balance: 0,
        pendingBalance: 0,
        heldBalance: 0,
        totalSpent: 0,
        totalEarned: 0,
        ...payload,
      })),
      save: jest.fn().mockImplementation(async (wallet) => {
        wallets.set(wallet.userId, wallet);
        return wallet;
      }),
    };

    const transactionRepo = {
      create: jest.fn().mockImplementation((payload) => payload),
      save: jest.fn().mockImplementation(async (tx) => {
        const withId = { id: `tx-${savedTransactions.length + 1}`, ...tx };
        savedTransactions.push(withId);
        return withId;
      }),
    };

    const userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'platform-owner' }),
    };

    const manager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === EscrowEntity) return escrowRepo;
        if (entity === ProjectEntity) return projectRepo;
        if (entity === MilestoneEntity) return milestoneRepo;
        if (entity === WalletEntity) return walletRepo;
        if (entity === TransactionEntity) return transactionRepo;
        if (entity === UserEntity) return userRepo;
        throw new Error(`Unexpected repository request: ${entity?.name ?? 'unknown'}`);
      }),
      save: jest.fn().mockImplementation(async (_entity, value) => value),
    };

    const outcome = await (service as any).executeSettlementTransfers(manager, settlement, dispute);

    expect(wallets.get('client-1').heldBalance).toBe(0);
    expect(wallets.get('client-1').balance).toBe(25);
    expect(wallets.get('freelancer-1').balance).toBe(90.25);
    expect(wallets.get('platform-owner').balance).toBe(4.75);

    expect(escrow.status).toBe(EscrowStatus.RELEASED);
    expect(escrow.releasedAmount).toBe(95);
    expect(Array.isArray(escrow.releaseTransactionIds)).toBe(true);
    expect((escrow.releaseTransactionIds || []).length).toBeGreaterThanOrEqual(4);

    expect(savedTransactions.some((tx) => tx.type === TransactionType.REFUND)).toBe(true);
    expect(savedTransactions.some((tx) => tx.type === TransactionType.ESCROW_RELEASE)).toBe(true);
    expect(savedTransactions.some((tx) => tx.type === TransactionType.FEE_DEDUCTION)).toBe(true);

    expect(project.status).toBe(ProjectStatus.CANCELED);
    expect(milestone.status).toBe(MilestoneStatus.PAID);
    expect(outcome).toEqual(
      expect.objectContaining({
        result: DisputeResult.SPLIT,
        projectStatus: ProjectStatus.CANCELED,
        milestoneStatus: MilestoneStatus.PAID,
      }),
    );
  });

  it('writes dispute result when settlement is accepted and prepares post-commit payloads', async () => {
    const settlement = {
      id: 'settlement-accept-1',
      proposerId: 'client-1',
      responderId: 'freelancer-1',
      amountToFreelancer: 0,
      amountToClient: 120,
      platformFee: 0,
      status: SettlementStatus.PENDING,
    } as unknown as DisputeSettlementEntity;

    const dispute = {
      id: 'dispute-accept-1',
      status: DisputeStatus.IN_MEDIATION,
      result: DisputeResult.PENDING,
      acceptedSettlementId: null,
      resolvedAt: null,
    } as unknown as DisputeEntity;

    const manager = {
      save: jest.fn().mockImplementation(async (value) => value),
    };

    jest.spyOn(service as any, 'executeSettlementTransfers').mockResolvedValue({
      result: DisputeResult.WIN_CLIENT,
      projectStatus: ProjectStatus.CANCELED,
      milestoneStatus: MilestoneStatus.LOCKED,
      workflowRealtimePayload: {
        projectId: 'project-1',
        requestId: null,
        participantIds: ['client-1', 'freelancer-1'],
      },
    });

    let acceptedPayload: any = null;
    let workflowPayload: any = null;

    await (service as any).processAcceptSettlement(manager as any, settlement, dispute, {
      onAcceptedEventPrepared: (payload: any) => {
        acceptedPayload = payload;
      },
      onWorkflowCommitted: (payload: any) => {
        workflowPayload = payload;
      },
    });

    expect(dispute.status).toBe(DisputeStatus.RESOLVED);
    expect(dispute.result).toBe(DisputeResult.WIN_CLIENT);
    expect(dispute.acceptedSettlementId).toBe(settlement.id);
    expect(dispute.resolvedAt).toBeInstanceOf(Date);

    expect(acceptedPayload).toEqual(
      expect.objectContaining({
        disputeId: dispute.id,
        result: DisputeResult.WIN_CLIENT,
        projectStatus: ProjectStatus.CANCELED,
        milestoneStatus: MilestoneStatus.LOCKED,
      }),
    );
    expect(workflowPayload).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
      }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
