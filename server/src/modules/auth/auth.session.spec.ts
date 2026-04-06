import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
  };
});

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('AuthService session flows', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let authSessionRepository: ReturnType<typeof createRepositoryMock>;
  let profileRepository: ReturnType<typeof createRepositoryMock>;
  let projectRepository: ReturnType<typeof createRepositoryMock>;
  let walletRepository: ReturnType<typeof createRepositoryMock>;
  let jwtService: { sign: jest.Mock };
  let auditLogsService: { logLogin: jest.Mock };

  const mockedHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
  const mockedCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
  const mockedRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>;
  const fixedNow = new Date('2026-03-27T10:00:00.000Z');

  const createUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    Object.assign(new UserEntity(), {
      id: 'user-1',
      email: 'member@gmail.com',
      passwordHash: 'stored-password-hash',
      fullName: 'Session User',
      phoneNumber: '0987654321',
      role: UserRole.CLIENT,
      timeZone: 'UTC',
      isVerified: false,
      currentTrustScore: 3.4,
      totalProjectsFinished: 2,
      totalProjectsCancelled: 0,
      totalDisputesLost: 0,
      totalLateProjects: 0,
      emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z'),
      status: UserStatus.ACTIVE,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      profile: null,
      ...overrides,
    });

  const createSession = (overrides: Partial<AuthSessionEntity> = {}): AuthSessionEntity =>
    Object.assign(new AuthSessionEntity(), {
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'stored-refresh-hash',
      refreshTokenFingerprint: 'stored-refresh-fingerprint',
      userAgent: 'Chrome',
      ipAddress: '127.0.0.1',
      isRevoked: false,
      revokedAt: null,
      expiresAt: new Date('2027-04-05T00:00:00.000Z'),
      createdAt: new Date('2026-03-20T00:00:00.000Z'),
      lastUsedAt: fixedNow,
      replacedBySessionId: null,
      validAccessFrom: fixedNow,
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
    jwtService = {
      sign: jest.fn().mockReturnValue('access-token'),
    };
    auditLogsService = {
      logLogin: jest.fn().mockResolvedValue(undefined),
    };

    mockedHash.mockReset();
    mockedHash.mockResolvedValue('hashed-refresh-token' as never);

    mockedCompare.mockReset();
    mockedCompare.mockResolvedValue(true as never);

    mockedRandomBytes.mockReset();
    mockedRandomBytes.mockReturnValue(Buffer.alloc(64, 1) as never);

    authSessionRepository.find.mockResolvedValue([]);
    authSessionRepository.create.mockImplementation((data: Partial<AuthSessionEntity>) =>
      Object.assign(new AuthSessionEntity(), data),
    );
    authSessionRepository.save.mockImplementation(async (session: Partial<AuthSessionEntity>) =>
      createSession({ id: 'session-new', ...session }),
    );
    authSessionRepository.update.mockResolvedValue({ affected: 1 });
    authSessionRepository.delete.mockResolvedValue({ affected: 0 });
    userRepository.update.mockResolvedValue({ affected: 1 });

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

  it('logs in successfully, rotates same-device sessions, and saves a new auth session', async () => {
    const user = createUser();
    const issuedRefreshToken = Buffer.alloc(64, 1).toString('hex');

    userRepository.findOne.mockResolvedValue(user);
    mockedCompare.mockResolvedValueOnce(true as never);
    mockedHash.mockResolvedValueOnce('hashed-session-token' as never);

    const result = await service.login(
      {
        email: user.email,
        password: 'SecurePass123!',
      } as any,
      'Chrome',
      '127.0.0.1',
      'Asia/Bangkok',
    );

    expect(userRepository.update).toHaveBeenCalledWith({ id: user.id }, { timeZone: 'Asia/Bangkok' });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      {
        userId: user.id,
        userAgent: 'Chrome',
        isRevoked: false,
      },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(authSessionRepository.delete).toHaveBeenCalledWith({
      userId: user.id,
      expiresAt: expect.any(Object),
    });
    expect(authSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        refreshTokenHash: 'hashed-session-token',
        refreshTokenFingerprint: expect.any(String),
        userAgent: 'Chrome',
        ipAddress: '127.0.0.1',
        isRevoked: false,
      }),
    );
    expect(auditLogsService.logLogin).toHaveBeenCalledWith(
      user.id,
      {
        success: true,
        userAgent: 'Chrome',
        ipAddress: '127.0.0.1',
      },
      {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Chrome',
        },
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: issuedRefreshToken,
        user: expect.objectContaining({
          id: user.id,
          email: user.email,
          timeZone: 'Asia/Bangkok',
        }),
      }),
    );
  });

  it('rejects login when the email does not match any account', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expectUnauthorized(
      service.login({
        email: 'missing@gmail.com',
        password: 'SecurePass123!',
      } as any),
      { message: 'Invalid email or password' },
    );

    expect(authSessionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects login when the password is incorrect', async () => {
    userRepository.findOne.mockResolvedValue(createUser());
    mockedCompare.mockResolvedValueOnce(false as never);

    await expectUnauthorized(
      service.login({
        email: 'member@gmail.com',
        password: 'WrongPass123!',
      } as any),
      { message: 'Invalid email or password' },
    );

    expect(authSessionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects login when the stored password hash is missing', async () => {
    userRepository.findOne.mockResolvedValue(
      createUser({
        passwordHash: null as any,
      }),
    );

    await expectUnauthorized(
      service.login({
        email: 'member@gmail.com',
        password: 'SecurePass123!',
      } as any),
      { message: 'Invalid email or password' },
    );

    expect(mockedCompare).not.toHaveBeenCalled();
    expect(authSessionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects login when the account has been deleted', async () => {
    userRepository.findOne.mockResolvedValue(
      createUser({
        status: UserStatus.DELETED,
      }),
    );

    await expectUnauthorized(
      service.login({
        email: 'member@gmail.com',
        password: 'SecurePass123!',
      } as any),
      { message: 'This account has been deleted' },
    );

    expect(authSessionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects login when the account has been banned', async () => {
    userRepository.findOne.mockResolvedValue(
      createUser({
        isBanned: true,
      }),
    );

    await expectUnauthorized(
      service.login({
        email: 'member@gmail.com',
        password: 'SecurePass123!',
      } as any),
      { message: 'This account has been banned. Please contact support.' },
    );

    expect(authSessionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects login when the user email has not been verified', async () => {
    userRepository.findOne.mockResolvedValue(
      createUser({
        emailVerifiedAt: null as any,
      }),
    );

    await expectUnauthorized(
      service.login({
        email: 'member@gmail.com',
        password: 'SecurePass123!',
      } as any),
      {
        error: 'EMAIL_NOT_VERIFIED',
        email: 'member@gmail.com',
      },
    );

    expect(authSessionRepository.save).not.toHaveBeenCalled();
  });

  it('revokes only the directly matched session during logout', async () => {
    authSessionRepository.findOne.mockResolvedValue({ id: 'session-direct' });

    const result = await service.logout('user-1', 'refresh-token');

    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-direct' },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(authSessionRepository.find).not.toHaveBeenCalled();
    expect(result.message).toEqual(expect.any(String));
  });

  it('revokes all active sessions when logout has no refresh token', async () => {
    const result = await service.logout('user-1');

    expect(authSessionRepository.update).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        isRevoked: false,
      },
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(result.message).toEqual(expect.any(String));
  });

  it('refreshes tokens for a valid active session and rotates the stored hash', async () => {
    const existingSession = createSession({
      id: 'session-rotate',
      expiresAt: new Date('2027-04-10T00:00:00.000Z'),
    });
    const user = createUser();
    const issuedRefreshToken = Buffer.alloc(64, 2).toString('hex');

    authSessionRepository.findOne.mockResolvedValue(existingSession);
    userRepository.findOne.mockResolvedValue(user);
    jwtService.sign.mockReturnValueOnce('rotated-access-token');
    mockedRandomBytes.mockReturnValueOnce(Buffer.alloc(64, 2) as never);
    mockedHash.mockResolvedValueOnce('rotated-refresh-hash' as never);

    const result = await service.refreshToken('previous-refresh-token');

    expect(authSessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-rotate' },
      expect.objectContaining({
        refreshTokenHash: 'rotated-refresh-hash',
        refreshTokenFingerprint: expect.any(String),
        lastUsedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      accessToken: 'rotated-access-token',
      refreshToken: issuedRefreshToken,
    });
  });

  it('rejects refresh when no active session matches the submitted token', async () => {
    authSessionRepository.findOne.mockResolvedValue(null);
    authSessionRepository.find.mockResolvedValue([]);

    await expectUnauthorized(service.refreshToken('invalid-refresh-token'), {
      error: 'INVALID_REFRESH',
      message: 'Refresh token is invalid',
    });

    expect(authSessionRepository.update).not.toHaveBeenCalled();
  });

  it('rejects refresh when the owning user no longer exists', async () => {
    authSessionRepository.findOne.mockResolvedValue(
      createSession({
        id: 'session-orphaned',
        userId: 'missing-user',
      }),
    );
    userRepository.findOne.mockResolvedValue(null);

    await expectUnauthorized(service.refreshToken('valid-refresh-token'), {
      error: 'SESSION_REVOKED',
      message: 'Session owner no longer exists',
    });
  });

  it('creates an auth session with fallback device metadata when request metadata is missing', async () => {
    mockedHash.mockResolvedValueOnce('hashed-private-session-token' as never);

    await (service as any).createAuthSession('user-1', 'plain-refresh-token');

    expect(authSessionRepository.update).not.toHaveBeenCalled();
    expect(authSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshTokenHash: 'hashed-private-session-token',
        refreshTokenFingerprint: expect.any(String),
        userAgent: 'Unknown Device',
        ipAddress: 'Unknown IP',
        isRevoked: false,
      }),
    );
    expect(authSessionRepository.save).toHaveBeenCalled();
  });

  it('cleans up expired sessions and revokes overflow active sessions beyond the cap', async () => {
    authSessionRepository.find.mockResolvedValue([
      createSession({ id: 'session-1' }),
      createSession({ id: 'session-2' }),
      createSession({ id: 'session-3' }),
      createSession({ id: 'session-4' }),
      createSession({ id: 'session-5' }),
      createSession({ id: 'session-6' }),
    ]);

    await (service as any).cleanupExpiredSessions('user-1');

    expect(authSessionRepository.delete).toHaveBeenCalledWith({
      userId: 'user-1',
      expiresAt: expect.any(Object),
    });
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      'session-5',
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
    expect(authSessionRepository.update).toHaveBeenCalledWith(
      'session-6',
      expect.objectContaining({
        isRevoked: true,
        revokedAt: expect.any(Date),
      }),
    );
  });
});
