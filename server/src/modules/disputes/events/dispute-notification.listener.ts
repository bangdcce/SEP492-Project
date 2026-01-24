import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

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

  @OnEvent(DISPUTE_EVENTS.INFO_REQUESTED)
  async handleInfoRequested(payload: {
    disputeId?: string;
    reason?: string;
  }): Promise<void> {
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
  async handleDisputeAccepted(payload: {
    disputeId?: string;
    adminId?: string;
  }): Promise<void> {
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

    const rateText = payload.dismissalRate
      ? `${Math.round(payload.dismissalRate * 100)}%`
      : 'high';
    const body = `Staff ${payload.staffId} dismissal rate is ${rateText} (n=${payload.totalReviewed || 0}).`;

    await this.createNotifications(admins, 'Staff dismissal rate high', body, 'User', payload.staffId);
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
    await this.createNotifications(admins, 'Random dismissal audit', body, 'Dispute', payload.disputeId);
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
      await this.notificationRepo.save(notifications);
    } catch (error) {
      this.logger.warn(
        `Failed to persist notifications for ${uniqueIds.length} users: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
