import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Brackets } from 'typeorm';

import { EventPriority, EventStatus, EventType, UserRole } from 'src/database/entities';
import {
  EventParticipantEntity,
  ParticipantRole,
  ParticipantStatus,
} from 'src/database/entities/event-participant.entity';
import { CreateCalendarEventDto, CalendarEventFilterDto } from 'src/modules/calendar/dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CalendarController } from 'src/modules/calendar/calendar.controller';

import {
  buildUser,
  createQueryBuilderMock,
  getRouteGuards,
  validateDto,
} from './test-helpers';
import { assertCurrentTestHasCaseLog } from './test-log-helpers';
import {
  EVENT_ID,
  OTHER_EVENT_ID,
  OTHER_USER_ID,
  REQUEST_ID,
  SAMPLE_END,
  SAMPLE_START,
  USER_ID,
  createCalendarDependencies,
} from './calendar-test-factory';

const buildCalendarController = () => {
  const deps = createCalendarDependencies();
  const controller = new CalendarController(
    deps.calendarRepository as never,
    deps.participantRepository as never,
    deps.rescheduleRepository as never,
    deps.availabilityRepository as never,
    deps.userRepository as never,
    deps.disputeRepository as never,
    deps.hearingRepository as never,
    deps.hearingParticipantRepository as never,
    deps.projectRepository as never,
    deps.calendarService as never,
    deps.autoScheduleService as never,
    deps.availabilityService as never,
    { emit: jest.fn() } as EventEmitter2,
  );

  return { controller, ...deps };
};

describe('Calendar events module cluster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DISPUTE_CALENDAR_SCOPE_LOCK;
  });

  afterEach(() => {
    delete process.env.DISPUTE_CALENDAR_SCOPE_LOCK;
    assertCurrentTestHasCaseLog();
  });

  describe('EP-031 createEvent', () => {
    it('EP-031 UTC01 happy path creates a scheduled event with deduplicated participantUserIds', async () => {
      const deps = buildCalendarController();
      const organizer = buildUser(UserRole.ADMIN, { id: USER_ID });
      deps.calendarRepository.save.mockResolvedValue({
        id: EVENT_ID,
        organizerId: USER_ID,
        status: EventStatus.PENDING_CONFIRMATION,
      });

      const result = await deps.controller.createEvent(
        {
          type: EventType.PROJECT_MEETING,
          title: 'Kickoff meeting',
          priority: EventPriority.HIGH,
          startTime: SAMPLE_START,
          endTime: SAMPLE_END,
          participantUserIds: [OTHER_USER_ID, OTHER_USER_ID, USER_ID],
        } as never,
        organizer as never,
      );

      expect(deps.calendarService.findAvailableSlots).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [USER_ID, OTHER_USER_ID],
          durationMinutes: 60,
        }),
      );
      expect(deps.participantRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: USER_ID,
            role: ParticipantRole.ORGANIZER,
            status: ParticipantStatus.ACCEPTED,
          }),
          expect.objectContaining({
            userId: OTHER_USER_ID,
            role: ParticipantRole.REQUIRED,
            status: ParticipantStatus.PENDING,
          }),
        ]),
      );
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Event created',
        }),
      );
    });

    it('EP-031 UTC02 edge case auto-schedules when useAutoSchedule is enabled', async () => {
      const deps = buildCalendarController();
      const organizer = buildUser(UserRole.STAFF, { id: USER_ID });
      deps.autoScheduleService.autoScheduleEvent.mockResolvedValue({
        manualRequired: false,
        eventId: EVENT_ID,
      });

      const result = await deps.controller.createEvent(
        {
          type: EventType.PROJECT_MEETING,
          title: 'Auto schedule',
          startTime: SAMPLE_START,
          endTime: SAMPLE_END,
          useAutoSchedule: true,
          participantUserIds: [OTHER_USER_ID],
        } as never,
        organizer as never,
      );

      expect(deps.autoScheduleService.autoScheduleEvent).toHaveBeenCalled();
      expect(result.message).toBe('Event auto-scheduled');
    });

    it('EP-031 UTC03 edge case skips availability lookup for organizer-only events', async () => {
      const deps = buildCalendarController();
      const organizer = buildUser(UserRole.ADMIN, { id: USER_ID });
      deps.calendarRepository.save.mockResolvedValue({
        id: EVENT_ID,
        organizerId: USER_ID,
        status: EventStatus.SCHEDULED,
      });

      await deps.controller.createEvent(
        {
          type: EventType.INTERNAL_MEETING,
          title: 'Solo block',
          startTime: SAMPLE_START,
          endTime: SAMPLE_END,
        } as never,
        organizer as never,
      );

      expect(deps.calendarService.findAvailableSlots).not.toHaveBeenCalled();
      expect(deps.availabilityService.syncCalendarEvents).toHaveBeenCalledWith({
        start: new Date(SAMPLE_START),
        end: new Date(SAMPLE_END),
      });
    });

    it('EP-031 UTC04 validation rejects unsupported event type values in CreateCalendarEventDto', () => {
      const errors = validateDto(CreateCalendarEventDto, {
        type: 'INVALID_TYPE',
        title: 'Broken event',
        startTime: SAMPLE_START,
        endTime: SAMPLE_END,
      });

      expect(errors.some((error) => error.property === 'type')).toBe(true);
    });

    it('EP-031 UTC05 validation rejects event times when startTime is not before endTime', async () => {
      const deps = buildCalendarController();
      const organizer = buildUser(UserRole.ADMIN, { id: USER_ID });

      await expect(
        deps.controller.createEvent(
          {
            type: EventType.PROJECT_MEETING,
            title: 'Broken interval',
            startTime: SAMPLE_END,
            endTime: SAMPLE_START,
          } as never,
          organizer as never,
        ),
      ).rejects.toThrow(new BadRequestException('startTime must be before endTime'));
    });

    it('EP-031 UTC06 validation rejects unavailable time selections', async () => {
      const deps = buildCalendarController();
      const organizer = buildUser(UserRole.ADMIN, { id: USER_ID });
      deps.calendarService.findAvailableSlots.mockResolvedValue({
        slots: [],
        searchedDateRange: { start: new Date(SAMPLE_START), end: new Date(SAMPLE_END) },
        constraints: {},
      });

      await expect(
        deps.controller.createEvent(
          {
            type: EventType.PROJECT_MEETING,
            title: 'Conflicting slot',
            startTime: SAMPLE_START,
            endTime: SAMPLE_END,
            participantUserIds: [OTHER_USER_ID],
          } as never,
          organizer as never,
        ),
      ).rejects.toThrow(new BadRequestException('Selected time conflicts with availability'));
    });

    it('EP-031 UTC07 security declares JwtAuthGuard on createEvent', () => {
      expect(getRouteGuards(CalendarController, 'createEvent')).toContain(JwtAuthGuard);
    });

    it('EP-031 UTC08 security blocks participant roles from creating dispute events directly', async () => {
      const deps = buildCalendarController();
      const participant = buildUser(UserRole.CLIENT, { id: USER_ID });

      await expect(
        deps.controller.createEvent(
          {
            type: EventType.DISPUTE_HEARING,
            title: 'Hearing',
            startTime: SAMPLE_START,
            endTime: SAMPLE_END,
          } as never,
          participant as never,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('EP-032 listEvents', () => {
    it('EP-032 UTC01 happy path returns enriched event items for the requested participantId', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: EVENT_ID,
              type: EventType.PROJECT_MEETING,
              startTime: new Date(SAMPLE_START),
              endTime: new Date(SAMPLE_END),
              participants: [],
            },
          ],
          1,
        ]),
      });
      deps.calendarRepository.createQueryBuilder.mockReturnValue(qb);
      deps.userRepository.find.mockResolvedValue([]);

      const result = await deps.controller.listEvents(
        { participantId: USER_ID, page: 1, limit: 20 } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ total: 1, page: 1, limit: 20 }),
        }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('participant.userId = :participantId', {
        participantId: USER_ID,
      });
    });

    it('EP-032 UTC02 edge case defaults page and limit when those query values are omitted', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      deps.calendarRepository.createQueryBuilder.mockReturnValue(qb);
      deps.userRepository.find.mockResolvedValue([]);

      const result = await deps.controller.listEvents(
        {} as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('EP-032 UTC03 edge case caps limit at 200 for oversized query input', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      deps.calendarRepository.createQueryBuilder.mockReturnValue(qb);
      deps.userRepository.find.mockResolvedValue([]);

      const result = await deps.controller.listEvents(
        { limit: 999 } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(result.data.limit).toBe(200);
      expect(qb.take).toHaveBeenCalledWith(200);
    });

    it('EP-032 UTC04 validation rejects non-UUID organizerId values in CalendarEventFilterDto', () => {
      const errors = validateDto(CalendarEventFilterDto, { organizerId: 'bad-id' });

      expect(errors.some((error) => error.property === 'organizerId')).toBe(true);
    });

    it('EP-032 UTC05 validation rejects malformed startDate values in CalendarEventFilterDto', () => {
      const errors = validateDto(CalendarEventFilterDto, { startDate: 'not-a-date' });

      expect(errors.some((error) => error.property === 'startDate')).toBe(true);
    });

    it('EP-032 UTC06 validation rejects limit values smaller than 1 in CalendarEventFilterDto', () => {
      const errors = validateDto(CalendarEventFilterDto, { limit: 0 });

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('EP-032 UTC07 security declares JwtAuthGuard on listEvents', () => {
      expect(getRouteGuards(CalendarController, 'listEvents')).toContain(JwtAuthGuard);
    });

    it('EP-032 UTC08 security scopes the query to the current user when no subject filter is supplied', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      deps.calendarRepository.createQueryBuilder.mockReturnValue(qb);
      deps.userRepository.find.mockResolvedValue([]);

      await deps.controller.listEvents(
        {} as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
    });
  });

  describe('EP-033 updateEvent', () => {
    it('EP-033 UTC01 happy path updates an existing event and syncs the changed range', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne
        .mockResolvedValueOnce({
          id: EVENT_ID,
          organizerId: USER_ID,
          title: 'Old title',
          description: null,
          priority: EventPriority.MEDIUM,
          startTime: new Date(SAMPLE_START),
          endTime: new Date(SAMPLE_END),
          location: null,
          externalMeetingLink: null,
          reminderMinutes: null,
          notes: null,
          status: EventStatus.SCHEDULED,
        })
        .mockResolvedValueOnce({
          id: EVENT_ID,
          title: 'Updated title',
        });

      const result = await deps.controller.updateEvent(
        EVENT_ID,
        {
          title: 'Updated title',
          startTime: '2026-04-01T11:00:00.000Z',
          endTime: '2026-04-01T12:00:00.000Z',
        } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(deps.calendarRepository.update).toHaveBeenCalledWith(
        EVENT_ID,
        expect.objectContaining({
          title: 'Updated title',
          durationMinutes: 60,
        }),
      );
      expect(deps.availabilityService.syncCalendarEvents).toHaveBeenCalledWith({
        start: new Date(SAMPLE_START),
        end: new Date('2026-04-01T12:00:00.000Z'),
      });
      expect(result.message).toBe('Event updated');
    });

    it('EP-033 UTC02 edge case supports partial updates without altering existing timing', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne
        .mockResolvedValueOnce({
          id: EVENT_ID,
          organizerId: USER_ID,
          title: 'Old title',
          description: 'Old description',
          priority: EventPriority.MEDIUM,
          startTime: new Date(SAMPLE_START),
          endTime: new Date(SAMPLE_END),
          location: 'Room 1',
          externalMeetingLink: null,
          reminderMinutes: [15],
          notes: 'n/a',
          status: EventStatus.SCHEDULED,
        })
        .mockResolvedValueOnce({ id: EVENT_ID, title: 'Retitled' });

      await deps.controller.updateEvent(
        EVENT_ID,
        { title: 'Retitled' } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(deps.calendarRepository.update).toHaveBeenCalledWith(
        EVENT_ID,
        expect.objectContaining({
          title: 'Retitled',
          startTime: new Date(SAMPLE_START),
          endTime: new Date(SAMPLE_END),
        }),
      );
    });

    it('EP-033 UTC03 edge case allows staff to update another organizer event', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne
        .mockResolvedValueOnce({
          id: EVENT_ID,
          organizerId: OTHER_USER_ID,
          title: 'Managed event',
          description: null,
          priority: EventPriority.MEDIUM,
          startTime: new Date(SAMPLE_START),
          endTime: new Date(SAMPLE_END),
          location: null,
          externalMeetingLink: null,
          reminderMinutes: null,
          notes: null,
          status: EventStatus.SCHEDULED,
        })
        .mockResolvedValueOnce({ id: EVENT_ID, title: 'Managed event' });

      await expect(
        deps.controller.updateEvent(
          EVENT_ID,
          { title: 'Managed event' } as never,
          buildUser(UserRole.STAFF, { id: USER_ID }) as never,
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it('EP-033 UTC04 validation rejects malformed UUID values for the id param', async () => {
      await expect(
        new ParseUUIDPipe().transform('bad-id', {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('EP-033 UTC05 validation returns 404 when the target event is missing', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue(null);

      await expect(
        deps.controller.updateEvent(
          EVENT_ID,
          { title: 'Missing' } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new NotFoundException('Event not found'));
    });

    it('EP-033 UTC06 validation rejects updates for completed or cancelled events', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: USER_ID,
        status: EventStatus.CANCELLED,
        startTime: new Date(SAMPLE_START),
        endTime: new Date(SAMPLE_END),
      });

      await expect(
        deps.controller.updateEvent(
          EVENT_ID,
          { title: 'Nope' } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new BadRequestException('Event is CANCELLED, cannot update'));
    });

    it('EP-033 UTC07 security declares JwtAuthGuard on updateEvent', () => {
      expect(getRouteGuards(CalendarController, 'updateEvent')).toContain(JwtAuthGuard);
    });

    it('EP-033 UTC08 security blocks non-owner clients from updating another organizer event', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: OTHER_USER_ID,
        status: EventStatus.SCHEDULED,
        startTime: new Date(SAMPLE_START),
        endTime: new Date(SAMPLE_END),
      });

      await expect(
        deps.controller.updateEvent(
          EVENT_ID,
          { title: 'Forbidden' } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new ForbiddenException('You are not allowed to update this event'));
    });
  });

  describe('EP-034 requestReschedule', () => {
    it('EP-034 UTC01 happy path creates a manual reschedule request for the requester', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: OTHER_USER_ID,
      });
      deps.participantRepository.find.mockResolvedValue([{ userId: USER_ID }]);
      deps.rescheduleRepository.save.mockResolvedValue({ id: REQUEST_ID, eventId: EVENT_ID });

      const result = await deps.controller.requestReschedule(
        EVENT_ID,
        {
          eventId: EVENT_ID,
          reason: 'Need a later slot',
          proposedTimeSlots: [{ start: SAMPLE_START, end: SAMPLE_END }],
        } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(deps.rescheduleRepository.save).toHaveBeenCalled();
      expect(result.message).toBe('Reschedule request submitted');
    });

    it('EP-034 UTC02 edge case auto-processes the request when useAutoSchedule is enabled', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: USER_ID,
      });
      deps.participantRepository.find.mockResolvedValue([]);
      deps.rescheduleRepository.save.mockResolvedValue({ id: REQUEST_ID, eventId: EVENT_ID });
      deps.autoScheduleService.handleRescheduleRequest.mockResolvedValue({
        manualRequired: true,
        requestId: REQUEST_ID,
      });

      const result = await deps.controller.requestReschedule(
        EVENT_ID,
        {
          eventId: EVENT_ID,
          reason: 'Auto resolve',
          useAutoSchedule: true,
        } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(deps.autoScheduleService.handleRescheduleRequest).toHaveBeenCalledWith(
        REQUEST_ID,
        USER_ID,
      );
      expect(result.message).toBe('Manual reschedule required');
    });

    it('EP-034 UTC03 edge case allows the organizer to submit the request without a participant row', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: USER_ID,
      });
      deps.participantRepository.find.mockResolvedValue([]);
      deps.rescheduleRepository.save.mockResolvedValue({ id: REQUEST_ID, eventId: EVENT_ID });

      await expect(
        deps.controller.requestReschedule(
          EVENT_ID,
          {
            eventId: EVENT_ID,
            reason: 'Organizer request',
            proposedTimeSlots: [{ start: SAMPLE_START, end: SAMPLE_END }],
          } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it('EP-034 UTC04 validation rejects malformed UUID values for the event id param', async () => {
      await expect(
        new ParseUUIDPipe().transform('bad-id', {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('EP-034 UTC05 validation rejects mismatched body eventId and URL id inputs', async () => {
      const deps = buildCalendarController();

      await expect(
        deps.controller.requestReschedule(
          EVENT_ID,
          {
            eventId: OTHER_EVENT_ID,
            reason: 'Mismatch',
            proposedTimeSlots: [{ start: SAMPLE_START, end: SAMPLE_END }],
          } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new BadRequestException('eventId in body does not match URL'));
    });

    it('EP-034 UTC06 validation rejects more than three proposedTimeSlots entries', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: USER_ID,
      });
      deps.participantRepository.find.mockResolvedValue([]);

      await expect(
        deps.controller.requestReschedule(
          EVENT_ID,
          {
            eventId: EVENT_ID,
            reason: 'Too many proposals',
            proposedTimeSlots: [
              { start: SAMPLE_START, end: SAMPLE_END },
              { start: '2026-04-02T09:00:00.000Z', end: '2026-04-02T10:00:00.000Z' },
              { start: '2026-04-03T09:00:00.000Z', end: '2026-04-03T10:00:00.000Z' },
              { start: '2026-04-04T09:00:00.000Z', end: '2026-04-04T10:00:00.000Z' },
            ],
          } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new BadRequestException('Maximum 3 proposed time slots allowed'));
    });

    it('EP-034 UTC07 security declares JwtAuthGuard on requestReschedule', () => {
      expect(getRouteGuards(CalendarController, 'requestReschedule')).toContain(JwtAuthGuard);
    });

    it('EP-034 UTC08 security blocks non-participants from requesting a reschedule', async () => {
      const deps = buildCalendarController();
      deps.calendarRepository.findOne.mockResolvedValue({
        id: EVENT_ID,
        organizerId: OTHER_USER_ID,
      });
      deps.participantRepository.find.mockResolvedValue([{ userId: OTHER_USER_ID }]);

      await expect(
        deps.controller.requestReschedule(
          EVENT_ID,
          {
            eventId: EVENT_ID,
            reason: 'Forbidden',
            proposedTimeSlots: [{ start: SAMPLE_START, end: SAMPLE_END }],
          } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(
        new ForbiddenException('You are not allowed to reschedule this event'),
      );
    });
  });
});
