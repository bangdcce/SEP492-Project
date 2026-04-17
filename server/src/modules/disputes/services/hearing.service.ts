// ============================================================================
// HEARING SERVICE - Dispute Hearing Management
// ============================================================================
// Handles hearing scheduling, participant management, and live chat control
// Edge Cases Addressed:
// - Emergency Hearing (bypass 24h rule)
// - Required Participants (Broker, Supervisor)
// - Auto-Mute on Moderator Disconnect
// ============================================================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, LessThan, Between, DataSource, Brackets } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { normalizeContractPdfUrl } from '../../../common/utils/contract-pdf-url.util';
import { normalizeExternalMeetingLink } from '../../../common/utils/external-meeting-link.util';

// Entities
import {
  DisputeEntity,
  DisputeStatus,
  DisputePhase,
} from '../../../database/entities/dispute.entity';
import {
  DisputeAction,
  DisputeActivityEntity,
} from '../../../database/entities/dispute-activity.entity';
import {
  DisputePartyEntity,
  DisputePartySide,
} from '../../../database/entities/dispute-party.entity';
import { ProjectEntity } from '../../../database/entities/project.entity';
import { ProjectSpecEntity } from '../../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../../database/entities/milestone.entity';
import { ContractEntity } from '../../../database/entities/contract.entity';
import {
  DisputeMessageEntity,
  MessageType,
} from '../../../database/entities/dispute-message.entity';
import { DisputeInternalMembershipEntity } from '../../../database/entities/dispute-internal-membership.entity';
import { UserEntity, UserRole } from '../../../database/entities/user.entity';
import {
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingParticipantRole,
  HearingStatementEntity,
  HearingStatementContentBlock,
  HearingStatementStatus,
  HearingStatementType,
  HearingStatementVersionSnapshot,
  HearingQuestionEntity,
  HearingQuestionStatus,
  HearingStatus,
  HearingTier,
  SpeakerRole,
} from '../../../database/entities/dispute-hearing.entity';
import {
  CalendarEventEntity,
  EventType,
  EventStatus,
} from '../../../database/entities/calendar-event.entity';
import {
  EventParticipantEntity,
  ParticipantRole,
  ParticipantStatus,
  AttendanceStatus,
} from '../../../database/entities/event-participant.entity';
import {
  UserAvailabilityEntity,
  AvailabilityType,
} from '../../../database/entities/user-availability.entity';
import { NotificationEntity } from '../../../database/entities/notification.entity';
import {
  HearingReminderDeliveryEntity,
  HearingReminderType,
} from '../../../database/entities/hearing-reminder-delivery.entity';
import { EmailService } from '../../auth/email.service';
import { HearingPresenceService } from './hearing-presence.service';
import { EvidenceService } from './evidence.service';
import { buildHearingDocket, isDisputeClosedStatus } from '../dispute-docket';
import {
  buildDefaultFollowUpAction,
  normalizeDisputeFollowUpActionInput,
  type NormalizedDisputeFollowUpAction,
} from '../dispute-follow-up';
import { CalendarService } from '../../calendar/calendar.service';
import {
  ScheduleHearingDto,
  RescheduleHearingDto,
  SubmitHearingStatementDto,
  AskHearingQuestionDto,
  EndHearingDto,
  ExtendHearingDto,
  InviteSupportStaffDto,
  ResolveObjectionDto,
} from '../dto/hearing.dto';

// =============================================================================
// INTERFACES
// =============================================================================

export interface HearingScheduleValidation {
  valid: boolean;
  conflicts: string[];
  warnings: string[];
  conflictDetails: HearingScheduleConflictDetail[];
  isEmergency?: boolean;
  requiresAdminApproval?: boolean;
}

export type HearingScheduleConflictSourceType = 'CALENDAR_EVENT' | 'AVAILABILITY_BLOCK' | 'RULE';

export interface HearingScheduleConflictDetail {
  sourceType: HearingScheduleConflictSourceType;
  blockingType: string;
  startTime: Date;
  endTime: Date;
  userId?: string;
  eventId?: string;
  availabilityId?: string;
  title?: string;
}

export interface HearingParticipantConfirmationSummary {
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
  hasModeratorAccepted: boolean;
  primaryPartyAcceptedCount: number;
  primaryPartyPendingCount: number;
  primaryPartyDeclinedCount: number;
  confirmedPrimaryRoles: HearingParticipantRole[];
  confirmationSatisfied: boolean;
  participants: Array<{
    userId: string;
    role: ParticipantRole;
    status: ParticipantStatus;
    isRequired: boolean;
    caseRole?: HearingParticipantRole | null;
    respondedAt?: Date;
    responseDeadline?: Date;
  }>;
}

export interface RequiredParticipant {
  userId: string;
  role: HearingParticipantRole;
  isRequired: boolean;
  userRole: UserRole; // Original user role in system
  relationToProject: string; // 'raiser', 'defendant', 'broker', 'supervisor', etc.
}

export interface DetermineParticipantsResult {
  participants: RequiredParticipant[];
  warnings: string[];
  hasBroker: boolean;
  hasSupervisor: boolean;
}

export interface SpeakerControlCheck {
  canControl: boolean;
  reason?: string;
  currentSpeakerRole: SpeakerRole;
  moderatorOnline: boolean;
  suggestedAction?: 'CONTINUE' | 'AUTO_MUTE' | 'WAIT_MODERATOR';
}

export interface ChatPermissionResult {
  allowed: boolean;
  reason?: string;
  hearing: DisputeHearingEntity;
  participantRole?: HearingParticipantRole;
  effectiveSpeakerRole: SpeakerRole;
  gracePeriodUntil?: Date;
}

export interface HearingWorkspacePermissions {
  canSendMessage: boolean;
  sendMessageBlockedReason?: string;
  canUploadEvidence: boolean;
  uploadEvidenceBlockedReason?: string;
  canAttachEvidenceLink: boolean;
  attachEvidenceBlockedReason?: string;
  canManageEvidenceIntake?: boolean;
  manageEvidenceIntakeBlockedReason?: string;
}

export interface HearingPhaseGateStatus {
  requiredRole: HearingParticipantRole;
  requiredCount: number;
  submittedCount: number;
  canTransition: boolean;
  missingParticipants: Array<{
    participantId: string;
    userId: string;
    displayName: string;
  }>;
  reason?: string;
}

export interface HearingEvidenceAttachPermissionResult {
  allowed: boolean;
  reason?: string;
  hearing: Pick<
    DisputeHearingEntity,
    'id' | 'disputeId' | 'status' | 'isChatRoomActive' | 'moderatorId'
  >;
}

export type HearingLifecycleFilter = 'active' | 'archived' | 'all';
export type HearingLifecycle = 'ACTIVE' | 'ARCHIVED';
type HearingEndedByType = 'USER' | 'SYSTEM';
type HearingClosureReason =
  | 'MANUAL_CLOSE'
  | 'TIME_LIMIT_REACHED'
  | 'PAUSE_ABANDONED'
  | 'SCHEDULED_EXPIRED';
type HearingTimeWarningType =
  | 'SCHEDULE_END_WARNING'
  | 'GRACE_PERIOD_WARNING'
  | 'PAUSE_AUTO_CLOSE_WARNING';

interface HearingTimebox {
  scheduledEndAt: Date;
  graceEndsAt: Date;
  pauseAutoCloseAt: Date | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HEARING_CONFIG = {
  // Minimum notice period (hours)
  MIN_NOTICE_HOURS: 24,
  EMERGENCY_MIN_NOTICE_HOURS: 1, // For emergency hearings

  // Invitation response deadline
  CONFIRMATION_TIMEOUT_HOURS: 12,
  MIN_CONFIRMATION_BEFORE_START_HOURS: 2,
  RESCHEDULE_FREEZE_HOURS: 24,

  // Reschedule limits
  MAX_RESCHEDULES: 2,

  // Moderator offline threshold (minutes)
  MODERATOR_OFFLINE_THRESHOLD: 5,

  // Early start & attendance
  EARLY_START_BUFFER_MINUTES: 15,
  MIN_ATTENDANCE_RATIO: 0.5,

  // Speaker control grace period
  SPEAKER_GRACE_PERIOD_MS: 5000,

  // Auto-close lifecycle
  AUTO_CLOSE_WARNING_MINUTES: 15,
  AUTO_CLOSE_FINAL_WARNING_MINUTES: 5,
  AUTO_CLOSE_GRACE_MINUTES: 15,
  PAUSE_AUTO_CLOSE_MINUTES: 30,
} as const;

const resolveShortReminderLeadMinutes = (): number => {
  const parsed = Number(process.env.HEARING_REMINDER_SHORT_LEAD_MINUTES ?? '5');
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.min(60, Math.max(1, Math.round(parsed)));
};

const HEARING_SHORT_REMINDER_LEAD_MINUTES = resolveShortReminderLeadMinutes();

const HEARING_REMINDER_WINDOWS = [
  { type: HearingReminderType.T72H, minutesBefore: 72 * 60 },
  { type: HearingReminderType.T24H, minutesBefore: 24 * 60 },
  { type: HearingReminderType.T1H, minutesBefore: 60 },
  { type: HearingReminderType.T10M, minutesBefore: HEARING_SHORT_REMINDER_LEAD_MINUTES },
] as const;
const HEARING_REMINDER_DISPATCH_GRACE_MINUTES = 2;
const HEARING_DISPLAY_TIMEZONE = 'Asia/Ho_Chi_Minh';
const HEARING_DISPLAY_TIMEZONE_OFFSET_LABEL = 'UTC+07:00';
const ACTIVE_HEARING_STATUSES = new Set<HearingStatus>([
  HearingStatus.SCHEDULED,
  HearingStatus.IN_PROGRESS,
  HearingStatus.PAUSED,
]);
const APPEAL_DISPUTE_STATUSES = new Set<DisputeStatus>([
  DisputeStatus.APPEALED,
  DisputeStatus.REJECTION_APPEALED,
]);
const HEARING_PHASE_SEQUENCE: DisputePhase[] = [
  DisputePhase.PRESENTATION,
  DisputePhase.EVIDENCE_SUBMISSION,
  DisputePhase.CROSS_EXAMINATION,
  DisputePhase.INTERROGATION,
  DisputePhase.DELIBERATION,
];
const AUTO_CLOSE_SUMMARY_PREFIX = 'System auto-close:';
const TIME_LIMIT_REACHED_SUMMARY = `${AUTO_CLOSE_SUMMARY_PREFIX} The hearing reached its scheduled duration and grace period without a manual close or verdict.`;
const PAUSE_ABANDONED_SUMMARY = `${AUTO_CLOSE_SUMMARY_PREFIX} The hearing remained paused beyond the allowed timeout and was closed as abandoned.`;
const SCHEDULED_EXPIRED_SUMMARY = `${AUTO_CLOSE_SUMMARY_PREFIX} The hearing passed its scheduled start and grace window without being started, so it was closed for follow-up review.`;
const FOLLOW_UP_FINDINGS =
  'No verdict was issued during this session. The dispute remains open for a follow-up hearing.';
const SCHEDULED_EXPIRED_FINDINGS =
  'The scheduled hearing did not start before the grace window elapsed. Review attendance, confirmations, and reschedule if the dispute still requires a live session.';
const PENDING_CONFIRMATION_TIMEOUT_SUMMARY = `${AUTO_CLOSE_SUMMARY_PREFIX} Required confirmations did not arrive before the hearing window, so the session was canceled and flagged for manual review.`;
const PENDING_CONFIRMATION_TIMEOUT_FINDINGS =
  'The hearing remained blocked in confirmation handling and now requires manual staff/admin review before another slot is scheduled.';
const DEFAULT_FOLLOW_UP_PENDING_ACTIONS: NormalizedDisputeFollowUpAction[] = [
  buildDefaultFollowUpAction('REQUEST_MORE_EVIDENCE', {
    note: 'Review the hearing record and pending evidence before the next session.',
  }),
  buildDefaultFollowUpAction('SCHEDULE_FOLLOW_UP_HEARING', {
    note: 'Continue the dispute in the next scheduled hearing unless a verdict is issued earlier.',
  }),
];

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class HearingService implements OnModuleInit {
  private readonly logger = new Logger(HearingService.name);
  private readonly speakerGracePeriod = new Map<
    string,
    { previousRole: SpeakerRole; expiresAtMs: number }
  >();

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
    @InjectRepository(DisputePartyEntity)
    private readonly disputePartyRepository: Repository<DisputePartyEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepository: Repository<DisputeHearingEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly participantRepository: Repository<HearingParticipantEntity>,
    @InjectRepository(HearingStatementEntity)
    private readonly statementRepository: Repository<HearingStatementEntity>,
    @InjectRepository(HearingQuestionEntity)
    private readonly questionRepository: Repository<HearingQuestionEntity>,
    @InjectRepository(EventParticipantEntity)
    private readonly eventParticipantRepository: Repository<EventParticipantEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectSpecEntity)
    private readonly projectSpecRepository: Repository<ProjectSpecEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(ContractEntity)
    private readonly contractRepository: Repository<ContractEntity>,
    @InjectRepository(DisputeMessageEntity)
    private readonly messageRepository: Repository<DisputeMessageEntity>,
    @InjectRepository(DisputeInternalMembershipEntity)
    private readonly internalMembershipRepository: Repository<DisputeInternalMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(HearingReminderDeliveryEntity)
    private readonly reminderDeliveryRepository: Repository<HearingReminderDeliveryEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
    private readonly hearingPresenceService: HearingPresenceService,
    private readonly evidenceService: EvidenceService,
    private readonly calendarService: CalendarService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const staleResult = await this.participantRepository
        .createQueryBuilder()
        .update(HearingParticipantEntity)
        .set({ isOnline: false })
        .where('isOnline = :online', { online: true })
        .execute();
      if (staleResult.affected && staleResult.affected > 0) {
        this.logger.log(
          `Cleaned up ${staleResult.affected} stale online participant(s) on startup`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to clean stale online participants: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private getElapsedPauseSeconds(
    hearing: Pick<DisputeHearingEntity, 'status' | 'pausedAt'>,
  ): number {
    if (hearing.status !== HearingStatus.PAUSED || !hearing.pausedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - hearing.pausedAt.getTime()) / 1000));
  }

  private getTotalPauseSeconds(
    hearing: Pick<DisputeHearingEntity, 'status' | 'pausedAt' | 'accumulatedPauseSeconds'>,
  ): number {
    const base = hearing.accumulatedPauseSeconds || 0;
    return base + this.getElapsedPauseSeconds(hearing);
  }

  private normalizeMeetingLink(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }

    const normalized = normalizeExternalMeetingLink(trimmed);
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_EXTERNAL_MEETING_LINK',
        message:
          'External meeting link must be a valid URL. Google Meet links must use a code like abc-defg-hij.',
      });
    }

    return normalized;
  }

  private getTimeboxAnchor(hearing: Pick<DisputeHearingEntity, 'scheduledAt' | 'startedAt'>): Date {
    return hearing.startedAt || hearing.scheduledAt;
  }

  private buildHearingTimebox(
    hearing: Pick<
      DisputeHearingEntity,
      | 'scheduledAt'
      | 'startedAt'
      | 'estimatedDurationMinutes'
      | 'status'
      | 'pausedAt'
      | 'accumulatedPauseSeconds'
    >,
  ): HearingTimebox {
    const anchor = this.getTimeboxAnchor(hearing);
    const durationMinutes = Math.max(hearing.estimatedDurationMinutes || 60, 1);
    const effectivePauseSeconds = this.getTotalPauseSeconds(hearing);
    const scheduledEndAt = new Date(
      anchor.getTime() + durationMinutes * 60_000 + effectivePauseSeconds * 1000,
    );
    const graceEndsAt = new Date(
      scheduledEndAt.getTime() + HEARING_CONFIG.AUTO_CLOSE_GRACE_MINUTES * 60_000,
    );
    const pauseAutoCloseAt =
      hearing.status === HearingStatus.PAUSED && hearing.pausedAt
        ? new Date(hearing.pausedAt.getTime() + HEARING_CONFIG.PAUSE_AUTO_CLOSE_MINUTES * 60_000)
        : null;

    return {
      scheduledEndAt,
      graceEndsAt,
      pauseAutoCloseAt,
    };
  }

  private deriveClosureReason(
    hearing: Pick<DisputeHearingEntity, 'summary' | 'status'>,
  ): HearingClosureReason | null {
    if (
      ![HearingStatus.COMPLETED, HearingStatus.CANCELED].includes(hearing.status) ||
      !hearing.summary
    ) {
      return null;
    }

    if (hearing.summary === TIME_LIMIT_REACHED_SUMMARY) {
      return 'TIME_LIMIT_REACHED';
    }

    if (hearing.summary === PAUSE_ABANDONED_SUMMARY) {
      return 'PAUSE_ABANDONED';
    }

    if (hearing.summary === SCHEDULED_EXPIRED_SUMMARY) {
      return 'SCHEDULED_EXPIRED';
    }

    return null;
  }

  private buildSystemClosureMinutes(
    reason: Exclude<HearingClosureReason, 'MANUAL_CLOSE'>,
  ): Pick<EndHearingDto, 'summary' | 'findings' | 'pendingActions' | 'forceEnd' | 'noShowNote'> {
    return {
      summary:
        reason === 'PAUSE_ABANDONED'
          ? PAUSE_ABANDONED_SUMMARY
          : reason === 'SCHEDULED_EXPIRED'
            ? SCHEDULED_EXPIRED_SUMMARY
            : TIME_LIMIT_REACHED_SUMMARY,
      findings: reason === 'SCHEDULED_EXPIRED' ? SCHEDULED_EXPIRED_FINDINGS : FOLLOW_UP_FINDINGS,
      pendingActions: DEFAULT_FOLLOW_UP_PENDING_ACTIONS,
      forceEnd: true,
      noShowNote: undefined,
    };
  }

  private isScheduledHearingStale(
    hearing: Pick<
      DisputeHearingEntity,
      | 'status'
      | 'scheduledAt'
      | 'startedAt'
      | 'estimatedDurationMinutes'
      | 'pausedAt'
      | 'accumulatedPauseSeconds'
    >,
    referenceAt: Date = new Date(),
  ): boolean {
    if (hearing.status !== HearingStatus.SCHEDULED) {
      return false;
    }

    const timebox = this.buildHearingTimebox(hearing);
    return referenceAt.getTime() >= timebox.graceEndsAt.getTime();
  }

  private buildWarningCopy(
    warningType: HearingTimeWarningType,
    hearing: Pick<DisputeHearingEntity, 'hearingNumber'>,
    minutesRemaining: number,
  ): { title: string; body: string } {
    const hearingLabel = `Hearing #${hearing.hearingNumber || 1}`;

    switch (warningType) {
      case 'GRACE_PERIOD_WARNING':
        return {
          title: 'Hearing auto-close warning',
          body: `${hearingLabel} will auto-close in about ${minutesRemaining} minutes unless it is ended, extended, or resolved with a verdict.`,
        };
      case 'PAUSE_AUTO_CLOSE_WARNING':
        return {
          title: 'Paused hearing auto-close warning',
          body: `${hearingLabel} has been paused too long and will auto-close in about ${minutesRemaining} minutes unless it is resumed.`,
        };
      default:
        return {
          title: 'Hearing ending soon',
          body: `${hearingLabel} is close to its scheduled end and should be wrapped up within about ${minutesRemaining} minutes.`,
        };
    }
  }

  private async createNotificationOnce(input: {
    userId: string;
    title: string;
    body: string;
    relatedType?: string;
    relatedId?: string;
  }): Promise<NotificationEntity | null> {
    const existing = await this.notificationRepository.findOne({
      where: {
        userId: input.userId,
        title: input.title,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
      select: ['id'],
    });

    if (existing) {
      return null;
    }

    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: input.userId,
        title: input.title,
        body: input.body,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      }),
    );
    this.eventEmitter.emit('notification.created', { notification });
    return notification;
  }

  private async emitTimeWarningIfNeeded(
    hearing: Pick<DisputeHearingEntity, 'id' | 'disputeId' | 'hearingNumber'>,
    warningType: HearingTimeWarningType,
    minutesRemaining: number,
    participantIds: string[],
    timebox: HearingTimebox,
  ): Promise<boolean> {
    if (participantIds.length === 0) {
      return false;
    }

    const { title, body } = this.buildWarningCopy(warningType, hearing, minutesRemaining);
    let delivered = false;

    for (const userId of participantIds) {
      const notification = await this.createNotificationOnce({
        userId,
        title,
        body,
        relatedType: 'DisputeHearing',
        relatedId: hearing.id,
      });
      if (notification) {
        delivered = true;
      }
    }

    if (delivered) {
      this.eventEmitter.emit('hearing.timeWarning', {
        hearingId: hearing.id,
        disputeId: hearing.disputeId,
        warningType,
        minutesRemaining,
        participantIds,
        scheduledEndAt: timebox.scheduledEndAt,
        graceEndsAt: timebox.graceEndsAt,
        pauseAutoCloseAt: timebox.pauseAutoCloseAt,
      });
    }

    return delivered;
  }

  private async buildDocketForDispute(disputeId: string, disputeStatus?: DisputeStatus | null) {
    const hearings = await this.hearingRepository.find({
      where: { disputeId },
      select: [
        'id',
        'disputeId',
        'status',
        'scheduledAt',
        'agenda',
        'previousHearingId',
        'hearingNumber',
        'tier',
        'summary',
        'findings',
        'noShowNote',
        'externalMeetingLink',
      ],
      order: {
        hearingNumber: 'ASC',
        scheduledAt: 'ASC',
      },
    });

    let effectiveDisputeStatus = disputeStatus;
    if (!effectiveDisputeStatus) {
      const dispute = await this.disputeRepository.findOne({
        where: { id: disputeId },
        select: ['id', 'status'],
      });
      effectiveDisputeStatus = dispute?.status;
    }

    return buildHearingDocket(hearings, effectiveDisputeStatus);
  }

  private async assertHearingIsActionable(
    hearing: Pick<DisputeHearingEntity, 'id' | 'disputeId' | 'tier'> & {
      dispute?: Pick<DisputeEntity, 'status'> | null;
    },
  ): Promise<void> {
    const docketEntry = await this.getHearingDocketEntry(hearing);

    if (!docketEntry?.isActionable) {
      throw new BadRequestException({
        code: 'HEARING_DOCKET_FROZEN',
        message:
          docketEntry?.freezeReason ||
          'This hearing is no longer actionable. Review the latest docket entry for this dispute.',
      });
    }
  }

  private async getHearingDocketEntry(
    hearing: Pick<DisputeHearingEntity, 'id' | 'disputeId' | 'tier'> & {
      dispute?: Pick<DisputeEntity, 'status'> | null;
    },
  ) {
    const docket = await this.buildDocketForDispute(hearing.disputeId, hearing.dispute?.status);
    return docket.items.find((item) => item.hearingId === hearing.id);
  }

  private resolveHearingLifecycle(
    hearing: Pick<
      DisputeHearingEntity,
      | 'status'
      | 'tier'
      | 'scheduledAt'
      | 'startedAt'
      | 'estimatedDurationMinutes'
      | 'pausedAt'
      | 'accumulatedPauseSeconds'
    > & {
      dispute?: Pick<DisputeEntity, 'status'> | null;
    },
  ): HearingLifecycle {
    if (
      hearing.tier === HearingTier.TIER_1 &&
      hearing.dispute?.status &&
      APPEAL_DISPUTE_STATUSES.has(hearing.dispute.status)
    ) {
      return 'ARCHIVED';
    }

    if (this.isScheduledHearingStale(hearing)) {
      return 'ARCHIVED';
    }

    return ACTIVE_HEARING_STATUSES.has(hearing.status) ? 'ACTIVE' : 'ARCHIVED';
  }

  private applyLifecycleFilter<
    T extends Pick<
      DisputeHearingEntity,
      | 'status'
      | 'tier'
      | 'scheduledAt'
      | 'startedAt'
      | 'estimatedDurationMinutes'
      | 'pausedAt'
      | 'accumulatedPauseSeconds'
    > & {
      dispute?: Pick<DisputeEntity, 'status'> | null;
    },
  >(hearings: T[], lifecycle: HearingLifecycleFilter = 'all'): T[] {
    if (lifecycle === 'all') {
      return hearings;
    }

    return hearings.filter((hearing) => {
      const hearingLifecycle = this.resolveHearingLifecycle(hearing);
      return lifecycle === 'active'
        ? hearingLifecycle === 'ACTIVE'
        : hearingLifecycle === 'ARCHIVED';
    });
  }

  private async expireScheduledHearing(
    hearing: Pick<
      DisputeHearingEntity,
      | 'id'
      | 'disputeId'
      | 'status'
      | 'scheduledAt'
      | 'startedAt'
      | 'estimatedDurationMinutes'
      | 'moderatorId'
      | 'pausedAt'
      | 'pausedById'
      | 'pauseReason'
      | 'accumulatedPauseSeconds'
      | 'speakerRoleBeforePause'
      | 'isEvidenceIntakeOpen'
      | 'tier'
    >,
    referenceAt: Date,
    blockedReason: string,
  ): Promise<void> {
    const closureMinutes = this.buildSystemClosureMinutes('SCHEDULED_EXPIRED');
    const calendarEvent = await this.calendarRepository.findOne({
      where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
      select: ['id', 'metadata'],
    });

    if (calendarEvent) {
      await this.calendarRepository.update(calendarEvent.id, {
        status: EventStatus.CANCELLED,
        metadata: {
          ...(calendarEvent.metadata || {}),
          autoExpiredAt: referenceAt.toISOString(),
          autoExpiredReason: blockedReason,
        },
      });
    }

    await this.hearingRepository.update(hearing.id, {
      status: HearingStatus.CANCELED,
      endedAt: referenceAt,
      isChatRoomActive: false,
      currentSpeakerRole: SpeakerRole.MUTED_ALL,
      isEvidenceIntakeOpen: false,
      evidenceIntakeClosedAt: hearing.isEvidenceIntakeOpen ? referenceAt : null,
      accumulatedPauseSeconds: this.getTotalPauseSeconds(hearing),
      pausedAt: null,
      pausedById: null,
      pauseReason: null,
      speakerRoleBeforePause: null,
      summary: closureMinutes.summary,
      findings: closureMinutes.findings,
      pendingActions: closureMinutes.pendingActions,
      noShowNote:
        'System-generated note: the hearing expired before it could be started. ' +
        `Blocked reason: ${blockedReason}.`,
    });

    this.eventEmitter.emit('hearing.ended', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      endedById: null,
      endedByType: 'SYSTEM',
      closureReason: 'SCHEDULED_EXPIRED',
      cancelledQuestions: [],
      absentParticipants: [],
    });
  }

  // ===========================================================================
  // UNIT FUNCTION: validateHearingSchedule()
  // ===========================================================================

  /**
   * Validate hearing schedule with conflict detection
   *
   * EDGE CASE ADDRESSED: "Emergency Hearing"
   * - If isEmergency = true -> Skip 24h rule (but require Admin approval)
   * - Check all participants' availability
   * - Detect double-booking
   *
   * @param scheduledAt - Proposed hearing time
   * @param participantIds - List of required participant user IDs
   * @param isEmergency - If true, bypass 24h minimum notice rule
   * @param durationMinutes - Expected duration
   */
  async validateHearingSchedule(
    scheduledAt: Date,
    participantIds: string[],
    isEmergency: boolean = false,
    durationMinutes: number = 60,
    options?: {
      bypassMinNotice?: boolean;
      excludeCalendarEventIds?: string[];
      excludeDisputeHearingId?: string;
    },
  ): Promise<HearingScheduleValidation> {
    const conflicts: string[] = [];
    const warnings: string[] = [];
    const conflictDetails: HearingScheduleConflictDetail[] = [];
    const now = new Date();
    const bypassMinNotice = options?.bypassMinNotice === true;
    const excludeCalendarEventIds = new Set(
      (options?.excludeCalendarEventIds || []).filter((id): id is string => Boolean(id)),
    );
    const excludeDisputeHearingId = options?.excludeDisputeHearingId?.trim();
    const shouldExcludeEvent = (event: CalendarEventEntity): boolean => {
      if (excludeCalendarEventIds.has(event.id)) {
        return true;
      }
      return (
        Boolean(excludeDisputeHearingId) &&
        event.referenceType === 'DisputeHearing' &&
        event.referenceId === excludeDisputeHearingId
      );
    };

    // 1. Check minimum notice period
    const hoursUntilHearing = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (bypassMinNotice) {
      warnings.push('Dispute test mode bypass applied: minimum notice checks skipped.');
    } else if (isEmergency) {
      if (hoursUntilHearing < HEARING_CONFIG.EMERGENCY_MIN_NOTICE_HOURS) {
        conflicts.push(
          `Emergency hearings require at least ${HEARING_CONFIG.EMERGENCY_MIN_NOTICE_HOURS} hour notice`,
        );
        conflictDetails.push({
          sourceType: 'RULE',
          blockingType: 'EMERGENCY_MIN_NOTICE',
          startTime: now,
          endTime: scheduledAt,
        });
      }
      warnings.push('Emergency hearing: Requires Admin approval to bypass 24h rule');
    } else if (hoursUntilHearing < HEARING_CONFIG.MIN_NOTICE_HOURS) {
      conflicts.push(
        `Hearings require at least ${HEARING_CONFIG.MIN_NOTICE_HOURS} hours notice. ` +
          `Use isEmergency=true for urgent cases (requires Admin approval).`,
      );
      conflictDetails.push({
        sourceType: 'RULE',
        blockingType: 'MIN_NOTICE',
        startTime: now,
        endTime: scheduledAt,
      });
    }

    // 2. Check if scheduled in the past
    if (scheduledAt <= now) {
      conflicts.push('Cannot schedule hearing in the past');
      conflictDetails.push({
        sourceType: 'RULE',
        blockingType: 'PAST_TIME',
        startTime: scheduledAt,
        endTime: scheduledAt,
      });
    }

    // 3. Check each participant's availability
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
    const normalizedParticipantIds = Array.from(new Set(participantIds.filter(Boolean)));
    const participants = normalizedParticipantIds.length
      ? await this.userRepository.find({
          where: { id: In(normalizedParticipantIds) },
          select: ['id', 'email'],
        })
      : [];
    const userEmailById = new Map(participants.map((user) => [user.id, user.email]));
    const conflictStatuses = [
      EventStatus.SCHEDULED,
      EventStatus.PENDING_CONFIRMATION,
      EventStatus.IN_PROGRESS,
    ];
    const blockingAvailabilityTypes = [
      AvailabilityType.BUSY,
      AvailabilityType.OUT_OF_OFFICE,
      AvailabilityType.DO_NOT_DISTURB,
    ];

    for (const participantId of normalizedParticipantIds) {
      const userLabel = userEmailById.get(participantId) || participantId;

      const organizerEvents = await this.calendarRepository.find({
        where: {
          organizerId: participantId,
          startTime: LessThan(endTime),
          endTime: MoreThan(scheduledAt),
          status: In(conflictStatuses),
        },
      });

      const participantEventLinks = await this.eventParticipantRepository
        .createQueryBuilder('participant')
        .innerJoinAndSelect('participant.event', 'event')
        .where('participant.userId = :participantId', { participantId })
        .andWhere('event.startTime < :endTime', { endTime })
        .andWhere('event.endTime > :scheduledAt', { scheduledAt })
        .andWhere('event.status IN (:...statuses)', { statuses: conflictStatuses })
        .getMany();

      const participantEvents = participantEventLinks
        .map((link) => link.event as CalendarEventEntity | null)
        .filter((event): event is CalendarEventEntity => Boolean(event));

      const allConflictingEvents = Array.from(
        new Map(
          [...organizerEvents, ...participantEvents].map((event) => [event.id, event]),
        ).values(),
      ).filter((event) => !shouldExcludeEvent(event));

      if (allConflictingEvents.length > 0) {
        const eventTitles = allConflictingEvents.map((event) => event.title).join(', ');
        conflicts.push(`User ${userLabel} has conflicting event(s): ${eventTitles}`);

        allConflictingEvents.forEach((event) => {
          conflictDetails.push({
            sourceType: 'CALENDAR_EVENT',
            blockingType: event.status,
            startTime: event.startTime,
            endTime: event.endTime,
            userId: participantId,
            eventId: event.id,
            title: event.title,
          });
        });
      }

      const oneTimeAvailability = await this.availabilityRepository.find({
        where: {
          userId: participantId,
          isRecurring: false,
          startTime: LessThan(endTime),
          endTime: MoreThan(scheduledAt),
          type: In(blockingAvailabilityTypes),
        },
      });

      const recurringAvailability = await this.availabilityRepository.find({
        where: {
          userId: participantId,
          isRecurring: true,
          dayOfWeek: scheduledAt.getDay(),
          type: In(blockingAvailabilityTypes),
        },
      });

      const recurringBlocks = recurringAvailability
        .map((availability) =>
          this.resolveRecurringAvailabilityWindow({
            availability,
            referenceDate: scheduledAt,
          }),
        )
        .filter(
          (
            item,
          ): item is {
            availability: UserAvailabilityEntity;
            startTime: Date;
            endTime: Date;
          } => Boolean(item),
        )
        .filter((item) => item.startTime < endTime && item.endTime > scheduledAt);

      if (oneTimeAvailability.length > 0 || recurringBlocks.length > 0) {
        conflicts.push(`User ${userLabel} has blocked availability in this time range`);

        oneTimeAvailability.forEach((availability) => {
          conflictDetails.push({
            sourceType: 'AVAILABILITY_BLOCK',
            blockingType: availability.type,
            startTime: availability.startTime,
            endTime: availability.endTime,
            userId: participantId,
            availabilityId: availability.id,
            title: availability.note || undefined,
          });
        });

        recurringBlocks.forEach((item) => {
          conflictDetails.push({
            sourceType: 'AVAILABILITY_BLOCK',
            blockingType: item.availability.type,
            startTime: item.startTime,
            endTime: item.endTime,
            userId: participantId,
            availabilityId: item.availability.id,
            title: item.availability.note || undefined,
          });
        });
      }
    }

    // 4. Check working hours (optional - add warning for outside hours)
    const hours = scheduledAt.getHours();
    if (hours < 8 || hours >= 18) {
      warnings.push('Hearing is scheduled outside normal working hours (8:00-18:00)');
    }

    // 5. Check weekend
    const dayOfWeek = scheduledAt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push('Hearing is scheduled on a weekend');
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      warnings,
      conflictDetails,
      isEmergency,
      requiresAdminApproval: isEmergency,
    };
  }

  private resolveRecurringAvailabilityWindow(input: {
    availability: UserAvailabilityEntity;
    referenceDate: Date;
  }): {
    availability: UserAvailabilityEntity;
    startTime: Date;
    endTime: Date;
  } | null {
    const { availability, referenceDate } = input;
    if (!availability.recurringStartTime || !availability.recurringEndTime) {
      return null;
    }

    const referenceDay = new Date(referenceDate);
    referenceDay.setHours(0, 0, 0, 0);

    if (availability.recurringStartDate) {
      const recurringStartDate = new Date(availability.recurringStartDate);
      recurringStartDate.setHours(0, 0, 0, 0);
      if (referenceDay < recurringStartDate) {
        return null;
      }
    }

    if (availability.recurringEndDate) {
      const recurringEndDate = new Date(availability.recurringEndDate);
      recurringEndDate.setHours(23, 59, 59, 999);
      if (referenceDay > recurringEndDate) {
        return null;
      }
    }

    const parseTime = (
      value: string,
    ): { hours: number; minutes: number; seconds: number } | null => {
      const [hourRaw, minuteRaw, secondRaw] = value.split(':');
      const hours = Number(hourRaw);
      const minutes = Number(minuteRaw ?? '0');
      const seconds = Number(secondRaw ?? '0');
      if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) {
        return null;
      }
      return { hours, minutes, seconds };
    };

    const startTimeParts = parseTime(availability.recurringStartTime);
    const endTimeParts = parseTime(availability.recurringEndTime);
    if (!startTimeParts || !endTimeParts) {
      return null;
    }

    const startTime = new Date(referenceDate);
    startTime.setHours(startTimeParts.hours, startTimeParts.minutes, startTimeParts.seconds, 0);

    const endTime = new Date(referenceDate);
    endTime.setHours(endTimeParts.hours, endTimeParts.minutes, endTimeParts.seconds, 0);
    if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    return {
      availability,
      startTime,
      endTime,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTION: determineRequiredParticipants()
  // ===========================================================================

  /**
   * Determine who must participate in a hearing
   *
   * EDGE CASE ADDRESSED: "Missing Key Stakeholders"
   * - Include Broker (if exists) as WITNESS - they know the Spec best
   * - Include Supervisor (if project has one) as WITNESS
   * - Only include people related to the project
   *
   * Algorithm:
   * 1. Add Raiser & Defendant (REQUIRED)
   * 2. Query Project:
   *    - If has Broker -> Add Broker (WITNESS - REQUIRED)
   *    - If has Freelancer (and not already included) -> Add as relevant party
   * 3. Tier Check:
   *    - If Tier 2 -> Add Admin (MODERATOR)
   *
   * @param dispute - The dispute entity
   * @param tier - Hearing tier (TIER_1 = Staff, TIER_2 = Admin)
   * @param moderatorId - Staff/Admin who will moderate
   */
  async determineRequiredParticipants(
    disputeId: string,
    tier: HearingTier,
    moderatorId: string,
  ): Promise<DetermineParticipantsResult> {
    const participants: RequiredParticipant[] = [];
    const warnings: string[] = [];
    const addedUserIds = new Set<string>();

    const addParticipant = (participant: RequiredParticipant) => {
      if (!participant.userId || addedUserIds.has(participant.userId)) {
        return;
      }
      participants.push(participant);
      addedUserIds.add(participant.userId);
    };

    // 1. Load dispute with project info
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'groupId',
        'raisedById',
        'defendantId',
        'projectId',
        'raiserRole',
        'defendantRole',
        'assignedStaffId',
      ],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    // 2. Add Raiser (REQUIRED)
    addParticipant({
      userId: dispute.raisedById,
      role: HearingParticipantRole.RAISER,
      isRequired: true,
      userRole: dispute.raiserRole,
      relationToProject: 'raiser',
    });

    // 3. Add Defendant (REQUIRED)
    addParticipant({
      userId: dispute.defendantId,
      role: HearingParticipantRole.DEFENDANT,
      isRequired: true,
      userRole: dispute.defendantRole,
      relationToProject: 'defendant',
    });

    // 4. Add Moderator (REQUIRED)
    const moderator = await this.userRepository.findOne({
      where: { id: moderatorId },
      select: ['id', 'role'],
    });

    if (!moderator) {
      throw new BadRequestException(`Moderator ${moderatorId} not found`);
    }

    addParticipant({
      userId: moderatorId,
      role: HearingParticipantRole.MODERATOR,
      isRequired: true,
      userRole: moderator.role,
      relationToProject: 'moderator',
    });

    // 5. Query Project to find Broker and other stakeholders
    let hasBroker = false;
    const hasSupervisor = false;

    if (dispute.projectId) {
      const project = await this.projectRepository.findOne({
        where: { id: dispute.projectId },
        select: ['id', 'clientId', 'brokerId', 'freelancerId'],
      });

      if (project) {
        // Add Broker as WITNESS (if exists and not already a party)
        if (
          project.brokerId &&
          project.brokerId !== dispute.raisedById &&
          project.brokerId !== dispute.defendantId
        ) {
          addParticipant({
            userId: project.brokerId,
            role: HearingParticipantRole.WITNESS,
            isRequired: false, // Broker is a witness but optional for finalize gate
            userRole: UserRole.BROKER,
            relationToProject: 'broker',
          });
          hasBroker = true;
          this.logger.log(`Added Broker ${project.brokerId} as optional WITNESS`);
        }

        // Add Freelancer as OBSERVER if not already a party
        if (
          project.freelancerId &&
          project.freelancerId !== dispute.raisedById &&
          project.freelancerId !== dispute.defendantId
        ) {
          addParticipant({
            userId: project.freelancerId,
            role: HearingParticipantRole.OBSERVER,
            isRequired: false, // Optional observer
            userRole: UserRole.FREELANCER,
            relationToProject: 'freelancer',
          });
        }

        // Add Client as OBSERVER if not already a party
        if (
          project.clientId &&
          project.clientId !== dispute.raisedById &&
          project.clientId !== dispute.defendantId
        ) {
          addParticipant({
            userId: project.clientId,
            role: HearingParticipantRole.OBSERVER,
            isRequired: false,
            userRole: UserRole.CLIENT,
            relationToProject: 'client',
          });
        }
      }
    }

    // 6. Tier 2: Add Admin as observer if Staff is original moderator
    if (tier === HearingTier.TIER_2 && dispute.assignedStaffId) {
      // Original Staff becomes OBSERVER in Tier 2
      if (dispute.assignedStaffId !== moderatorId) {
        addParticipant({
          userId: dispute.assignedStaffId,
          role: HearingParticipantRole.OBSERVER,
          isRequired: false, // Optional - can provide context
          userRole: UserRole.STAFF,
          relationToProject: 'original_staff',
        });
      }
    }

    // 7. Add explicit multi-party members from dispute group.
    const groupId = dispute.groupId || dispute.id;
    const groupMembers = await this.disputePartyRepository.find({
      where: { groupId },
      select: ['userId', 'role', 'side'],
    });

    for (const member of groupMembers) {
      if (!member.userId || addedUserIds.has(member.userId)) {
        continue;
      }

      let relationToProject = 'group_member';
      let role = HearingParticipantRole.OBSERVER;

      if (member.side === DisputePartySide.RAISER) {
        relationToProject = 'raiser_side_member';
        role = HearingParticipantRole.WITNESS;
      } else if (member.side === DisputePartySide.DEFENDANT) {
        relationToProject = 'defendant_side_member';
        role = HearingParticipantRole.WITNESS;
      } else if (member.side === DisputePartySide.THIRD_PARTY) {
        relationToProject = 'third_party_member';
        role = HearingParticipantRole.OBSERVER;
      }

      addParticipant({
        userId: member.userId,
        role,
        isRequired: false,
        userRole: member.role || UserRole.CLIENT,
        relationToProject,
      });
    }

    // 8. Warnings if key people missing
    if (!hasBroker && dispute.projectId) {
      warnings.push('No broker is linked to this project. Broker testimony may still be helpful.');
    }

    // Note: Supervisor logic would require additional entity/field
    // For now, we don't have a supervisor field in ProjectEntity
    // This can be extended when supervisor feature is added

    this.logger.log(
      `Determined ${participants.length} participants for hearing. ` +
        `Required: ${participants.filter((p) => p.isRequired).length}`,
    );

    return {
      participants,
      warnings,
      hasBroker,
      hasSupervisor,
    };
  }

  // ===========================================================================
  // HELPERS: DEADLINE, READY CHECK, ATTENDANCE
  // ===========================================================================

  private async loadHearingInviteStatusMap(
    hearingId: string,
  ): Promise<Map<string, ParticipantStatus>> {
    const event = await this.calendarRepository.findOne({
      where: { referenceType: 'DisputeHearing', referenceId: hearingId },
      select: ['id'],
    });

    if (!event) {
      return new Map();
    }

    const participants = await this.eventParticipantRepository.find({
      where: { eventId: event.id },
      select: ['userId', 'status'],
    });

    return new Map(participants.map((participant) => [participant.userId, participant.status]));
  }

  private async getHearingInviteStatus(
    hearingId: string,
    userId: string,
  ): Promise<ParticipantStatus | null> {
    const statusByUser = await this.loadHearingInviteStatusMap(hearingId);
    return statusByUser.get(userId) || null;
  }

  async isHearingInviteDeclined(hearingId: string, userId: string): Promise<boolean> {
    const status = await this.getHearingInviteStatus(hearingId, userId);
    return status === ParticipantStatus.DECLINED;
  }

  private calculateResponseDeadline(scheduledAt: Date, isEmergency: boolean): Date {
    const now = new Date();
    const maxDeadline = new Date(
      now.getTime() + HEARING_CONFIG.CONFIRMATION_TIMEOUT_HOURS * 60 * 60 * 1000,
    );
    const minBeforeStart = new Date(
      scheduledAt.getTime() - HEARING_CONFIG.MIN_CONFIRMATION_BEFORE_START_HOURS * 60 * 60 * 1000,
    );

    let deadline = maxDeadline < minBeforeStart ? maxDeadline : minBeforeStart;

    if (deadline <= now) {
      if (!isEmergency) {
        throw new BadRequestException(
          `Hearing is too soon to collect responses. ` +
            `Requires at least ${HEARING_CONFIG.MIN_CONFIRMATION_BEFORE_START_HOURS} hours before start.`,
        );
      }
      deadline = now;
    }

    return deadline;
  }

  private canUseTestSchedulingBypass(
    role?: UserRole | null,
    bypassReason?: string | null,
  ): boolean {
    if (!bypassReason?.trim()) {
      return false;
    }

    if (!role || ![UserRole.STAFF, UserRole.ADMIN].includes(role)) {
      return false;
    }

    const testMode = process.env.DISPUTE_TEST_MODE === 'true';
    const runtimeEnv = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase();
    const isProduction = runtimeEnv === 'production' || runtimeEnv === 'prod';

    return testMode && !isProduction;
  }

  private areAllRequiredParticipantsReady(
    participants: HearingParticipantEntity[],
    inviteStatusByUser: Map<string, ParticipantStatus>,
  ): boolean {
    return this.evaluateRequiredParticipantsReadiness(participants, inviteStatusByUser).ready;
  }

  private evaluateRequiredParticipantsReadiness(
    participants: HearingParticipantEntity[],
    inviteStatusByUser: Map<string, ParticipantStatus>,
  ): {
    ready: boolean;
    totalRequired: number;
    onlineCount: number;
    acceptedCount: number;
  } {
    const required = participants.filter((participant) => participant.isRequired);
    const totalRequired = required.length;

    if (totalRequired === 0) {
      return {
        ready: false,
        totalRequired: 0,
        onlineCount: 0,
        acceptedCount: 0,
      };
    }

    let onlineCount = 0;
    let acceptedCount = 0;

    required.forEach((participant) => {
      if (participant.isOnline) {
        onlineCount += 1;
      }
      if (inviteStatusByUser.get(participant.userId) === ParticipantStatus.ACCEPTED) {
        acceptedCount += 1;
      }
    });

    return {
      ready: onlineCount === totalRequired && acceptedCount === totalRequired,
      totalRequired,
      onlineCount,
      acceptedCount,
    };
  }

  private getMinimumAttendanceMinutes(durationMinutes: number): number {
    return Math.ceil(durationMinutes * HEARING_CONFIG.MIN_ATTENDANCE_RATIO);
  }

  private extractLatestResponseDeadline(
    summary?: HearingParticipantConfirmationSummary | null,
  ): Date | null {
    if (!summary?.participants?.length) {
      return null;
    }

    const deadlines = summary.participants
      .map((participant) =>
        participant.responseDeadline ? new Date(participant.responseDeadline) : null,
      )
      .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));

    if (!deadlines.length) {
      return null;
    }

    return deadlines.sort((a, b) => b.getTime() - a.getTime())[0];
  }

  private async markPendingConfirmationForManualReview(
    hearing: Pick<
      DisputeHearingEntity,
      | 'id'
      | 'status'
      | 'scheduledAt'
      | 'startedAt'
      | 'estimatedDurationMinutes'
      | 'pausedAt'
      | 'pausedById'
      | 'pauseReason'
      | 'accumulatedPauseSeconds'
      | 'speakerRoleBeforePause'
      | 'isEvidenceIntakeOpen'
      | 'tier'
    >,
    event: Pick<CalendarEventEntity, 'id' | 'metadata'>,
    reason: string,
    referenceAt: Date,
  ): Promise<void> {
    await this.hearingRepository.update(hearing.id, {
      status: HearingStatus.CANCELED,
      endedAt: referenceAt,
      isChatRoomActive: false,
      currentSpeakerRole: SpeakerRole.MUTED_ALL,
      isEvidenceIntakeOpen: false,
      evidenceIntakeClosedAt: hearing.isEvidenceIntakeOpen ? referenceAt : null,
      accumulatedPauseSeconds: this.getTotalPauseSeconds(hearing),
      pausedAt: null,
      pausedById: null,
      pauseReason: null,
      speakerRoleBeforePause: null,
      summary: PENDING_CONFIRMATION_TIMEOUT_SUMMARY,
      findings: PENDING_CONFIRMATION_TIMEOUT_FINDINGS,
      pendingActions: DEFAULT_FOLLOW_UP_PENDING_ACTIONS,
      noShowNote: `System-generated note: ${reason}`,
    });

    await this.calendarRepository.update(event.id, {
      status: EventStatus.CANCELLED,
      metadata: {
        ...(event.metadata || {}),
        manualNoShowReviewRequired: true,
        noShowReady: true,
        noShowReason: reason,
        confirmationExpiredAt: referenceAt.toISOString(),
      },
    });
  }

  private async findNextAutoRescheduleSlot(
    hearing: Pick<
      DisputeHearingEntity,
      | 'scheduledAt'
      | 'estimatedDurationMinutes'
      | 'participants'
      | 'agenda'
      | 'requiredDocuments'
      | 'externalMeetingLink'
    >,
    referenceAt: Date,
  ): Promise<Date | null> {
    const participantIds = Array.from(
      new Set(
        (hearing.participants || []).map((participant) => participant.userId).filter(Boolean),
      ),
    );
    if (!participantIds.length) {
      return null;
    }

    const durationMinutes = hearing.estimatedDurationMinutes || 60;
    const rangeStart = new Date(
      Math.max(
        referenceAt.getTime() + 30 * 60 * 1000,
        hearing.scheduledAt.getTime() + 30 * 60 * 1000,
      ),
    );
    const rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const availableSlots = await this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes,
      dateRange: { start: rangeStart, end: rangeEnd },
      maxSlots: 5,
    });

    return availableSlots.slots[0]?.start ?? null;
  }

  private getParticipantOnlineMinutes(participant: HearingParticipantEntity, asOf: Date): number {
    const baseMinutes = participant.totalOnlineMinutes || 0;
    if (participant.isOnline && participant.lastOnlineAt) {
      const extraMinutes = Math.max(
        0,
        (asOf.getTime() - participant.lastOnlineAt.getTime()) / (1000 * 60),
      );
      return baseMinutes + extraMinutes;
    }
    return baseMinutes;
  }

  private isSpeakerAllowed(
    speakerRole: SpeakerRole,
    participantRole: HearingParticipantRole,
  ): boolean {
    // Moderators can always speak, except when ALL are muted
    if (
      participantRole === HearingParticipantRole.MODERATOR &&
      speakerRole !== SpeakerRole.MUTED_ALL
    ) {
      return true;
    }

    switch (speakerRole) {
      case SpeakerRole.ALL:
        return true;
      case SpeakerRole.MODERATOR_ONLY:
        return participantRole === HearingParticipantRole.MODERATOR;
      case SpeakerRole.RAISER_ONLY:
        return participantRole === HearingParticipantRole.RAISER;
      case SpeakerRole.DEFENDANT_ONLY:
        return participantRole === HearingParticipantRole.DEFENDANT;
      case SpeakerRole.WITNESS_ONLY:
        return participantRole === HearingParticipantRole.WITNESS;
      case SpeakerRole.OBSERVER_ONLY:
        return participantRole === HearingParticipantRole.OBSERVER;
      case SpeakerRole.MUTED_ALL:
      default:
        return false;
    }
  }

  async getChatPermission(hearingId: string, userId: string): Promise<ChatPermissionResult> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['participants', 'dispute'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    const docketEntry = await this.getHearingDocketEntry(hearing);
    if (docketEntry && !docketEntry.isActionable) {
      return {
        allowed: false,
        reason:
          docketEntry.freezeReason ||
          'This hearing is archived and no longer accepts live interaction.',
        hearing,
        effectiveSpeakerRole: hearing.currentSpeakerRole,
      };
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      const blockedReason =
        hearing.status === HearingStatus.PAUSED ? 'Hearing is paused' : 'Chat room is not active';
      return {
        allowed: false,
        reason: blockedReason,
        hearing,
        effectiveSpeakerRole: hearing.currentSpeakerRole,
      };
    }

    const participant = hearing.participants?.find((p) => p.userId === userId);
    if (!participant) {
      return {
        allowed: false,
        reason: 'You are not a participant of this hearing',
        hearing,
        effectiveSpeakerRole: hearing.currentSpeakerRole,
      };
    }

    const inviteStatus = await this.getHearingInviteStatus(hearingId, userId);
    if (inviteStatus === ParticipantStatus.DECLINED) {
      this.logger.warn(
        `hearing_chat_denied_declined_participant hearingId=${hearingId} userId=${userId}`,
      );
      return {
        allowed: false,
        reason: 'You declined this hearing invitation and no longer have chat access.',
        hearing,
        participantRole: participant.role,
        effectiveSpeakerRole: hearing.currentSpeakerRole,
      };
    }

    const effectiveRole = hearing.currentSpeakerRole;

    if (!this.isSpeakerAllowed(effectiveRole, participant.role)) {
      return {
        allowed: false,
        reason: 'You are not allowed to speak at this time',
        hearing,
        participantRole: participant.role,
        effectiveSpeakerRole: effectiveRole,
      };
    }

    return {
      allowed: true,
      hearing,
      participantRole: participant.role,
      effectiveSpeakerRole: effectiveRole,
    };
  }

  private async isDisputePartyMember(
    dispute: Pick<DisputeEntity, 'id' | 'groupId' | 'raisedById' | 'defendantId'>,
    userId: string,
  ): Promise<boolean> {
    if (dispute.raisedById === userId || dispute.defendantId === userId) {
      return true;
    }

    const groupId = dispute.groupId || dispute.id;
    const membership = await this.disputePartyRepository.findOne({
      where: { groupId, userId },
      select: ['id'],
    });
    return Boolean(membership);
  }

  private async buildHearingWorkspacePermissions(
    hearing: DisputeHearingEntity,
    user: UserEntity,
  ): Promise<HearingWorkspacePermissions> {
    const chatPermission = await this.getChatPermission(hearing.id, user.id);
    const permissions: HearingWorkspacePermissions = {
      canSendMessage: chatPermission.allowed,
      sendMessageBlockedReason: chatPermission.allowed ? undefined : chatPermission.reason,
      canUploadEvidence: false,
      canAttachEvidenceLink: false,
      canManageEvidenceIntake: false,
    };

    const dispute = hearing.dispute;
    if (!dispute) {
      permissions.uploadEvidenceBlockedReason = 'Dispute context is missing.';
      permissions.attachEvidenceBlockedReason = 'Dispute context is missing.';
      permissions.manageEvidenceIntakeBlockedReason = 'Dispute context is missing.';
      return permissions;
    }

    const isPartyMember = await this.isDisputePartyMember(dispute, user.id);
    const isModerator = hearing.moderatorId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;
    const isStaff = user.role === UserRole.STAFF;
    const participantRecord = hearing.participants?.find(
      (participant) => participant.userId === user.id,
    );
    const isDeclinedParticipant = await this.isHearingInviteDeclined(hearing.id, user.id);

    if (isDeclinedParticipant && !isAdmin && !isModerator) {
      permissions.uploadEvidenceBlockedReason =
        'You declined this hearing invitation and cannot upload evidence.';
    } else if (dispute.status === DisputeStatus.RESOLVED) {
      permissions.uploadEvidenceBlockedReason = 'Cannot upload evidence to a resolved dispute.';
    } else if (hearing.status === HearingStatus.PAUSED) {
      permissions.uploadEvidenceBlockedReason = 'Cannot upload evidence while hearing is paused.';
    } else if (isStaff || isAdmin) {
      permissions.uploadEvidenceBlockedReason = 'Staff cannot upload evidence for disputes.';
    } else if (!isPartyMember) {
      permissions.uploadEvidenceBlockedReason = 'Only dispute participants can upload evidence.';
    } else if (hearing.status === HearingStatus.IN_PROGRESS && !hearing.isEvidenceIntakeOpen) {
      permissions.uploadEvidenceBlockedReason =
        'Live hearing evidence intake is closed. Ask moderator to open intake.';
    } else if (
      hearing.status === HearingStatus.COMPLETED ||
      hearing.status === HearingStatus.CANCELED
    ) {
      permissions.uploadEvidenceBlockedReason = 'Cannot upload evidence after hearing is closed.';
    } else {
      permissions.canUploadEvidence = true;
    }

    const attachPermission = await this.getEvidenceAttachPermission(hearing.id, user.id, user.role);
    permissions.canAttachEvidenceLink = attachPermission.allowed;
    permissions.attachEvidenceBlockedReason = attachPermission.allowed
      ? undefined
      : attachPermission.reason;

    if (!isAdmin && !isModerator) {
      permissions.manageEvidenceIntakeBlockedReason =
        'Only hearing moderator or admin can open/close evidence intake.';
    } else if (hearing.status === HearingStatus.PAUSED) {
      permissions.manageEvidenceIntakeBlockedReason =
        'Evidence intake cannot be changed while hearing is paused.';
    } else if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      permissions.manageEvidenceIntakeBlockedReason =
        'Evidence intake can be managed only while hearing is in progress.';
    } else {
      permissions.canManageEvidenceIntake = true;
    }

    return permissions;
  }

  async getEvidenceAttachPermission(
    hearingId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<HearingEvidenceAttachPermissionResult> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['dispute', 'participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    const participantRecord = hearing.participants?.find(
      (participant) => participant.userId === userId,
    );
    const isDeclinedParticipant = await this.isHearingInviteDeclined(hearingId, userId);
    if (participantRecord && isDeclinedParticipant) {
      this.logger.warn(
        `hearing_attach_evidence_denied_declined_participant hearingId=${hearingId} userId=${userId}`,
      );
      return {
        allowed: false,
        reason: 'You declined this hearing invitation and cannot attach evidence links.',
        hearing,
      };
    }

    await this.assertHearingIsActionable(hearing);

    const docketEntry = await this.getHearingDocketEntry(hearing);
    if (docketEntry && !docketEntry.isActionable) {
      return {
        allowed: false,
        reason:
          docketEntry.freezeReason ||
          'This hearing is archived and no longer accepts live evidence discussion.',
        hearing,
      };
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      return {
        allowed: false,
        reason:
          hearing.status === HearingStatus.PAUSED
            ? 'Evidence links are unavailable while hearing is paused.'
            : 'Evidence links are available only while hearing chat is active.',
        hearing,
      };
    }

    if (userRole === UserRole.ADMIN || hearing.moderatorId === userId) {
      return {
        allowed: true,
        hearing,
      };
    }

    if (!hearing.dispute) {
      return {
        allowed: false,
        reason: 'Dispute context is missing.',
        hearing,
      };
    }

    const isPartyMember = await this.isDisputePartyMember(hearing.dispute, userId);
    if (!isPartyMember) {
      return {
        allowed: false,
        reason: 'Only dispute parties or the hearing moderator can attach evidence links.',
        hearing,
      };
    }

    if (!participantRecord) {
      return {
        allowed: false,
        reason: 'Hearing participant record is missing.',
        hearing,
      };
    }

    if (!this.isSpeakerAllowed(hearing.currentSpeakerRole, participantRecord.role)) {
      return {
        allowed: false,
        reason: 'You are not allowed to speak at this time.',
        hearing,
      };
    }

    return {
      allowed: true,
      hearing,
    };
  }

  // ===========================================================================
  // LIST HEARINGS
  // ===========================================================================

  private async ensureDisputeAccessForHearings(
    disputeId: string,
    user: UserEntity,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      select: ['id', 'raisedById', 'defendantId', 'assignedStaffId', 'escalatedToAdminId'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    if (user.role === UserRole.ADMIN) {
      return dispute;
    }

    const isParty = user.id === dispute.raisedById || user.id === dispute.defendantId;
    const isAssignedStaff = user.role === UserRole.STAFF && user.id === dispute.assignedStaffId;
    const isEscalatedAdmin = user.id === dispute.escalatedToAdminId;

    if (isParty || isAssignedStaff || isEscalatedAdmin) {
      return dispute;
    }

    const participant = await this.participantRepository
      .createQueryBuilder('participant')
      .innerJoin('participant.hearing', 'hearing')
      .where('hearing.disputeId = :disputeId', { disputeId })
      .andWhere('participant.userId = :userId', { userId: user.id })
      .getOne();

    if (!participant) {
      throw new ForbiddenException('Access denied');
    }

    return dispute;
  }

  private mapParticipantSummary(participant: HearingParticipantEntity) {
    return {
      id: participant.id,
      userId: participant.userId,
      role: participant.role,
      invitedAt: participant.invitedAt,
      isRequired: participant.isRequired,
      isOnline: participant.isOnline,
      confirmedAt: participant.confirmedAt,
      declineReason: participant.declineReason,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      totalOnlineMinutes: participant.totalOnlineMinutes,
      responseDeadline: participant.responseDeadline,
      user: participant.user
        ? {
            id: participant.user.id,
            fullName: participant.user.fullName,
            email: participant.user.email,
            role: participant.user.role,
          }
        : undefined,
    };
  }

  private mapStatementSummary(statement: HearingStatementEntity) {
    return {
      id: statement.id,
      hearingId: statement.hearingId,
      participantId: statement.participantId,
      type: statement.type,
      title: statement.title,
      content: statement.content,
      structuredContent: statement.structuredContent,
      citedEvidenceIds: statement.citedEvidenceIds,
      status: statement.status,
      attachments: statement.attachments,
      replyToStatementId: statement.replyToStatementId,
      retractionOfStatementId: statement.retractionOfStatementId,
      orderIndex: statement.orderIndex,
      isRedacted: statement.isRedacted,
      redactedReason: statement.redactedReason,
      platformDeclarationAccepted: statement.platformDeclarationAccepted,
      platformDeclarationAcceptedAt: statement.platformDeclarationAcceptedAt,
      versionNumber: statement.versionNumber,
      versionHistory: statement.versionHistory ?? [],
      createdAt: statement.createdAt,
      updatedAt: statement.updatedAt,
      participant: statement.participant
        ? {
            id: statement.participant.id,
            userId: statement.participant.userId,
            role: statement.participant.role,
            user: statement.participant.user
              ? {
                  id: statement.participant.user.id,
                  fullName: statement.participant.user.fullName,
                  email: statement.participant.user.email,
                  role: statement.participant.user.role,
                }
              : undefined,
          }
        : undefined,
    };
  }

  private async emitStatementSubmittedEvent(
    hearing: Pick<DisputeHearingEntity, 'id' | 'disputeId'>,
    statementId: string,
    participantId: string,
    statementType: HearingStatementType,
    createdAt?: Date | null,
  ): Promise<void> {
    const hydratedStatement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: ['participant', 'participant.user'],
    });

    this.eventEmitter.emit('hearing.statementSubmitted', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      statementId,
      participantId,
      createdAt: createdAt ?? hydratedStatement?.createdAt ?? new Date(),
      statementType,
      statement: hydratedStatement ? this.mapStatementSummary(hydratedStatement) : null,
    });
  }

  private normalizeStatementBlocks(
    blocks?: Array<{ kind: string; heading?: string; body: string }> | null,
  ): HearingStatementContentBlock[] | null {
    if (!blocks?.length) {
      return null;
    }

    const normalized = blocks
      .map((block, index) => ({
        id: `${block.kind.toLowerCase()}-${index + 1}`,
        kind: block.kind as HearingStatementContentBlock['kind'],
        heading: block.heading?.trim() || null,
        body: block.body?.trim() || '',
      }))
      .filter((block) => block.body.length > 0);

    return normalized.length ? normalized : null;
  }

  private compileStatementContent(
    blocks: HearingStatementContentBlock[] | null,
    fallbackContent?: string | null,
  ): string {
    if (blocks?.length) {
      return blocks
        .map((block) =>
          block.heading?.trim()
            ? `${block.heading.trim()}\n${block.body.trim()}`
            : block.body.trim(),
        )
        .join('\n\n')
        .trim();
    }

    return fallbackContent?.trim() || '';
  }

  private buildStatementVersionSnapshot(
    statement: HearingStatementEntity,
    changeSummary?: string | null,
  ): HearingStatementVersionSnapshot {
    return {
      versionNumber: statement.versionNumber ?? 1,
      savedAt: (statement.updatedAt ?? statement.createdAt ?? new Date()).toISOString(),
      status: statement.status,
      title: statement.title ?? null,
      content: statement.content ?? '',
      attachments: statement.attachments ?? null,
      citedEvidenceIds: statement.citedEvidenceIds ?? null,
      structuredContent: statement.structuredContent ?? null,
      changeSummary: changeSummary?.trim() || null,
    };
  }

  private mapQuestionSummary(question: HearingQuestionEntity) {
    return {
      id: question.id,
      hearingId: question.hearingId,
      askedById: question.askedById,
      targetUserId: question.targetUserId,
      question: question.question,
      answer: question.answer,
      status: question.status,
      answeredAt: question.answeredAt,
      deadline: question.deadline,
      cancelledAt: question.cancelledAt,
      cancelledById: question.cancelledById,
      isRequired: question.isRequired,
      orderIndex: question.orderIndex,
      createdAt: question.createdAt,
      askedBy: question.askedBy
        ? {
            id: question.askedBy.id,
            fullName: question.askedBy.fullName,
            email: question.askedBy.email,
            role: question.askedBy.role,
          }
        : undefined,
      targetUser: question.targetUser
        ? {
            id: question.targetUser.id,
            fullName: question.targetUser.fullName,
            email: question.targetUser.email,
            role: question.targetUser.role,
          }
        : undefined,
      cancelledBy: question.cancelledBy
        ? {
            id: question.cancelledBy.id,
            fullName: question.cancelledBy.fullName,
            email: question.cancelledBy.email,
            role: question.cancelledBy.role,
          }
        : undefined,
    };
  }

  private buildParticipantConfirmationSummary(
    eventParticipants: Array<
      Pick<
        EventParticipantEntity,
        'userId' | 'role' | 'status' | 'respondedAt' | 'responseDeadline'
      >
    >,
    hearingRoleByUserId: Map<string, HearingParticipantRole> = new Map(),
  ): HearingParticipantConfirmationSummary {
    const initial: HearingParticipantConfirmationSummary = {
      totalParticipants: eventParticipants.length,
      requiredParticipants: 0,
      accepted: 0,
      declined: 0,
      tentative: 0,
      pending: 0,
      requiredAccepted: 0,
      requiredDeclined: 0,
      requiredTentative: 0,
      requiredPending: 0,
      allRequiredAccepted: false,
      hasModeratorAccepted: false,
      primaryPartyAcceptedCount: 0,
      primaryPartyPendingCount: 0,
      primaryPartyDeclinedCount: 0,
      confirmedPrimaryRoles: [],
      confirmationSatisfied: false,
      participants: [],
    };

    const requiredRoles = new Set<ParticipantRole>([
      ParticipantRole.MODERATOR,
      ParticipantRole.REQUIRED,
    ]);

    for (const participant of eventParticipants) {
      const isRequired = requiredRoles.has(participant.role);
      const caseRole = hearingRoleByUserId.get(participant.userId) ?? null;
      const isPrimaryParty =
        caseRole === HearingParticipantRole.RAISER || caseRole === HearingParticipantRole.DEFENDANT;
      if (isRequired) {
        initial.requiredParticipants += 1;
      }

      switch (participant.status) {
        case ParticipantStatus.ACCEPTED:
          initial.accepted += 1;
          if (isRequired) initial.requiredAccepted += 1;
          if (participant.role === ParticipantRole.MODERATOR) {
            initial.hasModeratorAccepted = true;
          }
          if (isPrimaryParty) {
            initial.primaryPartyAcceptedCount += 1;
            if (!initial.confirmedPrimaryRoles.includes(caseRole)) {
              initial.confirmedPrimaryRoles.push(caseRole);
            }
          }
          break;
        case ParticipantStatus.DECLINED:
          initial.declined += 1;
          if (isRequired) initial.requiredDeclined += 1;
          if (isPrimaryParty) initial.primaryPartyDeclinedCount += 1;
          break;
        case ParticipantStatus.TENTATIVE:
          initial.tentative += 1;
          if (isRequired) initial.requiredTentative += 1;
          break;
        case ParticipantStatus.PENDING:
        case ParticipantStatus.NO_RESPONSE:
        default:
          initial.pending += 1;
          if (isRequired) initial.requiredPending += 1;
          if (isPrimaryParty) initial.primaryPartyPendingCount += 1;
          break;
      }

      initial.participants.push({
        userId: participant.userId,
        role: participant.role,
        status: participant.status,
        isRequired,
        caseRole,
        respondedAt: participant.respondedAt,
        responseDeadline: participant.responseDeadline,
      });
    }

    initial.allRequiredAccepted =
      initial.requiredParticipants > 0 &&
      initial.requiredAccepted === initial.requiredParticipants &&
      initial.requiredDeclined === 0 &&
      initial.requiredTentative === 0 &&
      initial.requiredPending === 0;
    initial.confirmationSatisfied = initial.allRequiredAccepted;

    return initial;
  }

  private async loadConfirmationSummaryByHearingIds(
    hearingIds: string[],
  ): Promise<Map<string, HearingParticipantConfirmationSummary>> {
    const normalizedIds = Array.from(new Set(hearingIds.filter(Boolean)));
    if (!normalizedIds.length) {
      return new Map();
    }

    const hearingEvents = await this.calendarRepository.find({
      where: {
        referenceType: 'DisputeHearing',
        referenceId: In(normalizedIds),
      },
      select: ['id', 'referenceId'],
    });

    if (!hearingEvents.length) {
      return new Map();
    }

    const eventIds = hearingEvents.map((event) => event.id);
    const participants = await this.eventParticipantRepository.find({
      where: { eventId: In(eventIds) },
      select: ['eventId', 'userId', 'role', 'status', 'respondedAt', 'responseDeadline'],
    });
    const hearingParticipants = await this.participantRepository.find({
      where: { hearingId: In(normalizedIds) },
      select: ['hearingId', 'userId', 'role'],
    });

    const participantsByEventId = new Map<
      string,
      Array<
        Pick<
          EventParticipantEntity,
          'userId' | 'role' | 'status' | 'respondedAt' | 'responseDeadline'
        >
      >
    >();
    for (const participant of participants) {
      const existing = participantsByEventId.get(participant.eventId);
      if (existing) {
        existing.push(participant);
      } else {
        participantsByEventId.set(participant.eventId, [participant]);
      }
    }

    const summariesByHearingId = new Map<string, HearingParticipantConfirmationSummary>();
    const hearingRolesByHearingId = new Map<string, Map<string, HearingParticipantRole>>();
    for (const participant of hearingParticipants) {
      const existing = hearingRolesByHearingId.get(participant.hearingId) ?? new Map();
      existing.set(participant.userId, participant.role);
      hearingRolesByHearingId.set(participant.hearingId, existing);
    }
    for (const event of hearingEvents) {
      const eventParticipants = participantsByEventId.get(event.id) || [];
      summariesByHearingId.set(
        event.referenceId,
        this.buildParticipantConfirmationSummary(
          eventParticipants,
          hearingRolesByHearingId.get(event.referenceId),
        ),
      );
    }

    return summariesByHearingId;
  }

  private mapHearingSummary(
    hearing: DisputeHearingEntity,
    confirmationSummaryByHearingId?: Map<string, HearingParticipantConfirmationSummary>,
    docketEntry?: {
      isActionable: boolean;
      isArchived: boolean;
      freezeReason?: string;
      minutesRecorded?: boolean;
    },
  ) {
    const participantConfirmationSummary = confirmationSummaryByHearingId?.get(hearing.id);
    const lifecycle = this.resolveHearingLifecycle(hearing);
    const timebox = this.buildHearingTimebox(hearing);
    const closureReason = this.deriveClosureReason(hearing);
    return {
      id: hearing.id,
      disputeId: hearing.disputeId,
      status: hearing.status,
      lifecycle,
      scheduledAt: hearing.scheduledAt,
      startedAt: hearing.startedAt,
      endedAt: hearing.endedAt,
      agenda: hearing.agenda,
      requiredDocuments: hearing.requiredDocuments,
      externalMeetingLink: hearing.externalMeetingLink,
      moderatorId: hearing.moderatorId,
      currentSpeakerRole: hearing.currentSpeakerRole,
      isChatRoomActive: hearing.isChatRoomActive,
      isEvidenceIntakeOpen: hearing.isEvidenceIntakeOpen,
      evidenceIntakeOpenedAt: hearing.evidenceIntakeOpenedAt,
      evidenceIntakeClosedAt: hearing.evidenceIntakeClosedAt,
      evidenceIntakeOpenedBy: hearing.evidenceIntakeOpenedBy,
      evidenceIntakeReason: hearing.evidenceIntakeReason,
      pausedAt: hearing.pausedAt,
      pausedById: hearing.pausedById,
      pauseReason: hearing.pauseReason,
      summary: hearing.summary,
      findings: hearing.findings,
      noShowNote: hearing.noShowNote,
      accumulatedPauseSeconds: this.getTotalPauseSeconds(hearing),
      speakerRoleBeforePause: hearing.speakerRoleBeforePause,
      estimatedDurationMinutes: hearing.estimatedDurationMinutes,
      scheduledEndAt: timebox.scheduledEndAt,
      graceEndsAt: timebox.graceEndsAt,
      pauseAutoCloseAt: timebox.pauseAutoCloseAt,
      closureReason,
      rescheduleCount: hearing.rescheduleCount,
      previousHearingId: hearing.previousHearingId,
      lastRescheduledAt: hearing.lastRescheduledAt,
      hearingNumber: hearing.hearingNumber,
      tier: hearing.tier,
      isActionable: docketEntry?.isActionable ?? lifecycle === 'ACTIVE',
      isArchived: docketEntry?.isArchived ?? lifecycle === 'ARCHIVED',
      freezeReason: docketEntry?.freezeReason,
      minutesRecorded: docketEntry?.minutesRecorded ?? Boolean(hearing.summary && hearing.findings),
      participants: (hearing.participants || []).map((participant) =>
        this.mapParticipantSummary(participant),
      ),
      participantConfirmationSummary,
      dispute: hearing.dispute
        ? {
            id: hearing.dispute.id,
            status: hearing.dispute.status,
            phase: hearing.dispute.phase,
            priority: hearing.dispute.priority,
            assignedStaffId: hearing.dispute.assignedStaffId,
          }
        : undefined,
    };
  }

  async getHearingsForDispute(
    disputeId: string,
    user: UserEntity,
    lifecycle: HearingLifecycleFilter = 'all',
  ) {
    await this.ensureDisputeAccessForHearings(disputeId, user);

    const hearings = await this.hearingRepository.find({
      where: { disputeId },
      relations: ['participants', 'participants.user', 'dispute'],
      order: { hearingNumber: 'ASC', scheduledAt: 'ASC' },
    });
    const docket = buildHearingDocket(hearings, hearings[0]?.dispute?.status);
    const docketByHearingId = new Map(docket.items.map((item) => [item.hearingId, item]));
    const filteredHearings = this.applyLifecycleFilter(hearings, lifecycle);
    const confirmationSummaryByHearingId = await this.loadConfirmationSummaryByHearingIds(
      filteredHearings.map((hearing) => hearing.id),
    );

    return filteredHearings.map((hearing) =>
      this.mapHearingSummary(
        hearing,
        confirmationSummaryByHearingId,
        docketByHearingId.get(hearing.id),
      ),
    );
  }

  async getHearingsForUser(
    user: UserEntity,
    options: {
      statuses?: HearingStatus[];
      from?: Date;
      to?: Date;
      lifecycle?: HearingLifecycleFilter;
    } = {},
  ) {
    const qb = this.hearingRepository
      .createQueryBuilder('hearing')
      .leftJoinAndSelect('hearing.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('hearing.dispute', 'dispute')
      .where(
        new Brackets((whereQb) => {
          whereQb
            .where('hearing.moderatorId = :userId', { userId: user.id })
            .orWhere('participant.userId = :userId', { userId: user.id });
        }),
      )
      .distinct(true);

    if (options.statuses && options.statuses.length > 0) {
      qb.andWhere('hearing.status IN (:...statuses)', { statuses: options.statuses });
    }

    if (options.from && options.to) {
      qb.andWhere('hearing.scheduledAt BETWEEN :from AND :to', {
        from: options.from,
        to: options.to,
      });
    } else if (options.from) {
      qb.andWhere('hearing.scheduledAt >= :from', { from: options.from });
    } else if (options.to) {
      qb.andWhere('hearing.scheduledAt <= :to', { to: options.to });
    }

    qb.orderBy('hearing.scheduledAt', 'ASC');

    const rawHearings = await qb.getMany();
    const docketByHearingId = new Map<
      string,
      {
        isActionable: boolean;
        isArchived: boolean;
        freezeReason?: string;
        minutesRecorded?: boolean;
      }
    >();
    const hearingsByDisputeId = new Map<string, DisputeHearingEntity[]>();
    for (const hearing of rawHearings) {
      const existing = hearingsByDisputeId.get(hearing.disputeId);
      if (existing) {
        existing.push(hearing);
      } else {
        hearingsByDisputeId.set(hearing.disputeId, [hearing]);
      }
    }
    for (const [disputeId, disputeHearings] of hearingsByDisputeId.entries()) {
      const docket = buildHearingDocket(disputeHearings, disputeHearings[0]?.dispute?.status);
      for (const item of docket.items) {
        docketByHearingId.set(item.hearingId, item);
      }
    }
    const hearings = this.applyLifecycleFilter(rawHearings, options.lifecycle);
    const confirmationSummaryByHearingId = await this.loadConfirmationSummaryByHearingIds(
      hearings.map((hearing) => hearing.id),
    );
    return hearings.map((hearing) =>
      this.mapHearingSummary(
        hearing,
        confirmationSummaryByHearingId,
        docketByHearingId.get(hearing.id),
      ),
    );
  }

  private async ensureHearingAccess(
    hearingId: string,
    user: UserEntity,
  ): Promise<DisputeHearingEntity> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['participants', 'participants.user', 'dispute'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (user.role === UserRole.ADMIN) {
      return hearing;
    }

    const isModerator = hearing.moderatorId === user.id;
    const participantRecord = hearing.participants?.find((p) => p.userId === user.id);
    const isParticipant = Boolean(participantRecord);
    const dispute = hearing.dispute;
    const isParty = dispute && (user.id === dispute.raisedById || user.id === dispute.defendantId);
    const isAssignedStaff = user.role === UserRole.STAFF && dispute?.assignedStaffId === user.id;
    const isEscalatedAdmin = dispute?.escalatedToAdminId === user.id;

    let isProjectParty = false;
    if (!isParty && dispute?.projectId) {
      const project = await this.projectRepository.findOne({
        where: { id: dispute.projectId },
        select: ['id', 'clientId', 'freelancerId', 'brokerId'],
      });
      if (project) {
        isProjectParty = [project.clientId, project.freelancerId, project.brokerId]
          .filter(Boolean)
          .includes(user.id);
      }
    }

    const isDeclinedParticipant = await this.isHearingInviteDeclined(hearingId, user.id);
    if (isDeclinedParticipant && !isModerator && !isAssignedStaff && !isEscalatedAdmin) {
      this.logger.warn(
        `hearing_workspace_denied_declined_participant hearingId=${hearingId} userId=${user.id}`,
      );
      throw new ForbiddenException(
        'You declined this hearing invitation and no longer have workspace access.',
      );
    }

    if (
      !isModerator &&
      !isParticipant &&
      !isParty &&
      !isProjectParty &&
      !isAssignedStaff &&
      !isEscalatedAdmin
    ) {
      throw new ForbiddenException('Access denied');
    }

    return hearing;
  }

  async getHearingById(hearingId: string, user: UserEntity) {
    const hearing = await this.ensureHearingAccess(hearingId, user);
    const docket = await this.buildDocketForDispute(hearing.disputeId, hearing.dispute?.status);
    const docketEntry = docket.items.find((item) => item.hearingId === hearing.id);
    const confirmationSummaryByHearingId = await this.loadConfirmationSummaryByHearingIds([
      hearing.id,
    ]);
    const permissions = await this.buildHearingWorkspacePermissions(hearing, user);
    return {
      ...this.mapHearingSummary(hearing, confirmationSummaryByHearingId, docketEntry),
      permissions,
    };
  }

  private resolveUserDisplayName(user?: Pick<UserEntity, 'fullName' | 'email' | 'id'>): string {
    if (!user) {
      return 'Unknown user';
    }
    return user.fullName || user.email || user.id;
  }

  private async getPresentationToCrossPhaseGateStatus(
    hearingId: string,
  ): Promise<HearingPhaseGateStatus> {
    const raiserParticipants = await this.participantRepository.find({
      where: {
        hearingId,
        role: HearingParticipantRole.RAISER,
      },
      relations: ['user'],
    });

    if (raiserParticipants.length === 0) {
      return {
        requiredRole: HearingParticipantRole.RAISER,
        requiredCount: 0,
        submittedCount: 0,
        canTransition: false,
        missingParticipants: [],
        reason: 'No raiser participant found for this hearing.',
      };
    }

    const submittedRows = await this.statementRepository
      .createQueryBuilder('statement')
      .innerJoin(
        HearingParticipantEntity,
        'participant',
        'participant.id = statement.participantId',
      )
      .select('statement.participantId', 'participantId')
      .where('statement.hearingId = :hearingId', { hearingId })
      .andWhere('statement.status = :status', { status: HearingStatementStatus.SUBMITTED })
      .andWhere('participant.role = :role', { role: HearingParticipantRole.RAISER })
      .groupBy('statement.participantId')
      .getRawMany<{ participantId: string }>();

    const submittedParticipantIds = new Set(
      submittedRows.map((row) => row.participantId).filter(Boolean),
    );
    const submittedCount = submittedParticipantIds.size;
    const missingParticipants = raiserParticipants
      .filter((participant) => !submittedParticipantIds.has(participant.id))
      .map((participant) => ({
        participantId: participant.id,
        userId: participant.userId,
        displayName: this.resolveUserDisplayName(participant.user),
      }));

    const canTransition = submittedCount > 0;
    return {
      requiredRole: HearingParticipantRole.RAISER,
      requiredCount: raiserParticipants.length,
      submittedCount,
      canTransition,
      missingParticipants,
      reason: canTransition
        ? undefined
        : 'Transition blocked: submit at least one raiser statement before cross examination.',
    };
  }

  private async getWorkspaceMessages(
    hearingId: string,
    userRole: UserRole,
    limit: number = 100,
  ): Promise<
    Array<{
      id: string;
      disputeId: string;
      hearingId?: string | null;
      senderId?: string | null;
      senderRole?: string;
      senderHearingRole?: HearingParticipantRole;
      type?: MessageType;
      content?: string | null;
      replyToMessageId?: string | null;
      relatedEvidenceId?: string | null;
      attachedEvidenceIds?: string[] | null;
      metadata?: Record<string, unknown> | null;
      isHidden?: boolean;
      hiddenReason?: string | null;
      createdAt: Date;
      sender?: { id: string; fullName?: string; email?: string; role?: UserRole };
    }>
  > {
    const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(userRole);
    const cappedLimit = Math.max(1, Math.min(200, limit));

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.hearingId = :hearingId', { hearingId })
      .orderBy('message.createdAt', 'DESC')
      .take(cappedLimit);

    if (!isStaffOrAdmin) {
      qb.andWhere('message.isHidden = :isHidden', { isHidden: false });
    }

    const latestMessages = await qb.getMany();
    const orderedMessages = latestMessages.reverse();
    const senderIds = Array.from(
      new Set(
        orderedMessages
          .map((message) => message.senderId)
          .filter((senderId): senderId is string => Boolean(senderId)),
      ),
    );

    const hearingParticipants =
      senderIds.length > 0
        ? await this.participantRepository.find({
            where: { hearingId, userId: In(senderIds) },
          })
        : [];
    const hearingRoleByUserId = new Map(
      hearingParticipants.map((participant) => [participant.userId, participant.role]),
    );

    return orderedMessages.map((message) => ({
      id: message.id,
      disputeId: message.disputeId,
      hearingId: message.hearingId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      senderHearingRole: message.senderId ? hearingRoleByUserId.get(message.senderId) : undefined,
      type: message.type,
      content: message.content,
      replyToMessageId: message.replyToMessageId,
      relatedEvidenceId: message.relatedEvidenceId,
      attachedEvidenceIds: message.attachedEvidenceIds,
      metadata: message.metadata,
      isHidden: message.isHidden,
      hiddenReason: message.hiddenReason,
      createdAt: message.createdAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            fullName: message.sender.fullName,
            email: message.sender.email,
            role: message.sender.role,
          }
        : undefined,
    }));
  }

  private async getWorkspaceEvidence(
    hearing: Pick<DisputeHearingEntity, 'id' | 'disputeId'>,
    user: Pick<UserEntity, 'id' | 'role'>,
  ) {
    if (!hearing.disputeId) {
      return [];
    }

    try {
      return await this.evidenceService.getEvidenceList(hearing.disputeId, user.id, user.role);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        this.logger.warn(
          `hearing_workspace_evidence_fallback hearingId=${hearing.id} userId=${user.id} reason=${
            error.message || 'forbidden'
          }`,
        );
        return [];
      }

      throw error;
    }
  }

  private async buildWorkspaceDossier(hearing: DisputeHearingEntity) {
    const dispute = hearing.dispute;
    if (!dispute) {
      return {
        dispute: null,
        project: null,
        projectSpec: null,
        milestone: null,
        milestoneTimeline: [],
        contracts: [],
        issues: [],
      };
    }

    const [project, disputedMilestone, milestones, contracts, partyUsers] = await Promise.all([
      dispute.projectId
        ? this.projectRepository.findOne({
            where: { id: dispute.projectId },
            select: [
              'id',
              'title',
              'description',
              'status',
              'totalBudget',
              'currency',
              'pricingModel',
              'startDate',
              'endDate',
              'requestId',
              'clientId',
              'freelancerId',
              'brokerId',
            ],
          })
        : Promise.resolve(null),
      dispute.milestoneId
        ? this.milestoneRepository.findOne({
            where: { id: dispute.milestoneId },
            select: [
              'id',
              'projectId',
              'title',
              'description',
              'status',
              'amount',
              'dueDate',
              'startDate',
              'submittedAt',
              'proofOfWork',
            ],
          })
        : Promise.resolve(null),
      dispute.projectId
        ? this.milestoneRepository.find({
            where: { projectId: dispute.projectId },
            select: ['id', 'title', 'status', 'amount', 'dueDate', 'sortOrder'],
            order: { sortOrder: 'ASC', dueDate: 'ASC' },
            take: 50,
          })
        : Promise.resolve([]),
      dispute.projectId
        ? this.contractRepository.find({
            where: { projectId: dispute.projectId },
            select: [
              'id',
              'projectId',
              'title',
              'status',
              'contractUrl',
              'termsContent',
              'createdAt',
            ],
            order: { createdAt: 'DESC' },
            take: 20,
          })
        : Promise.resolve([]),
      this.userRepository.find({
        where: {
          id: In(
            [dispute.raisedById, dispute.defendantId, dispute.assignedStaffId].filter(
              (value): value is string => Boolean(value),
            ),
          ),
        },
        select: ['id', 'fullName', 'email', 'role'],
      }),
    ]);

    const projectSpec = project?.requestId
      ? await this.projectSpecRepository.findOne({
          where: { requestId: project.requestId },
          select: ['id', 'title', 'status', 'referenceLinks', 'updatedAt'],
        })
      : null;

    const partyUserById = new Map(partyUsers.map((item) => [item.id, item]));
    const raiserUser = partyUserById.get(dispute.raisedById);
    const defendantUser = partyUserById.get(dispute.defendantId);
    const assignedStaffUser = dispute.assignedStaffId
      ? partyUserById.get(dispute.assignedStaffId)
      : null;

    const issues = [
      {
        code: 'RAISER_CLAIM',
        label: 'Claimant statement',
        value: dispute.reason || null,
      },
      {
        code: 'DEFENDANT_RESPONSE',
        label: 'Defendant response',
        value: dispute.defendantResponse || null,
      },
    ].filter((item) => Boolean(item.value));

    return {
      dispute: {
        id: dispute.id,
        status: dispute.status,
        phase: dispute.phase,
        category: dispute.category,
        disputeType: dispute.disputeType,
        priority: dispute.priority,
        disputedAmount: dispute.disputedAmount,
        createdAt: dispute.createdAt,
        reason: dispute.reason,
        defendantResponse: dispute.defendantResponse,
        raiser: {
          id: dispute.raisedById,
          role: dispute.raiserRole,
          name: this.resolveUserDisplayName(raiserUser),
          email: raiserUser?.email,
        },
        defendant: {
          id: dispute.defendantId,
          role: dispute.defendantRole,
          name: this.resolveUserDisplayName(defendantUser),
          email: defendantUser?.email,
        },
        assignedStaff: assignedStaffUser
          ? {
              id: assignedStaffUser.id,
              name: this.resolveUserDisplayName(assignedStaffUser),
              email: assignedStaffUser.email,
            }
          : null,
      },
      project: project
        ? {
            id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            totalBudget: project.totalBudget,
            currency: project.currency,
            pricingModel: project.pricingModel,
            startDate: project.startDate,
            endDate: project.endDate,
            clientId: project.clientId,
            freelancerId: project.freelancerId,
            brokerId: project.brokerId,
          }
        : null,
      projectSpec: projectSpec
        ? {
            id: projectSpec.id,
            title: projectSpec.title,
            status: projectSpec.status,
            referenceLinks: projectSpec.referenceLinks || [],
            updatedAt: projectSpec.updatedAt,
          }
        : null,
      milestone: disputedMilestone
        ? {
            milestoneId: disputedMilestone.id,
            milestoneTitle: disputedMilestone.title,
            milestoneStatus: disputedMilestone.status,
            milestoneAmount: disputedMilestone.amount,
            milestoneDueDate: disputedMilestone.dueDate,
            startDate: disputedMilestone.startDate,
            submittedAt: disputedMilestone.submittedAt,
            proofOfWork: disputedMilestone.proofOfWork,
            description: disputedMilestone.description,
          }
        : null,
      milestoneTimeline: milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        status: milestone.status,
        amount: milestone.amount,
        dueDate: milestone.dueDate,
        sortOrder: milestone.sortOrder,
      })),
      contracts: contracts.map((contract) => ({
        id: contract.id,
        projectId: contract.projectId,
        title: contract.title,
        status: contract.status,
        contractUrl: normalizeContractPdfUrl(contract.id, contract.contractUrl),
        createdAt: contract.createdAt,
        termsPreview: contract.termsContent ? contract.termsContent.slice(0, 280) : null,
        termsContent: contract.termsContent || null,
      })),
      issues,
    };
  }

  async getHearingWorkspace(hearingId: string, user: UserEntity) {
    const hearing = await this.ensureHearingAccess(hearingId, user);
    const confirmationSummaryByHearingId = await this.loadConfirmationSummaryByHearingIds([
      hearing.id,
    ]);
    // Parties should receive their own drafts so the statement composer can reopen them.
    const includeDrafts = true;

    const [permissions, gate, dossier, statements, questions, timeline, evidence, messages] =
      await Promise.all([
        this.buildHearingWorkspacePermissions(hearing, user),
        this.getPresentationToCrossPhaseGateStatus(hearing.id),
        this.buildWorkspaceDossier(hearing),
        this.getHearingStatements(hearing.id, user, { includeDrafts }),
        this.getHearingQuestions(hearing.id, user),
        this.getHearingTimeline(hearing.id, user),
        this.getWorkspaceEvidence(hearing, user),
        this.getWorkspaceMessages(hearing.id, user.role, 120),
      ]);

    const attendance =
      user.role === UserRole.ADMIN || user.role === UserRole.STAFF
        ? await this.getHearingAttendance(hearing.id, user)
        : null;

    const docket = await this.buildDocketForDispute(hearing.disputeId, hearing.dispute?.status);
    const docketEntry = docket.items.find((item) => item.hearingId === hearing.id);
    const hearingSummary = this.mapHearingSummary(
      hearing,
      confirmationSummaryByHearingId,
      docketEntry,
    );
    const currentPhase = hearing.dispute?.phase ?? DisputePhase.PRESENTATION;
    const currentStep = Math.max(1, HEARING_PHASE_SEQUENCE.indexOf(currentPhase) + 1);
    const totalSteps = HEARING_PHASE_SEQUENCE.length;

    return {
      hearing: {
        ...hearingSummary,
        permissions,
      },
      phase: {
        current: currentPhase,
        sequence: HEARING_PHASE_SEQUENCE,
        currentStep,
        totalSteps,
        progressPercent: Math.round((currentStep / totalSteps) * 100),
        gate,
      },
      evidenceIntake: {
        isOpen: hearing.isEvidenceIntakeOpen,
        openedAt: hearing.evidenceIntakeOpenedAt || null,
        closedAt: hearing.evidenceIntakeClosedAt || null,
        openedBy: hearing.evidenceIntakeOpenedBy || null,
        reason: hearing.evidenceIntakeReason || null,
      },
      dossier,
      evidence,
      messages,
      statements,
      questions,
      timeline,
      attendance,
    };
  }

  async openEvidenceIntake(hearingId: string, actorId: string, reason: string) {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['dispute'],
      select: [
        'id',
        'status',
        'isChatRoomActive',
        'moderatorId',
        'isEvidenceIntakeOpen',
        'evidenceIntakeOpenedAt',
        'evidenceIntakeOpenedBy',
        'evidenceIntakeReason',
        'disputeId',
      ],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    const control = await this.canControlSpeaker(hearingId, actorId);
    if (!control.canControl) {
      throw new ForbiddenException(control.reason);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      throw new BadRequestException('Evidence intake can be opened only while hearing is active.');
    }

    const normalizedReason = reason?.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Evidence intake reason is required.');
    }

    const now = new Date();
    await this.hearingRepository.update(hearingId, {
      isEvidenceIntakeOpen: true,
      evidenceIntakeOpenedAt: now,
      evidenceIntakeOpenedBy: actorId,
      evidenceIntakeClosedAt: null,
      evidenceIntakeReason: normalizedReason,
    });

    this.eventEmitter.emit('hearing.evidenceIntakeChanged', {
      hearingId,
      disputeId: hearing.disputeId,
      isOpen: true,
      reason: normalizedReason,
      changedBy: actorId,
      changedAt: now,
    });

    return {
      success: true,
      hearingId,
      isOpen: true,
      reason: normalizedReason,
      openedAt: now,
      openedBy: actorId,
    };
  }

  async closeEvidenceIntake(hearingId: string, actorId: string) {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: ['id', 'status', 'isChatRoomActive', 'disputeId'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    const control = await this.canControlSpeaker(hearingId, actorId);
    if (!control.canControl) {
      throw new ForbiddenException(control.reason);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      throw new BadRequestException('Evidence intake can be managed only during active hearing.');
    }

    const now = new Date();
    await this.hearingRepository.update(hearingId, {
      isEvidenceIntakeOpen: false,
      evidenceIntakeClosedAt: now,
    });

    this.eventEmitter.emit('hearing.evidenceIntakeChanged', {
      hearingId,
      disputeId: hearing.disputeId,
      isOpen: false,
      changedBy: actorId,
      changedAt: now,
    });

    return {
      success: true,
      hearingId,
      isOpen: false,
      closedAt: now,
      closedBy: actorId,
    };
  }

  async getHearingStatements(
    hearingId: string,
    user: UserEntity,
    options: { includeDrafts?: boolean } = {},
  ) {
    const hearing = await this.ensureHearingAccess(hearingId, user);

    const qb = this.statementRepository
      .createQueryBuilder('statement')
      .leftJoinAndSelect('statement.participant', 'participant')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .where('statement.hearingId = :hearingId', { hearingId });

    const canViewDrafts =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.STAFF ||
      hearing.moderatorId === user.id;

    if (options.includeDrafts && !canViewDrafts) {
      const participant = await this.participantRepository.findOne({
        where: { hearingId, userId: user.id },
      });
      if (participant) {
        qb.andWhere('(statement.status = :submitted OR statement.participantId = :participantId)', {
          submitted: HearingStatementStatus.SUBMITTED,
          participantId: participant.id,
        });
      } else {
        qb.andWhere('statement.status = :submitted', {
          submitted: HearingStatementStatus.SUBMITTED,
        });
      }
    } else if (!options.includeDrafts) {
      qb.andWhere('statement.status = :submitted', {
        submitted: HearingStatementStatus.SUBMITTED,
      });
    }

    qb.orderBy('statement.orderIndex', 'ASC').addOrderBy('statement.createdAt', 'ASC');

    const statements = await qb.getMany();
    return statements.map((statement) => this.mapStatementSummary(statement));
  }

  async getHearingQuestions(hearingId: string, user: UserEntity) {
    await this.ensureHearingAccess(hearingId, user);

    const questions = await this.questionRepository.find({
      where: { hearingId },
      relations: ['askedBy', 'targetUser', 'cancelledBy'],
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });

    return questions.map((question) => this.mapQuestionSummary(question));
  }

  async getHearingTimeline(hearingId: string, user: UserEntity) {
    const hearing = await this.ensureHearingAccess(hearingId, user);

    const timeline: Array<{
      id: string;
      type: string;
      occurredAt: Date;
      title: string;
      description?: string;
      actor?: { id: string; fullName?: string; email?: string; role?: string };
      relatedId?: string;
    }> = [];

    const formatUserLabel = (userEntity?: UserEntity | null) =>
      userEntity?.fullName || userEntity?.email || userEntity?.id;

    timeline.push({
      id: `hearing-scheduled-${hearing.id}`,
      type: 'HEARING_SCHEDULED',
      occurredAt: hearing.createdAt,
      title: 'Hearing scheduled',
      description: hearing.scheduledAt
        ? `Scheduled for ${this.formatReminderScheduleTime(hearing.scheduledAt)}`
        : undefined,
      relatedId: hearing.id,
    });

    if (hearing.startedAt) {
      timeline.push({
        id: `hearing-started-${hearing.id}`,
        type: 'HEARING_STARTED',
        occurredAt: hearing.startedAt,
        title: 'Hearing started',
        relatedId: hearing.id,
      });
    }

    if (hearing.endedAt) {
      timeline.push({
        id: `hearing-ended-${hearing.id}`,
        type: 'HEARING_ENDED',
        occurredAt: hearing.endedAt,
        title: 'Hearing ended',
        relatedId: hearing.id,
      });
    }

    if (hearing.status === HearingStatus.PAUSED && hearing.pausedAt) {
      timeline.push({
        id: `hearing-paused-${hearing.id}`,
        type: 'HEARING_PAUSED',
        occurredAt: hearing.pausedAt,
        title: 'Hearing paused',
        description: hearing.pauseReason || undefined,
        relatedId: hearing.id,
      });
    }

    (hearing.participants || []).forEach((participant) => {
      const actor = participant.user
        ? {
            id: participant.user.id,
            fullName: participant.user.fullName,
            email: participant.user.email,
            role: participant.user.role,
          }
        : undefined;

      if (participant.joinedAt) {
        timeline.push({
          id: `participant-joined-${participant.id}`,
          type: 'PARTICIPANT_JOINED',
          occurredAt: participant.joinedAt,
          title: `${formatUserLabel(participant.user)} joined`,
          actor,
          relatedId: participant.userId,
        });
      }

      if (participant.leftAt) {
        timeline.push({
          id: `participant-left-${participant.id}`,
          type: 'PARTICIPANT_LEFT',
          occurredAt: participant.leftAt,
          title: `${formatUserLabel(participant.user)} left`,
          actor,
          relatedId: participant.userId,
        });
      }
    });

    const statements = await this.statementRepository.find({
      where: { hearingId, status: HearingStatementStatus.SUBMITTED },
      relations: ['participant', 'participant.user'],
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });

    statements.forEach((statement) => {
      const actor = statement.participant?.user
        ? {
            id: statement.participant.user.id,
            fullName: statement.participant.user.fullName,
            email: statement.participant.user.email,
            role: statement.participant.user.role,
          }
        : undefined;
      const actorLabel = statement.participant?.user
        ? formatUserLabel(statement.participant.user)
        : 'Participant';

      timeline.push({
        id: `statement-${statement.id}`,
        type: 'STATEMENT_SUBMITTED',
        occurredAt: statement.createdAt,
        title: `${actorLabel} submitted ${statement.type.toLowerCase()} statement`,
        description: statement.title || statement.content?.slice(0, 140),
        actor,
        relatedId: statement.id,
      });
    });

    const questions = await this.questionRepository.find({
      where: { hearingId },
      relations: ['askedBy', 'targetUser', 'cancelledBy'],
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });

    questions.forEach((question) => {
      const askedByLabel = formatUserLabel(question.askedBy);
      const targetLabel = formatUserLabel(question.targetUser);

      timeline.push({
        id: `question-asked-${question.id}`,
        type: 'QUESTION_ASKED',
        occurredAt: question.createdAt,
        title: `${askedByLabel} asked ${targetLabel}`,
        description: question.question,
        actor: question.askedBy
          ? {
              id: question.askedBy.id,
              fullName: question.askedBy.fullName,
              email: question.askedBy.email,
              role: question.askedBy.role,
            }
          : undefined,
        relatedId: question.id,
      });

      if (question.answeredAt) {
        timeline.push({
          id: `question-answered-${question.id}`,
          type: 'QUESTION_ANSWERED',
          occurredAt: question.answeredAt,
          title: `${targetLabel} answered`,
          description: question.answer || undefined,
          actor: question.targetUser
            ? {
                id: question.targetUser.id,
                fullName: question.targetUser.fullName,
                email: question.targetUser.email,
                role: question.targetUser.role,
              }
            : undefined,
          relatedId: question.id,
        });
      }

      if (question.cancelledAt) {
        timeline.push({
          id: `question-cancelled-${question.id}`,
          type: 'QUESTION_CANCELLED',
          occurredAt: question.cancelledAt,
          title: 'Question cancelled',
          description: question.question,
          actor: question.cancelledBy
            ? {
                id: question.cancelledBy.id,
                fullName: question.cancelledBy.fullName,
                email: question.cancelledBy.email,
                role: question.cancelledBy.role,
              }
            : undefined,
          relatedId: question.id,
        });
      }
    });

    return timeline.sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
  }

  async getHearingAttendance(hearingId: string, user: UserEntity) {
    const hearing = await this.ensureHearingAccess(hearingId, user);

    const now = new Date();
    const effectiveEnd = hearing.endedAt ?? now;
    const requiredMinutes = this.getMinimumAttendanceMinutes(hearing.estimatedDurationMinutes);
    const latenessBaseline = hearing.startedAt ?? hearing.scheduledAt;

    const calendarEvent = await this.calendarRepository.findOne({
      where: { referenceType: 'DisputeHearing', referenceId: hearingId },
      relations: ['participants', 'participants.user'],
    });

    const eventParticipants = calendarEvent?.participants ?? [];
    const eventByUser = new Map(
      eventParticipants.map((participant) => [participant.userId, participant]),
    );

    const participants = (hearing.participants || []).map((participant) => {
      const eventParticipant = eventByUser.get(participant.userId);
      const attendanceMinutes = Math.floor(
        this.getParticipantOnlineMinutes(participant, effectiveEnd),
      );
      const lateMinutesRaw = participant.joinedAt
        ? Math.max(0, (participant.joinedAt.getTime() - latenessBaseline.getTime()) / (1000 * 60))
        : 0;
      const computedLateMinutes = Math.floor(lateMinutesRaw);

      let attendanceStatus = eventParticipant?.attendanceStatus ?? AttendanceStatus.NOT_STARTED;

      if (hearing.status !== HearingStatus.SCHEDULED) {
        if (!participant.joinedAt) {
          attendanceStatus =
            hearing.status === HearingStatus.COMPLETED
              ? AttendanceStatus.NO_SHOW
              : AttendanceStatus.NOT_STARTED;
        } else {
          if (computedLateMinutes === 0) {
            attendanceStatus = AttendanceStatus.ON_TIME;
          } else if (computedLateMinutes <= 15) {
            attendanceStatus = AttendanceStatus.LATE;
          } else {
            attendanceStatus = AttendanceStatus.VERY_LATE;
          }
        }
      }

      const isNoShow = hearing.status === HearingStatus.COMPLETED && !participant.joinedAt;

      const userSummary = participant.user
        ? {
            id: participant.user.id,
            fullName: participant.user.fullName,
            email: participant.user.email,
            role: participant.user.role,
          }
        : undefined;

      return {
        participantId: participant.id,
        userId: participant.userId,
        role: participant.role,
        isRequired: participant.isRequired,
        confirmedAt: participant.confirmedAt,
        joinedAt: participant.joinedAt,
        leftAt: participant.leftAt,
        isOnline: participant.isOnline,
        totalOnlineMinutes: participant.totalOnlineMinutes,
        attendanceMinutes,
        lateMinutes: eventParticipant?.lateMinutes ?? computedLateMinutes,
        responseStatus: eventParticipant?.status,
        attendanceStatus,
        isNoShow,
        user: userSummary,
      };
    });

    const totalParticipants = participants.length;
    const requiredParticipants = participants.filter((p) => p.isRequired).length;
    const presentEverJoinedCount = participants.filter((p) => p.joinedAt).length;
    const presentOnlineCount = participants.filter((p) => p.isOnline).length;
    const presentCount = presentEverJoinedCount;
    const noShowCount = participants.filter((p) => p.isNoShow).length;
    const onTimeCount = participants.filter(
      (p) => p.attendanceStatus === AttendanceStatus.ON_TIME,
    ).length;
    const lateCount = participants.filter(
      (p) => p.attendanceStatus === AttendanceStatus.LATE,
    ).length;
    const veryLateCount = participants.filter(
      (p) => p.attendanceStatus === AttendanceStatus.VERY_LATE,
    ).length;

    const totalAttendanceMinutes = participants.reduce(
      (sum, p) => sum + (p.attendanceMinutes || 0),
      0,
    );
    const averageAttendanceMinutes =
      participants.length > 0 ? Math.round(totalAttendanceMinutes / participants.length) : 0;

    return {
      hearingId: hearing.id,
      scheduledAt: hearing.scheduledAt,
      startedAt: hearing.startedAt,
      endedAt: hearing.endedAt,
      estimatedDurationMinutes: hearing.estimatedDurationMinutes,
      requiredAttendanceMinutes: requiredMinutes,
      totals: {
        totalParticipants,
        requiredParticipants,
        presentCount,
        presentOnlineCount,
        presentEverJoinedCount,
        noShowCount,
        onTimeCount,
        lateCount,
        veryLateCount,
        averageAttendanceMinutes,
      },
      participants,
    };
  }

  // ===========================================================================
  // PRESENCE TRACKING (Call from WebSocket gateway)
  // ===========================================================================

  /**
   * Return the current online state of every participant in the hearing.
   * Used by the gateway to emit a bulk presence-sync to a joining client.
   */
  async getParticipantsPresence(
    hearingId: string,
  ): Promise<Array<{ userId: string; isOnline: boolean; totalOnlineMinutes: number }>> {
    const participants = await this.participantRepository.find({
      where: { hearingId },
      select: ['userId', 'isOnline', 'totalOnlineMinutes'],
    });
    return participants.map((p) => ({
      userId: p.userId,
      isOnline: p.isOnline,
      totalOnlineMinutes: p.totalOnlineMinutes || 0,
    }));
  }

  async markParticipantOnline(hearingId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { hearingId, userId },
    });

    if (!participant) {
      // Moderator/admin without a participant row — silently skip
      return;
    }

    const presenceState = await this.hearingPresenceService.incrementPresence(hearingId, userId);

    // Skip duplicate if counter didn't transition AND participant is already online in DB.
    // If the counter didn't transition but DB says offline (counter drift), force the update.
    if (!presenceState.transitioned && participant.isOnline) {
      return;
    }

    const now = new Date();

    if (!participant.joinedAt) {
      participant.joinedAt = now;
    }

    participant.isOnline = true;
    participant.lastOnlineAt = now;

    await this.participantRepository.save(participant);

    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: ['id', 'disputeId'],
    });
    this.eventEmitter.emit('hearing.presenceChanged', {
      hearingId,
      disputeId: hearing?.disputeId,
      participantId: participant.id,
      userId,
      isOnline: true,
      changedAt: now,
      totalOnlineMinutes: participant.totalOnlineMinutes || 0,
    });
  }

  async markParticipantOffline(hearingId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { hearingId, userId },
    });

    if (!participant) {
      // Moderator/admin without a participant row — silently skip
      return;
    }

    const presenceState = await this.hearingPresenceService.decrementPresence(hearingId, userId);
    if (!presenceState.transitioned) {
      return;
    }

    if (!participant.isOnline || !participant.lastOnlineAt) {
      if (!participant.isOnline) {
        return;
      }
    }

    const now = new Date();
    const sessionStart = participant.lastOnlineAt || participant.joinedAt || now;
    const sessionMinutes = Math.max(0, (now.getTime() - sessionStart.getTime()) / (1000 * 60));

    participant.totalOnlineMinutes = Math.floor(
      (participant.totalOnlineMinutes || 0) + sessionMinutes,
    );
    participant.leftAt = now;
    participant.isOnline = false;

    await this.participantRepository.save(participant);

    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: ['id', 'disputeId'],
    });
    this.eventEmitter.emit('hearing.presenceChanged', {
      hearingId,
      disputeId: hearing?.disputeId,
      participantId: participant.id,
      userId,
      isOnline: false,
      changedAt: now,
      totalOnlineMinutes: participant.totalOnlineMinutes || 0,
      lastLeftAt: participant.leftAt,
    });
  }

  // ===========================================================================
  // COMPOSE FUNCTION: scheduleHearing()
  // ===========================================================================

  async scheduleHearing(
    dto: ScheduleHearingDto,
    moderatorId: string,
  ): Promise<{
    manualRequired: boolean;
    reason?: string;
    hearing: DisputeHearingEntity;
    calendarEvent: CalendarEventEntity;
    participants: HearingParticipantEntity[];
    scheduledAt: Date;
    responseDeadline: Date;
    participantConfirmationSummary: HearingParticipantConfirmationSummary;
    warnings: string[];
  }> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: dto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${dto.disputeId} not found`);
    }

    if (isDisputeClosedStatus(dispute.status)) {
      throw new BadRequestException(`Cannot schedule hearing for dispute status ${dispute.status}`);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp');
    }

    const tier = dto.tier || (dispute.currentTier >= 2 ? HearingTier.TIER_2 : HearingTier.TIER_1);
    const durationMinutes = dto.estimatedDurationMinutes || 60;
    const externalMeetingLink = this.normalizeMeetingLink(dto.externalMeetingLink);
    const moderator = await this.userRepository.findOne({
      where: { id: moderatorId },
      select: ['id', 'role'],
    });
    const canUseTestBypass = this.canUseTestSchedulingBypass(moderator?.role, dto.testBypassReason);
    const useEmergencyRules = dto.isEmergency || canUseTestBypass;

    if (tier === HearingTier.TIER_2 || APPEAL_DISPUTE_STATUSES.has(dispute.status)) {
      throw new BadRequestException(
        'Tier 2 hearings are disabled. Appeal review is handled through the admin appeal queue.',
      );
    }

    const existing = await this.hearingRepository.findOne({
      where: {
        disputeId: dispute.id,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS, HearingStatus.PAUSED]),
      },
    });

    if (existing) {
      throw new BadRequestException('An active hearing already exists for this dispute');
    }

    const priorHearings = await this.hearingRepository.find({
      where: { disputeId: dispute.id },
      select: [
        'id',
        'status',
        'scheduledAt',
        'agenda',
        'previousHearingId',
        'hearingNumber',
        'tier',
        'summary',
        'findings',
        'noShowNote',
        'externalMeetingLink',
      ],
      order: {
        hearingNumber: 'ASC',
        scheduledAt: 'ASC',
      },
    });
    const priorDocket = buildHearingDocket(priorHearings, dispute.status);
    const latestDocketEntry =
      priorDocket.latestHearingId != null
        ? (priorDocket.items.find((item) => item.hearingId === priorDocket.latestHearingId) ?? null)
        : null;

    if (
      latestDocketEntry?.status === HearingStatus.COMPLETED &&
      !latestDocketEntry.minutesRecorded
    ) {
      throw new BadRequestException(
        'Record the completed hearing minutes and findings before opening the next hearing.',
      );
    }

    const participantsResult = await this.determineRequiredParticipants(
      dispute.id,
      tier,
      moderatorId,
    );
    const participantIds = participantsResult.participants.map((p) => p.userId);

    const scheduleValidation = await this.validateHearingSchedule(
      scheduledAt,
      participantIds,
      useEmergencyRules,
      durationMinutes,
      {
        bypassMinNotice: canUseTestBypass,
      },
    );

    if (!scheduleValidation.valid) {
      throw new BadRequestException({
        message: 'Hearing schedule conflicts detected',
        conflicts: scheduleValidation.conflicts,
        warnings: scheduleValidation.warnings,
        conflictDetails: scheduleValidation.conflictDetails,
      });
    }

    const responseDeadline = this.calculateResponseDeadline(scheduledAt, useEmergencyRules);

    const now = new Date();

    return this.dataSource.transaction(async (manager) => {
      const hearingRepo = manager.getRepository(DisputeHearingEntity);
      const participantRepo = manager.getRepository(HearingParticipantEntity);
      const calendarRepo = manager.getRepository(CalendarEventEntity);
      const eventParticipantRepo = manager.getRepository(EventParticipantEntity);

      const hearingCount = await hearingRepo.count({
        where: { disputeId: dispute.id },
      });

      const hearing = hearingRepo.create({
        disputeId: dispute.id,
        scheduledAt,
        moderatorId,
        tier,
        status: HearingStatus.SCHEDULED,
        agenda: dto.agenda,
        requiredDocuments: dto.requiredDocuments,
        externalMeetingLink,
        estimatedDurationMinutes: durationMinutes,
        currentSpeakerRole: SpeakerRole.MUTED_ALL,
        hearingNumber: hearingCount + 1,
        previousHearingId: latestDocketEntry?.hearingId ?? undefined,
      });

      const savedHearing = await hearingRepo.save(hearing);

      const hearingParticipants = participantsResult.participants.map((participant) =>
        participantRepo.create({
          hearingId: savedHearing.id,
          userId: participant.userId,
          role: participant.role,
          invitedAt: now,
          confirmedAt: participant.role === HearingParticipantRole.MODERATOR ? now : undefined,
          isRequired: participant.isRequired,
          responseDeadline,
        }),
      );

      const savedParticipants = await participantRepo.save(hearingParticipants);

      const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

      const calendarEvent = calendarRepo.create({
        type: EventType.DISPUTE_HEARING,
        title: `Dispute Hearing #${savedHearing.hearingNumber}`,
        description: dto.agenda,
        startTime: scheduledAt,
        endTime,
        durationMinutes,
        organizerId: moderatorId,
        status: EventStatus.PENDING_CONFIRMATION,
        referenceType: 'DisputeHearing',
        referenceId: savedHearing.id,
        externalMeetingLink,
        metadata: {
          disputeId: dispute.id,
          hearingId: savedHearing.id,
          hearingNumber: savedHearing.hearingNumber,
          projectId: dispute.projectId,
        },
      });

      const savedEvent = await calendarRepo.save(calendarEvent);

      const eventParticipants = participantsResult.participants.map((participant) => {
        const role =
          participant.role === HearingParticipantRole.MODERATOR
            ? ParticipantRole.MODERATOR
            : participant.role === HearingParticipantRole.OBSERVER
              ? ParticipantRole.OBSERVER
              : participant.isRequired
                ? ParticipantRole.REQUIRED
                : ParticipantRole.OPTIONAL;

        const isModerator = participant.role === HearingParticipantRole.MODERATOR;

        return eventParticipantRepo.create({
          eventId: savedEvent.id,
          userId: participant.userId,
          role,
          status: isModerator ? ParticipantStatus.ACCEPTED : ParticipantStatus.PENDING,
          respondedAt: isModerator ? now : undefined,
          responseDeadline,
        });
      });

      const savedEventParticipants = await eventParticipantRepo.save(eventParticipants);

      this.eventEmitter.emit('hearing.scheduled', {
        hearingId: savedHearing.id,
        disputeId: dispute.id,
        scheduledAt: savedHearing.scheduledAt,
        responseDeadline,
        warnings: scheduleValidation.warnings,
      });

      return {
        manualRequired: false,
        hearing: savedHearing,
        calendarEvent: savedEvent,
        participants: savedParticipants,
        scheduledAt: savedHearing.scheduledAt,
        responseDeadline,
        participantConfirmationSummary:
          this.buildParticipantConfirmationSummary(savedEventParticipants),
        warnings: scheduleValidation.warnings,
      };
    });
  }

  // ===========================================================================
  // COMPOSE FUNCTION: startHearing()
  // ===========================================================================

  async startHearing(
    hearingId: string,
    starterId: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    minimumAttendanceMinutes: number;
    startedEarly: boolean;
  }> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['participants', 'dispute'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    await this.assertHearingIsActionable(hearing);

    if (hearing.status !== HearingStatus.SCHEDULED) {
      throw new BadRequestException(`Hearing is ${hearing.status}, cannot start`);
    }

    const starter = await this.userRepository.findOne({
      where: { id: starterId },
      select: ['id', 'role'],
    });

    if (!starter) {
      throw new NotFoundException('Starter not found');
    }

    if (starterId !== hearing.moderatorId && starter.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the assigned moderator or admin can start the hearing');
    }

    const now = new Date();
    const earliestNormalStart = new Date(
      hearing.scheduledAt.getTime() - HEARING_CONFIG.EARLY_START_BUFFER_MINUTES * 60 * 1000,
    );
    const startedEarly = now < earliestNormalStart;

    if (startedEarly) {
      const inviteStatusByUser = await this.loadHearingInviteStatusMap(hearing.id);
      const readiness = this.evaluateRequiredParticipantsReadiness(
        hearing.participants || [],
        inviteStatusByUser,
      );
      if (!readiness.ready) {
        throw new BadRequestException(
          `Hearing cannot start this early unless all required participants are online and ready. ` +
            `Online: ${readiness.onlineCount}/${readiness.totalRequired}. ` +
            `Accepted invites: ${readiness.acceptedCount}/${readiness.totalRequired}.`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const hearingRepo = manager.getRepository(DisputeHearingEntity);
      const participantRepo = manager.getRepository(HearingParticipantEntity);
      const calendarRepo = manager.getRepository(CalendarEventEntity);

      // Update hearing state
      await hearingRepo.update(hearing.id, {
        status: HearingStatus.IN_PROGRESS,
        startedAt: now,
        isChatRoomActive: true,
        currentSpeakerRole: SpeakerRole.ALL,
        pausedAt: null,
        pausedById: null,
        pauseReason: null,
        accumulatedPauseSeconds: 0,
        speakerRoleBeforePause: null,
      });

      // Update participants presence snapshot
      const participants = await participantRepo.find({
        where: { hearingId: hearing.id },
      });

      for (const participant of participants) {
        if (participant.isOnline) {
          if (!participant.joinedAt) {
            participant.joinedAt = now;
          }
          if (!participant.lastOnlineAt) {
            participant.lastOnlineAt = now;
          }
          await participantRepo.save(participant);
        }
      }

      // Update calendar event status
      const calendarEvent = await calendarRepo.findOne({
        where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
      });

      if (calendarEvent) {
        await calendarRepo.update(calendarEvent.id, { status: EventStatus.IN_PROGRESS });
      }
    });

    const minimumAttendanceMinutes = this.getMinimumAttendanceMinutes(
      hearing.estimatedDurationMinutes,
    );

    this.eventEmitter.emit('hearing.started', {
      hearingId: hearing.id,
      startedAt: now,
      startedEarly,
      startedBy: starterId,
      minimumAttendanceMinutes,
    });

    const updatedHearing = await this.hearingRepository.findOne({
      where: { id: hearing.id },
    });

    const hearingForStartNotification = updatedHearing || hearing;
    void this.notifyHearingStarted(hearingForStartNotification).catch((error) => {
      this.logger.warn(
        `Failed to notify hearing start for hearing ${hearing.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    });

    return {
      hearing: updatedHearing || hearing,
      minimumAttendanceMinutes,
      startedEarly,
    };
  }

  async pauseHearing(
    hearingId: string,
    actorId: string,
    reason: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    pausedAt: Date;
    pauseReason: string;
    previousSpeakerRole: SpeakerRole;
  }> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: [
        'id',
        'status',
        'disputeId',
        'moderatorId',
        'isChatRoomActive',
        'isEvidenceIntakeOpen',
        'currentSpeakerRole',
        'accumulatedPauseSeconds',
      ],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException(`Hearing is ${hearing.status}, cannot pause`);
    }

    const actor = await this.userRepository.findOne({
      where: { id: actorId },
      select: ['id', 'role'],
    });

    if (!actor) {
      throw new NotFoundException('Actor not found');
    }

    const isAdmin = actor.role === UserRole.ADMIN;
    if (!isAdmin && actorId !== hearing.moderatorId) {
      throw new ForbiddenException('Only the assigned moderator or admin can pause the hearing');
    }

    const normalizedReason = reason?.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Pause reason is required');
    }

    const pausedAt = new Date();
    const previousSpeakerRole = hearing.currentSpeakerRole;
    this.speakerGracePeriod.delete(hearingId);

    await this.hearingRepository.update(hearingId, {
      status: HearingStatus.PAUSED,
      pausedAt,
      pausedById: actorId,
      pauseReason: normalizedReason,
      speakerRoleBeforePause: previousSpeakerRole,
      currentSpeakerRole: SpeakerRole.MUTED_ALL,
      isChatRoomActive: false,
      isEvidenceIntakeOpen: false,
      evidenceIntakeClosedAt: pausedAt,
    });

    this.eventEmitter.emit('hearing.paused', {
      hearingId,
      disputeId: hearing.disputeId,
      pausedBy: actorId,
      pausedAt,
      reason: normalizedReason,
      previousSpeakerRole,
      accumulatedPauseSeconds: hearing.accumulatedPauseSeconds || 0,
    });

    this.eventEmitter.emit('hearing.speakerControlChanged', {
      hearingId,
      changedBy: actorId,
      previousRole: previousSpeakerRole,
      newRole: SpeakerRole.MUTED_ALL,
      gracePeriodMs: 0,
    });

    const updatedHearing = await this.hearingRepository.findOne({ where: { id: hearingId } });
    return {
      hearing: updatedHearing || hearing,
      pausedAt,
      pauseReason: normalizedReason,
      previousSpeakerRole,
    };
  }

  async resumeHearing(
    hearingId: string,
    actorId: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    resumedAt: Date;
    restoredSpeakerRole: SpeakerRole;
    accumulatedPauseSeconds: number;
  }> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: [
        'id',
        'status',
        'disputeId',
        'moderatorId',
        'pausedAt',
        'pausedById',
        'pauseReason',
        'currentSpeakerRole',
        'speakerRoleBeforePause',
        'accumulatedPauseSeconds',
      ],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.PAUSED) {
      throw new BadRequestException(`Hearing is ${hearing.status}, cannot resume`);
    }

    const actor = await this.userRepository.findOne({
      where: { id: actorId },
      select: ['id', 'role'],
    });

    if (!actor) {
      throw new NotFoundException('Actor not found');
    }

    const isAdmin = actor.role === UserRole.ADMIN;
    if (!isAdmin && actorId !== hearing.moderatorId) {
      throw new ForbiddenException('Only the assigned moderator or admin can resume the hearing');
    }

    const resumedAt = new Date();
    const elapsedPauseSeconds = hearing.pausedAt
      ? Math.max(0, Math.floor((resumedAt.getTime() - hearing.pausedAt.getTime()) / 1000))
      : 0;
    const accumulatedPauseSeconds = (hearing.accumulatedPauseSeconds || 0) + elapsedPauseSeconds;
    const restoredSpeakerRole = hearing.speakerRoleBeforePause || SpeakerRole.ALL;
    this.speakerGracePeriod.delete(hearingId);

    await this.hearingRepository.update(hearingId, {
      status: HearingStatus.IN_PROGRESS,
      isChatRoomActive: true,
      currentSpeakerRole: restoredSpeakerRole,
      pausedAt: null,
      pausedById: null,
      pauseReason: null,
      speakerRoleBeforePause: null,
      accumulatedPauseSeconds,
    });

    this.eventEmitter.emit('hearing.resumed', {
      hearingId,
      disputeId: hearing.disputeId,
      resumedBy: actorId,
      resumedAt,
      restoredSpeakerRole,
      accumulatedPauseSeconds,
    });

    this.eventEmitter.emit('hearing.speakerControlChanged', {
      hearingId,
      changedBy: actorId,
      previousRole: SpeakerRole.MUTED_ALL,
      newRole: restoredSpeakerRole,
      gracePeriodMs: 0,
    });

    const updatedHearing = await this.hearingRepository.findOne({ where: { id: hearingId } });
    return {
      hearing: updatedHearing || hearing,
      resumedAt,
      restoredSpeakerRole,
      accumulatedPauseSeconds,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTION: updateSpeakerControl()
  // ===========================================================================

  async updateSpeakerControl(
    hearingId: string,
    userId: string,
    newRole: SpeakerRole,
  ): Promise<{
    success: boolean;
    previousRole: SpeakerRole;
    newRole: SpeakerRole;
    gracePeriodMs: number;
    gracePeriodUntil?: Date;
  }> {
    const check = await this.canControlSpeaker(hearingId, userId);

    if (!check.canControl) {
      throw new ForbiddenException(check.reason);
    }

    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: ['id', 'status', 'isChatRoomActive', 'currentSpeakerRole', 'disputeId'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      throw new BadRequestException('Chat room is not active');
    }

    const previousRole = hearing.currentSpeakerRole;
    const gracePeriodMs = 0;
    const gracePeriodUntil: Date | undefined = undefined;
    this.speakerGracePeriod.delete(hearingId);

    await this.hearingRepository.update(hearingId, {
      currentSpeakerRole: newRole,
    });

    // Warn if speaker role is now out of sync with the dispute phase
    // (updateSpeakerControl only touches hearing.currentSpeakerRole,
    //  while transitionHearingPhase updates BOTH — this log helps debug
    //  future inconsistencies)
    if (hearing.disputeId) {
      const dispute = await this.disputeRepository.findOne({
        where: { id: hearing.disputeId },
        select: ['id', 'phase'],
      });
      if (dispute?.phase) {
        const expectedRole = this.mapPhaseToSpeakerRole(dispute.phase);
        if (expectedRole !== newRole) {
          this.logger.warn(
            `[updateSpeakerControl] Speaker role desync: hearing ${hearingId} ` +
              `speakerRole=${newRole} but dispute.phase=${dispute.phase} ` +
              `(expected ${expectedRole}). This is OK for ad-hoc overrides ` +
              `but phase transitions should use transitionHearingPhase().`,
          );
        }
      }
    }

    this.eventEmitter.emit('hearing.speakerControlChanged', {
      hearingId,
      changedBy: userId,
      previousRole,
      newRole,
      gracePeriodMs,
      gracePeriodUntil,
    });

    return {
      success: true,
      previousRole,
      newRole,
      gracePeriodMs,
      gracePeriodUntil,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTION: transitionHearingPhase()
  // Chuy盻ハ phase phiﾃｪn tﾃｲa (mapping DisputePhase -> SpeakerRole)
  // Ngh盻却 v盻･ tﾃｲa ﾃ｡n:
  //   PRESENTATION      -> RAISER_ONLY      (Nguyﾃｪn ﾄ柁｡n trﾃｬnh bﾃy)
  //   CROSS_EXAMINATION -> DEFENDANT_ONLY   (B盻・ﾄ柁｡n ph蘯｣n bﾃ｡c/bﾃo ch盻ｯa)
  //   INTERROGATION     -> MODERATOR_ONLY   (Th蘯ｩm phﾃ｡n th蘯ｩm v蘯･n)
  //   DELIBERATION      -> MUTED_ALL        (Ngh盻・ﾃ｡n - khﾃｳa chat toﾃn b盻・
  // ===========================================================================

  /**
   * Mapping t盻ｫ DisputePhase sang SpeakerRole.
   * ﾄ脆ｰ盻｣c s盻ｭ d盻･ng ﾄ黛ｻ・Admin/Staff d盻・dﾃng chuy盻ハ phase phiﾃｪn tﾃｲa
   * mﾃ khﾃｴng c蘯ｧn nh盻・tﾃｪn SpeakerRole c盻･ th盻・
   */
  private mapPhaseToSpeakerRole(phase: DisputePhase): SpeakerRole {
    switch (phase) {
      case DisputePhase.PRESENTATION:
        return SpeakerRole.RAISER_ONLY;
      case DisputePhase.EVIDENCE_SUBMISSION:
        return SpeakerRole.ALL; // Both parties can chat & submit evidence
      case DisputePhase.CROSS_EXAMINATION:
        return SpeakerRole.DEFENDANT_ONLY;
      case DisputePhase.INTERROGATION:
        return SpeakerRole.MODERATOR_ONLY;
      case DisputePhase.DELIBERATION:
        return SpeakerRole.MUTED_ALL;
      default:
        return SpeakerRole.ALL;
    }
  }

  /**
   * Chuy盻ハ phase phiﾃｪn tﾃｲa.
   * T盻ｱ ﾄ黛ｻ冢g map DisputePhase -> SpeakerRole vﾃ c蘯ｭp nh蘯ｭt speaker control,
   * ﾄ黛ｻ渡g th盻拱 c蘯ｭp nh蘯ｭt trﾆｰ盻拵g phase trﾃｪn DisputeEntity ﾄ黛ｻ・gi盻ｯ ﾄ黛ｻ渡g b盻・tr蘯｡ng thﾃ｡i t盻貧g quan.
   *
   * @param hearingId - ID phiﾃｪn tﾃｲa
   * @param phase - Phase m盻嬖 (PRESENTATION, CROSS_EXAMINATION, INTERROGATION, DELIBERATION)
   * @param actorId - ID ngﾆｰ盻拱 th盻ｱc hi盻㌻ (Staff/Admin)
   */
  async transitionHearingPhase(
    hearingId: string,
    phase: DisputePhase,
    actorId: string,
  ): Promise<{
    success: boolean;
    hearing: DisputeHearingEntity;
    previousPhase: DisputePhase | null;
    newPhase: DisputePhase;
    previousSpeakerRole: SpeakerRole;
    newSpeakerRole: SpeakerRole;
    gate?: HearingPhaseGateStatus;
  }> {
    // 1. Tﾃｬm hearing vﾃ validate
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: ['id', 'status', 'isChatRoomActive', 'currentSpeakerRole', 'disputeId'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      throw new BadRequestException('Hearing is not in progress or chat room is not active');
    }

    // 2. Ki盻ノ tra quy盻］ ﾄ訴盻「 khi盻ハ speaker
    const check = await this.canControlSpeaker(hearingId, actorId);
    if (!check.canControl) {
      throw new ForbiddenException(check.reason);
    }

    const dispute = await this.disputeRepository.findOne({
      where: { id: hearing.disputeId },
      select: ['id', 'phase'],
    });
    const previousPhase = dispute?.phase ?? null;

    if (previousPhase === DisputePhase.PRESENTATION && phase === DisputePhase.EVIDENCE_SUBMISSION) {
      // Gate: Raiser must submit at least one statement before leaving PRESENTATION
      const gate = await this.getPresentationToCrossPhaseGateStatus(hearingId);
      if (!gate.canTransition) {
        throw new BadRequestException({
          message: gate.reason || 'Phase transition blocked by hearing gate.',
          errorCode: 'HEARING_PHASE_GATE_BLOCKED',
          gate,
        });
      }
    }

    // 3. Mapping phase -> speakerRole
    const newSpeakerRole = this.mapPhaseToSpeakerRole(phase);
    const previousSpeakerRole = hearing.currentSpeakerRole;

    // 4. C蘯ｭp nh蘯ｭt speaker control trﾃｪn Hearing
    this.speakerGracePeriod.delete(hearingId);
    await this.hearingRepository.update(hearingId, {
      currentSpeakerRole: newSpeakerRole,
    });

    // 4b. Auto-toggle evidence intake for EVIDENCE_SUBMISSION phase (BLTTDS 2015)
    if (phase === DisputePhase.EVIDENCE_SUBMISSION) {
      // Auto-open intake when entering EVIDENCE_SUBMISSION
      await this.hearingRepository.update(hearingId, {
        isEvidenceIntakeOpen: true,
        evidenceIntakeOpenedAt: new Date(),
        evidenceIntakeOpenedBy: actorId,
        evidenceIntakeReason: 'Automatically opened for Evidence Submission phase',
      });
      this.eventEmitter.emit('hearing.evidenceIntakeChanged', {
        hearingId,
        disputeId: hearing.disputeId,
        isOpen: true,
        changedBy: actorId,
        reason: 'Automatically opened for Evidence Submission phase',
      });
    } else if (previousPhase === DisputePhase.EVIDENCE_SUBMISSION) {
      // Auto-close intake when leaving EVIDENCE_SUBMISSION
      await this.hearingRepository.update(hearingId, {
        isEvidenceIntakeOpen: false,
        evidenceIntakeClosedAt: new Date(),
      });
      this.eventEmitter.emit('hearing.evidenceIntakeChanged', {
        hearingId,
        disputeId: hearing.disputeId,
        isOpen: false,
        changedBy: actorId,
        reason: 'Evidence Submission phase ended',
      });
    }

    // 5. C蘯ｭp nh蘯ｭt phase trﾃｪn Dispute ﾄ黛ｻ・ﾄ黛ｻ渡g b盻・tr蘯｡ng thﾃ｡i t盻貧g quan
    if (dispute) {
      await this.disputeRepository.update(dispute.id, { phase });
    }

    // 6. Emit event để Gateway bắn realtime
    const newCurrentStep = Math.max(1, HEARING_PHASE_SEQUENCE.indexOf(phase) + 1);
    this.eventEmitter.emit('hearing.phaseTransitioned', {
      hearingId,
      disputeId: hearing.disputeId,
      changedBy: actorId,
      previousPhase,
      newPhase: phase,
      previousSpeakerRole,
      newSpeakerRole,
      currentStep: newCurrentStep,
    });

    // 7. Auto-set deadlines for statement types allowed in the new phase
    {
      const now = new Date();
      const deadlinesByType: Partial<Record<HearingStatementType, Date>> = {};

      switch (phase) {
        case DisputePhase.PRESENTATION:
          deadlinesByType[HearingStatementType.OPENING] = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
          break;
        case DisputePhase.EVIDENCE_SUBMISSION:
          deadlinesByType[HearingStatementType.EVIDENCE] = new Date(now.getTime() + 60 * 60 * 1000); // 60 min
          deadlinesByType[HearingStatementType.WITNESS_TESTIMONY] = new Date(
            now.getTime() + 60 * 60 * 1000,
          ); // 60 min
          break;
        case DisputePhase.CROSS_EXAMINATION:
          deadlinesByType[HearingStatementType.REBUTTAL] = new Date(now.getTime() + 45 * 60 * 1000); // 45 min
          deadlinesByType[HearingStatementType.OBJECTION] = new Date(
            now.getTime() + 45 * 60 * 1000,
          ); // 45 min
          deadlinesByType[HearingStatementType.SURREBUTTAL] = new Date(
            now.getTime() + 45 * 60 * 1000,
          ); // 45 min
          break;
        case DisputePhase.DELIBERATION:
          deadlinesByType[HearingStatementType.CLOSING] = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
          break;
        // INTERROGATION: moderator Q&A only – no participant statement deadlines
        default:
          break;
      }

      if (Object.keys(deadlinesByType).length > 0) {
        const typesToUpdate = Object.keys(deadlinesByType) as HearingStatementType[];
        // Let TypeORM bind Date values for the timestamp column instead of
        // inlining ISO strings into a CASE expression that Postgres treats as text.
        await Promise.all(
          typesToUpdate.map((type) =>
            this.statementRepository.update(
              {
                hearingId,
                type,
                status: HearingStatementStatus.DRAFT,
              },
              {
                deadline: deadlinesByType[type]!,
              },
            ),
          ),
        );

        this.eventEmitter.emit('hearing.phaseDeadlinesSet', {
          hearingId,
          disputeId: hearing.disputeId,
          phase,
          deadlines: deadlinesByType,
          setBy: actorId,
        });
      }
    }

    this.eventEmitter.emit('hearing.speakerControlChanged', {
      hearingId,
      changedBy: actorId,
      previousRole: previousSpeakerRole,
      newRole: newSpeakerRole,
      gracePeriodMs: 0,
    });

    const updatedHearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
    });

    const gate =
      previousPhase === DisputePhase.PRESENTATION && phase === DisputePhase.EVIDENCE_SUBMISSION
        ? await this.getPresentationToCrossPhaseGateStatus(hearingId)
        : undefined;

    return {
      success: true,
      hearing: updatedHearing || hearing,
      previousPhase,
      newPhase: phase,
      previousSpeakerRole,
      newSpeakerRole,
      gate,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTION: submitHearingStatement()
  // ===========================================================================

  async submitHearingStatement(
    dto: SubmitHearingStatementDto,
    userId: string,
  ): Promise<HearingStatementEntity> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      relations: ['dispute'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    await this.assertHearingIsActionable(hearing);

    if (![HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS].includes(hearing.status)) {
      throw new BadRequestException('Cannot submit statement for a closed hearing');
    }

    const participant = await this.participantRepository.findOne({
      where: { hearingId: hearing.id, userId },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant of this hearing');
    }

    // ── Server-side statement type + role + phase validation ──
    const role = participant.role;
    const statementType = dto.type;
    const currentPhase = hearing.dispute?.phase;

    // Observers cannot submit statements
    if (role === HearingParticipantRole.OBSERVER) {
      throw new ForbiddenException('Observers cannot submit statements');
    }

    // QUESTION type is only for moderators
    if (
      statementType === HearingStatementType.QUESTION &&
      role !== HearingParticipantRole.MODERATOR
    ) {
      throw new BadRequestException('Only moderators can submit QUESTION-type statements');
    }

    // ANSWER type: must have a replyToStatementId
    if (statementType === HearingStatementType.ANSWER && !dto.replyToStatementId) {
      throw new BadRequestException(
        'ANSWER statements must reference a question (replyToStatementId)',
      );
    }

    // OPENING/CLOSING: only for parties (RAISER/DEFENDANT)
    if (
      [HearingStatementType.OPENING, HearingStatementType.CLOSING].includes(statementType) &&
      ![HearingParticipantRole.RAISER, HearingParticipantRole.DEFENDANT].includes(role)
    ) {
      throw new BadRequestException(
        `Only dispute parties (RAISER/DEFENDANT) can submit ${statementType} statements`,
      );
    }

    // Phase-based restrictions (only when hearing is IN_PROGRESS with a defined phase)
    if (hearing.status === HearingStatus.IN_PROGRESS && currentPhase) {
      // OPENING statements should be in PRESENTATION phase
      if (
        statementType === HearingStatementType.OPENING &&
        currentPhase !== DisputePhase.PRESENTATION
      ) {
        throw new BadRequestException(
          'OPENING statements can only be submitted during the PRESENTATION phase',
        );
      }

      // CLOSING statements should be in DELIBERATION phase
      if (
        statementType === HearingStatementType.CLOSING &&
        currentPhase !== DisputePhase.DELIBERATION
      ) {
        throw new BadRequestException(
          'CLOSING statements can only be submitted during the DELIBERATION phase',
        );
      }

      // EVIDENCE type only in EVIDENCE_SUBMISSION or CROSS_EXAMINATION
      if (
        statementType === HearingStatementType.EVIDENCE &&
        ![DisputePhase.EVIDENCE_SUBMISSION, DisputePhase.CROSS_EXAMINATION].includes(currentPhase)
      ) {
        throw new BadRequestException(
          'EVIDENCE statements can only be submitted during EVIDENCE_SUBMISSION or CROSS_EXAMINATION phases',
        );
      }

      // REBUTTAL only in CROSS_EXAMINATION or DELIBERATION
      if (
        statementType === HearingStatementType.REBUTTAL &&
        ![DisputePhase.CROSS_EXAMINATION, DisputePhase.DELIBERATION].includes(currentPhase)
      ) {
        throw new BadRequestException(
          'REBUTTAL statements can only be submitted during CROSS_EXAMINATION or DELIBERATION phases',
        );
      }

      // WITNESS_TESTIMONY: role must be WITNESS, phase must be EVIDENCE_SUBMISSION or CROSS_EXAMINATION
      if (statementType === HearingStatementType.WITNESS_TESTIMONY) {
        if (role !== HearingParticipantRole.WITNESS) {
          throw new BadRequestException(
            'Only WITNESS participants can submit WITNESS_TESTIMONY statements',
          );
        }
        if (
          ![DisputePhase.EVIDENCE_SUBMISSION, DisputePhase.CROSS_EXAMINATION].includes(currentPhase)
        ) {
          throw new BadRequestException(
            'WITNESS_TESTIMONY statements can only be submitted during EVIDENCE_SUBMISSION or CROSS_EXAMINATION phases',
          );
        }
      }

      // OBJECTION: role must be RAISER or DEFENDANT, phase must be CROSS_EXAMINATION, must have replyToStatementId
      if (statementType === HearingStatementType.OBJECTION) {
        if (![HearingParticipantRole.RAISER, HearingParticipantRole.DEFENDANT].includes(role)) {
          throw new BadRequestException(
            'Only dispute parties (RAISER/DEFENDANT) can submit OBJECTION statements',
          );
        }
        if (currentPhase !== DisputePhase.CROSS_EXAMINATION) {
          throw new BadRequestException(
            'OBJECTION statements can only be submitted during the CROSS_EXAMINATION phase',
          );
        }
        if (!dto.replyToStatementId) {
          throw new BadRequestException(
            'OBJECTION statements must reference a statement (replyToStatementId)',
          );
        }
      }

      // SURREBUTTAL: role must be RAISER or DEFENDANT, phase must be CROSS_EXAMINATION or DELIBERATION, must have replyToStatementId
      if (statementType === HearingStatementType.SURREBUTTAL) {
        if (![HearingParticipantRole.RAISER, HearingParticipantRole.DEFENDANT].includes(role)) {
          throw new BadRequestException(
            'Only dispute parties (RAISER/DEFENDANT) can submit SURREBUTTAL statements',
          );
        }
        if (![DisputePhase.CROSS_EXAMINATION, DisputePhase.DELIBERATION].includes(currentPhase)) {
          throw new BadRequestException(
            'SURREBUTTAL statements can only be submitted during CROSS_EXAMINATION or DELIBERATION phases',
          );
        }
        if (!dto.replyToStatementId) {
          throw new BadRequestException(
            'SURREBUTTAL statements must reference a statement (replyToStatementId)',
          );
        }
      }
    }

    const isDraft = dto.isDraft === true;
    const structuredContent = this.normalizeStatementBlocks(dto.contentBlocks);
    const compiledContent = this.compileStatementContent(structuredContent, dto.content);
    const requiresDeclaration = role !== HearingParticipantRole.MODERATOR;

    if (!isDraft && compiledContent.length === 0) {
      throw new BadRequestException('Content is required for submitted statements');
    }

    if (!isDraft && requiresDeclaration && dto.platformDeclarationAccepted !== true) {
      throw new BadRequestException(
        'Please confirm the platform declaration before submitting this statement.',
      );
    }

    if (dto.draftId) {
      const existingDraft = await this.statementRepository.findOne({
        where: { id: dto.draftId, participantId: participant.id },
      });

      if (!existingDraft) {
        throw new NotFoundException('Draft statement not found');
      }

      if (existingDraft.status !== HearingStatementStatus.DRAFT) {
        throw new BadRequestException('Only draft statements can be edited');
      }

      const priorSnapshot = this.buildStatementVersionSnapshot(existingDraft, dto.changeSummary);
      existingDraft.type = dto.type;
      existingDraft.title =
        dto.title !== undefined ? dto.title.trim() || null : existingDraft.title;
      existingDraft.content = compiledContent || existingDraft.content;
      existingDraft.structuredContent = structuredContent ?? existingDraft.structuredContent;
      existingDraft.citedEvidenceIds = dto.citedEvidenceIds ?? existingDraft.citedEvidenceIds;
      existingDraft.attachments = dto.attachments ?? existingDraft.attachments;
      existingDraft.replyToStatementId = dto.replyToStatementId ?? existingDraft.replyToStatementId;
      existingDraft.retractionOfStatementId =
        dto.retractionOfStatementId ?? existingDraft.retractionOfStatementId;
      existingDraft.platformDeclarationAccepted =
        dto.platformDeclarationAccepted ?? existingDraft.platformDeclarationAccepted;
      existingDraft.platformDeclarationAcceptedAt =
        dto.platformDeclarationAccepted === true
          ? new Date()
          : existingDraft.platformDeclarationAcceptedAt;
      existingDraft.versionHistory = [...(existingDraft.versionHistory ?? []), priorSnapshot];
      existingDraft.versionNumber = (existingDraft.versionNumber ?? 1) + 1;

      if (!isDraft) {
        existingDraft.status = HearingStatementStatus.SUBMITTED;
      }

      const saved = await this.statementRepository.save(existingDraft);

      if (!isDraft) {
        await this.emitStatementSubmittedEvent(
          hearing,
          saved.id,
          participant.id,
          saved.type,
          saved.createdAt,
        );

        if (!participant.hasSubmittedStatement) {
          participant.hasSubmittedStatement = true;
          await this.participantRepository.save(participant);
        }
      } else {
        this.eventEmitter.emit('hearing.statementDraftSaved', {
          hearingId: hearing.id,
          statementId: saved.id,
          participantId: participant.id,
        });
      }

      return saved;
    }

    const retractionOfStatementId: string | undefined = dto.retractionOfStatementId;
    let title = dto.title;
    if (retractionOfStatementId) {
      const targetStatement = await this.statementRepository.findOne({
        where: { id: retractionOfStatementId, hearingId: hearing.id },
      });

      if (!targetStatement) {
        throw new BadRequestException('Referenced statement not found in this hearing');
      }

      if (targetStatement.participantId !== participant.id) {
        throw new ForbiddenException('You can only retract your own statements');
      }

      if (targetStatement.status !== HearingStatementStatus.SUBMITTED) {
        throw new BadRequestException('Only submitted statements can be retracted');
      }

      if (!title) {
        title = `Dinh chinh cho ban tuong trinh #${retractionOfStatementId.slice(0, 8)}`;
      }
    }

    const orderIndex =
      (await this.statementRepository.count({ where: { hearingId: hearing.id } })) + 1;

    const statement = this.statementRepository.create({
      hearingId: hearing.id,
      participantId: participant.id,
      type: dto.type,
      title,
      content: compiledContent,
      structuredContent,
      citedEvidenceIds: dto.citedEvidenceIds,
      attachments: dto.attachments,
      replyToStatementId: dto.replyToStatementId,
      retractionOfStatementId,
      orderIndex,
      status: isDraft ? HearingStatementStatus.DRAFT : HearingStatementStatus.SUBMITTED,
      platformDeclarationAccepted: dto.platformDeclarationAccepted === true,
      platformDeclarationAcceptedAt: dto.platformDeclarationAccepted === true ? new Date() : null,
      versionNumber: 1,
      versionHistory: [],
      ...(dto.type === HearingStatementType.OBJECTION
        ? { objectionStatus: 'PENDING' as const }
        : {}),
    });

    const saved = await this.statementRepository.save(statement);

    if (!isDraft) {
      await this.emitStatementSubmittedEvent(
        hearing,
        saved.id,
        participant.id,
        saved.type,
        saved.createdAt,
      );

      if (!participant.hasSubmittedStatement) {
        participant.hasSubmittedStatement = true;
        await this.participantRepository.save(participant);
      }
    } else {
      this.eventEmitter.emit('hearing.statementDraftSaved', {
        hearingId: hearing.id,
        statementId: saved.id,
        participantId: participant.id,
      });
    }

    return saved;
  }

  // ===========================================================================
  // COMPOSE FUNCTION: resolveObjection()
  // ===========================================================================

  /**
   * Resolve an OBJECTION statement by ruling it SUSTAINED or OVERRULED.
   * Only the hearing moderator (or admin) can rule on objections.
   *
   * @param hearingId - The hearing session ID
   * @param dto - Contains statementId and ruling ('SUSTAINED' | 'OVERRULED')
   * @param actorId - The user issuing the ruling (must be moderator/admin)
   */
  async resolveObjection(
    hearingId: string,
    dto: ResolveObjectionDto,
    actorId: string,
  ): Promise<HearingStatementEntity> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      select: ['id', 'status', 'moderatorId', 'disputeId'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException('Objections can only be resolved during an active hearing');
    }

    // Only moderator or admin can resolve objections
    const actor = await this.userRepository.findOne({
      where: { id: actorId },
      select: ['id', 'role'],
    });

    if (!actor) {
      throw new NotFoundException('Actor not found');
    }

    const isModerator = actorId === hearing.moderatorId;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isModerator && !isAdmin) {
      throw new ForbiddenException('Only the hearing moderator or admin can resolve objections');
    }

    // Load the statement
    const statement = await this.statementRepository.findOne({
      where: { id: dto.statementId, hearingId },
      relations: ['participant', 'participant.user'],
    });

    if (!statement) {
      throw new NotFoundException(`Statement ${dto.statementId} not found in this hearing`);
    }

    if (statement.type !== HearingStatementType.OBJECTION) {
      throw new BadRequestException('Only OBJECTION statements can be resolved');
    }

    if (statement.objectionStatus && statement.objectionStatus !== 'PENDING') {
      throw new BadRequestException(
        `Objection has already been resolved as ${statement.objectionStatus}`,
      );
    }

    // Update the ruling
    statement.objectionStatus = dto.ruling;
    const saved = await this.statementRepository.save(statement);

    this.eventEmitter.emit('hearing.objectionResolved', {
      hearingId,
      disputeId: hearing.disputeId,
      statementId: saved.id,
      ruling: dto.ruling,
      resolvedBy: actorId,
      resolvedAt: new Date(),
    });

    this.logger.log(
      `Objection ${saved.id} in hearing ${hearingId} resolved as ${dto.ruling} by ${actorId}`,
    );

    return saved;
  }

  // ===========================================================================
  // COMPOSE FUNCTION: askHearingQuestion()
  // ===========================================================================

  async askHearingQuestion(
    dto: AskHearingQuestionDto,
    askedById: string,
  ): Promise<HearingQuestionEntity> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      relations: ['participants', 'dispute'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    await this.assertHearingIsActionable(hearing);

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only ask questions during an active hearing');
    }

    const controlCheck = await this.canControlSpeaker(dto.hearingId, askedById);
    if (!controlCheck.canControl) {
      throw new ForbiddenException(controlCheck.reason);
    }

    const targetParticipant = hearing.participants?.find(
      (participant) => participant.userId === dto.targetUserId,
    );

    if (!targetParticipant) {
      throw new BadRequestException('Target user is not a participant of this hearing');
    }

    if (targetParticipant.role === HearingParticipantRole.MODERATOR) {
      throw new BadRequestException('Cannot ask a question to the moderator');
    }

    const now = new Date();
    const deadlineMinutes = dto.deadlineMinutes ?? 10;
    const deadline = new Date(now.getTime() + deadlineMinutes * 60 * 1000);

    const orderIndex =
      (await this.questionRepository.count({ where: { hearingId: hearing.id } })) + 1;

    const question = this.questionRepository.create({
      hearingId: hearing.id,
      askedById,
      targetUserId: dto.targetUserId,
      question: dto.question,
      deadline,
      isRequired: true,
      orderIndex,
      status: HearingQuestionStatus.PENDING_ANSWER,
    });

    const savedQuestion = await this.questionRepository.save(question);

    // Auto switch speaker role to the target party (if applicable)
    let newSpeakerRole: SpeakerRole | null = null;
    if (targetParticipant.role === HearingParticipantRole.RAISER) {
      newSpeakerRole = SpeakerRole.RAISER_ONLY;
    } else if (targetParticipant.role === HearingParticipantRole.DEFENDANT) {
      newSpeakerRole = SpeakerRole.DEFENDANT_ONLY;
    }

    if (newSpeakerRole) {
      await this.hearingRepository.update(hearing.id, {
        currentSpeakerRole: newSpeakerRole,
      });
    }

    this.eventEmitter.emit('hearing.questionAsked', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      questionId: savedQuestion.id,
      askedById,
      targetUserId: dto.targetUserId,
      deadline,
      createdAt: savedQuestion.createdAt,
    });

    return savedQuestion;
  }

  // ===========================================================================
  // COMPOSE FUNCTION: answerHearingQuestion()
  // ===========================================================================

  async answerHearingQuestion(
    hearingId: string,
    questionId: string,
    answer: string,
    answeredById: string,
  ): Promise<HearingQuestionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const hearing = await manager.findOne(DisputeHearingEntity, {
        where: { id: hearingId },
      });

      if (!hearing) {
        throw new NotFoundException(`Hearing ${hearingId} not found`);
      }

      if (hearing.status !== HearingStatus.IN_PROGRESS) {
        throw new BadRequestException('Can only answer questions during an active hearing');
      }

      // Use pessimistic write lock to prevent concurrent answer race conditions
      // NOTE: Lock query must NOT include relations (LEFT JOINs) because
      // PostgreSQL forbids FOR UPDATE on the nullable side of an outer join.
      const lockedQuestion = await manager.findOne(HearingQuestionEntity, {
        where: { id: questionId, hearingId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedQuestion) {
        throw new NotFoundException(`Question ${questionId} not found in this hearing`);
      }

      // Now load relations separately (without the lock)
      const question = await manager.findOne(HearingQuestionEntity, {
        where: { id: questionId, hearingId },
        relations: ['askedBy', 'targetUser'],
      });

      if (question.targetUserId !== answeredById) {
        throw new ForbiddenException('Only the targeted user can answer this question');
      }

      if (question.status !== HearingQuestionStatus.PENDING_ANSWER) {
        throw new BadRequestException(`Question is already ${question.status}, cannot answer`);
      }

      // Check deadline
      if (question.deadline && new Date() > question.deadline) {
        throw new BadRequestException('The deadline for answering this question has passed');
      }

      // Update question
      question.answer = answer;
      question.answeredAt = new Date();
      question.status = HearingQuestionStatus.ANSWERED;
      const savedQuestion = await manager.save(question);

      // Restore speaker role to moderator only after question answered
      await manager.update(DisputeHearingEntity, hearing.id, {
        currentSpeakerRole: SpeakerRole.MODERATOR_ONLY,
      });

      this.eventEmitter.emit('hearing.questionAnswered', {
        hearingId: hearing.id,
        disputeId: hearing.disputeId,
        questionId: savedQuestion.id,
        answeredById,
        answer,
        answeredAt: savedQuestion.answeredAt,
      });

      return savedQuestion;
    });
  }

  // ===========================================================================
  // COMPOSE FUNCTION: cancelHearingQuestion()
  // ===========================================================================

  async cancelHearingQuestion(hearingId: string, questionId: string, cancelledById: string) {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
    });
    if (!hearing) throw new NotFoundException(`Hearing ${hearingId} not found`);
    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException('Hearing is not in progress');
    }

    const question = await this.questionRepository.findOne({
      where: { id: questionId, hearingId },
    });
    if (!question) throw new NotFoundException(`Question ${questionId} not found`);
    if (question.status !== HearingQuestionStatus.PENDING_ANSWER) {
      throw new BadRequestException('Only pending questions can be cancelled');
    }

    question.status = HearingQuestionStatus.CANCELLED_BY_MODERATOR;
    question.cancelledAt = new Date();
    question.cancelledById = cancelledById;
    const saved = await this.questionRepository.save(question);

    // Restore speaker back to moderator
    await this.hearingRepository.update(hearing.id, {
      currentSpeakerRole: SpeakerRole.MODERATOR_ONLY,
    });

    this.eventEmitter.emit('hearing.questionCancelled', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      questionId: saved.id,
      cancelledById,
    });

    return saved;
  }

  // ===========================================================================
  // COMPOSE FUNCTION: endHearing()
  // ===========================================================================

  private async finalizeHearingEnd(
    hearing: DisputeHearingEntity,
    input: {
      endedById?: string | null;
      endedByType: HearingEndedByType;
      closureReason: HearingClosureReason;
      summary: string;
      findings: string;
      pendingActions?: unknown[] | null;
      forceEnd?: boolean;
      noShowNote?: string | null;
      skipActionableCheck?: boolean;
    },
  ): Promise<{
    hearing: DisputeHearingEntity;
    cancelledQuestions: string[];
    absentParticipants: string[];
  }> {
    if (!input.skipActionableCheck) {
      await this.assertHearingIsActionable(hearing);
    }

    if (![HearingStatus.IN_PROGRESS, HearingStatus.PAUSED].includes(hearing.status)) {
      throw new BadRequestException(`Hearing is ${hearing.status}, cannot end`);
    }

    const summary = input.summary?.trim();
    const findings = input.findings?.trim();
    let noShowNote = input.noShowNote?.trim() || null;
    const pendingActions = normalizeDisputeFollowUpActionInput(input.pendingActions ?? []);

    if (!summary || !findings) {
      throw new BadRequestException({
        code: 'HEARING_MINUTES_REQUIRED',
        message: 'Both summary and findings are required before ending a hearing.',
      });
    }

    const participants = await this.participantRepository.find({
      where: { hearingId: hearing.id },
    });

    const absentRequiredParticipants = participants
      .filter((participant) => participant.isRequired && !participant.joinedAt)
      .map((participant) => ({
        participantId: participant.id,
        userId: participant.userId,
        role: participant.role,
      }));

    if (absentRequiredParticipants.length > 0 && input.endedByType === 'SYSTEM' && !noShowNote) {
      noShowNote =
        'System-generated note: one or more required participants were absent when the hearing was automatically closed.';
    }

    if (absentRequiredParticipants.length > 0 && !noShowNote) {
      throw new BadRequestException({
        code: 'NO_SHOW_NOTE_REQUIRED',
        message: 'A no-show note is required when one or more required participants are absent.',
        absentRequiredParticipants,
      });
    }

    const pendingQuestions = await this.questionRepository.find({
      where: {
        hearingId: hearing.id,
        status: HearingQuestionStatus.PENDING_ANSWER,
      },
    });

    if (pendingQuestions.length > 0 && !input.forceEnd) {
      throw new BadRequestException({
        message:
          'There are unanswered questions. Confirm end to cancel them without penalizing users.',
        pendingQuestions: pendingQuestions.map((question) => ({
          id: question.id,
          targetUserId: question.targetUserId,
          question: question.question,
          deadline: question.deadline,
        })),
      });
    }

    const now = new Date();
    const cancelledQuestions: string[] = [];

    if (pendingQuestions.length > 0) {
      for (const question of pendingQuestions) {
        question.status = HearingQuestionStatus.CANCELLED_BY_MODERATOR;
        question.cancelledAt = now;
        question.cancelledById = input.endedById || null;
        await this.questionRepository.save(question);
        cancelledQuestions.push(question.id);
      }
    }

    for (const participant of participants) {
      if (participant.isOnline) {
        await this.markParticipantOffline(hearing.id, participant.userId);
      }
    }

    const refreshedParticipants = await this.participantRepository.find({
      where: { hearingId: hearing.id },
    });

    const absentParticipants: string[] = [];
    const latenessBaseline = hearing.startedAt || hearing.scheduledAt;

    const calendarEvent = await this.calendarRepository.findOne({
      where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
    });

    if (calendarEvent) {
      const eventParticipants = await this.eventParticipantRepository.find({
        where: { eventId: calendarEvent.id },
      });

      for (const eventParticipant of eventParticipants) {
        const hearingParticipant = refreshedParticipants.find(
          (participant) => participant.userId === eventParticipant.userId,
        );

        if (!hearingParticipant) {
          continue;
        }

        const neverJoined = !hearingParticipant.joinedAt;
        if (neverJoined) {
          eventParticipant.attendanceStatus = AttendanceStatus.NO_SHOW;
          absentParticipants.push(hearingParticipant.userId);
        } else if (hearingParticipant.joinedAt) {
          const lateMinutes = Math.max(
            0,
            (hearingParticipant.joinedAt.getTime() - latenessBaseline.getTime()) / (1000 * 60),
          );
          eventParticipant.lateMinutes = Math.floor(lateMinutes);

          if (lateMinutes > 15) {
            eventParticipant.attendanceStatus = AttendanceStatus.VERY_LATE;
          } else if (lateMinutes > 0) {
            eventParticipant.attendanceStatus = AttendanceStatus.LATE;
          } else {
            eventParticipant.attendanceStatus = AttendanceStatus.ON_TIME;
          }
        }
      }

      await this.eventParticipantRepository.save(eventParticipants);
      await this.calendarRepository.update(calendarEvent.id, { status: EventStatus.COMPLETED });
    }

    await this.hearingRepository.update(hearing.id, {
      status: HearingStatus.COMPLETED,
      endedAt: now,
      isChatRoomActive: false,
      currentSpeakerRole: SpeakerRole.MUTED_ALL,
      accumulatedPauseSeconds: this.getTotalPauseSeconds(hearing),
      pausedAt: null,
      pausedById: null,
      pauseReason: null,
      speakerRoleBeforePause: null,
      summary,
      findings,
      pendingActions: pendingActions.length > 0 ? pendingActions : null,
      noShowNote,
    });

    this.eventEmitter.emit('hearing.ended', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      endedById: input.endedById || null,
      endedByType: input.endedByType,
      closureReason: input.closureReason,
      cancelledQuestions,
      absentParticipants,
    });

    const updated = await this.hearingRepository.findOne({
      where: { id: hearing.id },
    });

    return {
      hearing: updated || hearing,
      cancelledQuestions,
      absentParticipants,
    };
  }

  async endHearing(
    dto: EndHearingDto,
    endedById: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    cancelledQuestions: string[];
    absentParticipants: string[];
  }> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      relations: ['participants', 'dispute'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    const user = await this.userRepository.findOne({
      where: { id: endedById },
      select: ['id', 'role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (endedById !== hearing.moderatorId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the assigned moderator or admin can end the hearing');
    }

    const disputeStatus = hearing.dispute?.status;
    const closingAfterVerdict =
      disputeStatus === DisputeStatus.RESOLVED ||
      (Boolean(disputeStatus) && APPEAL_DISPUTE_STATUSES.has(disputeStatus));

    return await this.finalizeHearingEnd(hearing, {
      endedById,
      endedByType: 'USER',
      closureReason: 'MANUAL_CLOSE',
      summary: dto.summary,
      findings: dto.findings,
      pendingActions: dto.pendingActions,
      forceEnd: dto.forceEnd || closingAfterVerdict,
      noShowNote: dto.noShowNote,
      skipActionableCheck: closingAfterVerdict,
    });
  }

  // ===========================================================================
  // COMPOSE FUNCTION: rescheduleHearing()
  // ===========================================================================

  async rescheduleHearing(
    dto: RescheduleHearingDto,
    requesterId: string,
  ): Promise<{
    manualRequired: boolean;
    reason?: string;
    oldHearing: DisputeHearingEntity;
    newHearing: DisputeHearingEntity;
    calendarEvent: CalendarEventEntity;
    participants: HearingParticipantEntity[];
    scheduledAt: Date;
    responseDeadline: Date;
    participantConfirmationSummary: HearingParticipantConfirmationSummary;
    warnings: string[];
  }> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.SCHEDULED) {
      throw new BadRequestException(`Hearing is ${hearing.status}, cannot reschedule`);
    }

    if (hearing.rescheduleCount >= HEARING_CONFIG.MAX_RESCHEDULES) {
      throw new BadRequestException('Reschedule limit reached');
    }

    const requester = await this.userRepository.findOne({
      where: { id: requesterId },
      select: ['id', 'role'],
    });

    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    const canUseTestBypass = this.canUseTestSchedulingBypass(requester.role, dto.testBypassReason);
    const useEmergencyRules = dto.isEmergency || canUseTestBypass;

    if (requesterId !== hearing.moderatorId && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the assigned moderator or admin can reschedule');
    }

    if (hearing.tier === HearingTier.TIER_2) {
      throw new BadRequestException(
        'Tier 2 hearings are disabled. Appeal review is handled through the admin appeal queue.',
      );
    }

    const now = new Date();
    const rescheduleCutoff = new Date(
      hearing.scheduledAt.getTime() - HEARING_CONFIG.RESCHEDULE_FREEZE_HOURS * 60 * 60 * 1000,
    );

    if (now >= rescheduleCutoff && !useEmergencyRules) {
      throw new BadRequestException({
        code: 'HEARING_RESCHEDULE_FROZEN',
        message: `Reschedule requests are locked within ${HEARING_CONFIG.RESCHEDULE_FREEZE_HOURS} hours of the hearing start. Use emergency reschedule if an exception is required.`,
      });
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp');
    }

    const durationMinutes = dto.estimatedDurationMinutes || hearing.estimatedDurationMinutes;
    const participantIds = (hearing.participants || []).map((participant) => participant.userId);
    const externalMeetingLink =
      dto.externalMeetingLink !== undefined
        ? this.normalizeMeetingLink(dto.externalMeetingLink)
        : hearing.externalMeetingLink;

    const scheduleValidation = await this.validateHearingSchedule(
      scheduledAt,
      participantIds,
      useEmergencyRules,
      durationMinutes,
      {
        bypassMinNotice: canUseTestBypass,
        // Reschedule validation must ignore the current hearing event so it does not self-conflict.
        excludeDisputeHearingId: hearing.id,
      },
    );

    if (!scheduleValidation.valid) {
      throw new BadRequestException({
        message: 'Hearing schedule conflicts detected',
        conflicts: scheduleValidation.conflicts,
        warnings: scheduleValidation.warnings,
        conflictDetails: scheduleValidation.conflictDetails,
      });
    }

    const responseDeadline = this.calculateResponseDeadline(scheduledAt, useEmergencyRules);

    return this.dataSource.transaction(async (manager) => {
      const hearingRepo = manager.getRepository(DisputeHearingEntity);
      const participantRepo = manager.getRepository(HearingParticipantEntity);
      const calendarRepo = manager.getRepository(CalendarEventEntity);
      const eventParticipantRepo = manager.getRepository(EventParticipantEntity);

      const hearingCount = await hearingRepo.count({
        where: { disputeId: hearing.disputeId },
      });

      const newHearing = hearingRepo.create({
        disputeId: hearing.disputeId,
        scheduledAt,
        moderatorId: hearing.moderatorId,
        tier: hearing.tier,
        status: HearingStatus.SCHEDULED,
        agenda: dto.agenda ?? hearing.agenda,
        requiredDocuments: dto.requiredDocuments ?? hearing.requiredDocuments,
        externalMeetingLink,
        estimatedDurationMinutes: durationMinutes,
        currentSpeakerRole: SpeakerRole.MUTED_ALL,
        hearingNumber: hearingCount + 1,
        previousHearingId: hearing.id,
        rescheduleCount: hearing.rescheduleCount + 1,
        lastRescheduledAt: now,
      });

      const savedHearing = await hearingRepo.save(newHearing);

      const hearingParticipants = (hearing.participants || []).map((participant) =>
        participantRepo.create({
          hearingId: savedHearing.id,
          userId: participant.userId,
          role: participant.role,
          invitedAt: now,
          confirmedAt: participant.role === HearingParticipantRole.MODERATOR ? now : undefined,
          isRequired: participant.isRequired,
          responseDeadline,
        }),
      );

      const savedParticipants = await participantRepo.save(hearingParticipants);

      await hearingRepo.update(hearing.id, {
        status: HearingStatus.RESCHEDULED,
        rescheduleCount: hearing.rescheduleCount + 1,
        lastRescheduledAt: now,
      });

      const previousEvent = await calendarRepo.findOne({
        where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
      });

      if (previousEvent) {
        await calendarRepo.update(previousEvent.id, {
          status: EventStatus.RESCHEDULING,
          rescheduleCount: previousEvent.rescheduleCount + 1,
          lastRescheduledAt: now,
        });
      }

      const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

      const calendarEvent = calendarRepo.create({
        type: EventType.DISPUTE_HEARING,
        title: `Dispute Hearing #${savedHearing.hearingNumber}`,
        description: savedHearing.agenda,
        startTime: scheduledAt,
        endTime,
        durationMinutes,
        organizerId: hearing.moderatorId,
        status: EventStatus.PENDING_CONFIRMATION,
        referenceType: 'DisputeHearing',
        referenceId: savedHearing.id,
        externalMeetingLink: savedHearing.externalMeetingLink,
        rescheduleCount: hearing.rescheduleCount + 1,
        previousEventId: previousEvent?.id,
        lastRescheduledAt: now,
        metadata: {
          disputeId: hearing.disputeId,
          hearingId: savedHearing.id,
          hearingNumber: savedHearing.hearingNumber,
          previousHearingId: hearing.id,
          projectId: hearing.dispute?.projectId ?? null,
        },
      });

      const savedEvent = await calendarRepo.save(calendarEvent);

      const eventParticipants = (hearing.participants || []).map((participant) => {
        const role =
          participant.role === HearingParticipantRole.MODERATOR
            ? ParticipantRole.MODERATOR
            : participant.role === HearingParticipantRole.OBSERVER
              ? ParticipantRole.OBSERVER
              : participant.isRequired
                ? ParticipantRole.REQUIRED
                : ParticipantRole.OPTIONAL;

        const isModerator = participant.role === HearingParticipantRole.MODERATOR;

        return eventParticipantRepo.create({
          eventId: savedEvent.id,
          userId: participant.userId,
          role,
          status: isModerator ? ParticipantStatus.ACCEPTED : ParticipantStatus.PENDING,
          respondedAt: isModerator ? now : undefined,
          responseDeadline,
        });
      });

      const savedEventParticipants = await eventParticipantRepo.save(eventParticipants);

      this.eventEmitter.emit('hearing.rescheduled', {
        previousHearingId: hearing.id,
        hearingId: savedHearing.id,
        disputeId: hearing.disputeId,
        scheduledAt: savedHearing.scheduledAt,
        responseDeadline,
        warnings: scheduleValidation.warnings,
      });

      return {
        manualRequired: false,
        oldHearing: hearing,
        newHearing: savedHearing,
        calendarEvent: savedEvent,
        participants: savedParticipants,
        scheduledAt: savedHearing.scheduledAt,
        responseDeadline,
        participantConfirmationSummary:
          this.buildParticipantConfirmationSummary(savedEventParticipants),
        warnings: scheduleValidation.warnings,
      };
    });
  }

  private async assertModeratorOrAdmin(
    hearing: Pick<DisputeHearingEntity, 'moderatorId'>,
    requesterId: string,
  ): Promise<UserEntity> {
    const requester = await this.userRepository.findOne({
      where: { id: requesterId },
      select: ['id', 'role', 'isBanned'],
    });

    if (!requester || requester.isBanned) {
      throw new NotFoundException('Requester not found');
    }

    if (requester.id !== hearing.moderatorId && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the assigned moderator or admin can perform this action');
    }

    return requester;
  }

  async extendHearingDuration(
    dto: ExtendHearingDto,
    requesterId: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    previousDurationMinutes: number;
    newDurationMinutes: number;
    calendarEventUpdated: boolean;
  }> {
    if (!dto.reason?.trim() || dto.reason.trim().length < 8) {
      throw new BadRequestException('Extension reason must be at least 8 characters');
    }

    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      select: [
        'id',
        'disputeId',
        'status',
        'moderatorId',
        'estimatedDurationMinutes',
        'scheduledAt',
        'startedAt',
      ],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    if (![HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS].includes(hearing.status)) {
      throw new BadRequestException('Only scheduled or in-progress hearings can be extended');
    }

    await this.assertModeratorOrAdmin(hearing, requesterId);

    const previousDurationMinutes = hearing.estimatedDurationMinutes || 60;
    const newDurationMinutes = previousDurationMinutes + dto.additionalMinutes;

    if (newDurationMinutes > 600) {
      throw new BadRequestException('Extended hearing duration exceeds 600-minute safety limit');
    }

    let calendarEventUpdated = false;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(DisputeHearingEntity).update(hearing.id, {
        estimatedDurationMinutes: newDurationMinutes,
      });

      const calendarEventRepo = manager.getRepository(CalendarEventEntity);
      const calendarEvent = await calendarEventRepo.findOne({
        where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
        select: ['id', 'startTime', 'durationMinutes'],
      });

      if (calendarEvent) {
        const baseStart = calendarEvent.startTime || hearing.scheduledAt || hearing.startedAt;
        if (baseStart) {
          const nextEndTime = new Date(baseStart.getTime() + newDurationMinutes * 60 * 1000);
          await calendarEventRepo.update(calendarEvent.id, {
            durationMinutes: newDurationMinutes,
            endTime: nextEndTime,
          });
          calendarEventUpdated = true;
        }
      }
    });

    const updated = await this.hearingRepository.findOne({
      where: { id: hearing.id },
    });

    this.eventEmitter.emit('hearing.extended', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      extendedBy: requesterId,
      reason: dto.reason.trim(),
      additionalMinutes: dto.additionalMinutes,
      previousDurationMinutes,
      newDurationMinutes,
      calendarEventUpdated,
    });

    return {
      hearing: updated || hearing,
      previousDurationMinutes,
      newDurationMinutes,
      calendarEventUpdated,
    };
  }

  async inviteSupportStaff(
    dto: InviteSupportStaffDto,
    requesterId: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    participant: HearingParticipantEntity;
    invitedUser: Pick<UserEntity, 'id' | 'email' | 'fullName' | 'role'>;
    alreadyParticipant: boolean;
  }> {
    if (!dto.reason?.trim() || dto.reason.trim().length < 8) {
      throw new BadRequestException('Support invite reason must be at least 8 characters');
    }

    const requestedRole = dto.participantRole || HearingParticipantRole.OBSERVER;
    if (requestedRole === HearingParticipantRole.MODERATOR) {
      throw new BadRequestException('Support invite cannot assign MODERATOR role directly');
    }

    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      relations: ['participants'],
    });
    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    if (![HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS].includes(hearing.status)) {
      throw new BadRequestException(
        'Support can only be invited for scheduled/in-progress hearings',
      );
    }

    await this.assertModeratorOrAdmin(hearing, requesterId);

    const requester = await this.userRepository.findOne({
      where: { id: requesterId },
      select: ['id', 'role'],
    });
    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    const invitedUser = await this.userRepository.findOne({
      where: { id: dto.userId },
      select: ['id', 'email', 'fullName', 'role', 'isBanned'],
    });
    if (!invitedUser || invitedUser.isBanned) {
      throw new NotFoundException('Support user not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(invitedUser.role)) {
      throw new BadRequestException('Only STAFF or ADMIN can be invited as support');
    }

    const existing = hearing.participants?.find((item) => item.userId === invitedUser.id);
    if (existing) {
      return {
        hearing,
        participant: existing,
        invitedUser,
        alreadyParticipant: true,
      };
    }

    const now = new Date();
    const responseDeadline = this.calculateResponseDeadline(
      hearing.scheduledAt,
      hearing.status === HearingStatus.IN_PROGRESS,
    );

    const participant = await this.dataSource.transaction(async (manager) => {
      const participantRepo = manager.getRepository(HearingParticipantEntity);
      const eventParticipantRepo = manager.getRepository(EventParticipantEntity);
      const calendarEventRepo = manager.getRepository(CalendarEventEntity);
      const internalMembershipRepo = manager.getRepository(DisputeInternalMembershipEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);

      const created = await participantRepo.save(
        participantRepo.create({
          hearingId: hearing.id,
          userId: invitedUser.id,
          role: requestedRole,
          invitedAt: now,
          isRequired: false,
          responseDeadline,
        }),
      );

      const calendarEvent = await calendarEventRepo.findOne({
        where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
        select: ['id'],
      });
      if (calendarEvent) {
        await eventParticipantRepo.save(
          eventParticipantRepo.create({
            eventId: calendarEvent.id,
            userId: invitedUser.id,
            role: ParticipantRole.OBSERVER,
            status: ParticipantStatus.PENDING,
            responseDeadline,
          }),
        );
      }

      await internalMembershipRepo
        .createQueryBuilder()
        .insert()
        .into(DisputeInternalMembershipEntity)
        .values({
          disputeId: hearing.disputeId,
          userId: invitedUser.id,
          grantedBy: requesterId,
          source: 'hearing_support_invite',
        })
        .orIgnore()
        .execute();

      await activityRepo.save(
        activityRepo.create({
          disputeId: hearing.disputeId,
          actorId: requesterId,
          actorRole: requester.role,
          action: DisputeAction.NOTE_ADDED,
          description: `Support invite sent to ${invitedUser.fullName || invitedUser.email} as ${requestedRole.toLowerCase()}.`,
          metadata: {
            hearingId: hearing.id,
            invitedUserId: invitedUser.id,
            invitedUserRole: invitedUser.role,
            participantRole: requestedRole,
            reason: dto.reason.trim(),
          },
          isInternal: false,
        }),
      );

      return created;
    });

    this.eventEmitter.emit('hearing.support_invited', {
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      invitedBy: requesterId,
      invitedUserId: invitedUser.id,
      invitedUserRole: invitedUser.role,
      participantRole: requestedRole,
      reason: dto.reason.trim(),
    });

    return {
      hearing,
      participant,
      invitedUser,
      alreadyParticipant: false,
    };
  }

  async getSupportCandidates(
    hearingId: string,
    requesterId: string,
  ): Promise<Array<{ id: string; fullName: string; email: string; role: UserRole }>> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['participants'],
      select: ['id', 'moderatorId', 'status'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (![HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS].includes(hearing.status)) {
      throw new BadRequestException(
        'Support candidates are available for scheduled/in-progress hearings',
      );
    }

    await this.assertModeratorOrAdmin(hearing, requesterId);

    const existingIds = new Set(
      (hearing.participants || []).map((participant) => participant.userId),
    );
    existingIds.add(hearing.moderatorId);

    const users = await this.userRepository.find({
      where: {
        role: In([UserRole.STAFF, UserRole.ADMIN]),
        isBanned: false,
      },
      select: ['id', 'email', 'fullName', 'role'],
      order: { role: 'ASC', fullName: 'ASC' },
      take: 100,
    });

    return users
      .filter((user) => !existingIds.has(user.id))
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }));
  }

  async autoStartDueHearings(referenceAt: Date = new Date()): Promise<{
    referenceAt: string;
    started: number;
    blocked: number;
  }> {
    const dueHearings = await this.hearingRepository
      .createQueryBuilder('hearing')
      .where('hearing.status = :status', { status: HearingStatus.SCHEDULED })
      .andWhere('hearing.scheduledAt <= :referenceAt', { referenceAt })
      .orderBy('hearing.scheduledAt', 'ASC')
      .take(100)
      .getMany();
    const confirmationSummaryByHearingId = await this.loadConfirmationSummaryByHearingIds(
      dueHearings.map((hearing) => hearing.id),
    );

    let started = 0;
    let blocked = 0;

    for (const hearing of dueHearings) {
      const stale = this.isScheduledHearingStale(hearing, referenceAt);
      const event = await this.calendarRepository.findOne({
        where: { referenceType: 'DisputeHearing', referenceId: String(hearing.id) },
        select: ['id', 'status'],
      });

      if (!event) {
        if (stale) {
          await this.expireScheduledHearing(hearing, referenceAt, 'EVENT_NOT_FOUND');
        }
        blocked += 1;
        this.logger.warn(
          `hearing_auto_start_blocked hearingId=${hearing.id} reason=EVENT_NOT_FOUND`,
        );
        continue;
      }

      if (event.status === EventStatus.PENDING_CONFIRMATION) {
        const confirmationSummary = confirmationSummaryByHearingId.get(hearing.id);
        if (confirmationSummary?.confirmationSatisfied) {
          await this.calendarRepository.update(event.id, { status: EventStatus.SCHEDULED });
          event.status = EventStatus.SCHEDULED;
        }
      }

      if (stale) {
        await this.expireScheduledHearing(
          hearing,
          referenceAt,
          `AUTO_START_WINDOW_ELAPSED_EVENT_${event.status}`,
        );
        blocked += 1;
        this.logger.warn(
          `hearing_auto_start_expired hearingId=${hearing.id} reason=AUTO_START_WINDOW_ELAPSED_EVENT_${event.status}`,
        );
        continue;
      }

      if (event.status !== EventStatus.SCHEDULED) {
        blocked += 1;
        this.logger.warn(
          `hearing_auto_start_blocked hearingId=${hearing.id} reason=EVENT_STATUS_${event.status}`,
        );
        continue;
      }

      try {
        await this.startHearing(hearing.id, hearing.moderatorId);
        started += 1;
      } catch (error) {
        blocked += 1;
        this.logger.warn(
          `hearing_auto_start_blocked hearingId=${hearing.id} reason=${
            error instanceof Error ? error.message : 'UNKNOWN'
          }`,
        );
      }
    }

    return {
      referenceAt: referenceAt.toISOString(),
      started,
      blocked,
    };
  }

  async dispatchActiveHearingTimeWarnings(referenceAt: Date = new Date()): Promise<{
    referenceAt: string;
    warnings: number;
  }> {
    const hearings = await this.hearingRepository.find({
      where: {
        status: In([HearingStatus.IN_PROGRESS, HearingStatus.PAUSED]),
      },
      select: [
        'id',
        'disputeId',
        'hearingNumber',
        'moderatorId',
        'status',
        'scheduledAt',
        'startedAt',
        'estimatedDurationMinutes',
        'pausedAt',
        'accumulatedPauseSeconds',
      ],
      take: 100,
      order: { scheduledAt: 'ASC' },
    });

    let warnings = 0;

    for (const hearing of hearings) {
      const participants = await this.participantRepository.find({
        where: { hearingId: hearing.id },
        select: ['userId'],
      });
      const participantIds = Array.from(
        new Set(
          participants
            .map((participant) => participant.userId)
            .concat(hearing.moderatorId ? [hearing.moderatorId] : [])
            .filter(Boolean),
        ),
      );
      const timebox = this.buildHearingTimebox(hearing);

      if (hearing.status === HearingStatus.IN_PROGRESS) {
        const scheduledEndMs = timebox.scheduledEndAt.getTime() - referenceAt.getTime();
        if (
          scheduledEndMs > 0 &&
          scheduledEndMs <= HEARING_CONFIG.AUTO_CLOSE_WARNING_MINUTES * 60_000 &&
          (await this.emitTimeWarningIfNeeded(
            hearing,
            'SCHEDULE_END_WARNING',
            Math.max(1, Math.ceil(scheduledEndMs / 60_000)),
            participantIds,
            timebox,
          ))
        ) {
          warnings += 1;
        }

        const graceMs = timebox.graceEndsAt.getTime() - referenceAt.getTime();
        if (
          referenceAt.getTime() >= timebox.scheduledEndAt.getTime() &&
          graceMs > 0 &&
          graceMs <= HEARING_CONFIG.AUTO_CLOSE_FINAL_WARNING_MINUTES * 60_000 &&
          (await this.emitTimeWarningIfNeeded(
            hearing,
            'GRACE_PERIOD_WARNING',
            Math.max(1, Math.ceil(graceMs / 60_000)),
            participantIds,
            timebox,
          ))
        ) {
          warnings += 1;
        }
      }

      if (hearing.status === HearingStatus.PAUSED && timebox.pauseAutoCloseAt) {
        const pauseMs = timebox.pauseAutoCloseAt.getTime() - referenceAt.getTime();
        if (
          pauseMs > 0 &&
          pauseMs <= HEARING_CONFIG.AUTO_CLOSE_FINAL_WARNING_MINUTES * 60_000 &&
          (await this.emitTimeWarningIfNeeded(
            hearing,
            'PAUSE_AUTO_CLOSE_WARNING',
            Math.max(1, Math.ceil(pauseMs / 60_000)),
            participantIds,
            timebox,
          ))
        ) {
          warnings += 1;
        }
      }
    }

    return {
      referenceAt: referenceAt.toISOString(),
      warnings,
    };
  }

  async autoCloseOverdueHearings(referenceAt: Date = new Date()): Promise<{
    referenceAt: string;
    checked: number;
    closed: number;
    failed: number;
  }> {
    const hearings = await this.hearingRepository.find({
      where: {
        status: HearingStatus.IN_PROGRESS,
      },
      relations: ['participants', 'dispute'],
      take: 100,
      order: { scheduledAt: 'ASC' },
    });

    let checked = 0;
    let closed = 0;
    let failed = 0;

    for (const hearing of hearings) {
      const timebox = this.buildHearingTimebox(hearing);
      if (referenceAt.getTime() < timebox.graceEndsAt.getTime()) {
        continue;
      }

      checked += 1;
      try {
        await this.finalizeHearingEnd(hearing, {
          endedById: null,
          endedByType: 'SYSTEM',
          closureReason: 'TIME_LIMIT_REACHED',
          skipActionableCheck: true,
          ...this.buildSystemClosureMinutes('TIME_LIMIT_REACHED'),
        });
        closed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `hearing_auto_close_failed hearingId=${hearing.id} reason=${
            error instanceof Error ? error.message : 'UNKNOWN'
          }`,
        );
      }
    }

    return {
      referenceAt: referenceAt.toISOString(),
      checked,
      closed,
      failed,
    };
  }

  async autoCloseAbandonedPausedHearings(referenceAt: Date = new Date()): Promise<{
    referenceAt: string;
    checked: number;
    closed: number;
    failed: number;
  }> {
    const hearings = await this.hearingRepository.find({
      where: {
        status: HearingStatus.PAUSED,
      },
      relations: ['participants', 'dispute'],
      take: 100,
      order: { pausedAt: 'ASC' },
    });

    let checked = 0;
    let closed = 0;
    let failed = 0;

    for (const hearing of hearings) {
      const timebox = this.buildHearingTimebox(hearing);
      if (!timebox.pauseAutoCloseAt || referenceAt.getTime() < timebox.pauseAutoCloseAt.getTime()) {
        continue;
      }

      checked += 1;
      try {
        await this.finalizeHearingEnd(hearing, {
          endedById: null,
          endedByType: 'SYSTEM',
          closureReason: 'PAUSE_ABANDONED',
          skipActionableCheck: true,
          ...this.buildSystemClosureMinutes('PAUSE_ABANDONED'),
        });
        closed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `hearing_pause_auto_close_failed hearingId=${hearing.id} reason=${
            error instanceof Error ? error.message : 'UNKNOWN'
          }`,
        );
      }
    }

    return {
      referenceAt: referenceAt.toISOString(),
      checked,
      closed,
      failed,
    };
  }

  async autoRescheduleExpiredPendingHearings(referenceAt: Date = new Date()): Promise<{
    referenceAt: string;
    checked: number;
    repaired: number;
    rescheduled: number;
    flagged: number;
  }> {
    const pendingHearings = await this.hearingRepository
      .createQueryBuilder('hearing')
      .leftJoinAndSelect('hearing.participants', 'participants')
      .innerJoin(
        CalendarEventEntity,
        'event',
        "event.referenceType = 'DisputeHearing' AND event.referenceId = hearing.id::text",
      )
      .where('hearing.status = :hearingStatus', { hearingStatus: HearingStatus.SCHEDULED })
      .andWhere('event.status = :eventStatus', { eventStatus: EventStatus.PENDING_CONFIRMATION })
      .orderBy('hearing.scheduledAt', 'ASC')
      .take(100)
      .getMany();

    const confirmationSummaryByHearingId = await this.loadConfirmationSummaryByHearingIds(
      pendingHearings.map((hearing) => hearing.id),
    );

    let checked = 0;
    let repaired = 0;
    let rescheduled = 0;
    let flagged = 0;

    for (const hearing of pendingHearings) {
      const event = await this.calendarRepository.findOne({
        where: {
          referenceType: 'DisputeHearing',
          referenceId: String(hearing.id),
          status: EventStatus.PENDING_CONFIRMATION,
        },
        select: ['id', 'status', 'metadata'],
      });

      if (!event) {
        continue;
      }

      checked += 1;
      const confirmationSummary = confirmationSummaryByHearingId.get(hearing.id);
      if (confirmationSummary?.confirmationSatisfied) {
        await this.calendarRepository.update(event.id, {
          status: EventStatus.SCHEDULED,
          metadata: {
            ...(event.metadata || {}),
            confirmationSatisfiedAt: referenceAt.toISOString(),
          },
        });
        repaired += 1;
        continue;
      }

      const responseDeadline = this.extractLatestResponseDeadline(confirmationSummary);
      if (!responseDeadline || responseDeadline.getTime() > referenceAt.getTime()) {
        continue;
      }

      if (event.metadata?.manualNoShowReviewRequired) {
        flagged += 1;
        continue;
      }

      if (hearing.rescheduleCount >= HEARING_CONFIG.MAX_RESCHEDULES) {
        await this.markPendingConfirmationForManualReview(
          hearing,
          event,
          'Primary-side confirmation was not received before the 12-hour deadline.',
          referenceAt,
        );
        flagged += 1;
        continue;
      }

      const nextSlot = await this.findNextAutoRescheduleSlot(hearing, referenceAt);
      if (!nextSlot) {
        await this.markPendingConfirmationForManualReview(
          hearing,
          event,
          'Auto-reschedule could not find a feasible next slot after the confirmation deadline.',
          referenceAt,
        );
        flagged += 1;
        continue;
      }

      try {
        await this.rescheduleHearing(
          {
            hearingId: hearing.id,
            scheduledAt: nextSlot.toISOString(),
            agenda: hearing.agenda || undefined,
            requiredDocuments: hearing.requiredDocuments || undefined,
            estimatedDurationMinutes: hearing.estimatedDurationMinutes || undefined,
            externalMeetingLink: hearing.externalMeetingLink || undefined,
            isEmergency:
              referenceAt.getTime() >=
              hearing.scheduledAt.getTime() -
                HEARING_CONFIG.RESCHEDULE_FREEZE_HOURS * 60 * 60 * 1000,
          },
          hearing.moderatorId,
        );
        rescheduled += 1;
      } catch (error) {
        this.logger.warn(
          `hearing_confirmation_timeout_reschedule_failed hearingId=${hearing.id} reason=${
            error instanceof Error ? error.message : 'UNKNOWN'
          }`,
        );
        await this.markPendingConfirmationForManualReview(
          hearing,
          event,
          'Auto-reschedule failed after the confirmation deadline and now requires staff/admin review.',
          referenceAt,
        );
        flagged += 1;
      }
    }

    return {
      referenceAt: referenceAt.toISOString(),
      checked,
      repaired,
      rescheduled,
      flagged,
    };
  }

  private getReminderWindowBounds(
    referenceAt: Date,
    minutesBefore: number,
  ): { from: Date; to: Date } {
    const targetTime = new Date(referenceAt.getTime() + minutesBefore * 60 * 1000);
    const graceMs = HEARING_REMINDER_DISPATCH_GRACE_MINUTES * 60 * 1000;
    return {
      from: new Date(targetTime.getTime() - graceMs),
      to: new Date(targetTime.getTime() + graceMs),
    };
  }

  private reminderLabel(type: HearingReminderType, minutesBefore?: number): string {
    switch (type) {
      case HearingReminderType.T72H:
        return 'in 72 hours';
      case HearingReminderType.T24H:
        return 'in 24 hours';
      case HearingReminderType.T1H:
        return 'in 1 hour';
      case HearingReminderType.T10M:
        return `in ${Math.max(1, Math.round(minutesBefore ?? HEARING_SHORT_REMINDER_LEAD_MINUTES))} minutes`;
      default:
        return 'soon';
    }
  }

  private formatReminderScheduleTime(value: Date): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Unknown time';
    }

    const localTime = parsed.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: HEARING_DISPLAY_TIMEZONE,
    });

    return `${localTime} (${HEARING_DISPLAY_TIMEZONE}, ${HEARING_DISPLAY_TIMEZONE_OFFSET_LABEL})`;
  }

  private resolveReminderProjectTitle(hearing: DisputeHearingEntity): string {
    const title = String(hearing.dispute?.project?.title || '').trim();
    if (title) {
      return title;
    }

    const fallbackProjectId = String(hearing.dispute?.projectId || '').trim();
    if (fallbackProjectId) {
      return `Project ${fallbackProjectId.slice(0, 8)}`;
    }

    return 'dispute project';
  }

  private async sendHearingStartedEmail(
    email: string,
    hearing: Pick<DisputeHearingEntity, 'hearingNumber' | 'scheduledAt'>,
  ): Promise<boolean> {
    const scheduledTime = this.formatReminderScheduleTime(hearing.scheduledAt);

    try {
      await this.emailService.sendPlatformNotification({
        email,
        subject: 'Hearing started now',
        title: 'Your dispute hearing is live',
        body: `Hearing #${hearing.hearingNumber || 1} is now in progress. Scheduled time: ${scheduledTime}. Please join now to avoid no-show handling.`,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to send hearing started email to ${email}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return false;
    }
  }

  private async notifyHearingStarted(
    hearing: Pick<
      DisputeHearingEntity,
      'id' | 'disputeId' | 'hearingNumber' | 'scheduledAt' | 'moderatorId'
    >,
  ): Promise<void> {
    const participants = await this.participantRepository.find({
      where: { hearingId: hearing.id },
      select: ['userId'],
    });

    const recipientIds = Array.from(
      new Set(
        participants
          .map((participant) => participant.userId)
          .concat(hearing.moderatorId ? [hearing.moderatorId] : [])
          .filter(Boolean),
      ),
    );

    if (recipientIds.length === 0) {
      return;
    }

    const recipients = await this.userRepository.find({
      where: {
        id: In(recipientIds),
        isBanned: false,
      },
      select: ['id', 'email'],
    });

    if (recipients.length === 0) {
      return;
    }

    const title = 'Hearing started';
    const scheduledTime = this.formatReminderScheduleTime(hearing.scheduledAt);
    const body = `Hearing #${hearing.hearingNumber || 1} is now in progress. Scheduled time: ${scheduledTime}.`;

    for (const recipient of recipients) {
      const notification = await this.createNotificationOnce({
        userId: recipient.id,
        title,
        body,
        relatedType: 'DisputeHearing',
        relatedId: hearing.id,
      });

      if (!notification) {
        continue;
      }

      let emailSent = false;
      if (recipient.email) {
        emailSent = await this.sendHearingStartedEmail(recipient.email, hearing);
      }

      this.eventEmitter.emit('hearing.started_notification_sent', {
        hearingId: hearing.id,
        disputeId: hearing.disputeId,
        userId: recipient.id,
        notificationId: notification.id,
        emailSent,
      });
    }
  }

  private async sendReminderEmail(
    email: string,
    hearing: DisputeHearingEntity,
    type: HearingReminderType,
    minutesBefore: number,
  ): Promise<boolean> {
    const projectTitle = this.resolveReminderProjectTitle(hearing);
    const leadLabel = this.reminderLabel(type, minutesBefore);
    const scheduledTime = this.formatReminderScheduleTime(hearing.scheduledAt);

    try {
      await this.emailService.sendPlatformNotification({
        email,
        subject: `Hearing reminder (${leadLabel}) - ${projectTitle}`,
        title: `Upcoming dispute hearing for ${projectTitle}`,
        body: `Project under dispute: ${projectTitle}.\nHearing starts ${leadLabel}.\nScheduled time: ${scheduledTime}.`,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to send hearing reminder email to ${email}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return false;
    }
  }

  async dispatchDueHearingReminders(referenceAt: Date = new Date()): Promise<{
    referenceAt: string;
    sent: number;
    skipped: number;
    details: Array<{
      hearingId: string;
      userId: string;
      reminderType: HearingReminderType;
      notificationId: string;
      emailSent: boolean;
    }>;
  }> {
    const details: Array<{
      hearingId: string;
      userId: string;
      reminderType: HearingReminderType;
      notificationId: string;
      emailSent: boolean;
    }> = [];

    let sent = 0;
    let skipped = 0;

    for (const window of HEARING_REMINDER_WINDOWS) {
      const bounds = this.getReminderWindowBounds(referenceAt, window.minutesBefore);
      const hearings = await this.hearingRepository.find({
        where: {
          status: HearingStatus.SCHEDULED,
          scheduledAt: Between(bounds.from, bounds.to),
        },
        relations: ['dispute', 'dispute.project'],
      });

      for (const hearing of hearings) {
        const participants = await this.participantRepository.find({
          where: { hearingId: hearing.id },
          select: ['userId'],
        });

        if (!participants.length) {
          continue;
        }

        for (const participant of participants) {
          const existing = await this.reminderDeliveryRepository.findOne({
            where: {
              hearingId: hearing.id,
              userId: participant.userId,
              reminderType: window.type,
            },
            select: ['id'],
          });
          if (existing) {
            skipped += 1;
            continue;
          }

          const targetUser = await this.userRepository.findOne({
            where: { id: participant.userId, isBanned: false },
            select: ['id', 'email'],
          });
          if (!targetUser) {
            skipped += 1;
            continue;
          }

          const title = 'Hearing reminder';
          const projectTitle = this.resolveReminderProjectTitle(hearing);
          const leadLabel = this.reminderLabel(window.type, window.minutesBefore);
          const scheduledTime = this.formatReminderScheduleTime(hearing.scheduledAt);
          const body = `Project under dispute: ${projectTitle}. Hearing starts ${leadLabel}. Scheduled time: ${scheduledTime}.`;

          const notification = await this.notificationRepository.save(
            this.notificationRepository.create({
              userId: targetUser.id,
              title,
              body,
              relatedType: 'DisputeHearing',
              relatedId: hearing.id,
            }),
          );

          const emailSent = await this.sendReminderEmail(
            targetUser.email,
            hearing,
            window.type,
            window.minutesBefore,
          );
          await this.reminderDeliveryRepository.insert({
            hearingId: hearing.id,
            userId: targetUser.id,
            reminderType: window.type,
            scheduledFor: hearing.scheduledAt,
            notificationId: notification.id,
            emailSent,
            emailSentAt: emailSent ? new Date() : undefined,
          });

          sent += 1;
          details.push({
            hearingId: hearing.id,
            userId: targetUser.id,
            reminderType: window.type,
            notificationId: notification.id,
            emailSent,
          });

          this.eventEmitter.emit('hearing.reminder_sent', {
            hearingId: hearing.id,
            disputeId: hearing.disputeId,
            userId: targetUser.id,
            reminderType: window.type,
            notificationId: notification.id,
            scheduledAt: hearing.scheduledAt,
            reminderLeadMinutes: window.minutesBefore,
            projectTitle,
          });
        }
      }
    }

    return {
      referenceAt: referenceAt.toISOString(),
      sent,
      skipped,
      details,
    };
  }

  // ===========================================================================
  // UNIT FUNCTION: canControlSpeaker()
  // ===========================================================================

  /**
   * Check if user can control speaker role (mute/unmute participants)
   *
   * EDGE CASE ADDRESSED: "Moderator Disconnect"
   * - If moderator goes offline, auto-mute ALL to prevent chaos
   * - Only allow speaker control when moderator is online
   *
   * @param hearingId - The hearing session ID
   * @param userId - User attempting to control speaker
   */
  async canControlSpeaker(hearingId: string, userId: string): Promise<SpeakerControlCheck> {
    // 1. Load hearing
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    // 2. Check if hearing is active
    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      return {
        canControl: false,
        reason: `Hearing is not in progress (status: ${hearing.status})`,
        currentSpeakerRole: hearing.currentSpeakerRole,
        moderatorOnline: false,
      };
    }

    // 3. Find the moderator participant
    const moderatorParticipant = hearing.participants?.find(
      (p) => p.role === HearingParticipantRole.MODERATOR,
    );

    if (!moderatorParticipant) {
      return {
        canControl: false,
        reason: 'No moderator assigned to this hearing',
        currentSpeakerRole: hearing.currentSpeakerRole,
        moderatorOnline: false,
        suggestedAction: 'AUTO_MUTE',
      };
    }

    // 4. Check if moderator is online
    const moderatorOnline = moderatorParticipant.isOnline;

    // 5. Check if user is the moderator
    const isUserModerator = userId === moderatorParticipant.userId;

    // 6. Check if user is Admin (can override)
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'role'],
    });
    const isAdmin = user?.role === UserRole.ADMIN;

    // 7. Apply edge case: Auto-mute if moderator offline
    if (!moderatorOnline && hearing.isChatRoomActive) {
      // Moderator disconnected - suggest auto-mute
      this.logger.warn(
        `Moderator ${moderatorParticipant.userId} is offline for hearing ${hearingId}`,
      );

      // If the user IS the moderator, they are clearly online (making this
      // request right now) even if the DB flag hasn't caught up yet — allow.
      if (isUserModerator) {
        return {
          canControl: true,
          reason: 'Moderator is making the request (presence flag stale)',
          currentSpeakerRole: hearing.currentSpeakerRole,
          moderatorOnline: true,
          suggestedAction: 'CONTINUE',
        };
      }

      // Admin can still control
      if (isAdmin) {
        return {
          canControl: true,
          reason: 'Admin override: Moderator is offline',
          currentSpeakerRole: hearing.currentSpeakerRole,
          moderatorOnline: false,
          suggestedAction: 'AUTO_MUTE',
        };
      }

      // Everyone else is denied
      return {
        canControl: false,
        reason: 'Moderator is offline. Chat is auto-muted until moderator reconnects.',
        currentSpeakerRole: SpeakerRole.MUTED_ALL, // Should be auto-set
        moderatorOnline: false,
        suggestedAction: 'WAIT_MODERATOR',
      };
    }

    // 8. Normal case: Only moderator or admin can control
    if (isUserModerator || isAdmin) {
      return {
        canControl: true,
        currentSpeakerRole: hearing.currentSpeakerRole,
        moderatorOnline,
        suggestedAction: 'CONTINUE',
      };
    }

    return {
      canControl: false,
      reason: 'Only the moderator or admin can control speaker roles',
      currentSpeakerRole: hearing.currentSpeakerRole,
      moderatorOnline,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTION: Handle Moderator Disconnect
  // ===========================================================================

  /**
   * Handle moderator disconnect event
   * Auto-mute all speakers to prevent chaos
   *
   * @param hearingId - The hearing session ID
   * @param moderatorId - The moderator who disconnected
   */
  async handleModeratorDisconnect(hearingId: string, moderatorId: string): Promise<void> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId, moderatorId },
    });

    if (!hearing || hearing.status !== HearingStatus.IN_PROGRESS) {
      return;
    }

    await this.markParticipantOffline(hearingId, moderatorId);

    // Auto-mute all speakers
    const previousRole = hearing.currentSpeakerRole;
    await this.hearingRepository.update(hearingId, {
      currentSpeakerRole: SpeakerRole.MUTED_ALL,
    });

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('hearing.moderatorDisconnect', {
      hearingId,
      moderatorId,
      previousSpeakerRole: previousRole,
      newSpeakerRole: SpeakerRole.MUTED_ALL,
      message:
        '笞・・Moderator has disconnected. Chat is temporarily muted. Please wait for reconnection.',
    });

    this.logger.warn(`Auto-muted hearing ${hearingId} due to moderator ${moderatorId} disconnect`);
  }

  /**
   * Handle moderator reconnect event
   * Restore previous speaker role
   *
   * @param hearingId - The hearing session ID
   * @param moderatorId - The moderator who reconnected
   * @param restorePreviousRole - Optional previous role to restore
   */
  async handleModeratorReconnect(
    hearingId: string,
    moderatorId: string,
    restorePreviousRole?: SpeakerRole,
  ): Promise<void> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId, moderatorId },
    });

    if (!hearing || hearing.status !== HearingStatus.IN_PROGRESS) {
      return;
    }

    await this.markParticipantOnline(hearingId, moderatorId);

    // Restore speaker role (default to MODERATOR_ONLY so moderator can address the situation)
    const roleToRestore = restorePreviousRole || SpeakerRole.MODERATOR_ONLY;
    await this.hearingRepository.update(hearingId, {
      currentSpeakerRole: roleToRestore,
    });

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('hearing.moderatorReconnect', {
      hearingId,
      moderatorId,
      newSpeakerRole: roleToRestore,
      message: '笨・Moderator has reconnected. Session is resuming.',
    });

    this.logger.log(`Moderator ${moderatorId} reconnected to hearing ${hearingId}`);
  }

  // ===========================================================================
  // HELPER: Update Speaker Role
  // ===========================================================================

  /**
   * Update the current speaker role for a hearing
   */
  async updateSpeakerRole(
    hearingId: string,
    userId: string,
    newRole: SpeakerRole,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.updateSpeakerControl(hearingId, userId, newRole);

    return {
      success: result.success,
      message: `Speaker role changed from ${result.previousRole} to ${result.newRole}`,
    };
  }
}
