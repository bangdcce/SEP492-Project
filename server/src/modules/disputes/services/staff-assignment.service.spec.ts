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
  ProfileEntity,
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
import { DISPUTE_EVENTS } from '../events/dispute.events';
import { recordEvidence } from '../../../../test/fe16-fe18/evidence-recorder';

describe('StaffAssignmentService', () => {
  let service: StaffAssignmentService;
  let disputeRepository: any;
  let calendarRepository: any;
  let hearingRepository: any;
  let evidenceRepository: any;
  let performanceRepository: any;
  let workloadRepository: any;
  let userRepository: any;
  let dataSource: any;
  let eventEmitter: any;
  let leaveService: any;

  const repoMock = () => ({
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    leaveService = {
      getApprovedLeaveStaffIdsAt: jest.fn().mockResolvedValue(new Set()),
      getApprovedLeaveStaffIdsOverlapping: jest.fn().mockResolvedValue(new Set()),
      getLeaveMetricsForPeriod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffAssignmentService,
        { provide: getRepositoryToken(DisputeEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProjectEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProfileEntity), useValue: repoMock() },
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
        { provide: LeaveService, useValue: leaveService },
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
    dataSource = module.get(DataSource);
    eventEmitter = module.get(EventEmitter2);

    dataSource.transaction = jest.fn();
    jest.clearAllMocks();
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
      recordEvidence({
        id: 'FE17-ADM-01',
        evidenceRef: 'staff-assignment.service.spec.ts::dashboard enum-safe broker filters',
        actualResults:
          'getDashboardOverview built riskSignals.multiPartyCases=2 and conflictingEvidenceCases=1 while calling the broker dispute filter with enum-safe brokerTypes across broker-related dispute roles.',
      });
    });
  });

  describe('getAvailableStaff', () => {
    it('treats approved leave as unavailable even when workload snapshot is clear', async () => {
      userRepository.find.mockResolvedValue([
        {
          id: 'staff-1',
          role: UserRole.STAFF,
          isBanned: false,
        },
      ]);
      workloadRepository.find.mockResolvedValue([
        {
          staffId: 'staff-1',
          utilizationRate: 15,
          isOnLeave: false,
          canAcceptNewEvent: true,
        },
      ]);
      performanceRepository.find.mockResolvedValue([]);
      leaveService.getApprovedLeaveStaffIdsAt.mockResolvedValue(new Set(['staff-1']));

      disputeRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getAvailableStaff(new Date('2026-04-17T09:00:00.000Z'));

      expect(leaveService.getApprovedLeaveStaffIdsAt).toHaveBeenCalledWith(
        new Date('2026-04-17T09:00:00.000Z'),
        ['staff-1'],
      );
      expect(result.recommendedStaffId).toBeNull();
      expect(result.staff).toEqual([
        expect.objectContaining({
          staffId: 'staff-1',
          isOnLeave: true,
          isAvailable: false,
          canAcceptNewEvent: false,
          unavailableReason: 'On leave',
        }),
      ]);
    });
  });

  describe('autoAssignStaffToDispute', () => {
    it('returns manual fallback for terminal dispute status', async () => {
      const complexity = {
        level: 'LOW',
        confidence: 0.8,
        factors: [],
        timeEstimation: {
          minMinutes: 30,
          recommendedMinutes: 45,
          maxMinutes: 60,
        },
      };

      jest.spyOn(service, 'estimateDisputeComplexity').mockResolvedValue(complexity as any);

      const manager = {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === DisputeEntity) {
            return {
              findOne: jest.fn().mockResolvedValue({
                id: 'dispute-1',
                status: DisputeStatus.RESOLVED,
                assignedStaffId: null,
              }),
              update: jest.fn(),
            };
          }

          if (entity === StaffWorkloadEntity) {
            return {
              findOne: jest.fn(),
            };
          }

          return {};
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.autoAssignStaffToDispute('dispute-1');

      expect(result.success).toBe(false);
      expect(result.staffId).toBe('');
      expect(result.fallbackReason).toContain('RESOLVED');
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('staff.assigned', expect.anything());
    });

    it('assigns recommended staff in transaction and emits events after commit', async () => {
      const complexity = {
        level: 'MEDIUM',
        confidence: 0.9,
        factors: [],
        timeEstimation: {
          minMinutes: 45,
          recommendedMinutes: 60,
          maxMinutes: 90,
        },
      };

      jest.spyOn(service, 'estimateDisputeComplexity').mockResolvedValue(complexity as any);
      jest.spyOn(service, 'getAvailableStaff').mockResolvedValue({
        staff: [
          {
            staffId: 'staff-1',
            totalScore: 90,
            workloadScore: 90,
            performanceScore: 90,
            fairnessScore: 80,
            utilizationRate: 20,
            avgUserRating: 4.8,
            overturnRate: 0,
            monthlyDisputeCount: 2,
            isAvailable: true,
            isOnLeave: false,
            canAcceptNewEvent: true,
          },
        ],
        totalAvailable: 1,
        totalStaff: 1,
        shortageWarning: false,
        recommendedStaffId: 'staff-1',
      } as any);

      const incrementSpy = jest.spyOn(service, 'incrementPendingDisputes').mockResolvedValue(4);

      const disputeRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'dispute-1',
          status: DisputeStatus.IN_MEDIATION,
          assignedStaffId: null,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };
      const workloadRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'workload-1',
          utilizationRate: 20,
          isOnLeave: false,
          canAcceptNewEvent: true,
        }),
      };

      const manager = {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === DisputeEntity) {
            return disputeRepo;
          }
          if (entity === StaffWorkloadEntity) {
            return workloadRepo;
          }
          return {};
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.autoAssignStaffToDispute('dispute-1');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          staffId: 'staff-1',
        }),
      );
      expect(disputeRepo.update).toHaveBeenCalledWith('dispute-1', {
        assignedStaffId: 'staff-1',
        assignedAt: expect.any(Date),
      });
      expect(incrementSpy).toHaveBeenCalledWith('staff-1', 'dispute-1', {
        manager,
        emitEvent: false,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('workload.incremented', {
        staffId: 'staff-1',
        disputeId: 'dispute-1',
        newPendingCount: 4,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('staff.assigned', {
        disputeId: 'dispute-1',
        staffId: 'staff-1',
        complexity: 'MEDIUM',
        estimatedMinutes: 60,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(DISPUTE_EVENTS.ASSIGNED, {
        disputeId: 'dispute-1',
        staffId: 'staff-1',
        assignedAt: expect.any(Date),
      });
    });
  });

  describe('reassignDispute', () => {
    it('updates assignment atomically and emits workload + dispute reassigned events', async () => {
      const decrementSpy = jest.spyOn(service, 'decrementPendingDisputes').mockResolvedValue(2);
      const incrementSpy = jest.spyOn(service, 'incrementPendingDisputes').mockResolvedValue(5);

      const disputeRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'dispute-1',
          assignedStaffId: 'staff-old',
          status: DisputeStatus.PREVIEW,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      const userRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'staff-new',
          role: UserRole.STAFF,
          isBanned: false,
        }),
      };

      const manager = {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === DisputeEntity) {
            return disputeRepo;
          }
          if (entity === UserEntity) {
            return userRepo;
          }
          return {};
        }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

      const result = await service.reassignDispute(
        'dispute-1',
        'staff-new',
        'Rebalance caseload',
        'admin-1',
        'Urgent rotation',
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          oldStaffId: 'staff-old',
          newStaffId: 'staff-new',
        }),
      );
      expect(disputeRepo.update).toHaveBeenCalledWith('dispute-1', {
        assignedStaffId: 'staff-new',
        assignedAt: expect.any(Date),
      });
      expect(decrementSpy).toHaveBeenCalledWith('staff-old', 'dispute-1', {
        manager,
        emitEvent: false,
      });
      expect(incrementSpy).toHaveBeenCalledWith('staff-new', 'dispute-1', {
        manager,
        emitEvent: false,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('workload.decremented', {
        staffId: 'staff-old',
        disputeId: 'dispute-1',
        newPendingCount: 2,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('workload.incremented', {
        staffId: 'staff-new',
        disputeId: 'dispute-1',
        newPendingCount: 5,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(DISPUTE_EVENTS.REASSIGNED, {
        disputeId: 'dispute-1',
        oldStaffId: 'staff-old',
        newStaffId: 'staff-new',
        reason: 'Rebalance caseload',
        performedById: 'admin-1',
        notes: 'Urgent rotation',
      });
    });
  });
});
