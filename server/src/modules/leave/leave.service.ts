import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';

import {
  LeaveStatus,
  LeaveType,
  StaffLeavePolicyEntity,
  StaffLeaveRequestEntity,
  StaffPerformanceEntity,
  AvailabilityType,
  UserAvailabilityEntity,
  UserEntity,
  UserRole,
} from 'src/database/entities';
import { AvailabilityService } from '../calendar/availability.service';
import {
  buildLeaveDaySlots,
  calculateLeaveMinutes,
  calculateLeaveMinutesByMonth,
  DEFAULT_MONTHLY_ALLOWANCE_MINUTES,
  getLocalMonthKey,
} from './leave.utils';
import { buildUtcDateFromLocalTime } from '../calendar/calendar.utils';
import {
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  LeaveBalanceQueryDto,
  ListLeavePoliciesQueryDto,
  ListLeaveRequestsQueryDto,
  ProcessLeaveRequestDto,
  UpdateLeavePolicyDto,
} from './dto/leave.dto';

interface LeaveBalanceResult {
  staffId: string;
  month: string;
  allowanceMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
  countedMinutes: number;
  remainingMinutes: number;
  overageMinutes: number;
}

interface LeaveMetricsResult {
  totalLeaveMinutes: number;
  leaveRequestCount: number;
  leaveOverageMinutes: number;
}

interface LeaveActorSummary {
  id: string;
  fullName: string;
  email: string;
}

interface LeavePolicyListItem {
  policyId: string | null;
  staffId: string;
  staff: LeaveActorSummary;
  monthlyAllowanceMinutes: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(StaffLeaveRequestEntity)
    private readonly leaveRequestRepository: Repository<StaffLeaveRequestEntity>,
    @InjectRepository(StaffLeavePolicyEntity)
    private readonly leavePolicyRepository: Repository<StaffLeavePolicyEntity>,
    @InjectRepository(StaffPerformanceEntity)
    private readonly performanceRepository: Repository<StaffPerformanceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    private readonly availabilityService: AvailabilityService,
    private readonly dataSource: DataSource,
  ) {}

  async createLeaveRequest(dto: CreateLeaveRequestDto, requester: UserEntity) {
    const targetStaffId = this.resolveTargetStaffId(requester, dto.staffId);
    const staff = await this.ensureStaff(targetStaffId);

    const timeZone = await this.resolveTimeZone(staff, dto.timeZone);
    const startTime = this.parseDate(dto.startTime, 'startTime');
    const endTime = this.parseDate(dto.endTime, 'endTime');

    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    if (startTime < new Date()) {
      throw new BadRequestException('Cannot request leave in the past');
    }

    const totalMinutes = calculateLeaveMinutes(startTime, endTime, timeZone);
    if (totalMinutes <= 0) {
      throw new BadRequestException('Leave range must include working hours');
    }

    if (dto.type !== LeaveType.LONG_TERM) {
      throw new BadRequestException('Short-term leave should be handled via availability updates');
    }

    const overlapping = await this.leaveRequestRepository.find({
      where: {
        staffId: targetStaffId,
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        startTime: LessThan(endTime),
        endTime: MoreThan(startTime),
      },
    });

    if (overlapping.length > 0) {
      throw new BadRequestException('Leave request overlaps existing leave');
    }

    const policy = await this.ensurePolicy(targetStaffId);
    const allowanceMinutes = policy.monthlyAllowanceMinutes;
    const requestMinutesByMonth = calculateLeaveMinutesByMonth(startTime, endTime, timeZone);
    const existingUsageByMonth = await this.getUsageByMonth(
      targetStaffId,
      startTime,
      endTime,
      timeZone,
    );

    for (const [monthKey, requestedMinutes] of requestMinutesByMonth.entries()) {
      const usedMinutes = existingUsageByMonth.get(monthKey) ?? 0;
      const nextTotal = usedMinutes + requestedMinutes;
      if (nextTotal > allowanceMinutes) {
        if (dto.type === LeaveType.SHORT_TERM) {
          throw new BadRequestException(
            `Leave exceeds monthly allowance for ${monthKey}. Submit long-term request for approval.`,
          );
        }
      }
    }

    const request = this.leaveRequestRepository.create({
      staffId: targetStaffId,
      type: dto.type,
      status: LeaveStatus.PENDING,
      startTime,
      endTime,
      durationMinutes: totalMinutes,
      reason: dto.reason,
      isAutoApproved: false,
      processedById: null,
      processedAt: null,
      processedNote: null,
    });

    const saved = await this.leaveRequestRepository.save(request);

    const balance = await this.getLeaveBalanceInternal(
      targetStaffId,
      { month: getLocalMonthKey(startTime, timeZone), includePending: true },
      timeZone,
    );

    return {
      success: true,
      message: 'Leave request submitted for approval',
      data: {
        request: saved,
        balance,
      },
    };
  }

  async listLeaveRequests(query: ListLeaveRequestsQueryDto, requester: UserEntity) {
    const canViewAll = requester.role === UserRole.ADMIN;
    const targetStaffId = canViewAll ? query.staffId : requester.id;

    const qb = this.leaveRequestRepository.createQueryBuilder('leave');
    if (targetStaffId) {
      qb.andWhere('leave.staffId = :staffId', { staffId: targetStaffId });
    }
    if (query.status) {
      qb.andWhere('leave.status = :status', { status: query.status });
    }

    if (query.month) {
      const timeZone = targetStaffId
        ? await this.resolveTimeZone(await this.ensureStaff(targetStaffId))
        : await this.resolveTimeZone(requester);
      const { start, end } = this.getMonthRange(query.month, timeZone);
      qb.andWhere('leave.startTime < :end AND leave.endTime > :start', {
        start,
        end,
      });
    }

    qb.orderBy('leave.startTime', 'DESC');

    const items = await qb.getMany();
    const data = canViewAll
      ? await this.attachActorSummaries(items)
      : await this.attachProcessedBySummaries(items);

    return {
      success: true,
      data,
    };
  }

  async processLeaveRequest(id: string, dto: ProcessLeaveRequestDto, admin: UserEntity) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can process leave requests');
    }

    const request = await this.leaveRequestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }
    if (request.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request already processed');
    }

    const staff = await this.ensureStaff(request.staffId);
    const timeZone = await this.resolveTimeZone(staff);
    const processedAt = new Date();

    if (dto.action === 'reject') {
      const rejectResult = await this.leaveRequestRepository
        .createQueryBuilder()
        .update(StaffLeaveRequestEntity)
        .set({
          status: LeaveStatus.REJECTED,
          processedById: admin.id,
          processedAt,
          processedNote: dto.note,
        })
        .where('id = :id', { id: request.id })
        .andWhere('status = :status', { status: LeaveStatus.PENDING })
        .execute();

      if ((rejectResult.affected ?? 0) === 0) {
        throw new BadRequestException('Leave request already processed');
      }

      return {
        success: true,
        message: 'Leave request rejected',
      };
    }

    if (request.startTime <= new Date()) {
      throw new BadRequestException('Cannot approve leave that starts in the past');
    }

    await this.applyLeaveToAvailability(request, timeZone);

    const approvalResult = await this.leaveRequestRepository
      .createQueryBuilder()
      .update(StaffLeaveRequestEntity)
      .set({
        status: LeaveStatus.APPROVED,
        processedById: admin.id,
        processedAt,
        processedNote: dto.note,
      })
      .where('id = :id', { id: request.id })
      .andWhere('status = :status', { status: LeaveStatus.PENDING })
      .execute();
    if ((approvalResult.affected ?? 0) === 0) {
      await this.deleteLeaveAvailability(request.id);
      throw new BadRequestException('Leave request already processed');
    }
    try {
      await this.refreshLeavePerformanceForRequest(request, timeZone);
    } catch {
      // Non-blocking: leave approval should not fail due to performance refresh
    }

    return {
      success: true,
      message: 'Leave request approved',
    };
  }

  async cancelLeaveRequest(id: string, dto: CancelLeaveRequestDto, requester: UserEntity) {
    const request = await this.leaveRequestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    const isOwner = request.staffId === requester.id;
    if (!isOwner && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not allowed to cancel this leave request');
    }

    if (request.status === LeaveStatus.REJECTED || request.status === LeaveStatus.CANCELLED) {
      throw new BadRequestException('Leave request is already closed');
    }

    if (request.startTime <= new Date()) {
      throw new BadRequestException('Cannot cancel leave that already started');
    }

    const cancelledAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      const cancelResult = await manager
        .createQueryBuilder()
        .update(StaffLeaveRequestEntity)
        .set({
          status: LeaveStatus.CANCELLED,
          cancelledById: requester.id,
          cancelledAt,
          processedNote: dto.note,
        })
        .where('id = :id', { id: request.id })
        .andWhere('status IN (:...statuses)', {
          statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
        })
        .execute();

      if ((cancelResult.affected ?? 0) === 0) {
        throw new BadRequestException('Leave request is already closed');
      }

      await manager.delete(UserAvailabilityEntity, { linkedLeaveRequestId: request.id });
    });

    const staff = await this.ensureStaff(request.staffId);
    const timeZone = await this.resolveTimeZone(staff);
    try {
      await this.refreshLeavePerformanceForRequest(request, timeZone);
    } catch {
      // Non-blocking: leave cancellation should not fail due to performance refresh
    }

    return {
      success: true,
      message: 'Leave request cancelled',
    };
  }

  async getLeaveBalance(
    query: LeaveBalanceQueryDto,
    requester: UserEntity,
    staffIdOverride?: string,
  ) {
    const staffId = staffIdOverride ?? requester.id;
    if (staffIdOverride && requester.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can query other staff balances');
    }

    const staff = await this.ensureStaff(staffId);
    const timeZone = await this.resolveTimeZone(staff, query.timeZone);

    const balance = await this.getLeaveBalanceInternal(staffId, query, timeZone);

    return {
      success: true,
      data: balance,
    };
  }

  async updateLeavePolicy(staffId: string, dto: UpdateLeavePolicyDto, admin: UserEntity) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can update leave policy');
    }

    await this.ensureStaff(staffId);

    const existing = await this.leavePolicyRepository.findOne({ where: { staffId } });
    if (existing) {
      await this.leavePolicyRepository.update(existing.id, {
        monthlyAllowanceMinutes: dto.monthlyAllowanceMinutes,
      });
      return {
        success: true,
        message: 'Leave policy updated',
      };
    }

    await this.leavePolicyRepository.save({
      staffId,
      monthlyAllowanceMinutes: dto.monthlyAllowanceMinutes,
    });

    return {
      success: true,
      message: 'Leave policy created',
    };
  }

  async listLeavePolicies(query: ListLeavePoliciesQueryDto, admin: UserEntity) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admin can list leave policies');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const qb = this.userRepository.createQueryBuilder('user');
    qb.where('user.role = :role', { role: UserRole.STAFF });
    if (search) {
      qb.andWhere(
        '(user.id::text ILIKE :search OR user.fullName ILIKE :search OR user.email ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    qb.select(['user.id', 'user.fullName', 'user.email']);
    qb.orderBy('user.fullName', 'ASC');
    qb.addOrderBy('user.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(limit);

    const [staffUsers, total] = await qb.getManyAndCount();
    const staffIds = staffUsers.map((staff) => staff.id);
    const policies =
      staffIds.length === 0
        ? []
        : await this.leavePolicyRepository.find({
            where: { staffId: In(staffIds) },
          });
    const policyMap = new Map(policies.map((policy) => [policy.staffId, policy]));

    const data: LeavePolicyListItem[] = staffUsers.map((staff) => {
      const policy = policyMap.get(staff.id);
      return {
        policyId: policy?.id ?? null,
        staffId: staff.id,
        staff: {
          id: staff.id,
          fullName: staff.fullName,
          email: staff.email,
        },
        monthlyAllowanceMinutes:
          policy?.monthlyAllowanceMinutes ?? DEFAULT_MONTHLY_ALLOWANCE_MINUTES,
        createdAt: policy?.createdAt ?? null,
        updatedAt: policy?.updatedAt ?? null,
      };
    });

    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async getLeaveMetricsForPeriod(
    staffId: string,
    period: string,
    timeZoneOverride?: string,
  ): Promise<LeaveMetricsResult> {
    const staff = await this.ensureStaff(staffId);
    const timeZone = await this.resolveTimeZone(staff, timeZoneOverride);

    const policy = await this.ensurePolicy(staffId);
    const { start, end } = this.getMonthRange(period, timeZone);
    const usage = await this.calculateLeaveUsage(staffId, start, end, timeZone);

    const totalLeaveMinutes = usage.approvedMinutes;
    const leaveRequestCount = usage.approvedRequestCount;
    const leaveOverageMinutes = Math.max(0, totalLeaveMinutes - policy.monthlyAllowanceMinutes);

    return {
      totalLeaveMinutes,
      leaveRequestCount,
      leaveOverageMinutes,
    };
  }

  private resolveTargetStaffId(requester: UserEntity, staffId?: string): string {
    if (staffId) {
      if (requester.role !== UserRole.ADMIN && requester.id !== staffId) {
        throw new ForbiddenException('You cannot create leave for another staff');
      }
      return staffId;
    }
    return requester.id;
  }

  private async ensureStaff(staffId: string): Promise<UserEntity> {
    const staff = await this.userRepository.findOne({
      where: { id: staffId, role: UserRole.STAFF, isBanned: false },
      select: ['id', 'role', 'timeZone'],
    });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }
    return staff;
  }

  private async resolveTimeZone(staff: UserEntity, timeZoneOverride?: string): Promise<string> {
    const timeZone = timeZoneOverride || staff.timeZone || 'UTC';
    if (timeZoneOverride && staff.timeZone !== timeZoneOverride) {
      await this.userRepository.update({ id: staff.id }, { timeZone: timeZoneOverride });
    }
    return timeZone;
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return date;
  }

  private getMonthRange(period: string, timeZone: string): { start: Date; end: Date } {
    const [year, month] = period.split('-').map((value) => Number(value));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      throw new BadRequestException('Invalid period');
    }

    const startBase = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endBase = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const rangeStart = buildUtcDateFromLocalTime(startBase, '00:00:00', timeZone);
    const rangeEnd = buildUtcDateFromLocalTime(endBase, '00:00:00', timeZone);

    return { start: rangeStart, end: rangeEnd };
  }

  private async ensurePolicy(staffId: string): Promise<StaffLeavePolicyEntity> {
    const existing = await this.leavePolicyRepository.findOne({ where: { staffId } });
    if (existing) {
      return existing;
    }

    const created = this.leavePolicyRepository.create({
      staffId,
      monthlyAllowanceMinutes: DEFAULT_MONTHLY_ALLOWANCE_MINUTES,
    });
    return this.leavePolicyRepository.save(created);
  }

  private async getUsageByMonth(
    staffId: string,
    rangeStart: Date,
    rangeEnd: Date,
    timeZone: string,
  ): Promise<Map<string, number>> {
    const requests = await this.leaveRequestRepository.find({
      where: {
        staffId,
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        startTime: LessThan(rangeEnd),
        endTime: MoreThan(rangeStart),
      },
    });

    const usageByMonth = new Map<string, number>();

    for (const request of requests) {
      const perMonth = calculateLeaveMinutesByMonth(request.startTime, request.endTime, timeZone);
      for (const [monthKey, minutes] of perMonth.entries()) {
        const current = usageByMonth.get(monthKey) ?? 0;
        usageByMonth.set(monthKey, current + minutes);
      }
    }

    return usageByMonth;
  }

  private async calculateLeaveUsage(
    staffId: string,
    rangeStart: Date,
    rangeEnd: Date,
    timeZone: string,
  ): Promise<{
    approvedMinutes: number;
    pendingMinutes: number;
    approvedRequestCount: number;
    pendingRequestCount: number;
  }> {
    const requests = await this.leaveRequestRepository.find({
      where: {
        staffId,
        status: In([LeaveStatus.APPROVED, LeaveStatus.PENDING]),
        startTime: LessThan(rangeEnd),
        endTime: MoreThan(rangeStart),
      },
    });

    let approvedMinutes = 0;
    let pendingMinutes = 0;
    let approvedRequestCount = 0;
    let pendingRequestCount = 0;

    for (const request of requests) {
      const overlapStart = request.startTime > rangeStart ? request.startTime : rangeStart;
      const overlapEnd = request.endTime < rangeEnd ? request.endTime : rangeEnd;
      if (overlapEnd <= overlapStart) {
        continue;
      }

      const minutes = calculateLeaveMinutes(overlapStart, overlapEnd, timeZone);
      if (request.status === LeaveStatus.APPROVED) {
        approvedMinutes += minutes;
        approvedRequestCount += 1;
      } else {
        pendingMinutes += minutes;
        pendingRequestCount += 1;
      }
    }

    return { approvedMinutes, pendingMinutes, approvedRequestCount, pendingRequestCount };
  }

  private async getLeaveBalanceInternal(
    staffId: string,
    query: LeaveBalanceQueryDto,
    timeZone: string,
  ): Promise<LeaveBalanceResult> {
    const monthKey = query.month || getLocalMonthKey(new Date(), timeZone);
    const policy = await this.ensurePolicy(staffId);
    const { start, end } = this.getMonthRange(monthKey, timeZone);

    const usage = await this.calculateLeaveUsage(staffId, start, end, timeZone);
    const includePending = query.includePending ?? true;
    const countedMinutes = usage.approvedMinutes + (includePending ? usage.pendingMinutes : 0);

    const remainingMinutes = Math.max(0, policy.monthlyAllowanceMinutes - countedMinutes);
    const overageMinutes = Math.max(0, countedMinutes - policy.monthlyAllowanceMinutes);

    return {
      staffId,
      month: monthKey,
      allowanceMinutes: policy.monthlyAllowanceMinutes,
      approvedMinutes: usage.approvedMinutes,
      pendingMinutes: usage.pendingMinutes,
      countedMinutes,
      remainingMinutes,
      overageMinutes,
    };
  }

  private async applyLeaveToAvailability(request: StaffLeaveRequestEntity, timeZone: string) {
    const slots = buildLeaveDaySlots(request.startTime, request.endTime, timeZone);
    if (slots.length === 0) {
      throw new BadRequestException('Leave range does not include working hours');
    }

    await this.availabilityService.setUserAvailability({
      userId: request.staffId,
      slots: slots.map((slot) => ({
        startTime: `${slot.dateKey}T${slot.startTime}`,
        endTime: `${slot.dateKey}T${slot.endTime}`,
        type: AvailabilityType.OUT_OF_OFFICE,
        note: `Leave request ${request.id}`,
      })),
      allowConflicts: false,
      timeZone,
      isAutoGenerated: true,
      linkedLeaveRequestId: request.id,
    });
  }

  private async deleteLeaveAvailability(leaveRequestId: string) {
    await this.availabilityRepository.delete({ linkedLeaveRequestId: leaveRequestId });
  }

  private async mapUserSummaries(userIds: string[]): Promise<Map<string, LeaveActorSummary>> {
    const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.userRepository.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'fullName', 'email'],
    });

    return new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      ]),
    );
  }

  private async attachActorSummaries(items: StaffLeaveRequestEntity[]) {
    const userIds = items.flatMap((item) => [
      item.staffId,
      ...(item.processedById ? [item.processedById] : []),
    ]);
    const summaryMap = await this.mapUserSummaries(userIds);

    return items.map((item) => ({
      ...item,
      staff: summaryMap.get(item.staffId) ?? null,
      processedBy: item.processedById ? summaryMap.get(item.processedById) ?? null : null,
    }));
  }

  private async attachProcessedBySummaries(items: StaffLeaveRequestEntity[]) {
    const processedByIds = items
      .map((item) => item.processedById)
      .filter((id): id is string => Boolean(id));
    const summaryMap = await this.mapUserSummaries(processedByIds);

    return items.map((item) => ({
      ...item,
      processedBy: item.processedById ? summaryMap.get(item.processedById) ?? null : null,
    }));
  }

  private async refreshLeavePerformanceForRequest(
    request: StaffLeaveRequestEntity,
    timeZone: string,
  ) {
    const months = Array.from(
      calculateLeaveMinutesByMonth(request.startTime, request.endTime, timeZone).keys(),
    );
    for (const monthKey of months) {
      const metrics = await this.getLeaveMetricsForPeriod(request.staffId, monthKey, timeZone);
      await this.performanceRepository.upsert(
        {
          staffId: request.staffId,
          period: monthKey,
          totalLeaveMinutes: metrics.totalLeaveMinutes,
          leaveRequestCount: metrics.leaveRequestCount,
          leaveOverageMinutes: metrics.leaveOverageMinutes,
        },
        ['staffId', 'period'],
      );
    }
  }
}
