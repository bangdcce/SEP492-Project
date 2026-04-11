import { DisputeNotificationListener } from './dispute-notification.listener';

const repoMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((input) => input),
});

describe('DisputeNotificationListener', () => {
  let listener: DisputeNotificationListener;
  let notificationRepo: ReturnType<typeof repoMock>;
  let disputeRepo: ReturnType<typeof repoMock>;
  let projectRepo: ReturnType<typeof repoMock>;
  let userRepo: ReturnType<typeof repoMock>;
  let hearingRepo: ReturnType<typeof repoMock>;
  let gateway: {
    emitUserEvent: jest.Mock;
  };

  beforeEach(() => {
    notificationRepo = repoMock();
    disputeRepo = repoMock();
    projectRepo = repoMock();
    userRepo = repoMock();
    hearingRepo = repoMock();
    gateway = {
      emitUserEvent: jest.fn(),
    };

    notificationRepo.save.mockImplementation(async (items) =>
      items.map((item: Record<string, unknown>, index: number) => ({
        id: `notification-${index + 1}`,
        ...item,
      })),
    );

    listener = new DisputeNotificationListener(
      notificationRepo as never,
      disputeRepo as never,
      projectRepo as never,
      userRepo as never,
      hearingRepo as never,
      repoMock() as never,
      gateway as never,
    );
  });

  const seedDisputeAudience = () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'dispute-1',
      projectId: 'project-1',
      raisedById: 'raiser-1',
      defendantId: 'defendant-1',
      assignedStaffId: 'staff-1',
      escalatedToAdminId: null,
    });
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      clientId: 'client-1',
      freelancerId: 'freelancer-1',
      brokerId: 'broker-1',
    });
  };

  it('creates an auto-reschedule notification when a participant declines and asks for a new time', async () => {
    seedDisputeAudience();
    userRepo.find.mockResolvedValue([
      {
        id: 'broker-1',
        fullName: 'Minh Dao',
        email: 'broker@example.com',
      },
    ]);

    await listener.handleHearingInviteResponded({
      hearingId: 'hearing-1',
      disputeId: 'dispute-1',
      responderId: 'broker-1',
      response: 'decline',
      responseNote: 'Need a different slot',
      rescheduleTriggered: true,
      manualRequired: false,
    });

    expect(notificationRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Hearing auto-reschedule started',
          body: expect.stringContaining('Minh Dao declined the hearing invite'),
          relatedType: 'DisputeHearing',
          relatedId: 'hearing-1',
        }),
      ]),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalled();
  });

  it('creates a manual-review notification when auto-reschedule cannot finish automatically', async () => {
    seedDisputeAudience();
    userRepo.find.mockResolvedValue([
      {
        id: 'client-1',
        fullName: 'Linh Tran',
        email: 'client@example.com',
      },
    ]);

    await listener.handleHearingInviteResponded({
      hearingId: 'hearing-1',
      disputeId: 'dispute-1',
      responderId: 'client-1',
      response: 'decline',
      rescheduleTriggered: true,
      manualRequired: true,
      reason: 'Reschedule limit reached',
    });

    expect(notificationRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Hearing reschedule needs review',
          body: expect.stringContaining('Reschedule limit reached'),
        }),
      ]),
    );
  });

  it('does not notify for declines that do not trigger a reschedule workflow', async () => {
    await listener.handleHearingInviteResponded({
      hearingId: 'hearing-1',
      disputeId: 'dispute-1',
      responderId: 'observer-1',
      response: 'decline',
      rescheduleTriggered: false,
      manualRequired: false,
    });

    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('creates a hearing rescheduled notification with the new time and deadline', async () => {
    seedDisputeAudience();

    await listener.handleHearingRescheduled({
      hearingId: 'hearing-2',
      disputeId: 'dispute-1',
      previousHearingId: 'hearing-1',
      scheduledAt: new Date('2026-04-12T03:00:00.000Z'),
      responseDeadline: new Date('2026-04-11T15:00:00.000Z'),
    });

    expect(notificationRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Hearing rescheduled',
          body: expect.stringContaining('2026-04-12T03:00:00.000Z'),
          relatedType: 'DisputeHearing',
          relatedId: 'hearing-2',
        }),
      ]),
    );
  });
});
