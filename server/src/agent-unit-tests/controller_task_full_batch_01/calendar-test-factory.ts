import { createQueryBuilderMock, createRepoMock } from './test-helpers';

import {
  CalendarEventEntity,
  DisputeEntity,
  DisputeHearingEntity,
  EventStatus,
  HearingParticipantEntity,
  ProjectEntity,
  RescheduleRequestStatus,
  UserAvailabilityEntity,
  UserEntity,
} from 'src/database/entities';
import { EventParticipantEntity } from 'src/database/entities/event-participant.entity';
import { EventRescheduleRequestEntity } from 'src/database/entities/event-reschedule-request.entity';

export const EVENT_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_EVENT_ID = '22222222-2222-4222-8222-222222222222';
export const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';
export const REQUEST_ID = '55555555-5555-4555-8555-555555555555';
export const USER_ID = '66666666-6666-4666-8666-666666666666';
export const OTHER_USER_ID = '77777777-7777-4777-8777-777777777777';
export const ADMIN_ID = '88888888-8888-4888-8888-888888888888';
export const SAMPLE_START = '2026-04-01T09:00:00.000Z';
export const SAMPLE_END = '2026-04-01T10:00:00.000Z';

export const createCalendarDependencies = () => {
  const calendarRepository = createRepoMock();
  const participantRepository = createRepoMock();
  const rescheduleRepository = createRepoMock();
  const availabilityRepository = createRepoMock();
  const userRepository = createRepoMock();
  const disputeRepository = createRepoMock();
  const hearingRepository = createRepoMock();
  const hearingParticipantRepository = createRepoMock();
  const projectRepository = createRepoMock();
  const calendarService = {
    findAvailableSlots: jest.fn().mockResolvedValue({
      slots: [
        {
          start: new Date(SAMPLE_START),
          end: new Date(SAMPLE_END),
          durationMinutes: 60,
          score: 80,
          scoreReasons: ['preferred-slot'],
        },
      ],
      searchedDateRange: { start: new Date(SAMPLE_START), end: new Date(SAMPLE_END) },
      constraints: {},
    }),
  };
  const autoScheduleService = {
    autoScheduleEvent: jest.fn().mockResolvedValue({
      manualRequired: false,
      eventId: EVENT_ID,
    }),
    handleRescheduleRequest: jest.fn().mockResolvedValue({
      manualRequired: false,
      requestId: REQUEST_ID,
    }),
    processManualRescheduleRequest: jest.fn().mockResolvedValue({
      manualRequired: false,
      requestId: REQUEST_ID,
    }),
    processEventInvitations: jest.fn().mockResolvedValue({
      participantId: PARTICIPANT_ID,
      response: 'accept',
    }),
  };
  const availabilityService = {
    syncCalendarEvents: jest.fn().mockResolvedValue(undefined),
    setUserAvailability: jest.fn().mockResolvedValue({}),
    deleteUserAvailability: jest.fn().mockResolvedValue({}),
  };

  calendarRepository.create.mockImplementation((input) => ({ id: EVENT_ID, ...input }));
  participantRepository.create.mockImplementation((input) => input);
  rescheduleRepository.create.mockImplementation((input) => ({ id: REQUEST_ID, ...input }));

  return {
    calendarRepository,
    participantRepository,
    rescheduleRepository,
    availabilityRepository,
    userRepository,
    disputeRepository,
    hearingRepository,
    hearingParticipantRepository,
    projectRepository,
    calendarService,
    autoScheduleService,
    availabilityService,
  };
};

export const createRouteDependencies = () => {
  const deps = createCalendarDependencies();
  deps.calendarRepository.findOne.mockResolvedValue({
    id: EVENT_ID,
    organizerId: USER_ID,
    status: EventStatus.SCHEDULED,
    startTime: new Date(SAMPLE_START),
    endTime: new Date(SAMPLE_END),
  });
  deps.participantRepository.find.mockResolvedValue([{ userId: USER_ID }]);
  deps.participantRepository.findOne.mockResolvedValue({
    id: PARTICIPANT_ID,
    eventId: EVENT_ID,
    userId: USER_ID,
  });
  deps.rescheduleRepository.findOne.mockResolvedValue({
    id: REQUEST_ID,
    status: RescheduleRequestStatus.PENDING,
  });
  deps.rescheduleRepository.createQueryBuilder.mockReturnValue(
    createQueryBuilderMock({
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    }),
  );
  deps.calendarRepository.createQueryBuilder.mockReturnValue(
    createQueryBuilderMock({
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    }),
  );
  deps.userRepository.createQueryBuilder.mockReturnValue(
    createQueryBuilderMock({
      getMany: jest.fn().mockResolvedValue([]),
    }),
  );
  deps.availabilityRepository.createQueryBuilder.mockReturnValue(
    createQueryBuilderMock({
      getMany: jest.fn().mockResolvedValue([]),
    }),
  );
  deps.participantRepository.createQueryBuilder.mockReturnValue(
    createQueryBuilderMock({
      getMany: jest.fn().mockResolvedValue([]),
    }),
  );
  deps.calendarRepository.find.mockResolvedValue([]);

  return deps;
};

export const calendarRepoProviders = (deps: ReturnType<typeof createRouteDependencies>) => [
  { token: CalendarEventEntity, value: deps.calendarRepository },
  { token: EventParticipantEntity, value: deps.participantRepository },
  { token: EventRescheduleRequestEntity, value: deps.rescheduleRepository },
  { token: UserAvailabilityEntity, value: deps.availabilityRepository },
  { token: UserEntity, value: deps.userRepository },
  { token: DisputeEntity, value: deps.disputeRepository },
  { token: DisputeHearingEntity, value: deps.hearingRepository },
  { token: HearingParticipantEntity, value: deps.hearingParticipantRepository },
  { token: ProjectEntity, value: deps.projectRepository },
];
