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
  HearingStatus,
  HearingReminderType,
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
    private readonly staffAssignmentService: StaffAssignmentService,
    private readonly disputesService: DisputesService,
    private readonly verdictService: VerdictService,
    private readonly gateway: DisputeGateway,
  ) {}

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
    const canonicalPayload = this.buildLedgerCanonicalPayload({
      disputeId,
      eventType,
      actorId: payload.actorId || null,
      reason: payload.reason || null,
      payload: payload.metadata || {},
      previousHash: latest?.hash || null,
      recordedAt,
    });
    const hash = createHash('sha256').update(canonicalPayload).digest('hex');

    await this.ledgerRepo.insert({
      disputeId,
      eventType,
      actorId: payload.actorId || undefined,
      reason: payload.reason || undefined,
      payload: payload.metadata || {},
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
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS]),
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

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_SCHEDULED', {
      hearingId: payload.hearingId,
      scheduledAt: payload.scheduledAt,
      serverTimestamp: this.toIsoString(),
    });
    this.gateway.emitStaffDashboardEvent('HEARING_SCHEDULED', {
      disputeId: payload.disputeId,
      hearingId: payload.hearingId,
      scheduledAt: payload.scheduledAt,
      serverTimestamp: this.toIsoString(),
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

    this.gateway.emitDisputeEvent(payload.disputeId, 'HEARING_RESCHEDULED', {
      hearingId: payload.hearingId,
      previousHearingId: payload.previousHearingId,
      scheduledAt: payload.scheduledAt,
      serverTimestamp: this.toIsoString(),
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

    this.gateway.emitDisputeEvent(hearing.disputeId, 'HEARING_STARTED', {
      hearingId: hearing.id,
      startedAt: payload.startedAt,
      startedBy: payload.startedBy,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(hearing.disputeId, 'HEARING_STARTED', {
      actorId: payload.startedBy || null,
      metadata: {
        hearingId: hearing.id,
        startedAt: payload.startedAt ? this.toIsoString(payload.startedAt) : null,
      },
    });
  }

  @OnEvent('hearing.ended')
  async handleHearingEnded(payload: { hearingId?: string; endedById?: string }): Promise<void> {
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

    this.gateway.emitStaffDashboardEvent('HEARING_ENDED', {
      disputeId: hearing.disputeId,
      hearingId: hearing.id,
      endedById: payload.endedById,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitDisputeEvent(hearing.disputeId, 'HEARING_ENDED', {
      hearingId: hearing.id,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(hearing.disputeId, 'HEARING_ENDED', {
      actorId: payload.endedById || null,
      metadata: {
        hearingId: hearing.id,
      },
    });
  }

  @OnEvent('verdict.issued')
  async handleVerdictIssued(payload: {
    disputeId?: string;
    verdictId?: string;
    appealDeadline?: Date;
    issuedBy?: string;
  }): Promise<void> {
    if (!payload?.disputeId) {
      return;
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'VERDICT_ISSUED', {
      verdictId: payload.verdictId,
      appealDeadline: payload.appealDeadline,
      serverTimestamp: this.toIsoString(),
    });

    this.gateway.emitStaffDashboardEvent('VERDICT_ISSUED', {
      disputeId: payload.disputeId,
      verdictId: payload.verdictId,
      appealDeadline: payload.appealDeadline,
      serverTimestamp: this.toIsoString(),
    });

    await this.appendLedger(payload.disputeId, 'VERDICT_ISSUED', {
      actorId: payload.issuedBy || null,
      metadata: {
        verdictId: payload.verdictId || null,
        appealDeadline: payload.appealDeadline ? this.toIsoString(payload.appealDeadline) : null,
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

  @OnEvent(DISPUTE_EVENTS.EVIDENCE_ADDED)
  handleEvidenceUploaded(payload: {
    disputeId?: string;
    evidenceId?: string;
    uploaderId?: string;
    uploaderRole?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    uploadedAt?: Date;
  }): void {
    if (!payload?.disputeId || !payload?.evidenceId) {
      return;
    }

    this.gateway.emitDisputeEvent(payload.disputeId, 'EVIDENCE_UPLOADED', {
      ...payload,
      serverTimestamp: this.toIsoString(payload.uploadedAt),
    });
  }

  private toIsoString(value?: Date): string {
    if (!value) {
      return new Date().toISOString();
    }
    return new Date(value).toISOString();
  }
}
