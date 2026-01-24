import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  DisputeEntity,
  DisputeStatus,
  DisputeHearingEntity,
  HearingStatus,
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
    private readonly staffAssignmentService: StaffAssignmentService,
    private readonly disputesService: DisputesService,
    private readonly verdictService: VerdictService,
    private readonly gateway: DisputeGateway,
  ) {}

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

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
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
  async handleStaffOverloaded(payload: {
    availableCount?: number;
    requiredCount?: number;
    affectedDisputes?: string[];
  }): Promise<void> {
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
  handleSpeakerControlChanged(payload: {
    hearingId?: string;
    changedBy?: string;
    previousRole?: string;
    newRole?: string;
    gracePeriodMs?: number;
    gracePeriodUntil?: Date;
  }): void {
    if (!payload?.hearingId) {
      return;
    }

    this.gateway.emitHearingEvent(payload.hearingId, 'SPEAKER_CONTROL_CHANGED', {
      ...payload,
      serverTimestamp: this.toIsoString(),
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
