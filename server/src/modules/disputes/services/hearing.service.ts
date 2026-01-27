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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, LessThan, Between, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import { DisputeEntity, DisputeStatus } from '../../../database/entities/dispute.entity';
import { ProjectEntity } from '../../../database/entities/project.entity';
import { UserEntity, UserRole } from '../../../database/entities/user.entity';
import {
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingParticipantRole,
  HearingStatementEntity,
  HearingStatementStatus,
  HearingStatementType,
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
import { UserAvailabilityEntity } from '../../../database/entities/user-availability.entity';
import {
  ScheduleHearingDto,
  RescheduleHearingDto,
  SubmitHearingStatementDto,
  AskHearingQuestionDto,
  EndHearingDto,
} from '../dto/hearing.dto';

// =============================================================================
// INTERFACES
// =============================================================================

export interface HearingScheduleValidation {
  valid: boolean;
  conflicts: string[];
  warnings: string[];
  isEmergency?: boolean;
  requiresAdminApproval?: boolean;
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

// =============================================================================
// CONSTANTS
// =============================================================================

const HEARING_CONFIG = {
  // Minimum notice period (hours)
  MIN_NOTICE_HOURS: 24,
  EMERGENCY_MIN_NOTICE_HOURS: 1, // For emergency hearings

  // Invitation response deadline
  RESPONSE_DEADLINE_DAYS: 7,
  MIN_CONFIRMATION_BEFORE_START_HOURS: 2,

  // Reschedule limits
  MAX_RESCHEDULES: 3,

  // Moderator offline threshold (minutes)
  MODERATOR_OFFLINE_THRESHOLD: 5,

  // Early start & attendance
  EARLY_START_BUFFER_MINUTES: 15,
  MIN_ATTENDANCE_RATIO: 0.5,

  // Speaker control grace period
  SPEAKER_GRACE_PERIOD_MS: 5000,
} as const;

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class HearingService {
  private readonly logger = new Logger(HearingService.name);
  private readonly speakerGracePeriod = new Map<
    string,
    { previousRole: SpeakerRole; expiresAtMs: number }
  >();

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
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
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
  ): Promise<HearingScheduleValidation> {
    const conflicts: string[] = [];
    const warnings: string[] = [];
    const now = new Date();

    // 1. Check minimum notice period
    const hoursUntilHearing = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (isEmergency) {
      // Emergency: Minimum 1 hour notice
      if (hoursUntilHearing < HEARING_CONFIG.EMERGENCY_MIN_NOTICE_HOURS) {
        conflicts.push(
          `Emergency hearings require at least ${HEARING_CONFIG.EMERGENCY_MIN_NOTICE_HOURS} hour notice`,
        );
      }
      warnings.push('⚠️ Emergency hearing: Requires Admin approval to bypass 24h rule');
    } else {
      // Normal: Minimum 24 hours notice
      if (hoursUntilHearing < HEARING_CONFIG.MIN_NOTICE_HOURS) {
        conflicts.push(
          `Hearings require at least ${HEARING_CONFIG.MIN_NOTICE_HOURS} hours notice. ` +
            `Use isEmergency=true for urgent cases (requires Admin approval).`,
        );
      }
    }

    // 2. Check if scheduled in the past
    if (scheduledAt <= now) {
      conflicts.push('Cannot schedule hearing in the past');
    }

    // 3. Check each participant's availability
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

    for (const participantId of participantIds) {
      // Check calendar conflicts (existing events)
      const conflictingEvents = await this.calendarRepository.find({
        where: [
          {
            organizerId: participantId,
            startTime: LessThan(endTime),
            endTime: MoreThan(scheduledAt),
            status: In([
              EventStatus.SCHEDULED,
              EventStatus.PENDING_CONFIRMATION,
              EventStatus.IN_PROGRESS,
            ]),
          },
        ],
      });

      // Also check if participant is in other events
      // This would require EventParticipantEntity query

      if (conflictingEvents.length > 0) {
        const user = await this.userRepository.findOne({
          where: { id: participantId },
          select: ['id', 'email'],
        });
        const eventTitles = conflictingEvents.map((e) => e.title).join(', ');
        conflicts.push(
          `User ${user?.email || participantId} has conflicting event(s): ${eventTitles}`,
        );
      }

      // Check user availability (blocked time, leave, etc.)
      const blockedAvailability = await this.availabilityRepository.find({
        where: {
          userId: participantId,
          startTime: LessThan(endTime),
          endTime: MoreThan(scheduledAt),
          type: In(['BLOCKED', 'ON_LEAVE']),
        },
      });

      if (blockedAvailability.length > 0) {
        const user = await this.userRepository.findOne({
          where: { id: participantId },
          select: ['id', 'email'],
        });
        warnings.push(`User ${user?.email || participantId} has marked this time as unavailable`);
      }
    }

    // 4. Check working hours (optional - add warning for outside hours)
    const hours = scheduledAt.getHours();
    if (hours < 8 || hours >= 18) {
      warnings.push('⚠️ Hearing is scheduled outside normal working hours (8:00-18:00)');
    }

    // 5. Check weekend
    const dayOfWeek = scheduledAt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push('⚠️ Hearing is scheduled on a weekend');
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      warnings,
      isEmergency,
      requiresAdminApproval: isEmergency,
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

    // 1. Load dispute with project info
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      select: [
        'id',
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
    participants.push({
      userId: dispute.raisedById,
      role: HearingParticipantRole.RAISER,
      isRequired: true,
      userRole: dispute.raiserRole,
      relationToProject: 'raiser',
    });

    // 3. Add Defendant (REQUIRED)
    participants.push({
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

    participants.push({
      userId: moderatorId,
      role: HearingParticipantRole.MODERATOR,
      isRequired: true,
      userRole: moderator.role,
      relationToProject: 'moderator',
    });

    // 5. Query Project to find Broker and other stakeholders
    let hasBroker = false;
    let hasSupervisor = false;

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
          participants.push({
            userId: project.brokerId,
            role: HearingParticipantRole.WITNESS,
            isRequired: true, // Broker is critical - knows the Spec
            userRole: UserRole.BROKER,
            relationToProject: 'broker',
          });
          hasBroker = true;
          this.logger.log(`Added Broker ${project.brokerId} as required WITNESS`);
        }

        // Add Freelancer as OBSERVER if not already a party
        if (
          project.freelancerId &&
          project.freelancerId !== dispute.raisedById &&
          project.freelancerId !== dispute.defendantId
        ) {
          participants.push({
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
          participants.push({
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
        participants.push({
          userId: dispute.assignedStaffId,
          role: HearingParticipantRole.OBSERVER,
          isRequired: false, // Optional - can provide context
          userRole: UserRole.STAFF,
          relationToProject: 'original_staff',
        });
      }
    }

    // 7. Warnings if key people missing
    if (!hasBroker && dispute.projectId) {
      warnings.push('⚠️ No Broker found for this project. Broker testimony may be helpful.');
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

  private calculateResponseDeadline(scheduledAt: Date, isEmergency: boolean): Date {
    const now = new Date();
    const maxDeadline = new Date(
      now.getTime() + HEARING_CONFIG.RESPONSE_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
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

  private areAllRequiredParticipantsReady(participants: HearingParticipantEntity[]): boolean {
    const required = participants.filter((p) => p.isRequired);
    if (required.length === 0) {
      return false;
    }
    return required.every((p) => p.isOnline && !!p.confirmedAt);
  }

  private getMinimumAttendanceMinutes(durationMinutes: number): number {
    return Math.ceil(durationMinutes * HEARING_CONFIG.MIN_ATTENDANCE_RATIO);
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
    switch (speakerRole) {
      case SpeakerRole.ALL:
        return true;
      case SpeakerRole.MODERATOR_ONLY:
        return participantRole === HearingParticipantRole.MODERATOR;
      case SpeakerRole.RAISER_ONLY:
        return participantRole === HearingParticipantRole.RAISER;
      case SpeakerRole.DEFENDANT_ONLY:
        return participantRole === HearingParticipantRole.DEFENDANT;
      case SpeakerRole.MUTED_ALL:
      default:
        return false;
    }
  }

  async getChatPermission(hearingId: string, userId: string): Promise<ChatPermissionResult> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: hearingId },
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      return {
        allowed: false,
        reason: 'Chat room is not active',
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

    const nowMs = Date.now();
    const grace = this.speakerGracePeriod.get(hearingId);
    if (grace && grace.expiresAtMs <= nowMs) {
      this.speakerGracePeriod.delete(hearingId);
    }
    const graceActive = grace && grace.expiresAtMs > nowMs;
    const effectiveRole = graceActive ? grace!.previousRole : hearing.currentSpeakerRole;
    const gracePeriodUntil = graceActive ? new Date(grace!.expiresAtMs) : undefined;

    if (!this.isSpeakerAllowed(effectiveRole, participant.role)) {
      return {
        allowed: false,
        reason: 'You are not allowed to speak at this time',
        hearing,
        participantRole: participant.role,
        effectiveSpeakerRole: effectiveRole,
        gracePeriodUntil,
      };
    }

    return {
      allowed: true,
      hearing,
      participantRole: participant.role,
      effectiveSpeakerRole: effectiveRole,
      gracePeriodUntil,
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
      isRequired: participant.isRequired,
      isOnline: participant.isOnline,
      confirmedAt: participant.confirmedAt,
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
      status: statement.status,
      attachments: statement.attachments,
      replyToStatementId: statement.replyToStatementId,
      retractionOfStatementId: statement.retractionOfStatementId,
      orderIndex: statement.orderIndex,
      isRedacted: statement.isRedacted,
      redactedReason: statement.redactedReason,
      createdAt: statement.createdAt,
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

  private mapHearingSummary(hearing: DisputeHearingEntity) {
    return {
      id: hearing.id,
      disputeId: hearing.disputeId,
      status: hearing.status,
      scheduledAt: hearing.scheduledAt,
      startedAt: hearing.startedAt,
      endedAt: hearing.endedAt,
      agenda: hearing.agenda,
      requiredDocuments: hearing.requiredDocuments,
      externalMeetingLink: hearing.externalMeetingLink,
      moderatorId: hearing.moderatorId,
      currentSpeakerRole: hearing.currentSpeakerRole,
      isChatRoomActive: hearing.isChatRoomActive,
      estimatedDurationMinutes: hearing.estimatedDurationMinutes,
      rescheduleCount: hearing.rescheduleCount,
      previousHearingId: hearing.previousHearingId,
      lastRescheduledAt: hearing.lastRescheduledAt,
      hearingNumber: hearing.hearingNumber,
      tier: hearing.tier,
      participants: (hearing.participants || []).map((participant) =>
        this.mapParticipantSummary(participant),
      ),
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

  async getHearingsForDispute(disputeId: string, user: UserEntity) {
    await this.ensureDisputeAccessForHearings(disputeId, user);

    const hearings = await this.hearingRepository.find({
      where: { disputeId },
      relations: ['participants', 'participants.user'],
      order: { hearingNumber: 'ASC', scheduledAt: 'ASC' },
    });

    return hearings.map((hearing) => this.mapHearingSummary(hearing));
  }

  async getHearingsForUser(
    user: UserEntity,
    options: { statuses?: HearingStatus[]; from?: Date; to?: Date } = {},
  ) {
    const qb = this.hearingRepository
      .createQueryBuilder('hearing')
      .leftJoinAndSelect('hearing.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('hearing.dispute', 'dispute')
      .where('hearing.moderatorId = :userId OR participant.userId = :userId', {
        userId: user.id,
      })
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

    const hearings = await qb.getMany();
    return hearings.map((hearing) => this.mapHearingSummary(hearing));
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
    const isParticipant = (hearing.participants || []).some(
      (participant) => participant.userId === user.id,
    );
    const dispute = hearing.dispute;
    const isParty =
      dispute &&
      (user.id === dispute.raisedById || user.id === dispute.defendantId);
    const isAssignedStaff =
      user.role === UserRole.STAFF && dispute?.assignedStaffId === user.id;
    const isEscalatedAdmin = dispute?.escalatedToAdminId === user.id;

    if (!isModerator && !isParticipant && !isParty && !isAssignedStaff && !isEscalatedAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return hearing;
  }

  async getHearingById(hearingId: string, user: UserEntity) {
    const hearing = await this.ensureHearingAccess(hearingId, user);
    return this.mapHearingSummary(hearing);
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
        qb.andWhere(
          '(statement.status = :submitted OR statement.participantId = :participantId)',
          {
            submitted: HearingStatementStatus.SUBMITTED,
            participantId: participant.id,
          },
        );
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
        ? `Scheduled for ${hearing.scheduledAt.toISOString()}`
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
        ? Math.max(
            0,
            (participant.joinedAt.getTime() - hearing.scheduledAt.getTime()) / (1000 * 60),
          )
        : 0;
      const computedLateMinutes = Math.floor(lateMinutesRaw);

      let attendanceStatus = eventParticipant?.attendanceStatus ?? AttendanceStatus.NOT_STARTED;

      if (hearing.status !== HearingStatus.SCHEDULED) {
        if (!participant.joinedAt) {
          attendanceStatus =
            hearing.status === HearingStatus.COMPLETED
              ? AttendanceStatus.NO_SHOW
              : AttendanceStatus.NOT_STARTED;
        } else if (!eventParticipant) {
          if (computedLateMinutes === 0) {
            attendanceStatus = AttendanceStatus.ON_TIME;
          } else if (computedLateMinutes <= 15) {
            attendanceStatus = AttendanceStatus.LATE;
          } else {
            attendanceStatus = AttendanceStatus.VERY_LATE;
          }
        }
      }

      const isNoShow =
        attendanceStatus === AttendanceStatus.NO_SHOW ||
        (hearing.status === HearingStatus.COMPLETED && attendanceMinutes < requiredMinutes);

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
    const presentCount = participants.filter((p) => p.joinedAt).length;
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

  async markParticipantOnline(hearingId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { hearingId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const now = new Date();

    if (!participant.joinedAt) {
      participant.joinedAt = now;
    }

    participant.isOnline = true;
    participant.lastOnlineAt = now;

    await this.participantRepository.save(participant);
  }

  async markParticipantOffline(hearingId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { hearingId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
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
  }

  // ===========================================================================
  // COMPOSE FUNCTION: scheduleHearing()
  // ===========================================================================

  async scheduleHearing(
    dto: ScheduleHearingDto,
    moderatorId: string,
  ): Promise<{
    hearing: DisputeHearingEntity;
    calendarEvent: CalendarEventEntity;
    participants: HearingParticipantEntity[];
    responseDeadline: Date;
    warnings: string[];
  }> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: dto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${dto.disputeId} not found`);
    }

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
      throw new BadRequestException(`Cannot schedule hearing for dispute status ${dispute.status}`);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp');
    }

    const tier = dto.tier || (dispute.currentTier >= 2 ? HearingTier.TIER_2 : HearingTier.TIER_1);
    const durationMinutes = dto.estimatedDurationMinutes || 60;

    const existing = await this.hearingRepository.findOne({
      where: {
        disputeId: dispute.id,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS]),
      },
    });

    if (existing) {
      throw new BadRequestException('An active hearing already exists for this dispute');
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
      dto.isEmergency || false,
      durationMinutes,
    );

    if (!scheduleValidation.valid) {
      throw new BadRequestException({
        message: 'Hearing schedule conflicts detected',
        conflicts: scheduleValidation.conflicts,
        warnings: scheduleValidation.warnings,
      });
    }

    const responseDeadline = this.calculateResponseDeadline(scheduledAt, dto.isEmergency || false);

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
        externalMeetingLink: dto.externalMeetingLink,
        estimatedDurationMinutes: durationMinutes,
        currentSpeakerRole: SpeakerRole.MUTED_ALL,
        hearingNumber: hearingCount + 1,
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
        externalMeetingLink: dto.externalMeetingLink,
        metadata: {
          disputeId: dispute.id,
          hearingId: savedHearing.id,
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

      await eventParticipantRepo.save(eventParticipants);

      this.eventEmitter.emit('hearing.scheduled', {
        hearingId: savedHearing.id,
        disputeId: dispute.id,
        scheduledAt: savedHearing.scheduledAt,
        responseDeadline,
        warnings: scheduleValidation.warnings,
      });

      return {
        hearing: savedHearing,
        calendarEvent: savedEvent,
        participants: savedParticipants,
        responseDeadline,
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
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

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
      const ready = this.areAllRequiredParticipantsReady(hearing.participants || []);
      if (!ready) {
        throw new BadRequestException(
          'Hearing cannot start this early unless all required participants are online and ready.',
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

    return {
      hearing: updatedHearing || hearing,
      minimumAttendanceMinutes,
      startedEarly,
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
      select: ['id', 'status', 'isChatRoomActive', 'currentSpeakerRole'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS || !hearing.isChatRoomActive) {
      throw new BadRequestException('Chat room is not active');
    }

    const previousRole = hearing.currentSpeakerRole;
    let gracePeriodMs = 0;
    let gracePeriodUntil: Date | undefined;

    if (previousRole === SpeakerRole.ALL && newRole === SpeakerRole.MODERATOR_ONLY) {
      gracePeriodMs = HEARING_CONFIG.SPEAKER_GRACE_PERIOD_MS;
      gracePeriodUntil = new Date(Date.now() + gracePeriodMs);
      this.speakerGracePeriod.set(hearingId, {
        previousRole,
        expiresAtMs: gracePeriodUntil.getTime(),
      });
      setTimeout(() => {
        const current = this.speakerGracePeriod.get(hearingId);
        if (current && current.expiresAtMs <= Date.now()) {
          this.speakerGracePeriod.delete(hearingId);
        }
      }, gracePeriodMs + 100);
    } else {
      this.speakerGracePeriod.delete(hearingId);
    }

    await this.hearingRepository.update(hearingId, {
      currentSpeakerRole: newRole,
    });

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
  // COMPOSE FUNCTION: submitHearingStatement()
  // ===========================================================================

  async submitHearingStatement(
    dto: SubmitHearingStatementDto,
    userId: string,
  ): Promise<HearingStatementEntity> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    if (![HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS].includes(hearing.status)) {
      throw new BadRequestException('Cannot submit statement for a closed hearing');
    }

    const participant = await this.participantRepository.findOne({
      where: { hearingId: hearing.id, userId },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant of this hearing');
    }

    const isDraft = dto.isDraft === true;

    if (!isDraft && (!dto.content || dto.content.trim().length === 0)) {
      throw new BadRequestException('Content is required for submitted statements');
    }

    const now = new Date();

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

      existingDraft.type = dto.type;
      existingDraft.title = dto.title || existingDraft.title;
      existingDraft.content = dto.content ?? existingDraft.content;
      existingDraft.attachments = dto.attachments ?? existingDraft.attachments;
      existingDraft.replyToStatementId = dto.replyToStatementId ?? existingDraft.replyToStatementId;
      existingDraft.retractionOfStatementId =
        dto.retractionOfStatementId ?? existingDraft.retractionOfStatementId;

      if (!isDraft) {
        existingDraft.status = HearingStatementStatus.SUBMITTED;
      }

      const saved = await this.statementRepository.save(existingDraft);

      if (!isDraft) {
        this.eventEmitter.emit('hearing.statementSubmitted', {
          hearingId: hearing.id,
          statementId: saved.id,
          participantId: participant.id,
        });

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

    let retractionOfStatementId: string | undefined = dto.retractionOfStatementId;
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
      content: dto.content ?? '',
      attachments: dto.attachments,
      replyToStatementId: dto.replyToStatementId,
      retractionOfStatementId,
      orderIndex,
      status: isDraft ? HearingStatementStatus.DRAFT : HearingStatementStatus.SUBMITTED,
    });

    const saved = await this.statementRepository.save(statement);

    if (!isDraft) {
      this.eventEmitter.emit('hearing.statementSubmitted', {
        hearingId: hearing.id,
        statementId: saved.id,
        participantId: participant.id,
      });

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
  // COMPOSE FUNCTION: askHearingQuestion()
  // ===========================================================================

  async askHearingQuestion(
    dto: AskHearingQuestionDto,
    askedById: string,
  ): Promise<HearingQuestionEntity> {
    const hearing = await this.hearingRepository.findOne({
      where: { id: dto.hearingId },
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

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
      questionId: savedQuestion.id,
      askedById,
      targetUserId: dto.targetUserId,
      deadline,
    });

    return savedQuestion;
  }

  // ===========================================================================
  // COMPOSE FUNCTION: endHearing()
  // ===========================================================================

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
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException(`Hearing ${dto.hearingId} not found`);
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException(`Hearing is ${hearing.status}, cannot end`);
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

    const pendingQuestions = await this.questionRepository.find({
      where: {
        hearingId: hearing.id,
        status: HearingQuestionStatus.PENDING_ANSWER,
      },
    });

    if (pendingQuestions.length > 0 && !dto.forceEnd) {
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
        question.cancelledById = endedById;
        await this.questionRepository.save(question);
        cancelledQuestions.push(question.id);
      }
    }

    const participants = await this.participantRepository.find({
      where: { hearingId: hearing.id },
    });

    for (const participant of participants) {
      if (participant.isOnline) {
        await this.markParticipantOffline(hearing.id, participant.userId);
      }
    }

    const refreshedParticipants = await this.participantRepository.find({
      where: { hearingId: hearing.id },
    });

    const minimumAttendanceMinutes = this.getMinimumAttendanceMinutes(
      hearing.estimatedDurationMinutes,
    );
    const absentParticipants: string[] = [];

    const calendarEvent = await this.calendarRepository.findOne({
      where: { referenceType: 'DisputeHearing', referenceId: hearing.id },
    });

    if (calendarEvent) {
      const eventParticipants = await this.eventParticipantRepository.find({
        where: { eventId: calendarEvent.id },
      });

      for (const eventParticipant of eventParticipants) {
        const hearingParticipant = refreshedParticipants.find(
          (p) => p.userId === eventParticipant.userId,
        );

        if (!hearingParticipant) {
          continue;
        }

        const onlineMinutes = this.getParticipantOnlineMinutes(hearingParticipant, now);
        const isAbsent = onlineMinutes < minimumAttendanceMinutes;

        if (isAbsent) {
          eventParticipant.attendanceStatus = AttendanceStatus.NO_SHOW;
          absentParticipants.push(hearingParticipant.userId);
        } else if (hearingParticipant.joinedAt) {
          const lateMinutes = Math.max(
            0,
            (hearingParticipant.joinedAt.getTime() - hearing.scheduledAt.getTime()) / (1000 * 60),
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
      summary: dto.summary,
      findings: dto.findings,
      pendingActions: dto.pendingActions,
    });

    this.eventEmitter.emit('hearing.ended', {
      hearingId: hearing.id,
      endedById,
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

  // ===========================================================================
  // COMPOSE FUNCTION: rescheduleHearing()
  // ===========================================================================

  async rescheduleHearing(
    dto: RescheduleHearingDto,
    requesterId: string,
  ): Promise<{
    oldHearing: DisputeHearingEntity;
    newHearing: DisputeHearingEntity;
    calendarEvent: CalendarEventEntity;
    participants: HearingParticipantEntity[];
    responseDeadline: Date;
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

    if (requesterId !== hearing.moderatorId && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the assigned moderator or admin can reschedule');
    }

    const now = new Date();
    const rescheduleCutoff = new Date(
      hearing.scheduledAt.getTime() -
        HEARING_CONFIG.MIN_CONFIRMATION_BEFORE_START_HOURS * 60 * 60 * 1000,
    );

    if (now >= rescheduleCutoff) {
      throw new BadRequestException('Too close to the scheduled time to reschedule');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp');
    }

    const durationMinutes = dto.estimatedDurationMinutes || hearing.estimatedDurationMinutes;
    const participantIds = (hearing.participants || []).map((participant) => participant.userId);

    const scheduleValidation = await this.validateHearingSchedule(
      scheduledAt,
      participantIds,
      dto.isEmergency || false,
      durationMinutes,
    );

    if (!scheduleValidation.valid) {
      throw new BadRequestException({
        message: 'Hearing schedule conflicts detected',
        conflicts: scheduleValidation.conflicts,
        warnings: scheduleValidation.warnings,
      });
    }

    const responseDeadline = this.calculateResponseDeadline(scheduledAt, dto.isEmergency || false);

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
        externalMeetingLink: dto.externalMeetingLink ?? hearing.externalMeetingLink,
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
          previousHearingId: hearing.id,
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

      await eventParticipantRepo.save(eventParticipants);

      this.eventEmitter.emit('hearing.rescheduled', {
        previousHearingId: hearing.id,
        hearingId: savedHearing.id,
        disputeId: hearing.disputeId,
        scheduledAt: savedHearing.scheduledAt,
        responseDeadline,
        warnings: scheduleValidation.warnings,
      });

      return {
        oldHearing: hearing,
        newHearing: savedHearing,
        calendarEvent: savedEvent,
        participants: savedParticipants,
        responseDeadline,
        warnings: scheduleValidation.warnings,
      };
    });
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

      // If user trying to control is not an Admin, deny
      if (!isAdmin) {
        return {
          canControl: false,
          reason: 'Moderator is offline. Chat is auto-muted until moderator reconnects.',
          currentSpeakerRole: SpeakerRole.MUTED_ALL, // Should be auto-set
          moderatorOnline: false,
          suggestedAction: 'WAIT_MODERATOR',
        };
      }

      // Admin can still control
      return {
        canControl: true,
        reason: 'Admin override: Moderator is offline',
        currentSpeakerRole: hearing.currentSpeakerRole,
        moderatorOnline: false,
        suggestedAction: 'AUTO_MUTE',
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
        '⚠️ Moderator has disconnected. Chat is temporarily muted. Please wait for reconnection.',
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
      message: '✅ Moderator has reconnected. Session is resuming.',
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
