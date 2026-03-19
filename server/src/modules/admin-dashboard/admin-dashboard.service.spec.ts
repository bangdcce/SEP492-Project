import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  const fixedNow = new Date('2026-03-19T12:00:00.000Z');

  const createValueQb = (value: string) => ({
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ value }),
  });

  const createLogsQb = (logs: unknown[]) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(logs),
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('builds admin and staff analytics with drill-down and risk highlights', async () => {
    jest.useFakeTimers().setSystemTime(fixedNow);

    const userRepository = {
      count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
      find: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'admin-1',
            fullName: 'Alice Admin',
            email: 'alice@example.com',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: fixedNow,
          },
          {
            id: 'admin-2',
            fullName: 'Bob Admin',
            email: 'bob@example.com',
            createdAt: new Date('2026-01-10T00:00:00.000Z'),
            updatedAt: fixedNow,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'staff-1',
            fullName: 'Sara Staff',
            email: 'sara@example.com',
            createdAt: new Date('2026-01-15T00:00:00.000Z'),
            updatedAt: fixedNow,
          },
          {
            id: 'staff-2',
            fullName: 'Tom Staff',
            email: 'tom@example.com',
            createdAt: new Date('2026-01-20T00:00:00.000Z'),
            updatedAt: fixedNow,
          },
        ])
        .mockResolvedValueOnce([
          { id: 'user-1', createdAt: new Date('2026-03-15T08:00:00.000Z') },
          { id: 'user-2', createdAt: new Date('2026-03-18T10:00:00.000Z') },
        ]),
    };

    const projectRepository = {
      count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1),
      find: jest.fn().mockResolvedValue([
        { id: 'project-1', updatedAt: new Date('2026-03-14T10:00:00.000Z') },
        { id: 'project-2', updatedAt: new Date('2026-03-17T13:00:00.000Z') },
        { id: 'project-3', updatedAt: new Date('2026-03-18T18:00:00.000Z') },
      ]),
    };

    const escrowRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(createValueQb('75'))
        .mockReturnValueOnce(createValueQb('25')),
      find: jest.fn().mockResolvedValue([
        {
          id: 'escrow-1',
          platformFee: 50,
          currency: 'USD',
          releasedAt: new Date('2026-03-14T09:00:00.000Z'),
        },
        {
          id: 'escrow-2',
          platformFee: 25,
          currency: 'USD',
          releasedAt: new Date('2026-03-18T14:00:00.000Z'),
        },
      ]),
    };

    const adminLogs = [
      {
        id: 'log-1',
        actorId: 'admin-1',
        actor: { fullName: 'Alice Admin' },
        action: 'EXPORT_LOG',
        entityType: 'AUDIT_LOG',
        entityId: 'export-1',
        eventName: 'EXPORT_AUDIT_LOG',
        requestId: 'req-high',
        source: 'SERVER',
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        afterData: {
          _security_analysis: {
            riskLevel: 'HIGH',
          },
        },
      },
      {
        id: 'log-2',
        actorId: 'admin-1',
        actor: { fullName: 'Alice Admin' },
        action: 'BAN_USER',
        entityType: 'USER',
        entityId: 'user-9',
        eventName: 'USER_BANNED',
        requestId: 'req-ban',
        source: 'SERVER',
        createdAt: new Date('2026-03-17T10:00:00.000Z'),
        afterData: {},
      },
      {
        id: 'log-3',
        actorId: 'admin-2',
        actor: { fullName: 'Bob Admin' },
        action: 'APPROVE_REVIEW',
        entityType: 'REVIEW',
        entityId: 'review-3',
        eventName: 'REVIEW_APPROVED',
        requestId: 'req-approve',
        source: 'SERVER',
        createdAt: new Date('2026-03-16T10:00:00.000Z'),
        afterData: {},
      },
    ];

    const auditLogRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(createValueQb('2'))
        .mockReturnValueOnce(createValueQb('1'))
        .mockReturnValueOnce(createLogsQb(adminLogs)),
    };

    const performanceRepository = {
      find: jest.fn().mockResolvedValue([
        {
          staffId: 'staff-1',
          totalDisputesResolved: 6,
          totalCasesFinalized: 8,
          totalAppealed: 1,
          totalOverturnedByAdmin: 0,
          totalHearingsConducted: 3,
          totalLeaveMinutes: 120,
          avgResolutionTimeHours: 10,
          updatedAt: new Date('2026-03-18T12:00:00.000Z'),
        },
        {
          staffId: 'staff-2',
          totalDisputesResolved: 4,
          totalCasesFinalized: 6,
          totalAppealed: 2,
          totalOverturnedByAdmin: 1,
          totalHearingsConducted: 2,
          totalLeaveMinutes: 60,
          avgResolutionTimeHours: 14,
          updatedAt: new Date('2026-03-18T15:00:00.000Z'),
        },
      ]),
    };

    const workloadRepository = {
      createQueryBuilder: jest.fn().mockReturnValueOnce(createValueQb('1')),
      find: jest.fn().mockResolvedValue([
        {
          staffId: 'staff-1',
          date: new Date('2026-03-18T00:00:00.000Z'),
          utilizationRate: 91,
          totalDisputesPending: 4,
          isOverloaded: true,
          updatedAt: new Date('2026-03-18T16:00:00.000Z'),
        },
        {
          staffId: 'staff-2',
          date: new Date('2026-03-18T00:00:00.000Z'),
          utilizationRate: 63,
          totalDisputesPending: 2,
          isOverloaded: false,
          updatedAt: new Date('2026-03-18T16:30:00.000Z'),
        },
      ]),
    };

    const service = new AdminDashboardService(
      userRepository as never,
      projectRepository as never,
      escrowRepository as never,
      auditLogRepository as never,
      performanceRepository as never,
      workloadRepository as never,
    );

    const result = await service.getOverview('30d');

    expect(result.summary).toEqual(
      expect.objectContaining({
        revenue: expect.objectContaining({ value: 75, previous: 25, delta: 200, currency: 'USD' }),
        newUsers: expect.objectContaining({ value: 2, previous: 1, delta: 100 }),
        completedProjects: expect.objectContaining({ value: 3, previous: 1, delta: 200 }),
        activeAdmins: expect.objectContaining({ value: 2, previous: 1, delta: 100 }),
        activeStaff: expect.objectContaining({ value: 2, previous: 1, delta: 100 }),
      }),
    );

    expect(result.adminTeam.aggregate).toEqual(
      expect.objectContaining({
        totalActions: 3,
        highRiskActions: 1,
        exports: 1,
        approvals: 1,
        userModeration: 1,
      }),
    );
    expect(result.adminTeam.members[0]).toEqual(
      expect.objectContaining({
        id: 'admin-1',
        name: 'Alice Admin',
        exports: 1,
        userModeration: 1,
        highRiskActions: 1,
        isActive: true,
      }),
    );

    expect(result.staffTeam.members[0]).toEqual(
      expect.objectContaining({
        id: 'staff-1',
        name: 'Sara Staff',
        resolvedCases: 6,
        pendingCases: 4,
        currentUtilizationRate: 91,
        isOverloaded: true,
      }),
    );
    expect(result.staffTeam.averages).toEqual(
      expect.objectContaining({
        resolvedCases: 5,
        pendingCases: 3,
        hearingsConducted: 2.5,
      }),
    );

    expect(result.riskHighlights.highRiskAdminActions[0]).toEqual(
      expect.objectContaining({
        id: 'log-1',
        actorName: 'Alice Admin',
        requestId: 'req-high',
        riskLevel: 'HIGH',
      }),
    );
    expect(result.riskHighlights.overloadedStaff).toEqual([
      expect.objectContaining({
        id: 'staff-1',
        name: 'Sara Staff',
        utilizationRate: 91,
        pendingCases: 4,
      }),
    ]);

    expect(result.series.reduce((sum, point) => sum + point.revenue, 0)).toBe(75);
    expect(result.series.reduce((sum, point) => sum + point.newUsers, 0)).toBe(2);
    expect(result.series.reduce((sum, point) => sum + point.completedProjects, 0)).toBe(3);
  });
});
