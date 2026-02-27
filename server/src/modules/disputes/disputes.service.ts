import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DisputeEntity,
  DisputeResult,
  DisputeStatus,
  DisputePhase,
  DisputeCategory,
  DisputePriority,
  DisputeType,
  DisputeNoteEntity,
  DisputeActivityEntity,
  DisputeEvidenceEntity,
  DisputeLedgerEntity,
  DisputeMessageEntity,
  DisputeAction,
  DisputePartyEntity,
  DisputePartySide,
  DisputeScheduleProposalEntity,
  DisputeScheduleProposalStatus,
  DisputeViewStateEntity,
  DisputeInternalMembershipEntity,
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingQuestionEntity,
  HearingTier,
  HearingStatus,
  HearingParticipantRole,
  HearingQuestionStatus,
  DisputeVerdictEntity,
  EscrowEntity,
  EscrowStatus,
  MilestoneEntity,
  MilestoneStatus,
  TaskEntity,
  TaskStatus,
  ProjectEntity,
  ProjectStatus,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  UserRole,
  UserStatus,
  WalletEntity,
  EventStatus,
  EventType,
  EventParticipantEntity,
  ParticipantStatus,
  MessageType,
} from 'src/database/entities';
import {
  DataSource,
  QueryFailedError,
  In,
  Not,
  QueryRunner,
  Repository,
  Brackets,
  LessThan,
  LessThanOrEqual,
  EntityManager,
  Between,
  MoreThan,
  IsNull,
  SelectQueryBuilder,
  DeepPartial,
} from 'typeorm';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import {
  DisputeResolvedEvent,
  MoneyDistribution,
  ResolutionResult,
  TransferDetail,
} from './interfaces/resolution.interface';
import { DisputeStateMachine, determineLoser } from './dispute-state-machine';
import { DISPUTE_EVENTS } from './events/dispute.events';
import { AddNoteDto } from './dto/add-note.dto';
import { DefendantResponseDto } from './dto/defendant-response.dto';
import { AppealDto } from './dto/appeal.dto';
import { AdminUpdateDisputeDto } from './dto/admin-update-dispute.dto';
import { SendDisputeMessageDto, HideMessageDto } from './dto/message.dto';
import {
  DisputeFilterDto,
  DisputeSortBy,
  SortOrder,
  PaginatedDisputesResponse,
} from './dto/dispute-filter.dto';
import { UserWarningService } from '../user-warning/user-warning.service';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { SettlementService } from './services/settlement.service';
import { HearingService } from './services/hearing.service';
import { VerdictService } from './services/verdict.service';
import { VerdictReadinessService } from './services/verdict-readiness.service';
import { AppealVerdictDto } from './dto/verdict.dto';
import { StaffAssignmentService } from './services/staff-assignment.service';
import { CalendarService } from '../calendar/calendar.service';
import { TriageActionType, TriageDisputeDto } from './dto/triage-dispute.dto';
import { AutoScheduleTuningDto } from './dto/auto-schedule-tuning.dto';
import { CreateDisputeScheduleProposalDto } from './dto/schedule-proposal.dto';
import {
  SchedulingWorklistActionType,
  SchedulingWorklistItemDto,
  SchedulingWorklistPerspective,
  SchedulingWorklistNotEligibleReasonCode,
  SchedulingWorklistResponseDto,
} from './dto/schedule-worklist.dto';

// Constants for deadlines
const DEFAULT_RESPONSE_DEADLINE_DAYS = 7;
const DEFAULT_RESOLUTION_DEADLINE_DAYS = 14;
const URGENT_THRESHOLD_HOURS = 48; // Dispute được coi là urgent nếu còn < 48h
const DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS = 7;
const DEFAULT_HEARING_DURATION_MINUTES = 60;
const DEFAULT_HEARING_MIN_NOTICE_HOURS = 24;
const DEFAULT_TEST_LOOKAHEAD_DAYS = 7;
const _DEFAULT_SETTLEMENT_WINDOW_HOURS = 24;
const _DEADLINE_SETTLEMENT_WINDOW_HOURS = 48;
const _REJECTION_APPEAL_WINDOW_HOURS = 24;
const DISMISSAL_HOLD_HOURS = 24;
const DISMISSAL_RATE_SAMPLE_WINDOW_DAYS = 30;
const DISMISSAL_RATE_ALERT_THRESHOLD = 0.3;
const DISMISSAL_RATE_MIN_SAMPLES = 10;
const _DISMISSAL_AUDIT_SAMPLE_RATE = 0.1;
const MESSAGE_RATE_LIMIT = {
  MIN_INTERVAL_MS: 1000,
  MAX_PER_MINUTE: 10,
  BLOCK_DURATION_MS: 60 * 1000,
} as const;

const DISPUTE_ACTIVE_STATUSES = [
  DisputeStatus.OPEN,
  DisputeStatus.TRIAGE_PENDING,
  DisputeStatus.PREVIEW,
  DisputeStatus.PENDING_REVIEW,
  DisputeStatus.INFO_REQUESTED,
  DisputeStatus.IN_MEDIATION,
  DisputeStatus.REJECTION_APPEALED,
  DisputeStatus.APPEALED,
];

const DISPUTE_CLOSED_STATUSES = [
  DisputeStatus.RESOLVED,
  DisputeStatus.REJECTED,
  DisputeStatus.CANCELED,
];

const DISPUTE_QUEUE_STATUSES = [DisputeStatus.OPEN, DisputeStatus.TRIAGE_PENDING];
const DISPUTE_SCHEDULING_WORKLIST_STATUSES = [
  DisputeStatus.OPEN,
  DisputeStatus.TRIAGE_PENDING,
  DisputeStatus.PREVIEW,
  DisputeStatus.PENDING_REVIEW,
  DisputeStatus.INFO_REQUESTED,
  DisputeStatus.IN_MEDIATION,
];
const PROPOSAL_ELIGIBLE_STATUSES = [DisputeStatus.IN_MEDIATION];
const ACTIVE_HEARING_STATUSES = [HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS];
const PENDING_INVITE_PARTICIPANT_STATUSES = [
  ParticipantStatus.PENDING,
  ParticipantStatus.NO_RESPONSE,
  ParticipantStatus.TENTATIVE,
];
const WORKLIST_NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const UUID_REGEX = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
const PROPOSAL_MAX_PER_USER = 20;

type ScheduleFailureReasonCode =
  | 'NO_STAFF_AVAILABLE'
  | 'NO_REQUIRED_PARTICIPANTS'
  | 'NO_COMMON_SLOT'
  | 'REQUIRED_DECLINED'
  | 'CONFIRMATION_TIMEOUT'
  | 'MANUAL_REVIEW_REQUIRED';

type SchedulingProposalErrorCode =
  | 'PROPOSAL_DURATION_TOO_SHORT'
  | 'PROPOSAL_DURATION_TOO_LONG'
  | 'PROPOSAL_START_IN_PAST'
  | 'DISPUTE_NOT_IN_MEDIATION'
  | 'HEARING_ALREADY_ACTIVE'
  | 'PROPOSAL_OVERLAP'
  | 'PROPOSAL_LIMIT_EXCEEDED';

type MilestoneExecutionSignal = {
  totalTasks: number;
  completedTasks: number;
  proofTasks: number;
  milestoneHasProof: boolean;
  progressPercent: number;
  hasMeaningfulWork: boolean;
};

type DisputeEligibilityResult = {
  allowed: boolean;
  reason: string;
};

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);
  private disputeStatsCache?: {
    value: {
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      overdue: number;
      urgent: number;
    };
    expiresAt: number;
  };
  private readonly disputeStatsTtlMs = 60 * 1000;

  constructor(
    @InjectRepository(MilestoneEntity)
    private milestoneRepo: Repository<MilestoneEntity>,
    @InjectRepository(TaskEntity)
    private taskRepo: Repository<TaskEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(DisputeEntity)
    private disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeEvidenceEntity)
    private evidenceRepo: Repository<DisputeEvidenceEntity>,
    @InjectRepository(DisputeMessageEntity)
    private messageRepo: Repository<DisputeMessageEntity>,
    @InjectRepository(DisputeHearingEntity)
    private hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(HearingParticipantEntity)
    private hearingParticipantRepo: Repository<HearingParticipantEntity>,
    @InjectRepository(HearingQuestionEntity)
    private hearingQuestionRepo: Repository<HearingQuestionEntity>,
    @InjectRepository(DisputeVerdictEntity)
    private verdictRepo: Repository<DisputeVerdictEntity>,
    @InjectRepository(EscrowEntity)
    private escrowRepo: Repository<EscrowEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(WalletEntity)
    private walletRepo: Repository<WalletEntity>,
    @InjectRepository(TransactionEntity)
    private transactionRepo: Repository<TransactionEntity>,
    @InjectRepository(DisputeNoteEntity)
    private noteRepo: Repository<DisputeNoteEntity>,
    @InjectRepository(DisputeActivityEntity)
    private activityRepo: Repository<DisputeActivityEntity>,
    @InjectRepository(DisputeLedgerEntity)
    private ledgerRepo: Repository<DisputeLedgerEntity>,
    @InjectRepository(DisputePartyEntity)
    private disputePartyRepo: Repository<DisputePartyEntity>,
    @InjectRepository(DisputeScheduleProposalEntity)
    private disputeScheduleProposalRepo: Repository<DisputeScheduleProposalEntity>,
    @InjectRepository(DisputeViewStateEntity)
    private disputeViewStateRepo: Repository<DisputeViewStateEntity>,
    @InjectRepository(DisputeInternalMembershipEntity)
    private disputeInternalMembershipRepo: Repository<DisputeInternalMembershipEntity>,
    @InjectRepository(EventParticipantEntity)
    private eventParticipantRepo: Repository<EventParticipantEntity>,

    private readonly dataSource: DataSource,
    private readonly trustScoreService: TrustScoreService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userWarningService: UserWarningService,
    private readonly settlementService: SettlementService,
    private readonly hearingService: HearingService,
    private readonly verdictService: VerdictService,
    private readonly verdictReadinessService: VerdictReadinessService,
    private readonly staffAssignmentService: StaffAssignmentService,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * Get the latest verdict for a dispute (returns null if no verdict yet).
   */
  async getVerdict(disputeId: string) {
    const verdict = await this.verdictService.getVerdictByDisputeId(disputeId);
    if (!verdict) {
      return { data: null };
    }
    // result is stored on the dispute, not the verdict entity
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    return {
      data: {
        id: verdict.id,
        disputeId: verdict.disputeId,
        adjudicatorId: verdict.adjudicatorId,
        adjudicatorRole: verdict.adjudicatorRole,
        result: dispute?.result ?? 'PENDING',
        faultType: verdict.faultType,
        faultyParty: verdict.faultyParty,
        reasoning: verdict.reasoning,
        amountToFreelancer: Number(verdict.amountToFreelancer ?? 0),
        amountToClient: Number(verdict.amountToClient ?? 0),
        platformFee: Number(verdict.platformFee ?? 0),
        trustScorePenalty: verdict.trustScorePenalty ?? 0,
        isBanTriggered: verdict.isBanTriggered ?? false,
        banDurationDays: verdict.banDurationDays ?? 0,
        warningMessage: verdict.warningMessage ?? null,
        tier: verdict.tier,
        isAppealVerdict: verdict.isAppealVerdict,
        overridesVerdictId: verdict.overridesVerdictId ?? null,
        appealDeadline: (verdict as any).appealDeadline ?? null,
        issuedAt: verdict.issuedAt,
        adjudicator: verdict.adjudicator
          ? {
              id: verdict.adjudicator.id,
              fullName: verdict.adjudicator.fullName ?? verdict.adjudicator.email,
              email: verdict.adjudicator.email,
            }
          : null,
      },
    };
  }

  private async ensureLegacyFlowAllowed(disputeId: string): Promise<void> {
    const verdict = await this.verdictRepo.findOne({ where: { disputeId } });
    if (verdict) {
      throw new BadRequestException(
        'Dispute already uses verdict workflow. Use verdict endpoints instead of legacy resolve/appeal.',
      );
    }
  }

  private isFeatureEnabled(name: string, defaultValue: boolean = false): boolean {
    const raw = process.env[name];
    if (raw === undefined) {
      return defaultValue;
    }
    return ['true', '1', 'yes', 'y', 'on'].includes(raw.trim().toLowerCase());
  }

  private isSlotProposalEnabled(): boolean {
    return this.isFeatureEnabled('DISPUTE_SLOT_PROPOSAL_ENABLED', true);
  }

  private isSchedulingWorklistEnabled(): boolean {
    return this.isFeatureEnabled('DISPUTE_SCHEDULING_WORKLIST_ENABLED', true);
  }

  private isUndefinedTableError(error: unknown, tableName?: string): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const code = (error as QueryFailedError & { code?: string; driverError?: { code?: string } })
      .driverError?.code;
    if (code !== '42P01') {
      return false;
    }

    if (!tableName) {
      return true;
    }

    const message = error.message || '';
    return message.includes(`"${tableName}"`) || message.includes(tableName);
  }

  private isVerdictHearingGateEnabled(): boolean {
    return this.isFeatureEnabled('DISPUTE_VERDICT_HEARING_GATE', true);
  }

  private mapNoSlotsReasonCode(reason?: string): ScheduleFailureReasonCode {
    const normalized = (reason || '').toLowerCase();
    if (normalized.includes('decline')) {
      return 'REQUIRED_DECLINED';
    }
    if (normalized.includes('timeout')) {
      return 'CONFIRMATION_TIMEOUT';
    }
    if (normalized.includes('no slot') || normalized.includes('unavailable')) {
      return 'NO_COMMON_SLOT';
    }
    return 'MANUAL_REVIEW_REQUIRED';
  }

  private readonly messageRateLimit = new Map<
    string,
    {
      lastMessageAtMs: number;
      windowStartMs: number;
      countInWindow: number;
      blockedUntilMs?: number;
    }
  >();

  private async buildMessageEventPayload(
    message: DisputeMessageEntity,
    options: {
      senderSummary?: { id: string; fullName?: string; email?: string; role?: UserRole };
      senderHearingRole?: HearingParticipantRole;
    } = {},
  ) {
    let senderSummary = options.senderSummary;
    let senderHearingRole: HearingParticipantRole | undefined = options.senderHearingRole;

    if (!senderSummary && message.senderId) {
      const sender = await this.userRepo.findOne({
        where: { id: message.senderId },
        select: ['id', 'fullName', 'email', 'role'],
      });
      if (sender) {
        senderSummary = {
          id: sender.id,
          fullName: sender.fullName,
          email: sender.email,
          role: sender.role,
        };
      }
    }

    if (!senderHearingRole && message.hearingId && message.senderId) {
      const hearingParticipant = await this.hearingParticipantRepo.findOne({
        where: { hearingId: message.hearingId, userId: message.senderId },
        select: ['role'],
      });
      senderHearingRole = hearingParticipant?.role;
    }

    return {
      messageId: message.id,
      disputeId: message.disputeId,
      hearingId: message.hearingId,
      senderId: message.senderId || undefined,
      senderRole: message.senderRole,
      senderHearingRole,
      type: message.type,
      content: message.content,
      metadata: message.metadata,
      replyToMessageId: message.replyToMessageId,
      relatedEvidenceId: message.relatedEvidenceId,
      isHidden: message.isHidden,
      hiddenReason: message.hiddenReason,
      createdAt: message.createdAt,
      sender: senderSummary,
    };
  }

  private canonicalize(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalize(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      const normalized = entries
        .map(([key, nestedValue]) => `${JSON.stringify(key)}:${this.canonicalize(nestedValue)}`)
        .join(',');
      return `{${normalized}}`;
    }

    return JSON.stringify(value ?? null);
  }

  private buildLedgerCanonicalPayload(input: {
    disputeId: string;
    eventType: string;
    actorId?: string | null;
    reason?: string | null;
    payload?: Record<string, unknown> | null;
    previousHash?: string | null;
    recordedAt: string;
  }): string {
    return this.canonicalize({
      disputeId: input.disputeId,
      eventType: input.eventType,
      actorId: input.actorId || null,
      reason: input.reason || null,
      previousHash: input.previousHash || null,
      recordedAt: input.recordedAt,
      payload: input.payload || {},
    });
  }

  private async appendLedgerEntry(
    manager: EntityManager,
    input: {
      disputeId: string;
      eventType: string;
      actorId?: string | null;
      reason?: string | null;
      payload?: Record<string, unknown>;
      previousStatus?: DisputeStatus | null;
      newStatus?: DisputeStatus | null;
    },
  ): Promise<void> {
    const ledgerRepo = manager.getRepository(DisputeLedgerEntity);
    const latest = await ledgerRepo.findOne({
      where: { disputeId: input.disputeId },
      order: { createdAt: 'DESC' },
    });

    const recordedAt = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ...(input.payload || {}),
      stateDelta: {
        from: input.previousStatus || null,
        to: input.newStatus || null,
      },
    };

    const canonicalPayload = this.buildLedgerCanonicalPayload({
      disputeId: input.disputeId,
      eventType: input.eventType,
      actorId: input.actorId || null,
      reason: input.reason || null,
      payload,
      previousHash: latest?.hash || null,
      recordedAt,
    });

    const hash = createHash('sha256').update(canonicalPayload).digest('hex');

    await ledgerRepo.insert({
      disputeId: input.disputeId,
      eventType: input.eventType,
      actorId: input.actorId || undefined,
      reason: input.reason || undefined,
      payload,
      previousHash: latest?.hash || undefined,
      canonicalPayload,
      hash,
    });
  }

  private async ensureDisputeParty(
    manager: EntityManager,
    input: {
      groupId: string;
      disputeId: string;
      userId: string;
      role?: UserRole;
      side: DisputePartySide;
    },
  ): Promise<void> {
    const partyRepo = manager.getRepository(DisputePartyEntity);
    const existing = await partyRepo.findOne({
      where: {
        groupId: input.groupId,
        userId: input.userId,
      },
    });

    if (existing) {
      const updatePayload: Partial<DisputePartyEntity> = {};
      if (!existing.disputeId) {
        updatePayload.disputeId = input.disputeId;
      }
      if (!existing.role && input.role) {
        updatePayload.role = input.role;
      }
      if (existing.side !== input.side && existing.side !== DisputePartySide.THIRD_PARTY) {
        updatePayload.side = input.side;
      }

      if (Object.keys(updatePayload).length > 0) {
        await partyRepo.update(existing.id, updatePayload);
      }
      return;
    }

    await partyRepo.save(
      partyRepo.create({
        groupId: input.groupId,
        disputeId: input.disputeId,
        userId: input.userId,
        role: input.role,
        side: input.side,
      }),
    );
  }

  private async assertDisputeAccess(
    dispute: DisputeEntity,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    if ([UserRole.ADMIN, UserRole.STAFF].includes(userRole)) {
      return;
    }

    if ([dispute.raisedById, dispute.defendantId].includes(userId)) {
      return;
    }

    if ([dispute.assignedStaffId, dispute.escalatedToAdminId].includes(userId)) {
      return;
    }

    if (await this.isGroupPartyMember(dispute, userId)) {
      return;
    }

    throw new ForbiddenException('You do not have access to this dispute');
  }

  private async hasInternalCaseAccess(
    dispute: Pick<DisputeEntity, 'id' | 'assignedStaffId' | 'escalatedToAdminId'>,
    userId: string,
    userRole: UserRole,
  ): Promise<boolean> {
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    if ([dispute.assignedStaffId, dispute.escalatedToAdminId].includes(userId)) {
      return true;
    }

    const membership = await this.disputeInternalMembershipRepo.findOne({
      where: { disputeId: dispute.id, userId },
      select: ['id'],
    });

    return Boolean(membership);
  }

  private async assertInternalCaseAccess(
    dispute: Pick<DisputeEntity, 'id' | 'assignedStaffId' | 'escalatedToAdminId'>,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    if (!(await this.hasInternalCaseAccess(dispute, userId, userRole))) {
      throw new ForbiddenException({
        code: 'INTERNAL_CASE_ACCESS_DENIED',
        message: 'You do not have access to this internal case workspace.',
      });
    }
  }

  private async isGroupPartyMember(
    dispute: Pick<DisputeEntity, 'id' | 'groupId'>,
    userId: string,
  ): Promise<boolean> {
    const groupId = dispute.groupId || dispute.id;
    const membership = await this.disputePartyRepo.findOne({
      where: { groupId, userId },
      select: ['id'],
    });
    return Boolean(membership);
  }

  private parseIsoDateOrThrow(value: string, fieldName: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return parsed;
  }

  private throwSchedulingProposalError(code: SchedulingProposalErrorCode, message: string): never {
    throw new BadRequestException({ code, message });
  }

  private throwAssignedToOtherStaffForbidden(
    dispute: Pick<DisputeEntity, 'id' | 'assignedStaffId'>,
  ): never {
    throw new ForbiddenException({
      code: 'DISPUTE_ASSIGNED_TO_OTHER_STAFF',
      message: 'Dispute is assigned to another staff member',
      disputeId: dispute.id,
      assignedStaffId: dispute.assignedStaffId || null,
    });
  }

  private async assertDisputeAllowsSlotProposal(
    dispute: Pick<DisputeEntity, 'id' | 'status'>,
  ): Promise<void> {
    if (!PROPOSAL_ELIGIBLE_STATUSES.includes(dispute.status)) {
      this.throwSchedulingProposalError(
        'DISPUTE_NOT_IN_MEDIATION',
        'Slot proposals are available only after the dispute enters mediation.',
      );
    }

    const hasActiveHearing = await this.hearingRepo.exist({
      where: {
        disputeId: dispute.id,
        status: In(ACTIVE_HEARING_STATUSES),
      },
    });

    if (hasActiveHearing) {
      this.throwSchedulingProposalError(
        'HEARING_ALREADY_ACTIVE',
        'A hearing is already active or scheduled. Please respond to the invitation or request reschedule.',
      );
    }
  }

  private async listSchedulingProposalsForParticipants(
    disputeId: string,
    participantIds: string[],
  ): Promise<Array<{ start: Date; end: Date }>> {
    if (!this.isSlotProposalEnabled()) {
      return [];
    }

    const normalizedParticipantIds = Array.from(new Set(participantIds.filter(Boolean)));
    if (normalizedParticipantIds.length === 0) {
      return [];
    }

    const proposals = await this.disputeScheduleProposalRepo.find({
      where: {
        disputeId,
        userId: In(normalizedParticipantIds),
        status: In([DisputeScheduleProposalStatus.ACTIVE, DisputeScheduleProposalStatus.SUBMITTED]),
      },
      select: ['startTime', 'endTime'],
    });

    const now = Date.now();
    return proposals
      .filter((item) => item.startTime && item.endTime && item.endTime.getTime() > now)
      .map((item) => ({
        start: item.startTime,
        end: item.endTime,
      }));
  }

  async create(raisedBy: string, dto: CreateDisputeDto) {
    const {
      projectId,
      milestoneId,
      defendantId,
      reason,
      evidence,
      category,
      disputedAmount,
      parentDisputeId,
    } = dto;
    const disputeCategory = category || DisputeCategory.OTHER;
    if (disputeCategory === DisputeCategory.SCOPE_CHANGE) {
      throw new BadRequestException(
        'Scope changes must be handled via Change Request, not dispute.',
      );
    }

    if (disputeCategory === DisputeCategory.OTHER) {
      if (!reason || reason.trim().length < 20) {
        throw new BadRequestException(
          'For "Other" category, a detailed reason (minimum 20 characters) is required.',
        );
      }
    }

    const raiserUser = await this.userRepo.findOne({
      where: { id: raisedBy },
      select: ['id', 'role'],
    });
    const canUseEligibilityBypass = this.canUseDisputeTestBypass(raiserUser?.role);

    const now = new Date();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedDispute: DisputeEntity;
    let project: ProjectEntity | null;
    let escrow: EscrowEntity | null;
    let raiserRole: UserRole;
    let defendantRole: UserRole;
    let testBypassReason: string | null = null;

    try {
      project = await queryRunner.manager.findOne(ProjectEntity, {
        where: {
          id: projectId,
          status: In([ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED, ProjectStatus.DISPUTED]),
        },
        lock: { mode: 'pessimistic_read' },
      });
      if (!project) {
        throw new NotFoundException('Project not found or not eligible for dispute');
      }

      if (project.status === ProjectStatus.PAID) {
        // Cho phép raise dispute trong vòng 30 ngày kềEtừ khi PAID (tính theo updatedAt)
        const WARRANTY_DAYS = 30;
        // Dùng endDate
        const warrantyDeadline = new Date(project.endDate);
        warrantyDeadline.setDate(warrantyDeadline.getDate() + WARRANTY_DAYS);

        if (new Date() > warrantyDeadline) {
          throw new BadRequestException(
            'Project is already paid and warranty period (30 days) has expired.',
          );
        }
      }

      const milestone = await queryRunner.manager.findOne(MilestoneEntity, {
        where: { id: milestoneId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!milestone) {
        throw new NotFoundException('Milestone not found');
      }

      if (milestone.projectId !== projectId) {
        throw new BadRequestException('Milestone does not belong to this project');
      }

      // Lấy Escrow trước đềEcheck ngày trả tiền (releasedAt)
      escrow = await queryRunner.manager.findOne(EscrowEntity, {
        where: { milestoneId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundException('Escrow not found');
      }

      // Logic check Milestone PAID (Bảo hành 30 ngày)
      const WARRANTY_DAYS = 30;
      if (milestone.status === MilestoneStatus.PAID) {
        // Mặc định lấy ngày releasedAt trong Escrow, nếu không có thì fallback sang createdAt của milestone
        const paidAt = escrow.releasedAt || milestone.dueDate;
        const warrantyDeadline = new Date(paidAt);
        warrantyDeadline.setDate(warrantyDeadline.getDate() + WARRANTY_DAYS);

        if (new Date() > warrantyDeadline) {
          throw new BadRequestException(
            'Milestone warranty period (30 days) has expired. Dispute requires manual support.',
          );
        }
      }

      const allowedMilestoneStatuses = parentDisputeId
        ? [MilestoneStatus.COMPLETED, MilestoneStatus.LOCKED]
        : this.getAllowedMilestoneStatusesForDispute(disputeCategory);

      // Nếu milestone đã PAID nhưng còn bảo hành -> Cho phép dispute
      if (milestone.status === MilestoneStatus.PAID) {
        allowedMilestoneStatuses.push(MilestoneStatus.PAID);
      }

      if (!allowedMilestoneStatuses.includes(milestone.status)) {
        throw new BadRequestException(
          `Milestone status "${milestone.status}" does not allow ${disputeCategory} disputes. ` +
            `Allowed statuses: ${allowedMilestoneStatuses.join(', ')}`,
        );
      }

      const allowedEscrowStatuses = parentDisputeId
        ? [EscrowStatus.FUNDED, EscrowStatus.DISPUTED]
        : [EscrowStatus.FUNDED, EscrowStatus.RELEASED]; // Cho phép RELEASED (đã trả tiền)

      if (!allowedEscrowStatuses.includes(escrow.status)) {
        if (escrow.status !== EscrowStatus.RELEASED) {
          throw new BadRequestException('Escrow is not in valid state for dispute');
        }
      }

      const executionSignal = await this.collectMilestoneExecutionSignal(
        queryRunner.manager,
        milestone,
      );
      const eligibility = this.evaluateDisputeEligibility({
        category: disputeCategory,
        milestone,
        escrow,
        executionSignal,
        now,
      });
      if (!eligibility.allowed) {
        if (canUseEligibilityBypass) {
          testBypassReason = eligibility.reason;
        } else {
          throw new BadRequestException(eligibility.reason);
        }
      }

      const projectMember = [project.clientId, project.brokerId, project.freelancerId].filter(
        Boolean,
      );
      if (!projectMember.includes(raisedBy)) {
        throw new BadRequestException('You are not a member of this project');
      }
      if (!projectMember.includes(defendantId)) {
        throw new BadRequestException('Defendant is not a member of this project');
      }
      if (raisedBy === defendantId) {
        throw new BadRequestException('You cannot dispute yourself');
      }

      let parentDispute: DisputeEntity | null = null;
      if (parentDisputeId) {
        parentDispute = await queryRunner.manager.findOne(DisputeEntity, {
          where: { id: parentDisputeId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!parentDispute) {
          throw new BadRequestException('Parent dispute not found');
        }

        if (parentDispute.projectId !== projectId || parentDispute.milestoneId !== milestoneId) {
          throw new BadRequestException('Parent dispute does not match project/milestone');
        }

        if (DISPUTE_CLOSED_STATUSES.includes(parentDispute.status)) {
          throw new BadRequestException('Parent dispute is already closed');
        }

        const existingForDefendant = await queryRunner.manager.findOne(DisputeEntity, {
          where: {
            milestoneId,
            defendantId,
            status: In(DISPUTE_ACTIVE_STATUSES),
          },
          lock: { mode: 'pessimistic_read' },
        });

        // Nếu đã có dispute active cho defendant này:
        // - Block nếu dispute đó thuộc vềEMỘT VỤ KIềE KHÁC (khác groupId) -> Xung đột
        // - Allow nếu dispute đó thuộc CÙNG VỤ KIềE (cùng groupId) -> Trường hợp 1 người bềEkiện nhiều lỗi (Quality + Deadline)
        // - Allow nếu chưa từng bềEkiện (Trường hợp 1 nguyên đơn kiện 2 bềEđơn -> Defendant mới chưa có record nào)
        if (existingForDefendant) {
          const parentGroupId = parentDispute.groupId || parentDispute.id;
          const existingGroupId = existingForDefendant.groupId || existingForDefendant.id;

          if (parentGroupId !== existingGroupId) {
            throw new BadRequestException(
              'Defendant is already involved in a DIFFERENT dispute case on this milestone.',
            );
          }
        }
      } else {
        const existingDispute = await queryRunner.manager.findOne(DisputeEntity, {
          where: { milestoneId, status: In(DISPUTE_ACTIVE_STATUSES) },
          lock: { mode: 'pessimistic_read' },
        });
        if (existingDispute) {
          throw new BadRequestException(
            'This milestone already has an active dispute. Add evidence instead.',
          );
        }
      }

      raiserRole = this.determineUserRole(raisedBy, project);
      defendantRole = this.determineUserRole(defendantId, project);
      const disputeType = this.determineDisputeType(raiserRole, defendantRole);

      const amount = disputedAmount || Number(escrow.totalAmount);
      const priority = this.calculatePriority(amount, disputeCategory, project.currency);

      const responseDeadline = new Date(
        now.getTime() + DEFAULT_RESPONSE_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
      );
      const resolutionDeadline = new Date(
        now.getTime() + DEFAULT_RESOLUTION_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
      );

      // Gán groupId:
      // - Nếu là con -> Kế thừa groupId của cha (hoặc id của cha nếu cha chưa có groupId)
      // - Nếu là root -> Dùng chính id của mình (sẽ update sau khi save)
      const groupId: string | null = parentDisputeId
        ? parentDispute?.groupId || parentDispute?.id || null
        : null;

      const dispute = this.disputeRepo.create({
        raisedById: raisedBy,
        raiserRole,
        projectId,
        milestoneId,
        defendantId,
        defendantRole,
        disputeType,
        category: disputeCategory,
        priority,
        disputedAmount: amount,
        reason,
        evidence,
        phase: DisputePhase.PRESENTATION,
        status: DisputeStatus.TRIAGE_PENDING,
        responseDeadline,
        resolutionDeadline,
        parentDisputeId: parentDisputeId || null,
        groupId, // Gán ngay từ đầu nếu có thềE
      } as unknown as DeepPartial<DisputeEntity>);

      escrow.status = EscrowStatus.DISPUTED;
      project.status = ProjectStatus.DISPUTED;
      milestone.status = MilestoneStatus.LOCKED;

      await queryRunner.manager.save(EscrowEntity, escrow);
      await queryRunner.manager.save(MilestoneEntity, milestone);
      await queryRunner.manager.save(ProjectEntity, project);
      savedDispute = await queryRunner.manager.save(DisputeEntity, dispute);

      // Nếu là root dispute (chưa có groupId), update lại chính nó làm group leader
      if (!groupId) {
        savedDispute.groupId = savedDispute.id;
        await queryRunner.manager.update(
          DisputeEntity,
          { id: savedDispute.id },
          { groupId: savedDispute.groupId },
        );
      }
      const canonicalGroupId = savedDispute.groupId || savedDispute.id;

      await this.ensureDisputeParty(queryRunner.manager, {
        groupId: canonicalGroupId,
        disputeId: savedDispute.id,
        userId: raisedBy,
        role: raiserRole,
        side: DisputePartySide.RAISER,
      });

      await this.ensureDisputeParty(queryRunner.manager, {
        groupId: canonicalGroupId,
        disputeId: savedDispute.id,
        userId: defendantId,
        role: defendantRole,
        side: DisputePartySide.DEFENDANT,
      });

      if (!escrow.disputeId) {
        escrow.disputeId = savedDispute.id;
      }
      await queryRunner.manager.save(EscrowEntity, escrow);

      await this.verdictService.createDisputeSignature(
        queryRunner,
        savedDispute,
        raisedBy,
        raiserRole,
        {
          termsContentSnapshot: 'Dispute terms acknowledgment',
          termsVersion: 'v1',
        },
      );

      await this.logActivity(
        queryRunner,
        savedDispute.id,
        raisedBy,
        raiserRole,
        DisputeAction.CREATED,
        `Dispute created: ${raiserRole} vs ${defendantRole}`,
        {
          reason,
          category: disputeCategory,
          disputedAmount: amount,
          parentDisputeId: parentDisputeId || null,
        },
      );

      await this.appendLedgerEntry(queryRunner.manager, {
        disputeId: savedDispute.id,
        eventType: 'DISPUTE_CREATED',
        actorId: raisedBy,
        reason,
        previousStatus: null,
        newStatus: savedDispute.status,
        payload: {
          category: disputeCategory,
          disputedAmount: amount,
          parentDisputeId: parentDisputeId || null,
          groupId: canonicalGroupId,
        },
      });

      if (testBypassReason) {
        await this.logActivity(
          queryRunner,
          savedDispute.id,
          raisedBy,
          raiserRole,
          DisputeAction.NOTE_ADDED,
          'Dispute test bypass used for eligibility checks',
          {
            bypassReason: testBypassReason,
            disputeTestMode: process.env.DISPUTE_TEST_MODE === 'true',
          },
          true,
        );

        await this.appendLedgerEntry(queryRunner.manager, {
          disputeId: savedDispute.id,
          eventType: 'DISPUTE_TEST_BYPASS_USED',
          actorId: raisedBy,
          reason: testBypassReason,
          previousStatus: savedDispute.status,
          newStatus: savedDispute.status,
          payload: {
            bypassReason: testBypassReason,
            disputeTestMode: process.env.DISPUTE_TEST_MODE === 'true',
          },
        });
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    if (testBypassReason) {
      try {
        await this.auditLogsService.logCustom(
          'DISPUTE_TEST_BYPASS',
          'Dispute',
          savedDispute.id,
          {
            actorId: raisedBy,
            bypassReason: testBypassReason,
            disputeTestMode: process.env.DISPUTE_TEST_MODE === 'true',
          },
          undefined,
          raisedBy,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to persist dispute test bypass audit log for ${savedDispute.id}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    const assignment = await this.autoAssignStaff(savedDispute.id);
    let availability: Awaited<ReturnType<typeof this.checkInitialAvailability>> | null = null;
    try {
      availability = await this.checkInitialAvailability(
        savedDispute,
        project,
        assignment?.staffId || '',
        assignment?.complexity?.timeEstimation?.recommendedMinutes,
      );
    } catch (error) {
      this.logger.warn(
        `Initial availability check failed for dispute ${savedDispute.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    this.eventEmitter.emit(DISPUTE_EVENTS.CREATED, {
      disputeId: savedDispute.id,
      projectId,
      raisedById: raisedBy,
      raiserRole,
      defendantId,
      defendantRole,
      category: savedDispute.category,
      priority: savedDispute.priority,
      resolutionDeadline: savedDispute.resolutionDeadline,
      responseDeadline: savedDispute.responseDeadline,
      assignedStaffId: assignment?.staffId || null,
      availabilitySlots: availability?.slots || [],
    });

    const isUrgentDispute =
      savedDispute.category === DisputeCategory.FRAUD ||
      savedDispute.priority === DisputePriority.CRITICAL ||
      (savedDispute.resolutionDeadline
        ? savedDispute.resolutionDeadline.getTime() - Date.now() <=
          URGENT_THRESHOLD_HOURS * 60 * 60 * 1000
        : false);

    if (isUrgentDispute) {
      this.eventEmitter.emit(DISPUTE_EVENTS.URGENT_CREATED, {
        disputeId: savedDispute.id,
        category: savedDispute.category,
        priority: savedDispute.priority,
        assignedStaffId: assignment?.staffId || null,
        resolutionDeadline: savedDispute.resolutionDeadline,
      });
    }

    return savedDispute;
  }

  // =============================================================================
  // DANH SÁCH DISPUTES VỚI PAGINATION & FILTERS
  // =============================================================================

  /**
   * Lấy danh sách disputes với pagination, filters, và smart sorting
   * Disputes gần hết hạn + priority cao sẽ được đẩy lên đầu
   */
  async getAll(filters: DisputeFilterDto = {}): Promise<PaginatedDisputesResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = DisputeSortBy.URGENCY,
      sortOrder = SortOrder.DESC,
      status,
      statusIn,
      category,
      priority,
      disputeType,
      projectId,
      milestoneId,
      raisedById,
      defendantId,
      assignedStaffId,
      includeUnassignedForStaff,
      unassignedOnly,
      createdFrom,
      createdTo,
      deadlineBefore,
      deadlineFrom,
      deadlineTo,
      minDisputedAmount,
      maxDisputedAmount,
      overdueOnly,
      urgentOnly,
      appealed,
      search,
    } = filters;

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoin('dispute.raiser', 'raiser')
      .leftJoin('dispute.defendant', 'defendant')
      .leftJoin('dispute.project', 'project')
      .addSelect([
        'raiser.id',
        'raiser.fullName',
        'raiser.email',
        'defendant.id',
        'defendant.fullName',
        'defendant.email',
        'project.id',
        'project.title',
        'project.clientId',
        'project.brokerId',
        'project.freelancerId',
      ]);

    // === FILTERS ===
    if (statusIn && statusIn.length > 0) {
      qb.andWhere('dispute.status IN (:...statusIn)', { statusIn });
    } else if (status) {
      qb.andWhere('dispute.status = :status', { status });
    }

    if (category) {
      qb.andWhere('dispute.category = :category', { category });
    }

    if (priority) {
      qb.andWhere('dispute.priority = :priority', { priority });
    }

    if (disputeType) {
      qb.andWhere('dispute.disputeType = :disputeType', { disputeType });
    }

    if (projectId) {
      qb.andWhere('dispute.projectId = :projectId', { projectId });
    }

    if (milestoneId) {
      qb.andWhere('dispute.milestoneId = :milestoneId', { milestoneId });
    }

    if (raisedById) {
      qb.andWhere('dispute.raisedById = :raisedById', { raisedById });
    }

    if (defendantId) {
      qb.andWhere('dispute.defendantId = :defendantId', { defendantId });
    }

    if (assignedStaffId && includeUnassignedForStaff) {
      qb.andWhere(
        '(dispute.assignedStaffId = :assignedStaffId OR dispute.assignedStaffId IS NULL)',
        {
          assignedStaffId,
        },
      );
    } else if (assignedStaffId) {
      qb.andWhere('dispute.assignedStaffId = :assignedStaffId', { assignedStaffId });
    } else if (unassignedOnly) {
      qb.andWhere('dispute.assignedStaffId IS NULL');
    }

    // Date filters
    if (createdFrom) {
      qb.andWhere('dispute.createdAt >= :createdFrom', { createdFrom: new Date(createdFrom) });
    }

    if (createdTo) {
      qb.andWhere('dispute.createdAt <= :createdTo', { createdTo: new Date(createdTo) });
    }

    if (deadlineBefore) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineBefore', {
        deadlineBefore: new Date(deadlineBefore),
      });
    }

    if (deadlineFrom) {
      qb.andWhere('dispute.resolutionDeadline >= :deadlineFrom', {
        deadlineFrom: new Date(deadlineFrom),
      });
    }

    if (deadlineTo) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineTo', {
        deadlineTo: new Date(deadlineTo),
      });
    }

    if (minDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount >= :minDisputedAmount', { minDisputedAmount });
    }

    if (maxDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount <= :maxDisputedAmount', { maxDisputedAmount });
    }

    // Special filters
    const now = new Date();
    if (overdueOnly) {
      qb.andWhere('dispute.resolutionDeadline < :now', { now });
      qb.andWhere('dispute.status NOT IN (:...resolvedStatuses)', {
        resolvedStatuses: DISPUTE_CLOSED_STATUSES,
      });
    }

    if (urgentOnly) {
      const urgentThreshold = new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000);
      qb.andWhere('dispute.resolutionDeadline BETWEEN :now AND :urgentThreshold', {
        now,
        urgentThreshold,
      });
      qb.andWhere('dispute.status NOT IN (:...resolvedStatuses)', {
        resolvedStatuses: DISPUTE_CLOSED_STATUSES,
      });
    }

    if (appealed === true) {
      qb.andWhere('dispute.isAppealed = true');
    }

    if (search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('dispute.reason ILIKE :search', { search: `%${search}%` })
            .orWhere('dispute.adminComment ILIKE :search', { search: `%${search}%` })
            .orWhere('dispute.messages ILIKE :search', { search: `%${search}%` });
        }),
      );
    }

    // === SMART SORTING ===
    if (sortBy === DisputeSortBy.URGENCY) {
      // Custom urgency scoring: priority + deadline proximity
      // Disputes CRITICAL + sắp hết hạn lên đầu
      const priorityScoreSql = `CASE 
          WHEN dispute.priority = 'CRITICAL' THEN 4
          WHEN dispute.priority = 'HIGH' THEN 3
          WHEN dispute.priority = 'MEDIUM' THEN 2
          ELSE 1
        END`;

      const deadlineScoreSql = `CASE 
          WHEN dispute.resolutionDeadline < NOW() THEN 100
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '24 hours' THEN 50
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '48 hours' THEN 25
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '7 days' THEN 10
          ELSE 0
        END`;

      const urgencyScoreSql = `(${priorityScoreSql}) + (${deadlineScoreSql})`;
      const urgencyScoreAlias = 'urgencyscore';

      qb.addSelect(urgencyScoreSql, urgencyScoreAlias);

      // Sort by combined urgency (higher = more urgent)
      qb.orderBy('dispute.status', 'ASC') // OPEN, IN_MEDIATION first
        .addOrderBy(urgencyScoreAlias, 'DESC')
        .addOrderBy('dispute.createdAt', 'DESC');
    } else {
      // Standard sorting
      const orderDirection = sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';

      switch (sortBy) {
        case DisputeSortBy.PRIORITY:
          qb.orderBy(
            `CASE 
              WHEN dispute.priority = 'CRITICAL' THEN 1
              WHEN dispute.priority = 'HIGH' THEN 2
              WHEN dispute.priority = 'MEDIUM' THEN 3
              ELSE 4
            END`,
            orderDirection === 'DESC' ? 'ASC' : 'DESC', // CRITICAL first when DESC
          );
          break;
        case DisputeSortBy.DEADLINE:
          qb.orderBy('dispute.resolutionDeadline', orderDirection, 'NULLS LAST');
          break;
        case DisputeSortBy.DISPUTED_AMOUNT:
          qb.orderBy('dispute.disputedAmount', orderDirection, 'NULLS LAST');
          break;
        default:
          qb.orderBy(`dispute.${sortBy}`, orderDirection);
      }
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const data = await qb.getMany();

    // Enhance data with computed fields
    const enhancedData = data.map((dispute) => ({
      ...dispute,
      isOverdue: dispute.resolutionDeadline && dispute.resolutionDeadline < now,
      isUrgent:
        dispute.resolutionDeadline &&
        dispute.resolutionDeadline > now &&
        dispute.resolutionDeadline <
          new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000),
      hoursUntilDeadline: dispute.resolutionDeadline
        ? Math.round((dispute.resolutionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60))
        : null,
    }));

    const requestedStatuses = statusIn && statusIn.length > 0 ? statusIn : status ? [status] : [];
    const isQueueScopeStats =
      includeUnassignedForStaff === true ||
      (requestedStatuses.length > 0 &&
        requestedStatuses.every((item) => DISPUTE_QUEUE_STATUSES.includes(item)));

    const statsFilters: DisputeFilterDto = { ...filters };
    let ignoreStatusFilter = true;

    if (isQueueScopeStats) {
      // Queue stats must stay in triage scope only.
      statsFilters.status = undefined;
      statsFilters.statusIn = DISPUTE_QUEUE_STATUSES;
      ignoreStatusFilter = false;
    }

    const stats = await this.getDisputeStatsByScope(statsFilters, { ignoreStatusFilter });

    return {
      data: enhancedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      stats,
    };
  }

  /**
   * Lấy disputes liên quan đến user (tôi kiện / kiện tôi / project của tôi)
   */
  async getQueueDisputes(filters: DisputeFilterDto = {}): Promise<PaginatedDisputesResponse> {
    return this.getAll({
      ...filters,
      status: undefined,
      statusIn: DISPUTE_QUEUE_STATUSES,
      sortBy: filters.sortBy || DisputeSortBy.CREATED_AT,
    });
  }

  async getCaseloadDisputes(filters: DisputeFilterDto = {}): Promise<PaginatedDisputesResponse> {
    return this.getAll({
      ...filters,
      includeUnassignedForStaff: false,
      unassignedOnly: false,
    });
  }

  async getMyDisputes(
    userId: string,
    filters: DisputeFilterDto = {},
  ): Promise<PaginatedDisputesResponse> {
    const { asRaiser, asDefendant, asInvolved, ...restFilters } = filters;
    const resolvedAsInvolved = Boolean(asInvolved || (!asRaiser && !asDefendant));
    const requestedScopes = [
      asRaiser ? 'asRaiser' : null,
      asDefendant ? 'asDefendant' : null,
      resolvedAsInvolved ? 'asInvolved' : null,
    ]
      .filter(Boolean)
      .join(',');
    const safeGroupIdExpr = `COALESCE(
      CASE
        WHEN dispute."groupId" IS NOT NULL
          AND dispute."groupId"::text ~* '${UUID_REGEX}'
          THEN dispute."groupId"::text::uuid
        ELSE NULL
      END,
      dispute."id"
    )`;

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoin('dispute.raiser', 'raiser')
      .leftJoin('dispute.defendant', 'defendant')
      .leftJoin('dispute.project', 'project')
      .addSelect([
        'raiser.id',
        'raiser.fullName',
        'raiser.email',
        'defendant.id',
        'defendant.fullName',
        'defendant.email',
        'project.id',
        'project.title',
        'project.clientId',
        'project.brokerId',
        'project.freelancerId',
      ]);

    qb.andWhere(
      new Brackets((sub) => {
        if (asRaiser || resolvedAsInvolved) {
          sub.orWhere('dispute.raisedById = :userId', { userId });
        }
        if (asDefendant || resolvedAsInvolved) {
          sub.orWhere('dispute.defendantId = :userId', { userId });
        }
        if (resolvedAsInvolved) {
          sub.orWhere('project.clientId = :userId', { userId });
          sub.orWhere('project.freelancerId = :userId', { userId });
          sub.orWhere('project.brokerId = :userId', { userId });
          sub.orWhere(
            `EXISTS (
              SELECT 1
              FROM dispute_parties dp
              WHERE dp."groupId" = ${safeGroupIdExpr}
                AND dp."userId" = :userId
            )`,
            { userId },
          );
        }
      }),
    );

    try {
      return this.applyFiltersAndPaginate(qb, restFilters);
    } catch (error) {
      const errCode = (error as { code?: string })?.code || 'UNKNOWN';
      const errMessage = error instanceof Error ? error.message : 'unknown';
      this.logger.error(
        `[getMyDisputes] failed userId=${userId} scopes=${requestedScopes || 'default:asInvolved'} code=${errCode} message=${errMessage}`,
      );
      throw error;
    }
  }

  private resolveCounterpartySummary(
    dispute: {
      raisedById: string;
      defendantId: string;
      raiserName?: string | null;
      raiserEmail?: string | null;
      raiserRole?: UserRole | null;
      defendantName?: string | null;
      defendantEmail?: string | null;
      defendantRole?: UserRole | null;
    },
    userId: string,
  ): { name?: string | null; role?: UserRole | string | null } {
    if (userId === dispute.raisedById) {
      return {
        name: dispute.defendantName || dispute.defendantEmail || dispute.defendantId,
        role: dispute.defendantRole || null,
      };
    }
    if (userId === dispute.defendantId) {
      return {
        name: dispute.raiserName || dispute.raiserEmail || dispute.raisedById,
        role: dispute.raiserRole || null,
      };
    }
    return {
      name:
        dispute.defendantName ||
        dispute.defendantEmail ||
        dispute.raiserName ||
        dispute.raiserEmail ||
        dispute.defendantId,
      role: dispute.defendantRole || dispute.raiserRole || null,
    };
  }

  private resolveWorklistEligibility(
    disputeStatus: DisputeStatus,
    hasActiveHearing: boolean,
  ): {
    canProposeSlots: boolean;
    notEligibleReasonCode: SchedulingWorklistNotEligibleReasonCode;
    notEligibleReasonText: string;
  } {
    if (DISPUTE_CLOSED_STATUSES.includes(disputeStatus)) {
      return {
        canProposeSlots: false,
        notEligibleReasonCode: 'DISPUTE_CLOSED',
        notEligibleReasonText: 'This dispute is already closed.',
      };
    }

    if (hasActiveHearing) {
      return {
        canProposeSlots: false,
        notEligibleReasonCode: 'HEARING_ALREADY_SCHEDULED',
        notEligibleReasonText:
          'A hearing is already scheduled for this dispute. Please confirm or request reschedule.',
      };
    }

    if (
      [
        DisputeStatus.OPEN,
        DisputeStatus.TRIAGE_PENDING,
        DisputeStatus.PREVIEW,
        DisputeStatus.PENDING_REVIEW,
        DisputeStatus.INFO_REQUESTED,
      ].includes(disputeStatus)
    ) {
      return {
        canProposeSlots: false,
        notEligibleReasonCode: 'TRIAGE_NOT_ACCEPTED',
        notEligibleReasonText:
          'Slot proposals open only after staff completes preview and moves the dispute to mediation.',
      };
    }

    if (!PROPOSAL_ELIGIBLE_STATUSES.includes(disputeStatus)) {
      return {
        canProposeSlots: false,
        notEligibleReasonCode: 'TRIAGE_NOT_ACCEPTED',
        notEligibleReasonText: 'Slot proposals are not available for the current dispute status.',
      };
    }

    return {
      canProposeSlots: true,
      notEligibleReasonCode: 'NONE',
      notEligibleReasonText: '',
    };
  }

  async getSchedulingWorklist(
    userId: string,
    userRole: UserRole,
  ): Promise<SchedulingWorklistResponseDto> {
    if (!this.isSchedulingWorklistEnabled()) {
      return {
        enabled: false,
        items: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const safeGroupIdExpr = `COALESCE(
      CASE
        WHEN dispute."groupId" IS NOT NULL
          AND dispute."groupId"::text ~* '${UUID_REGEX}'
          THEN dispute."groupId"::text::uuid
        ELSE NULL
      END,
      dispute."id"
    )`;

    const rows = await this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoin('dispute.raiser', 'raiser')
      .leftJoin('dispute.defendant', 'defendant')
      .leftJoin('dispute.assignedStaff', 'assignedStaff')
      .leftJoin('dispute.project', 'project')
      .select([
        'dispute.id AS "disputeId"',
        'dispute.projectId AS "projectId"',
        'dispute.raisedById AS "raisedById"',
        'dispute.defendantId AS "defendantId"',
        'dispute.assignedStaffId AS "assignedStaffId"',
        'dispute.status AS "status"',
        'dispute.category AS "category"',
        'dispute.updatedAt AS "updatedAt"',
        'dispute.infoRequestReason AS "infoRequestReason"',
        'dispute.infoRequestDeadline AS "infoRequestDeadline"',
        'project.title AS "projectTitle"',
        'raiser.fullName AS "raiserName"',
        'raiser.email AS "raiserEmail"',
        'raiser.role AS "raiserRole"',
        'defendant.fullName AS "defendantName"',
        'defendant.email AS "defendantEmail"',
        'defendant.role AS "defendantRole"',
        'assignedStaff.fullName AS "assignedStaffName"',
        'assignedStaff.email AS "assignedStaffEmail"',
      ])
      .where('dispute.status IN (:...statuses)', {
        statuses: DISPUTE_SCHEDULING_WORKLIST_STATUSES,
      })
      .andWhere(
        new Brackets((sub) => {
          sub.orWhere('dispute.raisedById = :userId', { userId });
          sub.orWhere('dispute.defendantId = :userId', { userId });
          sub.orWhere('project.clientId = :userId', { userId });
          sub.orWhere('project.freelancerId = :userId', { userId });
          sub.orWhere('project.brokerId = :userId', { userId });
          sub.orWhere(
            `EXISTS (
              SELECT 1
              FROM dispute_parties dp
              WHERE dp."groupId" = ${safeGroupIdExpr}
                AND dp."userId" = :userId
            )`,
            { userId },
          );
          if (userRole === UserRole.STAFF || userRole === UserRole.ADMIN) {
            sub.orWhere('dispute.assignedStaffId = :userId', { userId });
          }
        }),
      )
      .getRawMany<{
        disputeId: string;
        projectId?: string | null;
        raisedById: string;
        defendantId: string;
        assignedStaffId?: string | null;
        status: DisputeStatus;
        category?: string | null;
        updatedAt: Date;
        infoRequestReason?: string | null;
        infoRequestDeadline?: Date | null;
        projectTitle?: string | null;
        raiserName?: string | null;
        raiserEmail?: string | null;
        raiserRole?: UserRole | null;
        defendantName?: string | null;
        defendantEmail?: string | null;
        defendantRole?: UserRole | null;
        assignedStaffName?: string | null;
        assignedStaffEmail?: string | null;
      }>();

    if (!rows.length) {
      return {
        enabled: true,
        items: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const disputeIds = rows.map((item) => item.disputeId);
    let degraded = false;
    let reasonCode: SchedulingWorklistResponseDto['reasonCode'] = 'NONE';
    let degradedMessage: string | undefined;

    const [activeHearings, viewedStates] = await Promise.all([
      this.hearingRepo.find({
        where: {
          disputeId: In(disputeIds),
          status: In(ACTIVE_HEARING_STATUSES),
        },
        select: ['id', 'disputeId'],
      }),
      this.disputeViewStateRepo
        .find({
          where: { disputeId: In(disputeIds), userId },
          select: ['disputeId', 'lastViewedAt'],
        })
        .catch((error) => {
          if (this.isUndefinedTableError(error, 'dispute_view_states')) {
            this.logger.warn(
              'dispute_view_states table is missing. Scheduling worklist will run without seen/new persistence.',
            );
            degraded = true;
            reasonCode = 'MIGRATION_REQUIRED';
            degradedMessage =
              'Scheduling metadata is partially unavailable. Please run pending migrations for dispute_view_states.';
            return [];
          }
          throw error;
        }),
    ]);

    const hearingById = new Map(activeHearings.map((hearing) => [hearing.id, hearing.disputeId]));
    const activeHearingDisputeIds = new Set(activeHearings.map((hearing) => hearing.disputeId));
    const hearingIds = activeHearings.map((hearing) => hearing.id);

    const pendingInviteDisputeIds = new Set<string>();
    if (hearingIds.length > 0) {
      const pendingInviteRows = await this.eventParticipantRepo
        .createQueryBuilder('participant')
        .innerJoin('participant.event', 'event')
        .select(['event.referenceId AS "hearingId"'])
        .where('participant.userId = :userId', { userId })
        .andWhere('participant.status IN (:...participantStatuses)', {
          participantStatuses: PENDING_INVITE_PARTICIPANT_STATUSES,
        })
        .andWhere('event.type = :eventType', { eventType: EventType.DISPUTE_HEARING })
        .andWhere('event.referenceType = :referenceType', { referenceType: 'DisputeHearing' })
        .andWhere('event.referenceId IN (:...hearingIds)', { hearingIds })
        .andWhere('event.status IN (:...eventStatuses)', {
          eventStatuses: [
            EventStatus.PENDING_CONFIRMATION,
            EventStatus.RESCHEDULING,
            EventStatus.SCHEDULED,
          ],
        })
        .getRawMany<{ hearingId: string }>();

      pendingInviteRows.forEach((item) => {
        const disputeId = hearingById.get(item.hearingId);
        if (disputeId) {
          pendingInviteDisputeIds.add(disputeId);
        }
      });
    }

    const viewedAtByDisputeId = new Map(
      viewedStates.map((state) => [state.disputeId, state.lastViewedAt]),
    );
    const nowMs = Date.now();

    const items: SchedulingWorklistItemDto[] = rows.map((dispute) => {
      const counterparty = this.resolveCounterpartySummary(dispute, userId);
      const updatedAt = new Date(dispute.updatedAt);
      const viewedAt = viewedAtByDisputeId.get(dispute.disputeId);
      const isSeen = Boolean(viewedAt && viewedAt.getTime() >= updatedAt.getTime());
      const isNew = nowMs - updatedAt.getTime() <= WORKLIST_NEW_WINDOW_MS && !isSeen;
      const hasActiveHearing = activeHearingDisputeIds.has(dispute.disputeId);
      const hasPendingInvite = pendingInviteDisputeIds.has(dispute.disputeId);
      const eligibility = this.resolveWorklistEligibility(dispute.status, hasActiveHearing);
      const canCancel =
        dispute.raisedById === userId &&
        [DisputeStatus.TRIAGE_PENDING, DisputeStatus.PREVIEW].includes(dispute.status);
      const perspective: SchedulingWorklistPerspective =
        dispute.raisedById === userId
          ? 'RAISER'
          : dispute.defendantId === userId
            ? 'DEFENDANT'
            : 'OTHER';

      let actionType: SchedulingWorklistActionType = 'NONE';
      if (hasPendingInvite) {
        actionType = 'CONFIRM_HEARING';
      } else if (dispute.status === DisputeStatus.INFO_REQUESTED && dispute.raisedById === userId) {
        actionType = 'PROVIDE_INFO';
      } else if (eligibility.canProposeSlots) {
        actionType = 'PROPOSE_SLOT';
      }

      return {
        disputeId: dispute.disputeId,
        displayCode: `#${dispute.disputeId.slice(0, 8)}`,
        projectId: dispute.projectId || null,
        projectTitle: dispute.projectTitle || dispute.projectId || null,
        category: dispute.category || null,
        status: dispute.status,
        perspective,
        raiserName: dispute.raiserName || dispute.raiserEmail || dispute.raisedById,
        raiserRole: dispute.raiserRole || null,
        defendantName: dispute.defendantName || dispute.defendantEmail || dispute.defendantId,
        defendantRole: dispute.defendantRole || null,
        counterpartyName: counterparty.name,
        counterpartyRole: counterparty.role || null,
        assignedStaffId: dispute.assignedStaffId || null,
        assignedStaffName: dispute.assignedStaffName || null,
        assignedStaffEmail: dispute.assignedStaffEmail || null,
        updatedAt: updatedAt.toISOString(),
        isNew,
        isSeen,
        requiresAction: actionType !== 'NONE',
        actionType,
        canProposeSlots: eligibility.canProposeSlots,
        canCancel,
        notEligibleReasonCode: eligibility.notEligibleReasonCode,
        notEligibleReasonText: eligibility.notEligibleReasonText,
        infoRequestReason: dispute.infoRequestReason || null,
        infoRequestDeadline: dispute.infoRequestDeadline
          ? new Date(dispute.infoRequestDeadline).toISOString()
          : null,
      };
    });

    items.sort((a, b) => {
      const actionDiff = Number(b.requiresAction) - Number(a.requiresAction);
      if (actionDiff !== 0) return actionDiff;
      const newDiff = Number(b.isNew) - Number(a.isNew);
      if (newDiff !== 0) return newDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return {
      enabled: true,
      items,
      generatedAt: new Date().toISOString(),
      degraded,
      reasonCode,
      message: degradedMessage,
    };
  }

  async markDisputeViewed(disputeId: string, userId: string, userRole: UserRole) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'groupId', 'raisedById', 'defendantId', 'assignedStaffId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    await this.assertDisputeAccess(dispute, userId, userRole);

    const now = new Date();
    let existing: DisputeViewStateEntity | null = null;
    try {
      existing = await this.disputeViewStateRepo.findOne({
        where: {
          disputeId,
          userId,
        },
      });
    } catch (error) {
      if (this.isUndefinedTableError(error, 'dispute_view_states')) {
        this.logger.warn(
          'dispute_view_states table is missing. Mark viewed request is acknowledged without persistence.',
        );
        return {
          disputeId,
          userId,
          isSeen: true,
          lastViewedAt: now.toISOString(),
          persisted: false,
        };
      }
      throw error;
    }

    if (existing) {
      existing.lastViewedAt = now;
      const saved = await this.disputeViewStateRepo.save(existing);
      return {
        disputeId,
        userId,
        isSeen: true,
        lastViewedAt: saved.lastViewedAt.toISOString(),
        persisted: true,
      };
    }

    let created: DisputeViewStateEntity;
    try {
      created = await this.disputeViewStateRepo.save(
        this.disputeViewStateRepo.create({
          disputeId,
          userId,
          lastViewedAt: now,
        }),
      );
    } catch (error) {
      if (this.isUndefinedTableError(error, 'dispute_view_states')) {
        this.logger.warn(
          'dispute_view_states table is missing. Mark viewed request is acknowledged without persistence.',
        );
        return {
          disputeId,
          userId,
          isSeen: true,
          lastViewedAt: now.toISOString(),
          persisted: false,
        };
      }
      throw error;
    }

    return {
      disputeId,
      userId,
      isSeen: true,
      lastViewedAt: created.lastViewedAt.toISOString(),
      persisted: true,
    };
  }

  private applyScopeFiltersForStats(
    qb: SelectQueryBuilder<DisputeEntity>,
    filters: DisputeFilterDto,
    options?: { ignoreStatusFilter?: boolean },
  ): void {
    const {
      status,
      statusIn,
      category,
      priority,
      disputeType,
      projectId,
      milestoneId,
      raisedById,
      defendantId,
      assignedStaffId,
      includeUnassignedForStaff,
      unassignedOnly,
      createdFrom,
      createdTo,
      deadlineBefore,
      deadlineFrom,
      deadlineTo,
      minDisputedAmount,
      maxDisputedAmount,
      overdueOnly,
      urgentOnly,
      appealed,
      search,
    } = filters;

    if (!options?.ignoreStatusFilter) {
      if (statusIn && statusIn.length > 0) {
        qb.andWhere('d.status IN (:...statusIn)', { statusIn });
      } else if (status) {
        qb.andWhere('d.status = :status', { status });
      }
    }

    if (category) qb.andWhere('d.category = :category', { category });
    if (priority) qb.andWhere('d.priority = :priority', { priority });
    if (disputeType) qb.andWhere('d.disputeType = :disputeType', { disputeType });
    if (projectId) qb.andWhere('d.projectId = :projectId', { projectId });
    if (milestoneId) qb.andWhere('d.milestoneId = :milestoneId', { milestoneId });
    if (raisedById) qb.andWhere('d.raisedById = :raisedById', { raisedById });
    if (defendantId) qb.andWhere('d.defendantId = :defendantId', { defendantId });

    if (assignedStaffId && includeUnassignedForStaff) {
      qb.andWhere('(d.assignedStaffId = :assignedStaffId OR d.assignedStaffId IS NULL)', {
        assignedStaffId,
      });
    } else if (assignedStaffId) {
      qb.andWhere('d.assignedStaffId = :assignedStaffId', { assignedStaffId });
    } else if (unassignedOnly) {
      qb.andWhere('d.assignedStaffId IS NULL');
    }

    if (createdFrom) {
      qb.andWhere('d.createdAt >= :createdFrom', { createdFrom: new Date(createdFrom) });
    }
    if (createdTo) {
      qb.andWhere('d.createdAt <= :createdTo', { createdTo: new Date(createdTo) });
    }
    if (deadlineBefore) {
      qb.andWhere('d.resolutionDeadline <= :deadlineBefore', {
        deadlineBefore: new Date(deadlineBefore),
      });
    }
    if (deadlineFrom) {
      qb.andWhere('d.resolutionDeadline >= :deadlineFrom', {
        deadlineFrom: new Date(deadlineFrom),
      });
    }
    if (deadlineTo) {
      qb.andWhere('d.resolutionDeadline <= :deadlineTo', {
        deadlineTo: new Date(deadlineTo),
      });
    }
    if (minDisputedAmount !== undefined) {
      qb.andWhere('d.disputedAmount >= :minDisputedAmount', { minDisputedAmount });
    }
    if (maxDisputedAmount !== undefined) {
      qb.andWhere('d.disputedAmount <= :maxDisputedAmount', { maxDisputedAmount });
    }

    const now = new Date();
    if (overdueOnly) {
      qb.andWhere('d.resolutionDeadline < :now', { now });
      qb.andWhere('d.status NOT IN (:...resolvedStatuses)', {
        resolvedStatuses: DISPUTE_CLOSED_STATUSES,
      });
    }
    if (urgentOnly) {
      const urgentThreshold = new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000);
      qb.andWhere('d.resolutionDeadline BETWEEN :now AND :urgentThreshold', {
        now,
        urgentThreshold,
      });
      qb.andWhere('d.status NOT IN (:...resolvedStatuses)', {
        resolvedStatuses: DISPUTE_CLOSED_STATUSES,
      });
    }
    if (appealed === true) {
      qb.andWhere('d.isAppealed = true');
    }
    if (search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('d.reason ILIKE :search', { search: `%${search}%` })
            .orWhere('d.adminComment ILIKE :search', { search: `%${search}%` })
            .orWhere('d.messages ILIKE :search', { search: `%${search}%` });
        }),
      );
    }
  }

  private async getDisputeStatsByScope(
    filters: DisputeFilterDto = {},
    options?: { ignoreStatusFilter?: boolean },
  ): Promise<{
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    urgent: number;
  }> {
    const baseQb = this.disputeRepo.createQueryBuilder('d');
    this.applyScopeFiltersForStats(baseQb, filters, options);

    const now = new Date();
    const urgentThreshold = new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000);

    const [byStatusRows, byPriorityRows, overdue, urgent] = await Promise.all([
      baseQb
        .clone()
        .select('d.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.status')
        .getRawMany(),
      baseQb
        .clone()
        .select('d.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .andWhere('d.status NOT IN (:...resolved)', {
          resolved: DISPUTE_CLOSED_STATUSES,
        })
        .groupBy('d.priority')
        .getRawMany(),
      baseQb
        .clone()
        .andWhere('d.resolutionDeadline < :now', { now })
        .andWhere('d.status NOT IN (:...resolved)', {
          resolved: DISPUTE_CLOSED_STATUSES,
        })
        .getCount(),
      baseQb
        .clone()
        .andWhere('d.resolutionDeadline BETWEEN :now AND :urgentThreshold', {
          now,
          urgentThreshold,
        })
        .andWhere('d.status NOT IN (:...resolved)', {
          resolved: DISPUTE_CLOSED_STATUSES,
        })
        .getCount(),
    ]);

    return {
      byStatus: (byStatusRows as Array<{ status: string; count: string }>).reduce(
        (acc, { status, count }) => ({ ...acc, [status]: Number(count) }),
        {} as Record<string, number>,
      ),
      byPriority: (byPriorityRows as Array<{ priority: string; count: string }>).reduce(
        (acc, { priority, count }) => ({ ...acc, [priority]: Number(count) }),
        {} as Record<string, number>,
      ),
      overdue,
      urgent,
    };
  }

  /**
   * Lấy thống kê disputes cho dashboard
   */
  async getDisputeStats(): Promise<{
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    urgent: number;
  }> {
    const cached = this.disputeStatsCache;
    const nowMs = Date.now();
    if (cached && cached.expiresAt > nowMs) {
      return cached.value;
    }

    const now = new Date();
    const urgentThreshold = new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000);

    const [byStatus, byPriority, overdue, urgent] = await Promise.all([
      // By status
      this.disputeRepo
        .createQueryBuilder('d')
        .select('d.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.status')
        .getRawMany(),

      // By priority (only active disputes)
      this.disputeRepo
        .createQueryBuilder('d')
        .select('d.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('d.status NOT IN (:...resolved)', {
          resolved: DISPUTE_CLOSED_STATUSES,
        })
        .groupBy('d.priority')
        .getRawMany(),

      // Overdue count
      this.disputeRepo.count({
        where: {
          resolutionDeadline: LessThan(now),
          status: Not(In(DISPUTE_CLOSED_STATUSES)),
        },
      }),

      // Urgent count (< 48h)
      this.disputeRepo.count({
        where: {
          resolutionDeadline: Between(now, urgentThreshold),
          status: Not(In(DISPUTE_CLOSED_STATUSES)),
        },
      }),
    ]);

    const stats = {
      byStatus: (byStatus as Array<{ status: string; count: string }>).reduce(
        (acc, { status, count }) => ({ ...acc, [status]: Number(count) }),
        {} as Record<string, number>,
      ),
      byPriority: (byPriority as Array<{ priority: string; count: string }>).reduce(
        (acc, { priority, count }) => ({ ...acc, [priority]: Number(count) }),
        {} as Record<string, number>,
      ),
      overdue,
      urgent,
    };

    this.disputeStatsCache = {
      value: stats,
      expiresAt: nowMs + this.disputeStatsTtlMs,
    };

    return stats;
  }

  async getQueueCount(
    userId: string,
    userRole: UserRole,
  ): Promise<{
    count: number;
    statuses: DisputeStatus[];
  }> {
    if (![UserRole.STAFF, UserRole.ADMIN].includes(userRole)) {
      throw new ForbiddenException('Only staff/admin can access dispute queue count');
    }

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .where('dispute.status IN (:...statuses)', { statuses: DISPUTE_QUEUE_STATUSES });

    if (userRole === UserRole.STAFF) {
      qb.andWhere('(dispute.assignedStaffId IS NULL OR dispute.assignedStaffId = :staffId)', {
        staffId: userId,
      });
    }

    const count = await qb.getCount();
    return {
      count,
      statuses: DISPUTE_QUEUE_STATUSES,
    };
  }

  async cancelDispute(requesterId: string, disputeId: string, reason?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let canceledDispute: DisputeEntity;
    let previousStatus: DisputeStatus;
    let milestoneReleased = false;
    let projectReleased = false;

    try {
      const dispute = await queryRunner.manager.findOne(DisputeEntity, {
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (dispute.raisedById !== requesterId) {
        throw new ForbiddenException('Only the raiser can cancel this dispute');
      }

      const allowedStatuses = [DisputeStatus.TRIAGE_PENDING, DisputeStatus.PREVIEW];
      if (!allowedStatuses.includes(dispute.status)) {
        throw new BadRequestException(
          `Dispute can only be canceled in ${allowedStatuses.join(', ')} statuses`,
        );
      }

      previousStatus = dispute.status;
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.CANCELED);
      canceledDispute = await queryRunner.manager.save(DisputeEntity, dispute);

      const requester = await queryRunner.manager.findOne(UserEntity, {
        where: { id: requesterId },
        select: ['id', 'role'],
      });
      const actorRole = requester?.role ?? dispute.raiserRole ?? UserRole.CLIENT;

      await this.logActivity(
        queryRunner,
        dispute.id,
        requesterId,
        actorRole,
        DisputeAction.CANCELED,
        'Dispute canceled by raiser during early review',
        {
          reason: reason?.trim() || null,
          previousStatus,
        },
      );

      await this.appendLedgerEntry(queryRunner.manager, {
        disputeId: dispute.id,
        eventType: 'DISPUTE_CANCELED',
        actorId: requesterId,
        reason: reason?.trim() || undefined,
        previousStatus,
        newStatus: canceledDispute.status,
        payload: {
          canceledInStatus: previousStatus,
        },
      });

      const milestoneActiveCount = await queryRunner.manager.count(DisputeEntity, {
        where: {
          milestoneId: dispute.milestoneId,
          status: In(DISPUTE_ACTIVE_STATUSES),
        },
      });

      if (milestoneActiveCount === 0) {
        const milestone = await queryRunner.manager.findOne(MilestoneEntity, {
          where: { id: dispute.milestoneId },
          lock: { mode: 'pessimistic_write' },
        });
        if (milestone && milestone.status === MilestoneStatus.LOCKED) {
          milestone.status = this.resolveMilestoneStatusAfterCancel(milestone);
          await queryRunner.manager.save(MilestoneEntity, milestone);
          milestoneReleased = true;
        }

        const escrow = await queryRunner.manager.findOne(EscrowEntity, {
          where: { milestoneId: dispute.milestoneId },
          lock: { mode: 'pessimistic_write' },
        });
        if (escrow && escrow.status === EscrowStatus.DISPUTED) {
          escrow.status = EscrowStatus.FUNDED;
          await queryRunner.manager.save(EscrowEntity, escrow);
        }
      }

      const projectActiveCount = await queryRunner.manager.count(DisputeEntity, {
        where: {
          projectId: dispute.projectId,
          status: In(DISPUTE_ACTIVE_STATUSES),
        },
      });

      if (projectActiveCount === 0) {
        const project = await queryRunner.manager.findOne(ProjectEntity, {
          where: { id: dispute.projectId },
          lock: { mode: 'pessimistic_write' },
        });
        if (project && project.status === ProjectStatus.DISPUTED) {
          project.status = ProjectStatus.IN_PROGRESS;
          await queryRunner.manager.save(ProjectEntity, project);
          projectReleased = true;
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
      disputeId,
      previousStatus,
      newStatus: DisputeStatus.CANCELED,
    });
    this.eventEmitter.emit(DISPUTE_EVENTS.CLOSED, {
      disputeId,
      closedStatus: DisputeStatus.CANCELED,
      canceledById: requesterId,
      reason: reason?.trim() || null,
    });

    return {
      ...canceledDispute,
      lockRelease: {
        milestoneReleased,
        projectReleased,
      },
    };
  }

  private canUseDisputeTestBypass(role?: UserRole | null): boolean {
    if (!role || ![UserRole.STAFF, UserRole.ADMIN].includes(role)) {
      return false;
    }

    const testMode = process.env.DISPUTE_TEST_MODE === 'true';
    const runtimeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
    const isProduction = runtimeEnv === 'production' || runtimeEnv === 'prod';

    return testMode && !isProduction;
  }

  private async collectMilestoneExecutionSignal(
    manager: EntityManager,
    milestone: MilestoneEntity,
  ): Promise<MilestoneExecutionSignal> {
    const taskRepo = manager.getRepository(TaskEntity);
    const tasks = await taskRepo.find({
      where: { milestoneId: milestone.id },
      select: ['id', 'status', 'proofLink', 'submissionNote', 'submittedAt'],
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const proofTasks = tasks.filter((task) => {
      return Boolean(
        task.submittedAt ||
        (task.proofLink && task.proofLink.trim().length > 0) ||
        (task.submissionNote && task.submissionNote.trim().length > 0),
      );
    }).length;

    const milestoneHasProof = Boolean(
      (milestone.proofOfWork && milestone.proofOfWork.trim().length > 0) || milestone.submittedAt,
    );

    const progressPercent =
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : milestoneHasProof
          ? 100
          : 0;

    const hasMeaningfulWork = milestoneHasProof || completedTasks > 0 || proofTasks > 0;

    return {
      totalTasks,
      completedTasks,
      proofTasks,
      milestoneHasProof,
      progressPercent,
      hasMeaningfulWork,
    };
  }

  private evaluateDisputeEligibility(input: {
    category: DisputeCategory;
    milestone: MilestoneEntity;
    escrow: EscrowEntity;
    executionSignal: MilestoneExecutionSignal;
    now: Date;
  }): DisputeEligibilityResult {
    const { category, milestone, escrow, executionSignal, now } = input;

    if (
      executionSignal.progressPercent <= 0 &&
      !executionSignal.milestoneHasProof &&
      executionSignal.proofTasks <= 0
    ) {
      return {
        allowed: false,
        reason:
          'Dispute blocked: 0% progress and no meaningful proof of work. Please submit evidence or complete work first.',
      };
    }

    switch (category) {
      case DisputeCategory.DEADLINE: {
        if (!milestone.dueDate || milestone.dueDate >= now) {
          return {
            allowed: false,
            reason: 'Deadline disputes require an overdue milestone (dueDate must be in the past).',
          };
        }
        return { allowed: true, reason: 'Eligible deadline dispute.' };
      }

      case DisputeCategory.QUALITY: {
        const reviewableStatuses = [
          MilestoneStatus.SUBMITTED,
          MilestoneStatus.REVISIONS_REQUIRED,
          MilestoneStatus.COMPLETED,
          MilestoneStatus.PAID,
          MilestoneStatus.LOCKED,
        ];

        if (!reviewableStatuses.includes(milestone.status)) {
          return {
            allowed: false,
            reason:
              'Quality disputes require a submitted/reviewable milestone state with delivery evidence.',
          };
        }

        if (!executionSignal.hasMeaningfulWork) {
          return {
            allowed: false,
            reason: 'Quality disputes require task output or milestone proof before filing.',
          };
        }

        return { allowed: true, reason: 'Eligible quality dispute.' };
      }

      case DisputeCategory.PAYMENT: {
        const validEscrowStatuses = [
          EscrowStatus.FUNDED,
          EscrowStatus.RELEASED,
          EscrowStatus.DISPUTED,
        ];
        if (!validEscrowStatuses.includes(escrow.status)) {
          return {
            allowed: false,
            reason: 'Payment disputes require valid escrow context (FUNDED/RELEASED/DISPUTED).',
          };
        }
        if (!executionSignal.hasMeaningfulWork) {
          return {
            allowed: false,
            reason:
              'Payment disputes require execution proof (task progress, submissions, or milestone evidence).',
          };
        }
        return { allowed: true, reason: 'Eligible payment dispute.' };
      }

      case DisputeCategory.COMMUNICATION:
      case DisputeCategory.CONTRACT:
      case DisputeCategory.FRAUD:
      case DisputeCategory.OTHER: {
        if (!executionSignal.hasMeaningfulWork) {
          return {
            allowed: false,
            reason:
              'Dispute requires minimum execution/proof signal. Add task submissions or supporting evidence first.',
          };
        }
        return { allowed: true, reason: 'Eligible dispute.' };
      }

      default:
        return { allowed: true, reason: 'Eligible dispute.' };
    }
  }

  private resolveMilestoneStatusAfterCancel(milestone: MilestoneEntity): MilestoneStatus {
    if (
      milestone.submittedAt ||
      (milestone.proofOfWork && milestone.proofOfWork.trim().length > 0)
    ) {
      return MilestoneStatus.SUBMITTED;
    }

    return MilestoneStatus.IN_PROGRESS;
  }

  /**
   * Helper: Apply filters and paginate to QueryBuilder
   */
  private async applyFiltersAndPaginate(
    qb: SelectQueryBuilder<DisputeEntity>,
    filters: Omit<DisputeFilterDto, 'asRaiser' | 'asDefendant' | 'asInvolved'>,
  ): Promise<PaginatedDisputesResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = DisputeSortBy.URGENCY,
      sortOrder = SortOrder.DESC,
      status,
      statusIn,
      category,
      priority,
      milestoneId,
      assignedStaffId,
      includeUnassignedForStaff,
      unassignedOnly,
      createdFrom,
      createdTo,
      deadlineBefore,
      deadlineFrom,
      deadlineTo,
      minDisputedAmount,
      maxDisputedAmount,
    } = filters;

    if (statusIn && statusIn.length > 0) {
      qb.andWhere('dispute.status IN (:...statusIn)', { statusIn });
    } else if (status) {
      qb.andWhere('dispute.status = :status', { status });
    }
    if (category) qb.andWhere('dispute.category = :category', { category });
    if (priority) qb.andWhere('dispute.priority = :priority', { priority });
    if (milestoneId) qb.andWhere('dispute.milestoneId = :milestoneId', { milestoneId });
    if (assignedStaffId && includeUnassignedForStaff) {
      qb.andWhere(
        '(dispute.assignedStaffId = :assignedStaffId OR dispute.assignedStaffId IS NULL)',
        {
          assignedStaffId,
        },
      );
    } else if (assignedStaffId) {
      qb.andWhere('dispute.assignedStaffId = :assignedStaffId', { assignedStaffId });
    } else if (unassignedOnly) {
      qb.andWhere('dispute.assignedStaffId IS NULL');
    }
    if (createdFrom) {
      qb.andWhere('dispute.createdAt >= :createdFrom', { createdFrom: new Date(createdFrom) });
    }
    if (createdTo) {
      qb.andWhere('dispute.createdAt <= :createdTo', { createdTo: new Date(createdTo) });
    }
    if (deadlineBefore) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineBefore', {
        deadlineBefore: new Date(deadlineBefore),
      });
    }
    if (deadlineFrom) {
      qb.andWhere('dispute.resolutionDeadline >= :deadlineFrom', {
        deadlineFrom: new Date(deadlineFrom),
      });
    }
    if (deadlineTo) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineTo', {
        deadlineTo: new Date(deadlineTo),
      });
    }
    if (minDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount >= :minDisputedAmount', { minDisputedAmount });
    }
    if (maxDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount <= :maxDisputedAmount', { maxDisputedAmount });
    }

    // Sorting
    if (sortBy === DisputeSortBy.URGENCY) {
      qb.orderBy('dispute.resolutionDeadline', 'ASC', 'NULLS LAST')
        .addOrderBy('dispute.priority', 'DESC')
        .addOrderBy('dispute.createdAt', 'DESC');
    } else {
      qb.orderBy(`dispute.${sortBy}`, sortOrder);
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const now = new Date();
    const enhancedData = data.map((dispute: DisputeEntity) => ({
      ...dispute,
      isOverdue: dispute.resolutionDeadline && dispute.resolutionDeadline < now,
      isUrgent:
        dispute.resolutionDeadline &&
        dispute.resolutionDeadline > now &&
        dispute.resolutionDeadline <
          new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000),
    }));

    return {
      data: enhancedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getDetail(disputeId: string) {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);
    }
    return dispute;
  }

  async triageDispute(
    staffId: string,
    disputeId: string,
    dto: TriageDisputeDto,
  ): Promise<DisputeEntity> {
    switch (dto.action) {
      case TriageActionType.ACCEPT:
        return await this.acceptDispute(staffId, disputeId);
      case TriageActionType.REJECT:
        if (!dto.reason?.trim()) {
          throw new BadRequestException('Reason is required for REJECT action');
        }
        return await this.rejectDispute(staffId, disputeId, dto.reason);
      case TriageActionType.REQUEST_INFO:
        if (!dto.reason?.trim()) {
          throw new BadRequestException('Reason is required for REQUEST_INFO action');
        }
        return await this.requestAdditionalInfo(staffId, disputeId, dto.reason, dto.deadlineAt);
      case TriageActionType.COMPLETE_PREVIEW:
        return await this.completePreview(staffId, disputeId, dto.reason);
      default:
        throw new BadRequestException('Unsupported triage action');
    }
  }

  async completePreview(
    staffId: string,
    disputeId: string,
    note?: string,
    options?: { autoSchedule?: boolean },
  ): Promise<DisputeEntity> {
    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can complete preview');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const disputeRepo = manager.getRepository(DisputeEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);

      const dispute = await disputeRepo.findOne({
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (![DisputeStatus.PREVIEW, DisputeStatus.PENDING_REVIEW].includes(dispute.status)) {
        throw new BadRequestException(
          `Cannot complete preview from status ${dispute.status}. Allowed statuses: PREVIEW, PENDING_REVIEW.`,
        );
      }

      if (
        dispute.assignedStaffId &&
        dispute.assignedStaffId !== staffId &&
        staff.role !== UserRole.ADMIN
      ) {
        this.throwAssignedToOtherStaffForbidden(dispute);
      }

      const previousStatus = dispute.status;
      const now = new Date();
      if (!dispute.assignedStaffId) {
        dispute.assignedStaffId = staffId;
        dispute.assignedAt = now;
      }
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.IN_MEDIATION);
      dispute.previewCompletedById = staffId;
      dispute.previewCompletedAt = now;
      if (note?.trim()) {
        dispute.adminComment = note.trim();
      }

      const updated = await disputeRepo.save(dispute);

      await activityRepo.save(
        activityRepo.create({
          disputeId: dispute.id,
          actorId: staff.id,
          actorRole: staff.role,
          action: DisputeAction.ESCALATED,
          description: 'Preview completed. Dispute moved to mediation.',
          metadata: {
            previousStatus,
            note: note?.trim() || null,
          },
        }),
      );

      await this.appendLedgerEntry(manager, {
        disputeId: dispute.id,
        eventType: 'PREVIEW_COMPLETED',
        actorId: staff.id,
        reason: note?.trim() || null,
        previousStatus,
        newStatus: updated.status,
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId: dispute.id,
        previousStatus,
        newStatus: updated.status,
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.ESCALATED, {
        disputeId: dispute.id,
        adminId: staff.id,
      });

      return updated;
    });

    const shouldAutoSchedule = options?.autoSchedule !== false;
    if (shouldAutoSchedule) {
      try {
        await this.escalateToHearing(disputeId, staffId);
      } catch (error) {
        this.logger.warn(
          `Auto-schedule after preview completion failed for dispute ${disputeId}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return updated;
  }

  async completePreviewWithScheduling(
    staffId: string,
    disputeId: string,
    note?: string,
  ): Promise<{
    dispute: DisputeEntity;
    scheduleResult: Awaited<ReturnType<DisputesService['escalateToHearing']>>;
  }> {
    const dispute = await this.completePreview(staffId, disputeId, note, { autoSchedule: false });

    try {
      const scheduleResult = await this.escalateToHearing(disputeId, staffId);
      return { dispute, scheduleResult };
    } catch (error) {
      const fallbackReason =
        error instanceof Error ? error.message : 'Auto-scheduling failed after preview completion';
      this.logger.warn(
        `Auto-schedule after preview completion failed for dispute ${disputeId}: ${fallbackReason}`,
      );
      return {
        dispute,
        scheduleResult: {
          manualRequired: true,
          reasonCode: this.mapNoSlotsReasonCode(fallbackReason),
          reason: fallbackReason,
          fallbackReason,
        },
      };
    }
  }

  private getEscalationAmountThreshold(): number {
    const raw = process.env.DISPUTE_ESCALATION_AMOUNT_THRESHOLD;
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5000;
    }
    return parsed;
  }

  private async evaluateEscalationPolicy(dispute: DisputeEntity): Promise<{
    recommendEscalation: boolean;
    rationale: Array<{ code: string; detail: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }>;
    metrics: {
      disputedAmount: number | null;
      amountThreshold: number;
      rescheduleCount: number;
      pendingQuestionCount: number;
      complexityLevel: string | null;
    };
  }> {
    const amountThreshold = this.getEscalationAmountThreshold();
    const rationale: Array<{ code: string; detail: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }> =
      [];

    const disputedAmount = dispute.disputedAmount ? Number(dispute.disputedAmount) : null;
    if (disputedAmount !== null && disputedAmount >= amountThreshold) {
      rationale.push({
        code: 'HIGH_DISPUTED_AMOUNT',
        detail: `Disputed amount ${disputedAmount} exceeds threshold ${amountThreshold}.`,
        severity: 'HIGH',
      });
    }

    let complexityLevel: string | null = null;
    try {
      const complexity = await this.staffAssignmentService.estimateDisputeComplexity(dispute.id);
      complexityLevel = complexity?.level || null;
      if (complexityLevel === 'HIGH' || complexityLevel === 'CRITICAL') {
        rationale.push({
          code: 'HIGH_COMPLEXITY',
          detail: `Estimated dispute complexity is ${complexityLevel}.`,
          severity: complexityLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        });
      }
    } catch {
      // Keep policy evaluation resilient to complexity estimator failures.
    }

    const latestHearing = await this.hearingRepo.findOne({
      where: { disputeId: dispute.id },
      order: { createdAt: 'DESC' },
      select: ['id', 'rescheduleCount'],
    });
    const rescheduleCount = latestHearing?.rescheduleCount || 0;
    if (rescheduleCount >= 2) {
      rationale.push({
        code: 'REPEATED_RESCHEDULES',
        detail: `Hearing has been rescheduled ${rescheduleCount} times.`,
        severity: rescheduleCount >= 3 ? 'HIGH' : 'MEDIUM',
      });
    }

    const pendingQuestionCount = latestHearing
      ? await this.hearingQuestionRepo.count({
          where: {
            hearingId: latestHearing.id,
            status: HearingQuestionStatus.PENDING_ANSWER,
          },
        })
      : 0;
    if (pendingQuestionCount >= 3) {
      rationale.push({
        code: 'UNRESOLVED_HEARING_QUESTIONS',
        detail: `${pendingQuestionCount} unresolved hearing questions remain.`,
        severity: pendingQuestionCount >= 5 ? 'HIGH' : 'MEDIUM',
      });
    }

    const highSeverityCount = rationale.filter((item) => item.severity === 'HIGH').length;
    const recommendEscalation = highSeverityCount > 0 || rationale.length >= 2;

    return {
      recommendEscalation,
      rationale,
      metrics: {
        disputedAmount,
        amountThreshold,
        rescheduleCount,
        pendingQuestionCount,
        complexityLevel,
      },
    };
  }

  async getDisputeDossier(disputeId: string, userId: string, userRole: UserRole) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['project', 'raiser', 'defendant', 'assignedStaff'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);

    const [activities, evidenceItems, hearings] = await Promise.all([
      this.activityRepo.find({
        where: { disputeId },
        order: { timestamp: 'DESC' },
        take: 100,
      }),
      this.evidenceRepo.find({
        where: { disputeId },
        order: { uploadedAt: 'DESC' },
      }),
      this.hearingRepo.find({
        where: { disputeId },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
    ]);

    const now = new Date();
    const hasInfoDeadline =
      !!dispute.infoRequestDeadline && new Date(dispute.infoRequestDeadline).getTime() > 0;

    const pendingActions: Array<{ code: string; description: string; urgent: boolean }> = [];
    if ([DisputeStatus.TRIAGE_PENDING, DisputeStatus.OPEN].includes(dispute.status)) {
      pendingActions.push({
        code: 'TRIAGE_DECISION_REQUIRED',
        description: 'Staff triage decision is required before preview starts.',
        urgent: true,
      });
    }
    if ([DisputeStatus.PREVIEW, DisputeStatus.PENDING_REVIEW].includes(dispute.status)) {
      pendingActions.push({
        code: 'PREVIEW_IN_PROGRESS',
        description: 'Preview in progress. Complete dossier review or request more evidence.',
        urgent: false,
      });
    }
    if (dispute.status === DisputeStatus.INFO_REQUESTED) {
      pendingActions.push({
        code: 'WAITING_EVIDENCE',
        description: hasInfoDeadline
          ? `Waiting for additional evidence before ${new Date(
              dispute.infoRequestDeadline as any,
            ).toISOString()}.`
          : 'Waiting for additional evidence from raiser.',
        urgent:
          !!dispute.infoRequestDeadline &&
          new Date(dispute.infoRequestDeadline as any).getTime() <= now.getTime(),
      });
    }

    const contradictionHints: Array<{ code: string; message: string }> = [];
    if (
      dispute.defendantResponse &&
      dispute.reason &&
      dispute.defendantResponse.trim().toLowerCase() === dispute.reason.trim().toLowerCase()
    ) {
      contradictionHints.push({
        code: 'IDENTICAL_ARGUMENTS',
        message:
          'Raiser and defendant statements are nearly identical. Verify evidence provenance.',
      });
    }
    if ((dispute.evidence?.length || 0) === 0 && (evidenceItems?.length || 0) === 0) {
      contradictionHints.push({
        code: 'NO_EVIDENCE',
        message: 'No evidence has been attached yet. Request concrete files before adjudication.',
      });
    }

    const totalEvidenceSize = evidenceItems.reduce((sum, item) => sum + (item.fileSize || 0), 0);
    const escalationPolicy = await this.evaluateEscalationPolicy(dispute);

    return {
      dispute: {
        id: dispute.id,
        status: dispute.status,
        category: dispute.category,
        priority: dispute.priority,
        reason: dispute.reason,
        disputedAmount: dispute.disputedAmount,
        createdAt: dispute.createdAt,
        assignedStaffId: dispute.assignedStaffId,
      },
      projectContext: {
        id: dispute.projectId,
        title: dispute.project?.title || null,
        milestoneId: dispute.milestoneId,
        raiser: {
          id: dispute.raisedById,
          name: dispute.raiser?.fullName || null,
          email: dispute.raiser?.email || null,
          role: dispute.raiserRole,
        },
        defendant: {
          id: dispute.defendantId,
          name: dispute.defendant?.fullName || null,
          email: dispute.defendant?.email || null,
          role: dispute.defendantRole,
        },
      },
      evidenceInventory: {
        totalFiles: evidenceItems.length,
        totalSizeBytes: totalEvidenceSize,
        flaggedFiles: evidenceItems.filter((item) => item.isFlagged).length,
        latestFiles: evidenceItems.slice(0, 10).map((item) => ({
          id: item.id,
          fileName: item.fileName,
          mimeType: item.mimeType,
          uploadedAt: item.uploadedAt,
          uploaderId: item.uploaderId,
        })),
      },
      timeline: activities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        actorId: activity.actorId,
        actorRole: activity.actorRole,
        description: activity.description,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      })),
      contradictionHints,
      pendingActions,
      escalationPolicy,
      hearings: hearings.map((hearing) => ({
        id: hearing.id,
        status: hearing.status,
        scheduledAt: hearing.scheduledAt,
        hearingNumber: hearing.hearingNumber,
      })),
    };
  }

  async getEscalationPolicy(disputeId: string, userId: string, userRole: UserRole) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'status',
        'disputedAmount',
        'assignedStaffId',
        'escalatedToAdminId',
        'raisedById',
        'defendantId',
        'groupId',
      ],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);
    return await this.evaluateEscalationPolicy(dispute);
  }

  async getDisputeLedger(disputeId: string, userId: string, userRole: UserRole) {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'groupId',
        'raisedById',
        'defendantId',
        'assignedStaffId',
        'escalatedToAdminId',
      ],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    await this.assertDisputeAccess(dispute, userId, userRole);

    const entries = await this.ledgerRepo.find({
      where: { disputeId },
      order: { createdAt: 'ASC' },
    });

    let expectedPreviousHash: string | null = null;

    return {
      disputeId,
      totalEntries: entries.length,
      entries: entries.map((entry) => {
        const recomputedHash = createHash('sha256').update(entry.canonicalPayload).digest('hex');
        const chainOk = (entry.previousHash || null) === expectedPreviousHash;
        const hashOk = recomputedHash === entry.hash;
        const verified = chainOk && hashOk;
        expectedPreviousHash = entry.hash;

        return {
          id: entry.id,
          eventType: entry.eventType,
          actorId: entry.actorId,
          reason: entry.reason,
          payload: entry.payload,
          previousHash: entry.previousHash,
          hash: entry.hash,
          createdAt: entry.createdAt,
          integrity: {
            verified,
            chainOk,
            hashOk,
          },
        };
      }),
    };
  }

  async escalateToMediation(staffId: string, disputeId: string): Promise<DisputeEntity> {
    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can accept disputes');
    }

    return await this.dataSource.transaction(async (manager) => {
      const disputeRepo = manager.getRepository(DisputeEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);

      const dispute = await disputeRepo.findOne({
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
        throw new BadRequestException(`Cannot accept dispute in status ${dispute.status}`);
      }

      const previousStatus = dispute.status;
      const wasAssigned = Boolean(dispute.assignedStaffId);
      if (
        dispute.assignedStaffId &&
        dispute.assignedStaffId !== staffId &&
        staff.role !== UserRole.ADMIN
      ) {
        this.throwAssignedToOtherStaffForbidden(dispute);
      }

      const now = new Date();
      if (!dispute.assignedStaffId) {
        dispute.assignedStaffId = staffId;
        dispute.assignedAt = now;
      }

      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.IN_MEDIATION);
      const updated = await disputeRepo.save(dispute);

      await activityRepo.save(
        activityRepo.create({
          disputeId: dispute.id,
          actorId: staff.id,
          actorRole: staff.role,
          action: DisputeAction.REVIEW_ACCEPTED,
          description: 'Dispute accepted for mediation',
          metadata: {
            previousStatus,
            assignedStaffId: dispute.assignedStaffId,
          },
        }),
      );

      await this.appendLedgerEntry(manager, {
        disputeId: dispute.id,
        eventType: 'STATUS_ESCALATED_MEDIATION',
        actorId: staff.id,
        previousStatus,
        newStatus: updated.status,
        payload: {
          assignedStaffId: dispute.assignedStaffId || null,
        },
      });

      if (!wasAssigned && dispute.assignedStaffId) {
        this.eventEmitter.emit(DISPUTE_EVENTS.ASSIGNED, {
          disputeId: dispute.id,
          staffId: dispute.assignedStaffId,
          assignedAt: now,
        });
      }

      this.eventEmitter.emit(DISPUTE_EVENTS.ESCALATED, {
        disputeId: dispute.id,
        adminId: staff.id,
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId: dispute.id,
        previousStatus,
        newStatus: updated.status,
      });

      return updated;
    });
  }

  async getSchedulingProposals(disputeId: string, userId: string, userRole: UserRole) {
    if (!this.isSlotProposalEnabled()) {
      return { enabled: false, items: [] };
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'status', 'groupId', 'raisedById', 'defendantId', 'assignedStaffId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);

    const proposals = await this.disputeScheduleProposalRepo.find({
      where: {
        disputeId,
        status: In([DisputeScheduleProposalStatus.ACTIVE, DisputeScheduleProposalStatus.SUBMITTED]),
      },
      order: { startTime: 'ASC' },
    });

    return {
      enabled: true,
      items: proposals,
    };
  }

  async createSchedulingProposal(
    disputeId: string,
    userId: string,
    userRole: UserRole,
    dto: CreateDisputeScheduleProposalDto,
  ) {
    if (!this.isSlotProposalEnabled()) {
      throw new BadRequestException('Dispute slot proposal is disabled');
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'status', 'groupId', 'raisedById', 'defendantId', 'assignedStaffId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      throw new BadRequestException('Cannot propose slots for a closed dispute');
    }
    await this.assertDisputeAllowsSlotProposal(dispute);

    const startTime = this.parseIsoDateOrThrow(dto.startTime, 'startTime');
    const endTime = this.parseIsoDateOrThrow(dto.endTime, 'endTime');

    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    if (durationMinutes < 15) {
      this.throwSchedulingProposalError(
        'PROPOSAL_DURATION_TOO_SHORT',
        'Proposal duration must be at least 15 minutes.',
      );
    }
    if (durationMinutes > 8 * 60) {
      this.throwSchedulingProposalError(
        'PROPOSAL_DURATION_TOO_LONG',
        'Proposal duration must be at most 8 hours.',
      );
    }
    if (startTime.getTime() <= Date.now()) {
      this.throwSchedulingProposalError(
        'PROPOSAL_START_IN_PAST',
        'Proposal start time must be in the future.',
      );
    }

    const [activeCount, overlapping] = await Promise.all([
      this.disputeScheduleProposalRepo.count({
        where: {
          disputeId,
          userId,
          status: In([
            DisputeScheduleProposalStatus.ACTIVE,
            DisputeScheduleProposalStatus.SUBMITTED,
          ]),
        },
      }),
      this.disputeScheduleProposalRepo
        .createQueryBuilder('proposal')
        .where('proposal.disputeId = :disputeId', { disputeId })
        .andWhere('proposal.userId = :userId', { userId })
        .andWhere('proposal.status IN (:...statuses)', {
          statuses: [DisputeScheduleProposalStatus.ACTIVE, DisputeScheduleProposalStatus.SUBMITTED],
        })
        .andWhere('proposal.startTime < :endTime', { endTime })
        .andWhere('proposal.endTime > :startTime', { startTime })
        .getCount(),
    ]);

    if (activeCount >= PROPOSAL_MAX_PER_USER) {
      this.throwSchedulingProposalError(
        'PROPOSAL_LIMIT_EXCEEDED',
        `You can only keep up to ${PROPOSAL_MAX_PER_USER} active/submitted proposals per dispute.`,
      );
    }

    if (overlapping > 0) {
      this.throwSchedulingProposalError(
        'PROPOSAL_OVERLAP',
        'This proposal overlaps your existing dispute proposal.',
      );
    }

    const proposal = await this.disputeScheduleProposalRepo.save(
      this.disputeScheduleProposalRepo.create({
        disputeId,
        userId,
        startTime,
        endTime,
        note: dto.note?.trim() || null,
        status: DisputeScheduleProposalStatus.ACTIVE,
      }),
    );

    return {
      created: true,
      proposal,
    };
  }

  async deleteSchedulingProposal(
    disputeId: string,
    proposalId: string,
    userId: string,
    userRole: UserRole,
  ) {
    if (!this.isSlotProposalEnabled()) {
      throw new BadRequestException('Dispute slot proposal is disabled');
    }

    const proposal = await this.disputeScheduleProposalRepo.findOne({
      where: { id: proposalId, disputeId },
    });
    if (!proposal) {
      throw new NotFoundException('Scheduling proposal not found');
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'status', 'groupId', 'raisedById', 'defendantId', 'assignedStaffId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);

    const canModerate = [UserRole.ADMIN, UserRole.STAFF].includes(userRole);
    if (!canModerate && proposal.userId !== userId) {
      throw new ForbiddenException('You can only withdraw your own proposal');
    }

    if (proposal.status === DisputeScheduleProposalStatus.WITHDRAWN) {
      return {
        deleted: true,
        proposal,
      };
    }

    proposal.status = DisputeScheduleProposalStatus.WITHDRAWN;
    proposal.submittedAt = proposal.submittedAt || null;
    const saved = await this.disputeScheduleProposalRepo.save(proposal);

    return {
      deleted: true,
      proposal: saved,
    };
  }

  async submitSchedulingProposals(disputeId: string, userId: string, userRole: UserRole) {
    if (!this.isSlotProposalEnabled()) {
      throw new BadRequestException('Dispute slot proposal is disabled');
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'status', 'groupId', 'raisedById', 'defendantId', 'assignedStaffId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);
    await this.assertDisputeAllowsSlotProposal(dispute);

    const activeProposals = await this.disputeScheduleProposalRepo.find({
      where: {
        disputeId,
        userId,
        status: DisputeScheduleProposalStatus.ACTIVE,
      },
    });

    if (!activeProposals.length) {
      return {
        submitted: 0,
        items: [],
      };
    }

    const now = new Date();
    activeProposals.forEach((proposal) => {
      proposal.status = DisputeScheduleProposalStatus.SUBMITTED;
      proposal.submittedAt = now;
    });
    const saved = await this.disputeScheduleProposalRepo.save(activeProposals);

    return {
      submitted: saved.length,
      items: saved,
    };
  }

  async getAutoScheduleOptions(
    disputeId: string,
    userId: string,
    userRole: UserRole,
    limit: number = 5,
  ): Promise<{
    manualRequired: boolean;
    reasonCode?: ScheduleFailureReasonCode;
    reason?: string;
    moderatorId?: string;
    durationMinutes?: number;
    slots: Array<{
      start: Date;
      end: Date;
      durationMinutes: number;
      score: number;
      scoreReasons: string[];
    }>;
    participants: Array<{
      userId: string;
      role: string;
      isRequired: boolean;
      relationToProject: string;
    }>;
    warnings: string[];
  }> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'groupId',
        'status',
        'assignedStaffId',
        'raisedById',
        'defendantId',
        'escalatedToAdminId',
      ],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute, userId, userRole);

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      return {
        manualRequired: true,
        reasonCode: 'MANUAL_REVIEW_REQUIRED',
        reason: 'Dispute is already closed',
        slots: [],
        participants: [],
        warnings: [],
      };
    }

    let moderatorId = dispute.assignedStaffId || null;
    if (!moderatorId && [UserRole.STAFF, UserRole.ADMIN].includes(userRole)) {
      moderatorId = userId;
    }
    if (!moderatorId) {
      const assignment = await this.autoAssignStaff(dispute.id);
      moderatorId = assignment?.staffId || null;
    }

    if (!moderatorId) {
      return {
        manualRequired: true,
        reasonCode: 'NO_STAFF_AVAILABLE',
        reason: 'No staff available to moderate hearing',
        slots: [],
        participants: [],
        warnings: [],
      };
    }

    const participantsResult = await this.hearingService.determineRequiredParticipants(
      dispute.id,
      HearingTier.TIER_1,
      moderatorId,
    );

    const participantIds = Array.from(
      new Set(
        participantsResult.participants.map((participant) => participant.userId).filter(Boolean),
      ),
    );

    if (!participantIds.length) {
      return {
        manualRequired: true,
        reasonCode: 'NO_REQUIRED_PARTICIPANTS',
        reason: 'No participants available for hearing',
        moderatorId,
        slots: [],
        participants: [],
        warnings: participantsResult.warnings,
      };
    }

    const complexity = await this.staffAssignmentService
      .estimateDisputeComplexity(dispute.id)
      .catch(() => null);
    const durationMinutes =
      complexity?.timeEstimation?.recommendedMinutes ?? DEFAULT_HEARING_DURATION_MINUTES;

    const rangeStart = new Date(Date.now() + DEFAULT_HEARING_MIN_NOTICE_HOURS * 60 * 60 * 1000);
    const rangeEnd = this.addDays(rangeStart, DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS);

    const userTimezones = await this.resolveUserTimezones(participantIds);
    const preferredSlots = await this.listSchedulingProposalsForParticipants(
      dispute.id,
      participantIds,
    );
    const slotsResult = await this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes,
      dateRange: { start: rangeStart, end: rangeEnd },
      userTimezones,
      preferredSlots,
      maxSlots: Math.max(15, limit * 3),
    });

    const normalizedLimit = Math.min(Math.max(1, limit), 20);
    const slots = slotsResult.slots.slice(0, normalizedLimit).map((slot) => ({
      start: slot.start,
      end: slot.end,
      durationMinutes: slot.durationMinutes,
      score: slot.score,
      scoreReasons: slot.scoreReasons,
    }));

    if (!slots.length) {
      return {
        manualRequired: true,
        reasonCode: this.mapNoSlotsReasonCode(slotsResult.noSlotsReason),
        reason: slotsResult.noSlotsReason || 'No available schedule slots',
        moderatorId,
        durationMinutes,
        slots: [],
        participants: participantsResult.participants.map((participant) => ({
          userId: participant.userId,
          role: participant.role,
          isRequired: participant.isRequired,
          relationToProject: participant.relationToProject,
        })),
        warnings: participantsResult.warnings,
      };
    }

    return {
      manualRequired: false,
      moderatorId,
      durationMinutes,
      slots,
      participants: participantsResult.participants.map((participant) => ({
        userId: participant.userId,
        role: participant.role,
        isRequired: participant.isRequired,
        relationToProject: participant.relationToProject,
      })),
      warnings: participantsResult.warnings,
    };
  }

  async escalateToHearing(
    disputeId: string,
    triggeredById: string,
    tuning?: AutoScheduleTuningDto,
  ): Promise<{
    manualRequired: boolean;
    reasonCode?: ScheduleFailureReasonCode;
    reason?: string;
    hearingId?: string;
    scheduledAt?: Date;
    selectedSlot?: {
      start: Date;
      end: Date;
      durationMinutes: number;
      score?: number;
      scoreReasons?: string[];
    };
    fallbackReason?: string;
    requiredParticipants?: Array<{
      userId: string;
      role: string;
      isRequired: boolean;
      relationToProject: string;
    }>;
    responseDeadline?: Date;
    participantConfirmationSummary?: {
      totalParticipants: number;
      requiredParticipants: number;
      accepted: number;
      declined: number;
      tentative: number;
      pending: number;
      requiredAccepted: number;
      requiredDeclined: number;
      requiredTentative: number;
      requiredPending: number;
      allRequiredAccepted: boolean;
      participants: Array<{
        userId: string;
        role: string;
        status: string;
        isRequired: boolean;
        respondedAt?: Date;
        responseDeadline?: Date;
      }>;
    };
    timezoneContext?: {
      timezoneByUserId: Record<string, string>;
      normalizedTo: 'UTC';
    };
  }> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'status', 'assignedStaffId', 'raisedById'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      return {
        manualRequired: true,
        reasonCode: 'MANUAL_REVIEW_REQUIRED',
        reason: 'Dispute already closed',
        fallbackReason: 'Dispute already closed',
      };
    }

    const existing = await this.hearingRepo.findOne({
      where: {
        disputeId: dispute.id,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS]),
      },
      select: ['id', 'scheduledAt'],
    });
    if (existing) {
      return {
        manualRequired: false,
        hearingId: existing.id,
        scheduledAt: existing.scheduledAt,
      };
    }

    const triggeredUser = await this.userRepo.findOne({
      where: { id: triggeredById },
      select: ['id', 'role'],
    });

    const hasTuningInput = Boolean(
      tuning &&
      (tuning.minNoticeMinutes ||
        tuning.lookaheadDays ||
        tuning.forceNearTermMinutes ||
        tuning.bypassReason),
    );
    const canUseSchedulingBypass = this.canUseDisputeTestBypass(triggeredUser?.role);
    if (hasTuningInput && !canUseSchedulingBypass) {
      throw new ForbiddenException(
        'Auto-schedule tuning is restricted to STAFF/ADMIN in non-production with DISPUTE_TEST_MODE=true',
      );
    }

    let moderatorId = dispute.assignedStaffId;
    if (!moderatorId) {
      const assignment = await this.autoAssignStaff(dispute.id);
      if (assignment?.staffId) {
        moderatorId = assignment.staffId;
      }
    }

    if (!moderatorId && triggeredUser) {
      if ([UserRole.STAFF, UserRole.ADMIN].includes(triggeredUser.role)) {
        moderatorId = triggeredUser.id;
      }
    }

    if (!moderatorId) {
      return {
        manualRequired: true,
        reasonCode: 'NO_STAFF_AVAILABLE',
        reason: 'No staff available to moderate hearing',
        fallbackReason: 'No staff available to moderate hearing',
      };
    }

    const participantsResult = await this.hearingService.determineRequiredParticipants(
      dispute.id,
      HearingTier.TIER_1,
      moderatorId,
    );
    const participantIds = participantsResult.participants.map((p) => p.userId);
    const requiredParticipants = participantsResult.participants.map((participant) => ({
      userId: participant.userId,
      role: participant.role,
      isRequired: participant.isRequired,
      relationToProject: participant.relationToProject,
    }));

    if (participantIds.length === 0) {
      return {
        manualRequired: true,
        reasonCode: 'NO_REQUIRED_PARTICIPANTS',
        reason: 'No participants available for hearing',
        fallbackReason: 'No participants available for hearing',
        requiredParticipants,
      };
    }

    const complexity = await this.staffAssignmentService
      .estimateDisputeComplexity(dispute.id)
      .catch(() => null);
    const durationMinutes =
      complexity?.timeEstimation?.recommendedMinutes ?? DEFAULT_HEARING_DURATION_MINUTES;

    const minNoticeMinutes = canUseSchedulingBypass
      ? (tuning?.minNoticeMinutes ?? DEFAULT_HEARING_MIN_NOTICE_HOURS * 60)
      : DEFAULT_HEARING_MIN_NOTICE_HOURS * 60;
    const lookaheadDays = canUseSchedulingBypass
      ? (tuning?.lookaheadDays ?? DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS)
      : DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS;

    const nearTermMinutes =
      canUseSchedulingBypass && tuning?.forceNearTermMinutes
        ? tuning.forceNearTermMinutes
        : minNoticeMinutes;
    const rangeStart = new Date(Date.now() + nearTermMinutes * 60 * 1000);
    const rangeEnd = this.addDays(
      rangeStart,
      Math.max(1, Math.min(30, lookaheadDays || DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS)),
    );

    const userTimezones = await this.resolveUserTimezones(participantIds);
    const preferredSlots = await this.listSchedulingProposalsForParticipants(
      dispute.id,
      participantIds,
    );
    const slotsResult = await this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes,
      dateRange: { start: rangeStart, end: rangeEnd },
      userTimezones,
      preferredSlots,
    });
    const timezoneByUserId = Object.fromEntries(
      Object.entries(userTimezones || {}).map(([userId, timezone]) => [userId, timezone || 'UTC']),
    );

    if (!slotsResult.slots.length) {
      this.logger.warn(
        `Auto-schedule failed for dispute ${dispute.id}: ${slotsResult.noSlotsReason || 'no slots'}`,
      );
      return {
        manualRequired: true,
        reasonCode: this.mapNoSlotsReasonCode(slotsResult.noSlotsReason),
        reason: slotsResult.noSlotsReason,
        fallbackReason: slotsResult.noSlotsReason || 'No available schedule slots',
        requiredParticipants,
        timezoneContext: {
          timezoneByUserId,
          normalizedTo: 'UTC',
        },
      };
    }

    const selected = slotsResult.slots[0];
    const hearing = await this.hearingService.scheduleHearing(
      {
        disputeId: dispute.id,
        scheduledAt: selected.start.toISOString(),
        estimatedDurationMinutes: durationMinutes,
        tier: HearingTier.TIER_1,
      },
      moderatorId,
    );

    if (hasTuningInput && canUseSchedulingBypass) {
      try {
        await this.auditLogsService.logCustom(
          'DISPUTE_SCHEDULE_TEST_TUNING',
          'Dispute',
          dispute.id,
          {
            actorId: triggeredById,
            tuning,
            scheduledAt: hearing.hearing.scheduledAt,
            selectedSlot: {
              start: selected.start,
              end: selected.end,
            },
          },
          undefined,
          triggeredById,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to write schedule tuning audit log for dispute ${dispute.id}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return {
      manualRequired: false,
      hearingId: hearing.hearing.id,
      scheduledAt: hearing.hearing.scheduledAt,
      selectedSlot: {
        start: selected.start,
        end: selected.end,
        durationMinutes: selected.durationMinutes,
        score: selected.score,
        scoreReasons: selected.scoreReasons,
      },
      requiredParticipants,
      responseDeadline: hearing.responseDeadline,
      participantConfirmationSummary: hearing.participantConfirmationSummary,
      timezoneContext: {
        timezoneByUserId,
        normalizedTo: 'UTC',
      },
    };
  }

  async updateDisputes(
    userId: string,
    disputeId: string,
    dto: { message?: string; evidence?: string[] },
  ) {
    const { message, evidence } = dto;

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId, status: Not(In(DISPUTE_CLOSED_STATUSES)) },
    });

    // Check dispute exists FIRST
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Then check authorization
    const isPrimaryParty = userId === dispute.defendantId || userId === dispute.raisedById;
    const isGroupParty = isPrimaryParty ? true : await this.isGroupPartyMember(dispute, userId);
    if (!isPrimaryParty && !isGroupParty) {
      throw new BadRequestException('You are not authorized to perform this action');
    }

    if (!message && (!evidence || evidence.length === 0)) {
      throw new BadRequestException('Request body cannot be empty');
    }

    if (message) {
      dispute.messages = message;
    }

    if (evidence) {
      const existingEvidence = dispute.evidence || [];

      const newEvidence = [...new Set([...existingEvidence, ...evidence])];

      dispute.evidence = newEvidence;
    }
    const now = new Date();
    let infoProvided = false;
    if (dispute.status === DisputeStatus.INFO_REQUESTED && userId === dispute.raisedById) {
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.PREVIEW);
      dispute.infoProvidedAt = now;
      infoProvided = true;
    }

    const savedDispute = await this.disputeRepo.save(dispute);
    if (infoProvided) {
      await this.activityRepo.save(
        this.activityRepo.create({
          disputeId,
          actorId: userId,
          actorRole: userId === dispute.raisedById ? dispute.raiserRole : dispute.defendantRole,
          action: DisputeAction.INFO_PROVIDED,
          description: 'Additional info submitted for review',
          metadata: { messageProvided: Boolean(message), evidenceCount: evidence?.length || 0 },
        }),
      );
      this.eventEmitter.emit(DISPUTE_EVENTS.INFO_PROVIDED, {
        disputeId,
        userId,
        providedAt: now,
      });
    }
    return savedDispute;
  }

  async provideAdditionalInfo(
    userId: string,
    disputeId: string,
    dto: { message?: string; evidenceIds?: string[] },
  ): Promise<DisputeEntity> {
    return this.updateDisputes(userId, disputeId, {
      message: dto.message,
      evidence: dto.evidenceIds,
    });
  }

  // =============================================================================
  // MESSAGE SERVICE
  // - Dispute messages: Bất đồng bềE(Async) - Nộp hềEsơ, bằng chứng, comment
  // - Hearing messages: Đồng bềE(Realtime) - Chat theo lượt trong phiên tòa
  //   (Quyền chat realtime được kiểm soát bởi HearingService.getChatPermission)
  // =============================================================================

  private checkMessageRateLimit(
    disputeId: string,
    userId: string,
  ): { allowed: boolean; retryAfterSeconds?: number; reason?: string } {
    const key = `${disputeId}:${userId}`;
    const nowMs = Date.now();
    const state = this.messageRateLimit.get(key) || {
      lastMessageAtMs: 0,
      windowStartMs: nowMs,
      countInWindow: 0,
      blockedUntilMs: undefined,
    };

    if (state.blockedUntilMs && nowMs < state.blockedUntilMs) {
      const retryAfterSeconds = Math.ceil((state.blockedUntilMs - nowMs) / 1000);
      return {
        allowed: false,
        retryAfterSeconds,
        reason: 'Too many messages. Please wait before sending again.',
      };
    }

    if (
      state.lastMessageAtMs &&
      nowMs - state.lastMessageAtMs < MESSAGE_RATE_LIMIT.MIN_INTERVAL_MS
    ) {
      state.blockedUntilMs = nowMs + MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS;
      this.messageRateLimit.set(key, state);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS / 1000),
        reason: 'Message rate limit exceeded. Please slow down.',
      };
    }

    if (nowMs - state.windowStartMs > 60 * 1000) {
      state.windowStartMs = nowMs;
      state.countInWindow = 0;
    }

    state.countInWindow += 1;
    if (state.countInWindow > MESSAGE_RATE_LIMIT.MAX_PER_MINUTE) {
      state.blockedUntilMs = nowMs + MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS;
      this.messageRateLimit.set(key, state);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS / 1000),
        reason: 'Message rate limit exceeded. Please wait before sending again.',
      };
    }

    state.lastMessageAtMs = nowMs;
    this.messageRateLimit.set(key, state);

    return { allowed: true };
  }

  private getPhaseLabel(phase: DisputePhase): string {
    switch (phase) {
      case DisputePhase.PRESENTATION:
        return 'Presentation';
      case DisputePhase.CROSS_EXAMINATION:
        return 'Cross-examination';
      case DisputePhase.INTERROGATION:
        return 'Interrogation';
      case DisputePhase.DELIBERATION:
        return 'Deliberation';
      default:
        return 'Presentation';
    }
  }

  /**
   * @deprecated Phase-based access control giềEđược xử lý bởi HearingService.getChatPermission()
   * thông qua currentSpeakerRole trên HearingEntity.
   * Hàm này chềEgiữ lại đềEtương thích ngược (backward compatibility).
   * Logic tương đương:
   *   PRESENTATION     -> SpeakerRole.RAISER_ONLY   (ChềEnguyên đơn trình bày)
   *   CROSS_EXAMINATION -> SpeakerRole.DEFENDANT_ONLY (ChềEbềEđơn phản bác)
   *   INTERROGATION    -> SpeakerRole.MODERATOR_ONLY (Thẩm phán đặt câu hỏi)
   *   DELIBERATION     -> SpeakerRole.MUTED_ALL      (NghềEán, khóa chat)
   */
  private getPhaseAccess(
    phase: DisputePhase,
    senderId: string,
    dispute: DisputeEntity,
  ): { allowed: boolean; reason?: string } {
    const isRaiser = dispute.raisedById === senderId;
    const isDefendant = dispute.defendantId === senderId;

    switch (phase) {
      case DisputePhase.PRESENTATION:
        return isRaiser
          ? { allowed: true }
          : { allowed: false, reason: 'Only the raiser can speak in the presentation phase.' };
      case DisputePhase.CROSS_EXAMINATION:
        return isDefendant
          ? { allowed: true }
          : {
              allowed: false,
              reason: 'Only the defendant can speak in the cross-examination phase.',
            };
      case DisputePhase.INTERROGATION:
        return {
          allowed: false,
          reason: 'Only staff or admin can speak in the interrogation phase.',
        };
      case DisputePhase.DELIBERATION:
        return {
          allowed: false,
          reason: 'Chat is locked during deliberation.',
        };
      default:
        return { allowed: true };
    }
  }

  private async logSystemMessage(
    disputeId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<DisputeMessageEntity> {
    const message = this.messageRepo.create({
      disputeId,
      senderId: null,
      senderRole: 'SYSTEM',
      type: MessageType.SYSTEM_LOG,
      content,
      metadata,
    });

    const savedMessage = await this.messageRepo.save(message);

    this.eventEmitter.emit(
      DISPUTE_EVENTS.MESSAGE_SENT,
      await this.buildMessageEventPayload(savedMessage),
    );

    return savedMessage;
  }

  async sendDisputeMessage(
    dto: SendDisputeMessageDto,
    senderId: string,
    senderRole: UserRole,
    senderContext?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'>,
  ): Promise<DisputeMessageEntity> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: dto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      throw new BadRequestException('Cannot send messages to a closed dispute');
    }

    const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(senderRole);
    const isPrimaryParty = dispute.raisedById === senderId || dispute.defendantId === senderId;
    const isGroupParty = isPrimaryParty ? true : await this.isGroupPartyMember(dispute, senderId);
    const isParty = isPrimaryParty || isGroupParty;
    let isHearingParticipant = false;
    let senderHearingRole: HearingParticipantRole | undefined;

    // =========================================================================
    // LUỒNG 1: HEARING MESSAGE (Phiên tòa - Realtime, có phase/speaker control)
    // Quyền chat được kiểm soát bởi HearingService.getChatPermission()
    // dựa trên currentSpeakerRole của Hearing (ALL, RAISER_ONLY, DEFENDANT_ONLY, etc.)
    // =========================================================================
    if (dto.hearingId) {
      const isEvidenceLinkMessage = dto.type === MessageType.EVIDENCE_LINK;

      if (isEvidenceLinkMessage) {
        const attachPermission = await this.hearingService.getEvidenceAttachPermission(
          dto.hearingId,
          senderId,
          senderRole,
        );
        if (!attachPermission.allowed) {
          throw new ForbiddenException(attachPermission.reason);
        }
        if (attachPermission.hearing.disputeId !== dispute.id) {
          throw new BadRequestException('Hearing does not belong to this dispute');
        }
        isHearingParticipant = true;
        if (attachPermission.hearing.moderatorId === senderId) {
          senderHearingRole = HearingParticipantRole.MODERATOR;
        }
      } else {
        const chatPermission = await this.hearingService.getChatPermission(dto.hearingId, senderId);
        if (!chatPermission.allowed) {
          throw new ForbiddenException(chatPermission.reason);
        }
        if (chatPermission.hearing.disputeId !== dispute.id) {
          throw new BadRequestException('Hearing does not belong to this dispute');
        }
        isHearingParticipant = true;
        senderHearingRole = chatPermission.participantRole;
      }
    }

    // =========================================================================
    // LUỒNG 2: DISPUTE MESSAGE (HềEsơ vụ án - Async, không phase restriction)
    // Cả hai bên (raiser + defendant) đều được gửi message/evidence bất kỳ lúc nào
    // miềE là dispute chưa đóng. Giống nộp hềEsơ qua cổng thông tin tòa án.
    // =========================================================================
    if (!isStaffOrAdmin && !isParty && !isHearingParticipant) {
      throw new ForbiddenException('You are not allowed to send messages in this dispute');
    }

    if (
      [MessageType.SYSTEM_LOG, MessageType.ADMIN_ANNOUNCEMENT].includes(dto.type) &&
      !isStaffOrAdmin
    ) {
      throw new ForbiddenException('Only staff or admin can send this message type');
    }

    const isSystemGeneratedMessage = [MessageType.SYSTEM_LOG, MessageType.ADMIN_ANNOUNCEMENT].includes(
      dto.type,
    );
    if (!dto.hearingId && !isSystemGeneratedMessage) {
      throw new ConflictException({
        code: 'DISPUTE_ASYNC_CHAT_RETIRED',
        message:
          'Dispute-level async chat has been retired. Use Hearing Room live transcript for new public discussion.',
      });
    }

    // Kiểm tra settlement lock (chềEáp dụng cho dispute-level, không phải hearing)
    if (!isStaffOrAdmin && !dto.hearingId) {
      const lockStatus = await this.settlementService.checkChatLockStatus(dispute.id, senderId);
      if (lockStatus.isLocked) {
        throw new ForbiddenException(lockStatus.reason || 'Chat is locked');
      }
    }

    if (dto.type === MessageType.TEXT) {
      if (!dto.content || dto.content.trim().length === 0) {
        throw new BadRequestException('Message content is required');
      }
    } else if (!dto.content && !dto.metadata && !dto.relatedEvidenceId) {
      throw new BadRequestException('Message content or metadata is required');
    }

    if (dto.type === MessageType.EVIDENCE_LINK && !dto.relatedEvidenceId) {
      throw new BadRequestException('relatedEvidenceId is required for evidence links');
    }

    const rateLimit = this.checkMessageRateLimit(dispute.id, senderId);
    if (!rateLimit.allowed) {
      throw new BadRequestException({
        message: rateLimit.reason,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    if (dto.replyToMessageId) {
      const replyTarget = await this.messageRepo.findOne({
        where: { id: dto.replyToMessageId },
      });

      if (!replyTarget || replyTarget.disputeId !== dispute.id) {
        throw new BadRequestException('Reply message not found in this dispute');
      }

      if (dto.hearingId || replyTarget.hearingId) {
        if (dto.hearingId !== replyTarget.hearingId) {
          throw new BadRequestException('Reply message must belong to the same hearing');
        }
      }
    }

    if (dto.relatedEvidenceId) {
      const evidence = await this.evidenceRepo.findOne({
        where: { id: dto.relatedEvidenceId, disputeId: dispute.id },
      });
      if (!evidence) {
        throw new BadRequestException('Evidence not found in this dispute');
      }
    }

    const message = this.messageRepo.create({
      disputeId: dispute.id,
      senderId,
      senderRole,
      type: dto.type,
      content: dto.content?.trim(),
      replyToMessageId: dto.replyToMessageId,
      relatedEvidenceId: dto.relatedEvidenceId,
      hearingId: dto.hearingId,
      metadata: dto.metadata,
    });

    const savedMessage = await this.messageRepo.save(message);
    const senderSummary =
      senderContext && senderContext.id === senderId
        ? {
            id: senderContext.id,
            fullName: senderContext.fullName,
            email: senderContext.email,
            role: senderContext.role,
          }
        : undefined;

    this.eventEmitter.emit(
      DISPUTE_EVENTS.MESSAGE_SENT,
      await this.buildMessageEventPayload(savedMessage, {
        senderSummary,
        senderHearingRole,
      }),
    );

    return savedMessage;
  }

  async getDisputeMessages(
    disputeId: string,
    userId: string,
    userRole: UserRole,
    options: { hearingId?: string; limit?: number; includeHidden?: boolean } = {},
  ): Promise<DisputeMessageEntity[]> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'groupId',
        'raisedById',
        'defendantId',
        'assignedStaffId',
        'escalatedToAdminId',
      ],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(userRole);
    await this.assertDisputeAccess(dispute, userId, userRole);

    if (options.hearingId) {
      const hearing = await this.hearingRepo.findOne({
        where: { id: options.hearingId },
        select: ['id', 'disputeId'],
      });
      if (!hearing || hearing.disputeId !== dispute.id) {
        throw new BadRequestException('Hearing does not belong to this dispute');
      }
    }

    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 50;

    const qb = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.disputeId = :disputeId', { disputeId })
      // OLD: .orderBy('message.createdAt', 'ASC')
      .take(limit);

    if (options.hearingId) {
      qb.andWhere('message.hearingId = :hearingId', { hearingId: options.hearingId });
    }

    if (!isStaffOrAdmin || !options.includeHidden) {
      qb.andWhere('message.isHidden = :isHidden', { isHidden: false });
    }

    // NEW: Fetch latest messages first, then reverse them to ASC order
    const messages = await qb.orderBy('message.createdAt', 'DESC').getMany();
    return messages.reverse();
  }

  /**
   * Cập nhật phase cho dispute.
   * Lưu ý: Phase trên DisputeEntity chềEmang tính chất ghi nhận trạng thái tổng quan
   * của vụ kiện (ví dụ: đang ềEgiai đoạn nào). Việc kiểm soát quyền chat realtime
   * theo phase được xử lý bởi HearingService thông qua SpeakerRole trên HearingEntity.
   *
   * Mapping tham khảo:
   *   PRESENTATION     -> SpeakerRole.RAISER_ONLY
   *   CROSS_EXAMINATION -> SpeakerRole.DEFENDANT_ONLY
   *   INTERROGATION    -> SpeakerRole.MODERATOR_ONLY
   *   DELIBERATION     -> SpeakerRole.MUTED_ALL
   */
  async updatePhase(
    disputeId: string,
    phase: DisputePhase,
    actorId: string,
    actorRole: UserRole,
  ): Promise<DisputeEntity> {
    if (![UserRole.STAFF, UserRole.ADMIN].includes(actorRole)) {
      throw new ForbiddenException('Only staff or admin can update dispute phase');
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      throw new BadRequestException('Cannot change phase for a closed dispute');
    }

    const previousPhase = dispute.phase ?? DisputePhase.PRESENTATION;
    if (previousPhase === phase) {
      return dispute;
    }

    dispute.phase = phase;
    const updated = await this.disputeRepo.save(dispute);

    await this.logSystemMessage(dispute.id, `Phase changed to ${this.getPhaseLabel(phase)}.`, {
      previousPhase,
      newPhase: phase,
      updatedById: actorId,
      updatedByRole: actorRole,
    });

    return updated;
  }

  async hideMessage(
    dto: HideMessageDto,
    hiddenById: string,
    hiddenByRole: UserRole,
  ): Promise<DisputeMessageEntity> {
    if (![UserRole.STAFF, UserRole.ADMIN].includes(hiddenByRole)) {
      throw new ForbiddenException('Only staff or admin can hide messages');
    }

    const message = await this.messageRepo.findOne({
      where: { id: dto.messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isHidden) {
      throw new BadRequestException('Message is already hidden');
    }

    if (hiddenByRole === UserRole.STAFF) {
      const dispute = await this.disputeRepo.findOne({
        where: { id: message.disputeId },
        select: ['id', 'assignedStaffId'],
      });

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      let canModerate = dispute.assignedStaffId === hiddenById;

      if (message.hearingId && !canModerate) {
        const hearing = await this.hearingRepo.findOne({
          where: { id: message.hearingId },
          select: ['id', 'moderatorId'],
        });
        if (hearing?.moderatorId === hiddenById) {
          canModerate = true;
        }
      }

      if (!canModerate) {
        throw new ForbiddenException(
          'Only assigned staff or hearing moderator can hide this message',
        );
      }
    }

    message.isHidden = true;
    message.hiddenReason = dto.hiddenReason;
    message.hiddenById = hiddenById;
    message.hiddenAt = new Date();

    const savedMessage = await this.messageRepo.save(message);

    this.eventEmitter.emit(DISPUTE_EVENTS.MESSAGE_HIDDEN, {
      messageId: savedMessage.id,
      disputeId: savedMessage.disputeId,
      hearingId: savedMessage.hearingId,
      hiddenById: savedMessage.hiddenById,
      hiddenReason: savedMessage.hiddenReason,
      replacementText: 'Tin nhắn đã bềEẩn bởi Admin',
    });

    return savedMessage;
  }

  async unhideMessage(
    messageId: string,
    unhiddenById: string,
    unhiddenByRole: UserRole,
  ): Promise<DisputeMessageEntity> {
    if (![UserRole.STAFF, UserRole.ADMIN].includes(unhiddenByRole)) {
      throw new ForbiddenException('Only staff or admin can unhide messages');
    }

    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!message.isHidden) {
      throw new BadRequestException('Message is not hidden');
    }

    if (unhiddenByRole === UserRole.STAFF) {
      const dispute = await this.disputeRepo.findOne({
        where: { id: message.disputeId },
        select: ['id', 'assignedStaffId'],
      });

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      let canModerate = dispute.assignedStaffId === unhiddenById;

      if (message.hearingId && !canModerate) {
        const hearing = await this.hearingRepo.findOne({
          where: { id: message.hearingId },
          select: ['id', 'moderatorId'],
        });
        if (hearing?.moderatorId === unhiddenById) {
          canModerate = true;
        }
      }

      if (!canModerate) {
        throw new ForbiddenException(
          'Only assigned staff or hearing moderator can unhide this message',
        );
      }
    }

    const previousReason = message.hiddenReason;
    message.isHidden = false;
    message.hiddenReason = null as any;
    message.hiddenById = null as any;
    message.hiddenAt = null as any;

    const savedMessage = await this.messageRepo.save(message);

    this.eventEmitter.emit(DISPUTE_EVENTS.MESSAGE_UNHIDDEN, {
      messageId: savedMessage.id,
      disputeId: savedMessage.disputeId,
      hearingId: savedMessage.hearingId,
      unhiddenById,
      previousReason,
    });

    return savedMessage;
  }

  // =============================================================================

  /**
   * 🔥 HÀM KHỔNG LềE Resolve Dispute với Database Transaction
   *
   * Flow:
   * 1. Lock records (Pessimistic Lock)
   * 2. Validate state machine
   * 3. Update Dispute status -> RESOLVED
   * 4. Execute money transfers based on verdict
   * 5. Update Project/Milestone status
   * 6. Penalize loser (update totalDisputesLost + recalculate trust score)
   * 7. Create audit log
   * 8. Emit event for real-time notification
   *
   * @throws BadRequestException | NotFoundException | ForbiddenException
   */

  private async ensureVerdictHearingGate(disputeId: string): Promise<void> {
    if (!this.isVerdictHearingGateEnabled()) {
      return;
    }

    const readiness = await this.verdictReadinessService.evaluateDisputeGate(disputeId);
    if (!readiness.canIssueVerdict) {
      throw new ConflictException({
        message: 'Verdict is blocked until hearing completion and minutes checklist is satisfied.',
        checklist: readiness.checklist,
        unmetChecklist: readiness.unmetChecklist,
        unmetChecklistDetails: readiness.unmetChecklistDetails,
        context: readiness.context,
      });
    }
  }

  async resolveDispute(
    adminId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
    req?: RequestContext,
  ): Promise<ResolutionResult> {
    await this.ensureLegacyFlowAllowed(disputeId);

    const result = dto.result ?? dto.verdict;
    if (!result) {
      throw new BadRequestException('Verdict is required');
    }

    if (!dto.faultType || !dto.faultyParty || !dto.reasoning) {
      throw new BadRequestException(
        'faultType, faultyParty, and reasoning are required for verdict workflow',
      );
    }

    const adjudicator = await this.userRepo.findOne({
      where: { id: adminId },
      select: ['id', 'role'],
    });
    if (!adjudicator) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);
    }
    await this.ensureVerdictHearingGate(disputeId);

    const escrow = await this.escrowRepo.findOne({ where: { milestoneId: dispute.milestoneId } });
    if (!escrow) {
      throw new NotFoundException(`Escrow for Milestone "${dispute.milestoneId}" not found`);
    }

    const project = await this.projectRepo.findOne({ where: { id: dispute.projectId } });
    if (!project) {
      throw new NotFoundException(`Project "${dispute.projectId}" not found`);
    }

    const milestone = await this.milestoneRepo.findOne({ where: { id: dispute.milestoneId } });
    if (!milestone) {
      throw new NotFoundException(`Milestone "${dispute.milestoneId}" not found`);
    }

    let amountToFreelancer = dto.amountToFreelancer;
    let amountToClient = dto.amountToClient;

    if (amountToFreelancer == null || amountToClient == null) {
      if (dto.splitRatioClient == null) {
        throw new BadRequestException(
          'amountToFreelancer/amountToClient or splitRatioClient is required',
        );
      }

      const fundedAmount =
        escrow.fundedAmount && escrow.fundedAmount > 0 ? escrow.fundedAmount : escrow.totalAmount;
      const platformFee = escrow.platformFee || 0;
      const remaining = new Decimal(fundedAmount).minus(platformFee);

      if (remaining.lessThan(0)) {
        throw new BadRequestException('Platform fee exceeds funded amount');
      }

      if (result === DisputeResult.WIN_CLIENT) {
        amountToClient = remaining.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
        amountToFreelancer = 0;
      } else if (result === DisputeResult.WIN_FREELANCER) {
        amountToClient = 0;
        amountToFreelancer = remaining.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      } else {
        const clientRatio = new Decimal(dto.splitRatioClient).dividedBy(100);
        amountToClient = remaining
          .times(clientRatio)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
        amountToFreelancer = remaining
          .minus(amountToClient)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }
    }

    const verdictPayload = {
      disputeId,
      result,
      faultType: dto.faultType,
      faultyParty: dto.faultyParty,
      reasoning: dto.reasoning,
      amountToFreelancer,
      amountToClient,
      trustScorePenalty: dto.trustScorePenalty,
      banUser: dto.banUser,
      banDurationDays: dto.banDurationDays,
      warningMessage: dto.warningMessage,
      adminComment: dto.adminComment,
    };

    const verdictResult = await this.verdictService.issueVerdict(
      verdictPayload,
      adjudicator.id,
      adjudicator.role,
    );

    const resolvedDispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!resolvedDispute) {
      throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);
    }

    const { loserId, winnerId } = determineLoser(
      result,
      resolvedDispute.raisedById,
      resolvedDispute.defendantId,
      resolvedDispute.disputeType,
    );

    if (loserId) {
      await this.userWarningService.checkAndFlagAfterDisputeLoss(loserId, disputeId, result);
      if (resolvedDispute.category === DisputeCategory.FRAUD) {
        await this.userWarningService.flagForFraud(
          loserId,
          disputeId,
          `Thua dispute voi category FRAUD: ${dto.adminComment || ''}`.trim() ||
            'Thua dispute voi category FRAUD',
        );
      }
    }

    const walletIds = verdictResult.transfers.map((transfer) => transfer.walletId);
    const wallets = walletIds.length
      ? await this.walletRepo.find({ where: { id: In(walletIds) } })
      : [];
    const walletById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    const transferDetails = verdictResult.transfers.map((transfer): TransferDetail => {
      const wallet = walletById.get(transfer.walletId);
      const type =
        transfer.type === TransactionType.REFUND
          ? 'REFUND'
          : transfer.type === TransactionType.ESCROW_RELEASE
            ? 'RELEASE'
            : 'FEE';
      return {
        toUserId: wallet?.userId ?? '',
        toWalletId: transfer.walletId,
        amount: transfer.amount,
        type,
        description: transfer.description || 'Verdict transfer',
      };
    });

    await this.auditLogsService.logCustom(
      'RESOLVE_DISPUTE',
      'Dispute',
      disputeId,
      {
        verdict: result,
        adminComment: dto.adminComment,
        moneyDistribution: verdictResult.distribution,
        transfers: transferDetails.map((transfer) => ({
          toUserId: transfer.toUserId,
          amount: transfer.amount,
          type: transfer.type,
        })),
        loserId,
        winnerId,
        penaltyApplied: verdictResult.verdict.trustScorePenalty > 0,
        trustScoreUpdate: null,
      },
      req as Record<string, unknown> | undefined,
      adjudicator.id,
    );

    const resolvedEvent: DisputeResolvedEvent = {
      disputeId,
      projectId: project.id,
      verdict: result,
      clientId: project.clientId,
      freelancerId: project.freelancerId,
      brokerId: project.brokerId,
      loserId,
      winnerId,
      moneyDistribution: verdictResult.distribution,
      adminComment: dto.adminComment || dto.reasoning?.conclusion,
      adminId: adjudicator.id,
      resolvedAt: resolvedDispute.resolvedAt,
    };

    this.eventEmitter.emit(DISPUTE_EVENTS.RESOLVED, resolvedEvent);

    return {
      disputeId,
      verdict: result,
      moneyDistribution: verdictResult.distribution,
      transfers: transferDetails,
      loserId,
      winnerId,
      penaltyApplied: verdictResult.verdict.trustScorePenalty > 0,
      projectStatusUpdated: project.status,
      milestoneStatusUpdated: milestone.status,
      escrowStatusUpdated: escrow.status,
      trustScoreUpdated: null,
      resolvedAt: resolvedDispute.resolvedAt,
      adminId: adjudicator.id,
    };
  }

  // =============================================================================
  // ACCEPT DISPUTE (Queue ↁECaseload)
  // Staff chấp nhận dispute từ queue vào caseload đềEreview
  // TRIAGE_PENDING ↁEPREVIEW
  // =============================================================================

  async acceptDispute(staffId: string, disputeId: string): Promise<DisputeEntity> {
    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can accept disputes');
    }

    return await this.dataSource.transaction(async (manager) => {
      const disputeRepo = manager.getRepository(DisputeEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);

      const dispute = await disputeRepo.findOne({
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (![DisputeStatus.OPEN, DisputeStatus.TRIAGE_PENDING].includes(dispute.status)) {
        throw new BadRequestException(
          `Cannot accept dispute in status ${dispute.status}. Only TRIAGE_PENDING disputes can be accepted.`,
        );
      }

      // Nếu dispute đã assign cho staff khác (qua autoAssign), chềEadmin mới được reassign
      if (
        dispute.assignedStaffId &&
        dispute.assignedStaffId !== staffId &&
        staff.role !== UserRole.ADMIN
      ) {
        this.throwAssignedToOtherStaffForbidden(dispute);
      }

      const previousStatus = dispute.status;
      const now = new Date();

      // Gán staff nếu chưa có
      if (!dispute.assignedStaffId) {
        dispute.assignedStaffId = staffId;
        dispute.assignedAt = now;
      }

      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.PREVIEW);
      dispute.triageActorId = staffId;
      dispute.triageAt = now;
      dispute.triagePreviousStatus = previousStatus;
      dispute.triageReason = 'Accepted into preview by staff';

      const updated = await disputeRepo.save(dispute);

      await activityRepo.save(
        activityRepo.create({
          disputeId: dispute.id,
          actorId: staff.id,
          actorRole: staff.role,
          action: DisputeAction.REVIEW_ACCEPTED,
          description: 'Dispute accepted for preview (moved to caseload)',
          metadata: {
            previousStatus,
            assignedStaffId: dispute.assignedStaffId,
          },
        }),
      );

      await this.appendLedgerEntry(manager, {
        disputeId: dispute.id,
        eventType: 'TRIAGE_ACCEPTED',
        actorId: staff.id,
        reason: dispute.triageReason || null,
        previousStatus,
        newStatus: updated.status,
        payload: {
          assignedStaffId: dispute.assignedStaffId || null,
          triageAt: dispute.triageAt?.toISOString() || null,
        },
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId: dispute.id,
        previousStatus,
        newStatus: updated.status,
      });

      return updated;
    });
  }

  // =============================================================================
  // REJECT DISPUTE
  // Staff/Admin từ chối dispute (OPEN/PENDING_REVIEW ↁEREJECTED)
  // =============================================================================

  async rejectDispute(staffId: string, disputeId: string, reason: string): Promise<DisputeEntity> {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Rejection reason must be at least 5 characters');
    }

    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can reject disputes');
    }

    return await this.dataSource.transaction(async (manager) => {
      const disputeRepo = manager.getRepository(DisputeEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);

      const dispute = await disputeRepo.findOne({
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (
        dispute.assignedStaffId &&
        dispute.assignedStaffId !== staffId &&
        staff.role !== UserRole.ADMIN
      ) {
        this.throwAssignedToOtherStaffForbidden(dispute);
      }

      const previousStatus = dispute.status;
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.REJECTED);
      dispute.adminComment = reason.trim();

      // Set dismissal hold đềEcho phép appeal trong 24h
      const now = new Date();
      dispute.dismissalHoldUntil = new Date(now.getTime() + DISMISSAL_HOLD_HOURS * 60 * 60 * 1000);
      dispute.triageActorId = staffId;
      dispute.triageAt = now;
      dispute.triagePreviousStatus = previousStatus;
      dispute.triageReason = reason.trim();

      if (!dispute.assignedStaffId) {
        dispute.assignedStaffId = staffId;
        dispute.assignedAt = now;
      }

      const updated = await disputeRepo.save(dispute);

      await activityRepo.save(
        activityRepo.create({
          disputeId: dispute.id,
          actorId: staff.id,
          actorRole: staff.role,
          action: DisputeAction.REJECTED,
          description: `Dispute rejected: ${reason.trim()}`,
          metadata: { previousStatus, reason: reason.trim() },
        }),
      );

      await this.appendLedgerEntry(manager, {
        disputeId: dispute.id,
        eventType: 'TRIAGE_REJECTED',
        actorId: staff.id,
        reason: reason.trim(),
        previousStatus,
        newStatus: updated.status,
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId: dispute.id,
        previousStatus,
        newStatus: updated.status,
      });

      // Check dismissal rate
      this.checkDismissalRateAndFlag(staffId).catch(() => {});

      return updated;
    });
  }

  // =============================================================================
  // REQUEST ADDITIONAL INFO
  // Staff yêu cầu thêm thông tin từ raiser
  // =============================================================================

  async requestAdditionalInfo(
    staffId: string,
    disputeId: string,
    reason: string,
    deadlineAt?: string,
  ): Promise<DisputeEntity> {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Info request reason must be at least 5 characters');
    }

    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can request info');
    }

    return await this.dataSource.transaction(async (manager) => {
      const disputeRepo = manager.getRepository(DisputeEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);
      const now = new Date();
      let infoDeadline: Date | null = null;

      if (deadlineAt) {
        infoDeadline = new Date(deadlineAt);
        if (Number.isNaN(infoDeadline.getTime())) {
          throw new BadRequestException('Invalid info request deadline');
        }
        if (infoDeadline <= now) {
          throw new BadRequestException('Info request deadline must be in the future');
        }
      }

      const dispute = await disputeRepo.findOne({
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if (
        dispute.assignedStaffId &&
        dispute.assignedStaffId !== staffId &&
        staff.role !== UserRole.ADMIN
      ) {
        this.throwAssignedToOtherStaffForbidden(dispute);
      }

      const previousStatus = dispute.status;
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.INFO_REQUESTED);
      dispute.infoRequestReason = reason.trim();
      dispute.infoRequestedById = staffId;
      dispute.infoRequestedAt = now;
      dispute.infoRequestDeadline = infoDeadline as any;
      dispute.infoProvidedAt = null as any;

      const updated = await disputeRepo.save(dispute);

      await activityRepo.save(
        activityRepo.create({
          disputeId: dispute.id,
          actorId: staff.id,
          actorRole: staff.role,
          action: DisputeAction.INFO_REQUESTED,
          description: `Additional info requested: ${reason.trim()}`,
          metadata: {
            previousStatus,
            reason: reason.trim(),
            deadlineAt: infoDeadline ? infoDeadline.toISOString() : null,
          },
        }),
      );

      await this.appendLedgerEntry(manager, {
        disputeId: dispute.id,
        eventType: 'INFO_REQUESTED',
        actorId: staff.id,
        reason: reason.trim(),
        previousStatus,
        newStatus: updated.status,
        payload: {
          deadlineAt: infoDeadline ? infoDeadline.toISOString() : null,
        },
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId: dispute.id,
        previousStatus,
        newStatus: updated.status,
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.INFO_REQUESTED, {
        disputeId: dispute.id,
        reason: reason.trim(),
        requestedById: staffId,
        deadlineAt: infoDeadline ? infoDeadline.toISOString() : null,
      });

      return updated;
    });
  }

  // =============================================================================
  // DEFENDANT RESPONSE
  // BềEđơn gửi phản hồi
  // =============================================================================

  async submitDefendantResponse(
    userId: string,
    disputeId: string,
    dto: DefendantResponseDto,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (userId !== dispute.defendantId) {
      throw new ForbiddenException('Only the defendant can submit a response');
    }

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      throw new BadRequestException('Cannot respond to a closed dispute');
    }

    dispute.messages = dto.response;
    if (dto.evidence?.length) {
      const existing = dispute.evidence || [];
      dispute.evidence = [...new Set([...existing, ...dto.evidence])];
    }

    const saved = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: dispute.defendantRole,
        action: DisputeAction.DEFENDANT_RESPONDED,
        description: 'Defendant submitted response',
        metadata: {
          hasEvidence: Boolean(dto.evidence?.length),
          evidenceCount: dto.evidence?.length || 0,
        },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.DEFENDANT_RESPONDED, {
      disputeId,
      defendantId: userId,
    });

    return saved;
  }

  // =============================================================================
  // NOTES (Ghi chú nội bềE
  // =============================================================================

  async getActivities(
    userId: string,
    userRole: UserRole,
    disputeId: string,
    includeInternal: boolean = false,
  ): Promise<DisputeActivityEntity[]> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'raisedById',
        'defendantId',
        'assignedStaffId',
        'escalatedToAdminId',
        'groupId',
      ],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute as DisputeEntity, userId, userRole);
    if (includeInternal) {
      await this.assertInternalCaseAccess(dispute, userId, userRole);
    }

    const qb = this.activityRepo
      .createQueryBuilder('activity')
      .where('activity.disputeId = :disputeId', { disputeId })
      .orderBy('activity.timestamp', 'DESC');

    if (!includeInternal) {
      qb.andWhere('activity.isInternal = :isInternal', { isInternal: false });
    }

    return await qb.getMany();
  }

  async getNotes(
    userId: string,
    userRole: UserRole,
    disputeId: string,
    includeInternal: boolean = false,
  ): Promise<DisputeNoteEntity[]> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'raisedById',
        'defendantId',
        'assignedStaffId',
        'escalatedToAdminId',
        'groupId',
      ],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertDisputeAccess(dispute as DisputeEntity, userId, userRole);
    if (includeInternal) {
      await this.assertInternalCaseAccess(dispute, userId, userRole);
    }

    const where: Record<string, unknown> = { disputeId };
    if (!includeInternal) {
      where.isInternal = false;
    }

    return await this.noteRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async addNote(
    userId: string,
    userRole: UserRole,
    disputeId: string,
    dto: AddNoteDto,
  ): Promise<DisputeNoteEntity> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'assignedStaffId', 'escalatedToAdminId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertInternalCaseAccess(dispute, userId, userRole);

    const note = this.noteRepo.create({
      disputeId,
      authorId: userId,
      authorRole: userRole,
      content: dto.content,
      isInternal: dto.isInternal ?? false,
      isPinned: dto.isPinned ?? false,
      noteType: dto.noteType || 'GENERAL',
      attachments: dto.attachments || [],
    });

    const saved = await this.noteRepo.save(note);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: userRole,
        action: DisputeAction.NOTE_ADDED,
        description: dto.isInternal ? 'Internal note added' : 'Note added',
        isInternal: dto.isInternal ?? false,
        metadata: { noteId: saved.id, noteType: dto.noteType },
      }),
    );

    return saved;
  }

  async getInternalMembers(
    disputeId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<
    Array<{
      userId: string;
      role: UserRole;
      fullName?: string;
      email?: string;
      source: 'ASSIGNED_STAFF' | 'ESCALATED_ADMIN' | 'SUPPORT_INVITED' | 'ADMIN_DEFAULT';
      grantedBy?: string | null;
      createdAt?: Date;
    }>
  > {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'assignedStaffId', 'escalatedToAdminId'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    await this.assertInternalCaseAccess(dispute, requesterId, requesterRole);

    const memberships = await this.disputeInternalMembershipRepo.find({
      where: { disputeId },
      select: ['userId', 'grantedBy', 'createdAt', 'source'],
      order: { createdAt: 'ASC' },
    });

    const explicitUserIds = new Set(
      memberships.map((membership) => membership.userId).filter(Boolean),
    );
    if (dispute.assignedStaffId) explicitUserIds.add(dispute.assignedStaffId);
    if (dispute.escalatedToAdminId) explicitUserIds.add(dispute.escalatedToAdminId);
    const shouldIncludeAdminDefault =
      requesterRole === UserRole.ADMIN &&
      !dispute.assignedStaffId &&
      !dispute.escalatedToAdminId;
    if (shouldIncludeAdminDefault) {
      explicitUserIds.add(requesterId);
    }

    const users =
      explicitUserIds.size > 0
        ? await this.userRepo.find({
            where: { id: In(Array.from(explicitUserIds)) },
            select: ['id', 'role', 'fullName', 'email'],
          })
        : [];

    const userById = new Map(users.map((user) => [user.id, user]));

    const rows: Array<{
      userId: string;
      role: UserRole;
      fullName?: string;
      email?: string;
      source: 'ASSIGNED_STAFF' | 'ESCALATED_ADMIN' | 'SUPPORT_INVITED' | 'ADMIN_DEFAULT';
      grantedBy?: string | null;
      createdAt?: Date;
    }> = [];

    if (shouldIncludeAdminDefault) {
      const adminSelf = userById.get(requesterId);
      if (adminSelf) {
        rows.push({
          userId: adminSelf.id,
          role: adminSelf.role,
          fullName: adminSelf.fullName,
          email: adminSelf.email,
          source: 'ADMIN_DEFAULT',
        });
      }
    }

    if (dispute.assignedStaffId) {
      const assigned = userById.get(dispute.assignedStaffId);
      if (assigned) {
        rows.push({
          userId: assigned.id,
          role: assigned.role,
          fullName: assigned.fullName,
          email: assigned.email,
          source: 'ASSIGNED_STAFF',
        });
      }
    }

    if (dispute.escalatedToAdminId) {
      const escalated = userById.get(dispute.escalatedToAdminId);
      if (escalated) {
        rows.push({
          userId: escalated.id,
          role: escalated.role,
          fullName: escalated.fullName,
          email: escalated.email,
          source: 'ESCALATED_ADMIN',
        });
      }
    }

    memberships.forEach((membership) => {
      const memberUser = userById.get(membership.userId);
      if (!memberUser) return;
      if (![UserRole.STAFF, UserRole.ADMIN].includes(memberUser.role)) return;

      rows.push({
        userId: memberUser.id,
        role: memberUser.role,
        fullName: memberUser.fullName,
        email: memberUser.email,
        source: 'SUPPORT_INVITED',
        grantedBy: membership.grantedBy,
        createdAt: membership.createdAt,
      });
    });

    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.userId)) return false;
      seen.add(row.userId);
      return true;
    });
  }

  async deleteNote(userId: string, noteId: string): Promise<void> {
    const note = await this.noteRepo.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.noteRepo.remove(note);
  }

  // =============================================================================
  // APPEAL SYSTEM
  // =============================================================================

  async submitAppeal(userId: string, disputeId: string, dto: AppealDto): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // ChềEraiser hoặc defendant mới được appeal
    if (userId !== dispute.raisedById && userId !== dispute.defendantId) {
      throw new ForbiddenException('Only dispute parties can submit an appeal');
    }

    if (dispute.status !== DisputeStatus.RESOLVED) {
      throw new BadRequestException('Can only appeal a resolved dispute');
    }

    // Check appeal deadline
    if (dispute.appealDeadline && new Date() > dispute.appealDeadline) {
      throw new BadRequestException('Appeal deadline has passed');
    }

    const previousStatus = dispute.status;
    dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.APPEALED);
    dispute.isAppealed = true;
    dispute.appealReason = dto.reason;
    dispute.appealedAt = new Date();

    if (dto.additionalEvidence?.length) {
      const existing = dispute.evidence || [];
      dispute.evidence = [...new Set([...existing, ...dto.additionalEvidence])];
    }

    const updated = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: userId === dispute.raisedById ? dispute.raiserRole : dispute.defendantRole,
        action: DisputeAction.APPEAL_SUBMITTED,
        description: `Appeal submitted: ${dto.reason}`,
        metadata: { previousStatus, reason: dto.reason },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
      disputeId: dispute.id,
      previousStatus,
      newStatus: updated.status,
    });

    // Auto-schedule TIER_2 appeal hearing with Admin moderator (BLTTDS 2015)
    try {
      const admin = await this.userRepo.findOne({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        select: ['id'],
        order: { createdAt: 'ASC' },
      });

      if (admin) {
        const appealHearingDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h from now

        await this.hearingService.scheduleHearing(
          {
            disputeId: dispute.id,
            scheduledAt: appealHearingDate.toISOString(),
            tier: HearingTier.TIER_2,
            agenda: `Appeal hearing (Tier 2)  EReviewing verdict appeal: ${dto.reason?.slice(0, 200)}`,
            estimatedDurationMinutes: 90,
            isEmergency: false,
          },
          admin.id,
        );

        // Update dispute tier
        await this.disputeRepo.update(dispute.id, { currentTier: 2 });
      }
    } catch (scheduleError: unknown) {
      // Non-blocking: if auto-schedule fails, appeal is still filed
      const errMsg = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);
      this.logger.warn(`Auto-schedule TIER_2 hearing failed for dispute ${disputeId}: ${errMsg}`);
    }

    return updated;
  }

  async appealRejection(userId: string, disputeId: string, reason: string): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (userId !== dispute.raisedById) {
      throw new ForbiddenException('Only the raiser can appeal a rejection');
    }

    if (dispute.status !== DisputeStatus.REJECTED) {
      throw new BadRequestException('Can only appeal a rejected dispute');
    }

    // Check dismissal hold (24h window)
    if (dispute.dismissalHoldUntil && new Date() > dispute.dismissalHoldUntil) {
      throw new BadRequestException('Rejection appeal window has expired');
    }

    const previousStatus = dispute.status;
    dispute.status = DisputeStateMachine.transition(
      dispute.status,
      DisputeStatus.REJECTION_APPEALED,
    );
    dispute.rejectionAppealReason = reason;
    dispute.rejectionAppealedAt = new Date();

    const updated = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: dispute.raiserRole,
        action: DisputeAction.REJECTION_APPEALED,
        description: `Rejection appealed: ${reason}`,
        metadata: { previousStatus, reason },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
      disputeId: dispute.id,
      previousStatus,
      newStatus: updated.status,
    });

    return updated;
  }

  async resolveAppeal(
    staffId: string,
    disputeId: string,
    dto: AppealVerdictDto,
  ): Promise<DisputeEntity> {
    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can resolve appeals');
    }

    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.APPEALED) {
      throw new BadRequestException('Dispute is not in APPEALED status');
    }

    const previousStatus = dispute.status;
    const now = new Date();

    // AppealVerdictDto chứa verdict mới ↁEissue new verdict overriding old one
    // Transition APPEALED ↁEIN_MEDIATION (đềEre-evaluate) hoặc ↁERESOLVED (giữ nguyên)
    // Nếu admin ra verdict mới khác cũ ↁEoverride, nếu giống ↁEuphold
    const verdictPayload = {
      disputeId,
      result: dto.result,
      faultType: dto.faultType,
      faultyParty: dto.faultyParty,
      reasoning: dto.reasoning,
      amountToFreelancer: dto.amountToFreelancer,
      amountToClient: dto.amountToClient,
      trustScorePenalty: dto.trustScorePenalty,
      banUser: dto.banUser,
      banDurationDays: dto.banDurationDays,
      warningMessage: dto.warningMessage,
      adminComment: dto.adminComment,
    };

    // Re-resolve: transition APPEALED ↁERESOLVED (via state machine)
    dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.RESOLVED);
    dispute.appealResolvedById = staffId;
    dispute.appealResolution = dto.overrideReason || 'Appeal resolved with new verdict';
    dispute.appealResolvedAt = now;

    const updated = await this.disputeRepo.save(dispute);

    // Issue new verdict via verdict service
    await this.verdictService.issueVerdict(verdictPayload, staffId, staff.role);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: staff.id,
        actorRole: staff.role,
        action: DisputeAction.APPEAL_RESOLVED,
        description: `Appeal resolved with new verdict: ${dto.result}`,
        metadata: {
          previousStatus,
          overridesVerdictId: dto.overridesVerdictId,
          newResult: dto.result,
        },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
      disputeId: dispute.id,
      previousStatus,
      newStatus: updated.status,
    });

    return updated;
  }

  async resolveRejectionAppeal(
    adminId: string,
    disputeId: string,
    decision: string,
    resolution: string,
  ): Promise<DisputeEntity> {
    const admin = await this.userRepo.findOne({
      where: { id: adminId },
      select: ['id', 'role'],
    });
    if (!admin) {
      throw new NotFoundException('User not found');
    }
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can resolve rejection appeals');
    }

    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.REJECTION_APPEALED) {
      throw new BadRequestException('Dispute is not in REJECTION_APPEALED status');
    }

    const previousStatus = dispute.status;
    const now = new Date();
    const isOverturn = decision === 'OVERTURN';

    if (isOverturn) {
      // Lật ngược rejection ↁEmềElại IN_MEDIATION
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.IN_MEDIATION);
    } else {
      // Giữ nguyên rejection
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.REJECTED);
    }

    dispute.rejectionAppealResolvedById = adminId;
    dispute.rejectionAppealResolution = resolution;
    dispute.rejectionAppealResolvedAt = now;

    const updated = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: admin.id,
        actorRole: admin.role,
        action: DisputeAction.REJECTION_APPEAL_RESOLVED,
        description: isOverturn
          ? 'Rejection overturned - dispute reopened for mediation'
          : 'Rejection upheld',
        metadata: {
          previousStatus,
          decision,
          resolution,
        },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
      disputeId: dispute.id,
      previousStatus,
      newStatus: updated.status,
    });

    return updated;
  }

  // =============================================================================
  // ADMIN UPDATE DISPUTE
  // =============================================================================

  async adminUpdateDispute(
    staffId: string,
    disputeId: string,
    dto: AdminUpdateDisputeDto,
  ): Promise<DisputeEntity> {
    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can update disputes');
    }

    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (DISPUTE_CLOSED_STATUSES.includes(dispute.status)) {
      throw new BadRequestException('Cannot update a closed dispute');
    }

    const changes: string[] = [];

    if (dto.category !== undefined) {
      dispute.category = dto.category;
      changes.push(`category ↁE${dto.category}`);
    }
    if (dto.priority !== undefined) {
      dispute.priority = dto.priority;
      changes.push(`priority ↁE${dto.priority}`);
    }
    if (dto.disputedAmount !== undefined) {
      dispute.disputedAmount = dto.disputedAmount;
      changes.push(`disputedAmount ↁE${dto.disputedAmount}`);
    }
    if (dto.extendResponseDeadlineDays) {
      const now = new Date();
      dispute.responseDeadline = new Date(
        now.getTime() + dto.extendResponseDeadlineDays * 24 * 60 * 60 * 1000,
      );
      changes.push(`responseDeadline extended by ${dto.extendResponseDeadlineDays} days`);
    }
    if (dto.extendResolutionDeadlineDays) {
      const now = new Date();
      dispute.resolutionDeadline = new Date(
        now.getTime() + dto.extendResolutionDeadlineDays * 24 * 60 * 60 * 1000,
      );
      changes.push(`resolutionDeadline extended by ${dto.extendResolutionDeadlineDays} days`);
    }

    if (changes.length === 0) {
      return dispute;
    }

    const updated = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: staff.id,
        actorRole: staff.role,
        action: DisputeAction.PRIORITY_CHANGED,
        description: `Dispute updated: ${changes.join(', ')}`,
        isInternal: true,
        metadata: { changes },
      }),
    );

    return updated;
  }

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Tính toán phân chia tiền dựa trên verdict
   */

  private calculateMoneyDistribution(
    verdict: DisputeResult,
    escrow: EscrowEntity,
    splitRatioClient: number = 50,
  ): MoneyDistribution {
    const { totalAmount, developerShare, brokerShare, platformFee } = escrow;

    switch (verdict) {
      case DisputeResult.WIN_CLIENT:
        return {
          clientAmount: totalAmount,
          brokerAmount: 0,
          freelancerAmount: 0,
          platformFee: 0,
          totalAmount,
        };

      case DisputeResult.WIN_FREELANCER:
        // Freelancer thắng: Chia theo tỷ lềEđã định trong Escrow
        return {
          clientAmount: 0,
          freelancerAmount: developerShare,
          brokerAmount: brokerShare,
          platformFee: platformFee,
          totalAmount,
        };

      case DisputeResult.SPLIT: {
        // Chia theo tỷ lềE- SỬ DỤNG DECIMAL.JS cho USD
        const total = new Decimal(totalAmount);
        const clientRatioDecimal = new Decimal(splitRatioClient).dividedBy(100);
        const freelancerRatioDecimal = new Decimal(1).minus(clientRatioDecimal);

        // Phần Client nhận (không mất phí)
        const clientAmount = total
          .times(clientRatioDecimal)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        // Phần Freelancer nhận (chia theo tỷ lềEgốc, có trừ phí)
        const freelancerPortion = total.times(freelancerRatioDecimal);
        const freelancerAmount = freelancerPortion
          .times(new Decimal(escrow.developerPercentage).dividedBy(100))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const brokerAmount = freelancerPortion
          .times(new Decimal(escrow.brokerPercentage).dividedBy(100))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        // Platform fee: phần còn lại sau khi chia freelancer + broker
        // Đảm bảo tổng = totalAmount (tránh lỗi làm tròn)
        const platformFeeAmount = total
          .minus(clientAmount)
          .minus(freelancerAmount)
          .minus(brokerAmount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        return {
          clientAmount: clientAmount.toNumber(),
          freelancerAmount: freelancerAmount.toNumber(),
          brokerAmount: brokerAmount.toNumber(),
          platformFee: platformFeeAmount.toNumber(),
          totalAmount,
        };
      }

      default:
        throw new BadRequestException(`Invalid verdict: ${verdict}`);
    }
  }

  /**
   * Thực hiện chuyển tiền vào các ví
   *
   * 🔥 IMPORTANT: Logic phân chia tiền phụ thuộc vào dispute type:
   * - CLIENT_VS_FREELANCER / FREELANCER_VS_CLIENT: Standard flow
   * - CLIENT_VS_BROKER / BROKER_VS_CLIENT: Client vs Broker
   * - FREELANCER_VS_BROKER / BROKER_VS_FREELANCER: Freelancer vs Broker
   */
  private async executeMoneyTransfers(
    queryRunner: QueryRunner,
    verdict: DisputeResult,
    escrow: EscrowEntity,
    project: ProjectEntity,
    distribution: MoneyDistribution,
    dispute: DisputeEntity, // Thêm dispute đềEbiết dispute type
  ): Promise<
    Array<{
      toUserId: string;
      toWalletId: string;
      amount: number;
      type: string;
      description: string;
      transactionId: string;
    }>
  > {
    const transfers: Array<{
      toUserId: string;
      toWalletId: string;
      amount: number;
      type: string;
      description: string;
      transactionId: string;
    }> = [];

    // Helper function đềEtạo transaction và cập nhật wallet

    const transferToWallet = async (
      userId: string,
      amount: number,
      type: TransactionType,
      description: string,
    ) => {
      // Skip if amount is zero or negative
      if (amount <= 0) return null;

      const wallet = await queryRunner.manager.findOne(WalletEntity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet for User "${userId}" not found`);
      }

      // Cập nhật balance - SỬ DỤNG DECIMAL.JS cho USD
      wallet.balance = new Decimal(wallet.balance)
        .plus(amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      if (type === TransactionType.REFUND) {
        // Client nhận refund
        const newHeldBalance = new Decimal(wallet.heldBalance)
          .minus(amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
        wallet.heldBalance = Math.max(0, newHeldBalance);
      } else if (type === TransactionType.ESCROW_RELEASE) {
        // Freelancer/Broker nhận tiền
        wallet.totalEarned = new Decimal(wallet.totalEarned)
          .plus(amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      await queryRunner.manager.save(WalletEntity, wallet);

      // Tạo Transaction record
      const transaction = queryRunner.manager.create(TransactionEntity, {
        walletId: wallet.id,
        amount,
        fee: 0,
        netAmount: amount,
        currency: 'USD',
        type,
        status: TransactionStatus.COMPLETED,
        referenceType: 'Escrow',
        referenceId: escrow.id,
        description,
        metadata: {
          disputeId: escrow.disputeId,
          projectId: project.id,
          verdict,
        },
      });

      const savedTransaction = await queryRunner.manager.save(TransactionEntity, transaction);

      return {
        toUserId: userId,
        toWalletId: wallet.id,
        amount,
        type: type === TransactionType.REFUND ? 'REFUND' : 'RELEASE',
        description,
        transactionId: savedTransaction.id,
      };
    };

    // PERFORMANCE: Build transfer promises array for parallel execution
    type TransferResult = {
      toUserId: string;
      toWalletId: string;
      amount: number;
      type: string;
      description: string;
      transactionId: string;
    };

    const transferPromises: Promise<TransferResult | null>[] = [];

    // =========================================================================
    // SMART TRANSFER ROUTING based on dispute type
    // =========================================================================
    //
    // "clientAmount" trong distribution KHÔNG PHẢI luôn đi đến project.clientId!
    // Nó đi đến "bên thắng kiểu client" dựa trên dispute type.
    //
    // Ví dụ:
    // - CLIENT_VS_FREELANCER + WIN_CLIENT ↁEClient nhận clientAmount ✁E
    // - BROKER_VS_FREELANCER + WIN_CLIENT ↁEBROKER nhận (vì broker là "client side" trong dispute này)
    // =========================================================================

    const { clientSideRecipient, freelancerSideRecipient } = this.determineTransferRecipients(
      dispute.disputeType,
      project,
    );

    // Queue transfers based on verdict
    if (distribution.clientAmount > 0) {
      transferPromises.push(
        transferToWallet(
          clientSideRecipient,
          distribution.clientAmount,
          // REFUND nếu là client thật, ESCROW_RELEASE nếu là broker/freelancer đóng vai client side
          clientSideRecipient === project.clientId
            ? TransactionType.REFUND
            : TransactionType.ESCROW_RELEASE,
          `${clientSideRecipient === project.clientId ? 'Refund' : 'Payment'} from Dispute #${escrow.disputeId} - ${verdict}`,
        ),
      );
    }

    if (distribution.freelancerAmount > 0) {
      transferPromises.push(
        transferToWallet(
          freelancerSideRecipient,
          distribution.freelancerAmount,
          TransactionType.ESCROW_RELEASE,
          `Payment from Dispute #${escrow.disputeId} - ${verdict}`,
        ),
      );
    }

    // Broker amount - chềEkhi project có broker VÀ broker không phải là một trong hai bên chính của dispute
    const isDisputeInvolvingBroker = [
      DisputeType.CLIENT_VS_BROKER,
      DisputeType.BROKER_VS_CLIENT,
      DisputeType.FREELANCER_VS_BROKER,
      DisputeType.BROKER_VS_FREELANCER,
    ].includes(dispute.disputeType);

    if (distribution.brokerAmount > 0 && project.brokerId && !isDisputeInvolvingBroker) {
      // Broker chềEnhận commission nếu không phải bên tranh chấp
      transferPromises.push(
        transferToWallet(
          project.brokerId,
          distribution.brokerAmount,
          TransactionType.ESCROW_RELEASE,
          `Commission from Dispute #${escrow.disputeId} - ${verdict}`,
        ),
      );
    }

    // PERFORMANCE: Execute all transfers in parallel
    const results = await Promise.all(transferPromises);
    transfers.push(...(results.filter(Boolean) as TransferResult[]));

    // Platform fee - chuyển vào ví Platform (có thềElà một admin wallet)
    // Tùy vào thiết kế hềEthống, có thềEbềEqua hoặc tạo wallet riêng
    if (distribution.platformFee > 0) {
      this.logger.log(`[MoneyTransfer] Platform Fee: $${distribution.platformFee} USD`);
      // Có thềEtạo transaction cho platform wallet ềEđây
    }

    return transfers;
  }

  private async checkDismissalRateAndFlag(staffId: string): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - DISMISSAL_RATE_SAMPLE_WINDOW_DAYS);

    const [dismissedCount, acceptedCount] = await Promise.all([
      this.activityRepo.count({
        where: {
          actorId: staffId,
          action: DisputeAction.REJECTED,
          timestamp: MoreThan(since),
        },
      }),
      this.activityRepo.count({
        where: {
          actorId: staffId,
          action: DisputeAction.REVIEW_ACCEPTED,
          timestamp: MoreThan(since),
        },
      }),
    ]);

    const totalReviewed = dismissedCount + acceptedCount;
    if (totalReviewed < DISMISSAL_RATE_MIN_SAMPLES) {
      return;
    }

    const dismissalRate = dismissedCount / totalReviewed;
    if (dismissalRate >= DISMISSAL_RATE_ALERT_THRESHOLD) {
      this.eventEmitter.emit('staff.dismissal_rate_high', {
        staffId,
        dismissalRate,
        dismissedCount,
        totalReviewed,
        windowDays: DISMISSAL_RATE_SAMPLE_WINDOW_DAYS,
      });
    }
  }

  async releaseExpiredDismissalHolds(
    asOf: Date = new Date(),
  ): Promise<{ processed: number; released: number }> {
    const disputes = await this.disputeRepo.find({
      where: {
        status: DisputeStatus.REJECTED,
        dismissalHoldUntil: LessThanOrEqual(asOf),
        rejectionAppealedAt: IsNull(),
      },
    });

    if (disputes.length === 0) {
      return { processed: 0, released: 0 };
    }

    let released = 0;
    for (const dispute of disputes) {
      await this.escrowRepo.update(
        { milestoneId: dispute.milestoneId },
        { status: EscrowStatus.FUNDED },
      );
      await this.disputeRepo.update(dispute.id, { dismissalHoldUntil: null as any });
      released += 1;
      this.eventEmitter.emit('dispute.dismissal_hold_released', {
        disputeId: dispute.id,
        releasedAt: asOf,
      });
    }

    return { processed: disputes.length, released };
  }

  /**
   * Xác định các trạng thái milestone được phép dispute dựa trên loại dispute
   */
  private getAllowedMilestoneStatusesForDispute(category: DisputeCategory): MilestoneStatus[] {
    const inProgressLike = [MilestoneStatus.IN_PROGRESS, MilestoneStatus.REVISIONS_REQUIRED];
    const submittedLike = [MilestoneStatus.SUBMITTED, MilestoneStatus.REVISIONS_REQUIRED];

    switch (category) {
      case DisputeCategory.QUALITY:
        // Chất lượng: Phải có sản phẩm đềEđánh giá
        return submittedLike;

      case DisputeCategory.PAYMENT:
        // Thanh toán: Thường là khi đã nộp nhưng khách không trả tiền, hoặc đang làm mà khách không chịu giải ngân
        return [...submittedLike, MilestoneStatus.IN_PROGRESS];

      case DisputeCategory.DEADLINE:
        // TrềEhạn: Có thềEkiện ngay khi đang làm (nếu đã quá hạn) hoặc đã nộp nhưng trềE
        return [
          MilestoneStatus.IN_PROGRESS,
          MilestoneStatus.SUBMITTED,
          MilestoneStatus.REVISIONS_REQUIRED,
        ];

      case DisputeCategory.COMMUNICATION:
      case DisputeCategory.SCOPE_CHANGE:
      case DisputeCategory.CONTRACT:
      case DisputeCategory.FRAUD:
      case DisputeCategory.OTHER:
      default:
        // Các loại khác: Có thềExảy ra bất cứ lúc nào trong quá trình thực hiện
        return [MilestoneStatus.SUBMITTED, ...inProgressLike];
    }
  }

  /**
   * Xác định địa chềEví nhận tiền cho "Phía Client" và "Phía Freelancer".
   * Điều này quan trọng vì "Phía Client" không phải lúc nào cũng là Client của dự án (ví dụ: Broker kiện Freelancer).
   */
  private determineTransferRecipients(
    disputeType: DisputeType,
    project: ProjectEntity,
  ): { clientSideRecipient: string; freelancerSideRecipient: string } {
    let clientSideRecipient = project.clientId;
    let freelancerSideRecipient = project.freelancerId;

    switch (disputeType) {
      case DisputeType.CLIENT_VS_BROKER:
      case DisputeType.BROKER_VS_CLIENT:
        // Client vs Broker: Phía Freelancer thực chất là Broker
        freelancerSideRecipient = project.brokerId!;
        break;

      case DisputeType.BROKER_VS_FREELANCER:
      case DisputeType.FREELANCER_VS_BROKER:
        // Broker vs Freelancer: Phía Client thực chất là Broker
        clientSideRecipient = project.brokerId!;
        break;

      case DisputeType.CLIENT_VS_FREELANCER:
      case DisputeType.FREELANCER_VS_CLIENT:
      default:
        // Trường hợp chuẩn: Client vs Freelancer
        break;
    }

    if (!clientSideRecipient || !freelancerSideRecipient) {
      throw new Error('Cannot determine transfer recipients: Missing project members');
    }

    return { clientSideRecipient, freelancerSideRecipient };
  }

  /**
   * Xác định role của user trong project
   */
  private determineUserRole(userId: string, project: ProjectEntity): UserRole {
    if (userId === project.clientId) return UserRole.CLIENT;
    if (userId === project.freelancerId) return UserRole.FREELANCER;
    if (userId === project.brokerId) return UserRole.BROKER;
    throw new BadRequestException('User is not a member of this project');
  }

  /**
   * Xác định loại dispute dựa trên roles
   */
  private determineDisputeType(raiserRole: UserRole, defendantRole: UserRole): DisputeType {
    const typeMap: Record<string, DisputeType> = {
      CLIENT_FREELANCER: DisputeType.CLIENT_VS_FREELANCER,
      CLIENT_BROKER: DisputeType.CLIENT_VS_BROKER,
      FREELANCER_CLIENT: DisputeType.FREELANCER_VS_CLIENT,
      FREELANCER_BROKER: DisputeType.FREELANCER_VS_BROKER,
      BROKER_CLIENT: DisputeType.BROKER_VS_CLIENT,
      BROKER_FREELANCER: DisputeType.BROKER_VS_FREELANCER,
    };

    // Construct key from roles (e.g., "CLIENT_FREELANCER")
    const key = `${raiserRole}_${defendantRole}`;

    // Default to CLIENT_VS_FREELANCER if combination is unknown (e.g. Admin actions)
    return typeMap[key] || DisputeType.CLIENT_VS_FREELANCER;
  }

  /**
   * T?nh priority d?a tr?n s? ti?n v? category
   */
  private calculatePriority(
    amount: number,
    category?: DisputeCategory,
    currency: string = 'USD',
  ): DisputePriority {
    if (category === DisputeCategory.FRAUD) {
      return DisputePriority.CRITICAL;
    }

    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const normalizedCurrency = (currency || 'USD').toUpperCase();
    if (normalizedCurrency !== 'USD') {
      this.logger.warn(`Unsupported currency: ${currency}, falling back to USD thresholds`);
    }

    const thresholds = { low: 100, medium: 500, high: 2_000 };

    if (safeAmount <= thresholds.low) return DisputePriority.LOW;
    if (safeAmount <= thresholds.medium) return DisputePriority.MEDIUM;
    if (safeAmount <= thresholds.high) return DisputePriority.HIGH;
    return DisputePriority.CRITICAL;
  }

  private async autoAssignStaff(disputeId: string) {
    try {
      return await this.staffAssignmentService.autoAssignStaffToDispute(disputeId);
    } catch (error) {
      this.logger.warn(
        `Auto-assign staff failed for dispute ${disputeId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  private async checkInitialAvailability(
    dispute: DisputeEntity,
    project: ProjectEntity,
    staffId: string,
    durationMinutes?: number,
  ) {
    if (!staffId) {
      return null;
    }

    const participantIds = [dispute.raisedById, dispute.defendantId, staffId].filter(Boolean);
    if (participantIds.length === 0) {
      return null;
    }

    const rangeStart = new Date(Date.now() + DEFAULT_HEARING_MIN_NOTICE_HOURS * 60 * 60 * 1000);
    const rangeEnd = this.addDays(rangeStart, DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS);
    const userTimezones = await this.resolveUserTimezones(participantIds);

    return this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes: durationMinutes || DEFAULT_HEARING_DURATION_MINUTES,
      dateRange: { start: rangeStart, end: rangeEnd },
      userTimezones,
    });
  }

  private async resolveUserTimezones(userIds: string[]): Promise<Record<string, string>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return {};
    }

    const users = await this.userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'timeZone'],
    });

    const map: Record<string, string> = {};
    users.forEach((user) => {
      map[user.id] = user.timeZone || 'UTC';
    });

    uniqueIds.forEach((id) => {
      if (!map[id]) {
        map[id] = 'UTC';
      }
    });

    return map;
  }

  private async logActivity(
    queryRunner: QueryRunner,
    disputeId: string,
    actorId: string,
    actorRole: UserRole,
    action: DisputeAction,
    description: string,
    metadata?: Record<string, unknown>,
    isInternal: boolean = false,
  ): Promise<DisputeActivityEntity> {
    const activity = queryRunner.manager.create(DisputeActivityEntity, {
      disputeId,
      actorId,
      actorRole,
      action,
      description,
      metadata,
      isInternal,
    });
    return queryRunner.manager.save(DisputeActivityEntity, activity);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}


