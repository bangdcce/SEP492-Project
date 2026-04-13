import { UnauthorizedException } from '@nestjs/common';

import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('AuthService profile flows', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  const fixedNow = new Date('2026-03-27T10:00:00.000Z');

  const createProfile = (overrides: Partial<ProfileEntity> = {}): ProfileEntity =>
    Object.assign(new ProfileEntity(), {
      id: 'profile-1',
      userId: 'user-1',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      bio: 'Profile bio',
      companyName: 'Profile Co',
      skills: ['NestJS'],
      portfolioLinks: [{ title: 'Portfolio', url: 'https://example.com' }],
      linkedinUrl: 'https://www.linkedin.com/in/viewer',
      cvUrl: 'https://cdn.example.com/cv.pdf',
      bankInfo: null,
      ...overrides,
    });

  const createUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'viewer@gmail.com',
      passwordHash: 'stored-password-hash',
      fullName: 'Viewer User',
      phoneNumber: '0987654321',
      role: UserRole.CLIENT,
      timeZone: 'UTC',
      isVerified: true,
      currentTrustScore: 4.2,
      totalProjectsFinished: 3,
      totalProjectsCancelled: 0,
      totalDisputesLost: 1,
      totalLateProjects: 0,
      emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z'),
      status: UserStatus.ACTIVE,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      profile: createProfile(),
      ...overrides,
    });

  const expectUnauthorized = async (
    operation: Promise<unknown>,
    expectedResponse: Record<string, unknown>,
  ) => {
    try {
      await operation;
      throw new Error('Expected UnauthorizedException');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject(expectedResponse);
    }
  };

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();

    profileRepository.create.mockImplementation((data: Partial<ProfileEntity>) =>
      Object.assign(new ProfileEntity(), data),
    );
    profileRepository.save.mockResolvedValue(undefined);
    profileRepository.update.mockResolvedValue({ affected: 1 });
    userRepository.update.mockResolvedValue({ affected: 1 });

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('returns the mapped session user for an authenticated profile lookup', async () => {
    userRepository.findOne.mockResolvedValue(createUser());

    const result = await service.getSessionUser('user-1');

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      relations: ['profile', 'staffApplication'],
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'viewer@gmail.com',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        bio: 'Profile bio',
      }),
    );
  });

  it('rejects the session lookup when the authenticated user no longer exists', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expectUnauthorized(service.getSessionUser('missing-user'), {
      error: 'SESSION_REVOKED',
      message: 'Authenticated user not found',
    });
  });

  it('creates a missing profile row and updates user core fields during profile editing', async () => {
    profileRepository.findOne.mockResolvedValue(null);
    userRepository.findOne.mockResolvedValue(
      createUser({
        fullName: 'Updated User',
        phoneNumber: '0987000000',
        timeZone: 'Asia/Bangkok',
        profile: createProfile({
          avatarUrl: 'https://cdn.example.com/new-avatar.png',
          bio: 'Updated bio',
          companyName: null as any,
          skills: ['NestJS', 'TypeScript'],
        }),
      }),
    );

    const result = await service.updateProfile('user-1', {
      fullName: 'Updated User',
      phoneNumber: '0987000000',
      timeZone: 'Asia/Bangkok',
      avatarUrl: 'https://cdn.example.com/new-avatar.png',
      bio: 'Updated bio',
      skills: ['NestJS', 'TypeScript'],
    } as any);

    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        fullName: 'Updated User',
        phoneNumber: '0987000000',
        timeZone: 'Asia/Bangkok',
      },
    );
    expect(profileRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      avatarUrl: 'https://cdn.example.com/new-avatar.png',
      bio: 'Updated bio',
      companyName: undefined,
      skills: ['NestJS', 'TypeScript'],
      portfolioLinks: undefined,
      linkedinUrl: undefined,
      cvUrl: undefined,
    });
    expect(profileRepository.save).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        fullName: 'Updated User',
        phoneNumber: '0987000000',
        timeZone: 'Asia/Bangkok',
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        bio: 'Updated bio',
      }),
    );
  });

  it('partially updates an existing profile without mutating undefined fields', async () => {
    profileRepository.findOne.mockResolvedValue(createProfile());
    userRepository.findOne.mockResolvedValue(
      createUser({
        profile: createProfile({
          avatarUrl: 'https://cdn.example.com/avatar.png',
          bio: 'Refined bio',
          companyName: 'Profile Co',
          skills: ['NestJS', 'Testing'],
        }),
      }),
    );

    const result = await service.updateProfile('user-1', {
      bio: 'Refined bio',
      skills: ['NestJS', 'Testing'],
    } as any);

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(profileRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      {
        bio: 'Refined bio',
        skills: ['NestJS', 'Testing'],
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        bio: 'Refined bio',
        skills: ['NestJS', 'Testing'],
        avatarUrl: 'https://cdn.example.com/avatar.png',
      }),
    );
  });

  it('throws when the updated user cannot be reloaded after profile editing', async () => {
    profileRepository.findOne.mockResolvedValue(createProfile());
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateProfile('user-1', {
        bio: 'Will fail on reload',
      } as any),
    ).rejects.toThrow('User not found after update');
  });
});
