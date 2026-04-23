import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ContractEntity,
  DisputeActivityEntity,
  DisputeCategory,
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeHearingEntity,
  DisputeInternalMembershipEntity,
  DisputeLedgerEntity,
  DisputeMessageEntity,
  DisputeNoteEntity,
  DisputePartyEntity,
  DisputeResult,
  DisputeScheduleProposalEntity,
  DisputeStatus,
  DisputeType,
  DisputeVerdictEntity,
  DisputeViewStateEntity,
  EscrowEntity,
  EscrowStatus,
  EventParticipantEntity,
  HearingStatus,
  HearingParticipantEntity,
  HearingQuestionEntity,
  LegalSignatureEntity,
  MilestoneEntity,
  MilestoneStatus,
  StaffRecommendation,
  ProjectEntity,
  TaskEntity,
  TransactionEntity,
  UserEntity,
  UserRole,
  WalletEntity,
} from 'src/database/entities';
import { DataSource } from 'typeorm';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserWarningService } from '../user-warning/user-warning.service';
import { SettlementService } from './services/settlement.service';
import { HearingService } from './services/hearing.service';
import { VerdictService } from './services/verdict.service';
import { VerdictReadinessService } from './services/verdict-readiness.service';
import { StaffAssignmentService } from './services/staff-assignment.service';
import { CalendarService } from '../calendar/calendar.service';
import { DisputesService } from './disputes.service';
import { DISPUTE_DISCLAIMER_VERSION } from './dispute-legal';
import { recordEvidence } from '../../../test/fe16-fe18/evidence-recorder';

describe('DisputesService', () => {
  let service: DisputesService;

  let disputeRepo: any;
  let hearingRepo: any;
  let hearingParticipantRepo: any;
  let disputePartyRepo: any;
  let disputeScheduleProposalRepo: any;
  let disputeInternalMembershipRepo: any;
  let activityRepo: any;
  let evidenceRepo: any;
  let messageRepo: any;
  let contractRepo: any;
  let userRepo: any;
  let projectRepo: any;
  let verdictRepo: any;
  let legalSignatureRepo: any;
  let dataSource: any;
  let verdictService: any;
  let hearingService: any;
  let auditLogsService: any;
  let staffAssignmentService: any;
  let calendarService: any;
  let eventEmitter: any;

  const repoMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exist: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const readZipEntries = async (buffer: Buffer): Promise<Record<string, string>> => {
    const yauzl = require('yauzl');

    return await new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError: Error | null, zipfile: any) => {
        if (openError || !zipfile) {
          reject(openError || new Error('Failed to open zip buffer'));
          return;
        }

        const entries: Record<string, string> = {};
        zipfile.readEntry();

        zipfile.on('entry', (entry: any) => {
          zipfile.openReadStream(entry, (streamError: Error | null, stream: any) => {
            if (streamError || !stream) {
              reject(streamError || new Error(`Failed to read zip entry ${entry.fileName}`));
              return;
            }

            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => {
              entries[entry.fileName] = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            stream.on('error', reject);
          });
        });

        zipfile.on('end', () => resolve(entries));
        zipfile.on('error', reject);
      });
    });
  };

  const createQueryRunnerMock = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      findOne: jest.fn(),
      find: jest.fn(),
    },
  });

  beforeEach(async () => {
    legalSignatureRepo = repoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: getRepositoryToken(MilestoneEntity), useValue: repoMock() },
        { provide: getRepositoryToken(TaskEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProjectEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ContractEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEvidenceEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeMessageEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeHearingEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingParticipantEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingQuestionEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeVerdictEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EscrowEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: getRepositoryToken(WalletEntity), useValue: repoMock() },
        { provide: getRepositoryToken(TransactionEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeNoteEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeActivityEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeLedgerEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputePartyEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeScheduleProposalEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeViewStateEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeInternalMembershipEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EventParticipantEntity), useValue: repoMock() },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
            createQueryRunner: jest.fn(),
            getRepository: jest.fn((entity) => {
              if (entity === LegalSignatureEntity) {
                return legalSignatureRepo;
              }
              throw new Error('Unexpected repository');
            }),
          },
        },
        { provide: TrustScoreService, useValue: {} },
        {
          provide: AuditLogsService,
          useValue: { logCustom: jest.fn(), findAllForExport: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: UserWarningService, useValue: {} },
        { provide: SettlementService, useValue: {} },
        {
          provide: HearingService,
          useValue: {
            scheduleHearing: jest.fn(),
            rescheduleHearing: jest.fn(),
            determineRequiredParticipants: jest.fn(),
          },
        },
        {
          provide: VerdictService,
          useValue: {
            getVerdictByDisputeId: jest.fn(),
            appealVerdict: jest.fn(),
            issueAppealVerdict: jest.fn(),
          },
        },
        { provide: VerdictReadinessService, useValue: {} },
        { provide: StaffAssignmentService, useValue: { estimateDisputeComplexity: jest.fn() } },
        { provide: CalendarService, useValue: { findAvailableSlots: jest.fn() } },
      ],
    }).compile();

    service = module.get(DisputesService);

    disputeRepo = module.get(getRepositoryToken(DisputeEntity));
    hearingRepo = module.get(getRepositoryToken(DisputeHearingEntity));
    hearingParticipantRepo = module.get(getRepositoryToken(HearingParticipantEntity));
    disputePartyRepo = module.get(getRepositoryToken(DisputePartyEntity));
    disputeScheduleProposalRepo = module.get(getRepositoryToken(DisputeScheduleProposalEntity));
    disputeInternalMembershipRepo = module.get(getRepositoryToken(DisputeInternalMembershipEntity));
    activityRepo = module.get(getRepositoryToken(DisputeActivityEntity));
    evidenceRepo = module.get(getRepositoryToken(DisputeEvidenceEntity));
    messageRepo = module.get(getRepositoryToken(DisputeMessageEntity));
    contractRepo = module.get(getRepositoryToken(ContractEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    projectRepo = module.get(getRepositoryToken(ProjectEntity));
    verdictRepo = module.get(getRepositoryToken(DisputeVerdictEntity));
    dataSource = module.get(DataSource);
    verdictService = module.get(VerdictService);
    hearingService = module.get(HearingService);
    auditLogsService = module.get(AuditLogsService);
    staffAssignmentService = module.get(StaffAssignmentService);
    calendarService = module.get(CalendarService);
    eventEmitter = module.get(EventEmitter2);

    verdictRepo.find.mockResolvedValue([]);
    legalSignatureRepo.find.mockResolvedValue([]);
    disputeInternalMembershipRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([]);
    hearingRepo.find.mockResolvedValue([]);
    messageRepo.find.mockResolvedValue([]);
    auditLogsService.logCustom.mockResolvedValue(undefined);
    auditLogsService.findAllForExport.mockResolvedValue([]);
    staffAssignmentService.estimateDisputeComplexity.mockResolvedValue(null);
    hearingService.scheduleHearing.mockReset();
    hearingService.rescheduleHearing.mockReset();
    hearingService.determineRequiredParticipants.mockReset();
    calendarService.findAvailableSlots.mockReset();
    hearingParticipantRepo.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDetail', () => {
    it('denies staff outside scope', async () => {
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        assignedStaffId: 'staff-2',
        escalatedToAdminId: null,
        groupId: null,
      });
      disputeInternalMembershipRepo.findOne.mockResolvedValue(null);
      disputePartyRepo.findOne.mockResolvedValue(null);

      await expect(service.getDetail('d-1', 'staff-1', UserRole.STAFF)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows assigned staff access', async () => {
      const dispute = {
        id: 'd-1',
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        assignedStaffId: 'staff-1',
        escalatedToAdminId: null,
        groupId: null,
      };
      disputeRepo.findOne.mockResolvedValue(dispute);

      await expect(service.getDetail('d-1', 'staff-1', UserRole.STAFF)).resolves.toEqual(
        expect.objectContaining({
          ...dispute,
          allowedActions: expect.arrayContaining(['VIEW_CASE', 'VIEW_DOCKET']),
          isReadOnly: false,
        }),
      );
    });
  });

  describe('deadline enrichment', () => {
    it('adds hoursUntilDeadline for paginated dispute list results', async () => {
      const futureDeadline = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'd-1',
            resolutionDeadline: futureDeadline,
          },
        ]),
      };

      const result = await (service as any).applyFiltersAndPaginate(qb, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 'd-1',
          resolutionDeadline: futureDeadline,
          isOverdue: false,
          isUrgent: true,
          hoursUntilDeadline: expect.any(Number),
        }),
      );
      expect(result.data[0].hoursUntilDeadline).toBeGreaterThan(0);
    });
  });

  describe('post-delivery dispute status gates', () => {
    it('allows communication disputes for completed milestones', () => {
      const statuses = (service as any).getAllowedMilestoneStatusesForDispute(
        DisputeCategory.COMMUNICATION,
      );

      expect(statuses).toEqual(
        expect.arrayContaining([MilestoneStatus.COMPLETED, MilestoneStatus.PAID]),
      );
    });

    it('allows quality disputes for paid milestones', () => {
      const statuses = (service as any).getAllowedMilestoneStatusesForDispute(
        DisputeCategory.QUALITY,
      );

      expect(statuses).toEqual(
        expect.arrayContaining([MilestoneStatus.COMPLETED, MilestoneStatus.PAID]),
      );
    });
  });

  describe('payment dispute escrow gates', () => {
    const buildExecutionSignal = () => ({
      totalTasks: 2,
      completedTasks: 1,
      proofTasks: 1,
      milestoneHasProof: false,
      progressPercent: 50,
      hasMeaningfulWork: true,
    });

    it('rejects payment disputes when escrow is already released', () => {
      const result = (service as any).evaluateDisputeEligibility({
        category: DisputeCategory.PAYMENT,
        milestone: { status: MilestoneStatus.PAID },
        escrow: { status: EscrowStatus.RELEASED },
        executionSignal: buildExecutionSignal(),
        now: new Date(),
      });

      expect(result).toEqual(
        expect.objectContaining({
          allowed: false,
        }),
      );
      expect(result.reason).toContain('FUNDED/DISPUTED');
    });

    it('allows payment disputes when escrow is funded', () => {
      const result = (service as any).evaluateDisputeEligibility({
        category: DisputeCategory.PAYMENT,
        milestone: { status: MilestoneStatus.IN_PROGRESS },
        escrow: { status: EscrowStatus.FUNDED },
        executionSignal: buildExecutionSignal(),
        now: new Date(),
      });

      expect(result).toEqual(
        expect.objectContaining({
          allowed: true,
        }),
      );
    });
  });

  describe('cancel dispute milestone status restore', () => {
    it('restores PENDING_CLIENT_APPROVAL when broker already accepted before lock', () => {
      const status = (service as any).resolveMilestoneStatusAfterCancel(
        {
          submittedAt: new Date('2026-04-01T08:00:00.000Z'),
          proofOfWork: 'https://repo.example/work',
          reviewedByStaffId: 'broker-1',
          staffRecommendation: StaffRecommendation.ACCEPT,
        } as MilestoneEntity,
        {
          brokerId: 'broker-1',
          clientId: 'client-1',
        } as ProjectEntity,
      );

      expect(status).toBe(MilestoneStatus.PENDING_CLIENT_APPROVAL);
    });

    it('restores PENDING_CLIENT_APPROVAL for legacy broker-approved snapshots missing recommendation enum', () => {
      const status = (service as any).resolveMilestoneStatusAfterCancel(
        {
          submittedAt: new Date('2026-04-01T08:00:00.000Z'),
          proofOfWork: 'https://repo.example/work',
          reviewedByStaffId: 'broker-1',
          staffRecommendation: null,
          staffReviewNote: 'Approved by broker (legacy)',
        } as MilestoneEntity,
        {
          brokerId: 'broker-1',
          clientId: 'client-1',
        } as ProjectEntity,
      );

      expect(status).toBe(MilestoneStatus.PENDING_CLIENT_APPROVAL);
    });

    it('restores IN_PROGRESS when broker explicitly rejected even if proof links remain', () => {
      const status = (service as any).resolveMilestoneStatusAfterCancel(
        {
          submittedAt: null,
          proofOfWork: 'https://repo.example/work',
          reviewedByStaffId: 'broker-1',
          staffRecommendation: StaffRecommendation.REJECT,
          staffReviewNote: 'Needs major fixes',
        } as unknown as MilestoneEntity,
        {
          brokerId: 'broker-1',
          clientId: 'client-1',
        } as ProjectEntity,
      );

      expect(status).toBe(MilestoneStatus.IN_PROGRESS);
    });

    it('restores PENDING_STAFF_REVIEW when broker review is required but not completed', () => {
      const status = (service as any).resolveMilestoneStatusAfterCancel(
        {
          submittedAt: new Date('2026-04-01T08:00:00.000Z'),
          proofOfWork: 'https://repo.example/work',
          reviewedByStaffId: null,
          staffRecommendation: null,
        } as MilestoneEntity,
        {
          brokerId: 'broker-1',
          clientId: 'client-1',
        } as ProjectEntity,
      );

      expect(status).toBe(MilestoneStatus.PENDING_STAFF_REVIEW);
    });

    it('restores SUBMITTED when no broker review is required', () => {
      const status = (service as any).resolveMilestoneStatusAfterCancel(
        {
          submittedAt: new Date('2026-04-01T08:00:00.000Z'),
          proofOfWork: 'https://repo.example/work',
          reviewedByStaffId: null,
          staffRecommendation: null,
        } as MilestoneEntity,
        {
          brokerId: 'client-1',
          clientId: 'client-1',
        } as ProjectEntity,
      );

      expect(status).toBe(MilestoneStatus.SUBMITTED);
    });

    it('restores IN_PROGRESS when there is no submission evidence', () => {
      const status = (service as any).resolveMilestoneStatusAfterCancel(
        {
          submittedAt: null,
          proofOfWork: null,
          reviewedByStaffId: null,
          staffRecommendation: null,
        } as unknown as MilestoneEntity,
        {
          brokerId: 'broker-1',
          clientId: 'client-1',
        } as ProjectEntity,
      );

      expect(status).toBe(MilestoneStatus.IN_PROGRESS);
    });
  });

  describe('getVerdict', () => {
    it('normalizes missing reasoning fields for legacy verdict records', async () => {
      verdictService.getVerdictByDisputeId.mockResolvedValue({
        id: 'v-1',
        disputeId: 'd-1',
        adjudicatorId: 'staff-1',
        adjudicatorRole: UserRole.STAFF,
        faultType: 'OTHER',
        faultyParty: 'defendant',
        reasoning: null,
        amountToFreelancer: 25,
        amountToClient: 75,
        platformFee: 0,
        trustScorePenalty: null,
        isBanTriggered: null,
        banDurationDays: null,
        warningMessage: null,
        tier: 1,
        isAppealVerdict: false,
        overridesVerdictId: null,
        issuedAt: new Date('2026-03-15T10:00:00.000Z'),
      });
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        result: 'WIN_CLIENT',
        appealDeadline: null,
        isAppealed: false,
        appealReason: null,
        appealedAt: null,
        appealResolvedAt: null,
        appealResolvedById: null,
        appealResolution: null,
        status: DisputeStatus.RESOLVED,
        currentTier: 1,
      });

      const result = await service.getVerdict('d-1');

      expect(result).toEqual({
        data: expect.objectContaining({
          id: 'v-1',
          result: 'WIN_CLIENT',
          reasoning: expect.objectContaining({
            violatedPolicies: [],
            supportingEvidenceIds: [],
            factualFindings: '',
            legalAnalysis: '',
            conclusion: '',
            policyReferences: [],
            legalReferences: [],
            contractReferences: [],
            evidenceReferences: [],
            analysis: '',
            remedyRationale: '',
            trustPenaltyRationale: '',
          }),
        }),
      });
    });

    it('returns acceptance state and blocks appeal for a party that already accepted the verdict', async () => {
      verdictService.getVerdictByDisputeId.mockResolvedValue({
        id: 'v-1',
        disputeId: 'd-1',
        adjudicatorId: 'staff-1',
        adjudicatorRole: UserRole.STAFF,
        faultType: 'OTHER',
        faultyParty: 'defendant',
        reasoning: {
          violatedPolicies: ['POL-1'],
          factualFindings: 'facts',
          legalAnalysis: 'analysis',
          conclusion: 'conclusion',
        },
        amountToFreelancer: 25,
        amountToClient: 75,
        platformFee: 0,
        trustScorePenalty: null,
        isBanTriggered: null,
        banDurationDays: null,
        warningMessage: null,
        tier: 1,
        isAppealVerdict: false,
        overridesVerdictId: null,
        issuedAt: new Date('2026-03-15T10:00:00.000Z'),
      });
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        result: 'WIN_CLIENT',
        appealDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isAppealed: false,
        appealReason: null,
        appealedAt: null,
        appealResolvedAt: null,
        appealResolvedById: null,
        appealResolution: null,
        status: DisputeStatus.RESOLVED,
        currentTier: 1,
      });
      legalSignatureRepo.find.mockResolvedValue([
        {
          disputeId: 'd-1',
          signerId: 'raiser-1',
          signerRole: UserRole.CLIENT,
          referenceId: 'v-1',
          signedAt: new Date('2026-03-15T11:00:00.000Z'),
        },
      ]);

      const result = await service.getVerdict('d-1', 'raiser-1', UserRole.CLIENT);

      expect(result).toEqual({
        data: expect.objectContaining({
          id: 'v-1',
          acceptance: expect.objectContaining({
            acceptedPartyIds: ['raiser-1'],
            currentUserAccepted: true,
            currentUserCanAccept: false,
            currentUserCanAppeal: false,
            allPartiesAccepted: false,
          }),
        }),
      });
    });

    it('disables appeal for the winning party even when they are a dispute participant', async () => {
      verdictService.getVerdictByDisputeId.mockResolvedValue({
        id: 'v-1',
        disputeId: 'd-1',
        adjudicatorId: 'staff-1',
        adjudicatorRole: UserRole.STAFF,
        faultType: 'OTHER',
        faultyParty: 'defendant',
        reasoning: {
          violatedPolicies: ['POL-1'],
          factualFindings: 'facts',
          legalAnalysis: 'analysis',
          conclusion: 'conclusion',
        },
        amountToFreelancer: 0,
        amountToClient: 100,
        platformFee: 0,
        trustScorePenalty: null,
        isBanTriggered: null,
        banDurationDays: null,
        warningMessage: null,
        tier: 1,
        isAppealVerdict: false,
        overridesVerdictId: null,
        issuedAt: new Date('2026-03-15T10:00:00.000Z'),
      });
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        raisedById: 'client-1',
        defendantId: 'freelancer-1',
        disputeType: DisputeType.CLIENT_VS_FREELANCER,
        result: DisputeResult.WIN_CLIENT,
        appealDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isAppealed: false,
        appealReason: null,
        appealedAt: null,
        appealResolvedAt: null,
        appealResolvedById: null,
        appealResolution: null,
        status: DisputeStatus.RESOLVED,
        currentTier: 1,
      });
      legalSignatureRepo.find.mockResolvedValue([]);

      const result = await service.getVerdict('d-1', 'client-1', UserRole.CLIENT);

      expect(result.data.acceptance).toEqual(
        expect.objectContaining({
          currentUserCanAppeal: false,
        }),
      );
    });

    it('keeps appeal enabled for the losing party while appeal window is open', async () => {
      verdictService.getVerdictByDisputeId.mockResolvedValue({
        id: 'v-1',
        disputeId: 'd-1',
        adjudicatorId: 'staff-1',
        adjudicatorRole: UserRole.STAFF,
        faultType: 'OTHER',
        faultyParty: 'defendant',
        reasoning: {
          violatedPolicies: ['POL-1'],
          factualFindings: 'facts',
          legalAnalysis: 'analysis',
          conclusion: 'conclusion',
        },
        amountToFreelancer: 0,
        amountToClient: 100,
        platformFee: 0,
        trustScorePenalty: null,
        isBanTriggered: null,
        banDurationDays: null,
        warningMessage: null,
        tier: 1,
        isAppealVerdict: false,
        overridesVerdictId: null,
        issuedAt: new Date('2026-03-15T10:00:00.000Z'),
      });
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        raisedById: 'client-1',
        defendantId: 'freelancer-1',
        disputeType: DisputeType.CLIENT_VS_FREELANCER,
        result: DisputeResult.WIN_CLIENT,
        appealDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isAppealed: false,
        appealReason: null,
        appealedAt: null,
        appealResolvedAt: null,
        appealResolvedById: null,
        appealResolution: null,
        status: DisputeStatus.RESOLVED,
        currentTier: 1,
      });
      legalSignatureRepo.find.mockResolvedValue([]);

      const result = await service.getVerdict('d-1', 'freelancer-1', UserRole.FREELANCER);

      expect(result.data.acceptance).toEqual(
        expect.objectContaining({
          currentUserCanAppeal: true,
        }),
      );
    });
  });

  describe('getDisputeDossier', () => {
    it('includes normalized contract references for linked project contracts', async () => {
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        projectId: 'p-1',
        milestoneId: 'm-1',
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        raiserRole: UserRole.CLIENT,
        defendantRole: UserRole.FREELANCER,
        status: DisputeStatus.RESOLVED,
        category: null,
        priority: null,
        reason: 'Delivery dispute',
        disputedAmount: 100,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        assignedStaffId: 'staff-1',
        project: { title: 'Project Alpha' },
        raiser: { fullName: 'Client One', email: 'client@example.com' },
        defendant: { fullName: 'Freelancer One', email: 'freelancer@example.com' },
      });
      jest.spyOn(service as any, 'assertDisputeAccess').mockResolvedValue(undefined);
      activityRepo.find.mockResolvedValue([]);
      evidenceRepo.find.mockResolvedValue([]);
      hearingRepo.find.mockResolvedValue([]);
      contractRepo.find.mockResolvedValue([
        {
          id: 'c-1',
          projectId: 'p-1',
          title: 'Master Services Agreement',
          status: 'ACTIVE',
          contractUrl: null,
          termsContent: 'Clause 1. Delivery obligations.',
          createdAt: new Date('2026-02-20T10:00:00.000Z'),
        },
      ]);

      const result = await service.getDisputeDossier('d-1', 'raiser-1', UserRole.CLIENT);

      expect(result.contracts).toEqual([
        expect.objectContaining({
          id: 'c-1',
          projectId: 'p-1',
          title: 'Master Services Agreement',
          contractUrl: expect.stringContaining('/contracts/c-1/pdf'),
          termsPreview: expect.stringContaining('Clause 1. Delivery obligations.'),
        }),
      ]);
    });
  });

  describe('exportDisputeDossier', () => {
    it('includes hearing room chat transcripts in the exported dossier package', async () => {
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        projectId: 'p-1',
        milestoneId: 'm-1',
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        raiserRole: UserRole.CLIENT,
        defendantRole: UserRole.FREELANCER,
        status: DisputeStatus.IN_MEDIATION,
        category: null,
        priority: null,
        reason: 'Delivery dispute',
        disputedAmount: 100,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        assignedStaffId: 'staff-1',
        project: { title: 'Project Alpha' },
        raiser: { fullName: 'Client One', email: 'client@example.com' },
        defendant: { fullName: 'Freelancer One', email: 'freelancer@example.com' },
      });
      jest.spyOn(service as any, 'assertDisputeAccess').mockResolvedValue(undefined);
      activityRepo.find.mockResolvedValue([]);
      evidenceRepo.find.mockResolvedValue([]);
      hearingRepo.find
        .mockResolvedValueOnce([
          {
            id: 'hearing-1',
            status: HearingStatus.IN_PROGRESS,
            scheduledAt: new Date('2026-03-10T10:00:00.000Z'),
            hearingNumber: 1,
            tier: 'TIER_1',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'hearing-1',
            status: HearingStatus.IN_PROGRESS,
            scheduledAt: new Date('2026-03-10T10:00:00.000Z'),
            startedAt: new Date('2026-03-10T10:05:00.000Z'),
            endedAt: null,
            hearingNumber: 1,
            tier: 'TIER_1',
          },
        ]);
      contractRepo.find.mockResolvedValue([]);
      messageRepo.find.mockResolvedValue([
        {
          id: 'msg-1',
          disputeId: 'd-1',
          hearingId: 'hearing-1',
          senderId: 'raiser-1',
          senderRole: UserRole.CLIENT,
          type: 'TEXT',
          content: 'This is my opening statement in chat.',
          replyToMessageId: null,
          relatedEvidenceId: null,
          attachedEvidenceIds: null,
          metadata: { phase: 'PRESENTATION' },
          isHidden: false,
          hiddenReason: null,
          createdAt: new Date('2026-03-10T10:06:00.000Z'),
          sender: {
            id: 'raiser-1',
            fullName: 'Client One',
            email: 'client@example.com',
          },
        },
      ]);
      hearingParticipantRepo.find.mockResolvedValue([
        {
          hearingId: 'hearing-1',
          userId: 'raiser-1',
          role: 'RAISER',
        },
      ]);
      auditLogsService.findAllForExport.mockResolvedValue([]);

      const exported = await service.exportDisputeDossier('d-1', 'raiser-1', UserRole.CLIENT);
      const zipEntries = await readZipEntries(exported.buffer);
      const manifest = JSON.parse(zipEntries['manifest.json']);
      const hearingTranscripts = JSON.parse(zipEntries['hearing-transcripts.json']);

      expect(exported.fileName).toBe('dispute-d-1-dossier.zip');
      expect(manifest.counts.hearingMessages).toBe(1);
      expect(hearingTranscripts).toEqual([
        expect.objectContaining({
          hearingId: 'hearing-1',
          hearingNumber: 1,
          messages: [
            expect.objectContaining({
              id: 'msg-1',
              senderId: 'raiser-1',
              senderHearingRole: 'RAISER',
              content: 'This is my opening statement in chat.',
            }),
          ],
        }),
      ]);
    });
  });

  describe('createGroup', () => {
    it('creates multiple disputes atomically and returns root/group info', async () => {
      const queryRunner = createQueryRunnerMock();
      queryRunner.manager.find.mockResolvedValue([]);
      dataSource.createQueryRunner.mockReturnValue(queryRunner);

      const createWithinTxSpy = jest
        .spyOn(service as any, 'createDisputeWithinTransaction')
        .mockResolvedValueOnce({
          dispute: {
            id: 'd-1',
            defendantId: 'def-1',
            parentDisputeId: null,
            groupId: 'd-1',
          },
          project: { id: 'p-1' },
          raiserRole: UserRole.CLIENT,
          defendantRole: UserRole.FREELANCER,
          raisedBy: 'raiser-1',
          defendantId: 'def-1',
          testBypassReason: null,
        })
        .mockResolvedValueOnce({
          dispute: {
            id: 'd-2',
            defendantId: 'def-2',
            parentDisputeId: 'd-1',
            groupId: 'd-1',
          },
          project: { id: 'p-1' },
          raiserRole: UserRole.CLIENT,
          defendantRole: UserRole.BROKER,
          raisedBy: 'raiser-1',
          defendantId: 'def-2',
          testBypassReason: null,
        });
      const postCreateSpy = jest
        .spyOn(service as any, 'runPostCreateSideEffects')
        .mockResolvedValue(undefined);

      const result = await service.createGroup('raiser-1', {
        projectId: 'p-1',
        milestoneId: 'm-1',
        reason: 'Detailed reason over twenty chars',
        category: 'OTHER' as any,
        evidence: ['proof.png'],
        defendantIds: ['def-1', 'def-2'],
      });

      expect(createWithinTxSpy).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(postCreateSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        rootDisputeId: 'd-1',
        groupId: 'd-1',
        createdCount: 2,
        disputes: [
          {
            id: 'd-1',
            defendantId: 'def-1',
            parentDisputeId: null,
          },
          {
            id: 'd-2',
            defendantId: 'def-2',
            parentDisputeId: 'd-1',
          },
        ],
      });
      recordEvidence({
        id: 'FE17-DIS-01',
        evidenceRef: 'disputes.service.spec.ts::createGroup success',
        actualResults:
          'DisputesService.createGroup created two grouped disputes in one transaction, committed once, and returned rootDisputeId=d-1 with createdCount=2.',
      });
    });

    it('returns 400 when request contains duplicate defendant ids', async () => {
      await expect(
        service.createGroup('raiser-1', {
          projectId: 'p-1',
          milestoneId: 'm-1',
          reason: 'Detailed reason over twenty chars',
          category: 'OTHER' as any,
          evidence: ['proof.png'],
          defendantIds: ['def-1', 'def-1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      recordEvidence({
        id: 'FE17-DIS-02',
        evidenceRef: 'disputes.service.spec.ts::duplicate defendant ids',
        actualResults:
          'DisputesService.createGroup rejected duplicate defendant ids with BadRequestException before any transactional grouped-dispute creation started.',
      });
    });

    it('returns conflict when defendant already has active dispute in milestone', async () => {
      const queryRunner = createQueryRunnerMock();
      queryRunner.manager.find.mockResolvedValue([
        {
          id: 'existing-1',
          defendantId: 'def-1',
          groupId: 'group-existing',
        },
      ]);
      dataSource.createQueryRunner.mockReturnValue(queryRunner);
      const createWithinTxSpy = jest.spyOn(service as any, 'createDisputeWithinTransaction');

      await expect(
        service.createGroup('raiser-1', {
          projectId: 'p-1',
          milestoneId: 'm-1',
          reason: 'Detailed reason over twenty chars',
          category: 'OTHER' as any,
          evidence: ['proof.png'],
          defendantIds: ['def-1', 'def-2'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(createWithinTxSpy).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('rolls back all when creating one of defendants fails', async () => {
      const queryRunner = createQueryRunnerMock();
      queryRunner.manager.find.mockResolvedValue([]);
      dataSource.createQueryRunner.mockReturnValue(queryRunner);

      jest
        .spyOn(service as any, 'createDisputeWithinTransaction')
        .mockResolvedValueOnce({
          dispute: {
            id: 'd-1',
            defendantId: 'def-1',
            parentDisputeId: null,
            groupId: 'd-1',
          },
          project: { id: 'p-1' },
          raiserRole: UserRole.CLIENT,
          defendantRole: UserRole.FREELANCER,
          raisedBy: 'raiser-1',
          defendantId: 'def-1',
          testBypassReason: null,
        })
        .mockRejectedValueOnce(new Error('insert failed'));
      const postCreateSpy = jest
        .spyOn(service as any, 'runPostCreateSideEffects')
        .mockResolvedValue(undefined);

      await expect(
        service.createGroup('raiser-1', {
          projectId: 'p-1',
          milestoneId: 'm-1',
          reason: 'Detailed reason over twenty chars',
          category: 'OTHER' as any,
          evidence: ['proof.png'],
          defendantIds: ['def-1', 'def-2'],
        }),
      ).rejects.toThrow('insert failed');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(postCreateSpy).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
      recordEvidence({
        id: 'FE17-DIS-03',
        evidenceRef: 'disputes.service.spec.ts::createGroup rollback',
        actualResults:
          'When the second grouped defendant insert failed, createGroup rolled back the query runner transaction once, skipped post-create side effects, and released the runner.',
      });
    });
  });

  describe('submitSchedulingProposals', () => {
    it('returns waiting gate when only one side submitted', async () => {
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.IN_MEDIATION,
        groupId: 'g-1',
        projectId: 'p-1',
        previewCompletedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        assignedStaffId: 'staff-1',
      });
      hearingRepo.exist.mockResolvedValue(false);
      disputeScheduleProposalRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ userId: 'raiser-1' }]);

      const result = await service.submitSchedulingProposals('d-1', 'raiser-1', UserRole.CLIENT);

      expect(result.submitted).toBe(0);
      expect(result.schedulingGate.triggered).toBe(false);
      expect(result.schedulingGate.mode).toBe('WAITING_PARTIES');
      expect(result.schedulingGate.waitingFor).toEqual(['DEFENDANT']);
    });

    it('triggers scheduling when both sides submitted', async () => {
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.IN_MEDIATION,
        groupId: 'g-1',
        projectId: 'p-1',
        previewCompletedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        assignedStaffId: 'staff-1',
      });
      hearingRepo.exist.mockResolvedValue(false);
      disputeScheduleProposalRepo.find
        .mockResolvedValueOnce([
          {
            id: 'sp-1',
            disputeId: 'd-1',
            userId: 'raiser-1',
            status: 'ACTIVE',
          },
        ])
        .mockResolvedValueOnce([{ userId: 'raiser-1' }, { userId: 'def-1' }]);
      disputeScheduleProposalRepo.save.mockResolvedValue([
        {
          id: 'sp-1',
          disputeId: 'd-1',
          userId: 'raiser-1',
          status: 'SUBMITTED',
        },
      ]);
      jest.spyOn(service as any, 'triggerSchedulingGate').mockResolvedValue({
        manualRequired: false,
        hearingId: 'hearing-1',
        scheduledAt: new Date().toISOString(),
      });

      const result = await service.submitSchedulingProposals('d-1', 'raiser-1', UserRole.CLIENT);

      expect(result.submitted).toBe(1);
      expect(result.schedulingGate.triggered).toBe(true);
      expect(result.schedulingGate.mode).toBe('WAITING_PARTIES');
      expect(result.schedulingGate.scheduleResult?.hearingId).toBe('hearing-1');
    });
  });

  describe('resolveSchedulingPermission', () => {
    it('allows broker related to project to propose scheduling slots', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: 'p-1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
      });
      disputePartyRepo.findOne.mockResolvedValue(null);

      const allowed = await (service as any).resolveSchedulingPermission(
        {
          id: 'd-1',
          groupId: 'g-1',
          raisedById: 'raiser-1',
          defendantId: 'def-1',
          projectId: 'p-1',
        },
        'broker-1',
      );

      expect(allowed).toBe(true);
    });

    it('denies unrelated user with no project or group membership', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: 'p-1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
      });
      disputePartyRepo.findOne.mockResolvedValue(null);

      const allowed = await (service as any).resolveSchedulingPermission(
        {
          id: 'd-1',
          groupId: 'g-1',
          raisedById: 'raiser-1',
          defendantId: 'def-1',
          projectId: 'p-1',
        },
        'outsider-1',
      );

      expect(allowed).toBe(false);
    });
  });

  describe('appeal workflow', () => {
    it('delegates submitAppeal to verdict service and merges additional evidence', async () => {
      const reviewDeadline = new Date('2026-04-19T10:00:00.000Z');
      const updatedDispute = {
        id: 'd-1',
        status: DisputeStatus.APPEALED,
        raisedById: 'raiser-1',
        raiserRole: UserRole.CLIENT,
        defendantId: 'def-1',
        defendantRole: UserRole.FREELANCER,
        appealDeadline: reviewDeadline,
        evidence: ['existing-proof', 'extra-proof'],
      };

      disputeRepo.findOne
        .mockResolvedValueOnce({
          id: 'd-1',
          status: DisputeStatus.RESOLVED,
          raisedById: 'raiser-1',
          raiserRole: UserRole.CLIENT,
          defendantId: 'def-1',
          defendantRole: UserRole.FREELANCER,
        })
        .mockResolvedValueOnce({
          ...updatedDispute,
          evidence: ['existing-proof'],
        })
        .mockResolvedValueOnce(updatedDispute);
      disputeRepo.save.mockResolvedValue(updatedDispute);
      verdictService.appealVerdict.mockResolvedValue(updatedDispute);
      hearingRepo.findOne.mockResolvedValue({ id: 'hearing-tier-2' });

      const result = await service.submitAppeal('raiser-1', 'd-1', {
        reason: 'A'.repeat(220),
        additionalEvidence: ['extra-proof'],
        disclaimerAccepted: true,
        disclaimerVersion: DISPUTE_DISCLAIMER_VERSION,
      });

      expect(verdictService.appealVerdict).toHaveBeenCalledWith(
        'd-1',
        'raiser-1',
        'A'.repeat(220),
        expect.objectContaining({
          termsVersion: DISPUTE_DISCLAIMER_VERSION,
        }),
      );
      expect(disputeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence: ['existing-proof', 'extra-proof'],
        }),
      );
      expect(activityRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dispute.appeal_submitted',
        expect.objectContaining({
          disputeId: 'd-1',
          appealDeadline: reviewDeadline,
        }),
      );
      expect(hearingService.scheduleHearing).not.toHaveBeenCalled();
      expect(result).toEqual(updatedDispute);
      recordEvidence({
        id: 'FE17-APL-01',
        evidenceRef: 'disputes.service.spec.ts::submitAppeal',
        actualResults:
          'submitAppeal delegated to VerdictService.appealVerdict, merged extra-proof into the dispute evidence array, saved activity logs, and returned the APPEALED dispute state.',
      });
    });

    it('truncates appeal activity descriptions so long reasons do not overflow the audit column', async () => {
      const longReason = 'A'.repeat(700);
      const updatedDispute = {
        id: 'd-1',
        status: DisputeStatus.APPEALED,
        raisedById: 'raiser-1',
        raiserRole: UserRole.CLIENT,
        defendantId: 'def-1',
        defendantRole: UserRole.FREELANCER,
        appealDeadline: new Date('2026-04-19T10:00:00.000Z'),
        evidence: [],
      };

      disputeRepo.findOne
        .mockResolvedValueOnce({
          id: 'd-1',
          status: DisputeStatus.RESOLVED,
          raisedById: 'raiser-1',
          raiserRole: UserRole.CLIENT,
          defendantId: 'def-1',
          defendantRole: UserRole.FREELANCER,
        })
        .mockResolvedValueOnce(updatedDispute);
      verdictService.appealVerdict.mockResolvedValue(updatedDispute);
      activityRepo.create.mockImplementation((payload: unknown) => payload);

      await service.submitAppeal('raiser-1', 'd-1', {
        reason: longReason,
        disclaimerAccepted: true,
        disclaimerVersion: DISPUTE_DISCLAIMER_VERSION,
      });

      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.any(String),
          metadata: expect.objectContaining({
            reason: longReason,
          }),
        }),
      );

      const savedActivity =
        activityRepo.create.mock.calls[activityRepo.create.mock.calls.length - 1]?.[0];
      expect(savedActivity.description.length).toBeLessThanOrEqual(500);
      expect(savedActivity.description.endsWith('...')).toBe(true);
    });

    it('recovers appeal retries after a prior attempt already transitioned the dispute', async () => {
      const appealedDispute = {
        id: 'd-1',
        status: DisputeStatus.APPEALED,
        isAppealed: true,
        currentTier: 2,
        appealReason: 'A'.repeat(220),
        raisedById: 'raiser-1',
        raiserRole: UserRole.CLIENT,
        defendantId: 'def-1',
        defendantRole: UserRole.FREELANCER,
        appealDeadline: new Date('2026-04-19T10:00:00.000Z'),
        evidence: ['existing-proof'],
      };

      disputeRepo.findOne
        .mockResolvedValueOnce({
          ...appealedDispute,
          status: DisputeStatus.APPEALED,
        })
        .mockResolvedValueOnce(appealedDispute);
      verdictService.appealVerdict.mockRejectedValue(
        new BadRequestException('Dispute is not eligible for appeal'),
      );
      activityRepo.create.mockImplementation((payload: unknown) => payload);

      const result = await service.submitAppeal('raiser-1', 'd-1', {
        reason: 'A'.repeat(220),
        disclaimerAccepted: true,
        disclaimerVersion: DISPUTE_DISCLAIMER_VERSION,
      });

      expect(result).toEqual(appealedDispute);
      expect(activityRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dispute.status_changed',
        expect.objectContaining({
          disputeId: 'd-1',
          previousStatus: DisputeStatus.RESOLVED,
          newStatus: DisputeStatus.APPEALED,
        }),
      );
    });

    it('rejects appeal resolution for non-admin staff', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'staff-1', role: UserRole.STAFF });

      await expect(
        service.resolveAppeal('staff-1', 'd-1', {
          disputeId: 'd-1',
          result: 'WIN_CLIENT' as any,
          faultType: 'OTHER' as any,
          faultyParty: 'defendant',
          reasoning: {
            violatedPolicies: ['POL-1'],
            factualFindings: 'facts',
            legalAnalysis: 'analysis',
            conclusion: 'conclusion',
          },
          amountToFreelancer: 0,
          amountToClient: 100,
          overridesVerdictId: 'v-1',
          overrideReason: 'Detailed appeal review outcome',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      recordEvidence({
        id: 'FE17-APL-02',
        evidenceRef: 'disputes.service.spec.ts::resolveAppeal forbidden for staff',
        actualResults:
          'resolveAppeal rejected a STAFF caller with ForbiddenException before delegating to VerdictService.issueAppealVerdict.',
      });
    });

    it('delegates resolveAppeal to verdict service for admins', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'admin-1', role: UserRole.ADMIN });
      disputeRepo.findOne
        .mockResolvedValueOnce({
          id: 'd-1',
          status: DisputeStatus.APPEALED,
        })
        .mockResolvedValueOnce({
          id: 'd-1',
          status: DisputeStatus.RESOLVED,
          appealResolvedAt: new Date(),
        });
      verdictService.issueAppealVerdict.mockResolvedValue({
        verdict: { id: 'v-2' },
        distribution: {},
      });

      const dto = {
        result: 'WIN_CLIENT' as any,
        faultType: 'OTHER' as any,
        faultyParty: 'defendant',
        reasoning: {
          violatedPolicies: ['POL-1'],
          factualFindings: 'facts',
          legalAnalysis: 'analysis',
          conclusion: 'conclusion',
        },
        amountToFreelancer: 0,
        amountToClient: 100,
        overridesVerdictId: 'v-1',
        overrideReason: 'Detailed appeal review outcome',
      };

      const result = await service.resolveAppeal('admin-1', 'd-1', dto as any);

      expect(verdictService.issueAppealVerdict).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: 'd-1',
          overridesVerdictId: 'v-1',
          overrideReason: 'Detailed appeal review outcome',
        }),
        'admin-1',
        UserRole.ADMIN,
      );
      expect(activityRepo.save).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'd-1',
          status: DisputeStatus.RESOLVED,
        }),
      );
      recordEvidence({
        id: 'FE17-APL-03',
        evidenceRef: 'disputes.service.spec.ts::resolveAppeal admin',
        actualResults:
          'resolveAppeal delegated the final appeal payload to VerdictService.issueAppealVerdict, saved appeal activity logs, and returned dispute d-1 in RESOLVED status.',
      });
    });
  });

  describe('escalateToHearing', () => {
    const originalAppEnv = process.env.APP_ENV;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalTestMode = process.env.DISPUTE_TEST_MODE;

    beforeEach(() => {
      process.env.APP_ENV = 'test';
      process.env.NODE_ENV = 'production';
      process.env.DISPUTE_TEST_MODE = 'true';
    });

    afterEach(() => {
      process.env.APP_ENV = originalAppEnv;
      process.env.NODE_ENV = originalNodeEnv;
      process.env.DISPUTE_TEST_MODE = originalTestMode;
    });

    it('schedules a staff-picked test slot when APP_ENV is non-production', async () => {
      const pickedStart = new Date('2026-04-10T09:05:00.000Z');

      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.IN_MEDIATION,
        assignedStaffId: 'staff-1',
        raisedById: 'raiser-1',
      });
      userRepo.findOne.mockResolvedValue({ id: 'staff-1', role: UserRole.STAFF });
      hearingRepo.findOne.mockResolvedValue(null);
      hearingService.determineRequiredParticipants.mockResolvedValue({
        participants: [
          {
            userId: 'raiser-1',
            role: 'RAISER',
            isRequired: true,
            relationToProject: 'raiser',
          },
          {
            userId: 'staff-1',
            role: 'MODERATOR',
            isRequired: true,
            relationToProject: 'moderator',
          },
        ],
        warnings: [],
        hasBroker: false,
        hasSupervisor: false,
      });
      staffAssignmentService.estimateDisputeComplexity.mockResolvedValue({
        timeEstimation: { recommendedMinutes: 45 },
      });
      hearingService.scheduleHearing.mockResolvedValue({
        manualRequired: false,
        hearing: {
          id: 'hearing-1',
          scheduledAt: pickedStart,
        },
        responseDeadline: pickedStart,
        participantConfirmationSummary: { pending: 2 },
      });

      const result = await service.escalateToHearing('d-1', 'staff-1', {
        selectedSlotStart: pickedStart.toISOString(),
        bypassReason: 'picked schedule for dev test',
      });

      expect(hearingService.scheduleHearing).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: 'd-1',
          scheduledAt: pickedStart.toISOString(),
          estimatedDurationMinutes: 45,
          isEmergency: true,
          testBypassReason: 'picked schedule for dev test',
        }),
        'staff-1',
      );
      expect(hearingService.rescheduleHearing).not.toHaveBeenCalled();
      expect(result.hearingId).toBe('hearing-1');
      expect(result.selectedSlot?.start.getTime()).toBe(pickedStart.getTime());
    });

    it('reschedules the existing actionable hearing when staff picks a new test slot', async () => {
      const currentStart = new Date('2026-04-12T09:00:00.000Z');
      const pickedStart = new Date('2026-04-10T10:15:00.000Z');

      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.IN_MEDIATION,
        assignedStaffId: 'staff-1',
        raisedById: 'raiser-1',
      });
      userRepo.findOne.mockResolvedValue({ id: 'staff-1', role: UserRole.STAFF });
      hearingRepo.findOne.mockResolvedValue({
        id: 'hearing-existing',
        scheduledAt: currentStart,
        status: HearingStatus.SCHEDULED,
      });
      hearingService.determineRequiredParticipants.mockResolvedValue({
        participants: [
          {
            userId: 'raiser-1',
            role: 'RAISER',
            isRequired: true,
            relationToProject: 'raiser',
          },
          {
            userId: 'staff-1',
            role: 'MODERATOR',
            isRequired: true,
            relationToProject: 'moderator',
          },
        ],
        warnings: [],
        hasBroker: false,
        hasSupervisor: false,
      });
      staffAssignmentService.estimateDisputeComplexity.mockResolvedValue({
        timeEstimation: { recommendedMinutes: 60 },
      });
      hearingService.rescheduleHearing.mockResolvedValue({
        manualRequired: false,
        newHearing: {
          id: 'hearing-2',
          scheduledAt: pickedStart,
        },
        responseDeadline: pickedStart,
        participantConfirmationSummary: { pending: 2 },
      });

      const result = await service.escalateToHearing('d-1', 'staff-1', {
        selectedSlotStart: pickedStart.toISOString(),
        bypassReason: 'picked reschedule for dev test',
      });

      expect(hearingService.rescheduleHearing).toHaveBeenCalledWith(
        expect.objectContaining({
          hearingId: 'hearing-existing',
          scheduledAt: pickedStart.toISOString(),
          estimatedDurationMinutes: 60,
          isEmergency: true,
          testBypassReason: 'picked reschedule for dev test',
        }),
        'staff-1',
      );
      expect(hearingService.scheduleHearing).not.toHaveBeenCalled();
      expect(result.hearingId).toBe('hearing-2');
      expect(result.selectedSlot?.start.getTime()).toBe(pickedStart.getTime());
    });
  });

  describe('processMediationTimeoutDisputes', () => {
    it('triggers timeout scheduling for overdue mediation without active hearing', async () => {
      disputeRepo.find.mockResolvedValue([
        {
          id: 'd-1',
          assignedStaffId: 'staff-1',
          previewCompletedById: 'staff-1',
          raisedById: 'raiser-1',
          previewCompletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      ]);
      hearingRepo.exist.mockResolvedValue(false);
      jest.spyOn(service as any, 'escalateToHearing').mockResolvedValue({
        manualRequired: true,
      });

      const result = await service.processMediationTimeoutDisputes(new Date());

      expect(result.scanned).toBe(1);
      expect(result.triggered).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('skips disputes that already have active hearing', async () => {
      disputeRepo.find.mockResolvedValue([
        {
          id: 'd-1',
          assignedStaffId: 'staff-1',
          previewCompletedById: 'staff-1',
          raisedById: 'raiser-1',
          previewCompletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      ]);
      hearingRepo.exist.mockResolvedValue(true);
      const escalateSpy = jest.spyOn(service as any, 'escalateToHearing');

      const result = await service.processMediationTimeoutDisputes(new Date());

      expect(result.scanned).toBe(1);
      expect(result.triggered).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(escalateSpy).not.toHaveBeenCalled();
    });
  });
});
