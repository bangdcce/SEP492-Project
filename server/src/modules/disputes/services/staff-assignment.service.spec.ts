import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import {
  AutoScheduleRuleEntity,
  CalendarEventEntity,
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeHearingEntity,
  DisputeStatus,
  DisputeType,
  EventType,
  ProjectEntity,
  SkillEntity,
  SkillMappingRuleEntity,
  StaffExpertiseEntity,
  StaffPerformanceEntity,
  StaffWorkloadEntity,
  UserAvailabilityEntity,
  UserEntity,
  UserRole,
  DisputeSkillRequirementEntity,
  HearingStatus,
} from 'src/database/entities';
import { LeaveService } from '../../leave/leave.service';
import { StaffAssignmentService } from './staff-assignment.service';

describe('StaffAssignmentService', () => {
  let service: StaffAssignmentService;
  let disputeRepository: any;
  let calendarRepository: any;
  let hearingRepository: any;
  let evidenceRepository: any;
  let performanceRepository: any;
  let workloadRepository: any;
  let userRepository: any;

  const repoMock = () => ({
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffAssignmentService,
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProjectEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: getRepositoryToken(StaffWorkloadEntity), useValue: repoMock() },
        { provide: getRepositoryToken(CalendarEventEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserAvailabilityEntity), useValue: repoMock() },
        { provide: getRepositoryToken(AutoScheduleRuleEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeEvidenceEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeHearingEntity), useValue: repoMock() },
        { provide: getRepositoryToken(StaffExpertiseEntity), useValue: repoMock() },
        { provide: getRepositoryToken(DisputeSkillRequirementEntity), useValue: repoMock() },
        { provide: getRepositoryToken(SkillMappingRuleEntity), useValue: repoMock() },
        { provide: getRepositoryToken(SkillEntity), useValue: repoMock() },
        { provide: getRepositoryToken(StaffPerformanceEntity), useValue: repoMock() },
        { provide: DataSource, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: LeaveService, useValue: {} },
      ],
    }).compile();

    service = module.get(StaffAssignmentService);
    disputeRepository = module.get(getRepositoryToken(DisputeEntity));
    calendarRepository = module.get(getRepositoryToken(CalendarEventEntity));
    hearingRepository = module.get(getRepositoryToken(DisputeHearingEntity));
    evidenceRepository = module.get(getRepositoryToken(DisputeEvidenceEntity));
    performanceRepository = module.get(getRepositoryToken(StaffPerformanceEntity));
    workloadRepository = module.get(getRepositoryToken(StaffWorkloadEntity));
    userRepository = module.get(getRepositoryToken(UserEntity));
  });

  describe('getDashboardOverview', () => {
    it('uses enum-safe broker dispute filters when computing multi-party risk signals', async () => {
      disputeRepository.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      disputeRepository.find
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2026-03-10T09:00:00.000Z'),
            triageAt: new Date('2026-03-10T12:00:00.000Z'),
            assignedAt: null,
            infoRequestedAt: null,
            resolvedAt: null,
            resolutionDeadline: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2026-03-10T09:00:00.000Z'),
            resolvedAt: new Date('2026-03-11T09:00:00.000Z'),
            resolutionDeadline: new Date('2026-03-12T09:00:00.000Z'),
          },
        ]);

      const closedCountQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(4),
      };
      const overturnedCountQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };
      const multiPartyQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
      };
      disputeRepository.createQueryBuilder
        .mockReturnValueOnce(closedCountQb)
        .mockReturnValueOnce(overturnedCountQb)
        .mockReturnValueOnce(multiPartyQb);

      calendarRepository.count.mockResolvedValueOnce(3).mockResolvedValueOnce(6);

      const rescheduleQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '2' }),
      };
      const noShowQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };
      hearingRepository.createQueryBuilder
        .mockReturnValueOnce(rescheduleQb)
        .mockReturnValueOnce(noShowQb);
      hearingRepository.count.mockResolvedValue(4);

      performanceRepository.find.mockResolvedValue([
        {
          avgUserRating: 4.5,
        },
      ]);
      workloadRepository.find.mockResolvedValue([
        {
          utilizationRate: 62.5,
          totalDisputesPending: 3,
        },
      ]);
      userRepository.count.mockResolvedValue(2);

      evidenceRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '1' }),
      });

      const result = await service.getDashboardOverview('30d');

      expect(multiPartyQb.andWhere).toHaveBeenCalledWith(
        '(dispute.groupId IS NOT NULL OR dispute.disputeType IN (:...brokerTypes))',
        {
          brokerTypes: [
            DisputeType.CLIENT_VS_BROKER,
            DisputeType.FREELANCER_VS_BROKER,
            DisputeType.BROKER_VS_CLIENT,
            DisputeType.BROKER_VS_FREELANCER,
          ],
        },
      );
      expect(result).toEqual(
        expect.objectContaining({
          throughput: expect.objectContaining({
            newDisputes: 5,
            inProgress: 3,
            closed: 4,
          }),
          scheduling: expect.objectContaining({
            autoScheduleSuccessRate: 50,
            rescheduleCount: 2,
            noShowRate: 25,
          }),
          riskSignals: expect.objectContaining({
            multiPartyCases: 2,
            conflictingEvidenceCases: 1,
          }),
        }),
      );
    });
  });
});
