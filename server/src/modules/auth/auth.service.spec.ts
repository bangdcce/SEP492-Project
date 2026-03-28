import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  create: jest.fn((data) => Object.assign(new UserEntity(), data)),
  save: jest.fn(),
  manager: {
    getRepository: jest.fn(),
  },
});

describe('AuthService.register', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let emailVerificationService: { sendVerificationEmail: jest.Mock };
  let auditLogsService: { logRegistration: jest.Mock };

  const mockedHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
  const fixedNow = new Date('2026-03-27T09:00:00.000Z');

  const createRegisterDto = (overrides: Record<string, unknown> = {}) => ({
    email: 'new.user@gmail.com',
    password: 'securepass1',
    fullName: 'New User',
    phoneNumber: '0987654321',
    role: UserRole.CLIENT,
    acceptTerms: true,
    acceptPrivacy: true,
    ...overrides,
  });

  const mergeDefined = <T extends object>(base: T, overrides: Partial<T>): T => {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value !== undefined) {
        (base as Record<string, unknown>)[key] = value;
      }
    });

    return base;
  };

  const createSavedUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    mergeDefined(
      Object.assign(new UserEntity(), {
        id: 'user-1',
        email: 'new.user@gmail.com',
        passwordHash: 'hashed-password',
        fullName: 'New User',
        phoneNumber: '0987654321',
        role: UserRole.CLIENT,
        timeZone: 'UTC',
        isVerified: false,
        currentTrustScore: 2.5,
        totalProjectsFinished: 0,
        totalProjectsCancelled: 0,
        totalDisputesLost: 0,
        totalLateProjects: 0,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      }),
      overrides,
    );

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();
    emailVerificationService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    auditLogsService = {
      logRegistration: jest.fn().mockResolvedValue(undefined),
    };

    mockedHash.mockReset();
    mockedHash.mockResolvedValue('hashed-password' as never);

    userRepository.save.mockImplementation(async (entity: Partial<UserEntity>) =>
      createSavedUser(entity),
    );

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      {} as any,
      {} as any,
      {} as any,
      emailVerificationService as any,
      auditLogsService as any,
    );
  });

  it('registers a client account and records verification metadata', async () => {
    userRepository.findOne.mockResolvedValue(null);
    const registerDto = createRegisterDto();

    const result = await service.register(registerDto as any, '127.0.0.1', 'Firefox');

    expect(mockedHash).toHaveBeenCalledWith('securepass1', 12);
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@gmail.com',
        passwordHash: 'hashed-password',
        fullName: 'New User',
        phoneNumber: '0987654321',
        role: UserRole.CLIENT,
        isVerified: false,
        currentTrustScore: 2.5,
        registrationIp: '127.0.0.1',
        registrationUserAgent: 'Firefox',
      }),
    );

    const createdUser = userRepository.create.mock.calls[0][0];
    expect(createdUser.termsAcceptedAt).toBeInstanceOf(Date);
    expect(createdUser.privacyAcceptedAt).toBeInstanceOf(Date);

    expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(
      'user-1',
      'new.user@gmail.com',
    );
    expect(auditLogsService.logRegistration).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        role: UserRole.CLIENT,
        email: 'new.user@gmail.com',
        ipAddress: '127.0.0.1',
        userAgent: 'Firefox',
        domainCount: 0,
        skillCount: 0,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'new.user@gmail.com',
        fullName: 'New User',
        phoneNumber: '0987654321',
        role: UserRole.CLIENT,
        timeZone: 'UTC',
        isVerified: false,
        isEmailVerified: false,
        currentTrustScore: 2.5,
        stats: {
          finished: 0,
          disputes: 0,
          score: 2.5,
        },
      }),
    );
  });

  it('persists selected domains and skills for a freelancer registration', async () => {
    const domainRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const skillRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    userRepository.findOne.mockResolvedValue(null);
    userRepository.manager.getRepository.mockImplementation((entityName: string) => {
      if (entityName === 'UserSkillDomainEntity') return domainRepository;
      if (entityName === 'UserSkillEntity') return skillRepository;
      throw new Error(`Unexpected repository request: ${entityName}`);
    });

    await service.register(
      createRegisterDto({
        role: UserRole.FREELANCER,
        domainIds: ['domain-1', 'domain-2'],
        skillIds: ['skill-1'],
      }) as any,
      '10.0.0.8',
      'Chrome',
    );

    expect(domainRepository.save).toHaveBeenCalledWith([
      { userId: 'user-1', domainId: 'domain-1' },
      { userId: 'user-1', domainId: 'domain-2' },
    ]);
    expect(skillRepository.save).toHaveBeenCalledWith([
      {
        userId: 'user-1',
        skillId: 'skill-1',
        priority: 'SECONDARY',
        verificationStatus: 'SELF_DECLARED',
      },
    ]);
    expect(auditLogsService.logRegistration).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        domainCount: 2,
        skillCount: 1,
      }),
    );
  });

  it('throws a conflict when the email is already registered', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'existing-user' });

    await expect(service.register(createRegisterDto() as any)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(emailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('throws a conflict when legal consent is missing', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.register(
        createRegisterDto({
          acceptPrivacy: false,
        }) as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('skips association saves when broker skill selections are empty', async () => {
    const domainRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const skillRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    userRepository.findOne.mockResolvedValue(null);
    userRepository.manager.getRepository.mockImplementation((entityName: string) => {
      if (entityName === 'UserSkillDomainEntity') return domainRepository;
      if (entityName === 'UserSkillEntity') return skillRepository;
      throw new Error(`Unexpected repository request: ${entityName}`);
    });

    const result = await service.register(
      createRegisterDto({
        role: UserRole.BROKER,
        domainIds: [],
        skillIds: [],
      }) as any,
    );

    expect(userRepository.manager.getRepository).toHaveBeenCalledTimes(2);
    expect(domainRepository.save).not.toHaveBeenCalled();
    expect(skillRepository.save).not.toHaveBeenCalled();
    expect(result.role).toBe(UserRole.BROKER);
  });

  it('does not fail registration when verification email delivery fails', async () => {
    userRepository.findOne.mockResolvedValue(null);
    emailVerificationService.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await service.register(createRegisterDto() as any, '127.0.0.1', 'Safari');

    expect(result.id).toBe('user-1');
    expect(auditLogsService.logRegistration).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        userAgent: 'Safari',
      }),
    );
  });
});
