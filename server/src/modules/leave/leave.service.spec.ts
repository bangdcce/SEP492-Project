import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  LeaveStatus,
  LeaveType,
  StaffLeavePolicyEntity,
  StaffLeaveRequestEntity,
  StaffPerformanceEntity,
  UserAvailabilityEntity,
  UserEntity,
  UserRole,
} from 'src/database/entities';
import { AvailabilityService } from '../calendar/availability.service';
import { DEFAULT_MONTHLY_ALLOWANCE_MINUTES } from './leave.utils';
import { LeaveService } from './leave.service';

const createRepositoryMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createUpdateQueryBuilderMock = (affected: number) => {
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  return qb;
};

describe('LeaveService', () => {
  let service: LeaveService;
  let leaveRequestRepository: ReturnType<typeof createRepositoryMock>;
  let leavePolicyRepository: ReturnType<typeof createRepositoryMock>;
  let performanceRepository: ReturnType<typeof createRepositoryMock>;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let availabilityRepository: ReturnType<typeof createRepositoryMock>;
  let availabilityService: { setUserAvailability: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    leaveRequestRepository = createRepositoryMock();
    leavePolicyRepository = createRepositoryMock();
    performanceRepository = createRepositoryMock();
    userRepository = createRepositoryMock();
    availabilityRepository = createRepositoryMock();
    availabilityService = {
      setUserAvailability: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        {
          provide: getRepositoryToken(StaffLeaveRequestEntity),
          useValue: leaveRequestRepository,
        },
        {
          provide: getRepositoryToken(StaffLeavePolicyEntity),
          useValue: leavePolicyRepository,
        },
        {
          provide: getRepositoryToken(StaffPerformanceEntity),
          useValue: performanceRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(UserAvailabilityEntity),
          useValue: availabilityRepository,
        },
        {
          provide: AvailabilityService,
          useValue: availabilityService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns actor summaries for admin leave request listing', async () => {
    const now = new Date();
    const listQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'leave-1',
          staffId: 'staff-1',
          processedById: 'admin-1',
          type: LeaveType.LONG_TERM,
          status: LeaveStatus.PENDING,
          startTime: now,
          endTime: new Date(now.getTime() + 60 * 60 * 1000),
          durationMinutes: 60,
          isAutoApproved: false,
          createdAt: now,
          updatedAt: now,
        },
      ] as StaffLeaveRequestEntity[]),
    };
    leaveRequestRepository.createQueryBuilder.mockReturnValue(listQb);
    userRepository.find.mockResolvedValue([
      {
        id: 'staff-1',
        fullName: 'Staff One',
        email: 'staff1@example.com',
      },
      {
        id: 'admin-1',
        fullName: 'Admin One',
        email: 'admin1@example.com',
      },
    ]);

    const admin = { id: 'admin-1', role: UserRole.ADMIN, timeZone: 'UTC' } as UserEntity;
    const result = await service.listLeaveRequests({}, admin);
    const [first] = result.data as Array<Record<string, unknown>>;

    expect(first.staff).toEqual({
      id: 'staff-1',
      fullName: 'Staff One',
      email: 'staff1@example.com',
    });
    expect(first.processedBy).toEqual({
      id: 'admin-1',
      fullName: 'Admin One',
      email: 'admin1@example.com',
    });
    expect((first.staff as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('returns processedBy summary for staff leave request listing', async () => {
    const now = new Date();
    const listQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'leave-1',
          staffId: 'staff-1',
          processedById: 'admin-1',
          type: LeaveType.LONG_TERM,
          status: LeaveStatus.APPROVED,
          startTime: now,
          endTime: new Date(now.getTime() + 60 * 60 * 1000),
          durationMinutes: 60,
          isAutoApproved: false,
          createdAt: now,
          updatedAt: now,
        },
      ] as StaffLeaveRequestEntity[]),
    };
    leaveRequestRepository.createQueryBuilder.mockReturnValue(listQb);
    userRepository.find.mockResolvedValue([
      {
        id: 'admin-1',
        fullName: 'Admin One',
        email: 'admin1@example.com',
      },
    ]);

    const staff = { id: 'staff-1', role: UserRole.STAFF, timeZone: 'UTC' } as UserEntity;
    const result = await service.listLeaveRequests({}, staff);
    const [first] = result.data as Array<Record<string, unknown>>;

    expect(first.processedBy).toEqual({
      id: 'admin-1',
      fullName: 'Admin One',
      email: 'admin1@example.com',
    });
    expect(first.staff).toBeUndefined();
  });

  it('lists leave policies with default allowance fallback', async () => {
    const policyQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'staff-1',
            fullName: 'Staff One',
            email: 'staff1@example.com',
          },
          {
            id: 'staff-2',
            fullName: 'Staff Two',
            email: 'staff2@example.com',
          },
        ],
        2,
      ]),
    };
    userRepository.createQueryBuilder.mockReturnValue(policyQb);
    leavePolicyRepository.find.mockResolvedValue([
      {
        id: 'policy-2',
        staffId: 'staff-2',
        monthlyAllowanceMinutes: 900,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const admin = { id: 'admin-1', role: UserRole.ADMIN } as UserEntity;
    const result = await service.listLeavePolicies({ page: 1, limit: 20 }, admin);
    const first = result.data.find((item) => item.staffId === 'staff-1');
    const second = result.data.find((item) => item.staffId === 'staff-2');

    expect(first?.monthlyAllowanceMinutes).toBe(DEFAULT_MONTHLY_ALLOWANCE_MINUTES);
    expect(second?.monthlyAllowanceMinutes).toBe(900);
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('cleans up availability when approve update loses pending state race', async () => {
    const startTime = new Date('2099-01-12T09:00:00.000Z');
    const endTime = new Date('2099-01-12T10:00:00.000Z');
    leaveRequestRepository.findOne.mockResolvedValue({
      id: 'leave-1',
      staffId: 'staff-1',
      type: LeaveType.LONG_TERM,
      status: LeaveStatus.PENDING,
      startTime,
      endTime,
      durationMinutes: 60,
      isAutoApproved: false,
    });
    userRepository.findOne.mockResolvedValue({
      id: 'staff-1',
      role: UserRole.STAFF,
      timeZone: 'UTC',
    });
    leaveRequestRepository.createQueryBuilder.mockReturnValue(createUpdateQueryBuilderMock(0));
    availabilityService.setUserAvailability.mockResolvedValue(undefined);
    availabilityRepository.delete.mockResolvedValue({ affected: 1 });

    const admin = { id: 'admin-1', role: UserRole.ADMIN } as UserEntity;

    await expect(
      service.processLeaveRequest('leave-1', { action: 'approve' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(availabilityService.setUserAvailability).toHaveBeenCalled();
    expect(availabilityRepository.delete).toHaveBeenCalledWith({
      linkedLeaveRequestId: 'leave-1',
    });
    expect(performanceRepository.upsert).not.toHaveBeenCalled();
  });

  it('cancels leave using transaction to keep request and availability in sync', async () => {
    const startTime = new Date('2099-01-12T09:00:00.000Z');
    const endTime = new Date('2099-01-12T10:00:00.000Z');
    leaveRequestRepository.findOne.mockResolvedValue({
      id: 'leave-1',
      staffId: 'staff-1',
      status: LeaveStatus.PENDING,
      startTime,
      endTime,
    });
    userRepository.findOne.mockResolvedValue({
      id: 'staff-1',
      role: UserRole.STAFF,
      timeZone: 'UTC',
    });

    const managerQb = createUpdateQueryBuilderMock(1);
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(managerQb),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));
    jest
      .spyOn(service as any, 'refreshLeavePerformanceForRequest')
      .mockResolvedValue(undefined);

    const requester = { id: 'staff-1', role: UserRole.STAFF } as UserEntity;
    const result = await service.cancelLeaveRequest('leave-1', { note: 'cancel' }, requester);

    expect(result).toEqual({
      success: true,
      message: 'Leave request cancelled',
    });
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalledWith(UserAvailabilityEntity, {
      linkedLeaveRequestId: 'leave-1',
    });
  });
});
