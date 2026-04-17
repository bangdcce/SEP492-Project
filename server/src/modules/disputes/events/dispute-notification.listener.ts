import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  DisputeEntity,
  DisputeHearingEntity,
  HearingParticipantEntity,
  ProjectEntity,
  UserEntity,
  UserRole,
  NotificationEntity,
} from 'src/database/entities';
import { DISPUTE_EVENTS } from './dispute.events';
import { DisputeGateway } from '../gateways/dispute.gateway';
import { DisputeEscalationRequestKind } from '../dto/request-escalation.dto';

@Injectable()
export class DisputeNotificationListener {
  private readonly logger = new Logger(DisputeNotificationListener.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly hearingParticipantRepo: Repository<HearingParticipantEntity>,
    private readonly disputeGateway: DisputeGateway,
  ) {}

  private async getDisputeAudience(disputeId: string): Promise<{
    dispute: Pick<
      DisputeEntity,
      'id' | 'projectId' | 'raisedById' | 'defendantId' | 'assignedStaffId' | 'escalatedToAdminId'
    > | null;
    userIds: string[];
  }> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'projectId',
        'raisedById',
        'defendantId',
        'assignedStaffId',
        'escalatedToAdminId',
      ],
    });

    if (!dispute) {
      return {
        dispute: null,
        userIds: [],
      };
    }

    const project = await this.projectRepo.findOne({
      where: { id: dispute.projectId },
      select: ['id', 'clientId', 'freelancerId', 'brokerId'],
    });

    const userIds = new Set<string>();
    [
      dispute.raisedById,
      dispute.defendantId,
      dispute.assignedStaffId,
      dispute.escalatedToAdminId,
      project?.clientId,
      project?.freelancerId,
      project?.brokerId,
    ]
      .filter(Boolean)
      .forEach((id) => userIds.add(id as string));

    return {
      dispute,
      userIds: Array.from(userIds),
    };
  }

  private async getStakeholderRecipientIds(userIds: string[]): Promise<string[]> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const users = await this.userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'role'],
    });

    return users
      .filter((user) => [UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER].includes(user.role))
      .map((user) => user.id);
  }

  private async getUserDisplayMap(
    userIds: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const uniqueIds = Array.from(
      new Set(userIds.filter((userId): userId is string => Boolean(userId))),
    );
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'fullName', 'email'],
    });

    return new Map(
      users.map((user) => [user.id, user.fullName?.trim() || user.email?.trim() || user.id]),
    );
  }

  private formatTimestamp(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value instanceof Date ? value : new Date(value);
    return Number.isNaN(normalized.getTime()) ? null : normalized.toISOString();
  }

  private async resolveDisputeId(
    disputeId?: string | null,
    hearingId?: string | null,
  ): Promise<string | null> {
    if (disputeId) {
      return disputeId;
    }

    if (!hearingId) {
      return null;
    }

    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      select: ['id', 'disputeId'],
    });

    return hearing?.disputeId ?? null;
  }

  @OnEvent(DISPUTE_EVENTS.REJECTED)
  async handleDisputeRejected(payload: {
    disputeId?: string;
    reason?: string;
    dismissalHoldUntil?: Date;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'raisedById', 'defendantId'],
    });
    if (!dispute) {
      return;
    }

    const reason = payload.reason || 'Dispute dismissed';
    const holdText = payload.dismissalHoldUntil
      ? `Hold until ${new Date(payload.dismissalHoldUntil).toISOString()}`
      : undefined;
    const body = [reason, holdText].filter(Boolean).join(' | ');

    await this.createNotifications(
      [dispute.raisedById, dispute.defendantId],
      'Dispute dismissed',
      body,
      'Dispute',
      dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.CREATED)
  async handleDisputeCreated(payload: { disputeId?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    await this.createNotifications(
      audience.userIds,
      'Dispute opened',
      'A dispute case was created and is now in triage.',
      'Dispute',
      audience.dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.INFO_REQUESTED)
  async handleInfoRequested(payload: { disputeId?: string; reason?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'raisedById'],
    });
    if (!dispute) {
      return;
    }

    const body = payload.reason || 'Additional information is required.';
    await this.createNotifications(
      [dispute.raisedById],
      'Additional info requested',
      body,
      'Dispute',
      dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.INFO_PROVIDED)
  async handleInfoProvided(payload: { disputeId?: string; userId?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'assignedStaffId'],
    });
    if (!dispute?.assignedStaffId) {
      return;
    }

    await this.createNotifications(
      [dispute.assignedStaffId],
      'Additional info submitted',
      'Dispute evidence was updated and is ready for review.',
      'Dispute',
      dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.ESCALATED)
  async handleDisputeAccepted(payload: { disputeId?: string; adminId?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'projectId', 'raisedById', 'defendantId', 'assignedStaffId'],
    });
    if (!dispute) {
      return;
    }

    const project = await this.projectRepo.findOne({
      where: { id: dispute.projectId },
      select: ['id', 'clientId', 'freelancerId', 'brokerId'],
    });

    const userIds = new Set<string>();
    [
      dispute.raisedById,
      dispute.defendantId,
      dispute.assignedStaffId,
      project?.clientId,
      project?.freelancerId,
      project?.brokerId,
    ]
      .filter(Boolean)
      .forEach((id) => userIds.add(id as string));

    await this.createNotifications(
      Array.from(userIds),
      'Dispute accepted for mediation',
      'Mediation is starting. Hearing scheduling will follow.',
      'Dispute',
      dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.URGENT_CREATED)
  async handleUrgentDisputeCreated(payload: {
    disputeId?: string;
    category?: string;
    priority?: string;
    assignedStaffId?: string | null;
    resolutionDeadline?: Date;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const admins = await this.getAdminIds();
    const recipients = new Set<string>(admins);

    if (payload.assignedStaffId) {
      recipients.add(payload.assignedStaffId);
    } else {
      const staffUsers = await this.userRepo.find({
        where: { role: UserRole.STAFF, isBanned: false },
        select: ['id'],
      });
      staffUsers.forEach((staff) => recipients.add(staff.id));
    }

    if (recipients.size === 0) {
      return;
    }

    const deadlineLabel = payload.resolutionDeadline
      ? `SLA deadline: ${new Date(payload.resolutionDeadline).toISOString()}`
      : 'Urgent SLA attention required.';

    const parts = [
      payload.priority ? `Priority ${payload.priority}` : null,
      payload.category ? `Category ${payload.category}` : null,
      deadlineLabel,
    ].filter(Boolean);

    await this.createNotifications(
      Array.from(recipients),
      'Urgent dispute requires attention',
      parts.join(' | '),
      'Dispute',
      payload.disputeId,
    );
  }

  @OnEvent('hearing.scheduled')
  async handleHearingScheduled(payload: {
    hearingId?: string;
    disputeId?: string;
    scheduledAt?: Date;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const hearing = await this.hearingRepo.findOne({
      where: { id: payload.hearingId },
      select: ['id', 'disputeId', 'scheduledAt'],
    });
    if (!hearing) {
      return;
    }

    const participants = await this.hearingParticipantRepo.find({
      where: { hearingId: hearing.id },
      select: ['userId'],
    });

    const when = payload.scheduledAt || hearing.scheduledAt;
    const body = when
      ? `Scheduled at ${new Date(when).toISOString()}`
      : 'A hearing has been scheduled.';

    await this.createNotifications(
      participants.map((p) => p.userId),
      'Hearing scheduled',
      body,
      'DisputeHearing',
      hearing.id,
    );
  }

  @OnEvent('hearing.rescheduled')
  async handleHearingRescheduled(payload: {
    hearingId?: string;
    disputeId?: string;
    previousHearingId?: string;
    scheduledAt?: Date;
    responseDeadline?: Date;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const disputeId = await this.resolveDisputeId(payload.disputeId, payload.hearingId);
    if (!disputeId) {
      return;
    }

    const audience = await this.getDisputeAudience(disputeId);
    if (!audience.dispute) {
      return;
    }

    const bodyParts = [
      this.formatTimestamp(payload.scheduledAt)
        ? `A new hearing time was set for ${this.formatTimestamp(payload.scheduledAt)}.`
        : 'A new hearing time was set for this dispute.',
      this.formatTimestamp(payload.responseDeadline)
        ? `Please respond again by ${this.formatTimestamp(payload.responseDeadline)}.`
        : 'Please review the updated invite and respond again.',
    ].filter(Boolean);

    await this.createNotifications(
      audience.userIds,
      'Hearing rescheduled',
      bodyParts.join(' '),
      'DisputeHearing',
      payload.hearingId,
    );
  }

  @OnEvent('hearing.inviteResponded')
  async handleHearingInviteResponded(payload: {
    eventId?: string;
    hearingId?: string | null;
    disputeId?: string | null;
    participantId?: string;
    participantUserId?: string;
    responderId?: string;
    response?: 'accept' | 'decline' | 'tentative' | string;
    responseNote?: string | null;
    eventStatus?: string | null;
    manualRequired?: boolean;
    rescheduleTriggered?: boolean;
    reason?: string | null;
    respondedAt?: Date;
  }): Promise<void> {
    if (payload?.response !== 'decline' || !payload.rescheduleTriggered) {
      return;
    }

    const disputeId = await this.resolveDisputeId(payload.disputeId, payload.hearingId);
    if (!disputeId) {
      return;
    }

    const audience = await this.getDisputeAudience(disputeId);
    if (!audience.dispute) {
      return;
    }

    const userDisplayMap = await this.getUserDisplayMap([payload.responderId]);
    const actorLabel =
      (payload.responderId && userDisplayMap.get(payload.responderId)) || 'A participant';
    const requestReason = payload.responseNote?.trim();
    const statusSentence = payload.manualRequired
      ? payload.reason?.trim()
        ? `Staff review is required before a new hearing time can be confirmed (${payload.reason.trim()}).`
        : 'Staff review is required before a new hearing time can be confirmed.'
      : payload.reason?.trim() === 'Auto reschedule is already in progress'
        ? 'Auto-reschedule is already in progress.'
        : 'The system is automatically finding a new hearing slot now.';

    const bodyParts = [
      `${actorLabel} declined the hearing invite and requested a new time.`,
      requestReason ? `Request note: ${requestReason}.` : null,
      statusSentence,
    ].filter(Boolean);

    await this.createNotifications(
      audience.userIds,
      payload.manualRequired
        ? 'Hearing reschedule needs review'
        : 'Hearing auto-reschedule started',
      bodyParts.join(' '),
      'DisputeHearing',
      payload.hearingId || undefined,
    );
  }

  @OnEvent('verdict.issued')
  async handleVerdictIssued(payload: {
    disputeId?: string;
    verdictId?: string;
    appealDeadline?: Date;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    const bodyParts = [
      'A verdict has been issued for this dispute.',
      payload.appealDeadline
        ? `Appeal deadline: ${new Date(payload.appealDeadline).toISOString()}`
        : null,
    ].filter(Boolean);

    await this.createNotifications(
      audience.userIds,
      'Dispute verdict issued',
      bodyParts.join(' | '),
      'Dispute',
      audience.dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.REJECTION_APPEALED)
  async handleRejectionAppealed(payload: {
    disputeId?: string;
    userId?: string;
    appealDeadline?: Date;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const admins = await this.getAdminIds();
    if (admins.length === 0) {
      return;
    }

    const deadline = payload.appealDeadline
      ? `Review by ${new Date(payload.appealDeadline).toISOString()}`
      : 'Dismissal appeal submitted.';

    await this.createNotifications(
      admins,
      'Dismissal appeal submitted',
      deadline,
      'Dispute',
      payload.disputeId,
    );
  }

  @OnEvent(DISPUTE_EVENTS.REJECTION_APPEAL_RESOLVED)
  async handleRejectionAppealResolved(payload: {
    disputeId?: string;
    accepted?: boolean;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'raisedById', 'defendantId'],
    });
    if (!dispute) {
      return;
    }

    const body = payload.accepted
      ? 'Dismissal overturned. Dispute reopened for mediation.'
      : 'Dismissal upheld after admin review.';

    await this.createNotifications(
      [dispute.raisedById, dispute.defendantId],
      'Dismissal appeal resolved',
      body,
      'Dispute',
      dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.APPEAL_SUBMITTED)
  async handleAppealSubmitted(payload: {
    disputeId?: string;
    userId?: string;
    appellantId?: string;
    appealDeadline?: Date | string | null;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    const deadlineText = payload.appealDeadline
      ? ` Review by ${new Date(payload.appealDeadline).toISOString()}.`
      : '';

    await this.createNotifications(
      audience.userIds.filter((userId) => userId !== (payload.userId || payload.appellantId)),
      'Appeal submitted',
      `A formal appeal was filed and the dispute is now in appeal review.${deadlineText}`,
      'Dispute',
      audience.dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.APPEAL_RESOLVED)
  async handleAppealResolved(payload: {
    disputeId?: string;
    resolvedById?: string;
    previousResult?: string | null;
    newResult?: string | null;
    overrideReason?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    const userDisplayMap = await this.getUserDisplayMap([payload.resolvedById]);
    const resolverLabel =
      (payload.resolvedById && userDisplayMap.get(payload.resolvedById)) ||
      (payload.resolvedById ? 'assigned admin' : null);
    const resultTransition =
      payload.previousResult && payload.newResult
        ? `${payload.previousResult} -> ${payload.newResult}`
        : payload.newResult || null;
    const normalizedOverrideReason = `${payload.overrideReason || ''}`.trim();

    const bodyParts = [
      'The appeal review is complete and the dispute record has been updated.',
      resolverLabel ? `Resolved by: ${resolverLabel}.` : null,
      resultTransition ? `Result transition: ${resultTransition}.` : null,
      normalizedOverrideReason ? `Override reason: ${normalizedOverrideReason}.` : null,
    ].filter(Boolean);

    await this.createNotifications(
      audience.userIds,
      'Appeal resolved',
      bodyParts.join(' '),
      'Dispute',
      audience.dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.ASSIGNED)
  async handleDisputeAssigned(payload: { disputeId?: string; staffId?: string }): Promise<void> {
    if (!payload?.disputeId || !payload.staffId) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    const [stakeholderIds, userDisplayMap] = await Promise.all([
      this.getStakeholderRecipientIds(audience.userIds),
      this.getUserDisplayMap([payload.staffId]),
    ]);

    const staffLabel = userDisplayMap.get(payload.staffId) || 'the assigned staff member';

    await this.createNotifications(
      [payload.staffId],
      'Dispute assigned to you',
      'You were assigned to handle this dispute.',
      'Dispute',
      audience.dispute.id,
    );

    await this.createNotifications(
      stakeholderIds.filter((userId) => userId !== payload.staffId),
      'Dispute assigned to staff',
      `This dispute is now being handled by ${staffLabel}.`,
      'Dispute',
      audience.dispute.id,
    );
  }

  @OnEvent(DISPUTE_EVENTS.REASSIGNED)
  async handleDisputeReassigned(payload: {
    disputeId?: string;
    assignmentType?: string;
    oldStaffId?: string | null;
    newStaffId?: string | null;
    previousOwnerId?: string | null;
    nextOwnerId?: string | null;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    if (payload.assignmentType === 'APPEAL_OWNER') {
      if (!payload.nextOwnerId) {
        return;
      }

      const recipients = [payload.nextOwnerId];
      const body =
        payload.previousOwnerId && payload.previousOwnerId !== payload.nextOwnerId
          ? 'An appeal case was reassigned to you and now needs admin review.'
          : 'A new appeal case was assigned to you for review.';

      await this.createNotifications(
        recipients,
        'Appeal case assigned',
        body,
        'Dispute',
        payload.disputeId,
      );

      if (payload.previousOwnerId && payload.previousOwnerId !== payload.nextOwnerId) {
        await this.createNotifications(
          [payload.previousOwnerId],
          'Appeal case reassigned',
          'This appeal case was reassigned to another admin.',
          'Dispute',
          payload.disputeId,
        );
      }

      return;
    }

    if (!payload.newStaffId) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    const [stakeholderIds, userDisplayMap] = await Promise.all([
      this.getStakeholderRecipientIds(audience.userIds),
      this.getUserDisplayMap([payload.oldStaffId, payload.newStaffId]),
    ]);

    const nextStaffLabel = userDisplayMap.get(payload.newStaffId) || 'the assigned staff member';
    const previousStaffLabel =
      (payload.oldStaffId && userDisplayMap.get(payload.oldStaffId)) || 'the previous staff member';

    await this.createNotifications(
      stakeholderIds.filter(
        (userId) => userId !== payload.newStaffId && userId !== payload.oldStaffId,
      ),
      'Dispute handler updated',
      `This dispute is now being handled by ${nextStaffLabel}.`,
      'Dispute',
      audience.dispute.id,
    );

    await this.createNotifications(
      [payload.newStaffId],
      'Dispute assigned to you',
      payload.oldStaffId && payload.oldStaffId !== payload.newStaffId
        ? `This dispute was reassigned to you from ${previousStaffLabel}.`
        : 'You were assigned to handle this dispute.',
      'Dispute',
      audience.dispute.id,
    );

    if (payload.oldStaffId && payload.oldStaffId !== payload.newStaffId) {
      await this.createNotifications(
        [payload.oldStaffId],
        'Dispute reassigned',
        `This dispute was reassigned to ${nextStaffLabel}.`,
        'Dispute',
        audience.dispute.id,
      );
    }
  }

  @OnEvent(DISPUTE_EVENTS.NOTE_ADDED)
  async handleReviewRequestAdded(payload: {
    disputeId?: string;
    actorId?: string;
    noteType?: string;
    reason?: string;
    reviewerIds?: string[];
    recommendation?: string;
  }): Promise<void> {
    if (!payload?.disputeId || !payload.noteType) {
      return;
    }

    const audience = await this.getDisputeAudience(payload.disputeId);
    if (!audience.dispute) {
      return;
    }

    if (payload.noteType === 'REVIEW_REQUEST') {
      await this.createNotifications(
        audience.userIds.filter((userId) => userId !== payload.actorId),
        'Review request added',
        payload.reason?.trim()
          ? `A linked participant requested additional review: ${payload.reason.trim()}`
          : 'A linked participant requested additional review on this dispute.',
        'Dispute',
        audience.dispute.id,
      );
      return;
    }

    if (payload.noteType === `${DisputeEscalationRequestKind.SUPPORT_ESCALATION}_REQUEST`) {
      const recipients = [
        audience.dispute.assignedStaffId,
        audience.dispute.escalatedToAdminId,
        ...(await this.getAdminIds()),
      ].filter((value): value is string => Boolean(value) && value !== payload.actorId);
      await this.createNotifications(
        recipients,
        'Support escalation requested',
        payload.reason?.trim()
          ? `Additional dispute support was requested: ${payload.reason.trim()}`
          : 'Additional dispute support was requested on this case.',
        'Dispute',
        audience.dispute.id,
      );
      return;
    }

    if (payload.noteType === `${DisputeEscalationRequestKind.ADMIN_OVERSIGHT}_REQUEST`) {
      const recipients = [...(await this.getAdminIds()), audience.dispute.assignedStaffId].filter(
        (value): value is string => Boolean(value) && value !== payload.actorId,
      );
      await this.createNotifications(
        recipients,
        'Admin oversight requested',
        payload.reason?.trim()
          ? `A participant requested admin oversight: ${payload.reason.trim()}`
          : 'A participant requested admin oversight on this dispute.',
        'Dispute',
        audience.dispute.id,
      );
      return;
    }

    if (payload.noteType === `${DisputeEscalationRequestKind.NEUTRAL_PANEL}_REQUEST`) {
      const recipients = [...(await this.getAdminIds()), audience.dispute.assignedStaffId].filter(
        (value): value is string => Boolean(value) && value !== payload.actorId,
      );
      await this.createNotifications(
        recipients,
        'Neutral panel requested',
        payload.reason?.trim()
          ? `A participant requested a neutral panel review: ${payload.reason.trim()}`
          : 'A participant requested a neutral panel review on this dispute.',
        'Dispute',
        audience.dispute.id,
      );
      return;
    }

    if (payload.noteType === 'NEUTRAL_PANEL_ASSIGNED') {
      await this.createNotifications(
        payload.reviewerIds || [],
        'Neutral panel assignment',
        'You were added to a neutral advisory panel for this dispute. Review the redacted dossier and submit your recommendation.',
        'Dispute',
        audience.dispute.id,
      );
      await this.createNotifications(
        audience.userIds.filter((userId) => userId !== payload.actorId),
        'Neutral panel formed',
        'A neutral advisory panel has been formed to assist with this dispute review.',
        'Dispute',
        audience.dispute.id,
      );
      return;
    }

    if (payload.noteType === 'PANEL_RECOMMENDATION') {
      await this.createNotifications(
        audience.userIds.filter((userId) => userId !== payload.actorId),
        'Neutral panel recommendation submitted',
        payload.recommendation
          ? `A neutral panel recommendation is available: ${payload.recommendation}.`
          : 'A neutral panel recommendation was submitted for this dispute.',
        'Dispute',
        audience.dispute.id,
      );
    }
  }

  @OnEvent('staff.dismissal_rate_high')
  async handleDismissalRateHigh(payload: {
    staffId?: string;
    dismissalRate?: number;
    totalReviewed?: number;
  }): Promise<void> {
    if (!payload?.staffId) {
      return;
    }

    const admins = await this.getAdminIds();
    if (admins.length === 0) {
      return;
    }

    const rateText = payload.dismissalRate ? `${Math.round(payload.dismissalRate * 100)}%` : 'high';
    const body = `Staff ${payload.staffId} dismissal rate is ${rateText} (n=${payload.totalReviewed || 0}).`;

    await this.createNotifications(
      admins,
      'Staff dismissal rate high',
      body,
      'User',
      payload.staffId,
    );
  }

  @OnEvent('dispute.dismissal_audit_requested')
  async handleDismissalAuditRequested(payload: {
    disputeId?: string;
    staffId?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const admins = await this.getAdminIds();
    if (admins.length === 0) {
      return;
    }

    const body = `Random audit requested for dispute ${payload.disputeId}.`;
    await this.createNotifications(
      admins,
      'Random dismissal audit',
      body,
      'Dispute',
      payload.disputeId,
    );
  }

  private async getAdminIds(): Promise<string[]> {
    const admins = await this.userRepo.find({
      where: { role: UserRole.ADMIN, isBanned: false },
      select: ['id'],
    });
    return admins.map((admin) => admin.id);
  }

  private async createNotifications(
    userIds: string[],
    title: string,
    body: string,
    relatedType?: string,
    relatedId?: string,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return;
    }

    const notifications = uniqueIds.map((userId) =>
      this.notificationRepo.create({
        userId,
        title,
        body,
        relatedType,
        relatedId,
      }),
    );

    try {
      const savedNotifications = await this.notificationRepo.save(notifications);
      savedNotifications.forEach((notification) => {
        this.disputeGateway.emitUserEvent(notification.userId, 'NOTIFICATION_CREATED', {
          notification,
          serverTimestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist notifications for ${uniqueIds.length} users: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
