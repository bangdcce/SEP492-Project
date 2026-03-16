import { CalendarController } from './calendar.controller';
import {
  EventStatus,
  EventType,
  HearingParticipantRole,
  UserEntity,
  UserRole,
} from 'src/database/entities';

const repoMock = () => ({
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('CalendarController', () => {
  let controller: CalendarController;
  let calendarRepository: ReturnType<typeof repoMock>;
  let userRepository: ReturnType<typeof repoMock>;
  let disputeRepository: ReturnType<typeof repoMock>;
  let hearingRepository: ReturnType<typeof repoMock>;
  let hearingParticipantRepository: ReturnType<typeof repoMock>;
  let projectRepository: ReturnType<typeof repoMock>;

  beforeEach(() => {
    calendarRepository = repoMock();
    const participantRepository = repoMock();
    const rescheduleRepository = repoMock();
    const availabilityRepository = repoMock();
    userRepository = repoMock();
    disputeRepository = repoMock();
    hearingRepository = repoMock();
    hearingParticipantRepository = repoMock();
    projectRepository = repoMock();

    controller = new CalendarController(
      calendarRepository as any,
      participantRepository as any,
      rescheduleRepository as any,
      availabilityRepository as any,
      userRepository as any,
      disputeRepository as any,
      hearingRepository as any,
      hearingParticipantRepository as any,
      projectRepository as any,
      { findAvailableSlots: jest.fn() } as any,
      { autoScheduleEvent: jest.fn() } as any,
      { syncCalendarEvents: jest.fn() } as any,
    );
  });

  it('enriches dispute hearing events with dispute context and caps page size', async () => {
    const event = {
      id: 'event-1',
      type: EventType.DISPUTE_HEARING,
      status: EventStatus.SCHEDULED,
      title: 'Dispute Hearing #2',
      referenceType: 'DisputeHearing',
      referenceId: 'hearing-1',
      metadata: null,
      participants: [],
      startTime: new Date('2026-03-03T10:00:00.000Z'),
      endTime: new Date('2026-03-03T11:00:00.000Z'),
    };
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[event], 1]),
    };
    calendarRepository.createQueryBuilder.mockReturnValue(qb);

    hearingRepository.find.mockResolvedValue([
      {
        id: 'hearing-1',
        disputeId: 'abcd1234-0000-0000-0000-000000000000',
        hearingNumber: 2,
      },
    ]);
    hearingParticipantRepository.find.mockResolvedValue([
      {
        hearingId: 'hearing-1',
        userId: 'claimant-1',
        role: HearingParticipantRole.RAISER,
      },
    ]);
    disputeRepository.find.mockResolvedValue([
      {
        id: 'abcd1234-0000-0000-0000-000000000000',
        projectId: 'project-1',
        raisedById: 'claimant-1',
        defendantId: 'defendant-1',
      },
    ]);
    projectRepository.find.mockResolvedValue([
      {
        id: 'project-1',
        title: 'Website redesign',
      },
    ]);
    userRepository.find.mockResolvedValue([
      {
        id: 'claimant-1',
        fullName: 'Alice Claimant',
        email: 'alice@example.com',
        role: UserRole.CLIENT,
      },
      {
        id: 'defendant-1',
        fullName: 'Bob Defendant',
        email: 'bob@example.com',
        role: UserRole.FREELANCER,
      },
    ]);

    const result = await controller.listEvents(
      {
        participantId: 'claimant-1',
        page: 1,
        limit: 500,
      } as any,
      {
        id: 'claimant-1',
        role: UserRole.CLIENT,
      } as UserEntity,
    );

    expect(qb.take).toHaveBeenCalledWith(200);
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(200);
    expect(result.data.items[0].disputeContext).toEqual(
      expect.objectContaining({
        disputeId: 'abcd1234-0000-0000-0000-000000000000',
        hearingId: 'hearing-1',
        displayCode: 'DSP-ABCD1234',
        hearingNumber: 2,
        projectId: 'project-1',
        projectTitle: 'Website redesign',
        claimantName: 'Alice Claimant',
        defendantName: 'Bob Defendant',
        counterpartyName: 'Bob Defendant',
        perspective: 'CLAIMANT',
        viewerSystemRole: UserRole.CLIENT,
        viewerHearingRole: 'CLAIMANT',
      }),
    );
  });
});
