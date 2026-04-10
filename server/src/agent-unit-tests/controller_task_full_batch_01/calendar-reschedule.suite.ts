import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { RescheduleRequestStatus, UserRole } from 'src/database/entities';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { CalendarController } from 'src/modules/calendar/calendar.controller';
import { ProcessRescheduleRequestDto } from 'src/modules/calendar/dto';

import {
  buildUser,
  createQueryBuilderMock,
  findRouteDescriptor,
  getRouteGuards,
  validateDto,
} from './test-helpers';
import { assertCurrentTestHasCaseLog } from './test-log-helpers';
import {
  ADMIN_ID,
  EVENT_ID,
  OTHER_EVENT_ID,
  OTHER_USER_ID,
  PARTICIPANT_ID,
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

describe('Calendar reschedule module cluster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    assertCurrentTestHasCaseLog();
  });

  describe('EP-035 listRescheduleRequests', () => {
    it('EP-035 UTC01 happy path returns a paginated reschedule request list', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: REQUEST_ID,
              eventId: EVENT_ID,
              requesterId: USER_ID,
              reason: 'Need a new slot',
              proposedTimeSlots: [],
              useAutoSchedule: false,
              status: RescheduleRequestStatus.PENDING,
              createdAt: new Date(SAMPLE_START),
              event: {
                id: EVENT_ID,
                title: 'Hearing',
                startTime: new Date(SAMPLE_START),
                endTime: new Date(SAMPLE_END),
              },
              requester: {
                id: USER_ID,
                fullName: 'Requester',
                email: 'requester@example.com',
                role: UserRole.CLIENT,
              },
            },
          ],
          1,
        ]),
      });
      deps.rescheduleRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await deps.controller.listRescheduleRequests(
        'PENDING',
        EVENT_ID,
        USER_ID,
        '1',
        '10',
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ total: 1, page: 1, limit: 10 }),
        }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('request.status = :status', {
        status: 'PENDING',
      });
    });

    it('EP-035 UTC02 edge case normalizes invalid page and limit values to safe defaults', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      deps.rescheduleRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await deps.controller.listRescheduleRequests(
        undefined,
        undefined,
        undefined,
        'abc',
        '0',
      );

      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('EP-035 UTC03 edge case returns an empty list when no requests match the filters', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      deps.rescheduleRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await deps.controller.listRescheduleRequests(
        undefined,
        undefined,
        undefined,
        '1',
        '20',
      );

      expect(result.data.items).toEqual([]);
    });

    it('EP-035 UTC04 validation rejects unsupported reschedule status values', async () => {
      const deps = buildCalendarController();

      await expect(
        deps.controller.listRescheduleRequests('DONE', undefined, undefined, '1', '20'),
      ).rejects.toThrow(new BadRequestException('Invalid reschedule request status'));
    });

    it('EP-035 UTC05 validation rejects lower-case status values that do not match the enum', async () => {
      const deps = buildCalendarController();

      await expect(
        deps.controller.listRescheduleRequests('pending', undefined, undefined, '1', '20'),
      ).rejects.toThrow(new BadRequestException('Invalid reschedule request status'));
    });

    it('EP-035 UTC06 validation bubbles up repository failures during request listing', async () => {
      const deps = buildCalendarController();
      const qb = createQueryBuilderMock({
        getManyAndCount: jest.fn().mockRejectedValue(new Error('reschedule list failed')),
      });
      deps.rescheduleRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        deps.controller.listRescheduleRequests(undefined, undefined, undefined, '1', '20'),
      ).rejects.toThrow('reschedule list failed');
    });

    it('EP-035 UTC07 security declares JwtAuthGuard on listRescheduleRequests', () => {
      expect(getRouteGuards(CalendarController, 'listRescheduleRequests')).toContain(JwtAuthGuard);
    });

    it('EP-035 UTC08 security restricts listRescheduleRequests to STAFF and ADMIN roles', () => {
      const route = findRouteDescriptor(
        CalendarController,
        'GET',
        '/calendar/reschedule-requests',
      );

      expect(getRouteGuards(CalendarController, 'listRescheduleRequests')).toContain(RolesGuard);
      expect(route?.roles).toEqual([UserRole.STAFF, UserRole.ADMIN]);
    });
  });

  describe('EP-036 processRescheduleRequest', () => {
    it('EP-036 UTC01 happy path approves a pending request through auto scheduling', async () => {
      const deps = buildCalendarController();
      deps.rescheduleRepository.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: RescheduleRequestStatus.PENDING,
      });

      const result = await deps.controller.processRescheduleRequest(
        {
          requestId: REQUEST_ID,
          action: 'approve',
        } as never,
        buildUser(UserRole.STAFF, { id: USER_ID }) as never,
      );

      expect(deps.autoScheduleService.handleRescheduleRequest).toHaveBeenCalledWith(
        REQUEST_ID,
        USER_ID,
      );
      expect(result.message).toBe('Reschedule approved');
    });

    it('EP-036 UTC02 edge case rejects the request and records processNote', async () => {
      const deps = buildCalendarController();
      deps.rescheduleRepository.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: RescheduleRequestStatus.PENDING,
      });

      const result = await deps.controller.processRescheduleRequest(
        {
          requestId: REQUEST_ID,
          action: 'reject',
          processNote: 'Not enough participants',
        } as never,
        buildUser(UserRole.ADMIN, { id: USER_ID }) as never,
      );

      expect(deps.rescheduleRepository.update).toHaveBeenCalledWith(
        REQUEST_ID,
        expect.objectContaining({
          status: RescheduleRequestStatus.REJECTED,
          processedById: USER_ID,
          processNote: 'Not enough participants',
        }),
      );
      expect(result.message).toBe('Reschedule request rejected');
    });

    it('EP-036 UTC03 edge case processes a manual selectedNewStartTime value', async () => {
      const deps = buildCalendarController();
      deps.rescheduleRepository.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: RescheduleRequestStatus.PENDING,
      });

      await deps.controller.processRescheduleRequest(
        {
          requestId: REQUEST_ID,
          action: 'approve',
          selectedNewStartTime: SAMPLE_START,
          processNote: 'Approved manually',
        } as never,
        buildUser(UserRole.ADMIN, { id: USER_ID }) as never,
      );

      expect(deps.autoScheduleService.processManualRescheduleRequest).toHaveBeenCalledWith(
        REQUEST_ID,
        new Date(SAMPLE_START),
        USER_ID,
        'Approved manually',
      );
    });

    it('EP-036 UTC04 validation rejects malformed requestId values in ProcessRescheduleRequestDto', () => {
      const errors = validateDto(ProcessRescheduleRequestDto, {
        requestId: 'bad-id',
        action: 'approve',
      });

      expect(errors.some((error) => error.property === 'requestId')).toBe(true);
    });

    it('EP-036 UTC05 validation returns 404 when the reschedule request does not exist', async () => {
      const deps = buildCalendarController();
      deps.rescheduleRepository.findOne.mockResolvedValue(null);

      await expect(
        deps.controller.processRescheduleRequest(
          { requestId: REQUEST_ID, action: 'approve' } as never,
          buildUser(UserRole.STAFF, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new NotFoundException('Reschedule request not found'));
    });

    it('EP-036 UTC06 validation rejects non-pending reschedule requests', async () => {
      const deps = buildCalendarController();
      deps.rescheduleRepository.findOne.mockResolvedValue({
        id: REQUEST_ID,
        status: RescheduleRequestStatus.REJECTED,
      });

      await expect(
        deps.controller.processRescheduleRequest(
          { requestId: REQUEST_ID, action: 'approve' } as never,
          buildUser(UserRole.STAFF, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new BadRequestException('Reschedule request already processed'));
    });

    it('EP-036 UTC07 security declares JwtAuthGuard on processRescheduleRequest', () => {
      expect(getRouteGuards(CalendarController, 'processRescheduleRequest')).toContain(
        JwtAuthGuard,
      );
    });

    it('EP-036 UTC08 security restricts processRescheduleRequest to STAFF and ADMIN roles', () => {
      const route = findRouteDescriptor(
        CalendarController,
        'POST',
        '/calendar/reschedule-requests/process',
      );

      expect(getRouteGuards(CalendarController, 'processRescheduleRequest')).toContain(
        RolesGuard,
      );
      expect(route?.roles).toEqual([UserRole.STAFF, UserRole.ADMIN]);
    });
  });

  describe('EP-037 respondInvite', () => {
    it('EP-037 UTC01 happy path records an invite response for the participant', async () => {
      const deps = buildCalendarController();
      deps.participantRepository.findOne.mockResolvedValue({
        id: PARTICIPANT_ID,
        eventId: EVENT_ID,
        userId: USER_ID,
      });

      const result = await deps.controller.respondInvite(
        EVENT_ID,
        { participantId: PARTICIPANT_ID, response: 'accept' } as never,
        buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
      );

      expect(deps.autoScheduleService.processEventInvitations).toHaveBeenCalledWith(
        PARTICIPANT_ID,
        'accept',
        undefined,
      );
      expect(result.message).toBe('Response recorded');
    });

    it('EP-037 UTC02 edge case lets admins respond on behalf of the participant', async () => {
      const deps = buildCalendarController();
      deps.participantRepository.findOne.mockResolvedValue({
        id: PARTICIPANT_ID,
        eventId: EVENT_ID,
        userId: OTHER_USER_ID,
      });

      await expect(
        deps.controller.respondInvite(
          EVENT_ID,
          {
            participantId: PARTICIPANT_ID,
            response: 'decline',
            responseNote: 'Handled by admin',
          } as never,
          buildUser(UserRole.ADMIN, { id: ADMIN_ID }) as never,
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it('EP-037 UTC03 edge case lets staff respond on behalf of the participant', async () => {
      const deps = buildCalendarController();
      deps.participantRepository.findOne.mockResolvedValue({
        id: PARTICIPANT_ID,
        eventId: EVENT_ID,
        userId: OTHER_USER_ID,
      });

      await expect(
        deps.controller.respondInvite(
          EVENT_ID,
          { participantId: PARTICIPANT_ID, response: 'tentative' } as never,
          buildUser(UserRole.STAFF, { id: USER_ID }) as never,
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it('EP-037 UTC04 validation rejects malformed UUID values for the event id param', async () => {
      await expect(
        new ParseUUIDPipe().transform('bad-id', {
          type: 'param',
          metatype: String,
          data: 'id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('EP-037 UTC05 validation returns 404 when the participant link does not exist', async () => {
      const deps = buildCalendarController();
      deps.participantRepository.findOne.mockResolvedValue(null);

      await expect(
        deps.controller.respondInvite(
          EVENT_ID,
          { participantId: PARTICIPANT_ID, response: 'accept' } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new NotFoundException('Participant not found'));
    });

    it('EP-037 UTC06 validation rejects participant ids that belong to another event', async () => {
      const deps = buildCalendarController();
      deps.participantRepository.findOne.mockResolvedValue({
        id: PARTICIPANT_ID,
        eventId: OTHER_EVENT_ID,
        userId: USER_ID,
      });

      await expect(
        deps.controller.respondInvite(
          EVENT_ID,
          { participantId: PARTICIPANT_ID, response: 'accept' } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(new BadRequestException('participantId does not belong to this event'));
    });

    it('EP-037 UTC07 security declares JwtAuthGuard on respondInvite', () => {
      expect(getRouteGuards(CalendarController, 'respondInvite')).toContain(JwtAuthGuard);
    });

    it('EP-037 UTC08 security blocks another participant from responding without elevated role', async () => {
      const deps = buildCalendarController();
      deps.participantRepository.findOne.mockResolvedValue({
        id: PARTICIPANT_ID,
        eventId: EVENT_ID,
        userId: OTHER_USER_ID,
      });

      await expect(
        deps.controller.respondInvite(
          EVENT_ID,
          { participantId: PARTICIPANT_ID, response: 'accept' } as never,
          buildUser(UserRole.CLIENT, { id: USER_ID }) as never,
        ),
      ).rejects.toThrow(
        new ForbiddenException('You are not allowed to respond for this invitation'),
      );
    });
  });
});
