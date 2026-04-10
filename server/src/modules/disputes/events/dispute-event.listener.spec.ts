import { DisputeEventListener } from './dispute-event.listener';

const repoMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  insert: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

describe('DisputeEventListener', () => {
  let listener: DisputeEventListener;
  let hearingParticipantRepo: ReturnType<typeof repoMock>;
  let ledgerRepo: ReturnType<typeof repoMock>;
  let gateway: {
    emitHearingEvent: jest.Mock;
    emitDisputeEvent: jest.Mock;
    emitStaffDashboardEvent: jest.Mock;
    emitUserEvent: jest.Mock;
  };

  beforeEach(() => {
    hearingParticipantRepo = repoMock();
    ledgerRepo = repoMock();
    gateway = {
      emitHearingEvent: jest.fn(),
      emitDisputeEvent: jest.fn(),
      emitStaffDashboardEvent: jest.fn(),
      emitUserEvent: jest.fn(),
    };

    listener = new DisputeEventListener(
      repoMock() as never,
      repoMock() as never,
      ledgerRepo as never,
      repoMock() as never,
      hearingParticipantRepo as never,
      repoMock() as never,
      {} as never,
      {} as never,
      {} as never,
      gateway as never,
    );

    ledgerRepo.findOne.mockResolvedValue(null);
    ledgerRepo.insert.mockResolvedValue(undefined);
  });

  it('fans out hearing scheduled realtime updates to each unique participant user room', async () => {
    hearingParticipantRepo.find.mockResolvedValue([
      { userId: 'client-1' },
      { userId: 'freelancer-1' },
      { userId: 'client-1' },
    ]);

    await listener.handleHearingScheduled({
      disputeId: 'dispute-1',
      hearingId: 'hearing-1',
      scheduledAt: new Date('2026-04-10T10:00:00.000Z'),
    });

    expect(gateway.emitDisputeEvent).toHaveBeenCalledWith(
      'dispute-1',
      'HEARING_SCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-1',
      }),
    );
    expect(gateway.emitStaffDashboardEvent).toHaveBeenCalledWith(
      'HEARING_SCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-1',
      }),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalledTimes(2);
    expect(gateway.emitUserEvent).toHaveBeenCalledWith(
      'client-1',
      'HEARING_SCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-1',
      }),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalledWith(
      'freelancer-1',
      'HEARING_SCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-1',
      }),
    );
  });

  it('fans out hearing rescheduled realtime updates to each unique participant user room', async () => {
    hearingParticipantRepo.find.mockResolvedValue([
      { userId: 'broker-1' },
      { userId: 'client-1' },
    ]);

    await listener.handleHearingRescheduled({
      disputeId: 'dispute-1',
      hearingId: 'hearing-2',
      previousHearingId: 'hearing-1',
      scheduledAt: new Date('2026-04-11T14:00:00.000Z'),
    });

    expect(gateway.emitDisputeEvent).toHaveBeenCalledWith(
      'dispute-1',
      'HEARING_RESCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-2',
        previousHearingId: 'hearing-1',
      }),
    );
    expect(gateway.emitStaffDashboardEvent).toHaveBeenCalledWith(
      'HEARING_RESCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-2',
        previousHearingId: 'hearing-1',
      }),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalledTimes(2);
    expect(gateway.emitUserEvent).toHaveBeenCalledWith(
      'broker-1',
      'HEARING_RESCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-2',
        previousHearingId: 'hearing-1',
      }),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalledWith(
      'client-1',
      'HEARING_RESCHEDULED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-2',
        previousHearingId: 'hearing-1',
      }),
    );
  });

  it('fans out submitted hearing statements to each participant user room', async () => {
    hearingParticipantRepo.find.mockResolvedValue([
      { userId: 'client-1' },
      { userId: 'freelancer-1' },
    ]);

    await listener.handleHearingStatementSubmitted({
      disputeId: 'dispute-1',
      hearingId: 'hearing-1',
      statementId: 'statement-1',
      participantId: 'participant-1',
      statementType: 'OPENING',
      statement: {
        id: 'statement-1',
        type: 'OPENING',
        content: 'Statement body',
      },
      createdAt: new Date('2026-04-10T12:00:00.000Z'),
    });

    expect(gateway.emitDisputeEvent).toHaveBeenCalledWith(
      'dispute-1',
      'HEARING_STATEMENT_SUBMITTED',
      expect.objectContaining({
        disputeId: 'dispute-1',
        hearingId: 'hearing-1',
        statementId: 'statement-1',
        statement: expect.objectContaining({
          id: 'statement-1',
          type: 'OPENING',
        }),
      }),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalledWith(
      'client-1',
      'HEARING_STATEMENT_SUBMITTED',
      expect.objectContaining({
        statementId: 'statement-1',
      }),
    );
    expect(gateway.emitUserEvent).toHaveBeenCalledWith(
      'freelancer-1',
      'HEARING_STATEMENT_SUBMITTED',
      expect.objectContaining({
        statementId: 'statement-1',
      }),
    );
  });
});
