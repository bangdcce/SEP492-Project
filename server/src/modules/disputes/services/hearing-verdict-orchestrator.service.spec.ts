import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DisputeEntity,
  DisputeHearingEntity,
  DisputeResult,
  EscrowEntity,
  HearingParticipantEntity,
  HearingStatus,
  UserRole,
} from 'src/database/entities';
import { HearingVerdictOrchestratorService } from './hearing-verdict-orchestrator.service';
import { HearingService } from './hearing.service';
import { VerdictService } from './verdict.service';
import { VerdictReadinessService } from './verdict-readiness.service';

describe('HearingVerdictOrchestratorService', () => {
  let service: HearingVerdictOrchestratorService;

  let disputeRepo: any;
  let hearingRepo: any;
  let escrowRepo: any;
  let hearingParticipantRepo: any;
  let hearingService: any;
  let verdictService: any;
  let verdictReadinessService: any;

  const repoMock = () => ({
    findOne: jest.fn(),
    exist: jest.fn(),
  });

  const baseReadiness = {
    canIssueVerdict: true,
    checklist: ['hearing-active', 'minutes-ready'],
    blockingChecklist: [],
    unmetChecklist: [],
    unmetChecklistDetails: [],
    absentRequiredParticipants: [],
    context: {
      disputeId: 'dispute-1',
    },
  };

  const baseDto = () =>
    ({
      closeHearing: {
        summary: 'Summary of hearing.',
        findings: 'Findings of hearing.',
        pendingActions: [],
        forceEnd: false,
      },
      verdict: {
        result: DisputeResult.SPLIT,
        faultType: 'QUALITY_MISMATCH',
        faultyParty: 'defendant',
        reasoning: {
          violatedPolicies: ['POL-1: Quality obligations breached'],
          factualFindings: 'Facts',
          legalAnalysis: 'Analysis',
          conclusion: 'Conclusion',
        },
        splitRatioClient: 40,
        adminComment: 'Final verdict issued.',
      },
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HearingVerdictOrchestratorService,
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeHearingEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EscrowEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingParticipantEntity), useValue: repoMock() },
        {
          provide: HearingService,
          useValue: {
            endHearing: jest.fn(),
          },
        },
        {
          provide: VerdictService,
          useValue: {
            issueVerdict: jest.fn(),
          },
        },
        {
          provide: VerdictReadinessService,
          useValue: {
            evaluateHearingReadiness: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(HearingVerdictOrchestratorService);
    disputeRepo = module.get(getRepositoryToken(DisputeEntity));
    hearingRepo = module.get(getRepositoryToken(DisputeHearingEntity));
    escrowRepo = module.get(getRepositoryToken(EscrowEntity));
    hearingParticipantRepo = module.get(getRepositoryToken(HearingParticipantEntity));
    hearingService = module.get(HearingService);
    verdictService = module.get(VerdictService);
    verdictReadinessService = module.get(VerdictReadinessService);

    hearingRepo.findOne.mockResolvedValue({
      id: 'hearing-1',
      disputeId: 'dispute-1',
      moderatorId: 'staff-1',
      status: HearingStatus.IN_PROGRESS,
    });
    disputeRepo.findOne.mockResolvedValue({
      id: 'dispute-1',
      raisedById: 'client-1',
      defendantId: 'freelancer-1',
      assignedStaffId: 'staff-1',
      escalatedToAdminId: null,
      milestoneId: 'milestone-1',
    });
    hearingParticipantRepo.exist.mockResolvedValue(false);
    verdictReadinessService.evaluateHearingReadiness.mockResolvedValue(baseReadiness);
    escrowRepo.findOne.mockResolvedValue({
      id: 'escrow-1',
      fundedAmount: 120,
      totalAmount: 120,
      platformFee: 20,
    });
    verdictService.issueVerdict.mockResolvedValue({
      verdict: { id: 'verdict-1' },
      distribution: {
        clientAmount: 40,
        freelancerAmount: 60,
        brokerAmount: 0,
        platformFee: 20,
        totalAmount: 120,
      },
      transfers: [
        { id: 'tx-1', type: 'REFUND', amount: 40, walletId: 'wallet-client', status: 'PENDING' },
        {
          id: 'tx-2',
          type: 'ESCROW_RELEASE',
          amount: 60,
          walletId: 'wallet-freelancer',
          status: 'PENDING',
        },
      ],
    });
    hearingService.endHearing.mockResolvedValue({
      hearing: {
        id: 'hearing-1',
        status: 'ENDED',
      },
    });
  });

  it('forbids staff who is not the assigned moderator from issuing a verdict', async () => {
    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-2', UserRole.STAFF, baseDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admins to issue a hearing verdict even when they are not the assigned moderator', async () => {
    await service.issueHearingVerdict('hearing-1', 'admin-1', UserRole.ADMIN, baseDto());

    expect(verdictService.issueVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: 'dispute-1',
        result: DisputeResult.SPLIT,
      }),
      'admin-1',
      UserRole.ADMIN,
    );
  });

  it('rejects verdict issuance when the hearing is not active', async () => {
    hearingRepo.findOne.mockResolvedValue({
      id: 'hearing-1',
      disputeId: 'dispute-1',
      moderatorId: 'staff-1',
      status: HearingStatus.SCHEDULED,
    });

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, baseDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects verdict issuance when the hearing readiness checklist is unmet', async () => {
    verdictReadinessService.evaluateHearingReadiness.mockResolvedValue({
      ...baseReadiness,
      canIssueVerdict: false,
      blockingChecklist: ['minutes-ready'],
      unmetChecklist: ['minutes-ready'],
      unmetChecklistDetails: ['Minutes are incomplete'],
    });

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, baseDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires summary and findings before issuing the final verdict', async () => {
    const dto = baseDto();
    dto.closeHearing.summary = ' ';

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a no-show note when required participants are absent', async () => {
    verdictReadinessService.evaluateHearingReadiness.mockResolvedValue({
      ...baseReadiness,
      absentRequiredParticipants: ['client-1'],
    });

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, baseDto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one violated policy in the verdict reasoning', async () => {
    const dto = baseDto();
    dto.verdict.reasoning.violatedPolicies = [];

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a verdict result before issuing the final decision', async () => {
    const dto = baseDto();
    delete dto.verdict.result;
    delete dto.verdict.verdict;

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes split amounts from splitRatioClient and delegates verdict issuance and hearing close', async () => {
    const result = await service.issueHearingVerdict(
      'hearing-1',
      'staff-1',
      UserRole.STAFF,
      baseDto(),
    );

    expect(verdictService.issueVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId: 'dispute-1',
        result: DisputeResult.SPLIT,
        amountToClient: 40,
        amountToFreelancer: 60,
      }),
      'staff-1',
      UserRole.STAFF,
    );
    expect(hearingService.endHearing).toHaveBeenCalledWith(
      expect.objectContaining({
        hearingId: 'hearing-1',
        summary: 'Summary of hearing.',
        findings: 'Findings of hearing.',
      }),
      'staff-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        verdict: { id: 'verdict-1' },
        hearing: { id: 'hearing-1', status: 'ENDED' },
        transferSummary: expect.objectContaining({
          transferCount: 2,
        }),
      }),
    );
  });

  it('uses explicitly provided payout amounts instead of recomputing the split', async () => {
    const dto = baseDto();
    dto.verdict.amountToClient = 15;
    dto.verdict.amountToFreelancer = 85;
    dto.verdict.splitRatioClient = 40;

    await service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, dto);

    expect(verdictService.issueVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        amountToClient: 15,
        amountToFreelancer: 85,
      }),
      'staff-1',
      UserRole.STAFF,
    );
  });

  it('supports the lower split boundary when splitRatioClient is 0', async () => {
    const dto = baseDto();
    dto.verdict.splitRatioClient = 0;

    await service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, dto);

    expect(verdictService.issueVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        amountToClient: 0,
        amountToFreelancer: 100,
      }),
      'staff-1',
      UserRole.STAFF,
    );
  });

  it('supports the upper split boundary when splitRatioClient is 100', async () => {
    const dto = baseDto();
    dto.verdict.splitRatioClient = 100;

    await service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, dto);

    expect(verdictService.issueVerdict).toHaveBeenCalledWith(
      expect.objectContaining({
        amountToClient: 100,
        amountToFreelancer: 0,
      }),
      'staff-1',
      UserRole.STAFF,
    );
  });

  it('rejects verdict issuance when the escrow record for the hearing milestone is missing', async () => {
    escrowRepo.findOne.mockResolvedValue(null);

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, baseDto()),
    ).rejects.toThrow('Escrow for milestone milestone-1 not found');
  });

  it('rejects verdict issuance when the platform fee exceeds the funded amount', async () => {
    escrowRepo.findOne.mockResolvedValue({
      id: 'escrow-1',
      fundedAmount: 50,
      totalAmount: 50,
      platformFee: 60,
    });

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, baseDto()),
    ).rejects.toThrow('Platform fee exceeds funded amount');
  });

  it('surfaces a conflict when verdict issuance succeeds but hearing auto-close fails', async () => {
    hearingService.endHearing.mockRejectedValue(new Error('minutes persistence failed'));

    await expect(
      service.issueHearingVerdict('hearing-1', 'staff-1', UserRole.STAFF, baseDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
