import { ForbiddenException } from '@nestjs/common';
import { SkillCategory } from '../../database/entities/skill.entity';
import {
  StaffApplicationStatus,
} from '../../database/entities/staff-application.entity';
import { UserRole } from '../../database/entities/user.entity';
import { StaffApplicationsService } from './staff-applications.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('StaffApplicationsService', () => {
  let service: StaffApplicationsService;
  let staffApplicationRepository: ReturnType<typeof createRepositoryMock>;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let auditLogsService: { logCustom: jest.Mock };
  let staffApplicationsGateway: { emitApplicationUpdated: jest.Mock };

  beforeEach(() => {
    staffApplicationRepository = createRepositoryMock();
    userRepository = createRepositoryMock();
    auditLogsService = {
      logCustom: jest.fn().mockResolvedValue(undefined),
    };
    staffApplicationsGateway = {
      emitApplicationUpdated: jest.fn(),
    };

    service = new StaffApplicationsService(
      staffApplicationRepository as any,
      userRepository as any,
      auditLogsService as any,
      staffApplicationsGateway as any,
    );
  });

  it('returns a synthetic approved application for legacy verified staff accounts without an application row', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'staff-1',
      email: 'staff@example.com',
      fullName: 'Legacy Staff',
      phoneNumber: '0987654321',
      role: UserRole.STAFF,
      isVerified: true,
      emailVerifiedAt: new Date('2026-04-01T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      staffApplication: null,
      userSkillDomains: [
        {
          domain: {
            id: 'domain-1',
            name: 'Security',
            slug: 'security',
          },
        },
      ],
      userSkills: [
        {
          skill: {
            id: 'skill-1',
            name: 'Code Review',
            slug: 'code-review',
            category: SkillCategory.AUDIT_CODE_QUALITY,
          },
        },
      ],
    });

    const result = await service.getMyApplication('staff-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: null,
        status: StaffApplicationStatus.APPROVED,
        user: expect.objectContaining({
          id: 'staff-1',
          email: 'staff@example.com',
          isVerified: true,
          isEmailVerified: true,
          domains: [
            {
              id: 'domain-1',
              name: 'Security',
              slug: 'security',
            },
          ],
          skills: [
            {
              id: 'skill-1',
              name: 'Code Review',
              slug: 'code-review',
              category: SkillCategory.AUDIT_CODE_QUALITY,
            },
          ],
        }),
      }),
    );
  });

  it('rejects getMyApplication for non-staff accounts', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      role: UserRole.CLIENT,
      staffApplication: null,
    });

    await expect(service.getMyApplication('user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists staff applications without applying a status filter when the query omits it', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 1]),
    };
    staffApplicationRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getAllApplications({
      page: 1,
      limit: 20,
      search: '',
    } as any);

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'application.status = :status',
      expect.anything(),
    );
    expect(result).toEqual({
      items: [],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('applies a status filter when a valid staff-application status is provided', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    staffApplicationRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.getAllApplications({
      status: StaffApplicationStatus.PENDING,
      page: 1,
      limit: 20,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('application.status = :status', {
      status: StaffApplicationStatus.PENDING,
    });
  });

  it('approves a pending staff application, verifies the user, and records an audit log', async () => {
    staffApplicationRepository.findOne.mockResolvedValue({
      id: 'application-1',
      userId: 'staff-1',
      status: StaffApplicationStatus.PENDING,
      user: {
        id: 'staff-1',
      },
    });
    staffApplicationRepository.save.mockImplementation(async (entity: any) => entity);
    userRepository.update.mockResolvedValue({ affected: 1 });
    jest.spyOn(service, 'getApplicationById').mockResolvedValue({
      id: 'application-1',
      status: StaffApplicationStatus.APPROVED,
    } as any);

    const result = await service.approveApplication('application-1', 'admin-1');

    expect(staffApplicationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'application-1',
        status: StaffApplicationStatus.APPROVED,
        reviewedBy: 'admin-1',
        reviewedAt: expect.any(Date),
        rejectionReason: null,
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith('staff-1', { isVerified: true });
    expect(auditLogsService.logCustom).toHaveBeenCalledWith(
      'STAFF_APPLICATION_APPROVED',
      'StaffApplication',
      'application-1',
      expect.objectContaining({
        applicationId: 'application-1',
        userId: 'staff-1',
        reviewedBy: 'admin-1',
      }),
      undefined,
      'admin-1',
    );
    expect(staffApplicationsGateway.emitApplicationUpdated).toHaveBeenCalledWith('staff-1', {
      applicationId: 'application-1',
      status: StaffApplicationStatus.APPROVED,
      reviewedAt: undefined,
      rejectionReason: undefined,
    });
    expect(result).toEqual({
      id: 'application-1',
      status: StaffApplicationStatus.APPROVED,
    });
  });

  it('rejects a pending staff application, keeps the account unverified, and stores the rejection reason', async () => {
    staffApplicationRepository.findOne.mockResolvedValue({
      id: 'application-2',
      userId: 'staff-2',
      status: StaffApplicationStatus.PENDING,
      user: {
        id: 'staff-2',
      },
    });
    staffApplicationRepository.save.mockImplementation(async (entity: any) => entity);
    userRepository.update.mockResolvedValue({ affected: 1 });
    jest.spyOn(service, 'getApplicationById').mockResolvedValue({
      id: 'application-2',
      status: StaffApplicationStatus.REJECTED,
      rejectionReason: 'Need more relevant experience',
    } as any);

    const result = await service.rejectApplication('application-2', 'admin-1', {
      rejectionReason: 'Need more relevant experience',
    });

    expect(staffApplicationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'application-2',
        status: StaffApplicationStatus.REJECTED,
        reviewedBy: 'admin-1',
        reviewedAt: expect.any(Date),
        rejectionReason: 'Need more relevant experience',
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith('staff-2', { isVerified: false });
    expect(auditLogsService.logCustom).toHaveBeenCalledWith(
      'STAFF_APPLICATION_REJECTED',
      'StaffApplication',
      'application-2',
      expect.objectContaining({
        applicationId: 'application-2',
        userId: 'staff-2',
        reviewedBy: 'admin-1',
        rejectionReason: 'Need more relevant experience',
      }),
      undefined,
      'admin-1',
    );
    expect(staffApplicationsGateway.emitApplicationUpdated).toHaveBeenCalledWith('staff-2', {
      applicationId: 'application-2',
      status: StaffApplicationStatus.REJECTED,
      reviewedAt: undefined,
      rejectionReason: 'Need more relevant experience',
    });
    expect(result).toEqual({
      id: 'application-2',
      status: StaffApplicationStatus.REJECTED,
      rejectionReason: 'Need more relevant experience',
    });
  });
});
