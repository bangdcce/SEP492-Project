import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, Like, Not, Repository } from 'typeorm';
import {
  AuditLogEntity,
  DisputeEntity,
  DisputePriority,
  DisputeStatus,
  DisputeHearingEntity,
  HearingStatus,
  EscrowEntity,
  EscrowStatus,
  NotificationEntity,
  ProjectEntity,
  ProjectStatus,
  StaffPerformanceEntity,
  StaffWorkloadEntity,
  UserEntity,
  UserRole,
} from '../../database/entities';
import { ASSIGNMENT_CONFIG } from '../disputes/services/staff-assignment.service';

type DashboardRange = '7d' | '30d' | '90d';
type AdminActionFamily = 'exports' | 'approvals' | 'userModeration' | 'reviewAudit' | 'other';
type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'SEVERE';

const COMPLETED_PROJECT_STATUSES = [ProjectStatus.COMPLETED, ProjectStatus.PAID];
const CLOSED_DISPUTE_STATUSES = [
  DisputeStatus.RESOLVED,
  DisputeStatus.REJECTED,
  DisputeStatus.CANCELED,
] as const;
const ALERT_SEVERITY_ORDER: Record<AlertSeverity, number> = {
  SEVERE: 5,
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
const ADMIN_RISK_CONFIG = {
  appealBacklogHigh: 3,
  overturnRateHighPercent: 20,
  overdueDisputeHigh: 1,
  autoCloseIncidentHigh: 1,
  followUpSchedulingFailureHigh: 1,
  auditHighRiskBurst: 3,
} as const;

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepository: Repository<DisputeHearingEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(StaffPerformanceEntity)
    private readonly performanceRepository: Repository<StaffPerformanceEntity>,
    @InjectRepository(StaffWorkloadEntity)
    private readonly workloadRepository: Repository<StaffWorkloadEntity>,
  ) {}

  async getOverview(range: DashboardRange = '30d') {
    const now = new Date();
    const { currentStart, previousStart, previousEnd } = this.getRangeWindow(range, now);
    const currentPeriods = this.getPeriodsForRange(currentStart, now);

    const [
      currentRevenue,
      previousRevenue,
      currentNewUsers,
      previousNewUsers,
      currentCompletedProjects,
      previousCompletedProjects,
      currentActiveAdmins,
      previousActiveAdmins,
      previousActiveStaff,
      adminUsers,
      staffUsers,
      revenueRows,
      userRows,
      projectRows,
      adminLogs,
      performanceRows,
      workloadRows,
      overdueCriticalDisputes,
      activeAppealsBacklog,
      autoClosedHearings,
      followUpSchedulingFailures,
      followUpManualRequired,
    ] = await Promise.all([
      this.sumRevenueBetween(currentStart, now),
      this.sumRevenueBetween(previousStart, previousEnd),
      this.countUsersBetween(currentStart, now),
      this.countUsersBetween(previousStart, previousEnd),
      this.countCompletedProjectsBetween(currentStart, now),
      this.countCompletedProjectsBetween(previousStart, previousEnd),
      this.countDistinctAdminActorsBetween(currentStart, now),
      this.countDistinctAdminActorsBetween(previousStart, previousEnd),
      this.countDistinctStaffWorkloadBetween(previousStart, previousEnd),
      this.userRepository.find({
        where: { role: UserRole.ADMIN },
        select: ['id', 'fullName', 'email', 'createdAt', 'updatedAt'],
      }),
      this.userRepository.find({
        where: { role: UserRole.STAFF },
        select: ['id', 'fullName', 'email', 'createdAt', 'updatedAt'],
      }),
      this.escrowRepository.find({
        where: {
          status: EscrowStatus.RELEASED,
          releasedAt: Between(currentStart, now),
        },
        select: ['id', 'releasedAt', 'platformFee', 'currency'],
      }),
      this.userRepository.find({
        where: {
          createdAt: Between(currentStart, now),
        },
        select: ['id', 'createdAt'],
      }),
      this.projectRepository.find({
        where: {
          status: In(COMPLETED_PROJECT_STATUSES),
          updatedAt: Between(currentStart, now),
        },
        select: ['id', 'updatedAt'],
      }),
      this.auditLogRepository
        .createQueryBuilder('log')
        .leftJoinAndSelect('log.actor', 'actor')
        .where('log.createdAt BETWEEN :start AND :end', { start: currentStart, end: now })
        .andWhere('actor.role = :role', { role: UserRole.ADMIN })
        .andWhere('(log.source IS NULL OR log.source = :source)', { source: 'SERVER' })
        .orderBy('log.createdAt', 'DESC')
        .getMany(),
      currentPeriods.length
        ? this.performanceRepository.find({
            where: { period: In(currentPeriods) },
          })
        : Promise.resolve([]),
      this.workloadRepository.find({
        where: {
          date: Between(currentStart, now),
        },
      }),
      this.disputeRepository.count({
        where: {
          status: Not(In([...CLOSED_DISPUTE_STATUSES])),
          resolutionDeadline: LessThanOrEqual(now),
          priority: In([DisputePriority.HIGH, DisputePriority.CRITICAL]),
        },
      }),
      this.disputeRepository.count({
        where: {
          status: DisputeStatus.APPEALED,
        },
      }),
      this.hearingRepository.count({
        where: {
          status: HearingStatus.COMPLETED,
          endedAt: Between(currentStart, now),
          summary: Like('System auto-close:%'),
        },
      }),
      this.notificationRepository.count({
        where: {
          createdAt: Between(currentStart, now),
          title: 'Follow-up hearing scheduling failed',
        },
      }),
      this.notificationRepository.count({
        where: {
          createdAt: Between(currentStart, now),
          title: 'Follow-up hearing needs manual scheduling',
        },
      }),
    ]);

    const adminTeam = this.buildAdminTeam(adminUsers, adminLogs);
    const staffTeam = this.buildStaffTeam(staffUsers, performanceRows, workloadRows);
    const currentActiveStaff = staffTeam.members.filter((member) => member.isActive).length;
    const criticalAlerts = this.buildCriticalAlerts({
      adminLogs,
      staffTeam,
      performanceRows,
      overdueCriticalDisputes,
      activeAppealsBacklog,
      autoClosedHearings,
      followUpSchedulingFailures,
      followUpManualRequired,
    });
    const riskMethodology = this.buildRiskMethodology(criticalAlerts);

    return {
      generatedAt: now.toISOString(),
      range,
      summary: {
        revenue: this.buildMetricSummary(currentRevenue, previousRevenue, 'USD'),
        newUsers: this.buildMetricSummary(currentNewUsers, previousNewUsers),
        completedProjects: this.buildMetricSummary(
          currentCompletedProjects,
          previousCompletedProjects,
        ),
        activeAdmins: this.buildMetricSummary(currentActiveAdmins, previousActiveAdmins),
        activeStaff: this.buildMetricSummary(currentActiveStaff, previousActiveStaff),
      },
      series: this.buildSeries(range, currentStart, now, revenueRows, userRows, projectRows),
      adminTeam,
      staffTeam,
      riskHighlights: {
        highRiskAdminActions: adminLogs
          .filter((log) => this.getAuditRiskLevel(log) === 'HIGH')
          .slice(0, 5)
          .map((log) => ({
            id: log.id,
            actorName: log.actor?.fullName || 'Unknown User',
            action: log.action,
            eventName: log.eventName || log.action,
            timestamp: log.createdAt.toISOString(),
            requestId: log.requestId,
            entity: `${log.entityType}#${log.entityId}`,
            riskLevel: this.getAuditRiskLevel(log),
          })),
        overloadedStaff: staffTeam.members
          .filter((member) => member.isOverloaded)
          .sort((left, right) => right.currentUtilizationRate - left.currentUtilizationRate)
          .slice(0, 5)
          .map((member) => ({
            id: member.id,
            name: member.name,
            utilizationRate: member.currentUtilizationRate,
            pendingCases: member.pendingCases,
          })),
        backlogPressure: {
          pendingCases: staffTeam.members.reduce((sum, member) => sum + member.pendingCases, 0),
          overloadedCount: staffTeam.members.filter((member) => member.isOverloaded).length,
        },
      },
      criticalAlerts,
      riskMethodology,
    };
  }

  private async sumRevenueBetween(start: Date, end: Date): Promise<number> {
    const result = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('COALESCE(SUM(escrow.platformFee), 0)', 'value')
      .where('escrow.status = :status', { status: EscrowStatus.RELEASED })
      .andWhere('escrow.releasedAt BETWEEN :start AND :end', { start, end })
      .getRawOne<{ value: string }>();

    return Number(result?.value || 0);
  }

  private async countUsersBetween(start: Date, end: Date): Promise<number> {
    return this.userRepository.count({
      where: {
        createdAt: Between(start, end),
      },
    });
  }

  private async countCompletedProjectsBetween(start: Date, end: Date): Promise<number> {
    return this.projectRepository.count({
      where: {
        status: In(COMPLETED_PROJECT_STATUSES),
        updatedAt: Between(start, end),
      },
    });
  }

  private async countDistinctAdminActorsBetween(start: Date, end: Date): Promise<number> {
    const result = await this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoin('log.actor', 'actor')
      .select('COUNT(DISTINCT log.actorId)', 'value')
      .where('log.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere('actor.role = :role', { role: UserRole.ADMIN })
      .andWhere('(log.source IS NULL OR log.source = :source)', { source: 'SERVER' })
      .getRawOne<{ value: string }>();

    return Number(result?.value || 0);
  }

  private async countDistinctStaffWorkloadBetween(start: Date, end: Date): Promise<number> {
    const result = await this.workloadRepository
      .createQueryBuilder('workload')
      .select('COUNT(DISTINCT workload.staffId)', 'value')
      .where('workload.date BETWEEN :start AND :end', { start, end })
      .getRawOne<{ value: string }>();

    return Number(result?.value || 0);
  }

  private getRangeDays(range: DashboardRange) {
    switch (range) {
      case '7d':
        return 7;
      case '90d':
        return 90;
      default:
        return 30;
    }
  }

  private getRangeWindow(range: DashboardRange, end: Date) {
    const days = this.getRangeDays(range);
    const currentStart = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    return {
      currentStart: this.startOfDay(currentStart),
      previousStart: this.startOfDay(previousStart),
      previousEnd: this.endOfDay(previousEnd),
    };
  }

  private getPeriodsForRange(start: Date, end: Date): string[] {
    const periods: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endCursor) {
      periods.push(`${cursor.getFullYear()}-${`${cursor.getMonth() + 1}`.padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return periods;
  }

  private buildMetricSummary(current: number, previous: number, currency?: string) {
    const delta =
      previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 10000) / 100;

    return {
      value: Math.round(current * 100) / 100,
      previous: Math.round(previous * 100) / 100,
      delta,
      currency: currency || null,
    };
  }

  private buildSeries(
    range: DashboardRange,
    start: Date,
    end: Date,
    revenueRows: EscrowEntity[],
    userRows: Pick<UserEntity, 'id' | 'createdAt'>[],
    projectRows: Pick<ProjectEntity, 'id' | 'updatedAt'>[],
  ) {
    const buckets = this.createBuckets(range, start, end);

    revenueRows.forEach((row) => {
      const bucket = this.findBucketForDate(buckets, row.releasedAt);
      if (bucket) {
        bucket.revenue += Number(row.platformFee || 0);
      }
    });

    userRows.forEach((row) => {
      const bucket = this.findBucketForDate(buckets, row.createdAt);
      if (bucket) {
        bucket.newUsers += 1;
      }
    });

    projectRows.forEach((row) => {
      const bucket = this.findBucketForDate(buckets, row.updatedAt);
      if (bucket) {
        bucket.completedProjects += 1;
      }
    });

    return buckets.map((bucket) => ({
      label: bucket.label,
      revenue: Math.round(bucket.revenue * 100) / 100,
      newUsers: bucket.newUsers,
      completedProjects: bucket.completedProjects,
    }));
  }

  private buildAdminTeam(adminUsers: UserEntity[], adminLogs: AuditLogEntity[]) {
    const logMap = new Map<string, AuditLogEntity[]>();

    (adminLogs ?? []).forEach((log) => {
      const actorId = log.actorId;
      const current = logMap.get(actorId) || [];
      current.push(log);
      logMap.set(actorId, current);
    });

    const members = (adminUsers ?? []).map((admin) => {
      const logs = logMap.get(admin.id) || [];
      const families = {
        exports: 0,
        approvals: 0,
        userModeration: 0,
        reviewAudit: 0,
        other: 0,
      };
      let highRiskActions = 0;
      let lastActiveAt: string | null = null;

      logs.forEach((log) => {
        const family = this.classifyAdminAction(log);
        families[family] += 1;
        if (this.getAuditRiskLevel(log) === 'HIGH') {
          highRiskActions += 1;
        }
        if (!lastActiveAt || log.createdAt.toISOString() > lastActiveAt) {
          lastActiveAt = log.createdAt.toISOString();
        }
      });

      const totalActions = logs.length;

      return {
        id: admin.id,
        name: admin.fullName,
        email: admin.email,
        totalActions,
        highRiskActions,
        ...families,
        lastActiveAt,
        isActive: totalActions > 0,
        score:
          families.exports +
          families.approvals * 1.4 +
          families.userModeration * 1.8 +
          families.reviewAudit * 1.2 +
          highRiskActions * 0.25,
      };
    });

    const aggregate = members.reduce(
      (summary, member) => {
        summary.totalActions += member.totalActions;
        summary.highRiskActions += member.highRiskActions;
        summary.exports += member.exports;
        summary.approvals += member.approvals;
        summary.userModeration += member.userModeration;
        summary.reviewAudit += member.reviewAudit;
        summary.other += member.other;
        return summary;
      },
      {
        totalActions: 0,
        highRiskActions: 0,
        exports: 0,
        approvals: 0,
        userModeration: 0,
        reviewAudit: 0,
        other: 0,
      },
    );

    return {
      totalMembers: adminUsers.length,
      activeMembers: members.filter((member) => member.isActive).length,
      aggregate,
      members: members.sort((left, right) => right.score - left.score),
    };
  }

  private buildStaffTeam(
    staffUsers: UserEntity[],
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

    const members = (staffUsers ?? []).map((staff) => {
      const performances = performanceMap.get(staff.id) || [];
      const workloads = (workloadMap.get(staff.id) || []).sort(
        (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
      );
      const latestWorkload = workloads[workloads.length - 1];
      const totalResolved = performances.reduce((sum, row) => sum + Number(row.totalDisputesResolved || 0), 0);
      const totalAppealed = performances.reduce((sum, row) => sum + Number(row.totalAppealed || 0), 0);
      const totalOverturned = performances.reduce(
        (sum, row) => sum + Number(row.totalOverturnedByAdmin || 0),
        0,
      );
      const totalFinalized = performances.reduce((sum, row) => sum + Number(row.totalCasesFinalized || 0), 0);
      const totalHearings = performances.reduce(
        (sum, row) => sum + Number(row.totalHearingsConducted || 0),
        0,
      );
      const totalLeaveMinutes = performances.reduce(
        (sum, row) => sum + Number(row.totalLeaveMinutes || 0),
        0,
      );
      const avgUtilization =
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
        totalResolved > 0
          ? Math.round(
              (performances.reduce(
                (sum, row) =>
                  sum + Number(row.avgResolutionTimeHours || 0) * Number(row.totalDisputesResolved || 0),
                0,
              ) /
                totalResolved) *
                100,
            ) / 100
          : 0;
      const appealRate = totalFinalized > 0 ? Math.round((totalAppealed / totalFinalized) * 10000) / 100 : 0;
      const overturnRate = totalAppealed > 0 ? Math.round((totalOverturned / totalAppealed) * 10000) / 100 : 0;
      const lastPerformance = performances[performances.length - 1];
      const lastActiveAt =
        latestWorkload?.updatedAt?.toISOString() || lastPerformance?.updatedAt?.toISOString() || null;

      return {
        id: staff.id,
        name: staff.fullName,
        email: staff.email,
        resolvedCases: totalResolved,
        pendingCases,
        utilizationRate: avgUtilization,
        currentUtilizationRate,
        appealRate,
        overturnRate,
        avgResolutionTimeHours,
        hearingsConducted: totalHearings,
        leaveMinutes: totalLeaveMinutes,
        isOverloaded: Boolean(latestWorkload?.isOverloaded),
        isActive: Boolean(lastActiveAt || totalResolved || pendingCases || totalHearings),
        lastActiveAt,
        score:
          totalResolved * 1.5 +
          totalHearings * 0.75 -
          appealRate * 0.4 -
          overturnRate * 0.5 -
          Math.max(currentUtilizationRate - 85, 0),
      };
    });

    const divisor = (staffUsers ?? []).length || 1;
    const averages = {
      resolvedCases: Math.round((members.reduce((sum, member) => sum + member.resolvedCases, 0) / divisor) * 100) / 100,
      pendingCases: Math.round((members.reduce((sum, member) => sum + member.pendingCases, 0) / divisor) * 100) / 100,
      utilizationRate:
        Math.round((members.reduce((sum, member) => sum + member.utilizationRate, 0) / divisor) * 100) / 100,
      appealRate: Math.round((members.reduce((sum, member) => sum + member.appealRate, 0) / divisor) * 100) / 100,
      overturnRate:
        Math.round((members.reduce((sum, member) => sum + member.overturnRate, 0) / divisor) * 100) / 100,
      avgResolutionTimeHours:
        Math.round(
          (members.reduce((sum, member) => sum + member.avgResolutionTimeHours, 0) / divisor) * 100,
        ) / 100,
      hearingsConducted:
        Math.round((members.reduce((sum, member) => sum + member.hearingsConducted, 0) / divisor) * 100) / 100,
      leaveMinutes:
        Math.round((members.reduce((sum, member) => sum + member.leaveMinutes, 0) / divisor) * 100) / 100,
    };

    return {
      totalMembers: (staffUsers ?? []).length,
      activeMembers: members.filter((member) => member.isActive).length,
      averages,
      members: members.sort((left, right) => right.score - left.score),
    };
  }

  private classifyAdminAction(log: AuditLogEntity): AdminActionFamily {
    const action = log.action.toUpperCase();
    const entityType = log.entityType.toUpperCase();
    const eventName = (log.eventName || '').toUpperCase();

    if (action.includes('EXPORT') || eventName.includes('EXPORT')) {
      return 'exports';
    }

    if (action.includes('APPROVE') || action.includes('REJECT')) {
      return 'approvals';
    }

    if (
      action.includes('BAN') ||
      action.includes('UNBAN') ||
      action.includes('RESET_PASSWORD') ||
      action.includes('CHANGE_ROLE') ||
      entityType === 'USER'
    ) {
      return 'userModeration';
    }

    if (entityType.includes('REVIEW') || entityType.includes('SPEC') || entityType.includes('KYC')) {
      return 'reviewAudit';
    }

    return 'other';
  }

  private getAuditRiskLevel(log: AuditLogEntity) {
    const afterData = log.afterData as Record<string, unknown> | undefined;
    const security = afterData?._security_analysis as { riskLevel?: string } | undefined;
    return security?.riskLevel || 'NORMAL';
  }

  private buildCriticalAlerts(input: {
    adminLogs: AuditLogEntity[];
    staffTeam: ReturnType<AdminDashboardService['buildStaffTeam']>;
    performanceRows: StaffPerformanceEntity[];
    overdueCriticalDisputes: number;
    activeAppealsBacklog: number;
    autoClosedHearings: number;
    followUpSchedulingFailures: number;
    followUpManualRequired: number;
  }) {
    const alerts: Array<{
      severity: AlertSeverity;
      source: string;
      title: string;
      summary: string;
      metricValue: number;
      thresholdLabel: string;
      actionUrl: string;
      reason: string;
    }> = [];

    const highRiskAdminActions = input.adminLogs.filter((log) =>
      ['HIGH', 'CRITICAL', 'SEVERE'].includes(this.getAuditRiskLevel(log).toUpperCase()),
    ).length;
    const overloadedCount = input.staffTeam.members.filter((member) => member.isOverloaded).length;
    const backlogPendingCases = input.staffTeam.members.reduce(
      (sum, member) => sum + member.pendingCases,
      0,
    );
    const totalAppealed = input.performanceRows.reduce(
      (sum, row) => sum + Number(row.totalAppealed || 0),
      0,
    );
    const totalOverturned = input.performanceRows.reduce(
      (sum, row) => sum + Number(row.totalOverturnedByAdmin || 0),
      0,
    );
    const overturnRate =
      totalAppealed > 0 ? Math.round((totalOverturned / totalAppealed) * 10000) / 100 : 0;

    if (input.overdueCriticalDisputes >= ADMIN_RISK_CONFIG.overdueDisputeHigh) {
      alerts.push({
        severity: input.overdueCriticalDisputes >= 3 ? 'SEVERE' : 'CRITICAL',
        source: 'DISPUTE_SLA',
        title: 'Urgent disputes are overdue',
        summary: `${input.overdueCriticalDisputes} high-priority dispute(s) passed their resolution deadline.`,
        metricValue: input.overdueCriticalDisputes,
        thresholdLabel: `>= ${ADMIN_RISK_CONFIG.overdueDisputeHigh} overdue high/critical disputes`,
        actionUrl: '/staff/caseload',
        reason:
          'High and critical disputes past SLA indicate escalation risk and require immediate staffing attention.',
      });
    }

    if (input.autoClosedHearings >= ADMIN_RISK_CONFIG.autoCloseIncidentHigh) {
      alerts.push({
        severity: input.autoClosedHearings >= 3 ? 'SEVERE' : 'HIGH',
        source: 'HEARING_TIMEOUT',
        title: 'Hearings auto-closed by timeout',
        summary: `${input.autoClosedHearings} hearing(s) were system-closed after timeout in the selected range.`,
        metricValue: input.autoClosedHearings,
        thresholdLabel: `>= ${ADMIN_RISK_CONFIG.autoCloseIncidentHigh} auto-closed hearings`,
        actionUrl: '/staff/hearings',
        reason:
          'Repeated auto-closure means hearings are overrunning without manual resolution, extension, or verdict control.',
      });
    }

    if (
      input.followUpSchedulingFailures >= ADMIN_RISK_CONFIG.followUpSchedulingFailureHigh ||
      input.followUpManualRequired >= ADMIN_RISK_CONFIG.followUpSchedulingFailureHigh
    ) {
      const totalFollowUpRisk =
        input.followUpSchedulingFailures + input.followUpManualRequired;
      alerts.push({
        severity: input.followUpSchedulingFailures > 0 ? 'SEVERE' : 'HIGH',
        source: 'FOLLOW_UP_SCHEDULING',
        title: 'Follow-up hearing scheduling needs intervention',
        summary: `${totalFollowUpRisk} follow-up scheduling incident(s) need review (${input.followUpSchedulingFailures} failures, ${input.followUpManualRequired} manual-required).`,
        metricValue: totalFollowUpRisk,
        thresholdLabel: `>= ${ADMIN_RISK_CONFIG.followUpSchedulingFailureHigh} scheduling incident`,
        actionUrl: '/staff/hearings',
        reason:
          'If unresolved disputes do not receive timely follow-up hearings, the case backlog and appeal exposure both increase.',
      });
    }

    if (input.activeAppealsBacklog >= ADMIN_RISK_CONFIG.appealBacklogHigh) {
      alerts.push({
        severity: input.activeAppealsBacklog >= 6 ? 'SEVERE' : 'HIGH',
        source: 'APPEAL_BACKLOG',
        title: 'Appeal backlog is rising',
        summary: `${input.activeAppealsBacklog} dispute appeal(s) are currently active and awaiting resolution.`,
        metricValue: input.activeAppealsBacklog,
        thresholdLabel: `>= ${ADMIN_RISK_CONFIG.appealBacklogHigh} active appeals`,
        actionUrl: '/admin/dashboard',
        reason:
          'A growing appeal backlog is a direct signal of unresolved participant risk and delayed final outcomes.',
      });
    }

    if (overturnRate >= ADMIN_RISK_CONFIG.overturnRateHighPercent) {
      alerts.push({
        severity: overturnRate >= 35 ? 'SEVERE' : 'HIGH',
        source: 'VERDICT_QUALITY',
        title: 'Overturn rate is above tolerance',
        summary: `${overturnRate}% of appealed staff verdicts were overturned in the selected window.`,
        metricValue: overturnRate,
        thresholdLabel: `>= ${ADMIN_RISK_CONFIG.overturnRateHighPercent}% overturn rate`,
        actionUrl: '/admin/dashboard',
        reason:
          'High overturn rate suggests staff adjudication quality or consistency is drifting from review standards.',
      });
    }

    if (
      overloadedCount > 0 ||
      backlogPendingCases >= ASSIGNMENT_CONFIG.SHORTAGE_THRESHOLD * 5
    ) {
      alerts.push({
        severity: overloadedCount >= 2 ? 'CRITICAL' : 'HIGH',
        source: 'STAFF_CAPACITY',
        title: 'Staff capacity is under pressure',
        summary: `${overloadedCount} overloaded staff member(s) and ${backlogPendingCases} pending dispute case(s) are pressuring the queue.`,
        metricValue: backlogPendingCases,
        thresholdLabel: `utilization >= ${ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD}% or backlog spike`,
        actionUrl: '/staff/caseload',
        reason:
          'Capacity pressure raises the probability of delayed hearings, rushed reviews, and missed SLA windows.',
      });
    }

    if (highRiskAdminActions >= ADMIN_RISK_CONFIG.auditHighRiskBurst) {
      alerts.push({
        severity: highRiskAdminActions >= 5 ? 'SEVERE' : 'HIGH',
        source: 'ADMIN_AUDIT',
        title: 'High-risk admin actions detected',
        summary: `${highRiskAdminActions} high-risk admin audit event(s) were recorded in the selected range.`,
        metricValue: highRiskAdminActions,
        thresholdLabel: `>= ${ADMIN_RISK_CONFIG.auditHighRiskBurst} high-risk audit events`,
        actionUrl: '/admin/audit-logs',
        reason:
          'A burst of high-risk admin actions should be reviewed immediately for governance and misuse exposure.',
      });
    }

    return alerts.sort(
      (left, right) =>
        ALERT_SEVERITY_ORDER[right.severity] - ALERT_SEVERITY_ORDER[left.severity],
    );
  }

  private buildRiskMethodology(
    criticalAlerts: Array<{
      severity: AlertSeverity;
      source: string;
      title: string;
      summary: string;
      metricValue: number;
      thresholdLabel: string;
      actionUrl: string;
      reason: string;
    }>,
  ) {
    return {
      generatedAt: new Date().toISOString(),
      scoringWeights: {
        workload: ASSIGNMENT_CONFIG.WORKLOAD_WEIGHT,
        performance: ASSIGNMENT_CONFIG.PERFORMANCE_WEIGHT,
        fairness: ASSIGNMENT_CONFIG.FAIRNESS_WEIGHT,
      },
      thresholds: {
        maxUtilizationRate: ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE,
        overloadedThreshold: ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD,
        staffShortageThreshold: ASSIGNMENT_CONFIG.SHORTAGE_THRESHOLD,
        appealBacklogHigh: ADMIN_RISK_CONFIG.appealBacklogHigh,
        overturnRateHighPercent: ADMIN_RISK_CONFIG.overturnRateHighPercent,
        overdueDisputeHigh: ADMIN_RISK_CONFIG.overdueDisputeHigh,
        autoCloseIncidentHigh: ADMIN_RISK_CONFIG.autoCloseIncidentHigh,
        followUpSchedulingFailureHigh: ADMIN_RISK_CONFIG.followUpSchedulingFailureHigh,
        auditHighRiskBurst: ADMIN_RISK_CONFIG.auditHighRiskBurst,
      },
      activeSignals: criticalAlerts.map((alert) => ({
        severity: alert.severity,
        source: alert.source,
        title: alert.title,
        metricValue: alert.metricValue,
        thresholdLabel: alert.thresholdLabel,
        whyRanked: alert.reason,
      })),
    };
  }

  private createBuckets(range: DashboardRange, start: Date, end: Date) {
    const useWeekly = range === '90d';
    const buckets: Array<{
      start: Date;
      end: Date;
      label: string;
      revenue: number;
      newUsers: number;
      completedProjects: number;
    }> = [];

    let cursor = new Date(start);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = useWeekly
        ? new Date(bucketStart.getTime() + 6 * 24 * 60 * 60 * 1000)
        : new Date(bucketStart);
      buckets.push({
        start: this.startOfDay(bucketStart),
        end: this.endOfDay(bucketEnd),
        label: useWeekly
          ? `Wk ${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`
          : `${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`,
        revenue: 0,
        newUsers: 0,
        completedProjects: 0,
      });
      cursor = new Date(bucketEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    return buckets;
  }

  private findBucketForDate<T extends { start: Date; end: Date }>(buckets: T[], value?: Date | null) {
    if (!value) {
      return null;
    }

    return buckets.find((bucket) => value >= bucket.start && value <= bucket.end) || null;
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private endOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }
}
