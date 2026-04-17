import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  DisputeEntity,
  DisputeStatus,
  DisputeHearingEntity,
  DisputeLedgerEntity,
  EventParticipantEntity,
  HearingParticipantEntity,
  HearingStatus,
  HearingReminderType,
  NotificationEntity,
} from 'src/database/entities';
import { DISPUTE_EVENTS } from './dispute.events';
import { DisputeGateway } from '../gateways/dispute.gateway';
import { StaffAssignmentService } from '../services/staff-assignment.service';
import { DisputesService } from '../disputes.service';
import { VerdictService } from '../services/verdict.service';

@Injectable()
export class DisputeEventListener {
  private readonly logger = new Logger(DisputeEventListener.name);

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(DisputeLedgerEntity)
    private readonly ledgerRepo: Repository<DisputeLedgerEntity>,
    @InjectRepository(EventParticipantEntity)
    private readonly eventParticipantRepo: Repository<EventParticipantEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly hearingParticipantRepo: Repository<HearingParticipantEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly staffAssignmentService: StaffAssignmentService,
    private readonly disputesService: DisputesService,
    private readonly verdictService: VerdictService,
    private readonly gateway: DisputeGateway,
  ) {}

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
        this.gateway.emitUserEvent(notification.userId, 'NOTIFICATION_CREATED', {
          notification,
          serverTimestamp: this.toIsoString(),
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

  private async emitFollowUpScheduled(payload: {
    disputeId: string;
    previousHearingId: string;
    nextHearingId?: string | null;
    scheduledAt?: Date | null;
    manualRequired: boolean;
    reason?: string | null;
    closureReason?: string | null;
  }): Promise<void> {
    const eventPayload = {
      disputeId: payload.disputeId,
      previousHearingId: payload.previousHearingId,
      nextHearingId: payload.nextHearingId || null,
      scheduledAt: payload.scheduledAt || null,
      manualRequired: payload.manualRequired,
      reason: payload.reason || null,
      closureReason: payload.closureReason || null,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(
      payload.previousHearingId,
      'HEARING_FOLLOW_UP_SCHEDULED',
      eventPayload,
    );
    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_FOLLOW_UP_SCHEDULED', eventPayload);
    this.gateway.emitStaffDashboardEvent('HEARING_FOLLOW_UP_SCHEDULED', eventPayload);

    await this.appendLedger(payload.disputeId, 'HEARING_FOLLOW_UP_SCHEDULED', {
      metadata: {
        previousHearingId: payload.previousHearingId,
        nextHearingId: payload.nextHearingId || null,
        scheduledAt: payload.scheduledAt ? this.toIsoString(payload.scheduledAt) : null,
        manualRequired: payload.manualRequired,
        reason: payload.reason || null,
        closureReason: payload.closureReason || null,
      },
    });
  }

  private async emitHearingEventToParticipants(
    hearingId: string,
    eventName: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const participants = await this.hearingParticipantRepo.find({
      where: { hearingId },
      select: ['userId'],
    });

    const recipientUserIds = Array.from(
      new Set(participants.map((participant) => participant.userId).filter(Boolean)),
    );

    recipientUserIds.forEach((userId) => {
      this.gateway.emitUserEvent(userId, eventName, payload);
    });
  }

  private async collectDisputeRecipientUserIds(
    disputeId: string,
    extraUserIds: Array<string | null | undefined> = [],
  ): Promise<string[]> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['raisedById', 'defendantId', 'assignedStaffId', 'escalatedToAdminId'],
    });

    const recipientUserIds = new Set<string>();

    [
      dispute?.raisedById,
      dispute?.defendantId,
      dispute?.assignedStaffId,
      dispute?.escalatedToAdminId,
      ...extraUserIds,
    ]
      .filter((value): value is string => Boolean(value))
      .forEach((userId) => recipientUserIds.add(userId));

    return Array.from(recipientUserIds);
  }

  private async emitDisputeRealtimeEvent(input: {
    disputeId: string;
    eventName: string;
    payload: Record<string, any>;
    extraUserIds?: Array<string | null | undefined>;
    includeStaffDashboard?: boolean;
  }): Promise<void> {
    this.gateway.emitDisputeEvent(input.disputeId, input.eventName, input.payload);

    if (input.includeStaffDashboard !== false) {
      this.gateway.emitStaffDashboardEvent(input.eventName, input.payload);
    }

    const recipientUserIds = await this.collectDisputeRecipientUserIds(
      input.disputeId,
      input.extraUserIds || [],
    );

    recipientUserIds.forEach((userId) => {
      this.gateway.emitUserEvent(userId, input.eventName, input.payload);
    });
  }

  private async resolveDisputeIdFromHearing(hearingId: string): Promise<string | null> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      select: ['id', 'disputeId'],
    });

    return hearing?.disputeId ?? null;
  }

  private async scheduleFollowUpIfNeeded(payload: {
    hearingId: string;
    disputeId: string;
    moderatorId?: string | null;
    endedById?: string | null;
    closureReason?: string | null;
  }): Promise<void> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'status', 'assignedStaffId', 'escalatedToAdminId', 'raisedById'],
    });

    if (!dispute) {
      return;
    }

    if (
      [DisputeStatus.RESOLVED, DisputeStatus.REJECTED, DisputeStatus.CANCELED].includes(
        dispute.status,
      )
    ) {
      return;
    }

    const verdict = await this.verdictService.getVerdictByDisputeId(dispute.id);
    if (verdict) {
      return;
    }

    const existingActive = await this.hearingRepo.findOne({
      where: {
        disputeId: dispute.id,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS, HearingStatus.PAUSED]),
      },
      select: ['id', 'scheduledAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    if (existingActive) {
      await this.emitFollowUpScheduled({
        disputeId: dispute.id,
        previousHearingId: payload.hearingId,
        nextHearingId: existingActive.id,
        scheduledAt: existingActive.scheduledAt,
        manualRequired: false,
        closureReason: payload.closureReason || null,
      });
      return;
    }

    const triggerActorId =
      payload.endedById ||
      dispute.assignedStaffId ||
      dispute.escalatedToAdminId ||
      dispute.raisedById;

    if (!triggerActorId) {
      return;
    }

    try {
      const followUp = await this.disputesService.escalateToHearing(dispute.id, triggerActorId);
      const reason = followUp.reason || followUp.fallbackReason || null;

      await this.emitFollowUpScheduled({
        disputeId: dispute.id,
        previousHearingId: payload.hearingId,
        nextHearingId: followUp.hearingId || null,
        scheduledAt: followUp.scheduledAt || null,
        manualRequired: followUp.manualRequired,
        reason,
        closureReason: payload.closureReason || null,
      });

      if (followUp.manualRequired) {
        const recipients = [
          dispute.assignedStaffId,
          dispute.escalatedToAdminId,
          payload.moderatorId,
        ].filter((value): value is string => Boolean(value));
        await this.createNotifications(
          recipients,
          'Follow-up hearing needs manual scheduling',
          `Dispute ${dispute.id.slice(0, 8)} still has no verdict. Manual follow-up hearing scheduling is required.`,
          'Dispute',
          dispute.id,
        );
      }
    } catch (error) {
      const recipients = [
        dispute.assignedStaffId,
        dispute.escalatedToAdminId,
        payload.moderatorId,
      ].filter((value): value is string => Boolean(value));
      await this.createNotifications(
        recipients,
        'Follow-up hearing scheduling failed',
        `Dispute ${dispute.id.slice(0, 8)} still needs another hearing, but the automatic scheduler failed. Please review and schedule manually.`,
        'Dispute',
        dispute.id,
      );
      this.logger.warn(
        `Follow-up hearing scheduling failed for dispute ${dispute.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
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

  private async appendLedger(
    disputeId: string,
    eventType: string,
    payload: {
      actorId?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const latest = await this.ledgerRepo.findOne({
      where: { disputeId },
      order: { createdAt: 'DESC' },
    });

    const recordedAt = new Date().toISOString();
    const ledgerMetadata = (payload.metadata || {}) as Record<string, any>;
    const canonicalPayload = this.buildLedgerCanonicalPayload({
      disputeId,
      eventType,
      actorId: payload.actorId || null,
      reason: payload.reason || null,
      payload: ledgerMetadata,
      previousHash: latest?.hash || null,
      recordedAt,
    });
    const hash = createHash('sha256').update(canonicalPayload).digest('hex');

    await this.ledgerRepo.insert({
      disputeId,
      eventType,
      actorId: payload.actorId || undefined,
      reason: payload.reason || undefined,
      payload: ledgerMetadata,
      previousHash: latest?.hash || undefined,
      canonicalPayload,
      hash,
    });
  }

  // ===========================================================================
  // 7.2 Event System Integration
  // ===========================================================================

  @OnEvent(DISPUTE_EVENTS.CREATED)
  async handleDisputeCreated(payload: { disputeId?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'assignedStaffId', 'status'],
    });

    if (!dispute || dispute.assignedStaffId) {
      return;
    }

    if (
      [DisputeStatus.RESOLVED, DisputeStatus.REJECTED, DisputeStatus.CANCELED].includes(
        dispute.status,
      )
    ) {
      return;
    }

    try {
      await this.staffAssignmentService.autoAssignStaffToDispute(dispute.id);
      this.gateway.emitStaffDashboardEvent('DISPUTE_CREATED', {
        disputeId: dispute.id,
        serverTimestamp: this.toIsoString(),
      });
    } catch (error) {
      this.logger.warn(
        `Auto-assign staff failed for dispute ${dispute.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  @OnEvent('settlement.exhausted')
  async handleSettlementFailed(payload: { disputeId?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const existingHearing = await this.hearingRepo.findOne({
      where: {
        disputeId: payload.disputeId,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS, HearingStatus.PAUSED]),
      },
      select: ['id'],
    });

    if (existingHearing) {
      return;
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: payload.disputeId },
      select: ['id', 'assignedStaffId', 'raisedById'],
    });

    if (!dispute) {
      return;
    }

    const triggeredBy = dispute.assignedStaffId || dispute.raisedById;
    try {
      await this.disputesService.escalateToHearing(dispute.id, triggeredBy);
    } catch (error) {
      this.logger.warn(
        `Escalate to hearing failed for dispute ${dispute.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  @OnEvent('hearing.scheduled')
  async handleHearingScheduled(payload: {
    hearingId?: string;
    disputeId?: string;
    scheduledAt?: Date;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    const eventPayload = {
      disputeId: payload.disputeId,
      hearingId: payload.hearingId,
      scheduledAt: payload.scheduledAt,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_SCHEDULED', {
      ...eventPayload,
    });
    await this.emitHearingEventToParticipants(payload.hearingId, 'HEARING_SCHEDULED', {
      ...eventPayload,
    });
    this.gateway.emitStaffDashboardEvent('HEARING_SCHEDULED', {
      ...eventPayload,
    });

    await this.appendLedger(payload.disputeId, 'HEARING_SCHEDULED', {
      metadata: {
        hearingId: payload.hearingId,
        scheduledAt: payload.scheduledAt ? this.toIsoString(payload.scheduledAt) : null,
      },
    });
  }

  @OnEvent('hearing.rescheduled')
  async handleHearingRescheduled(payload: {
    previousHearingId?: string;
    hearingId?: string;
    disputeId?: string;
    scheduledAt?: Date;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    const eventPayload = {
      disputeId: payload.disputeId,
      hearingId: payload.hearingId,
      previousHearingId: payload.previousHearingId,
      scheduledAt: payload.scheduledAt,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_RESCHEDULED', {
      ...eventPayload,
    });
    await this.emitHearingEventToParticipants(payload.hearingId, 'HEARING_RESCHEDULED', {
      ...eventPayload,
    });
    this.gateway.emitStaffDashboardEvent('HEARING_RESCHEDULED', {
      ...eventPayload,
    });

    await this.appendLedger(payload.disputeId, 'HEARING_RESCHEDULED', {
      metadata: {
        hearingId: payload.hearingId,
        previousHearingId: payload.previousHearingId,
        scheduledAt: payload.scheduledAt ? this.toIsoString(payload.scheduledAt) : null,
      },
    });
  }

  @OnEvent('hearing.started')
  async handleHearingStarted(payload: {
    hearingId?: string;
    startedAt?: Date;
    startedBy?: string;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const hearing = await this.hearingRepo.findOne({
      where: { id: payload.hearingId },
      select: ['id', 'disputeId'],
    });
    if (!hearing) {
      return;
    }

    const startedPayload = {
      hearingId: hearing.id,
      startedAt: payload.startedAt,
      startedBy: payload.startedBy,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(hearing.id, 'HEARING_STARTED', startedPayload);
    this.gateway.emitDisputeEvent(hearing.disputeId, 'HEARING_STARTED', startedPayload);
    this.gateway.emitStaffDashboardEvent('HEARING_STARTED', {
      disputeId: hearing.disputeId,
      ...startedPayload,
    });

    await this.appendLedger(hearing.disputeId, 'HEARING_STARTED', {
      actorId: payload.startedBy || null,
      metadata: {
        hearingId: hearing.id,
        startedAt: payload.startedAt ? this.toIsoString(payload.startedAt) : null,
      },
    });
  }

  @OnEvent('hearing.inviteResponded')
  async handleHearingInviteResponded(payload: {
    eventId?: string;
    hearingId?: string | null;
    disputeId?: string | null;
    participantId?: string;
    participantUserId?: string;
    responderId?: string;
    response?: string;
    eventStatus?: string | null;
    manualRequired?: boolean;
    reason?: string | null;
    respondedAt?: Date;
  }): Promise<void> {
    if (!payload?.eventId) {
      return;
    }

    const hearingId = payload.hearingId || null;
    let disputeId = payload.disputeId || null;

    if (hearingId && !disputeId) {
      const hearing = await this.hearingRepo.findOne({
        where: { id: hearingId },
        select: ['id', 'disputeId'],
      });
      disputeId = hearing?.disputeId ?? null;
    }

    const eventPayload = {
      eventId: payload.eventId,
      hearingId,
      disputeId,
      participantId: payload.participantId || null,
      participantUserId: payload.participantUserId || null,
      responderId: payload.responderId || null,
      response: payload.response || null,
      eventStatus: payload.eventStatus || null,
      manualRequired: Boolean(payload.manualRequired),
      reason: payload.reason || null,
      respondedAt: payload.respondedAt ? this.toIsoString(payload.respondedAt) : this.toIsoString(),
      serverTimestamp: this.toIsoString(),
    };

    if (hearingId) {
      this.gateway.emitHearingEvent(hearingId, 'HEARING_INVITE_RESPONDED', eventPayload);
    }

    if (disputeId) {
      this.gateway.emitDisputeEvent(disputeId, 'HEARING_INVITE_RESPONDED', eventPayload);
      this.gateway.emitStaffDashboardEvent('HEARING_INVITE_RESPONDED', eventPayload);

      await this.appendLedger(disputeId, 'HEARING_INVITE_RESPONDED', {
        actorId: payload.responderId || null,
        reason: payload.reason || null,
        metadata: {
          eventId: payload.eventId,
          hearingId,
          participantId: payload.participantId || null,
          participantUserId: payload.participantUserId || null,
          response: payload.response || null,
          eventStatus: payload.eventStatus || null,
          manualRequired: Boolean(payload.manualRequired),
          respondedAt: payload.respondedAt
            ? this.toIsoString(payload.respondedAt)
            : this.toIsoString(),
        },
      });
    }

    const recipientUserIds = new Set<string>();
    if (payload.participantUserId) {
      recipientUserIds.add(payload.participantUserId);
    }

    const inviteRecipients = await this.eventParticipantRepo.find({
      where: { eventId: payload.eventId },
      select: ['userId'],
    });
    inviteRecipients.forEach((participant) => {
      if (participant.userId) {
        recipientUserIds.add(participant.userId);
      }
    });

    recipientUserIds.forEach((userId) => {
      this.gateway.emitUserEvent(userId, 'HEARING_INVITE_RESPONDED', eventPayload);
    });
  }

  @OnEvent('hearing.ended')
  async handleHearingEnded(payload: {
    hearingId?: string;
    disputeId?: string;
    endedById?: string | null;
    endedByType?: 'USER' | 'SYSTEM';
    closureReason?: string | null;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const hearing = await this.hearingRepo.findOne({
      where: { id: payload.hearingId },
      select: ['id', 'disputeId', 'moderatorId'],
    });

    if (!hearing) {
      return;
    }

    const endedPayload = {
      disputeId: hearing.disputeId,
      hearingId: hearing.id,
      endedById: payload.endedById || null,
      endedByType: payload.endedByType || 'USER',
      closureReason: payload.closureReason || null,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(hearing.id, 'HEARING_ENDED', endedPayload);
    this.gateway.emitStaffDashboardEvent('HEARING_ENDED', endedPayload);
    this.gateway.emitDisputeEvent(hearing.disputeId, 'HEARING_ENDED', endedPayload);

    await this.appendLedger(hearing.disputeId, 'HEARING_ENDED', {
      actorId: payload.endedById || null,
      metadata: {
        hearingId: hearing.id,
        endedByType: payload.endedByType || 'USER',
        closureReason: payload.closureReason || null,
      },
    });

    await this.scheduleFollowUpIfNeeded({
      hearingId: hearing.id,
      disputeId: hearing.disputeId,
      moderatorId: hearing.moderatorId,
      endedById: payload.endedById || null,
      closureReason: payload.closureReason || null,
    });
  }

  @OnEvent('hearing.timeWarning')
  async handleHearingTimeWarning(payload: {
    hearingId?: string;
    disputeId?: string;
    warningType?: string;
    minutesRemaining?: number;
    participantIds?: string[];
    scheduledEndAt?: Date;
    graceEndsAt?: Date;
    pauseAutoCloseAt?: Date | null;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    const eventPayload = {
      hearingId: payload.hearingId,
      disputeId: payload.disputeId,
      warningType: payload.warningType || null,
      minutesRemaining: payload.minutesRemaining ?? null,
      scheduledEndAt: payload.scheduledEndAt || null,
      graceEndsAt: payload.graceEndsAt || null,
      pauseAutoCloseAt: payload.pauseAutoCloseAt || null,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_TIME_WARNING', eventPayload);
    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_TIME_WARNING', eventPayload);
    this.gateway.emitStaffDashboardEvent('HEARING_TIME_WARNING', eventPayload);

    for (const userId of payload.participantIds ?? []) {
      this.gateway.emitUserEvent(userId, 'HEARING_TIME_WARNING', eventPayload);
    }

    await this.appendLedger(payload.disputeId, 'HEARING_TIME_WARNING', {
      metadata: {
        hearingId: payload.hearingId,
        warningType: payload.warningType || null,
        minutesRemaining: payload.minutesRemaining ?? null,
        scheduledEndAt: payload.scheduledEndAt ? this.toIsoString(payload.scheduledEndAt) : null,
        graceEndsAt: payload.graceEndsAt ? this.toIsoString(payload.graceEndsAt) : null,
        pauseAutoCloseAt: payload.pauseAutoCloseAt
          ? this.toIsoString(payload.pauseAutoCloseAt)
          : null,
      },
    });
  }

  @OnEvent('verdict.issued')
  async handleVerdictIssued(payload: {
    disputeId?: string;
    verdictId?: string;
    appealDeadline?: Date;
    issuedBy?: string;
    adjudicatorId?: string;
    hearingId?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    let targetHearingId = String(payload.hearingId || '').trim() || null;

    if (targetHearingId) {
      const explicitHearing = await this.hearingRepo.findOne({
        where: { id: targetHearingId, disputeId: payload.disputeId },
        select: ['id'],
      });
      targetHearingId = explicitHearing?.id || null;
    }

    if (!targetHearingId) {
      const activeHearing = await this.hearingRepo.findOne({
        where: {
          disputeId: payload.disputeId,
          status: In([HearingStatus.IN_PROGRESS, HearingStatus.PAUSED, HearingStatus.SCHEDULED]),
        },
        order: { createdAt: 'DESC' },
        select: ['id'],
      });
      targetHearingId = activeHearing?.id || null;
    }

    if (!targetHearingId) {
      const latestHearing = await this.hearingRepo.findOne({
        where: { disputeId: payload.disputeId },
        order: { createdAt: 'DESC' },
        select: ['id'],
      });
      targetHearingId = latestHearing?.id || null;
    }

    const verdictPayload = {
      disputeId: payload.disputeId,
      verdictId: payload.verdictId,
      appealDeadline: payload.appealDeadline,
      hearingId: targetHearingId,
      serverTimestamp: this.toIsoString(),
    };

    if (targetHearingId) {
      this.gateway.emitHearingEvent(targetHearingId, 'VERDICT_ISSUED', verdictPayload);
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'VERDICT_ISSUED', verdictPayload);
    this.gateway.emitStaffDashboardEvent('VERDICT_ISSUED', verdictPayload);

    await this.appendLedger(payload.disputeId, 'VERDICT_ISSUED', {
      actorId: payload.issuedBy || payload.adjudicatorId || null,
      metadata: {
        verdictId: payload.verdictId || null,
        hearingId: targetHearingId,
        appealDeadline: payload.appealDeadline ? this.toIsoString(payload.appealDeadline) : null,
      },
    });
  }

  @OnEvent(DISPUTE_EVENTS.APPEAL_SUBMITTED)
  async handleAppealSubmitted(payload: {
    disputeId?: string;
    appellantId?: string;
    previousStatus?: string;
    newStatus?: string;
    appealReason?: string;
    additionalEvidenceCount?: number;
    appealDeadline?: Date | string | null;
    escalatedToAdminId?: string | null;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      disputeId: payload.disputeId,
      appellantId: payload.appellantId || null,
      previousStatus: payload.previousStatus || null,
      newStatus: payload.newStatus || null,
      appealReason: payload.appealReason || null,
      additionalEvidenceCount: payload.additionalEvidenceCount ?? 0,
      appealDeadline: payload.appealDeadline ? this.toIsoString(payload.appealDeadline) : null,
      escalatedToAdminId: payload.escalatedToAdminId || null,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitDisputeEvent(payload.disputeId, 'APPEAL_SUBMITTED', eventPayload);
    this.gateway.emitStaffDashboardEvent('APPEAL_SUBMITTED', eventPayload);

    await this.appendLedger(payload.disputeId, 'APPEAL_SUBMITTED', {
      actorId: payload.appellantId || null,
      reason: payload.appealReason || null,
      metadata: {
        previousStatus: payload.previousStatus || null,
        newStatus: payload.newStatus || null,
        additionalEvidenceCount: payload.additionalEvidenceCount ?? 0,
        appealDeadline: payload.appealDeadline ? this.toIsoString(payload.appealDeadline) : null,
        escalatedToAdminId: payload.escalatedToAdminId || null,
      },
    });
  }

  @OnEvent(DISPUTE_EVENTS.APPEAL_RESOLVED)
  async handleAppealResolved(payload: {
    disputeId?: string;
    resolvedById?: string;
    previousStatus?: string;
    newStatus?: string;
    previousResult?: string | null;
    newResult?: string | null;
    overrideReason?: string;
    overridesVerdictId?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      disputeId: payload.disputeId,
      resolvedById: payload.resolvedById || null,
      previousStatus: payload.previousStatus || null,
      newStatus: payload.newStatus || null,
      previousResult: payload.previousResult || null,
      newResult: payload.newResult || null,
      overrideReason: payload.overrideReason || null,
      overridesVerdictId: payload.overridesVerdictId || null,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitDisputeEvent(payload.disputeId, 'APPEAL_RESOLVED', eventPayload);
    this.gateway.emitStaffDashboardEvent('APPEAL_RESOLVED', eventPayload);

    await this.appendLedger(payload.disputeId, 'APPEAL_RESOLVED', {
      actorId: payload.resolvedById || null,
      reason: payload.overrideReason || null,
      metadata: {
        previousStatus: payload.previousStatus || null,
        newStatus: payload.newStatus || null,
        previousResult: payload.previousResult || null,
        newResult: payload.newResult || null,
        overridesVerdictId: payload.overridesVerdictId || null,
      },
    });
  }

  @OnEvent(DISPUTE_EVENTS.APPEAL_DEADLINE_PASSED)
  async handleAppealDeadlinePassed(payload: { disputeId?: string }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    try {
      const result = await this.verdictService.finalizeAppealDeadline(payload.disputeId);
      if (!result.finalized) {
        return;
      }

      this.gateway.emitDisputeEvent(payload.disputeId, 'APPEAL_DEADLINE_PASSED', {
        disputeId: payload.disputeId,
        transferIds: result.transferIds,
        serverTimestamp: this.toIsoString(),
      });
    } catch (error) {
      this.logger.warn(
        `Finalize appeal deadline failed for dispute ${payload.disputeId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  @OnEvent(DISPUTE_EVENTS.STATUS_CHANGED)
  async handleDisputeStatusChanged(payload: {
    disputeId?: string;
    previousStatus?: string;
    newStatus?: string;
    changedById?: string;
    requestedById?: string;
    userId?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_STATUS_CHANGED',
      payload: eventPayload,
      extraUserIds: [payload.changedById, payload.requestedById, payload.userId],
    });
  }

  @OnEvent(DISPUTE_EVENTS.CLOSED)
  async handleDisputeClosed(payload: {
    disputeId?: string;
    closedStatus?: string;
    canceledById?: string;
    reason?: string | null;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_CLOSED',
      payload: eventPayload,
      extraUserIds: [payload.canceledById],
    });
  }

  @OnEvent(DISPUTE_EVENTS.RESOLVED)
  async handleDisputeResolved(payload: {
    disputeId?: string;
    projectId?: string;
    clientId?: string;
    freelancerId?: string;
    brokerId?: string;
    winnerId?: string;
    loserId?: string;
    adminId?: string;
    resolvedAt?: Date;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.resolvedAt),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_RESOLVED',
      payload: eventPayload,
      extraUserIds: [
        payload.clientId,
        payload.freelancerId,
        payload.brokerId,
        payload.winnerId,
        payload.loserId,
        payload.adminId,
      ],
    });
  }

  @OnEvent(DISPUTE_EVENTS.ASSIGNED)
  async handleDisputeAssignedRealtime(payload: {
    disputeId?: string;
    staffId?: string;
    assignedAt?: Date;
  }): Promise<void> {
    if (!payload?.disputeId || !payload.staffId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.assignedAt),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_ASSIGNED',
      payload: eventPayload,
      extraUserIds: [payload.staffId],
    });
  }

  @OnEvent(DISPUTE_EVENTS.REASSIGNED)
  async handleDisputeReassignedRealtime(payload: {
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

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_REASSIGNED',
      payload: eventPayload,
      extraUserIds: [
        payload.oldStaffId,
        payload.newStaffId,
        payload.previousOwnerId,
        payload.nextOwnerId,
      ],
    });
  }

  @OnEvent(DISPUTE_EVENTS.INFO_REQUESTED)
  async handleInfoRequestedRealtime(payload: {
    disputeId?: string;
    reason?: string;
    requestedById?: string;
    deadlineAt?: string | null;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_INFO_REQUESTED',
      payload: eventPayload,
      extraUserIds: [payload.requestedById],
    });
  }

  @OnEvent(DISPUTE_EVENTS.INFO_PROVIDED)
  async handleInfoProvidedRealtime(payload: {
    disputeId?: string;
    userId?: string;
    providedAt?: Date;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.providedAt),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_INFO_PROVIDED',
      payload: eventPayload,
      extraUserIds: [payload.userId],
    });
  }

  @OnEvent(DISPUTE_EVENTS.DEFENDANT_RESPONDED)
  async handleDefendantRespondedRealtime(payload: {
    disputeId?: string;
    defendantId?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'DISPUTE_DEFENDANT_RESPONDED',
      payload: eventPayload,
      extraUserIds: [payload.defendantId],
    });
  }

  @OnEvent('staff.shortage')
  handleStaffOverloaded(payload: {
    availableCount?: number;
    requiredCount?: number;
    affectedDisputes?: string[];
  }): void {
    this.gateway.emitStaffDashboardEvent('STAFF_OVERLOADED', {
      availableCount: payload?.availableCount,
      requiredCount: payload?.requiredCount,
      affectedDisputes: payload?.affectedDisputes ?? [],
      serverTimestamp: this.toIsoString(),
    });
  }

  // ===========================================================================
  // 7.3 WebSocket Gateway (Real-time)
  // ===========================================================================

  @OnEvent(DISPUTE_EVENTS.MESSAGE_SENT)
  handleMessageSent(payload: {
    disputeId?: string;
    hearingId?: string;
    messageId?: string;
    senderId?: string;
    senderRole?: string;
    senderHearingRole?: string;
    type?: string;
    createdAt?: Date;
  }): void {
    if (!payload?.disputeId || !payload?.messageId) {
      return;
    }

    const messagePayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.createdAt),
    };

    if (payload.hearingId) {
      this.gateway.emitHearingEvent(payload.hearingId, 'MESSAGE_SENT', messagePayload);
      return;
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'MESSAGE_SENT', messagePayload);
  }

  @OnEvent(DISPUTE_EVENTS.MESSAGE_HIDDEN)
  handleMessageHidden(payload: {
    disputeId?: string;
    hearingId?: string;
    messageId?: string;
    hiddenById?: string;
    hiddenReason?: string;
    replacementText?: string;
  }): void {
    if (!payload?.disputeId || !payload?.messageId) {
      return;
    }

    const hiddenPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    if (payload.hearingId) {
      this.gateway.emitHearingEvent(payload.hearingId, 'MESSAGE_HIDDEN', hiddenPayload);
      return;
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'MESSAGE_HIDDEN', hiddenPayload);
  }

  @OnEvent(DISPUTE_EVENTS.MESSAGE_UNHIDDEN)
  handleMessageUnhidden(payload: {
    disputeId?: string;
    hearingId?: string;
    messageId?: string;
    unhiddenById?: string;
    previousReason?: string;
  }): void {
    if (!payload?.disputeId || !payload?.messageId) {
      return;
    }

    const unhiddenPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    if (payload.hearingId) {
      this.gateway.emitHearingEvent(payload.hearingId, 'MESSAGE_UNHIDDEN', unhiddenPayload);
      return;
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'MESSAGE_UNHIDDEN', unhiddenPayload);
  }

  @OnEvent('hearing.speakerControlChanged')
  async handleSpeakerControlChanged(payload: {
    hearingId?: string;
    changedBy?: string;
    previousRole?: string;
    newRole?: string;
    gracePeriodMs?: number;
    gracePeriodUntil?: Date;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'SPEAKER_CONTROL_CHANGED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    const hearing = await this.hearingRepo.findOne({
      where: { id: payload.hearingId },
      select: ['id', 'disputeId'],
    });
    if (!hearing) {
      return;
    }

    await this.appendLedger(hearing.disputeId, 'HEARING_SPEAKER_CONTROL_CHANGED', {
      actorId: payload.changedBy || null,
      metadata: {
        hearingId: payload.hearingId,
        previousRole: payload.previousRole || null,
        newRole: payload.newRole || null,
        gracePeriodMs: payload.gracePeriodMs || 0,
        gracePeriodUntil: payload.gracePeriodUntil
          ? this.toIsoString(payload.gracePeriodUntil)
          : null,
      },
    });
  }

  @OnEvent('hearing.phaseTransitioned')
  async handleHearingPhaseTransitioned(payload: {
    hearingId?: string;
    disputeId?: string;
    changedBy?: string;
    previousPhase?: string | null;
    newPhase?: string;
    previousSpeakerRole?: string;
    newSpeakerRole?: string;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'PHASE_TRANSITIONED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    try {
      await this.appendLedger(payload.disputeId, 'HEARING_PHASE_TRANSITIONED', {
        actorId: payload.changedBy || null,
        metadata: {
          hearingId: payload.hearingId,
          previousPhase: payload.previousPhase || null,
          newPhase: payload.newPhase || null,
          previousSpeakerRole: payload.previousSpeakerRole || null,
          newSpeakerRole: payload.newSpeakerRole || null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to append ledger for HEARING_PHASE_TRANSITIONED (hearing=${payload.hearingId}): ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  @OnEvent('hearing.evidenceIntakeChanged')
  async handleHearingEvidenceIntakeChanged(payload: {
    hearingId?: string;
    disputeId?: string;
    isOpen?: boolean;
    reason?: string;
    changedBy?: string;
    changedAt?: Date;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'EVIDENCE_INTAKE_CHANGED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    try {
      await this.appendLedger(payload.disputeId, 'HEARING_EVIDENCE_INTAKE_CHANGED', {
        actorId: payload.changedBy || null,
        reason: payload.reason || null,
        metadata: {
          hearingId: payload.hearingId,
          isOpen: Boolean(payload.isOpen),
          changedAt: payload.changedAt ? this.toIsoString(payload.changedAt) : this.toIsoString(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to append ledger for HEARING_EVIDENCE_INTAKE_CHANGED (hearing=${payload.hearingId}): ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  @OnEvent('hearing.paused')
  async handleHearingPaused(payload: {
    hearingId?: string;
    disputeId?: string;
    pausedBy?: string;
    pausedAt?: Date;
    reason?: string;
    previousSpeakerRole?: string;
    accumulatedPauseSeconds?: number;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_PAUSED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_PAUSED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });
    this.gateway.emitStaffDashboardEvent('HEARING_PAUSED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(payload.disputeId, 'HEARING_PAUSED', {
      actorId: payload.pausedBy || null,
      reason: payload.reason || null,
      metadata: {
        hearingId: payload.hearingId,
        pausedAt: payload.pausedAt ? this.toIsoString(payload.pausedAt) : null,
        previousSpeakerRole: payload.previousSpeakerRole || null,
        accumulatedPauseSeconds: payload.accumulatedPauseSeconds || 0,
      },
    });
  }

  @OnEvent('hearing.resumed')
  async handleHearingResumed(payload: {
    hearingId?: string;
    disputeId?: string;
    resumedBy?: string;
    resumedAt?: Date;
    restoredSpeakerRole?: string;
    accumulatedPauseSeconds?: number;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_RESUMED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_RESUMED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });
    this.gateway.emitStaffDashboardEvent('HEARING_RESUMED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(payload.disputeId, 'HEARING_RESUMED', {
      actorId: payload.resumedBy || null,
      metadata: {
        hearingId: payload.hearingId,
        resumedAt: payload.resumedAt ? this.toIsoString(payload.resumedAt) : null,
        restoredSpeakerRole: payload.restoredSpeakerRole || null,
        accumulatedPauseSeconds: payload.accumulatedPauseSeconds || 0,
      },
    });
  }

  @OnEvent('hearing.statementSubmitted')
  async handleHearingStatementSubmitted(payload: {
    hearingId?: string;
    disputeId?: string;
    statementId?: string;
    participantId?: string;
    createdAt?: Date;
    statementType?: string;
    statement?: Record<string, unknown> | null;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.statementId) {
      return;
    }

    const normalizedPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.createdAt),
    };

    this.gateway.emitHearingEvent(
      payload.hearingId,
      'HEARING_STATEMENT_SUBMITTED',
      normalizedPayload,
    );

    if (payload.disputeId) {
      this.gateway.emitDisputeEvent(
        payload.disputeId,
        'HEARING_STATEMENT_SUBMITTED',
        normalizedPayload,
      );
    }

    const participantUserIds = new Set<string>();
    const hearingParticipants = await this.hearingParticipantRepo.find({
      where: { hearingId: payload.hearingId },
      select: ['userId'],
    });
    hearingParticipants.forEach((participant) => {
      if (participant.userId) {
        participantUserIds.add(participant.userId);
      }
    });
    participantUserIds.forEach((userId) => {
      this.gateway.emitUserEvent(userId, 'HEARING_STATEMENT_SUBMITTED', normalizedPayload);
    });
  }

  @OnEvent('hearing.questionAsked')
  handleHearingQuestionAsked(payload: {
    hearingId?: string;
    disputeId?: string;
    questionId?: string;
    askedById?: string;
    targetUserId?: string;
    deadline?: Date;
    createdAt?: Date;
  }): void {
    if (!payload?.hearingId || !payload?.questionId) {
      return;
    }

    const normalizedPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.createdAt),
    };
    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_QUESTION_ASKED', normalizedPayload);

    if (payload.disputeId) {
      this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_QUESTION_ASKED', normalizedPayload);
    }
  }

  @OnEvent('hearing.questionAnswered')
  handleHearingQuestionAnswered(payload: {
    hearingId?: string;
    disputeId?: string;
    questionId?: string;
    answeredById?: string;
    answer?: string;
    answeredAt?: Date;
  }): void {
    if (!payload?.hearingId || !payload?.questionId) {
      return;
    }

    const normalizedPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.answeredAt),
    };
    this.gateway.emitHearingEvent(
      payload.hearingId,
      'HEARING_QUESTION_ANSWERED',
      normalizedPayload,
    );

    if (payload.disputeId) {
      this.gateway.emitDisputeEvent(
        payload.disputeId,
        'HEARING_QUESTION_ANSWERED',
        normalizedPayload,
      );
    }
  }

  @OnEvent('hearing.questionCancelled')
  handleHearingQuestionCancelled(payload: {
    hearingId?: string;
    disputeId?: string;
    questionId?: string;
    cancelledById?: string;
  }): void {
    if (!payload?.hearingId || !payload?.questionId) {
      return;
    }
    const normalizedPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };
    this.gateway.emitHearingEvent(
      payload.hearingId,
      'HEARING_QUESTION_CANCELLED',
      normalizedPayload,
    );
    if (payload.disputeId) {
      this.gateway.emitDisputeEvent(
        payload.disputeId,
        'HEARING_QUESTION_CANCELLED',
        normalizedPayload,
      );
    }
  }

  @OnEvent('hearing.objectionResolved')
  async handleHearingObjectionResolved(payload: {
    hearingId?: string;
    disputeId?: string;
    statementId?: string;
    ruling?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.statementId) {
      return;
    }

    const normalizedPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.resolvedAt),
    };
    this.gateway.emitHearingEvent(
      payload.hearingId,
      'HEARING_OBJECTION_RESOLVED',
      normalizedPayload,
    );

    if (payload.disputeId) {
      this.gateway.emitDisputeEvent(
        payload.disputeId,
        'HEARING_OBJECTION_RESOLVED',
        normalizedPayload,
      );
    }

    if (payload.disputeId) {
      await this.appendLedger(payload.disputeId, 'HEARING_OBJECTION_RESOLVED', {
        actorId: payload.resolvedBy || null,
        metadata: {
          hearingId: payload.hearingId,
          statementId: payload.statementId,
          ruling: payload.ruling || null,
          resolvedAt: payload.resolvedAt ? this.toIsoString(payload.resolvedAt) : null,
        },
      });
    }
  }

  @OnEvent('hearing.presenceChanged')
  handleHearingPresenceChanged(payload: {
    hearingId?: string;
    disputeId?: string;
    participantId?: string;
    userId?: string;
    isOnline?: boolean;
    changedAt?: Date;
    totalOnlineMinutes?: number;
    lastLeftAt?: Date;
  }): void {
    if (!payload?.hearingId || !payload?.userId) {
      return;
    }

    const normalizedPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.changedAt),
    };
    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_PRESENCE_CHANGED', normalizedPayload);

    if (payload.disputeId) {
      this.gateway.emitDisputeEvent(
        payload.disputeId,
        'HEARING_PRESENCE_CHANGED',
        normalizedPayload,
      );
    }
  }

  @OnEvent('hearing.extended')
  async handleHearingExtended(payload: {
    hearingId?: string;
    disputeId?: string;
    extendedBy?: string;
    reason?: string;
    additionalMinutes?: number;
    previousDurationMinutes?: number;
    newDurationMinutes?: number;
    calendarEventUpdated?: boolean;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_EXTENDED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });
    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_EXTENDED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(payload.disputeId, 'HEARING_EXTENDED', {
      actorId: payload.extendedBy || null,
      reason: payload.reason || null,
      metadata: {
        hearingId: payload.hearingId,
        additionalMinutes: payload.additionalMinutes || 0,
        previousDurationMinutes: payload.previousDurationMinutes || null,
        newDurationMinutes: payload.newDurationMinutes || null,
        calendarEventUpdated: Boolean(payload.calendarEventUpdated),
      },
    });
  }

  @OnEvent('hearing.support_invited')
  async handleHearingSupportInvited(payload: {
    hearingId?: string;
    disputeId?: string;
    invitedBy?: string;
    invitedUserId?: string;
    invitedUserRole?: string;
    participantRole?: string;
    reason?: string;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId || !payload?.invitedUserId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_SUPPORT_INVITED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_SUPPORT_INVITED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitStaffDashboardEvent('HEARING_SUPPORT_INVITED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitUserEvent(payload.invitedUserId, 'HEARING_SUPPORT_INVITED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(payload.disputeId, 'HEARING_SUPPORT_INVITED', {
      actorId: payload.invitedBy || null,
      reason: payload.reason || null,
      metadata: {
        hearingId: payload.hearingId,
        invitedUserId: payload.invitedUserId,
        invitedUserRole: payload.invitedUserRole || null,
        participantRole: payload.participantRole || null,
      },
    });
  }

  @OnEvent('hearing.reminder_sent')
  async handleHearingReminderSent(payload: {
    hearingId?: string;
    disputeId?: string;
    userId?: string;
    reminderType?: HearingReminderType;
    scheduledAt?: Date;
    notificationId?: string;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.disputeId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_REMINDER_SENT', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_REMINDER_SENT', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitStaffDashboardEvent('HEARING_REMINDER_SENT', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(payload.disputeId, 'HEARING_REMINDER_SENT', {
      actorId: payload.userId || null,
      metadata: {
        hearingId: payload.hearingId,
        reminderType: payload.reminderType || null,
        notificationId: payload.notificationId || null,
        scheduledAt: payload.scheduledAt ? this.toIsoString(payload.scheduledAt) : null,
      },
    });
  }

  @OnEvent('settlement.offered')
  handleSettlementOffered(payload: {
    settlementId?: string;
    disputeId?: string;
    proposerId?: string;
    responderId?: string;
    amount?: { toFreelancer?: number; toClient?: number };
    expiresAt?: Date;
  }): void {
    if (!payload?.disputeId || !payload?.settlementId) {
      return;
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'SETTLEMENT_OFFERED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
    });
  }

  @OnEvent('settlement.accepted')
  async handleSettlementAccepted(payload: {
    settlementId?: string;
    disputeId?: string;
    proposerId?: string;
    responderId?: string;
    amounts?: {
      freelancer?: number;
      client?: number;
      platformFee?: number;
    };
    result?: string;
    projectStatus?: string;
    milestoneStatus?: string;
  }): Promise<void> {
    if (!payload?.disputeId || !payload?.settlementId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'SETTLEMENT_ACCEPTED',
      payload: eventPayload,
      extraUserIds: [payload.proposerId, payload.responderId],
    });
  }

  @OnEvent('settlement.rejected')
  async handleSettlementRejected(payload: {
    settlementId?: string;
    disputeId?: string;
    proposerId?: string;
    responderId?: string;
    reason?: string;
    remainingAttempts?: {
      raiser?: number;
      defendant?: number;
    };
    counterOfferPrompt?: {
      enabled?: boolean;
      message?: string;
      rejectionFeedback?: string;
    };
  }): Promise<void> {
    if (!payload?.disputeId || !payload?.settlementId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'SETTLEMENT_REJECTED',
      payload: eventPayload,
      extraUserIds: [payload.proposerId, payload.responderId],
    });
  }

  @OnEvent('settlement.chatUnlocked')
  async handleSettlementChatUnlocked(payload: {
    disputeId?: string;
    userId?: string;
    reason?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(),
    };

    await this.emitDisputeRealtimeEvent({
      disputeId: payload.disputeId,
      eventName: 'SETTLEMENT_CHAT_UNLOCKED',
      payload: eventPayload,
      extraUserIds: [payload.userId],
    });
  }

  @OnEvent('hearing.phaseDeadlinesSet')
  async handleHearingPhaseDeadlinesSet(payload: {
    hearingId?: string;
    disputeId?: string;
    phase?: string;
    deadlines?: Record<string, Date>;
    setBy?: string;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const disputeId =
      payload.disputeId || (await this.resolveDisputeIdFromHearing(payload.hearingId));
    const eventPayload = {
      ...payload,
      disputeId,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_PHASE_DEADLINES_SET', eventPayload);

    if (disputeId) {
      await this.emitDisputeRealtimeEvent({
        disputeId,
        eventName: 'HEARING_PHASE_DEADLINES_SET',
        payload: eventPayload,
        extraUserIds: [payload.setBy],
      });
    }
  }

  @OnEvent('hearing.statementDraftSaved')
  async handleHearingStatementDraftSaved(payload: {
    hearingId?: string;
    statementId?: string;
    participantId?: string;
  }): Promise<void> {
    if (!payload?.hearingId || !payload?.statementId) {
      return;
    }

    const disputeId = await this.resolveDisputeIdFromHearing(payload.hearingId);
    const eventPayload = {
      ...payload,
      disputeId,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_STATEMENT_DRAFT_SAVED', eventPayload);

    if (disputeId) {
      await this.emitDisputeRealtimeEvent({
        disputeId,
        eventName: 'HEARING_STATEMENT_DRAFT_SAVED',
        payload: eventPayload,
        includeStaffDashboard: false,
      });
    }
  }

  @OnEvent('hearing.moderatorDisconnect')
  async handleHearingModeratorDisconnect(payload: {
    hearingId?: string;
    moderatorId?: string;
    previousSpeakerRole?: string;
    newSpeakerRole?: string;
    message?: string;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const disputeId = await this.resolveDisputeIdFromHearing(payload.hearingId);
    const eventPayload = {
      ...payload,
      disputeId,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(
      payload.hearingId,
      'HEARING_MODERATOR_DISCONNECTED',
      eventPayload,
    );

    if (disputeId) {
      await this.emitDisputeRealtimeEvent({
        disputeId,
        eventName: 'HEARING_MODERATOR_DISCONNECTED',
        payload: eventPayload,
        extraUserIds: [payload.moderatorId],
      });
    }
  }

  @OnEvent('hearing.moderatorReconnect')
  async handleHearingModeratorReconnect(payload: {
    hearingId?: string;
    moderatorId?: string;
    newSpeakerRole?: string;
    message?: string;
  }): Promise<void> {
    if (!payload?.hearingId) {
      return;
    }

    const disputeId = await this.resolveDisputeIdFromHearing(payload.hearingId);
    const eventPayload = {
      ...payload,
      disputeId,
      serverTimestamp: this.toIsoString(),
    };

    this.gateway.emitHearingEvent(payload.hearingId, 'HEARING_MODERATOR_RECONNECTED', eventPayload);

    if (disputeId) {
      await this.emitDisputeRealtimeEvent({
        disputeId,
        eventName: 'HEARING_MODERATOR_RECONNECTED',
        payload: eventPayload,
        extraUserIds: [payload.moderatorId],
      });
    }
  }

  @OnEvent(DISPUTE_EVENTS.EVIDENCE_ADDED)
  async handleEvidenceUploaded(payload: {
    disputeId?: string;
    evidenceId?: string;
    uploaderId?: string;
    uploaderRole?: string;
    uploaderName?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    description?: string;
    uploadedAt?: Date;
  }): Promise<void> {
    if (!payload?.disputeId || !payload?.evidenceId) {
      return;
    }

    const eventPayload = {
      ...payload,
      serverTimestamp: this.toIsoString(payload.uploadedAt),
    };

    // Emit to dispute room (existing behaviour)
    this.gateway.emitDisputeEvent(payload.disputeId, 'EVIDENCE_UPLOADED', eventPayload);

    // Also emit to the active hearing room so ALL participants see new evidence in real-time
    try {
      const activeHearing = await this.hearingRepo.findOne({
        where: {
          disputeId: payload.disputeId,
          status: HearingStatus.IN_PROGRESS,
        },
        select: ['id'],
      });
      if (activeHearing) {
        this.gateway.emitHearingEvent(activeHearing.id, 'EVIDENCE_UPLOADED', eventPayload);
      }
    } catch (err) {
      this.logger.warn(`Failed to emit EVIDENCE_UPLOADED to hearing room: ${err}`);
    }
  }

  private toIsoString(value?: Date): string {
    if (!value) {
      return new Date().toISOString();
    }
    return new Date(value).toISOString();
  }
}
