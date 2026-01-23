import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThan, MoreThan, Repository } from 'typeorm';

import {
  AutoScheduleRuleEntity,
  CalendarEventEntity,
  EventStatus,
  EventType,
  UserEntity,
  UserRole,
} from 'src/database/entities';
import {
  EventParticipantEntity,
  ParticipantRole,
  ParticipantStatus,
} from 'src/database/entities/event-participant.entity';
import {
  AvailabilityType,
  UserAvailabilityEntity,
} from 'src/database/entities/user-availability.entity';
import { EventRescheduleRequestEntity, RescheduleRequestStatus } from 'src/database/entities';
import { StaffWorkloadEntity } from 'src/database/entities/staff-workload.entity';
import { CalendarService, FindAvailableSlotsInput } from './calendar.service';

const DEFAULT_RESPONSE_DEADLINE_HOURS = 24;
const DEFAULT_RESCHEDULE_WINDOW_DAYS = 7;
const DEFAULT_MIN_RESCHEDULE_NOTICE_HOURS = 2;
const AUTO_RESCHEDULE_LIMIT = 2;
const ACTIVE_EVENT_STATUSES = [
  EventStatus.SCHEDULED,
  EventStatus.PENDING_CONFIRMATION,
  EventStatus.IN_PROGRESS,
  EventStatus.RESCHEDULING,
];
const BUSY_AVAILABILITY_TYPES = [
  AvailabilityType.BUSY,
  AvailabilityType.OUT_OF_OFFICE,
  AvailabilityType.DO_NOT_DISTURB,
];

export interface AutoScheduleEventInput {
  eventType: EventType;
  title: string;
  organizerId: string;
  participantIds: string[];
  requiredParticipantIds?: string[];
  dateRange: { start: Date; end: Date };
  description?: string;
  durationMinutes?: number;
  complexity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  referenceType?: string;
  referenceId?: string;
  preferredSlots?: Array<{ start: Date; end: Date }>;
  userTimezones?: Record<string, string>;
  autoScheduleRuleId?: string;
  previousEventId?: string;
  rescheduleCount?: number;
}

export interface AutoScheduleResult {
  manualRequired: boolean;
  reason?: string;
  selectedSlot?: { start: Date; end: Date };
  event?: CalendarEventEntity;
  participants?: EventParticipantEntity[];
  suggestedRange?: { start: Date; end: Date };
}

export interface RescheduleResult {
  manualRequired: boolean;
  reason?: string;
  event?: CalendarEventEntity;
  participants?: EventParticipantEntity[];
}

@Injectable()
export class AutoScheduleService {
  private readonly logger = new Logger(AutoScheduleService.name);

  constructor(
    @InjectRepository(AutoScheduleRuleEntity)
    private readonly ruleRepository: Repository<AutoScheduleRuleEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(EventParticipantEntity)
    private readonly participantRepository: Repository<EventParticipantEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    @InjectRepository(EventRescheduleRequestEntity)
    private readonly rescheduleRepository: Repository<EventRescheduleRequestEntity>,
    private readonly calendarService: CalendarService,
    private readonly dataSource: DataSource,
  ) {}

  async autoScheduleEvent(input: AutoScheduleEventInput): Promise<AutoScheduleResult> {
    if (!input.participantIds || input.participantIds.length === 0) {
      throw new BadRequestException('participantIds is required');
    }

    const rule = await this.resolveRule(input.eventType, input.autoScheduleRuleId);
    const durationMinutes =
      input.durationMinutes ||
      rule?.defaultDurationMinutes ||
      this.calendarService.estimateEventDuration(input.eventType, input.complexity);

    const participantIds = Array.from(new Set([input.organizerId, ...input.participantIds]));
    const requiredIds = input.requiredParticipantIds?.length
      ? Array.from(new Set(input.requiredParticipantIds))
      : participantIds;

    const slotInput: FindAvailableSlotsInput = {
      userIds: participantIds,
      durationMinutes,
      dateRange: input.dateRange,
      constraints: rule
        ? {
            workingHoursStart: rule.workingHoursStart,
            workingHoursEnd: rule.workingHoursEnd,
            workingDays: rule.workingDays,
            bufferMinutes: rule.bufferMinutes,
            lunchStart: rule.lunchStartTime,
            lunchEnd: rule.lunchEndTime,
            avoidLunchHours: rule.avoidLunchHours,
            maxEventsPerStaffPerDay: rule.maxEventsPerStaffPerDay,
          }
        : undefined,
      userTimezones: input.userTimezones,
      preferredSlots: input.preferredSlots,
    };

    const availableSlots = await this.calendarService.findAvailableSlots(slotInput);
    if (availableSlots.slots.length === 0) {
      return {
        manualRequired: true,
        reason: availableSlots.noSlotsReason || 'No available slots found',
        suggestedRange: this.widenRange(input.dateRange),
      };
    }

    return this.dataSource.transaction(async (manager) => {
      await this.acquireSchedulingLocks(manager, participantIds);

      const selectedSlot = await this.pickFirstAvailableSlot(
        manager,
        availableSlots.slots,
        participantIds,
      );

      if (!selectedSlot) {
        return {
          manualRequired: true,
          reason: 'No available slots after conflict check',
          suggestedRange: this.widenRange(input.dateRange),
        };
      }

      const responseDeadline = this.calculateResponseDeadline(
        selectedSlot.start,
        rule?.minRescheduleNoticeHours,
      );

      const calendarRepo = manager.getRepository(CalendarEventEntity);
      const participantRepo = manager.getRepository(EventParticipantEntity);
      const availabilityRepo = manager.getRepository(UserAvailabilityEntity);

      const event = calendarRepo.create({
        type: input.eventType,
        title: input.title,
        description: input.description,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        durationMinutes,
        organizerId: input.organizerId,
        status: EventStatus.PENDING_CONFIRMATION,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        isAutoScheduled: true,
        autoScheduleRuleId: rule?.id,
        previousEventId: input.previousEventId,
        rescheduleCount: input.rescheduleCount ?? 0,
        lastRescheduledAt: input.rescheduleCount ? new Date() : undefined,
      });

      const savedEvent = await calendarRepo.save(event);

      const eventParticipants = participantIds.map((userId) => {
        const role =
          userId === input.organizerId
            ? ParticipantRole.ORGANIZER
            : requiredIds.includes(userId)
              ? ParticipantRole.REQUIRED
              : ParticipantRole.OPTIONAL;
        const isOrganizer = userId === input.organizerId;

        return participantRepo.create({
          eventId: savedEvent.id,
          userId,
          role,
          status: isOrganizer ? ParticipantStatus.ACCEPTED : ParticipantStatus.PENDING,
          respondedAt: isOrganizer ? new Date() : undefined,
          responseDeadline,
        });
      });

      const savedParticipants = await participantRepo.save(eventParticipants);

      const busySlots = participantIds.map((userId) =>
        availabilityRepo.create({
          userId,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          type: AvailabilityType.BUSY,
          isAutoGenerated: true,
          linkedEventId: savedEvent.id,
          note: 'Auto-scheduled event',
        }),
      );
      await availabilityRepo.save(busySlots);

      await this.updateStaffWorkload(
        manager,
        savedEvent.organizerId,
        durationMinutes,
        savedEvent.startTime,
      );

      this.logger.log(
        `Auto-scheduled event ${savedEvent.id} at ${selectedSlot.start.toISOString()}`,
      );

      return {
        manualRequired: false,
        selectedSlot: { start: selectedSlot.start, end: selectedSlot.end },
        event: savedEvent,
        participants: savedParticipants,
      };
    });
  }

  async handleRescheduleRequest(
    requestId: string,
    processorId?: string,
  ): Promise<RescheduleResult> {
    const request = await this.rescheduleRepository.findOne({ where: { id: requestId } });
    if (!request) {
      throw new BadRequestException('Reschedule request not found');
    }

    const event = await this.calendarRepository.findOne({ where: { id: request.eventId } });
    if (!event) {
      throw new BadRequestException('Calendar event not found');
    }

    if (
      ![EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION, EventStatus.RESCHEDULING].includes(
        event.status,
      )
    ) {
      throw new BadRequestException(`Event is ${event.status}, cannot reschedule`);
    }

    const rule = await this.resolveRule(event.type);
    const rescheduleLimit = Math.min(
      AUTO_RESCHEDULE_LIMIT,
      rule?.maxRescheduleCount ?? AUTO_RESCHEDULE_LIMIT,
    );
    const minNoticeHours = rule?.minRescheduleNoticeHours ?? DEFAULT_MIN_RESCHEDULE_NOTICE_HOURS;

    const rescheduleCutoff = new Date(event.startTime.getTime() - minNoticeHours * 60 * 60 * 1000);
    if (new Date() >= rescheduleCutoff) {
      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.REJECTED,
        processedById: processorId,
        processedAt: new Date(),
        processNote: 'Too close to scheduled time to reschedule',
      });
      return { manualRequired: true, reason: 'Reschedule window closed' };
    }

    if (event.rescheduleCount >= rescheduleLimit) {
      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.REJECTED,
        processedById: processorId,
        processedAt: new Date(),
        processNote: 'Reschedule limit reached',
      });
      return { manualRequired: true, reason: 'Reschedule limit reached' };
    }

    const participants = await this.participantRepository.find({
      where: { eventId: event.id },
    });
    const participantIds = participants.map((p) => p.userId);

    const durationMinutes = event.durationMinutes;

    let selectedSlot: { start: Date; end: Date } | null = null;

    if (request.proposedTimeSlots && request.proposedTimeSlots.length > 0) {
      const scored = await this.scoreProposedSlots(
        participantIds,
        durationMinutes,
        request.proposedTimeSlots,
        rule,
      );
      if (scored.length > 0) {
        selectedSlot = scored[0];
      }
    }

    if (!selectedSlot && request.useAutoSchedule) {
      const dateRange = {
        start: new Date(),
        end: this.addDays(new Date(), DEFAULT_RESCHEDULE_WINDOW_DAYS),
      };
      const autoResult = await this.autoScheduleEvent({
        eventType: event.type,
        title: event.title,
        organizerId: event.organizerId,
        participantIds,
        requiredParticipantIds: participants
          .filter((p) => p.role === ParticipantRole.REQUIRED)
          .map((p) => p.userId),
        dateRange,
        description: event.description || undefined,
        durationMinutes,
        referenceType: event.referenceType,
        referenceId: event.referenceId,
        autoScheduleRuleId: rule?.id,
        previousEventId: event.id,
        rescheduleCount: event.rescheduleCount + 1,
      });

      if (autoResult.manualRequired || !autoResult.event) {
        await this.rescheduleRepository.update(request.id, {
          status: RescheduleRequestStatus.REJECTED,
          processedById: processorId,
          processedAt: new Date(),
          processNote: autoResult.reason || 'Auto schedule failed',
        });
        return { manualRequired: true, reason: autoResult.reason };
      }

      await this.calendarRepository.update(event.id, {
        status: EventStatus.RESCHEDULING,
      });
      await this.availabilityRepository.delete({
        linkedEventId: event.id,
        isAutoGenerated: true,
      });

      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.AUTO_RESOLVED,
        processedById: processorId,
        processedAt: new Date(),
        newEventId: autoResult.event.id,
        selectedNewStartTime: autoResult.event.startTime,
      });

      return {
        manualRequired: false,
        event: autoResult.event,
        participants: autoResult.participants,
      };
    }

    if (!selectedSlot) {
      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.REJECTED,
        processedById: processorId,
        processedAt: new Date(),
        processNote: 'No valid slot proposed',
      });
      return { manualRequired: true, reason: 'No valid slot proposed' };
    }

    return this.dataSource.transaction(async (manager) => {
      await this.acquireSchedulingLocks(manager, participantIds);

      const conflict = await this.hasConflict(
        manager,
        participantIds,
        selectedSlot.start,
        selectedSlot.end,
      );
      if (conflict) {
        await this.rescheduleRepository.update(request.id, {
          status: RescheduleRequestStatus.REJECTED,
          processedById: processorId,
          processedAt: new Date(),
          processNote: 'Selected slot is no longer available',
        });
        return { manualRequired: true, reason: 'Slot is no longer available' };
      }

      const calendarRepo = manager.getRepository(CalendarEventEntity);
      const participantRepo = manager.getRepository(EventParticipantEntity);
      const availabilityRepo = manager.getRepository(UserAvailabilityEntity);

      await availabilityRepo.delete({ linkedEventId: event.id, isAutoGenerated: true });

      await calendarRepo.update(event.id, {
        status: EventStatus.RESCHEDULING,
        rescheduleCount: event.rescheduleCount + 1,
        lastRescheduledAt: new Date(),
      });

      const newEvent = calendarRepo.create({
        type: event.type,
        title: event.title,
        description: event.description,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        durationMinutes,
        organizerId: event.organizerId,
        status: EventStatus.PENDING_CONFIRMATION,
        referenceType: event.referenceType,
        referenceId: event.referenceId,
        previousEventId: event.id,
        rescheduleCount: event.rescheduleCount + 1,
        lastRescheduledAt: new Date(),
        isAutoScheduled: event.isAutoScheduled,
        autoScheduleRuleId: event.autoScheduleRuleId,
      });

      const savedEvent = await calendarRepo.save(newEvent);

      const newParticipants = participants.map((participant) =>
        participantRepo.create({
          eventId: savedEvent.id,
          userId: participant.userId,
          role: participant.role,
          status:
            participant.role === ParticipantRole.ORGANIZER
              ? ParticipantStatus.ACCEPTED
              : ParticipantStatus.PENDING,
          respondedAt: participant.role === ParticipantRole.ORGANIZER ? new Date() : undefined,
          responseDeadline: this.calculateResponseDeadline(
            savedEvent.startTime,
            rule?.minRescheduleNoticeHours,
          ),
        }),
      );

      const savedParticipants = await participantRepo.save(newParticipants);

      const busySlots = participantIds.map((userId) =>
        availabilityRepo.create({
          userId,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          type: AvailabilityType.BUSY,
          isAutoGenerated: true,
          linkedEventId: savedEvent.id,
          note: 'Rescheduled event',
        }),
      );
      await availabilityRepo.save(busySlots);

      await this.updateStaffWorkload(
        manager,
        savedEvent.organizerId,
        durationMinutes,
        savedEvent.startTime,
      );

      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.APPROVED,
        processedById: processorId,
        processedAt: new Date(),
        newEventId: savedEvent.id,
        selectedNewStartTime: savedEvent.startTime,
      });

      return { manualRequired: false, event: savedEvent, participants: savedParticipants };
    });
  }

  async processManualRescheduleRequest(
    requestId: string,
    selectedStartTime: Date,
    processorId?: string,
    processNote?: string,
  ): Promise<RescheduleResult> {
    const request = await this.rescheduleRepository.findOne({ where: { id: requestId } });
    if (!request) {
      throw new BadRequestException('Reschedule request not found');
    }

    if (request.status !== RescheduleRequestStatus.PENDING) {
      throw new BadRequestException('Reschedule request already processed');
    }

    const event = await this.calendarRepository.findOne({ where: { id: request.eventId } });
    if (!event) {
      throw new BadRequestException('Calendar event not found');
    }

    if (
      ![EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION, EventStatus.RESCHEDULING].includes(
        event.status,
      )
    ) {
      throw new BadRequestException(`Event is ${event.status}, cannot reschedule`);
    }

    const rule = await this.resolveRule(event.type);
    const rescheduleLimit = Math.min(
      AUTO_RESCHEDULE_LIMIT,
      rule?.maxRescheduleCount ?? AUTO_RESCHEDULE_LIMIT,
    );
    const minNoticeHours = rule?.minRescheduleNoticeHours ?? DEFAULT_MIN_RESCHEDULE_NOTICE_HOURS;

    const rescheduleCutoff = new Date(event.startTime.getTime() - minNoticeHours * 60 * 60 * 1000);
    if (new Date() >= rescheduleCutoff) {
      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.REJECTED,
        processedById: processorId,
        processedAt: new Date(),
        processNote: 'Too close to scheduled time to reschedule',
      });
      return { manualRequired: true, reason: 'Reschedule window closed' };
    }

    if (event.rescheduleCount >= rescheduleLimit) {
      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.REJECTED,
        processedById: processorId,
        processedAt: new Date(),
        processNote: 'Reschedule limit reached',
      });
      return { manualRequired: true, reason: 'Reschedule limit reached' };
    }

    const start = new Date(selectedStartTime);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid selected start time');
    }

    const proposedSlots = (request.proposedTimeSlots || []).map((slot) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }));

    if (proposedSlots.length > 0) {
      const matched = proposedSlots.find((slot) => slot.start.getTime() === start.getTime());
      if (!matched) {
        throw new BadRequestException('Selected time is not in proposed slots');
      }

      const expectedEnd = new Date(start.getTime() + event.durationMinutes * 60 * 1000);
      if (Number.isNaN(matched.end.getTime()) || matched.end.getTime() < expectedEnd.getTime()) {
        throw new BadRequestException('Selected slot is shorter than event duration');
      }
    }

    const end = new Date(start.getTime() + event.durationMinutes * 60 * 1000);
    if (Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('Invalid selected time slot');
    }

    const participants = await this.participantRepository.find({
      where: { eventId: event.id },
    });
    const participantIds = participants.map((p) => p.userId);

    return this.dataSource.transaction(async (manager) => {
      await this.acquireSchedulingLocks(manager, participantIds);

      const conflict = await this.hasConflict(manager, participantIds, start, end);
      if (conflict) {
        await this.rescheduleRepository.update(request.id, {
          status: RescheduleRequestStatus.REJECTED,
          processedById: processorId,
          processedAt: new Date(),
          processNote: 'Selected slot is no longer available',
        });
        return { manualRequired: true, reason: 'Slot is no longer available' };
      }

      const calendarRepo = manager.getRepository(CalendarEventEntity);
      const participantRepo = manager.getRepository(EventParticipantEntity);
      const availabilityRepo = manager.getRepository(UserAvailabilityEntity);

      await availabilityRepo.delete({ linkedEventId: event.id, isAutoGenerated: true });

      await calendarRepo.update(event.id, {
        status: EventStatus.RESCHEDULING,
        rescheduleCount: event.rescheduleCount + 1,
        lastRescheduledAt: new Date(),
      });

      const newEvent = calendarRepo.create({
        type: event.type,
        title: event.title,
        description: event.description,
        startTime: start,
        endTime: end,
        durationMinutes: event.durationMinutes,
        organizerId: event.organizerId,
        status: EventStatus.PENDING_CONFIRMATION,
        referenceType: event.referenceType,
        referenceId: event.referenceId,
        previousEventId: event.id,
        rescheduleCount: event.rescheduleCount + 1,
        lastRescheduledAt: new Date(),
        isAutoScheduled: event.isAutoScheduled,
        autoScheduleRuleId: event.autoScheduleRuleId,
      });

      const savedEvent = await calendarRepo.save(newEvent);

      const newParticipants = participants.map((participant) =>
        participantRepo.create({
          eventId: savedEvent.id,
          userId: participant.userId,
          role: participant.role,
          status:
            participant.role === ParticipantRole.ORGANIZER
              ? ParticipantStatus.ACCEPTED
              : ParticipantStatus.PENDING,
          respondedAt: participant.role === ParticipantRole.ORGANIZER ? new Date() : undefined,
          responseDeadline: this.calculateResponseDeadline(
            savedEvent.startTime,
            rule?.minRescheduleNoticeHours,
          ),
        }),
      );

      const savedParticipants = await participantRepo.save(newParticipants);

      const busySlots = participantIds.map((userId) =>
        availabilityRepo.create({
          userId,
          startTime: start,
          endTime: end,
          type: AvailabilityType.BUSY,
          isAutoGenerated: true,
          linkedEventId: savedEvent.id,
          note: 'Rescheduled event',
        }),
      );
      await availabilityRepo.save(busySlots);

      await this.updateStaffWorkload(
        manager,
        savedEvent.organizerId,
        event.durationMinutes,
        savedEvent.startTime,
      );

      await this.rescheduleRepository.update(request.id, {
        status: RescheduleRequestStatus.APPROVED,
        processedById: processorId,
        processedAt: new Date(),
        processNote,
        newEventId: savedEvent.id,
        selectedNewStartTime: savedEvent.startTime,
      });

      return { manualRequired: false, event: savedEvent, participants: savedParticipants };
    });
  }

  async processEventInvitations(
    participantId: string,
    response: 'accept' | 'decline' | 'tentative',
    responseNote?: string,
  ): Promise<{
    event: CalendarEventEntity;
    participant: EventParticipantEntity;
    manualRequired: boolean;
    reason?: string;
  }> {
    const participant = await this.participantRepository.findOne({
      where: { id: participantId },
    });
    if (!participant) {
      throw new BadRequestException('Participant not found');
    }

    const event = await this.calendarRepository.findOne({ where: { id: participant.eventId } });
    if (!event) {
      throw new BadRequestException('Calendar event not found');
    }

    if ([EventStatus.CANCELLED, EventStatus.COMPLETED].includes(event.status)) {
      throw new BadRequestException(`Event is ${event.status}, cannot respond`);
    }

    participant.status =
      response === 'accept'
        ? ParticipantStatus.ACCEPTED
        : response === 'decline'
          ? ParticipantStatus.DECLINED
          : ParticipantStatus.TENTATIVE;
    participant.respondedAt = new Date();
    participant.responseNote = responseNote;
    await this.participantRepository.save(participant);

    if (participant.role === ParticipantRole.REQUIRED && response === 'decline') {
      const rule = await this.resolveRule(event.type);
      const rescheduleLimit = Math.min(
        AUTO_RESCHEDULE_LIMIT,
        rule?.maxRescheduleCount ?? AUTO_RESCHEDULE_LIMIT,
      );

      if (event.rescheduleCount >= rescheduleLimit) {
        await this.calendarRepository.update(event.id, {
          status: EventStatus.RESCHEDULING,
          metadata: {
            ...(event.metadata || {}),
            manualNegotiationRequired: true,
            rejectionLoop: true,
          },
        });
        return {
          event,
          participant,
          manualRequired: true,
          reason: 'Auto reschedule limit reached',
        };
      }

      await this.calendarRepository.update(event.id, {
        status: EventStatus.RESCHEDULING,
        rescheduleCount: event.rescheduleCount + 1,
        lastRescheduledAt: new Date(),
      });

      const rescheduleRequest = this.rescheduleRepository.create({
        eventId: event.id,
        requesterId: participant.userId,
        reason: responseNote || 'Auto reschedule triggered by decline',
        useAutoSchedule: true,
        status: RescheduleRequestStatus.PENDING,
      });
      const savedRequest = await this.rescheduleRepository.save(rescheduleRequest);

      const rescheduleResult = await this.handleRescheduleRequest(
        savedRequest.id,
        event.organizerId,
      );
      return {
        event,
        participant,
        manualRequired: rescheduleResult.manualRequired,
        reason: rescheduleResult.reason,
      };
    }

    const requiredParticipants = await this.participantRepository.find({
      where: {
        eventId: event.id,
        role: ParticipantRole.REQUIRED,
      },
    });

    const allRequiredAccepted = requiredParticipants.every(
      (p) => p.status === ParticipantStatus.ACCEPTED,
    );

    if (allRequiredAccepted) {
      await this.calendarRepository.update(event.id, {
        status: EventStatus.SCHEDULED,
      });
    }

    return {
      event,
      participant,
      manualRequired: false,
    };
  }

  private async resolveRule(eventType: EventType, ruleId?: string) {
    if (ruleId) {
      return this.ruleRepository.findOne({ where: { id: ruleId, isActive: true } });
    }

    const defaultRule = await this.ruleRepository.findOne({
      where: { eventType, isActive: true, isDefault: true },
    });
    if (defaultRule) {
      return defaultRule;
    }

    return this.ruleRepository.findOne({ where: { eventType, isActive: true } });
  }

  private widenRange(range: { start: Date; end: Date }) {
    const start = new Date(range.start);
    const end = new Date(range.end);
    return {
      start: this.addDays(start, 1),
      end: this.addDays(end, 3),
    };
  }

  private async scoreProposedSlots(
    participantIds: string[],
    durationMinutes: number,
    proposedSlots: Array<{ start: Date; end: Date }>,
    rule?: AutoScheduleRuleEntity | null,
  ): Promise<Array<{ start: Date; end: Date }>> {
    const scored: Array<{ start: Date; end: Date; score: number }> = [];

    for (const slot of proposedSlots) {
      const range = { start: new Date(slot.start), end: new Date(slot.end) };
      if (
        Number.isNaN(range.start.getTime()) ||
        Number.isNaN(range.end.getTime()) ||
        range.start >= range.end
      ) {
        continue;
      }
      const slotInput: FindAvailableSlotsInput = {
        userIds: participantIds,
        durationMinutes,
        dateRange: range,
        constraints: rule
          ? {
              workingHoursStart: rule.workingHoursStart,
              workingHoursEnd: rule.workingHoursEnd,
              workingDays: rule.workingDays,
              bufferMinutes: rule.bufferMinutes,
              lunchStart: rule.lunchStartTime,
              lunchEnd: rule.lunchEndTime,
              avoidLunchHours: rule.avoidLunchHours,
              maxEventsPerStaffPerDay: rule.maxEventsPerStaffPerDay,
            }
          : undefined,
        maxSlots: 1,
        stepMinutes: durationMinutes,
      };

      const result = await this.calendarService.findAvailableSlots(slotInput);
      if (result.slots.length === 0) {
        continue;
      }

      const candidate = result.slots[0];
      if (candidate.start.getTime() !== range.start.getTime()) {
        continue;
      }

      scored.push({ start: candidate.start, end: candidate.end, score: candidate.score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => ({ start: item.start, end: item.end }));
  }

  private async acquireSchedulingLocks(manager: EntityManager, userIds: string[]) {
    const uniqueSorted = Array.from(new Set(userIds)).sort();
    for (const userId of uniqueSorted) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
    }
  }

  private async pickFirstAvailableSlot(
    manager: EntityManager,
    slots: Array<{ start: Date; end: Date }>,
    participantIds: string[],
  ) {
    for (const slot of slots) {
      const conflict = await this.hasConflict(manager, participantIds, slot.start, slot.end);
      if (!conflict) {
        return { start: slot.start, end: slot.end };
      }
    }
    return null;
  }

  private async hasConflict(
    manager: EntityManager,
    participantIds: string[],
    start: Date,
    end: Date,
  ): Promise<boolean> {
    const eventRepo = manager.getRepository(CalendarEventEntity);
    const participantRepo = manager.getRepository(EventParticipantEntity);
    const availabilityRepo = manager.getRepository(UserAvailabilityEntity);

    const overlappingEvents = await eventRepo.find({
      where: {
        organizerId: In(participantIds),
        startTime: LessThan(end),
        endTime: MoreThan(start),
        status: In(ACTIVE_EVENT_STATUSES),
      },
    });

    if (overlappingEvents.length > 0) {
      return true;
    }

    const participantEvents = await participantRepo
      .createQueryBuilder('participant')
      .innerJoinAndSelect('participant.event', 'event')
      .where('participant.userId IN (:...userIds)', { userIds: participantIds })
      .andWhere('event.startTime < :end AND event.endTime > :start', { start, end })
      .andWhere('event.status IN (:...statuses)', { statuses: ACTIVE_EVENT_STATUSES })
      .getMany();

    if (participantEvents.length > 0) {
      return true;
    }

    const busy = await availabilityRepo.find({
      where: {
        userId: In(participantIds),
        type: In(BUSY_AVAILABILITY_TYPES),
        startTime: LessThan(end),
        endTime: MoreThan(start),
      },
    });

    return busy.length > 0;
  }

  private calculateResponseDeadline(startTime: Date, minNoticeHours?: number) {
    const fallbackHours = minNoticeHours ?? DEFAULT_RESPONSE_DEADLINE_HOURS;
    const deadline = new Date(startTime.getTime() - fallbackHours * 60 * 60 * 1000);
    return deadline > new Date() ? deadline : new Date();
  }

  private async updateStaffWorkload(
    manager: EntityManager,
    organizerId: string,
    durationMinutes: number,
    eventStart: Date,
  ) {
    const userRepo = manager.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { id: organizerId },
      select: ['id', 'role'],
    });
    if (!user || user.role !== UserRole.STAFF) {
      return;
    }

    const dateKey = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());

    const workloadRepo = manager.getRepository(StaffWorkloadEntity);
    const existing = await workloadRepo.findOne({
      where: { staffId: organizerId, date: dateKey as any },
    });

    if (existing) {
      const scheduledMinutes = existing.scheduledMinutes + durationMinutes;
      const utilizationRate = (scheduledMinutes / existing.dailyCapacityMinutes) * 100;
      await workloadRepo.update(existing.id, {
        scheduledMinutes,
        totalEventsScheduled: existing.totalEventsScheduled + 1,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        isOverloaded: utilizationRate >= 90,
        canAcceptNewEvent: utilizationRate < 80,
      });
    } else {
      const utilizationRate = (durationMinutes / 480) * 100;
      await workloadRepo.save(
        workloadRepo.create({
          staffId: organizerId,
          date: dateKey as any,
          totalEventsScheduled: 1,
          scheduledMinutes: durationMinutes,
          dailyCapacityMinutes: 480,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          isOverloaded: utilizationRate >= 90,
          canAcceptNewEvent: utilizationRate < 80,
        }),
      );
    }
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}
