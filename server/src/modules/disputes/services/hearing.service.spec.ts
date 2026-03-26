import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CalendarEventEntity,
  ContractEntity,
  DisputeEntity,
  DisputeStatus,
  DisputeHearingEntity,
  DisputeInternalMembershipEntity,
  DisputeMessageEntity,
  DisputePartyEntity,
  EventParticipantEntity,
  EventStatus,
  HearingParticipantEntity,
  HearingParticipantRole,
    HearingQuestionEntity,
    HearingReminderDeliveryEntity,
    HearingStatementEntity,
    HearingStatementStatus,
    HearingStatementType,
    HearingStatus,
  HearingTier,
  MilestoneEntity,
  NotificationEntity,
  ParticipantStatus,
  ProjectEntity,
  ProjectSpecEntity,
  SpeakerRole,
  UserAvailabilityEntity,
  UserEntity,
  UserRole,
} from 'src/database/entities';
import { EmailService } from '../../auth/email.service';
import { CalendarService } from '../../calendar/calendar.service';
import { EvidenceService } from './evidence.service';
import { HearingPresenceService } from './hearing-presence.service';
import { HearingService } from './hearing.service';
import { RescheduleHearingDto, ScheduleHearingDto } from '../dto/hearing.dto';

describe('HearingService', () => {
  let service: HearingService;
  let disputeRepo: any;
  let projectRepo: any;
  let userRepo: any;
  let disputePartyRepo: any;
  let hearingRepo: any;
  let participantRepo: any;
  let statementRepo: any;
  let calendarRepo: any;
  let eventParticipantRepo: any;

  const repoMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exist: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HearingService,
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputePartyEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeHearingEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingParticipantEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingStatementEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingQuestionEntity), useValue: repoMock() },
        { provide: getRepositoryToken(EventParticipantEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProjectEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProjectSpecEntity), useValue: repoMock() },
        { provide: getRepositoryToken(MilestoneEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ContractEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeMessageEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeInternalMembershipEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: getRepositoryToken(CalendarEventEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserAvailabilityEntity), useValue: repoMock() },
        { provide: getRepositoryToken(NotificationEntity), useValue: repoMock() },
        { provide: getRepositoryToken(HearingReminderDeliveryEntity), useValue: repoMock() },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EmailService, useValue: { sendMail: jest.fn() } },
        { provide: HearingPresenceService, useValue: {} },
        { provide: EvidenceService, useValue: {} },
        { provide: CalendarService, useValue: { findAvailableSlots: jest.fn() } },
      ],
    }).compile();

    service = module.get(HearingService);
    disputeRepo = module.get(getRepositoryToken(DisputeEntity));
    projectRepo = module.get(getRepositoryToken(ProjectEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    disputePartyRepo = module.get(getRepositoryToken(DisputePartyEntity));
    hearingRepo = module.get(getRepositoryToken(DisputeHearingEntity));
    participantRepo = module.get(getRepositoryToken(HearingParticipantEntity));
    statementRepo = module.get(getRepositoryToken(HearingStatementEntity));
    calendarRepo = module.get(getRepositoryToken(CalendarEventEntity));
    eventParticipantRepo = module.get(getRepositoryToken(EventParticipantEntity));

    calendarRepo.find.mockResolvedValue([]);
    participantRepo.find.mockResolvedValue([]);
    eventParticipantRepo.find.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('determineRequiredParticipants', () => {
    it('adds broker as optional witness', async () => {
      disputeRepo.findOne.mockResolvedValue({
        id: 'd-1',
        groupId: 'g-1',
        raisedById: 'raiser-1',
        defendantId: 'def-1',
        projectId: 'p-1',
        raiserRole: UserRole.CLIENT,
        defendantRole: UserRole.FREELANCER,
        assignedStaffId: 'staff-2',
      });
      userRepo.findOne.mockResolvedValue({ id: 'staff-1', role: UserRole.STAFF });
      projectRepo.findOne.mockResolvedValue({
        id: 'p-1',
        clientId: 'client-2',
        freelancerId: 'freelancer-2',
        brokerId: 'broker-1',
      });
      disputePartyRepo.find.mockResolvedValue([]);

      const result = await service.determineRequiredParticipants('d-1', HearingTier.TIER_1, 'staff-1');

      const broker = result.participants.find((item) => item.userId === 'broker-1');
      expect(result.hasBroker).toBe(true);
      expect(broker).toEqual(
        expect.objectContaining({
          userId: 'broker-1',
          role: HearingParticipantRole.WITNESS,
          isRequired: false,
          userRole: UserRole.BROKER,
          relationToProject: 'broker',
        }),
      );
    });
  });

  describe('declined RSVP hardening', () => {
    beforeEach(() => {
      calendarRepo.findOne.mockResolvedValue({ id: 'event-1' });
      eventParticipantRepo.find.mockResolvedValue([
        {
          userId: 'declined-1',
          status: ParticipantStatus.DECLINED,
        },
      ]);
    });

    it('denies chat permission for declined participant', async () => {
      hearingRepo.findOne.mockResolvedValue({
        id: 'h-1',
        status: HearingStatus.IN_PROGRESS,
        isChatRoomActive: true,
        currentSpeakerRole: SpeakerRole.ALL,
        participants: [
          {
            userId: 'declined-1',
            role: HearingParticipantRole.RAISER,
          },
        ],
      });

      const result = await service.getChatPermission('h-1', 'declined-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('declined');
    });

    it('denies evidence link attach for declined participant', async () => {
      hearingRepo.findOne.mockResolvedValue({
        id: 'h-1',
        status: HearingStatus.IN_PROGRESS,
        isChatRoomActive: true,
        moderatorId: 'staff-1',
        dispute: {
          id: 'd-1',
          raisedById: 'raiser-1',
          defendantId: 'def-1',
        },
        participants: [
          {
            userId: 'declined-1',
            role: HearingParticipantRole.RAISER,
          },
        ],
      });

      const result = await service.getEvidenceAttachPermission('h-1', 'declined-1', UserRole.CLIENT);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('declined');
    });

    it('blocks workspace access when invitation was declined', async () => {
      hearingRepo.findOne.mockResolvedValue({
        id: 'h-1',
        moderatorId: 'staff-1',
        participants: [
          {
            userId: 'declined-1',
            role: HearingParticipantRole.RAISER,
          },
        ],
        dispute: {
          id: 'd-1',
          raisedById: 'raiser-2',
          defendantId: 'def-2',
          assignedStaffId: 'staff-2',
          escalatedToAdminId: null,
        },
      });

      await expect(
        (service as any).ensureHearingAccess('h-1', {
          id: 'declined-1',
          role: UserRole.CLIENT,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('uses the current speaker role immediately without grace for chat permission', async () => {
      calendarRepo.findOne.mockResolvedValue({ id: 'event-1' });
      eventParticipantRepo.find.mockResolvedValue([
        {
          userId: 'defendant-1',
          status: ParticipantStatus.ACCEPTED,
        },
      ]);
      hearingRepo.findOne.mockResolvedValue({
        id: 'h-1',
        status: HearingStatus.IN_PROGRESS,
        isChatRoomActive: true,
        currentSpeakerRole: SpeakerRole.RAISER_ONLY,
        participants: [
          {
            userId: 'defendant-1',
            role: HearingParticipantRole.DEFENDANT,
          },
        ],
      });
      (service as any).speakerGracePeriod.set('h-1', {
        previousRole: SpeakerRole.ALL,
        expiresAtMs: Date.now() + 5_000,
      });

      const result = await service.getChatPermission('h-1', 'defendant-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed to speak');
      expect(result.effectiveSpeakerRole).toBe(SpeakerRole.RAISER_ONLY);
    });
  });

  describe('early start readiness', () => {
    it('requires online + ACCEPTED RSVP for required participants', () => {
      const participants = [
        { userId: 'u1', isRequired: true, isOnline: true },
        { userId: 'u2', isRequired: true, isOnline: true },
      ] as HearingParticipantEntity[];

      const ready = (service as any).areAllRequiredParticipantsReady(
        participants,
        new Map<string, ParticipantStatus>([
          ['u1', ParticipantStatus.ACCEPTED],
          ['u2', ParticipantStatus.ACCEPTED],
        ]),
      );

      expect(ready).toBe(true);
    });

    it('returns false when required participant is pending/declined', () => {
      const participants = [{ userId: 'u1', isRequired: true, isOnline: true }] as HearingParticipantEntity[];

      const pending = (service as any).areAllRequiredParticipantsReady(
        participants,
        new Map<string, ParticipantStatus>([['u1', ParticipantStatus.PENDING]]),
      );
      const declined = (service as any).areAllRequiredParticipantsReady(
        participants,
        new Map<string, ParticipantStatus>([['u1', ParticipantStatus.DECLINED]]),
      );

      expect(pending).toBe(false);
      expect(declined).toBe(false);
    });
  });

  describe('autoStartDueHearings', () => {
    it('starts only due hearings with SCHEDULED calendar event and counts blocked cases', async () => {
      const dueHearings = [
        {
          id: 'h-success',
          moderatorId: 'staff-1',
          status: HearingStatus.SCHEDULED,
          scheduledAt: new Date('2026-03-03T10:00:00.000Z'),
        },
        {
          id: 'h-pending-event',
          moderatorId: 'staff-1',
          status: HearingStatus.SCHEDULED,
          scheduledAt: new Date('2026-03-03T10:00:00.000Z'),
        },
        {
          id: 'h-start-fails',
          moderatorId: 'staff-1',
          status: HearingStatus.SCHEDULED,
          scheduledAt: new Date('2026-03-03T10:00:00.000Z'),
        },
      ];

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(dueHearings),
      };
      hearingRepo.createQueryBuilder.mockReturnValue(qb);

      calendarRepo.findOne.mockImplementation(({ where }: { where: { referenceId: string } }) => {
        if (where.referenceId === 'h-success') {
          return Promise.resolve({ id: 'e1', status: EventStatus.SCHEDULED });
        }
        if (where.referenceId === 'h-pending-event') {
          return Promise.resolve({ id: 'e2', status: EventStatus.PENDING_CONFIRMATION });
        }
        return Promise.resolve({ id: 'e3', status: EventStatus.SCHEDULED });
      });

      const startSpy = jest
        .spyOn(service, 'startHearing')
        .mockImplementation(async (hearingId: string) => {
          if (hearingId === 'h-start-fails') {
            throw new Error('cannot start');
          }
          return {
            hearing: { id: hearingId } as DisputeHearingEntity,
            minimumAttendanceMinutes: 30,
            startedEarly: false,
          };
        });

      const referenceAt = new Date('2026-03-03T10:05:00.000Z');
      const result = await service.autoStartDueHearings(referenceAt);

      expect(result.referenceAt).toBe(referenceAt.toISOString());
      expect(result.started).toBe(1);
      expect(result.blocked).toBe(2);
      expect(startSpy).toHaveBeenCalledTimes(2);
      expect(startSpy).toHaveBeenCalledWith('h-success', 'staff-1');
      expect(startSpy).toHaveBeenCalledWith('h-start-fails', 'staff-1');
    });
  });

  describe('structured statement composer', () => {
    beforeEach(() => {
      hearingRepo.findOne.mockResolvedValue({
        id: 'h-structured-1',
        disputeId: 'd-structured-1',
        status: HearingStatus.SCHEDULED,
        tier: HearingTier.TIER_1,
        dispute: {
          id: 'd-structured-1',
          phase: 'PRESENTATION',
          status: DisputeStatus.IN_PROGRESS,
        },
      });
      hearingRepo.find.mockResolvedValue([
        {
          id: 'h-structured-1',
          disputeId: 'd-structured-1',
          status: HearingStatus.SCHEDULED,
          tier: HearingTier.TIER_1,
          hearingNumber: 1,
          previousHearingId: null,
          scheduledAt: new Date('2026-03-16T10:00:00.000Z'),
          summary: null,
          findings: null,
          noShowNote: null,
        },
      ]);
      participantRepo.findOne.mockResolvedValue({
        id: 'participant-1',
        role: HearingParticipantRole.RAISER,
        hasSubmittedStatement: false,
      });
      statementRepo.save.mockImplementation(async (statement: any) => statement);
    });

    it('requires platform declaration for submitted participant statements', async () => {
      await expect(
        service.submitHearingStatement(
          {
            hearingId: 'h-structured-1',
            type: HearingStatementType.OPENING,
            content: 'I want the record to reflect the failed delivery.',
            isDraft: false,
          } as any,
          'user-1',
        ),
      ).rejects.toThrow('platform declaration');
    });

    it('stores structured draft revisions when editing an existing draft', async () => {
      statementRepo.findOne.mockResolvedValue({
        id: 'draft-1',
        participantId: 'participant-1',
        status: HearingStatementStatus.DRAFT,
        type: HearingStatementType.OPENING,
        title: 'Old title',
        content: 'Old summary',
        structuredContent: [
          { kind: 'SUMMARY', heading: 'Executive Summary', body: 'Old summary' },
        ],
        citedEvidenceIds: ['ev-old'],
        attachments: null,
        replyToStatementId: null,
        retractionOfStatementId: null,
        platformDeclarationAccepted: false,
        platformDeclarationAcceptedAt: null,
        versionNumber: 2,
        versionHistory: [],
        createdAt: new Date('2026-03-15T08:00:00.000Z'),
        updatedAt: new Date('2026-03-15T09:00:00.000Z'),
      });

      await service.submitHearingStatement(
        {
          hearingId: 'h-structured-1',
          draftId: 'draft-1',
          type: HearingStatementType.OPENING,
          title: 'Updated opening',
          contentBlocks: [
            { kind: 'SUMMARY', heading: 'Executive Summary', body: 'New summary' },
            { kind: 'FACTS', heading: 'Factual Narrative', body: 'Detailed facts' },
          ],
          citedEvidenceIds: ['ev-1', 'ev-2'],
          changeSummary: 'Added factual narrative',
          isDraft: true,
        } as any,
        'user-1',
      );

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'draft-1',
          title: 'Updated opening',
          content: expect.stringContaining('New summary'),
          citedEvidenceIds: ['ev-1', 'ev-2'],
          versionNumber: 3,
          versionHistory: expect.arrayContaining([
            expect.objectContaining({
              versionNumber: 2,
              changeSummary: 'Added factual narrative',
              content: 'Old summary',
            }),
          ]),
        }),
      );
    });
  });

  describe('hearing lifecycle filtering', () => {
    it('returns only actionable hearings for active lifecycle', async () => {
      jest.spyOn(service as any, 'ensureDisputeAccessForHearings').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'loadConfirmationSummaryByHearingIds').mockResolvedValue(new Map());
      const upcomingActiveAt = new Date(Date.now() + 60 * 60 * 1000);
      const appealFutureAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      hearingRepo.find.mockResolvedValue([
        {
          id: 'h-active',
          disputeId: 'd-1',
          status: HearingStatus.SCHEDULED,
          tier: HearingTier.TIER_1,
          scheduledAt: upcomingActiveAt,
          participants: [],
          dispute: { id: 'd-1', status: DisputeStatus.IN_MEDIATION },
        },
        {
          id: 'h-archived',
          disputeId: 'd-1',
          status: HearingStatus.COMPLETED,
          tier: HearingTier.TIER_1,
          scheduledAt: new Date('2026-03-02T10:00:00.000Z'),
          participants: [],
          dispute: { id: 'd-1', status: DisputeStatus.RESOLVED },
        },
        {
          id: 'h-tier1-appeal',
          disputeId: 'd-1',
          status: HearingStatus.SCHEDULED,
          tier: HearingTier.TIER_1,
          scheduledAt: appealFutureAt,
          participants: [],
          dispute: { id: 'd-1', status: DisputeStatus.APPEALED },
        },
      ]);

      const result = await service.getHearingsForDispute(
        'd-1',
        { id: 'user-1', role: UserRole.CLIENT } as UserEntity,
        'active',
      );

      expect(result.map((item) => item.id)).toEqual(['h-active']);
      expect(result[0]).toEqual(expect.objectContaining({ lifecycle: 'ACTIVE' }));
    });
  });

  describe('manual meeting link validation', () => {
    it('rejects invalid external meeting links in schedule dto', async () => {
      const dto = plainToInstance(ScheduleHearingDto, {
        disputeId: '7f4fb56b-f167-4b40-a4ee-2842f0d6a6d1',
        scheduledAt: '2026-03-20T10:00:00.000Z',
        externalMeetingLink: 'https://meet.google.com/demo-hearing',
      });

      const errors = await validate(dto);

      expect(errors.some((item) => item.property === 'externalMeetingLink')).toBe(true);
    });

    it('accepts raw Google Meet room codes in schedule dto', async () => {
      const dto = plainToInstance(ScheduleHearingDto, {
        disputeId: '7f4fb56b-f167-4b40-a4ee-2842f0d6a6d1',
        scheduledAt: '2026-03-20T10:00:00.000Z',
        externalMeetingLink: '  abc-defg-hij  ',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.externalMeetingLink).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('accepts scheme-less meeting links in reschedule dto', async () => {
      const dto = plainToInstance(RescheduleHearingDto, {
        hearingId: '7f4fb56b-f167-4b40-a4ee-2842f0d6a6d1',
        scheduledAt: '2026-03-20T10:00:00.000Z',
        externalMeetingLink: '  meet.google.com/abc-defg-hij  ',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.externalMeetingLink).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('normalizes external meeting links inside the service layer', () => {
      expect((service as any).normalizeMeetingLink('abc-defg-hij')).toBe(
        'https://meet.google.com/abc-defg-hij',
      );
      expect(
        (service as any).normalizeMeetingLink('meet.google.com/abc-defg-hij'),
      ).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('rejects malformed external meeting links inside the service layer', () => {
      expect(() => (service as any).normalizeMeetingLink('not-a-url')).toThrow(
        BadRequestException,
      );
      expect(() =>
        (service as any).normalizeMeetingLink('https://meet.google.com/demo-hearing'),
      ).toThrow(BadRequestException);
    });
  });

  describe('hearing timeout automation', () => {
    it('auto-closes only hearings that exceeded the grace window', async () => {
      hearingRepo.find.mockResolvedValue([
        {
          id: 'h-overdue',
          disputeId: 'd-1',
          status: HearingStatus.IN_PROGRESS,
          scheduledAt: new Date('2026-03-03T10:00:00.000Z'),
          startedAt: new Date('2026-03-03T10:00:00.000Z'),
          estimatedDurationMinutes: 60,
          pausedAt: null,
          accumulatedPauseSeconds: 0,
          participants: [],
          dispute: { id: 'd-1', status: DisputeStatus.IN_MEDIATION },
        },
        {
          id: 'h-not-due',
          disputeId: 'd-2',
          status: HearingStatus.IN_PROGRESS,
          scheduledAt: new Date('2026-03-03T11:00:00.000Z'),
          startedAt: new Date('2026-03-03T11:00:00.000Z'),
          estimatedDurationMinutes: 60,
          pausedAt: null,
          accumulatedPauseSeconds: 0,
          participants: [],
          dispute: { id: 'd-2', status: DisputeStatus.IN_MEDIATION },
        },
      ]);

      const finalizeSpy = jest
        .spyOn(service as any, 'finalizeHearingEnd')
        .mockResolvedValue({
          hearing: { id: 'h-overdue' },
          cancelledQuestions: [],
          absentParticipants: [],
        });

      const result = await service.autoCloseOverdueHearings(
        new Date('2026-03-03T11:16:00.000Z'),
      );

      expect(result.checked).toBe(1);
      expect(result.closed).toBe(1);
      expect(result.failed).toBe(0);
      expect(finalizeSpy).toHaveBeenCalledTimes(1);
      expect(finalizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'h-overdue' }),
        expect.objectContaining({
          endedByType: 'SYSTEM',
          closureReason: 'TIME_LIMIT_REACHED',
          skipActionableCheck: true,
        }),
      );
    });
  });

  describe('reschedule freeze rule', () => {
    it('blocks standard reschedule requests inside 24 hours', async () => {
      hearingRepo.findOne.mockResolvedValue({
        id: 'hearing-1',
        status: HearingStatus.SCHEDULED,
        rescheduleCount: 0,
        moderatorId: 'staff-1',
        scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        participants: [],
      });
      userRepo.findOne.mockResolvedValue({
        id: 'staff-1',
        role: UserRole.STAFF,
      });

      await expect(
        service.rescheduleHearing(
          {
            hearingId: 'hearing-1',
            scheduledAt: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
            estimatedDurationMinutes: 60,
          } as RescheduleHearingDto,
          'staff-1',
        ),
      ).rejects.toThrow(BadRequestException);

      await service
        .rescheduleHearing(
          {
            hearingId: 'hearing-1',
            scheduledAt: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
            estimatedDurationMinutes: 60,
          } as RescheduleHearingDto,
          'staff-1',
        )
        .catch((error: BadRequestException) => {
          expect(error.getResponse()).toEqual(
            expect.objectContaining({
              code: 'HEARING_RESCHEDULE_FROZEN',
            }),
          );
        });
    });
  });
});
