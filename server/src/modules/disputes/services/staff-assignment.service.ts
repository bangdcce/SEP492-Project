// ============================================================================
// STAFF ASSIGNMENT SERVICE - Auto-Assignment & Workload Management
// ============================================================================
// Pattern: Unit Functions -> Compose Functions
// Addresses Edge Cases:
// - Dead Time & Phantom Overload (Time Range estimation)
// - Zombie Session (Idle Check)
// - Fragmented Time (Filler Tasks)
// - Buffer Zone (15min gaps)
// - Critical Overrun (Overtime handling)
// - Emergency Re-assignment (Sick leave)
// ============================================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThan, MoreThan, In, IsNull, Not } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { LeaveService } from '../../leave/leave.service';
import { DISPUTE_EVENTS } from '../events/dispute.events';

// Entities
import {
  DisputeEntity,
  DisputeStatus,
  DisputeCategory,
  DisputeType,
} from '../../../database/entities/dispute.entity';
import { ProjectEntity, PricingModel } from '../../../database/entities/project.entity';
import { UserEntity, UserRole } from '../../../database/entities/user.entity';
import { StaffWorkloadEntity } from '../../../database/entities/staff-workload.entity';
import {
  CalendarEventEntity,
  EventType,
  EventStatus,
} from '../../../database/entities/calendar-event.entity';
import { UserAvailabilityEntity } from '../../../database/entities/user-availability.entity';
import {
  AutoScheduleRuleEntity,
  SchedulingStrategy,
} from '../../../database/entities/auto-schedule-rule.entity';
import { DisputeEvidenceEntity } from '../../../database/entities/dispute-evidence.entity';
import {
  DisputeHearingEntity,
  HearingStatus,
} from '../../../database/entities/dispute-hearing.entity';

// Tagging System Entities
import { StaffExpertiseEntity } from '../../../database/entities/user-skill.entity';
import {
  DisputeSkillRequirementEntity,
  DisputeSkillSource,
  SkillMappingRuleEntity,
} from '../../../database/entities/dispute-skill.entity';
import { SkillEntity } from '../../../database/entities/skill.entity';
import { StaffPerformanceEntity } from '../../../database/entities/staff-performance.entity';

// Interfaces
import type {
  ComplexityLevel,
  ComplexityEstimation,
  ComplexityFactor,
  TimeEstimation,
  StaffScoreBreakdown,
  AvailableStaffResult,
  TimeSlot,
  BufferConfig,
  SessionTimingStatus,
  SessionTimingResult,
  IdleCheckConfig,
  IdleCheckResult,
  FillerTask,
  FragmentedTimeResult,
  EarlyReleaseResult,
  ReassignmentRequest,
  ReassignmentResult,
  StaffSuggestion,
  StaffSuggestionResult,
  SuggestionLevel,
} from '../interfaces/staff-assignment.interface';

// Re-export interfaces for external use
export type {
  ComplexityLevel,
  ComplexityEstimation,
  TimeEstimation,
  StaffScoreBreakdown,
  AvailableStaffResult,
  TimeSlot,
  SessionTimingResult,
  IdleCheckResult,
  FillerTask,
  FragmentedTimeResult,
  EarlyReleaseResult,
  ReassignmentResult,
  StaffSuggestion,
  StaffSuggestionResult,
};

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

export const ASSIGNMENT_CONFIG = {
  // Scoring weights (must sum to 100)
  WORKLOAD_WEIGHT: 40,
  PERFORMANCE_WEIGHT: 40,
  FAIRNESS_WEIGHT: 20,

  // Thresholds
  MAX_UTILIZATION_RATE: 80, // Staff won't receive new work above this
  OVERLOADED_THRESHOLD: 90,
  SHORTAGE_THRESHOLD: 2, // Alert if < 2 staff available

  // Complexity base times (minutes)
  COMPLEXITY_BASE: {
    LOW: { minMinutes: 30, recommendedMinutes: 45, maxMinutes: 60 },
    MEDIUM: { minMinutes: 45, recommendedMinutes: 60, maxMinutes: 90 },
    HIGH: { minMinutes: 60, recommendedMinutes: 90, maxMinutes: 120 },
    CRITICAL: { minMinutes: 90, recommendedMinutes: 120, maxMinutes: 180 },
  } as Record<ComplexityLevel, TimeEstimation>,

  // Category weights for complexity (using DisputeCategory)
  CATEGORY_WEIGHTS: {
    [DisputeCategory.FRAUD]: 100,
    [DisputeCategory.CONTRACT]: 85,
    [DisputeCategory.PAYMENT]: 80,
    [DisputeCategory.SCOPE_CHANGE]: 70,
    [DisputeCategory.QUALITY]: 60,
    [DisputeCategory.DEADLINE]: 55,
    [DisputeCategory.COMMUNICATION]: 40,
    [DisputeCategory.OTHER]: 45,
  } as Record<string, number>,

  // Buffer configuration
  BUFFER: {
    standardBufferMinutes: 15,
    extendedBufferMinutes: 30,
    minRestMinutes: 10,
  } as BufferConfig,

  // Idle check configuration
  IDLE_CHECK: {
    warningThresholdMinutes: 15,
    autoCloseDelayMinutes: 5,
    autoCloseEnabled: true,
  } as IdleCheckConfig,

  // Filler task minimum gap
  MIN_GAP_FOR_HEARING: 60, // Don't schedule hearing if gap < 60 min
  MIN_GAP_FOR_FILLER: 15, // Can assign filler task if gap >= 15 min

  // Time slot scoring
  SLOT_SCORES: {
    PREFERRED: 50,
    MORNING_FRESH: 20, // 9-11am
    AFTER_LUNCH: 10, // 2-4pm
    LATE_AFTERNOON: 0, // 4-6pm
    OUTSIDE_HOURS: -100,
  },

  // Leave penalty (applied inside performance score)
  LEAVE_PENALTY: {
    perRequest: 2,
    perLeaveHour: 1,
    perOverageHour: 4,
    maxPenalty: 30,
  },
} as const;

const BROKER_INVOLVED_DISPUTE_TYPES = [
  DisputeType.CLIENT_VS_BROKER,
  DisputeType.FREELANCER_VS_BROKER,
  DisputeType.BROKER_VS_CLIENT,
  DisputeType.BROKER_VS_FREELANCER,
] as const;

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class StaffAssignmentService {
  private readonly logger = new Logger(StaffAssignmentService.name);

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(StaffWorkloadEntity)
    private readonly workloadRepository: Repository<StaffWorkloadEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    @InjectRepository(AutoScheduleRuleEntity)
    private readonly ruleRepository: Repository<AutoScheduleRuleEntity>,
    @InjectRepository(DisputeEvidenceEntity)
    private readonly evidenceRepository: Repository<DisputeEvidenceEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepository: Repository<DisputeHearingEntity>,
    // Tagging System Repositories
    @InjectRepository(StaffExpertiseEntity)
    private readonly staffExpertiseRepository: Repository<StaffExpertiseEntity>,
    @InjectRepository(DisputeSkillRequirementEntity)
    private readonly disputeSkillRepository: Repository<DisputeSkillRequirementEntity>,
    @InjectRepository(SkillMappingRuleEntity)
    private readonly skillMappingRepository: Repository<SkillMappingRuleEntity>,
    @InjectRepository(SkillEntity)
    private readonly skillRepository: Repository<SkillEntity>,
    // Performance Tracking
    @InjectRepository(StaffPerformanceEntity)
    private readonly performanceRepository: Repository<StaffPerformanceEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly leaveService: LeaveService,
  ) {}

  private getRangeDays(range: '7d' | '30d' | '90d'): number {
    switch (range) {
      case '7d':
        return 7;
      case '90d':
        return 90;
      default:
        return 30;
    }
  }

  private getMedian(values: number[]): number {
    if (!values.length) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
      : Math.round(sorted[mid] * 100) / 100;
  }

  private getPeriodsForRange(start: Date, end: Date): string[] {
    const periods: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endCursor) {
      const year = cursor.getFullYear();
      const month = `${cursor.getMonth() + 1}`.padStart(2, '0');
      periods.push(`${year}-${month}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return periods;
  }

  private buildDashboardBuckets(range: '7d' | '30d' | '90d', start: Date, end: Date) {
    const useWeekly = range === '90d';
    const buckets: Array<{
      start: Date;
      end: Date;
      label: string;
      newDisputes: number;
      closed: number;
      breachCount: number;
      verdictHours: number[];
      utilizationSum: number;
      workloadSamples: number;
      pendingQueueTotal: number;
      overloadedStaff: number;
      conflictingEvidenceCases: number;
    }> = [];

    let cursor = new Date(start);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = useWeekly
        ? new Date(bucketStart.getTime() + 6 * 24 * 60 * 60 * 1000)
        : new Date(bucketStart);
      buckets.push({
        start: new Date(
          bucketStart.getFullYear(),
          bucketStart.getMonth(),
          bucketStart.getDate(),
          0,
          0,
          0,
          0,
        ),
        end: new Date(
          bucketEnd.getFullYear(),
          bucketEnd.getMonth(),
          bucketEnd.getDate(),
          23,
          59,
          59,
          999,
        ),
        label: useWeekly
          ? `Wk ${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`
          : `${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`,
        newDisputes: 0,
        closed: 0,
        breachCount: 0,
        verdictHours: [],
        utilizationSum: 0,
        workloadSamples: 0,
        pendingQueueTotal: 0,
        overloadedStaff: 0,
        conflictingEvidenceCases: 0,
      });
      cursor = new Date(bucketEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    return buckets;
  }

  private findDashboardBucket<T extends { start: Date; end: Date }>(buckets: T[], value?: Date | null) {
    if (!value) {
      return null;
    }

    return buckets.find((bucket) => value >= bucket.start && value <= bucket.end) || null;
  }

  private buildStaffDashboardMembers(
    staffUsers: Pick<UserEntity, 'id' | 'fullName' | 'email'>[],
    performanceRows: StaffPerformanceEntity[],
    workloadRows: StaffWorkloadEntity[],
  ) {
    const performanceMap = new Map<string, StaffPerformanceEntity[]>();
    const workloadMap = new Map<string, StaffWorkloadEntity[]>();

    (performanceRows ?? []).forEach((row) => {
      const current = performanceMap.get(row.staffId) || [];
      current.push(row);
      performanceMap.set(row.staffId, current);
    });

    (workloadRows ?? []).forEach((row) => {
      const current = workloadMap.get(row.staffId) || [];
      current.push(row);
      workloadMap.set(row.staffId, current);
    });

    return (staffUsers ?? [])
      .map((staff) => {
        const performances = performanceMap.get(staff.id) || [];
        const workloads = (workloadMap.get(staff.id) || []).sort(
          (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
        );
        const latestWorkload = workloads[workloads.length - 1];
        const resolvedCases = performances.reduce(
          (sum, row) => sum + Number(row.totalDisputesResolved || 0),
          0,
        );
        const finalizedCases = performances.reduce(
          (sum, row) => sum + Number(row.totalCasesFinalized || 0),
          0,
        );
        const appealedCases = performances.reduce(
          (sum, row) => sum + Number(row.totalAppealed || 0),
          0,
        );
        const overturnedCases = performances.reduce(
          (sum, row) => sum + Number(row.totalOverturnedByAdmin || 0),
          0,
        );
        const hearingsConducted = performances.reduce(
          (sum, row) => sum + Number(row.totalHearingsConducted || 0),
          0,
        );
        const leaveMinutes = performances.reduce(
          (sum, row) => sum + Number(row.totalLeaveMinutes || 0),
          0,
        );
        const utilizationRate =
          workloads.length > 0
            ? Math.round(
                (workloads.reduce((sum, row) => sum + Number(row.utilizationRate || 0), 0) /
                  workloads.length) *
                  100,
              ) / 100
            : 0;
        const currentUtilizationRate = Number(latestWorkload?.utilizationRate || 0);
        const pendingCases = Number(latestWorkload?.totalDisputesPending || 0);
        const avgResolutionTimeHours =
          resolvedCases > 0
            ? Math.round(
                (performances.reduce(
                  (sum, row) =>
                    sum +
                    Number(row.avgResolutionTimeHours || 0) *
                      Number(row.totalDisputesResolved || 0),
                  0,
                ) /
                  resolvedCases) *
                  100,
              ) / 100
            : 0;
        const appealRate =
          finalizedCases > 0 ? Math.round((appealedCases / finalizedCases) * 10000) / 100 : 0;
        const overturnRate =
          appealedCases > 0 ? Math.round((overturnedCases / appealedCases) * 10000) / 100 : 0;
        const lastActiveAt =
          latestWorkload?.updatedAt?.toISOString() || performances.at(-1)?.updatedAt?.toISOString() || null;

        return {
          id: staff.id,
          name: staff.fullName,
          email: staff.email,
          resolvedCases,
          pendingCases,
          utilizationRate,
          currentUtilizationRate,
          appealRate,
          overturnRate,
          avgResolutionTimeHours,
          hearingsConducted,
          leaveMinutes,
          isOverloaded: Boolean(latestWorkload?.isOverloaded),
          isActive: Boolean(lastActiveAt || resolvedCases || pendingCases || hearingsConducted),
          lastActiveAt,
          score:
            resolvedCases * 1.5 +
            hearingsConducted * 0.75 -
            appealRate * 0.4 -
            overturnRate * 0.5 -
            Math.max(currentUtilizationRate - 85, 0),
        };
      })
      .sort((left, right) => right.score - left.score);
  }

  async getDashboardOverview(
    range: '7d' | '30d' | '90d' = '30d',
    currentUser?: Pick<UserEntity, 'id' | 'role'>,
  ) {
    const now = new Date();
    const start = new Date(now.getTime() - this.getRangeDays(range) * 24 * 60 * 60 * 1000);
    const periods = this.getPeriodsForRange(start, now);

    const [
      newCount,
      inProgressCount,
      closedCount,
      firstResponseCandidates,
      resolvedCases,
      autoScheduledCount,
      hearingEventCount,
      hearingRescheduleRaw,
      completedHearings,
      noShowHearings,
      appealedCount,
      overturnedCount,
      performanceRows,
      workloadRows,
      pendingQueueCount,
      totalStaff,
      prolongedCases,
      multiPartyRaw,
      contradictoryEvidenceRaw,
      staffUsers,
      contradictoryEvidenceRows,
    ] = await Promise.all([
      this.disputeRepository.count({
        where: {
          createdAt: Between(start, now),
        },
      }),
      this.disputeRepository.count({
        where: {
          status: In([
            DisputeStatus.OPEN,
            DisputeStatus.TRIAGE_PENDING,
            DisputeStatus.PREVIEW,
            DisputeStatus.PENDING_REVIEW,
            DisputeStatus.INFO_REQUESTED,
            DisputeStatus.IN_MEDIATION,
            DisputeStatus.APPEALED,
            DisputeStatus.REJECTION_APPEALED,
          ]),
        },
      }),
      this.disputeRepository
        .createQueryBuilder('dispute')
        .where('dispute.status IN (:...statuses)', {
          statuses: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED, DisputeStatus.CANCELED],
        })
        .andWhere('dispute.updatedAt BETWEEN :start AND :end', { start, end: now })
        .getCount(),
      this.disputeRepository.find({
        where: { createdAt: Between(start, now) },
        select: [
          'id',
          'createdAt',
          'assignedAt',
          'triageAt',
          'infoRequestedAt',
          'resolvedAt',
          'resolutionDeadline',
        ],
      }),
      this.disputeRepository.find({
        where: {
          resolvedAt: Between(start, now),
        },
        select: ['id', 'createdAt', 'resolvedAt', 'resolutionDeadline'],
      }),
      this.calendarRepository.count({
        where: {
          type: EventType.DISPUTE_HEARING,
          startTime: Between(start, now),
          isAutoScheduled: true,
        },
      }),
      this.calendarRepository.count({
        where: {
          type: EventType.DISPUTE_HEARING,
          startTime: Between(start, now),
        },
      }),
      this.hearingRepository
        .createQueryBuilder('hearing')
        .select('COALESCE(SUM(hearing.rescheduleCount), 0)', 'count')
        .where('hearing.createdAt BETWEEN :start AND :end', { start, end: now })
        .getRawOne<{ count: string }>(),
      this.hearingRepository.count({
        where: {
          createdAt: Between(start, now),
          status: HearingStatus.COMPLETED,
        },
      }),
      this.hearingRepository
        .createQueryBuilder('hearing')
        .where('hearing.createdAt BETWEEN :start AND :end', { start, end: now })
        .andWhere('hearing.status = :status', { status: HearingStatus.COMPLETED })
        .andWhere('hearing.noShowNote IS NOT NULL')
        .andWhere("TRIM(hearing.noShowNote) <> ''")
        .getCount(),
      this.disputeRepository.count({
        where: {
          appealedAt: Between(start, now),
        },
      }),
      this.disputeRepository
        .createQueryBuilder('dispute')
        .where('dispute.appealResolvedAt BETWEEN :start AND :end', { start, end: now })
        .andWhere('dispute.appealResolvedById IS NOT NULL')
        .getCount(),
      periods.length
        ? this.performanceRepository.find({
            where: { period: In(periods) },
          })
        : Promise.resolve([]),
      this.workloadRepository.find({
        where: {
          date: Between(start, now),
        },
      }),
      this.disputeRepository.count({
        where: {
          assignedStaffId: IsNull(),
          status: In([DisputeStatus.OPEN, DisputeStatus.TRIAGE_PENDING]),
        },
      }),
      this.userRepository.count({
        where: {
          role: UserRole.STAFF,
        },
      }),
      this.disputeRepository.count({
        where: {
          status: In([
            DisputeStatus.OPEN,
            DisputeStatus.TRIAGE_PENDING,
            DisputeStatus.PREVIEW,
            DisputeStatus.PENDING_REVIEW,
            DisputeStatus.INFO_REQUESTED,
            DisputeStatus.IN_MEDIATION,
            DisputeStatus.APPEALED,
            DisputeStatus.REJECTION_APPEALED,
          ]),
          resolutionDeadline: LessThan(now),
        },
      }),
      this.disputeRepository
        .createQueryBuilder('dispute')
        .where('dispute.createdAt BETWEEN :start AND :end', { start, end: now })
        .andWhere(
          '(dispute.groupId IS NOT NULL OR dispute.disputeType IN (:...brokerTypes))',
          {
            brokerTypes: [...BROKER_INVOLVED_DISPUTE_TYPES],
          },
        )
        .getCount(),
      this.evidenceRepository
        .createQueryBuilder('evidence')
        .select('COUNT(DISTINCT evidence.disputeId)', 'count')
        .where('evidence.uploadedAt BETWEEN :start AND :end', { start, end: now })
        .andWhere('(evidence.isFlagged = true OR evidence.flagReason IS NOT NULL)')
        .getRawOne<{ count: string }>(),
      this.userRepository.find({
        where: {
          role: UserRole.STAFF,
        },
        select: ['id', 'fullName', 'email'],
      }),
      this.evidenceRepository.find({
        where: {
          uploadedAt: Between(start, now),
        },
        select: ['id', 'uploadedAt', 'isFlagged', 'flagReason'],
      }),
    ]);

    const firstResponseHours = firstResponseCandidates
      .map((item) => {
        const responseAt =
          item.triageAt || item.infoRequestedAt || item.assignedAt || item.resolvedAt || null;
        if (!item.createdAt || !responseAt) {
          return null;
        }
        return (responseAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
      })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    const verdictHours = resolvedCases
      .map((item) => {
        if (!item.createdAt || !item.resolvedAt) {
          return null;
        }
        return (item.resolvedAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60);
      })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    const resolvedBreaches = resolvedCases.filter(
      (item) =>
        item.resolutionDeadline &&
        item.resolvedAt &&
        item.resolvedAt.getTime() > item.resolutionDeadline.getTime(),
    ).length;
    const breachRate =
      resolvedCases.length > 0
        ? Math.round((resolvedBreaches / resolvedCases.length) * 10000) / 100
        : 0;

    const averageUtilization =
      workloadRows.length > 0
        ? Math.round(
            (workloadRows.reduce((sum, row) => sum + Number(row.utilizationRate || 0), 0) /
              workloadRows.length) *
              100,
          ) / 100
        : 0;
    const averageCasesPerStaff =
      workloadRows.length > 0
        ? Math.round(
            (workloadRows.reduce((sum, row) => sum + Number(row.totalDisputesPending || 0), 0) /
              workloadRows.length) *
              100,
          ) / 100
        : 0;
    const autoScheduleSuccessRate =
      hearingEventCount > 0
        ? Math.round((autoScheduledCount / hearingEventCount) * 10000) / 100
        : 0;
    const noShowRate =
      completedHearings > 0
        ? Math.round((noShowHearings / completedHearings) * 10000) / 100
        : 0;

    const feedbackValues = performanceRows
      .map((row) => Number(row.avgUserRating || 0))
      .filter((value) => value > 0);
    const feedbackScore =
      feedbackValues.length > 0
        ? Math.round(
            (feedbackValues.reduce((sum, value) => sum + value, 0) / feedbackValues.length) * 100,
          ) / 100
        : 0;

    const buckets = this.buildDashboardBuckets(range, start, now);
    firstResponseCandidates.forEach((item) => {
      const bucket = this.findDashboardBucket(buckets, item.createdAt);
      if (bucket) {
        bucket.newDisputes += 1;
      }
    });
    resolvedCases.forEach((item) => {
      const bucket = this.findDashboardBucket(buckets, item.resolvedAt);
      if (!bucket || !item.createdAt || !item.resolvedAt) {
        return;
      }
      bucket.closed += 1;
      bucket.verdictHours.push(
        (item.resolvedAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60),
      );
      if (
        item.resolutionDeadline &&
        item.resolvedAt.getTime() > item.resolutionDeadline.getTime()
      ) {
        bucket.breachCount += 1;
      }
    });
    workloadRows.forEach((row) => {
      const bucket = this.findDashboardBucket(
        buckets,
        row.date ? new Date(row.date) : undefined,
      );
      if (!bucket) {
        return;
      }
      bucket.utilizationSum += Number(row.utilizationRate || 0);
      bucket.workloadSamples += 1;
      bucket.pendingQueueTotal += Number(row.totalDisputesPending || 0);
      if (row.isOverloaded) {
        bucket.overloadedStaff += 1;
      }
    });
    (contradictoryEvidenceRows ?? [])
      .filter((row) => row.isFlagged || row.flagReason)
      .forEach((row) => {
        const bucket = this.findDashboardBucket(
          buckets,
          row.uploadedAt ? new Date(row.uploadedAt) : undefined,
        );
        if (bucket) {
          bucket.conflictingEvidenceCases += 1;
        }
      });

    const members = this.buildStaffDashboardMembers(staffUsers, performanceRows, workloadRows);
    const memberDivisor = members.length || 1;
    const teamAverages = {
      resolvedCases:
        Math.round((members.reduce((sum, member) => sum + member.resolvedCases, 0) / memberDivisor) * 100) / 100,
      pendingCases:
        Math.round((members.reduce((sum, member) => sum + member.pendingCases, 0) / memberDivisor) * 100) / 100,
      utilizationRate:
        Math.round((members.reduce((sum, member) => sum + member.utilizationRate, 0) / memberDivisor) * 100) / 100,
      appealRate:
        Math.round((members.reduce((sum, member) => sum + member.appealRate, 0) / memberDivisor) * 100) / 100,
      overturnRate:
        Math.round((members.reduce((sum, member) => sum + member.overturnRate, 0) / memberDivisor) * 100) / 100,
      avgResolutionTimeHours:
        Math.round(
          (members.reduce((sum, member) => sum + member.avgResolutionTimeHours, 0) / memberDivisor) * 100,
        ) / 100,
    };
    const currentUserMember =
      currentUser?.role === UserRole.STAFF
        ? members.find((member) => member.id === currentUser.id) || null
        : null;
    const currentUserRank = currentUserMember
      ? members.findIndex((member) => member.id === currentUserMember.id) + 1
      : null;

    return {
      generatedAt: now.toISOString(),
      range,
      throughput: {
        newDisputes: newCount,
        inProgress: inProgressCount,
        closed: closedCount,
      },
      sla: {
        medianTimeToFirstResponseHours: this.getMedian(firstResponseHours),
        medianTimeToVerdictHours: this.getMedian(verdictHours),
        breachRate,
      },
      scheduling: {
        autoScheduleSuccessRate,
        rescheduleCount: Number(hearingRescheduleRaw?.count || 0),
        noShowRate,
      },
      quality: {
        appealRate:
          closedCount > 0 ? Math.round((appealedCount / closedCount) * 10000) / 100 : 0,
        overturnedVerdictRate:
          appealedCount > 0 ? Math.round((overturnedCount / appealedCount) * 10000) / 100 : 0,
        feedbackScore,
      },
      workload: {
        averageCasesPerStaff,
        averageUtilizationRate: averageUtilization,
        pendingQueueCount,
        totalStaff,
      },
      riskSignals: {
        prolongedCases,
        multiPartyCases: Number(multiPartyRaw || 0),
        conflictingEvidenceCases: Number(contradictoryEvidenceRaw?.count || 0),
      },
      series: {
        throughput: buckets.map((bucket) => ({
          label: bucket.label,
          newDisputes: bucket.newDisputes,
          closed: bucket.closed,
        })),
        sla: buckets.map((bucket) => ({
          label: bucket.label,
          medianTimeToVerdictHours: this.getMedian(bucket.verdictHours),
          breachRate:
            bucket.closed > 0 ? Math.round((bucket.breachCount / bucket.closed) * 10000) / 100 : 0,
        })),
        workload: buckets.map((bucket) => ({
          label: bucket.label,
          averageUtilizationRate:
            bucket.workloadSamples > 0
              ? Math.round((bucket.utilizationSum / bucket.workloadSamples) * 100) / 100
              : 0,
          pendingQueueCount:
            bucket.workloadSamples > 0
              ? Math.round((bucket.pendingQueueTotal / bucket.workloadSamples) * 100) / 100
              : 0,
        })),
        risk: buckets.map((bucket) => ({
          label: bucket.label,
          overloadedStaff: bucket.overloadedStaff,
          conflictingEvidenceCases: bucket.conflictingEvidenceCases,
        })),
      },
      members,
      currentUser: currentUserMember
        ? {
            ...currentUserMember,
            rank: currentUserRank,
            teamAverages,
          }
        : null,
      highlights: {
        overloadedStaff: members
          .filter((member) => member.isOverloaded)
          .slice(0, 5)
          .map((member) => ({
            id: member.id,
            name: member.name,
            currentUtilizationRate: member.currentUtilizationRate,
            pendingCases: member.pendingCases,
          })),
        backlogPressure: {
          pendingQueueCount,
          overloadedCount: members.filter((member) => member.isOverloaded).length,
        },
        riskSpikes: buckets
          .filter((bucket) => bucket.overloadedStaff > 0 || bucket.conflictingEvidenceCases > 0)
          .slice(-5)
          .map((bucket) => ({
            label: bucket.label,
            overloadedStaff: bucket.overloadedStaff,
            conflictingEvidenceCases: bucket.conflictingEvidenceCases,
          })),
      },
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: COMPLEXITY ESTIMATION
  // ===========================================================================

  /**
   * UNIT FUNCTION: Calculate base complexity from dispute category
   */
  private getCategoryComplexityWeight(category: DisputeCategory): number {
    return ASSIGNMENT_CONFIG.CATEGORY_WEIGHTS[category] || 45;
  }

  /**
   * UNIT FUNCTION: Calculate complexity from evidence count
   * More evidence = more time needed to review
   */
  private getEvidenceComplexityWeight(evidenceCount: number): number {
    if (evidenceCount <= 0) return 10;
    return Math.min(evidenceCount * 12, 100);
  }

  /**
   * UNIT FUNCTION: Calculate complexity from description length
   * Longer descriptions often indicate more complex issues
   */
  private getDescriptionComplexityWeight(descriptionLength: number): number {
    if (descriptionLength > 2000) return 90;
    if (descriptionLength > 1200) return 70;
    if (descriptionLength > 600) return 55;
    if (descriptionLength > 300) return 40;
    if (descriptionLength > 0) return 25;
    return 10;
  }

  /**
   * UNIT FUNCTION: Calculate complexity from disputed amount (currency-aware)
   */
  private getAmountComplexityScore(amount: number, currency: string, totalBudget?: number): number {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const normalizedCurrency = (currency || 'USD').toUpperCase();

    const thresholds =
      normalizedCurrency === 'VND'
        ? { low: 1_000_000, medium: 10_000_000, high: 50_000_000 }
        : { low: 100, medium: 1000, high: 5000 };

    let score = 10;
    if (safeAmount >= thresholds.high) score = 90;
    else if (safeAmount >= thresholds.medium) score = 60;
    else if (safeAmount >= thresholds.low) score = 35;

    if (totalBudget && totalBudget > 0) {
      const ratio = safeAmount / totalBudget;
      if (ratio >= 0.8) score = Math.min(100, score + 20);
      else if (ratio >= 0.5) score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * UNIT FUNCTION: Additional process complexity (multi-party, pricing model, repeats)
   */
  private getProcessComplexityScore(
    dispute: DisputeEntity,
    project?: ProjectEntity | null,
  ): number {
    let score = 20;
    const involvesBroker = dispute.disputeType?.includes('BROKER') || Boolean(project?.brokerId);
    if (involvesBroker) {
      score += 30;
    }
    if (project?.pricingModel === PricingModel.TIME_MATERIALS) {
      score += 20;
    }
    if (dispute.parentDisputeId) {
      score += 15;
    }
    return Math.min(100, score);
  }

  /**
   * UNIT FUNCTION: Determine complexity level from total score
   */
  private determineComplexityLevel(totalScore: number): ComplexityLevel {
    if (totalScore >= 80) return 'CRITICAL';
    if (totalScore >= 60) return 'HIGH';
    if (totalScore >= 35) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * UNIT FUNCTION: Get time estimation range for complexity level
   * Returns min/recommended/max to handle "Dead Time" edge case
   */
  private getTimeEstimationForLevel(level: ComplexityLevel): TimeEstimation {
    return { ...ASSIGNMENT_CONFIG.COMPLEXITY_BASE[level] };
  }

  /**
   * COMPOSE FUNCTION: Estimate dispute complexity with time range
   *
   * EDGE CASE ADDRESSED: "Dead Time & Phantom Overload"
   * - Returns a RANGE instead of single value
   * - UI can show recommended but allow Staff to adjust
   * - min ensures no spam scheduling (5-min hearings)
   */
  async estimateDisputeComplexity(disputeId: string): Promise<ComplexityEstimation> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const evidenceCount = await this.evidenceRepository.count({
      where: { disputeId },
    });

    const project = await this.projectRepository.findOne({
      where: { id: dispute.projectId },
      select: ['id', 'currency', 'totalBudget', 'pricingModel', 'brokerId'],
    });
    const currency = project?.currency || 'USD';

    // Calculate individual factors (0-100) with explicit weights
    const factors: ComplexityFactor[] = [];
    const weights = {
      category: 0.3,
      amount: 0.25,
      evidence: 0.2,
      description: 0.15,
      process: 0.1,
    };

    // Factor 1: Dispute Category
    const category = dispute.category || DisputeCategory.OTHER;
    const categoryScore = this.getCategoryComplexityWeight(category);
    factors.push({
      name: 'Dispute Category',
      weight: weights.category,
      value: categoryScore,
      contribution: categoryScore * weights.category,
      description: `${category} cases tend to be ${
        categoryScore >= 70 ? 'high' : 'moderate'
      } effort`,
    });

    // Factor 2: Dispute Amount (currency-aware, relative to budget)
    const amount = dispute.disputedAmount || 0;
    const amountScore = this.getAmountComplexityScore(amount, currency, project?.totalBudget);
    factors.push({
      name: 'Dispute Value',
      weight: weights.amount,
      value: amountScore,
      contribution: amountScore * weights.amount,
      description: `${currency} ${amount} disputed`,
    });

    // Factor 3: Evidence Count
    const evidenceScore = this.getEvidenceComplexityWeight(evidenceCount);
    factors.push({
      name: 'Evidence Volume',
      weight: weights.evidence,
      value: evidenceScore,
      contribution: evidenceScore * weights.evidence,
      description: `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'}`,
    });

    // Factor 4: Reason Length
    const reasonLength = dispute.reason?.length || 0;
    const descScore = this.getDescriptionComplexityWeight(reasonLength);
    factors.push({
      name: 'Issue Detail',
      weight: weights.description,
      value: descScore,
      contribution: descScore * weights.description,
      description: reasonLength > 600 ? 'Detailed issue narrative' : 'Concise issue summary',
    });

    // Factor 5: Process Complexity (broker involvement, pricing model, repeat)
    const processScore = this.getProcessComplexityScore(dispute, project);
    factors.push({
      name: 'Process Complexity',
      weight: weights.process,
      value: processScore,
      contribution: processScore * weights.process,
      description:
        processScore >= 60
          ? 'Multi-party coordination or complex pricing model'
          : 'Standard mediation flow',
    });

    // Calculate total score
    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

    // Determine level and time estimation
    const level = this.determineComplexityLevel(totalScore);
    const timeEstimation = this.getTimeEstimationForLevel(level);

    // Adjust time based on specific factors
    if (evidenceCount > 8) {
      timeEstimation.recommendedMinutes += 15;
      timeEstimation.maxMinutes += 30;
    }
    if (amountScore >= 80) {
      timeEstimation.recommendedMinutes += 10;
      timeEstimation.maxMinutes += 20;
    }
    if (processScore >= 70) {
      timeEstimation.recommendedMinutes += 10;
      timeEstimation.maxMinutes += 15;
    }

    // Calculate confidence (lower if we have less data)
    const confidence = Math.min(
      100,
      40 +
        Math.min(30, evidenceCount * 4) +
        (reasonLength > 500 ? 15 : 0) +
        (amount > 0 ? 10 : 0) +
        (project ? 5 : 0),
    );

    this.logger.log(
      `Complexity for dispute ${disputeId}: ${level} ` +
        `(${timeEstimation.minMinutes}-${timeEstimation.maxMinutes} min, confidence: ${confidence}%)`,
    );

    return {
      level,
      timeEstimation,
      factors,
      confidence,
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: SKILL/TAGGING SYSTEM
  // ===========================================================================

  /**
   * UNIT FUNCTION: Auto-detect required skills from dispute category
   * Uses skill_mapping_rules table to determine which audit skills are needed
   */
  async autoDetectRequiredSkills(disputeId: string, category: DisputeCategory): Promise<void> {
    // Find mapping rules for this dispute category
    const mappingRules = await this.skillMappingRepository.find({
      where: {
        entityType: 'DISPUTE_CATEGORY',
        entityValue: category,
        isActive: true,
      },
      order: { priority: 'ASC' },
    });

    if (mappingRules.length === 0) {
      this.logger.log(`No skill mapping rules found for category: ${category}`);
      return;
    }

    // Create dispute skill requirements
    for (const rule of mappingRules) {
      const existing = await this.disputeSkillRepository.findOne({
        where: { disputeId, skillId: rule.skillId },
      });

      if (!existing) {
        await this.disputeSkillRepository.save({
          disputeId,
          skillId: rule.skillId,
          source: DisputeSkillSource.AUTO_DETECTED,
          requiredLevel: rule.requiredLevel,
          isMandatory: rule.isMandatory,
        });

        this.logger.log(`Auto-tagged dispute ${disputeId} with skill ${rule.skillId}`);
      }
    }
  }

  /**
   * UNIT FUNCTION: Get required skills for a dispute
   */
  async getDisputeRequiredSkills(disputeId: string): Promise<DisputeSkillRequirementEntity[]> {
    return this.disputeSkillRepository.find({
      where: { disputeId },
      relations: ['skill'],
    });
  }

  /**
   * UNIT FUNCTION: Calculate skill match score between staff expertise and dispute requirements
   * Returns 0-100 based on how well staff's expertise matches dispute needs
   */
  async calculateSkillMatchScore(staffId: string, disputeId: string): Promise<number> {
    // Get dispute required skills
    const requirements = await this.disputeSkillRepository.find({
      where: { disputeId },
    });

    if (requirements.length === 0) {
      // No specific skills required, return neutral score
      return 50;
    }

    // Get staff expertise
    const expertise = await this.staffExpertiseRepository.find({
      where: { staffId, isActive: true },
    });

    if (expertise.length === 0) {
      // Staff has no documented expertise, return low score
      return 20;
    }

    // Calculate match
    let totalScore = 0;
    let maxScore = 0;
    let mandatoryMet = true;

    for (const req of requirements) {
      const weight = req.isMandatory ? 2 : 1; // Mandatory skills worth more
      maxScore += 100 * weight;

      const staffSkill = expertise.find((e) => e.skillId === req.skillId);

      if (staffSkill) {
        // Staff has this skill - calculate level match
        const levelRatio = Math.min(staffSkill.expertiseLevel / req.requiredLevel, 1);
        const skillScore = levelRatio * 100;

        // Bonus for exceeding required level
        const bonus = staffSkill.expertiseLevel > req.requiredLevel ? 10 : 0;

        totalScore += (skillScore + bonus) * weight;
      } else if (req.isMandatory) {
        mandatoryMet = false;
      }
    }

    // If mandatory skill not met, heavily penalize
    if (!mandatoryMet) {
      return Math.max(0, (totalScore / maxScore) * 100 * 0.3);
    }

    return Math.round((totalScore / maxScore) * 100);
  }

  /**
   * UNIT FUNCTION: Get staff with matching expertise for dispute
   * Returns staff sorted by skill match score
   */
  async getStaffBySkillMatch(
    disputeId: string,
    staffIds: string[],
  ): Promise<{ staffId: string; skillMatchScore: number }[]> {
    const results: { staffId: string; skillMatchScore: number }[] = [];

    for (const staffId of staffIds) {
      const score = await this.calculateSkillMatchScore(staffId, disputeId);
      results.push({ staffId, skillMatchScore: score });
    }

    return results.sort((a, b) => b.skillMatchScore - a.skillMatchScore);
  }

  /**
   * UNIT FUNCTION: Manually tag dispute with additional skill requirement
   */
  async tagDisputeWithSkill(
    disputeId: string,
    skillId: string,
    addedById: string,
    requiredLevel: number = 1,
    notes?: string,
  ): Promise<DisputeSkillRequirementEntity> {
    // Verify skill exists and is for staff
    const skill = await this.skillRepository.findOne({
      where: { id: skillId, forStaff: true },
    });

    if (!skill) {
      throw new BadRequestException('Invalid skill or skill is not an audit skill');
    }

    // Check if already tagged
    const existing = await this.disputeSkillRepository.findOne({
      where: { disputeId, skillId },
    });

    if (existing) {
      // Update existing
      existing.requiredLevel = requiredLevel;
      existing.notes = notes || existing.notes;
      return this.disputeSkillRepository.save(existing);
    }

    // Create new
    return this.disputeSkillRepository.save({
      disputeId,
      skillId,
      source: DisputeSkillSource.MANUAL_TAGGED,
      requiredLevel,
      isMandatory: false,
      addedById,
      notes,
    });
  }

  /**
   * UNIT FUNCTION: Update staff expertise stats after dispute resolution
   */
  async updateStaffExpertiseStats(
    staffId: string,
    disputeId: string,
    wasSuccessful: boolean,
  ): Promise<void> {
    // Get skills used in this dispute
    const requirements = await this.disputeSkillRepository.find({
      where: { disputeId },
    });

    for (const req of requirements) {
      const expertise = await this.staffExpertiseRepository.findOne({
        where: { staffId, skillId: req.skillId },
      });

      if (expertise) {
        expertise.disputesHandled += 1;

        // Recalculate success rate
        if (wasSuccessful) {
          const successCount = (expertise.successRate * (expertise.disputesHandled - 1)) / 100 + 1;
          expertise.successRate = (successCount / expertise.disputesHandled) * 100;
        } else {
          const successCount = (expertise.successRate * (expertise.disputesHandled - 1)) / 100;
          expertise.successRate = (successCount / expertise.disputesHandled) * 100;
        }

        await this.staffExpertiseRepository.save(expertise);
      }
    }
  }

  // ===========================================================================
  // UNIT FUNCTIONS: STAFF SCORING
  // ===========================================================================

  /**
   * UNIT FUNCTION: Calculate workload score (40% weight)
   * Lower utilization = higher score
   */
  private calculateWorkloadScore(utilizationRate: number): number {
    // 0% utilization = 100 points, 80% = 20 points, 100% = 0 points
    return Math.max(0, 100 - utilizationRate);
  }

  /**
   * UNIT FUNCTION: Calculate performance score (40% weight)
   * Based on user rating and overturn rate
   */
  private calculatePerformanceScore(
    avgRating: number,
    overturnRate: number,
    leavePenalty: number,
  ): number {
    // Rating: 1-5 stars -> 0-100 points (5 stars = 100)
    const ratingScore = (avgRating / 5) * 100;

    // Overturn penalty: Each % of overturn reduces score
    const overturnPenalty = overturnRate * 0.5;

    const penalty = overturnPenalty + Math.max(0, leavePenalty || 0);

    return Math.max(0, ratingScore - penalty);
  }

  private calculateLeavePenalty(
    leaveMinutes: number,
    leaveOverageMinutes: number,
    leaveRequestCount: number,
  ): number {
    const leaveHours = Math.max(0, leaveMinutes) / 60;
    const overageHours = Math.max(0, leaveOverageMinutes) / 60;
    const penalty =
      leaveRequestCount * ASSIGNMENT_CONFIG.LEAVE_PENALTY.perRequest +
      leaveHours * ASSIGNMENT_CONFIG.LEAVE_PENALTY.perLeaveHour +
      overageHours * ASSIGNMENT_CONFIG.LEAVE_PENALTY.perOverageHour;
    return Math.min(ASSIGNMENT_CONFIG.LEAVE_PENALTY.maxPenalty, Math.max(0, penalty));
  }

  private calculateFairnessScore(monthlyDisputeCount: number, avgMonthlyDisputes: number): number {
    if (avgMonthlyDisputes === 0) return 50;

    // If below average, bonus points. If above, penalty.
    const ratio = monthlyDisputeCount / avgMonthlyDisputes;
    if (ratio < 0.5) return 100; // Way below average
    if (ratio < 0.8) return 80;
    if (ratio < 1.0) return 60;
    if (ratio < 1.2) return 40;
    return 20; // Overworked this month
  }

  /**
   * UNIT FUNCTION: Calculate total staff score
   */
  private calculateTotalStaffScore(
    workloadScore: number,
    performanceScore: number,
    fairnessScore: number,
  ): number {
    const weighted =
      workloadScore * (ASSIGNMENT_CONFIG.WORKLOAD_WEIGHT / 100) +
      performanceScore * (ASSIGNMENT_CONFIG.PERFORMANCE_WEIGHT / 100) +
      fairnessScore * (ASSIGNMENT_CONFIG.FAIRNESS_WEIGHT / 100);

    return Math.round(weighted * 100) / 100;
  }

  /**
   * COMPOSE FUNCTION: Get available staff with scoring
   *
   * EDGE CASE ADDRESSED: "Cherry Picking"
   * - Returns scored list for AUTO-ASSIGN (mandatory)
   * - Staff cannot reject assignments
   */
  async getAvailableStaff(date?: Date): Promise<AvailableStaffResult> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // 1. Get all active staff (not banned)
    const allStaff = await this.userRepository.find({
      where: { role: UserRole.STAFF, isBanned: false },
    });

    if (allStaff.length === 0) {
      return {
        staff: [],
        totalAvailable: 0,
        totalStaff: 0,
        shortageWarning: true,
        recommendedStaffId: null,
      };
    }

    // 2. Get workload for all staff on target date
    const workloads = await this.workloadRepository.find({
      where: {
        staffId: In(allStaff.map((s) => s.id)),
        date: dateStr as unknown as Date,
      },
    });

    const workloadMap = new Map(workloads.map((w) => [w.staffId, w]));

    // 3. Calculate average monthly disputes for fairness
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthlyStats = await this.disputeRepository
      .createQueryBuilder('d')
      .select('d.assignedStaffId', 'staffId')
      .addSelect('COUNT(*)', 'count')
      .where('d.assignedStaffId IS NOT NULL')
      .andWhere('d.createdAt >= :monthStart', { monthStart })
      .groupBy('d.assignedStaffId')
      .getRawMany();

    const monthlyMap = new Map(
      monthlyStats.map((s: { staffId: string; count: string }) => [s.staffId, parseInt(s.count)]),
    );
    const avgMonthly =
      monthlyStats.length > 0
        ? monthlyStats.reduce(
            (sum, s: { staffId: string; count: string }) => sum + parseInt(s.count),
            0,
          ) / monthlyStats.length
        : 0;

    // 4. Load performance metrics for this period
    const period = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    const performanceRows = await this.performanceRepository.find({
      where: { staffId: In(allStaff.map((staff) => staff.id)), period },
    });
    const performanceMap = new Map(performanceRows.map((row) => [row.staffId, row]));

    // 5. Score each staff
    const scoredStaff: StaffScoreBreakdown[] = [];

    for (const staff of allStaff) {
      const workload = workloadMap.get(staff.id);
      const monthlyCount = monthlyMap.get(staff.id) || 0;

      // Default workload if not exists
      const utilizationRate = workload?.utilizationRate || 0;
      const isOnLeave = workload?.isOnLeave || false;
      const canAccept = workload?.canAcceptNewEvent ?? true;

      const performance = performanceMap.get(staff.id);
      const avgUserRating = Number(performance?.avgUserRating ?? 4);
      const overturnRate = Number(performance?.overturnRate ?? 0);
      const leaveMinutes = Number(performance?.totalLeaveMinutes ?? 0);
      const leaveRequestCount = Number(performance?.leaveRequestCount ?? 0);
      const leaveOverageMinutes = Number(performance?.leaveOverageMinutes ?? 0);
      const leavePenalty = this.calculateLeavePenalty(
        leaveMinutes,
        leaveOverageMinutes,
        leaveRequestCount,
      );

      // Calculate scores
      const workloadScore = this.calculateWorkloadScore(utilizationRate);
      const performanceScore = this.calculatePerformanceScore(
        avgUserRating,
        overturnRate,
        leavePenalty,
      );
      const fairnessScore = this.calculateFairnessScore(monthlyCount, avgMonthly);
      const totalScore = this.calculateTotalStaffScore(
        workloadScore,
        performanceScore,
        fairnessScore,
      );

      // Determine availability
      let isAvailable = true;
      let unavailableReason: string | undefined;

      if (isOnLeave) {
        isAvailable = false;
        unavailableReason = 'On leave';
      } else if (utilizationRate >= ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE) {
        isAvailable = false;
        unavailableReason = `Utilization at ${utilizationRate}% (max ${ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE}%)`;
      } else if (!canAccept) {
        isAvailable = false;
        unavailableReason = 'Cannot accept new events';
      }

      scoredStaff.push({
        staffId: staff.id,
        totalScore: isAvailable ? totalScore : 0,
        workloadScore,
        performanceScore,
        fairnessScore,
        utilizationRate,
        avgUserRating,
        overturnRate,
        monthlyDisputeCount: monthlyCount,
        leaveMinutes,
        leaveRequestCount,
        leaveOverageMinutes,
        leavePenalty: Math.round(leavePenalty * 100) / 100,
        isAvailable,
        isOnLeave,
        canAcceptNewEvent: canAccept,
        unavailableReason,
      });
    }

    // 5. Sort by score (available staff first, then by score)
    scoredStaff.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return b.totalScore - a.totalScore;
    });

    const availableStaff = scoredStaff.filter((s) => s.isAvailable);
    const shortageWarning = availableStaff.length < ASSIGNMENT_CONFIG.SHORTAGE_THRESHOLD;

    if (shortageWarning) {
      this.eventEmitter.emit('staff.shortage', {
        availableCount: availableStaff.length,
        requiredCount: ASSIGNMENT_CONFIG.SHORTAGE_THRESHOLD,
        affectedDisputes: [],
      });
    }

    return {
      staff: scoredStaff,
      totalAvailable: availableStaff.length,
      totalStaff: allStaff.length,
      shortageWarning,
      recommendedStaffId: availableStaff[0]?.staffId || null,
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: BUFFER ZONE & TIMING
  // ===========================================================================

  /**
   * UNIT FUNCTION: Get buffer config for event type
   */
  private getBufferConfig(eventType: EventType, complexity?: ComplexityLevel): BufferConfig {
    const base = { ...ASSIGNMENT_CONFIG.BUFFER };

    // High/Critical complexity gets extended buffer
    if (complexity === 'HIGH' || complexity === 'CRITICAL') {
      base.standardBufferMinutes = base.extendedBufferMinutes;
    }

    return base;
  }

  /**
   * UNIT FUNCTION: Calculate remaining time in session
   */
  private calculateRemainingTime(scheduledEndTime: Date, currentTime: Date = new Date()): number {
    const diff = scheduledEndTime.getTime() - currentTime.getTime();
    return Math.floor(diff / (1000 * 60));
  }

  /**
   * UNIT FUNCTION: Calculate overtime
   */
  private calculateOvertime(
    scheduledEndTime: Date,
    bufferEndTime: Date,
    currentTime: Date = new Date(),
  ): { overtimeMinutes: number; inBuffer: boolean; pastBuffer: boolean } {
    const scheduledDiff = currentTime.getTime() - scheduledEndTime.getTime();
    const bufferDiff = currentTime.getTime() - bufferEndTime.getTime();

    return {
      overtimeMinutes: Math.max(0, Math.floor(scheduledDiff / (1000 * 60))),
      inBuffer: scheduledDiff > 0 && bufferDiff <= 0,
      pastBuffer: bufferDiff > 0,
    };
  }

  /**
   * COMPOSE FUNCTION: Check session timing status
   *
   * EDGE CASES ADDRESSED:
   * - "10-Minute Warning" before end
   * - "Overtime" handling within buffer
   * - "Critical Overrun" when buffer exceeded
   */
  async checkSessionTiming(eventId: string): Promise<SessionTimingResult> {
    const event = await this.calendarRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const now = new Date();
    const scheduledEnd = new Date(event.endTime);
    const buffer = this.getBufferConfig(event.type);
    const bufferEnd = new Date(scheduledEnd.getTime() + buffer.standardBufferMinutes * 60 * 1000);

    const remaining = this.calculateRemainingTime(scheduledEnd, now);
    const overtime = this.calculateOvertime(scheduledEnd, bufferEnd, now);

    // Check if next event is affected
    const nextEvent = await this.calendarRepository.findOne({
      where: {
        organizerId: event.organizerId,
        startTime: MoreThan(event.endTime),
        status: In([EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION]),
      },
      order: { startTime: 'ASC' },
    });

    let nextEventAffected = false;
    let nextEventDelayMinutes = 0;
    if (nextEvent && overtime.pastBuffer) {
      nextEventAffected = true;
      nextEventDelayMinutes = overtime.overtimeMinutes - buffer.standardBufferMinutes;
    }

    // Determine status and suggested action
    let status: SessionTimingStatus;
    let suggestedAction: 'CONTINUE' | 'WRAP_UP' | 'ADJOURN' | 'NOTIFY_NEXT';
    let warningMessage: string | undefined;

    if (remaining > 10) {
      status = 'ON_TIME';
      suggestedAction = 'CONTINUE';
    } else if (remaining > 0) {
      status = 'WARNING';
      suggestedAction = 'WRAP_UP';
      warningMessage = `Warning: ${remaining} minutes remaining. Please wrap up the discussion.`;
    } else if (overtime.inBuffer) {
      status = 'OVERTIME';
      suggestedAction = nextEventAffected ? 'NOTIFY_NEXT' : 'WRAP_UP';
      warningMessage = `Session has exceeded scheduled time by ${overtime.overtimeMinutes} minutes. Using buffer time.`;
    } else {
      status = 'CRITICAL_OVERRUN';
      suggestedAction = 'ADJOURN';
      warningMessage =
        `CRITICAL: Buffer time exhausted. ` +
        `Session must be adjourned to avoid affecting next appointment.`;
    }

    // Emit event if critical
    if (status === 'CRITICAL_OVERRUN' || nextEventAffected) {
      this.eventEmitter.emit('session.overtime', {
        hearingId: eventId,
        overtimeMinutes: overtime.overtimeMinutes,
        nextEventAffected,
        action: status === 'CRITICAL_OVERRUN' ? 'ADJOURN' : 'NOTIFY',
      });
    }

    return {
      status,
      scheduledEndTime: scheduledEnd,
      bufferEndTime: bufferEnd,
      remainingMinutes: Math.max(0, remaining),
      overtimeMinutes: overtime.overtimeMinutes,
      nextEventAffected,
      nextEventId: nextEvent?.id,
      nextEventDelayMinutes,
      suggestedAction,
      warningMessage,
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: IDLE CHECK
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Check if session is idle (no activity)
   *
   * EDGE CASE ADDRESSED: "Zombie Session"
   * - Staff forgets to end session
   * - System auto-warns then auto-closes
   */
  checkSessionIdle(eventId: string, lastActivityAt: Date): IdleCheckResult {
    const config = ASSIGNMENT_CONFIG.IDLE_CHECK;
    const now = new Date();
    const idleMs = now.getTime() - lastActivityAt.getTime();
    const idleMinutes = Math.floor(idleMs / (1000 * 60));

    const shouldWarn = idleMinutes >= config.warningThresholdMinutes;
    const shouldAutoClose =
      config.autoCloseEnabled &&
      idleMinutes >= config.warningThresholdMinutes + config.autoCloseDelayMinutes;

    let warningMessage: string | undefined;
    if (shouldAutoClose) {
      warningMessage =
        `Session inactive for ${idleMinutes} minutes. ` +
        `Session will be auto-closed. Click "Keep Active" to continue.`;
    } else if (shouldWarn) {
      warningMessage =
        `No activity for ${idleMinutes} minutes. ` +
        `Is the session still ongoing? Click "End Session" if finished.`;
    }

    if (shouldWarn) {
      this.eventEmitter.emit('session.idle', {
        hearingId: eventId,
        staffId: '', // Will be filled by caller
        idleMinutes,
        action: shouldAutoClose ? 'AUTO_CLOSE' : 'WARNING',
      });
    }

    return {
      isIdle: shouldWarn,
      lastActivityAt,
      idleMinutes,
      shouldWarn,
      shouldAutoClose,
      warningMessage,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: EARLY RELEASE
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Release staff early when session ends before scheduled time
   *
   * EDGE CASE ADDRESSED: "Dead Time"
   * - When session ends early, immediately free up staff
   * - Update workload to allow new assignments
   */
  async earlyReleaseStaff(
    eventId: string,
    actualEndTime: Date = new Date(),
  ): Promise<EarlyReleaseResult> {
    const event = await this.calendarRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const scheduledEnd = new Date(event.endTime);
    const releasedMinutes = Math.max(
      0,
      Math.floor((scheduledEnd.getTime() - actualEndTime.getTime()) / (1000 * 60)),
    );

    if (releasedMinutes === 0) {
      return {
        releasedMinutes: 0,
        newAvailableSlot: null,
        workloadUpdated: false,
        canAcceptNewEvent: false,
        nextPendingDisputes: 0,
      };
    }

    // Update event end time
    await this.calendarRepository.update(eventId, {
      endTime: actualEndTime,
      durationMinutes: event.durationMinutes - releasedMinutes,
    });

    // Update staff workload
    const dateStr = actualEndTime.toISOString().split('T')[0];
    const workload = await this.workloadRepository.findOne({
      where: { staffId: event.organizerId, date: dateStr as unknown as Date },
    });

    let canAcceptNewEvent = false;
    if (workload) {
      const newScheduledMinutes = Math.max(0, workload.scheduledMinutes - releasedMinutes);
      const newUtilization = (newScheduledMinutes / workload.dailyCapacityMinutes) * 100;
      canAcceptNewEvent = newUtilization < ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE;

      await this.workloadRepository.update(workload.id, {
        scheduledMinutes: newScheduledMinutes,
        utilizationRate: newUtilization,
        canAcceptNewEvent,
        isOverloaded: newUtilization >= ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD,
      });
    }

    // Find next event to calculate available slot
    const nextEvent = await this.calendarRepository.findOne({
      where: {
        organizerId: event.organizerId,
        startTime: MoreThan(actualEndTime),
        status: In([EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION]),
      },
      order: { startTime: 'ASC' },
    });

    const buffer = this.getBufferConfig(event.type);
    const slotStart = new Date(actualEndTime.getTime() + buffer.minRestMinutes * 60 * 1000);
    const slotEnd = nextEvent
      ? new Date(nextEvent.startTime)
      : new Date(actualEndTime.getTime() + releasedMinutes * 60 * 1000);

    const slotDuration = Math.floor((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60));

    // Count pending disputes that could be assigned
    const pendingDisputes = await this.disputeRepository.count({
      where: {
        assignedStaffId: IsNull(),
        status: In([
          DisputeStatus.OPEN,
          DisputeStatus.TRIAGE_PENDING,
          DisputeStatus.PREVIEW,
          DisputeStatus.PENDING_REVIEW,
          DisputeStatus.INFO_REQUESTED,
        ]),
      },
    });

    this.logger.log(
      `Early release: Staff ${event.organizerId} freed ${releasedMinutes} minutes. ` +
        `New slot: ${slotDuration} min available.`,
    );

    this.eventEmitter.emit('session.earlyRelease', {
      hearingId: eventId,
      staffId: event.organizerId,
      releasedMinutes,
    });

    return {
      releasedMinutes,
      newAvailableSlot:
        slotDuration >= ASSIGNMENT_CONFIG.MIN_GAP_FOR_FILLER
          ? {
              start: slotStart,
              end: slotEnd,
              durationMinutes: slotDuration,
              score: 50,
              scoreReasons: ['Released from early completion'],
            }
          : null,
      workloadUpdated: true,
      canAcceptNewEvent,
      nextPendingDisputes: pendingDisputes,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: FRAGMENTED TIME & FILLER TASKS
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Analyze fragmented time and suggest filler tasks
   *
   * EDGE CASE ADDRESSED: "Fragmented Time"
   * - Short gaps (<60min) shouldn't be used for hearings
   * - Instead, assign async tasks (review evidence, draft verdict, etc.)
   */
  async analyzeFragmentedTime(
    staffId: string,
    gapStart: Date,
    gapEnd: Date,
  ): Promise<FragmentedTimeResult> {
    const gapMinutes = Math.floor((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60));

    // Can we schedule a hearing?
    const canScheduleHearing = gapMinutes >= ASSIGNMENT_CONFIG.MIN_GAP_FOR_HEARING;

    if (canScheduleHearing) {
      return {
        gapMinutes,
        canScheduleHearing: true,
        suggestedFillerTasks: [],
        reason: `Gap of ${gapMinutes} minutes is sufficient for a hearing`,
      };
    }

    if (gapMinutes < ASSIGNMENT_CONFIG.MIN_GAP_FOR_FILLER) {
      return {
        gapMinutes,
        canScheduleHearing: false,
        suggestedFillerTasks: [],
        reason: `Gap of ${gapMinutes} minutes is too short for any task`,
      };
    }

    // Find filler tasks based on available time
    const suggestedTasks: FillerTask[] = [];

    // Priority 1: Review evidence for upcoming hearings (15-30 min)
    const upcomingHearings = await this.calendarRepository.find({
      where: {
        organizerId: staffId,
        type: EventType.DISPUTE_HEARING,
        startTime: MoreThan(gapEnd),
        status: EventStatus.SCHEDULED,
      },
      take: 3,
      order: { startTime: 'ASC' },
    });

    for (const hearing of upcomingHearings) {
      if (hearing.referenceId) {
        const evidenceCount = await this.evidenceRepository.count({
          where: { disputeId: hearing.referenceId },
        });

        if (evidenceCount > 0) {
          const estimatedTime = Math.min(30, evidenceCount * 5);
          if (estimatedTime <= gapMinutes) {
            suggestedTasks.push({
              type: 'REVIEW_EVIDENCE',
              title: `Review evidence for hearing at ${hearing.startTime.toLocaleTimeString()}`,
              description: `${evidenceCount} evidence items to review before the hearing`,
              estimatedMinutes: estimatedTime,
              priority: 'HIGH',
              relatedEntityType: 'Dispute',
              relatedEntityId: hearing.referenceId,
            });
          }
        }
      }
    }

    // Priority 2: Draft pending verdicts (30-45 min)
    if (gapMinutes >= 30) {
      const pendingVerdicts = await this.disputeRepository.count({
        where: {
          assignedStaffId: staffId,
          status: DisputeStatus.IN_MEDIATION, // Disputes waiting for final verdict
        },
      });

      if (pendingVerdicts > 0) {
        suggestedTasks.push({
          type: 'DRAFT_VERDICT',
          title: `Draft verdict (${pendingVerdicts} pending)`,
          description: 'Complete verdict documentation for disputes awaiting decision',
          estimatedMinutes: Math.min(45, gapMinutes),
          priority: 'HIGH',
        });
      }
    }

    // Priority 3: Check pending disputes (15-20 min)
    if (gapMinutes >= 15) {
      const pendingReview = await this.disputeRepository.count({
        where: {
          assignedStaffId: staffId,
          status: In([
            DisputeStatus.OPEN,
            DisputeStatus.TRIAGE_PENDING,
            DisputeStatus.PREVIEW,
            DisputeStatus.PENDING_REVIEW,
            DisputeStatus.INFO_REQUESTED,
          ]), // Disputes that need review
        },
      });

      if (pendingReview > 0) {
        suggestedTasks.push({
          type: 'CHECK_PENDING_DISPUTES',
          title: `Check pending disputes (${pendingReview})`,
          description: 'Review status and progress of assigned disputes',
          estimatedMinutes: 15,
          priority: 'MEDIUM',
        });
      }
    }

    // Priority 4: Documentation (any remaining time)
    if (suggestedTasks.length === 0 && gapMinutes >= 15) {
      suggestedTasks.push({
        type: 'DOCUMENTATION',
        title: 'Update documentation',
        description: 'Review and update case notes, prepare for upcoming sessions',
        estimatedMinutes: gapMinutes,
        priority: 'LOW',
      });
    }

    return {
      gapMinutes,
      canScheduleHearing: false,
      suggestedFillerTasks: suggestedTasks.slice(0, 3), // Max 3 suggestions
      reason: `Gap of ${gapMinutes} minutes - suggesting async tasks instead of hearing`,
    };
  }

  // ===========================================================================
  // EVENT-DRIVEN WORKLOAD UPDATES (Giﾃ｡ﾂｺﾂ｣i quyﾃ｡ﾂｺﾂｿt "Stale Workload" edge case)
  // ===========================================================================

  /**
   * UNIT: Increment pending disputes khi cﾃδｳ dispute mﾃ｡ﾂｻﾂ嬖 ﾃ・妥・ｰﾃ｡ﾂｻﾂ｣c assign
   *
   * Trigger: Sau khi assign dispute (cﾃ｡ﾂｺﾂ｣ auto vﾃδ manual)
   * Purpose: Realtime update thay vﾃδｬ ﾃ・妥｡ﾂｻﾂ｣i cronjob 00:00
   */
  async incrementPendingDisputes(staffId: string, disputeId: string): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];

    // Upsert workload record
    const existingWorkload = await this.workloadRepository.findOne({
      where: { staffId, date: dateStr as unknown as Date },
    });

    let newPendingCount: number;

    if (existingWorkload) {
      existingWorkload.totalDisputesPending += 1;
      // Recalculate flags
      existingWorkload.canAcceptNewEvent =
        existingWorkload.utilizationRate < ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE;
      existingWorkload.isOverloaded =
        existingWorkload.utilizationRate >= ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD;
      await this.workloadRepository.save(existingWorkload);
      newPendingCount = existingWorkload.totalDisputesPending;
    } else {
      // Create new workload record for today
      const newWorkload = this.workloadRepository.create({
        staffId,
        date: dateStr as unknown as Date,
        totalDisputesPending: 1,
        totalEventsScheduled: 0,
        scheduledMinutes: 0,
        dailyCapacityMinutes: 480,
        utilizationRate: 0,
        isOverloaded: false,
        canAcceptNewEvent: true,
        isOnLeave: false,
      });
      await this.workloadRepository.save(newWorkload);
      newPendingCount = 1;
    }

    // Emit event for tracking
    this.eventEmitter.emit('workload.incremented', {
      staffId,
      disputeId,
      newPendingCount,
    });

    this.logger.log(
      `Incremented pending disputes for staff ${staffId}: now ${newPendingCount} pending`,
    );
  }

  /**
   * UNIT: Decrement pending disputes khi dispute resolved/closed
   *
   * Trigger: Sau khi resolve hoﾃ｡ﾂｺﾂｷc close dispute
   * Purpose: Realtime update ﾃ・妥｡ﾂｻﾂ・staff cﾃδｳ thﾃ｡ﾂｻﾂ・nhﾃ｡ﾂｺﾂｭn viﾃ｡ﾂｻﾂ㌘ mﾃ｡ﾂｻﾂ嬖 ngay
   */
  async decrementPendingDisputes(staffId: string, disputeId: string): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];

    const existingWorkload = await this.workloadRepository.findOne({
      where: { staffId, date: dateStr as unknown as Date },
    });

    if (!existingWorkload) {
      this.logger.warn(
        `No workload record found for staff ${staffId} on ${dateStr}. Cannot decrement.`,
      );
      return;
    }

    // Decrement but don't go below 0
    existingWorkload.totalDisputesPending = Math.max(0, existingWorkload.totalDisputesPending - 1);

    // Recalculate flags - staff cﾃδｳ thﾃ｡ﾂｻﾂ・nhﾃ｡ﾂｺﾂｭn viﾃ｡ﾂｻﾂ㌘ mﾃ｡ﾂｻﾂ嬖 ngay
    existingWorkload.canAcceptNewEvent =
      existingWorkload.utilizationRate < ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE;
    existingWorkload.isOverloaded =
      existingWorkload.utilizationRate >= ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD;

    await this.workloadRepository.save(existingWorkload);

    // Emit event for tracking
    this.eventEmitter.emit('workload.decremented', {
      staffId,
      disputeId,
      newPendingCount: existingWorkload.totalDisputesPending,
    });

    this.logger.log(
      `Decremented pending disputes for staff ${staffId}: now ${existingWorkload.totalDisputesPending} pending`,
    );
  }

  // ===========================================================================
  // SMART SUGGESTION API (For Reassignment UI)
  // ===========================================================================

  /**
   * COMPOSE: Gﾃ｡ﾂｻﾂ｣i ﾃδｽ staff thay thﾃ｡ﾂｺﾂｿ cho dispute
   *
   * Algorithm:
   * 1. Lﾃ｡ﾂｻﾂ皇 Staff ﾃ・妥｡ﾂｻﾂｧ skill (skillMatchScore >= 50)
   * 2. Check availability tﾃ｡ﾂｺﾂ｡i scheduledTime (nﾃ｡ﾂｺﾂｿu cﾃδｳ hearing)
   * 3. Sﾃ｡ﾂｺﾂｯp xﾃ｡ﾂｺﾂｿp theo: isAvailable DESC, workload ASC, skillMatch DESC
   *
   * UI sﾃ｡ﾂｺﾂｽ hiﾃ｡ﾂｻﾂハ thﾃ｡ﾂｻﾂ・
   * - [GREEN] RECOMMENDED (ráº£nh, skill match cao)
   * - [YELLOW] AVAILABLE (báº­n vá»«a hoáº·c skill trung bÃ¬nh)
   * - [RED] CONFLICT (trÃ¹ng lá»‹ch hoáº·c quÃ¡ táº£i)
   */
  async suggestReplacementStaff(
    disputeId: string,
    scheduledTime?: Date,
  ): Promise<StaffSuggestionResult> {
    // 1. Load dispute ﾃ・妥｡ﾂｻﾂ・lﾃ｡ﾂｺﾂ･y info
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['assignedStaff'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    // 2. Get all available staff
    const availableResult = await this.getAvailableStaff();
    const allStaff = availableResult.staff;

    // 3. Get skill match scores
    const staffIds = allStaff.map((s) => s.staffId);
    const skillMatches = await this.getStaffBySkillMatch(disputeId, staffIds);
    const skillMatchMap = new Map(skillMatches.map((m) => [m.staffId, m.skillMatchScore]));

    // 4. Get staff names
    const staffUsers = await this.userRepository.find({
      where: { id: In(staffIds) },
      select: ['id', 'email'],
      relations: ['profile'],
    });
    const staffInfoMap = new Map(
      staffUsers.map((u) => [
        u.id,
        {
          // ProfileEntity uses companyName for display, fallback to email prefix
          name: u.profile?.companyName || u.email.split('@')[0],
          email: u.email,
        },
      ]),
    );

    // 5. Check calendar conflicts if scheduledTime provided
    const conflictMap = new Map<string, { eventId: string; eventTitle: string }>();
    if (scheduledTime) {
      // Find events that overlap with scheduledTime (assuming 1 hour window)
      const endTime = new Date(scheduledTime.getTime() + 60 * 60 * 1000);

      for (const staffId of staffIds) {
        const conflictingEvent = await this.calendarRepository.findOne({
          where: {
            organizerId: staffId,
            startTime: LessThan(endTime),
            endTime: MoreThan(scheduledTime),
            status: In([EventStatus.SCHEDULED, EventStatus.IN_PROGRESS]),
          },
        });

        if (conflictingEvent) {
          conflictMap.set(staffId, {
            eventId: conflictingEvent.id,
            eventTitle: conflictingEvent.title || 'Scheduled Event',
          });
        }
      }
    }

    // 6. Build suggestions
    const suggestions: StaffSuggestion[] = [];

    for (const staff of allStaff) {
      // Skip current assignee
      if (staff.staffId === dispute.assignedStaffId) continue;

      const skillScore = skillMatchMap.get(staff.staffId) || 0;
      const staffInfo = staffInfoMap.get(staff.staffId);
      const conflict = conflictMap.get(staff.staffId);
      const hasConflict = !!conflict;

      // Determine suggestion level and color
      let suggestion: SuggestionLevel;
      let displayColor: 'green' | 'yellow' | 'red';
      let reason: string;

      if (hasConflict) {
        suggestion = 'CONFLICT';
        displayColor = 'red';
        reason = `Schedule conflict with "${conflict.eventTitle}"`;
      } else if (!staff.isAvailable) {
        suggestion = 'BUSY';
        displayColor = 'red';
        reason = staff.unavailableReason || 'Not available';
      } else if (staff.utilizationRate >= 70) {
        suggestion = 'BUSY';
        displayColor = 'yellow';
        reason = `Busy (${staff.monthlyDisputeCount} cases this month)`;
      } else if (skillScore >= 70 && staff.utilizationRate < 50) {
        suggestion = 'RECOMMENDED';
        displayColor = 'green';
        reason = `Best match: Available with high skill match (${skillScore}%)`;
      } else if (skillScore >= 50) {
        suggestion = 'AVAILABLE';
        displayColor = 'green';
        reason = `Suitable: ${staff.monthlyDisputeCount} cases in progress`;
      } else {
        suggestion = 'AVAILABLE';
        displayColor = 'yellow';
        reason = `Low skill match (${skillScore}%)`;
      }

      suggestions.push({
        staffId: staff.staffId,
        staffName: staffInfo?.name || 'Unknown',
        staffEmail: staffInfo?.email,
        currentWorkload: staff.monthlyDisputeCount,
        skillMatchScore: skillScore,
        isAvailableAtTime: !hasConflict,
        conflictingEventId: conflict?.eventId,
        conflictingEventTitle: conflict?.eventTitle,
        suggestion,
        displayColor,
        reason,
        metrics: {
          utilizationRate: staff.utilizationRate,
          avgUserRating: staff.avgUserRating,
          overturnRate: staff.overturnRate,
        },
      });
    }

    // 7. Sort: Green first, then Yellow, then Red. Within each, sort by workload ASC
    suggestions.sort((a, b) => {
      const colorOrder = { green: 0, yellow: 1, red: 2 };
      if (colorOrder[a.displayColor] !== colorOrder[b.displayColor]) {
        return colorOrder[a.displayColor] - colorOrder[b.displayColor];
      }
      // Within same color, less workload = better
      return a.currentWorkload - b.currentWorkload;
    });

    const assignedStaff = dispute.assignedStaff as UserEntity | null;

    return {
      disputeId,
      currentStaffId: dispute.assignedStaffId || undefined,
      currentStaffName: assignedStaff
        ? staffInfoMap.get(assignedStaff.id)?.name || 'Unknown'
        : undefined,
      scheduledTime,
      suggestions,
      totalCandidates: suggestions.length,
      recommendedStaffId: suggestions.find((s) => s.suggestion === 'RECOMMENDED')?.staffId || null,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: AUTO-ASSIGNMENT
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Auto-assign staff to dispute
   *
   * EDGE CASE ADDRESSED: "Cherry Picking"
   * - Assignment is MANDATORY
   * - Staff cannot reject (except sick leave)
   */
  async autoAssignStaffToDispute(disputeId: string): Promise<{
    staffId: string;
    complexity: ComplexityEstimation;
    success: boolean;
    fallbackReason?: string;
  }> {
    // 1. Estimate complexity
    const complexity = await this.estimateDisputeComplexity(disputeId);

    // 2. Get available staff
    const availableResult = await this.getAvailableStaff();

    if (!availableResult.recommendedStaffId) {
      this.logger.warn(`No staff available for dispute ${disputeId}`);
      return {
        staffId: '',
        complexity,
        success: false,
        fallbackReason: 'No staff available. Dispute added to manual assignment queue.',
      };
    }

    // 3. Assign to top-scored staff
    const staffId = availableResult.recommendedStaffId;

    await this.disputeRepository.update(disputeId, {
      assignedStaffId: staffId,
      assignedAt: new Date(),
    });

    // 4. Update workload using event-driven function (realtime update)
    await this.incrementPendingDisputes(staffId, disputeId);

    // 5. Emit event
    this.eventEmitter.emit('staff.assigned', {
      disputeId,
      staffId,
      complexity: complexity.level,
      estimatedMinutes: complexity.timeEstimation.recommendedMinutes,
    });

    this.logger.log(
      `Auto-assigned dispute ${disputeId} to staff ${staffId} ` +
        `(complexity: ${complexity.level}, ~${complexity.timeEstimation.recommendedMinutes} min)`,
    );

    return {
      staffId,
      complexity,
      success: true,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: MANUAL DISPUTE REASSIGNMENT
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Manual reassign dispute to different staff
   *
   * Purpose: Admin thﾃ｡ﾂｻﾂｧ cﾃδｴng reassign dispute cho staff khﾃδ｡c
   * Use cases:
   * - Staff quﾃδ｡ tﾃ｡ﾂｺﾂ｣i, cﾃ｡ﾂｺﾂｧn rebalance
   * - Staff xin nghﾃ｡ﾂｻﾂ・dﾃδi hﾃ｡ﾂｺﾂ｡n
   * - Admin muﾃ｡ﾂｻﾂ創 gﾃδ｡n cho chuyﾃδｪn gia cﾃ｡ﾂｻﾂ･ thﾃ｡ﾂｻﾂ・
   *
   * Flow:
   * 1. Load dispute + validate old staff
   * 2. Validate new staff exists vﾃδ isActive
   * 3. Update dispute.assignedStaffId
   * 4. Decrement old staff workload
   * 5. Increment new staff workload
   * 6. Log and emit event
   */
  async reassignDispute(
    disputeId: string,
    newStaffId: string,
    reason: string,
    performedById: string,
    notes?: string,
  ): Promise<{
    success: boolean;
    oldStaffId: string | null;
    newStaffId: string;
    message: string;
  }> {
    // 1. Load dispute
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      select: ['id', 'assignedStaffId', 'status'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    // 2. Validate dispute status - khﾃδｴng reassign dispute ﾃ・妥δ｣ ﾃ・妥δｳng
    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.REJECTED) {
      throw new BadRequestException(`Cannot reassign dispute with status ${dispute.status}`);
    }
    // 3. Validate new staff exists and is active
    const newStaff = await this.userRepository.findOne({
      where: { id: newStaffId, role: UserRole.STAFF, isBanned: false },
    });

    if (!newStaff) {
      throw new BadRequestException(`Staff ${newStaffId} not found or is not active`);
    }

    // 4. Check not reassigning to same staff
    if (dispute.assignedStaffId === newStaffId) {
      return {
        success: false,
        oldStaffId: dispute.assignedStaffId,
        newStaffId,
        message: 'Dispute is already assigned to this staff',
      };
    }

    const oldStaffId = dispute.assignedStaffId;

    // 5. Update dispute assignment
    await this.disputeRepository.update(disputeId, {
      assignedStaffId: newStaffId,
      assignedAt: new Date(),
    });

    // 6. Update workloads
    if (oldStaffId) {
      await this.decrementPendingDisputes(oldStaffId, disputeId);
    }
    await this.incrementPendingDisputes(newStaffId, disputeId);

    // 7. Emit event
    this.eventEmitter.emit(DISPUTE_EVENTS.REASSIGNED, {
      disputeId,
      oldStaffId,
      newStaffId,
      reason,
      performedById,
      notes,
    });

    this.logger.log(
      `Reassigned dispute ${disputeId} from ${oldStaffId || 'unassigned'} to ${newStaffId}. Reason: ${reason}`,
    );

    return {
      success: true,
      oldStaffId,
      newStaffId,
      message: `Dispute reassigned successfully from ${oldStaffId || 'unassigned'} to ${newStaffId}`,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: EMERGENCY RE-ASSIGNMENT
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Emergency re-assignment
   *
   * EDGE CASE ADDRESSED: "Sick Leave"
   * - Staff reports sick, events need reassignment
   * - Find replacement or reschedule
   */
  async emergencyReassign(request: ReassignmentRequest): Promise<ReassignmentResult> {
    const event = await this.calendarRepository.findOne({
      where: { id: request.eventId },
      relations: ['organizer'],
    });

    if (!event) {
      return {
        success: false,
        rescheduleRequired: false,
        notificationsSent: [],
        failureReason: 'Event not found',
      };
    }

    // 1. Find replacement staff
    const availableResult = await this.getAvailableStaff(new Date(event.startTime));
    const eligibleStaff = availableResult.staff.filter(
      (s) => s.isAvailable && s.staffId !== request.originalStaffId,
    );

    // Prefer specified replacement if available
    let newStaffId: string | undefined;
    if (request.preferredReplacementId) {
      const preferred = eligibleStaff.find((s) => s.staffId === request.preferredReplacementId);
      if (preferred) {
        newStaffId = preferred.staffId;
      }
    }

    // Otherwise take top scorer
    if (!newStaffId && eligibleStaff.length > 0) {
      newStaffId = eligibleStaff[0].staffId;
    }

    const notificationsSent: string[] = [];

    if (newStaffId) {
      // Reassign to new staff
      await this.calendarRepository.update(event.id, {
        organizerId: newStaffId,
      });

      // Update dispute if linked
      if (event.referenceType === 'Dispute' && event.referenceId) {
        await this.disputeRepository.update(event.referenceId, {
          assignedStaffId: newStaffId,
        });
      }

      // Update workloads
      const dateStr = event.startTime.toISOString().split('T')[0];
      await this.workloadRepository.decrement(
        { staffId: request.originalStaffId, date: dateStr as unknown as Date },
        'totalEventsScheduled',
        1,
      );
      await this.workloadRepository.increment(
        { staffId: newStaffId, date: dateStr as unknown as Date },
        'totalEventsScheduled',
        1,
      );

      // Emit event
      this.eventEmitter.emit('staff.reassigned', {
        disputeId: event.referenceId,
        oldStaffId: request.originalStaffId,
        newStaffId,
        reason: request.reason,
      });

      notificationsSent.push(`New staff ${newStaffId} notified`);
      notificationsSent.push('Participants notified of staff change');

      this.logger.log(
        `Emergency reassigned event ${event.id} from ${request.originalStaffId} to ${newStaffId}`,
      );

      return {
        success: true,
        newStaffId,
        rescheduleRequired: false,
        notificationsSent,
      };
    } else {
      // No replacement available - need to reschedule
      this.logger.warn(`No replacement staff for event ${event.id}. Reschedule required.`);

      notificationsSent.push('Participants notified: session will be rescheduled');

      return {
        success: false,
        rescheduleRequired: true,
        notificationsSent,
        failureReason: 'No replacement staff available. Event needs rescheduling.',
      };
    }
  }

  // ===========================================================================
  // PENDING APPEAL HANDLING (Giﾃ｡ﾂｺﾂ｣i quyﾃ｡ﾂｺﾂｿt "Khﾃδ｡ng Cﾃδ｡o Treo" edge case)
  // ===========================================================================

  /**
   * UNIT FUNCTION: Get only finalized cases for performance calculation
   *
   * Finalized cases are:
   * - Status = RESOLVED (khﾃδｴng cﾃδｲn IN_APPEAL)
   * - Status = REJECTED hoﾃ｡ﾂｺﾂｷc CLOSED
   * - Appeal deadline ﾃ・妥δ｣ qua (nﾃ｡ﾂｺﾂｿu cﾃδｳ)
   *
   * Exclude:
   * - Cases ﾃ・疎ng IN_APPEAL (chﾃ・ｰa cﾃδｳ kﾃ｡ﾂｺﾂｿt quﾃ｡ﾂｺﾂ｣ cuﾃ｡ﾂｻﾂ訴 cﾃδｹng tﾃ｡ﾂｻﾂｫ Admin)
   */
  async getFinalizedCasesForPeriod(
    staffId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<DisputeEntity[]> {
    return this.disputeRepository.find({
      where: [
        // Cases ﾃ・妥δ｣ resolved vﾃδ khﾃδｴng bﾃ｡ﾂｻﾂ・appeal
        {
          assignedStaffId: staffId,
          resolvedAt: Between(periodStart, periodEnd),
          status: DisputeStatus.RESOLVED,
          isAppealed: false,
        },
        // Cases bﾃ｡ﾂｻﾂ・appeal nhﾃ・ｰng Admin ﾃ・妥δ｣ xﾃ｡ﾂｻﾂｭ xong (khﾃδｴng cﾃδｲn IN_APPEAL)
        {
          assignedStaffId: staffId,
          resolvedAt: Between(periodStart, periodEnd),
          status: DisputeStatus.RESOLVED,
          isAppealed: true,
          // appealResolvedAt is not null means appeal was handled
        },
      ],
    });
  }

  /**
   * COMPOSE FUNCTION: Update staff performance vﾃ｡ﾂｻﾂ嬖 pending appeal exclusion
   *
   * EDGE CASE ADDRESSED: "Khﾃδ｡ng Cﾃδ｡o Treo"
   * - Chﾃ｡ﾂｻﾂ・tﾃδｭnh ﾃ・訴ﾃ｡ﾂｻﾂノ cho cases ﾃ・妥δ｣ FINALIZED
   * - Cases ﾃ・疎ng IN_APPEAL sﾃ｡ﾂｺﾂｽ ﾃ・妥・ｰﾃ｡ﾂｻﾂ｣c track riﾃδｪng
   * - Khﾃδｴng tﾃδｭnh vﾃδo overturnRate cho ﾃ・妥｡ﾂｺﾂｿn khi Admin xﾃ｡ﾂｻﾂｭ xong
   */
  async updateStaffPerformanceWithAppealExclusion(
    staffId: string,
    period: string, // Format: YYYY-MM
  ): Promise<void> {
    // Parse period to get date range
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59); // Last day of month

    // Get finalized cases only (exclude IN_APPEAL)
    const finalizedCases = await this.getFinalizedCasesForPeriod(staffId, periodStart, periodEnd);

    // Count pending appeal cases (status = APPEALED, chﾃ・ｰa cﾃδｳ appealResolvedAt)
    const pendingAppealCases = await this.disputeRepository.count({
      where: {
        assignedStaffId: staffId,
        resolvedAt: Between(periodStart, periodEnd),
        status: DisputeStatus.APPEALED, // Use APPEALED instead of IN_APPEAL
      },
    });

    // Calculate metrics from FINALIZED cases only
    const totalFinalized = finalizedCases.length;
    const totalAppealed = finalizedCases.filter((c) => c.isAppealed).length;
    // Overturned = appeal was resolved by admin (appealResolvedById not null)
    // and admin changed the original decision
    const totalOverturned = finalizedCases.filter(
      (c) => c.isAppealed && c.appealResolvedById != null,
    ).length;

    // Calculate rates
    const appealRate = totalFinalized > 0 ? (totalAppealed / totalFinalized) * 100 : 0;
    const overturnRate = totalAppealed > 0 ? (totalOverturned / totalAppealed) * 100 : 0;

    // Calculate average resolution time
    let avgResolutionHours = 0;
    if (finalizedCases.length > 0) {
      const totalHours = finalizedCases.reduce((sum, c) => {
        if (c.resolvedAt && c.createdAt) {
          return sum + (c.resolvedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgResolutionHours = totalHours / finalizedCases.length;
    }

    this.logger.log(
      `[StaffPerformance] Staff ${staffId} Period ${period}: ` +
        `${totalFinalized} finalized, ${pendingAppealCases} pending appeal, ` +
        `Overturn rate: ${overturnRate.toFixed(2)}%`,
    );

    // Count total assigned in this period (including not yet resolved)
    const totalAssigned = await this.disputeRepository.count({
      where: {
        assignedStaffId: staffId,
        assignedAt: Between(periodStart, periodEnd),
      },
    });

    // Count pending disputes (not yet resolved)
    const totalPending = await this.disputeRepository.count({
      where: {
        assignedStaffId: staffId,
        assignedAt: Between(periodStart, periodEnd),
        resolvedAt: IsNull(),
      },
    });

    const leaveMetrics = await this.leaveService.getLeaveMetricsForPeriod(staffId, period);

    // Upsert into staff_performances table
    await this.performanceRepository.upsert(
      {
        staffId,
        period,
        totalDisputesAssigned: totalAssigned,
        totalDisputesResolved: totalFinalized,
        totalDisputesPending: totalPending,
        totalAppealed,
        totalOverturnedByAdmin: totalOverturned,
        appealRate: Math.round(appealRate * 100) / 100,
        overturnRate: Math.round(overturnRate * 100) / 100,
        avgResolutionTimeHours: Math.round(avgResolutionHours * 100) / 100,
        pendingAppealCases,
        totalCasesFinalized: totalFinalized,
        totalLeaveMinutes: leaveMetrics.totalLeaveMinutes,
        leaveRequestCount: leaveMetrics.leaveRequestCount,
        leaveOverageMinutes: leaveMetrics.leaveOverageMinutes,
      },
      ['staffId', 'period'],
    );

    // Also emit event for other listeners (notifications, dashboards, etc.)
    this.eventEmitter.emit('staff.performanceUpdated', {
      staffId,
      period,
      totalCasesFinalized: totalFinalized,
      pendingAppealCases,
      appealRate: Math.round(appealRate * 100) / 100,
      overturnRate: Math.round(overturnRate * 100) / 100,
      avgResolutionTimeHours: Math.round(avgResolutionHours * 100) / 100,
      totalLeaveMinutes: leaveMetrics.totalLeaveMinutes,
      leaveRequestCount: leaveMetrics.leaveRequestCount,
      leaveOverageMinutes: leaveMetrics.leaveOverageMinutes,
    });

    this.logger.log(
      `[StaffPerformance] Upserted performance for staff ${staffId} period ${period}`,
    );
  }

  // ===========================================================================
  // SCHEDULED TASKS (Call these via external scheduler or TaskScheduler)
  // ===========================================================================

  /**
   * SCHEDULED TASK: Update daily workload at midnight
   * NOTE: Call this from an external scheduler (e.g., cron job, TaskSchedulerModule)
   */
  async updateDailyWorkloads(): Promise<void> {
    this.logger.log('Running daily workload update...');

    const allStaff = await this.userRepository.find({
      where: { role: UserRole.STAFF, isBanned: false },
    });

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    for (const staff of allStaff) {
      // Count events scheduled for today
      const events = await this.calendarRepository.find({
        where: {
          organizerId: staff.id,
          startTime: Between(new Date(dateStr + 'T00:00:00'), new Date(dateStr + 'T23:59:59')),
          status: In([EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION]),
        },
      });

      const scheduledMinutes = events.reduce((sum, e) => sum + e.durationMinutes, 0);
      const dailyCapacity = 480; // 8 hours default
      const utilizationRate = (scheduledMinutes / dailyCapacity) * 100;

      await this.workloadRepository.upsert(
        {
          staffId: staff.id,
          date: dateStr as unknown as Date,
          totalEventsScheduled: events.length,
          scheduledMinutes,
          dailyCapacityMinutes: dailyCapacity,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          isOverloaded: utilizationRate >= ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD,
          canAcceptNewEvent: utilizationRate < ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE,
        },
        ['staffId', 'date'],
      );
    }

    this.logger.log(`Updated workload for ${allStaff.length} staff members`);
  }

  /**
   * SCHEDULED TASK: Check for idle sessions every 5 minutes
   * NOTE: Call this from an external scheduler (e.g., cron job, TaskSchedulerModule)
   */
  async checkIdleSessions(): Promise<void> {
    const activeSessions = await this.calendarRepository.find({
      where: {
        status: EventStatus.IN_PROGRESS,
        type: EventType.DISPUTE_HEARING,
      },
    });

    for (const session of activeSessions) {
      // In real implementation, get last activity from message table
      // For now, use a placeholder
      const lastActivity = session.updatedAt || session.startTime;
      const idleResult = this.checkSessionIdle(session.id, lastActivity);

      if (idleResult.shouldAutoClose) {
        this.logger.warn(`Auto-closing idle session ${session.id}`);
        // Trigger session end
        this.eventEmitter.emit('hearing.autoClose', {
          hearingId: session.id,
          reason: 'Inactivity timeout',
        });
      }
    }
  }

  // ===========================================================================
  // EVENT LISTENERS (Giﾃ｡ﾂｺﾂ｣i quyﾃ｡ﾂｺﾂｿt "Stale Workload" bﾃ｡ﾂｺﾂｱng Event-Driven)
  // ===========================================================================

  /**
   * EVENT LISTENER: Khi dispute ﾃ・妥・ｰﾃ｡ﾂｻﾂ｣c resolve, tﾃ｡ﾂｻﾂｱ ﾃ・妥｡ﾂｻﾂ冢g giﾃ｡ﾂｺﾂ｣m workload cﾃ｡ﾂｻﾂｧa staff
   */
  @OnEvent(DISPUTE_EVENTS.RESOLVED)
  async handleDisputeResolved(payload: { disputeId: string; adminId?: string }): Promise<void> {
    this.logger.log(`[Event] ${DISPUTE_EVENTS.RESOLVED}: ${payload.disputeId}`);

    try {
      // Get dispute ﾃ・妥｡ﾂｻﾂ・lﾃ｡ﾂｺﾂ･y assignedStaffId
      const dispute = await this.disputeRepository.findOne({
        where: { id: payload.disputeId },
        select: ['id', 'assignedStaffId'],
      });

      if (dispute?.assignedStaffId) {
        await this.decrementPendingDisputes(dispute.assignedStaffId, payload.disputeId);
        this.logger.log(
          `[Event] Workload decremented for staff ${dispute.assignedStaffId} after resolve`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Event] Failed to handle DISPUTE_RESOLVED for ${payload.disputeId}: ${error}`,
      );
    }
  }

  /**
   * EVENT LISTENER: Khi dispute bﾃ｡ﾂｻﾂ・ﾃ・妥δｳng (closed), tﾃ｡ﾂｻﾂｱ ﾃ・妥｡ﾂｻﾂ冢g giﾃ｡ﾂｺﾂ｣m workload
   */
  @OnEvent(DISPUTE_EVENTS.CLOSED)
  async handleDisputeClosed(payload: { disputeId: string; reason?: string }): Promise<void> {
    this.logger.log(`[Event] ${DISPUTE_EVENTS.CLOSED}: ${payload.disputeId}`);

    try {
      const dispute = await this.disputeRepository.findOne({
        where: { id: payload.disputeId },
        select: ['id', 'assignedStaffId'],
      });

      if (dispute?.assignedStaffId) {
        await this.decrementPendingDisputes(dispute.assignedStaffId, payload.disputeId);
        this.logger.log(
          `[Event] Workload decremented for staff ${dispute.assignedStaffId} after close`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Event] Failed to handle DISPUTE_CLOSED for ${payload.disputeId}: ${error}`,
      );
    }
  }
}
