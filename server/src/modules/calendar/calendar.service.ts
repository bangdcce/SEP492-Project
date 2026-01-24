import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThan, MoreThan, Repository } from 'typeorm';

import { CalendarEventEntity, EventStatus, EventType } from 'src/database/entities';
import { EventParticipantEntity } from 'src/database/entities/event-participant.entity';
import {
  AvailabilityType,
  UserAvailabilityEntity,
} from 'src/database/entities/user-availability.entity';
import type {
  AvailableSlotsResult,
  SchedulingConstraints,
  TimeSlot,
} from '../disputes/interfaces/staff-assignment.interface';

export interface FindAvailableSlotsInput {
  userIds: string[];
  durationMinutes: number;
  dateRange: { start: Date; end: Date };
  constraints?: Partial<SchedulingConstraints>;
  userTimezones?: Record<string, string>;
  preferredSlots?: Array<{ start: Date; end: Date }>;
  stepMinutes?: number;
  maxSlots?: number;
}

type TimeRange = { start: Date; end: Date; type?: AvailabilityType };

const DEFAULT_CONSTRAINTS: SchedulingConstraints = {
  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5],
  bufferMinutes: 15,
  lunchStart: '11:30',
  lunchEnd: '13:00',
  avoidLunchHours: true,
  maxEventsPerStaffPerDay: 5,
};

const ACTIVE_EVENT_STATUSES = [
  EventStatus.SCHEDULED,
  EventStatus.PENDING_CONFIRMATION,
  EventStatus.IN_PROGRESS,
  EventStatus.RESCHEDULING,
];

const DEFAULT_SLOT_STEP_MINUTES = 15;
const DEFAULT_MAX_SLOTS = 30;

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(EventParticipantEntity)
    private readonly participantRepository: Repository<EventParticipantEntity>,
  ) {}

  estimateEventDuration(eventType: EventType, complexity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
    const level = complexity ?? 'MEDIUM';

    switch (eventType) {
      case EventType.DISPUTE_HEARING:
        if (level === 'LOW') return 60;
        if (level === 'HIGH') return 120;
        if (level === 'CRITICAL') return 180;
        return 90;
      case EventType.PROJECT_MEETING:
        if (level === 'LOW') return 30;
        if (level === 'HIGH') return 60;
        return 45;
      case EventType.REVIEW_SESSION:
        return 45;
      case EventType.INTERNAL_MEETING:
        return 30;
      case EventType.PERSONAL_BLOCK:
        return 30;
      default:
        return 30;
    }
  }

  async findAvailableSlots(input: FindAvailableSlotsInput): Promise<AvailableSlotsResult> {
    const {
      userIds,
      durationMinutes,
      dateRange,
      userTimezones = {},
      preferredSlots = [],
      stepMinutes = DEFAULT_SLOT_STEP_MINUTES,
      maxSlots = DEFAULT_MAX_SLOTS,
    } = input;

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('userIds is required');
    }
    if (!durationMinutes || durationMinutes <= 0) {
      throw new BadRequestException('durationMinutes must be greater than 0');
    }
    if (!dateRange?.start || !dateRange?.end || dateRange.start >= dateRange.end) {
      throw new BadRequestException('Invalid dateRange');
    }

    const constraints: SchedulingConstraints = {
      ...DEFAULT_CONSTRAINTS,
      ...(input.constraints || {}),
    };

    const requiredMinutes = durationMinutes + Math.max(0, constraints.bufferMinutes || 0);

    const availabilityEntries = await this.availabilityRepository
      .createQueryBuilder('availability')
      .where('availability.userId IN (:...userIds)', { userIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('availability.isRecurring = true').orWhere(
            '(availability.startTime < :rangeEnd AND availability.endTime > :rangeStart)',
            {
              rangeStart: dateRange.start,
              rangeEnd: dateRange.end,
            },
          );
        }),
      )
      .getMany();

    const organizerEvents = await this.calendarRepository.find({
      where: {
        organizerId: In(userIds),
        startTime: LessThan(dateRange.end),
        endTime: MoreThan(dateRange.start),
        status: In(ACTIVE_EVENT_STATUSES),
      },
    });

    const participantEvents = await this.participantRepository
      .createQueryBuilder('participant')
      .innerJoinAndSelect('participant.event', 'event')
      .where('participant.userId IN (:...userIds)', { userIds })
      .andWhere('event.startTime < :rangeEnd AND event.endTime > :rangeStart', {
        rangeStart: dateRange.start,
        rangeEnd: dateRange.end,
      })
      .andWhere('event.status IN (:...statuses)', { statuses: ACTIVE_EVENT_STATUSES })
      .getMany();

    const busyRangesByUser = new Map<string, TimeRange[]>();
    const availableRangesByUser = new Map<string, TimeRange[]>();
    const preferredRangesByUser = new Map<string, TimeRange[]>();

    const pushRange = (map: Map<string, TimeRange[]>, userId: string, range: TimeRange) => {
      const list = map.get(userId) ?? [];
      list.push(range);
      map.set(userId, list);
    };

    const bufferMs = Math.max(0, constraints.bufferMinutes || 0) * 60 * 1000;
    const withBuffer = (start: Date, end: Date) => ({
      start: new Date(start.getTime() - bufferMs),
      end: new Date(end.getTime() + bufferMs),
    });

    for (const event of organizerEvents) {
      const range = withBuffer(event.startTime, event.endTime);
      pushRange(busyRangesByUser, event.organizerId, { ...range });
    }

    const participantSeen = new Set<string>();
    for (const participant of participantEvents) {
      if (!participant.event) continue;
      const key = `${participant.userId}:${participant.event.id}`;
      if (participantSeen.has(key)) continue;
      participantSeen.add(key);
      const range = withBuffer(participant.event.startTime, participant.event.endTime);
      pushRange(busyRangesByUser, participant.userId, { ...range });
    }

    for (const entry of availabilityEntries) {
      const ranges = entry.isRecurring
        ? this.expandRecurringAvailability(entry, dateRange, userTimezones[entry.userId])
        : entry.startTime && entry.endTime
          ? [{ start: entry.startTime, end: entry.endTime, type: entry.type }]
          : [];

      for (const range of ranges) {
        if (entry.type === AvailabilityType.PREFERRED) {
          pushRange(preferredRangesByUser, entry.userId, range);
          pushRange(availableRangesByUser, entry.userId, range);
        } else if (entry.type === AvailabilityType.AVAILABLE) {
          pushRange(availableRangesByUser, entry.userId, range);
        } else {
          pushRange(busyRangesByUser, entry.userId, {
            ...withBuffer(range.start, range.end),
            type: entry.type,
          });
        }
      }
    }

    const alignedStart = this.alignToStep(dateRange.start, stepMinutes);
    const slots: TimeSlot[] = [];

    for (
      let cursor = new Date(alignedStart);
      cursor.getTime() + requiredMinutes * 60 * 1000 <= dateRange.end.getTime();
      cursor = this.addMinutes(cursor, stepMinutes)
    ) {
      const slotStart = cursor;
      const slotEndCheck = this.addMinutes(slotStart, requiredMinutes);
      const slotEnd = this.addMinutes(slotStart, durationMinutes);

      let isValid = true;
      const scoreReasons: string[] = [];
      let score = 0;

      let preferredForAll = true;
      const perUserScores: number[] = [];

      for (const userId of userIds) {
        const busyRanges = busyRangesByUser.get(userId) ?? [];
        if (this.hasOverlap(busyRanges, slotStart, slotEndCheck)) {
          isValid = false;
          break;
        }

        const availableRanges = availableRangesByUser.get(userId) ?? [];
        if (
          availableRanges.length > 0 &&
          !this.isWithinAnyRange(availableRanges, slotStart, slotEndCheck)
        ) {
          isValid = false;
          break;
        }

        const preferredRanges = preferredRangesByUser.get(userId) ?? [];
        if (!this.isWithinAnyRange(preferredRanges, slotStart, slotEndCheck)) {
          preferredForAll = false;
        }

        const timeZone = userTimezones[userId] || 'UTC';
        const localStart = this.getLocalTimeInfo(slotStart, timeZone);
        const localEnd = this.getLocalTimeInfo(slotEnd, timeZone);
        const workStartMinutes = this.parseTimeToMinutes(constraints.workingHoursStart);
        const workEndMinutes = this.parseTimeToMinutes(constraints.workingHoursEnd);
        const workingDayAllowed = constraints.workingDays.includes(localStart.dayOfWeek);

        let userScore = 0;
        if (
          !workingDayAllowed ||
          localStart.minutesOfDay < workStartMinutes ||
          localEnd.minutesOfDay > workEndMinutes
        ) {
          userScore -= 100;
          scoreReasons.push(`outside-working-hours:${userId}`);
        } else if (localStart.minutesOfDay >= 540 && localStart.minutesOfDay < 660) {
          userScore += 20;
          scoreReasons.push(`morning:${userId}`);
        } else if (localStart.minutesOfDay >= 840 && localStart.minutesOfDay < 960) {
          userScore += 10;
          scoreReasons.push(`after-lunch:${userId}`);
        }

        if (constraints.avoidLunchHours) {
          const lunchStart = this.parseTimeToMinutes(constraints.lunchStart);
          const lunchEnd = this.parseTimeToMinutes(constraints.lunchEnd);
          const overlapsLunch =
            localStart.minutesOfDay < lunchEnd && localEnd.minutesOfDay > lunchStart;
          if (overlapsLunch) {
            userScore -= 50;
            scoreReasons.push(`lunch-overlap:${userId}`);
          }
        }

        perUserScores.push(userScore);
      }

      if (!isValid) {
        continue;
      }

      if (preferredForAll && preferredRangesByUser.size > 0) {
        score += 50;
        scoreReasons.push('preferred-slot');
      }

      if (preferredSlots.some((slot) => slotStart >= slot.start && slotEnd <= slot.end)) {
        score += 50;
        scoreReasons.push('preferred-input');
      }

      if (perUserScores.length > 0) {
        score += Math.round(
          perUserScores.reduce((sum, value) => sum + value, 0) / perUserScores.length,
        );
      }

      slots.push({
        start: slotStart,
        end: slotEnd,
        durationMinutes,
        score,
        scoreReasons,
      });

      if (slots.length >= maxSlots) {
        break;
      }
    }

    slots.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());

    const noSlotsReason =
      slots.length === 0
        ? 'No available slots found. Check external calendars or add manual blocks.'
        : undefined;

    if (slots.length === 0) {
      this.logger.warn(
        `[Calendar] No slots for ${userIds.join(', ')} in ${dateRange.start.toISOString()} - ${dateRange.end.toISOString()}`,
      );
    }

    return {
      slots,
      searchedDateRange: { start: dateRange.start, end: dateRange.end },
      constraints,
      noSlotsReason,
    };
  }

  private alignToStep(date: Date, stepMinutes: number): Date {
    const stepMs = stepMinutes * 60 * 1000;
    const aligned = Math.ceil(date.getTime() / stepMs) * stepMs;
    return new Date(aligned);
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private hasOverlap(ranges: TimeRange[], start: Date, end: Date): boolean {
    return ranges.some((range) => range.start < end && range.end > start);
  }

  private isWithinAnyRange(ranges: TimeRange[], start: Date, end: Date): boolean {
    return ranges.some((range) => range.start <= start && range.end >= end);
  }

  private parseTimeToMinutes(time: string): number {
    const [hour, minute, second] = time.split(':').map((value) => Number(value));
    const safeHour = Number.isFinite(hour) ? hour : 0;
    const safeMinute = Number.isFinite(minute) ? minute : 0;
    const safeSecond = Number.isFinite(second) ? second : 0;
    return safeHour * 60 + safeMinute + Math.floor(safeSecond / 60);
  }

  private getLocalTimeInfo(
    date: Date,
    timeZone: string,
  ): { dayOfWeek: number; minutesOfDay: number } {
    const localized = new Date(date.toLocaleString('en-US', { timeZone }));
    return {
      dayOfWeek: localized.getDay(),
      minutesOfDay: localized.getHours() * 60 + localized.getMinutes(),
    };
  }

  private expandRecurringAvailability(
    entry: UserAvailabilityEntity,
    dateRange: { start: Date; end: Date },
    timeZone?: string,
  ): TimeRange[] {
    if (!entry.isRecurring || entry.dayOfWeek == null) {
      return [];
    }

    const tz = timeZone || 'UTC';
    const ranges: TimeRange[] = [];
    const cursor = new Date(dateRange.start);
    cursor.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dateRange.end);
    rangeEnd.setHours(23, 59, 59, 999);

    const recurrenceStart = entry.recurringStartDate ? new Date(entry.recurringStartDate) : null;
    const recurrenceEnd = entry.recurringEndDate ? new Date(entry.recurringEndDate) : null;

    for (let day = new Date(cursor); day <= rangeEnd; day = this.addMinutes(day, 24 * 60)) {
      const local = new Date(day.toLocaleString('en-US', { timeZone: tz }));
      if (local.getDay() !== entry.dayOfWeek) {
        continue;
      }

      if (recurrenceStart && local < recurrenceStart) {
        continue;
      }
      if (recurrenceEnd && local > recurrenceEnd) {
        continue;
      }

      if (!entry.recurringStartTime || !entry.recurringEndTime) {
        continue;
      }

      const start = this.buildUtcDateFromLocalTime(local, entry.recurringStartTime, tz);
      const end = this.buildUtcDateFromLocalTime(local, entry.recurringEndTime, tz);

      if (start < dateRange.end && end > dateRange.start) {
        ranges.push({ start, end, type: entry.type });
      }
    }

    return ranges;
  }

  private buildUtcDateFromLocalTime(localDate: Date, time: string, timeZone: string): Date {
    const [hour, minute, second] = time.split(':').map((value) => Number(value));
    const local = new Date(localDate);
    local.setHours(
      Number.isFinite(hour) ? hour : 0,
      Number.isFinite(minute) ? minute : 0,
      Number.isFinite(second) ? second : 0,
      0,
    );
    const localized = new Date(local.toLocaleString('en-US', { timeZone }));
    const offset = local.getTime() - localized.getTime();
    return new Date(local.getTime() + offset);
  }
}
