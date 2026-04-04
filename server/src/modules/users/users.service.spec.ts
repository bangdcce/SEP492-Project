import { BadRequestException, NotFoundException } from '@nestjs/common';

import { UserRole } from '../../database/entities/user.entity';
import { UsersService } from './users.service';
import { getSignedUrl } from '../../common/utils/supabase-storage.util';

jest.mock('../../common/utils/supabase-storage.util', () => ({
  getSignedUrl: jest.fn(async (path: string) => `signed:${path}`),
}));

const createRepositoryMock = () => ({
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
});

const createQueryBuilderMock = () => {
  const builder = {
    andWhere: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    orderBy: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  builder.andWhere.mockReturnValue(builder);
  builder.skip.mockReturnValue(builder);
  builder.take.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);

  return builder;
};

describe('UsersService.getAllUsers', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createRepositoryMock>;
  let kycRepo: ReturnType<typeof createRepositoryMock>;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let projectRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestProposalRepo: ReturnType<typeof createRepositoryMock>;
  let queryBuilder: ReturnType<typeof createQueryBuilderMock>;

  beforeEach(() => {
    userRepo = createRepositoryMock();
    kycRepo = createRepositoryMock();
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    projectRepo = createRepositoryMock();
    projectRequestRepo = createRepositoryMock();
    projectRequestProposalRepo = createRepositoryMock();
    queryBuilder = createQueryBuilderMock();

    userRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    service = new UsersService(
      userRepo as any,
      kycRepo as any,
      profileRepo as any,
      userSkillRepo as any,
      projectRepo as any,
      projectRequestRepo as any,
      projectRequestProposalRepo as any,
    );
  });

  it('returns paginated users with default page and limit when filters are omitted', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([
      [{ id: 'user-1', email: 'member@gmail.com' }],
      1,
    ]);

    const result = await service.getAllUsers({} as any);

    expect(userRepo.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    expect(queryBuilder.take).toHaveBeenCalledWith(20);
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    expect(result).toEqual({
      users: [{ id: 'user-1', email: 'member@gmail.com' }],
      total: 1,
      page: 1,
      totalPages: 1,
    });
  });

  it('applies the role filter before querying users', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.getAllUsers({
      role: UserRole.BROKER,
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', {
      role: UserRole.BROKER,
    });
  });

  it('applies the search filter to both email and full name', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.getAllUsers({
      search: 'alice',
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(user.email ILIKE :search OR user.fullName ILIKE :search)',
      { search: '%alice%' },
    );
  });

  it('applies the ban-status filter when isBanned is provided', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await service.getAllUsers({
      isBanned: true,
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.isBanned = :isBanned', {
      isBanned: true,
    });
  });

  it('uses custom pagination values and returns totalPages 0 for an empty result set', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await service.getAllUsers({
      page: 3,
      limit: 5,
    } as any);

    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      users: [],
      total: 0,
      page: 3,
      totalPages: 0,
    });
  });
});

describe('UsersService.getUserDetail', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createRepositoryMock>;
  let kycRepo: ReturnType<typeof createRepositoryMock>;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let projectRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestProposalRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    userRepo = createRepositoryMock();
    kycRepo = createRepositoryMock();
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    projectRepo = createRepositoryMock();
    projectRequestRepo = createRepositoryMock();
    projectRequestProposalRepo = createRepositoryMock();

    service = new UsersService(
      userRepo as any,
      kycRepo as any,
      profileRepo as any,
      userSkillRepo as any,
      projectRepo as any,
      projectRequestRepo as any,
      projectRequestProposalRepo as any,
    );
  });

  it('returns detailed user info with signed KYC document URLs when a KYC record exists', async () => {
    const createdAt = new Date('2026-03-30T01:00:00.000Z');
    const reviewedAt = new Date('2026-03-30T02:00:00.000Z');
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1',
      email: 'member@gmail.com',
      fullName: 'Member User',
      role: UserRole.FREELANCER,
      phoneNumber: '0912345678',
      isVerified: true,
      isBanned: false,
      banReason: null,
      bannedAt: null,
      currentTrustScore: 88,
      totalProjectsFinished: 5,
      totalDisputesLost: 1,
      createdAt,
      profile: {},
    });
    kycRepo.findOne.mockResolvedValueOnce({
      id: 'kyc-1',
      status: 'APPROVED',
      rejectionReason: null,
      createdAt,
      reviewedAt,
      documentFrontUrl: 'kyc/front.png',
      documentBackUrl: 'kyc/back.png',
    });

    const result = await service.getUserDetail('user-1');

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      relations: ['profile'],
    });
    expect(kycRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
    expect(getSignedUrl).toHaveBeenCalledWith('kyc/front.png', 3600);
    expect(getSignedUrl).toHaveBeenCalledWith('kyc/back.png', 3600);
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'member@gmail.com',
        role: UserRole.FREELANCER,
        kyc: expect.objectContaining({
          id: 'kyc-1',
          status: 'APPROVED',
          documentFrontUrl: 'signed:kyc/front.png',
          documentBackUrl: 'signed:kyc/back.png',
        }),
      }),
    );
  });

  it('returns NOT_STARTED KYC state when the user has no KYC submission', async () => {
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1',
      email: 'member@gmail.com',
      fullName: 'Member User',
      role: UserRole.CLIENT,
      phoneNumber: null,
      isVerified: false,
      isBanned: false,
      banReason: null,
      bannedAt: null,
      currentTrustScore: 0,
      totalProjectsFinished: 0,
      totalDisputesLost: 0,
      createdAt: new Date('2026-03-30T01:00:00.000Z'),
      profile: null,
    });
    kycRepo.findOne.mockResolvedValueOnce(null);

    const result = await service.getUserDetail('user-1');

    expect(result.kyc).toEqual({ status: 'NOT_STARTED' });
  });

  it('throws not found when the user does not exist', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.getUserDetail('missing-user')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.banUser', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createRepositoryMock>;
  let kycRepo: ReturnType<typeof createRepositoryMock>;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let projectRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestProposalRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    userRepo = createRepositoryMock();
    kycRepo = createRepositoryMock();
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    projectRepo = createRepositoryMock();
    projectRequestRepo = createRepositoryMock();
    projectRequestProposalRepo = createRepositoryMock();

    service = new UsersService(
      userRepo as any,
      kycRepo as any,
      profileRepo as any,
      userSkillRepo as any,
      projectRepo as any,
      projectRequestRepo as any,
      projectRequestProposalRepo as any,
    );
  });

  it('marks the user as banned, stores the reason, and records the acting admin', async () => {
    const user = {
      id: 'user-1',
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
    };
    userRepo.findOne.mockResolvedValueOnce(user);
    userRepo.save.mockImplementation(async (entity) => entity);

    const result = await service.banUser('user-1', 'admin-1', {
      reason: 'Multiple violations',
    } as any);

    expect(user.isBanned).toBe(true);
    expect(user.banReason).toBe('Multiple violations');
    expect(user.bannedBy).toBe('admin-1');
    expect(user.bannedAt).toBeInstanceOf(Date);
    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      message: 'User banned successfully',
      user,
    });
  });

  it('throws not found when the user cannot be loaded', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.banUser('missing-user', 'admin-1', { reason: 'Duplicate' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws bad request when the user is already banned', async () => {
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1',
      isBanned: true,
    });

    await expect(
      service.banUser('user-1', 'admin-1', { reason: 'Duplicate' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UsersService.unbanUser', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createRepositoryMock>;
  let kycRepo: ReturnType<typeof createRepositoryMock>;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let projectRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestRepo: ReturnType<typeof createRepositoryMock>;
  let projectRequestProposalRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    userRepo = createRepositoryMock();
    kycRepo = createRepositoryMock();
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    projectRepo = createRepositoryMock();
    projectRequestRepo = createRepositoryMock();
    projectRequestProposalRepo = createRepositoryMock();

    service = new UsersService(
      userRepo as any,
      kycRepo as any,
      profileRepo as any,
      userSkillRepo as any,
      projectRepo as any,
      projectRequestRepo as any,
      projectRequestProposalRepo as any,
    );
  });

  it('clears ban metadata and returns the updated user when unban succeeds', async () => {
    const user = {
      id: 'user-1',
      isBanned: true,
      banReason: 'Multiple violations',
      bannedAt: new Date('2026-03-30T01:00:00.000Z'),
      bannedBy: 'admin-0',
    };
    userRepo.findOne.mockResolvedValueOnce(user);
    userRepo.save.mockImplementation(async (entity) => entity);

    const result = await service.unbanUser('user-1', 'admin-1', {
      reason: 'Appeal approved',
    } as any);

    expect(user.isBanned).toBe(false);
    expect(user.banReason).toBeNull();
    expect(user.bannedAt).toBeNull();
    expect(user.bannedBy).toBeNull();
    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      message: 'User unbanned successfully',
      user,
    });
  });

  it('throws not found when the user cannot be loaded', async () => {
    userRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.unbanUser('missing-user', 'admin-1', { reason: 'Appeal approved' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws bad request when the user is not currently banned', async () => {
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1',
      isBanned: false,
    });

    await expect(
      service.unbanUser('user-1', 'admin-1', { reason: 'Appeal approved' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
