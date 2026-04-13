import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { ProjectStatus } from '../../database/entities/project.entity';
import { StaffApplicationEntity, StaffApplicationStatus } from '../../database/entities/staff-application.entity';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';
import { uploadEncryptedFile } from '../../common/utils/supabase-storage.util';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../../config/supabase.config', () => ({
  supabaseClient: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: 'https://files.example.com/cvs/user-1/cv.pdf' },
        })),
      })),
    },
  },
}));

jest.mock('../../common/utils/supabase-storage.util', () => ({
  uploadEncryptedFile: jest.fn(),
}));

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn((data) => Object.assign(new UserEntity(), data)),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
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
  let auditLogsService: { logRegistration: jest.Mock; logCustom: jest.Mock };

  const mockedHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
  const mockedCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
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
      logCustom: jest.fn().mockResolvedValue(undefined),
    };

    mockedHash.mockReset();
    mockedHash.mockResolvedValue('hashed-password' as never);
    mockedCompare.mockReset();

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

  it('normalizes email before checking duplicates and persisting a new account', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await service.register(
      createRegisterDto({
        email: '  New.User@GMAIL.com  ',
      }) as any,
    );

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'new.user@gmail.com' },
      select: ['id', 'email', 'passwordHash', 'fullName', 'role', 'phoneNumber', 'isVerified'],
    });
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.user@gmail.com',
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

  it('persists selected domains and skills for a broker registration', async () => {
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
        domainIds: ['domain-1'],
        skillIds: ['skill-1', 'skill-2'],
      }) as any,
      '10.0.0.9',
      'Edge',
    );

    expect(domainRepository.save).toHaveBeenCalledWith([
      { userId: 'user-1', domainId: 'domain-1' },
    ]);
    expect(skillRepository.save).toHaveBeenCalledWith([
      {
        userId: 'user-1',
        skillId: 'skill-1',
        priority: 'SECONDARY',
        verificationStatus: 'SELF_DECLARED',
      },
      {
        userId: 'user-1',
        skillId: 'skill-2',
        priority: 'SECONDARY',
        verificationStatus: 'SELF_DECLARED',
      },
    ]);
    expect(auditLogsService.logRegistration).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        role: UserRole.BROKER,
        domainCount: 1,
        skillCount: 2,
      }),
    );
    expect(result.role).toBe(UserRole.BROKER);
  });

  it('rejects staff registrations on the legacy JSON endpoint', async () => {
    await expect(
      service.register(
        createRegisterDto({
          role: UserRole.STAFF,
        }) as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.findOne).not.toHaveBeenCalled();
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

  it('throws a conflict when terms of service consent is missing', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.register(
        createRegisterDto({
          acceptTerms: false,
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

    expect(userRepository.manager.getRepository).not.toHaveBeenCalled();
    expect(domainRepository.save).not.toHaveBeenCalled();
    expect(skillRepository.save).not.toHaveBeenCalled();
    expect(result.role).toBe(UserRole.BROKER);
  });

  it('does not persist skill or domain associations for client registrations', async () => {
    userRepository.findOne.mockResolvedValue(null);

    const result = await service.register(
      createRegisterDto({
        role: UserRole.CLIENT,
        domainIds: ['domain-1'],
        skillIds: ['skill-1'],
      }) as any,
    );

    expect(userRepository.manager.getRepository).not.toHaveBeenCalled();
    expect(result.role).toBe(UserRole.CLIENT);
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

  it('does not fail registration when audit log persistence fails', async () => {
    userRepository.findOne.mockResolvedValue(null);
    auditLogsService.logRegistration.mockRejectedValueOnce(new Error('audit sink unavailable'));

    const result = await service.register(createRegisterDto() as any, '127.0.0.1', 'Edge');

    expect(result.id).toBe('user-1');
    expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(
      'user-1',
      'new.user@gmail.com',
    );
  });
});

describe('AuthService.registerStaff', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let emailVerificationService: { sendVerificationEmail: jest.Mock };
  let auditLogsService: { logRegistration: jest.Mock; logCustom: jest.Mock };
  let captchaService: { verifyRecaptcha: jest.Mock };
  let configService: { get: jest.Mock };
  const mockedHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
  const mockedUploadEncryptedFile = uploadEncryptedFile as jest.MockedFunction<
    typeof uploadEncryptedFile
  >;

  const createStaffFile = (overrides: Record<string, unknown> = {}) => ({
    fieldname: 'file',
    originalname: 'document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.from('file'),
    ...overrides,
  });

  const createStaffDto = (overrides: Record<string, unknown> = {}) => ({
    email: 'staff.user@gmail.com',
    password: 'securepass1',
    fullName: 'Staff User',
    phoneNumber: '0987654321',
    recaptchaToken: 'captcha-token',
    acceptTerms: true,
    acceptPrivacy: true,
    fullNameOnDocument: 'Staff User',
    documentType: 'CCCD',
    documentNumber: '0123456789',
    dateOfBirth: '1990-01-01',
    address: '123 Example Street',
    ...overrides,
  });

  const createSavedUser = (overrides: Partial<UserEntity> = {}) => {
    const user = Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'staff.user@gmail.com',
      passwordHash: 'hashed-password',
      fullName: 'Staff User',
      phoneNumber: '0987654321',
      role: UserRole.STAFF,
      timeZone: 'UTC',
      isVerified: false,
      currentTrustScore: 2.5,
      totalProjectsFinished: 0,
      totalProjectsCancelled: 0,
      totalDisputesLost: 0,
      totalLateProjects: 0,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    });

    Object.entries(overrides).forEach(([key, value]) => {
      if (value !== undefined) {
        (user as Record<string, unknown>)[key] = value;
      }
    });

    return user;
  };

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
      logCustom: jest.fn().mockResolvedValue(undefined),
    };
    captchaService = {
      verifyRecaptcha: jest.fn().mockResolvedValue(true),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) =>
        key === 'RECAPTCHA_ENABLED' ? 'true' : undefined,
      ),
    };

    mockedHash.mockReset();
    mockedHash.mockResolvedValue('hashed-password' as never);
    mockedUploadEncryptedFile.mockReset();
    mockedUploadEncryptedFile
      .mockResolvedValueOnce('kyc/user-1/id-front.jpg.encrypted')
      .mockResolvedValueOnce('kyc/user-1/id-back.jpg.encrypted')
      .mockResolvedValueOnce('kyc/user-1/selfie.jpg.encrypted');

    userRepository.save.mockImplementation(async (entity: Partial<UserEntity>) =>
      createSavedUser(entity),
    );
    profileRepository.save.mockImplementation(async (entity: Record<string, unknown>) => entity);

    const staffApplicationRepository = {
      create: jest.fn((data) => ({
        id: 'staff-application-1',
        createdAt: new Date('2026-04-13T01:00:00.000Z'),
        ...data,
      })),
      save: jest.fn().mockImplementation(async (entity: Record<string, unknown>) => entity),
    };

    userRepository.manager.getRepository.mockImplementation((entityName: unknown) => {
      if (entityName === StaffApplicationEntity) {
        return staffApplicationRepository;
      }
      throw new Error(`Unexpected repository request: ${String(entityName)}`);
    });

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      {} as any,
      configService as any,
      {} as any,
      emailVerificationService as any,
      auditLogsService as any,
      captchaService as any,
    );
  });

  it('creates a pending staff application with CV and manual KYC snapshot', async () => {
    userRepository.findOne.mockResolvedValue(null);

    const result = await service.registerStaff(
      createStaffDto() as any,
      {
        cv: createStaffFile({
          originalname: 'resume.pdf',
          mimetype: 'application/pdf',
          size: 2048,
        }) as any,
        idCardFront: createStaffFile({
          originalname: 'front.jpg',
          mimetype: 'image/jpeg',
        }) as any,
        idCardBack: createStaffFile({
          originalname: 'back.jpg',
          mimetype: 'image/jpeg',
        }) as any,
        selfie: createStaffFile({
          originalname: 'selfie.jpg',
          mimetype: 'image/jpeg',
        }) as any,
      },
      '203.0.113.10',
      'Firefox',
    );

    expect(captchaService.verifyRecaptcha).toHaveBeenCalledWith('captcha-token');
    expect(profileRepository.save).toHaveBeenCalledWith({
      userId: 'user-1',
      cvUrl: 'https://files.example.com/cvs/user-1/cv.pdf',
    });
    expect(mockedUploadEncryptedFile).toHaveBeenNthCalledWith(
      1,
      expect.any(Buffer),
      'user-1',
      'id-front',
      'image/jpeg',
    );
    expect(userRepository.manager.getRepository).toHaveBeenCalledWith(StaffApplicationEntity);
    expect(auditLogsService.logCustom).toHaveBeenCalledWith(
      'STAFF_APPLICATION_SUBMITTED',
      'StaffApplication',
      'staff-application-1',
      expect.objectContaining({
        applicationId: 'staff-application-1',
        userId: 'user-1',
        cvStorageKey: expect.stringContaining('cvs/user-1/'),
        documentType: 'CCCD',
      }),
      undefined,
      'user-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        role: UserRole.STAFF,
        cvUrl: 'https://files.example.com/cvs/user-1/cv.pdf',
        staffApprovalStatus: StaffApplicationStatus.PENDING,
      }),
    );
  });

  it('rejects duplicate email addresses before creating the account', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.registerStaff(
        createStaffDto() as any,
        {
          cv: createStaffFile() as any,
          idCardFront: createStaffFile({ mimetype: 'image/jpeg' }) as any,
          idCardBack: createStaffFile({ mimetype: 'image/jpeg' }) as any,
          selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when captcha verification fails', async () => {
    userRepository.findOne.mockResolvedValue(null);
    captchaService.verifyRecaptcha.mockResolvedValueOnce(false);

    await expect(
      service.registerStaff(
        createStaffDto() as any,
        {
          cv: createStaffFile() as any,
          idCardFront: createStaffFile({ mimetype: 'image/jpeg' }) as any,
          idCardBack: createStaffFile({ mimetype: 'image/jpeg' }) as any,
          selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the CV file is missing', async () => {
    await expect(
      service.registerStaff(createStaffDto() as any, {
        idCardFront: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        idCardBack: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
      }),
    ).rejects.toThrow('CV is required');
  });

  it('rejects invalid CV mime types', async () => {
    await expect(
      service.registerStaff(createStaffDto() as any, {
        cv: createStaffFile({ originalname: 'resume.txt', mimetype: 'text/plain' }) as any,
        idCardFront: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        idCardBack: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
      }),
    ).rejects.toThrow('Only PDF and DOCX files are allowed');
  });

  it('rejects CV uploads larger than 5MB', async () => {
    await expect(
      service.registerStaff(createStaffDto() as any, {
        cv: createStaffFile({ size: 6 * 1024 * 1024 }) as any,
        idCardFront: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        idCardBack: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
      }),
    ).rejects.toThrow('File size must not exceed 5MB');
  });

  it('rejects when one or more KYC images are missing', async () => {
    await expect(
      service.registerStaff(createStaffDto() as any, {
        cv: createStaffFile() as any,
        idCardFront: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
      }),
    ).rejects.toThrow('ID card back image is required');
  });

  it('rejects invalid KYC image mime types', async () => {
    await expect(
      service.registerStaff(createStaffDto() as any, {
        cv: createStaffFile() as any,
        idCardFront: createStaffFile({ mimetype: 'application/pdf' }) as any,
        idCardBack: createStaffFile({ mimetype: 'image/jpeg' }) as any,
        selfie: createStaffFile({ mimetype: 'image/jpeg' }) as any,
      }),
    ).rejects.toThrow('Only image files are allowed for idCardFront');
  });
});

describe('AuthService.login', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let jwtService: { sign: jest.Mock };
  let auditLogsService: { logLogin: jest.Mock };

  const mockedCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

  const createLoginUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      passwordHash: 'stored-password-hash',
      fullName: 'Member User',
      phoneNumber: '0987654321',
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      isBanned: false,
      timeZone: 'UTC',
      emailVerifiedAt: new Date('2026-03-20T09:00:00.000Z'),
      isVerified: true,
      currentTrustScore: 4.2,
      totalProjectsFinished: 3,
      totalDisputesLost: 1,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-27T09:00:00.000Z'),
      profile: null,
      ...overrides,
    });

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-access-token'),
    };
    auditLogsService = {
      logLogin: jest.fn().mockResolvedValue(undefined),
    };

    mockedCompare.mockReset();
    mockedCompare.mockResolvedValue(true as never);

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      jwtService as any,
      {} as any,
      {} as any,
      {} as any,
      auditLogsService as any,
    );
  });

  it('returns tokens, creates a session, and updates timezone when login succeeds', async () => {
    const user = createLoginUser();
    userRepository.findOne.mockResolvedValue(user);
    userRepository.update.mockResolvedValue(undefined);
    const createAuthSessionSpy = jest
      .spyOn(service as any, 'createAuthSession')
      .mockResolvedValue(undefined);

    const result = await service.login(
      {
        email: 'member@gmail.com',
        password: 'SecurePass123!',
      } as any,
      'Chrome',
      '203.0.113.10',
      'Asia/Bangkok',
    );

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'member@gmail.com' },
      relations: ['profile', 'staffApplication'],
    });
    expect(mockedCompare).toHaveBeenCalledWith('SecurePass123!', 'stored-password-hash');
    expect(userRepository.update).toHaveBeenCalledWith({ id: 'user-1' }, { timeZone: 'Asia/Bangkok' });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'member@gmail.com',
      role: UserRole.CLIENT,
    });
    expect(createAuthSessionSpy).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      'Chrome',
      '203.0.113.10',
    );
    expect(auditLogsService.logLogin).toHaveBeenCalledWith(
      'user-1',
      {
        success: true,
        userAgent: 'Chrome',
        ipAddress: '203.0.113.10',
      },
      {
        ip: '203.0.113.10',
        headers: { 'user-agent': 'Chrome' },
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'signed-access-token',
        refreshToken: expect.any(String),
      }),
    );
    expect(result.user.email).toBe('member@gmail.com');
    expect(result.user.timeZone).toBe('Asia/Bangkok');
  });

  it('normalizes login email before loading the account', async () => {
    const user = createLoginUser();
    userRepository.findOne.mockResolvedValue(user);
    userRepository.update.mockResolvedValue(undefined);
    jest.spyOn(service as any, 'createAuthSession').mockResolvedValue(undefined);

    await service.login(
      {
        email: '  MEMBER@GMAIL.COM  ',
        password: 'SecurePass123!',
      } as any,
      'Chrome',
      '203.0.113.10',
    );

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'member@gmail.com' },
      relations: ['profile', 'staffApplication'],
    });
    expect(mockedCompare).toHaveBeenCalledWith('SecurePass123!', 'stored-password-hash');
  });

  it('throws unauthorized when the email does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@gmail.com', password: 'SecurePass123!' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when the password hash is missing', async () => {
    userRepository.findOne.mockResolvedValue(createLoginUser({ passwordHash: null }));

    await expect(
      service.login({ email: 'member@gmail.com', password: 'SecurePass123!' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when the password is incorrect', async () => {
    userRepository.findOne.mockResolvedValue(createLoginUser());
    mockedCompare.mockResolvedValueOnce(false as never);

    await expect(
      service.login({ email: 'member@gmail.com', password: 'wrong-password' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when the account has been deleted', async () => {
    userRepository.findOne.mockResolvedValue(createLoginUser({ status: UserStatus.DELETED }));

    await expect(
      service.login({ email: 'member@gmail.com', password: 'SecurePass123!' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when the account has been banned', async () => {
    userRepository.findOne.mockResolvedValue(createLoginUser({ isBanned: true }));

    await expect(
      service.login({ email: 'member@gmail.com', password: 'SecurePass123!' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when the email is not verified', async () => {
    userRepository.findOne.mockResolvedValue(createLoginUser({ emailVerifiedAt: null }));

    await expect(
      service.login({ email: 'member@gmail.com', password: 'SecurePass123!' } as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'EMAIL_NOT_VERIFIED',
        email: 'member@gmail.com',
      }),
    });
  });
});

describe('AuthService.logout', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let auditLogsService: { logRegistration: jest.Mock; logLogin?: jest.Mock };

  const mockedCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();
    auditLogsService = {
      logRegistration: jest.fn(),
    };

    mockedCompare.mockReset();
    mockedCompare.mockResolvedValue(false as never);

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      auditLogsService as any,
    );
  });

  it('revokes the directly matched session when a refresh token fingerprint exists', async () => {
    authSessionRepository.findOne.mockResolvedValue({ id: 'session-1' });
    authSessionRepository.update.mockResolvedValue(undefined);

    const result = await service.logout('user-1', 'refresh-token');

    expect(authSessionRepository.findOne).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        refreshTokenFingerprint: expect.any(String),
        isRevoked: false,
      },
      select: ['id'],
    });
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-1' },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      message: expect.any(String),
    });
  });

  it('falls back to bcrypt comparison and revokes the matched legacy session', async () => {
    authSessionRepository.findOne.mockResolvedValue(null);
    authSessionRepository.find.mockResolvedValue([
      {
        id: 'legacy-session',
        refreshTokenHash: 'legacy-hash',
        refreshTokenFingerprint: null,
      },
    ]);
    authSessionRepository.update.mockResolvedValue(undefined);
    mockedCompare.mockResolvedValueOnce(true as never);

    await service.logout('user-1', 'legacy-refresh-token');

    expect(authSessionRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRevoked: false },
    });
    expect(mockedCompare).toHaveBeenCalledWith('legacy-refresh-token', 'legacy-hash');
    expect(authSessionRepository.update).toHaveBeenNthCalledWith(
      1,
      { id: 'legacy-session' },
      { refreshTokenFingerprint: expect.any(String) },
    );
    expect(authSessionRepository.update).toHaveBeenNthCalledWith(
      2,
      { id: 'legacy-session' },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
  });

  it('revokes all active sessions when no refresh token is provided', async () => {
    authSessionRepository.update.mockResolvedValue(undefined);

    await service.logout('user-1');

    expect(authSessionRepository.findOne).not.toHaveBeenCalled();
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', isRevoked: false },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
  });
});

describe('AuthService.updateProfile', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;

  const createProfileUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      fullName: 'Updated Member',
      phoneNumber: '0999888777',
      timeZone: 'Europe/Berlin',
      role: UserRole.FREELANCER,
      isVerified: true,
      emailVerifiedAt: new Date('2026-03-20T09:00:00.000Z'),
      currentTrustScore: 4.8,
      totalProjectsFinished: 6,
      totalDisputesLost: 1,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T09:00:00.000Z'),
      profile: {
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        bio: 'Updated bio',
        companyName: 'Updated Studio',
        skills: ['TypeScript', 'Testing'],
        linkedinUrl: 'https://linkedin.com/in/updated-member',
        cvUrl: 'https://cdn.example.com/updated-cv.pdf',
        portfolioLinks: [
          {
            title: 'Case Study',
            url: 'https://portfolio.example.com/case-study',
          },
        ],
      },
      ...overrides,
    });

  const updateProfileDto = {
    fullName: 'Updated Member',
    phoneNumber: '0999888777',
    timeZone: 'Europe/Berlin',
    avatarUrl: 'https://cdn.example.com/new-avatar.png',
    bio: 'Updated bio',
    companyName: 'Updated Studio',
    skills: ['TypeScript', 'Testing'],
    linkedinUrl: 'https://linkedin.com/in/updated-member',
    cvUrl: 'https://cdn.example.com/updated-cv.pdf',
    portfolioLinks: [
      {
        title: 'Case Study',
        url: 'https://portfolio.example.com/case-study',
      },
    ],
  };

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      { logRegistration: jest.fn(), logLogin: jest.fn() } as any,
    );
  });

  it('updates user fields and the existing profile, then returns the mapped response', async () => {
    profileRepository.findOne.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
    });
    userRepository.update.mockResolvedValue(undefined);
    profileRepository.update.mockResolvedValue(undefined);
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(createProfileUser());

    const result = await service.updateProfile('user-1', updateProfileDto as any);

    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        fullName: 'Updated Member',
        phoneNumber: '0999888777',
        timeZone: 'Europe/Berlin',
      },
    );
    expect(profileRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        bio: 'Updated bio',
        companyName: 'Updated Studio',
        skills: ['TypeScript', 'Testing'],
        linkedinUrl: 'https://linkedin.com/in/updated-member',
        cvUrl: 'https://cdn.example.com/updated-cv.pdf',
        portfolioLinks: [
          {
            title: 'Case Study',
            url: 'https://portfolio.example.com/case-study',
          },
        ],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'member@gmail.com',
        fullName: 'Updated Member',
        phoneNumber: '0999888777',
        timeZone: 'Europe/Berlin',
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        bio: 'Updated bio',
        companyName: 'Updated Studio',
      }),
    );
  });

  it('creates a new profile when the user does not have one yet', async () => {
    profileRepository.findOne.mockResolvedValue(null);
    profileRepository.save.mockResolvedValue(undefined);
    userRepository.update.mockResolvedValue(undefined);
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(createProfileUser());

    await service.updateProfile('user-1', updateProfileDto as any);

    expect(profileRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      avatarUrl: 'https://cdn.example.com/new-avatar.png',
      bio: 'Updated bio',
      companyName: 'Updated Studio',
      skills: ['TypeScript', 'Testing'],
      portfolioLinks: [
        {
          title: 'Case Study',
          url: 'https://portfolio.example.com/case-study',
        },
      ],
      linkedinUrl: 'https://linkedin.com/in/updated-member',
      cvUrl: 'https://cdn.example.com/updated-cv.pdf',
    });
    expect(profileRepository.save).toHaveBeenCalledTimes(1);
    expect(profileRepository.update).not.toHaveBeenCalled();
  });

  it('skips repository updates for omitted fields and still returns the persisted user', async () => {
    profileRepository.findOne.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
    });
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(
      createProfileUser({
        fullName: 'Member User',
        phoneNumber: '0987654321',
        timeZone: 'UTC',
        profile: {
          avatarUrl: undefined,
          bio: 'Only bio changed',
          companyName: undefined,
          skills: ['NestJS'],
          linkedinUrl: undefined,
          cvUrl: undefined,
          portfolioLinks: undefined,
        },
      }),
    );

    const result = await service.updateProfile(
      'user-1',
      {
        bio: 'Only bio changed',
        skills: ['NestJS'],
      } as any,
    );

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(profileRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      {
        bio: 'Only bio changed',
        skills: ['NestJS'],
      },
    );
    expect(result.bio).toBe('Only bio changed');
    expect(result.skills).toEqual(['NestJS']);
  });

  it('updates only user fields when the request does not include profile changes', async () => {
    profileRepository.findOne.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
    });
    userRepository.update.mockResolvedValue(undefined);
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(
      createProfileUser({
        fullName: 'User Only Update',
        phoneNumber: '0911222333',
        timeZone: 'Asia/Singapore',
      }),
    );

    const result = await service.updateProfile(
      'user-1',
      {
        fullName: 'User Only Update',
        phoneNumber: '0911222333',
        timeZone: 'Asia/Singapore',
      } as any,
    );

    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        fullName: 'User Only Update',
        phoneNumber: '0911222333',
        timeZone: 'Asia/Singapore',
      },
    );
    expect(profileRepository.update).not.toHaveBeenCalled();
    expect(result.fullName).toBe('User Only Update');
    expect(result.timeZone).toBe('Asia/Singapore');
  });

  it('throws when the user can no longer be loaded after the update completes', async () => {
    profileRepository.findOne.mockResolvedValue(null);
    profileRepository.save.mockResolvedValue(undefined);
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(null);

    await expect(service.updateProfile('user-1', updateProfileDto as any)).rejects.toThrow(
      'User not found after update',
    );
  });
});

describe('AuthService.getSessionUser', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;

  const createSessionUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      fullName: 'Session Member',
      phoneNumber: '0999888777',
      timeZone: 'Asia/Bangkok',
      role: UserRole.FREELANCER,
      isVerified: true,
      emailVerifiedAt: new Date('2026-03-20T09:00:00.000Z'),
      currentTrustScore: 4.8,
      totalProjectsFinished: 6,
      totalDisputesLost: 1,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T09:00:00.000Z'),
      profile: {
        avatarUrl: 'https://cdn.example.com/avatar.png',
        bio: 'Session bio',
        companyName: 'Session Studio',
        skills: ['NestJS', 'React'],
        linkedinUrl: 'https://linkedin.com/in/session-member',
        cvUrl: 'https://cdn.example.com/session-cv.pdf',
        portfolioLinks: [
          {
            title: 'Portfolio',
            url: 'https://portfolio.example.com',
          },
        ],
      },
      ...overrides,
    });

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      { logRegistration: jest.fn(), logLogin: jest.fn() } as any,
    );
  });

  it('returns the mapped authenticated session user when the account still exists', async () => {
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(createSessionUser());

    const result = await service.getSessionUser('user-1');

    expect(service.findUserWithProfile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'member@gmail.com',
        fullName: 'Session Member',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        role: UserRole.FREELANCER,
        isEmailVerified: true,
      }),
    );
  });

  it('returns the session snapshot even when the profile relation is missing', async () => {
    jest
      .spyOn(service, 'findUserWithProfile')
      .mockResolvedValue(createSessionUser({ profile: undefined }));

    const result = await service.getSessionUser('user-1');

    expect(result.email).toBe('member@gmail.com');
    expect(result.avatarUrl).toBeUndefined();
    expect(result.bio).toBeUndefined();
    expect(result.portfolioLinks).toBeUndefined();
  });

  it('throws unauthorized when the authenticated session owner no longer exists', async () => {
    jest.spyOn(service, 'findUserWithProfile').mockResolvedValue(null);

    await expect(service.getSessionUser('missing-user')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'SESSION_REVOKED',
        message: 'Authenticated user not found',
      }),
    });
  });
});

describe('AuthService.refreshToken', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let jwtService: { sign: jest.Mock };
  const mockedHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  const activeUser = Object.assign(new UserEntity(), {
    id: 'user-1',
    email: 'member@gmail.com',
    role: UserRole.CLIENT,
  });

  const activeSession = {
    id: 'session-1',
    userId: 'user-1',
    isRevoked: false,
    expiresAt: new Date('2027-04-05T09:00:00.000Z'),
  };

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();
    jwtService = {
      sign: jest.fn().mockReturnValue('refreshed-access-token'),
    };

    mockedHash.mockReset();
    mockedHash.mockResolvedValue('hashed-refresh-token' as never);

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      jwtService as any,
      {} as any,
      {} as any,
      {} as any,
      { logRegistration: jest.fn(), logLogin: jest.fn() } as any,
    );
  });

  it('rejects when the refresh token is missing', async () => {
    await expect(service.refreshToken('' as any)).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'INVALID_REFRESH',
      }),
    });
  });

  it('rejects when the refresh token does not match any stored session', async () => {
    jest.spyOn(service as any, 'findSessionByRefreshToken').mockResolvedValue(null);

    await expect(service.refreshToken('unknown-refresh-token')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'INVALID_REFRESH',
      }),
    });
  });

  it('rejects when the matched session has already been revoked', async () => {
    jest.spyOn(service as any, 'findSessionByRefreshToken').mockResolvedValue({
      ...activeSession,
      isRevoked: true,
    });

    await expect(service.refreshToken('revoked-refresh-token')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'SESSION_REVOKED',
      }),
    });
  });

  it('rejects and revokes the session when the matched refresh token has expired', async () => {
    jest.spyOn(service as any, 'findSessionByRefreshToken').mockResolvedValue({
      ...activeSession,
      expiresAt: new Date('2026-03-01T09:00:00.000Z'),
    });
    authSessionRepository.update.mockResolvedValue(undefined);

    await expect(service.refreshToken('expired-refresh-token')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'SESSION_EXPIRED',
      }),
    });

    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-1' },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
  });

  it('rejects when the session owner can no longer be loaded', async () => {
    jest.spyOn(service as any, 'findSessionByRefreshToken').mockResolvedValue(activeSession);
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.refreshToken('missing-user-refresh-token')).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'SESSION_REVOKED',
      }),
    });
  });

  it('rotates tokens and updates the persisted session when the refresh token is valid', async () => {
    jest.spyOn(service as any, 'findSessionByRefreshToken').mockResolvedValue(activeSession);
    userRepository.findOne.mockResolvedValue(activeUser);
    authSessionRepository.update.mockResolvedValue(undefined);

    const result = await service.refreshToken('valid-refresh-token');

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'member@gmail.com',
      role: UserRole.CLIENT,
    });
    expect(mockedHash).toHaveBeenCalledWith(expect.any(String), 10);
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-1' },
      expect.objectContaining({
        refreshTokenHash: 'hashed-refresh-token',
        refreshTokenFingerprint: expect.any(String),
        lastUsedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      accessToken: 'refreshed-access-token',
      refreshToken: expect.any(String),
    });
  });
});

describe('AuthService.forgotPassword', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let emailService: {
    generateOTP: jest.Mock;
    sendOTP: jest.Mock;
    maskEmail: jest.Mock;
  };

  const createForgotPasswordUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      status: UserStatus.ACTIVE,
      isBanned: false,
      ...overrides,
    });

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();
    emailService = {
      generateOTP: jest.fn().mockReturnValue('123456'),
      sendOTP: jest.fn().mockResolvedValue(undefined),
      maskEmail: jest.fn().mockReturnValue('me***@gmail.com'),
    };

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      emailService as any,
      {} as any,
      { logRegistration: jest.fn(), logLogin: jest.fn() } as any,
    );
  });

  it('stores an OTP and returns the masked email when the account is active', async () => {
    userRepository.findOne.mockResolvedValue(createForgotPasswordUser());
    userRepository.update.mockResolvedValue(undefined);

    const result = await service.forgotPassword({
      email: 'member@gmail.com',
    } as any);

    expect(emailService.generateOTP).toHaveBeenCalled();
    expect(userRepository.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        resetPasswordOtp: '123456',
        resetPasswordOtpExpires: expect.any(Date),
      }),
    );
    expect(emailService.sendOTP).toHaveBeenCalledWith('member@gmail.com', '123456');
    expect(emailService.maskEmail).toHaveBeenCalledWith('member@gmail.com');
    expect(result).toEqual({
      message: 'OTP code has been sent to your email',
      email: 'me***@gmail.com',
      expiresIn: 300,
    });
  });

  it('rejects when the account does not exist or is inactive', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.forgotPassword({
        email: 'missing@gmail.com',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    userRepository.findOne.mockResolvedValueOnce(
      createForgotPasswordUser({
        status: UserStatus.DELETED,
      }),
    );

    await expect(
      service.forgotPassword({
        email: 'deleted@gmail.com',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still returns success when OTP email delivery fails', async () => {
    userRepository.findOne.mockResolvedValue(createForgotPasswordUser());
    userRepository.update.mockResolvedValue(undefined);
    emailService.sendOTP.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await service.forgotPassword({
      email: 'member@gmail.com',
    } as any);

    expect(result.email).toBe('me***@gmail.com');
    expect(userRepository.update).toHaveBeenCalled();
  });
});

describe('AuthService.verifyOtp', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;

  const createOtpUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      status: UserStatus.ACTIVE,
      isBanned: false,
      resetPasswordOtp: '123456',
      resetPasswordOtpExpires: new Date(Date.now() + 5 * 60 * 1000),
      ...overrides,
    });

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      { logRegistration: jest.fn(), logLogin: jest.fn() } as any,
    );
  });

  it('returns a valid result when the submitted OTP matches the stored code', async () => {
    userRepository.findOne.mockResolvedValue(createOtpUser());

    const result = await service.verifyOtp({
      email: 'member@gmail.com',
      otp: '123456',
    } as any);

    expect(result).toEqual({
      message: 'OTP code is valid',
      isValid: true,
    });
  });

  it('returns an invalid result when the OTP does not match', async () => {
    userRepository.findOne.mockResolvedValue(createOtpUser());

    const result = await service.verifyOtp({
      email: 'member@gmail.com',
      otp: '654321',
    } as any);

    expect(result).toEqual({
      message: 'Incorrect OTP code',
      isValid: false,
    });
  });

  it('returns an expired result when the stored OTP has passed its expiry time', async () => {
    userRepository.findOne.mockResolvedValue(
      createOtpUser({
        resetPasswordOtpExpires: new Date(Date.now() - 5 * 60 * 1000),
      }),
    );

    const result = await service.verifyOtp({
      email: 'member@gmail.com',
      otp: '123456',
    } as any);

    expect(result).toEqual({
      message: 'OTP code has expired',
      isValid: false,
    });
  });

  it('returns a generic invalid result for missing, deleted, banned, or OTP-less accounts', async () => {
    userRepository.findOne.mockResolvedValue(null);

    const missingResult = await service.verifyOtp({
      email: 'missing@gmail.com',
      otp: '123456',
    } as any);

    expect(missingResult).toEqual({
      message: 'Invalid OTP code',
      isValid: false,
    });

    userRepository.findOne.mockResolvedValueOnce(
      createOtpUser({
        isBanned: true,
      }),
    );

    const bannedResult = await service.verifyOtp({
      email: 'member@gmail.com',
      otp: '123456',
    } as any);

    expect(bannedResult).toEqual({
      message: 'Invalid OTP code',
      isValid: false,
    });
  });
});

describe('AuthService.resetPassword', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  const mockedHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  const createResetPasswordUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      status: UserStatus.ACTIVE,
      isBanned: false,
      resetPasswordOtp: '123456',
      resetPasswordOtpExpires: new Date(Date.now() + 5 * 60 * 1000),
      ...overrides,
    });

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();

    mockedHash.mockReset();
    mockedHash.mockResolvedValue('hashed-new-password' as never);

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      { logRegistration: jest.fn(), logLogin: jest.fn() } as any,
    );
  });

  it('hashes the new password, clears OTP state, and revokes sessions when reset succeeds', async () => {
    userRepository.findOne.mockResolvedValue(createResetPasswordUser());
    userRepository.update.mockResolvedValue(undefined);
    authSessionRepository.update.mockResolvedValue(undefined);

    const result = await service.resetPassword({
      email: 'member@gmail.com',
      otp: '123456',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    } as any);

    expect(mockedHash).toHaveBeenCalledWith('newpass123', 10);
    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      passwordHash: 'hashed-new-password',
      resetPasswordOtp: undefined,
      resetPasswordOtpExpires: undefined,
    });
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', isRevoked: false },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      message: 'Password reset successful. Please login again.',
    });
  });

  it('rejects when password confirmation does not match', async () => {
    await expect(
      service.resetPassword({
        email: 'member@gmail.com',
        otp: '123456',
        newPassword: 'newpass123',
        confirmPassword: 'different123',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the account is missing, deleted, banned, or has no OTP state', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resetPassword({
        email: 'missing@gmail.com',
        otp: '123456',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    userRepository.findOne.mockResolvedValueOnce(
      createResetPasswordUser({
        status: UserStatus.DELETED,
      }),
    );

    await expect(
      service.resetPassword({
        email: 'deleted@gmail.com',
        otp: '123456',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the stored OTP has expired', async () => {
    userRepository.findOne.mockResolvedValue(
      createResetPasswordUser({
        resetPasswordOtpExpires: new Date(Date.now() - 5 * 60 * 1000),
      }),
    );

    await expect(
      service.resetPassword({
        email: 'member@gmail.com',
        otp: '123456',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the submitted OTP does not match the stored OTP', async () => {
    userRepository.findOne.mockResolvedValue(createResetPasswordUser());

    await expect(
      service.resetPassword({
        email: 'member@gmail.com',
        otp: '654321',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.checkActiveObligations', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      { log: jest.fn() } as any,
    );
  });

  it('returns hasObligations true when active projects or wallet balance exist', async () => {
    projectRepository.count.mockResolvedValue(2);
    walletRepository.findOne.mockResolvedValue({
      balance: '150.5',
      pendingBalance: '49.5',
    });

    const result = await service.checkActiveObligations('user-1');

    expect(projectRepository.count).toHaveBeenCalledWith({
      where: [
        { clientId: 'user-1', status: expect.any(Object) },
        { brokerId: 'user-1', status: expect.any(Object) },
        { freelancerId: 'user-1', status: expect.any(Object) },
      ],
    });
    expect(walletRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(result).toEqual({
      hasObligations: true,
      activeProjects: 2,
      walletBalance: 200,
    });
  });

  it('returns hasObligations false when there are no active projects and no wallet balance', async () => {
    projectRepository.count.mockResolvedValue(0);
    walletRepository.findOne.mockResolvedValue(null);

    const result = await service.checkActiveObligations('user-2');

    expect(result).toEqual({
      hasObligations: false,
      activeProjects: 0,
      walletBalance: 0,
    });
  });

  it('returns hasObligations true when only wallet balance remains', async () => {
    projectRepository.count.mockResolvedValue(0);
    walletRepository.findOne.mockResolvedValue({
      balance: '0',
      pendingBalance: '15.75',
    });

    const result = await service.checkActiveObligations('user-3');

    expect(result).toEqual({
      hasObligations: true,
      activeProjects: 0,
      walletBalance: 15.75,
    });
  });
});

describe('AuthService.deleteAccount', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let auditLogsService: { log: jest.Mock };
  const mockedCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

  const createDeletableUser = (overrides: Record<string, unknown> = {}) =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      fullName: 'Member User',
      role: UserRole.CLIENT,
      passwordHash: 'hashed-password',
      status: UserStatus.ACTIVE,
      isVerified: true,
      phoneNumber: '0987654321',
      ...overrides,
    });

  beforeEach(() => {
    userRepository = createRepositoryMock();
    authSessionRepository = createRepositoryMock();
    profileRepository = createRepositoryMock();
    projectRepository = createRepositoryMock();
    walletRepository = createRepositoryMock();
    auditLogsService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockedCompare.mockReset();

    service = new AuthService(
      userRepository as any,
      authSessionRepository as any,
      profileRepository as any,
      projectRepository as any,
      walletRepository as any,
      { sign: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      auditLogsService as any,
    );
  });

  it('revokes sessions, anonymizes account data, and returns success when deletion is allowed', async () => {
    userRepository.findOne.mockResolvedValue(createDeletableUser());
    mockedCompare.mockResolvedValue(true as never);
    projectRepository.count.mockResolvedValue(0);
    walletRepository.findOne.mockResolvedValue({
      balance: '0',
      pendingBalance: '0',
    });
    authSessionRepository.update.mockResolvedValue(undefined);
    userRepository.update.mockResolvedValue(undefined);
    profileRepository.update.mockResolvedValue(undefined);

    const result = await service.deleteAccount('user-1', {
      password: 'currentPassword123',
      reason: 'No longer need the service',
    } as any);

    expect(mockedCompare).toHaveBeenCalledWith('currentPassword123', 'hashed-password');
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1', isRevoked: false },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({
        status: UserStatus.DELETED,
        deletedReason: 'No longer need the service',
        email: expect.stringMatching(/^deleted_.+@system\.local$/),
        fullName: 'Deleted User',
        phoneNumber: '',
        passwordHash: '',
        isVerified: false,
      }),
    );
    expect(profileRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      expect.objectContaining({
        bio: '',
        linkedinUrl: '',
        cvUrl: '',
        avatarUrl: '',
        portfolioLinks: [],
      }),
    );
    expect(auditLogsService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'ACCOUNT_DELETED',
        entityType: 'USER',
        entityId: 'user-1',
      }),
    );
    expect(result).toEqual({
      message: 'Account has been deleted successfully',
    });
  });

  it('rejects when the password is incorrect', async () => {
    userRepository.findOne.mockResolvedValue(createDeletableUser());
    mockedCompare.mockResolvedValue(false as never);

    await expect(
      service.deleteAccount('user-1', {
        password: 'wrong-password',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when active obligations still exist', async () => {
    userRepository.findOne.mockResolvedValue(createDeletableUser());
    mockedCompare.mockResolvedValue(true as never);
    projectRepository.count.mockResolvedValue(1);
    walletRepository.findOne.mockResolvedValue({
      balance: '0',
      pendingBalance: '25',
    });

    await expect(
      service.deleteAccount('user-1', {
        password: 'currentPassword123',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the account is missing, already deleted, or has no password', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.deleteAccount('missing-user', {
        password: 'currentPassword123',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    userRepository.findOne.mockResolvedValueOnce(
      createDeletableUser({
        status: UserStatus.DELETED,
      }),
    );

    await expect(
      service.deleteAccount('deleted-user', {
        password: 'currentPassword123',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    userRepository.findOne.mockResolvedValueOnce(
      createDeletableUser({
        passwordHash: '',
      }),
    );

    await expect(
      service.deleteAccount('passwordless-user', {
        password: 'currentPassword123',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
