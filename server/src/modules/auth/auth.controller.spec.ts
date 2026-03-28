import { UnauthorizedException } from '@nestjs/common';

import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { BadgeType, AuthResponseDto } from './dto';
import { UserRole } from '../../database/entities/user.entity';

const authResponse: AuthResponseDto = {
  id: 'user-1',
  email: 'new.user@gmail.com',
  fullName: 'New User',
  phoneNumber: '0987654321',
  timeZone: 'UTC',
  role: UserRole.CLIENT,
  isVerified: false,
  isEmailVerified: false,
  currentTrustScore: 2.5,
  badge: BadgeType.NEW,
  stats: {
    finished: 0,
    disputes: 0,
    score: 2.5,
  },
  createdAt: new Date('2026-03-27T09:00:00.000Z'),
  updatedAt: new Date('2026-03-27T09:00:00.000Z'),
};

const registerDto = {
  email: 'new.user@gmail.com',
  password: 'securepass1',
  fullName: 'New User',
  phoneNumber: '0987654321',
  role: UserRole.CLIENT,
  acceptTerms: true,
  acceptPrivacy: true,
};

const loginDto = {
  email: 'member@gmail.com',
  password: 'SecurePass123!',
};

const secureLoginResult = {
  user: authResponse,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

const persistedProfileUser = {
  id: 'user-1',
  email: 'member@gmail.com',
  fullName: 'Persisted Member',
  phoneNumber: '0111222333',
  timeZone: 'Asia/Bangkok',
  role: UserRole.FREELANCER,
  isVerified: true,
  emailVerifiedAt: new Date('2026-03-20T09:00:00.000Z'),
  currentTrustScore: 4.8,
  badge: BadgeType.TRUSTED,
  totalProjectsFinished: 6,
  totalDisputesLost: 1,
  createdAt: new Date('2026-03-01T09:00:00.000Z'),
  updatedAt: new Date('2026-03-27T09:00:00.000Z'),
  profile: {
    avatarUrl: 'https://cdn.example.com/avatar.png',
    bio: 'Experienced full-stack engineer',
    companyName: 'Acme Studio',
    skills: ['NestJS', 'React'],
    linkedinUrl: 'https://linkedin.com/in/member',
    cvUrl: 'https://cdn.example.com/member-cv.pdf',
    portfolioLinks: [
      {
        title: 'Portfolio',
        url: 'https://portfolio.example.com',
      },
    ],
  },
};

const profileUpdateDto = {
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

const updatedProfileResponse: AuthResponseDto = {
  ...authResponse,
  fullName: 'Updated Member',
  phoneNumber: '0999888777',
  timeZone: 'Europe/Berlin',
  role: UserRole.FREELANCER,
  isVerified: true,
  isEmailVerified: true,
  currentTrustScore: 4.8,
  badge: BadgeType.TRUSTED,
  stats: {
    finished: 6,
    disputes: 1,
    score: 4.8,
  },
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

const createResponseMock = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const profileUser = {
  id: 'user-1',
  email: 'viewer@gmail.com',
  fullName: 'Viewer User',
  phoneNumber: '0987654321',
  timeZone: 'Asia/Bangkok',
  role: UserRole.CLIENT,
  isVerified: true,
  emailVerifiedAt: new Date('2026-03-01T00:00:00.000Z'),
  currentTrustScore: 4.2,
  badge: BadgeType.VERIFIED,
  totalProjectsFinished: 3,
  totalDisputesLost: 1,
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
  updatedAt: new Date('2026-03-27T09:00:00.000Z'),
  profile: {
    avatarUrl: 'https://cdn.example.com/avatar.png',
    bio: 'Profile bio',
    companyName: 'Profile Co',
    skills: ['NestJS', 'TypeScript'],
    linkedinUrl: 'https://www.linkedin.com/in/viewer',
    cvUrl: 'https://cdn.example.com/cv.pdf',
    portfolioLinks: [{ title: 'Portfolio', url: 'https://example.com' }],
  },
};

describe('AuthController.register', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue(authResponse),
      login: jest.fn(),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('passes ip and user agent to the service and wraps the response payload', async () => {
    const result = await controller.register(registerDto as any, '127.0.0.1', {
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
    } as any);

    expect(authService.register).toHaveBeenCalledWith(registerDto, '127.0.0.1', 'Mozilla/5.0');
    expect(result.data).toBe(authResponse);
    expect(result.message).toEqual(expect.any(String));
  });

  it('falls back to Unknown Device when the request omits a user agent', async () => {
    await controller.register(registerDto as any, '127.0.0.1', {
      headers: {},
    } as any);

    expect(authService.register).toHaveBeenCalledWith(
      registerDto,
      '127.0.0.1',
      'Unknown Device',
    );
  });
});

describe('AuthController.login', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn().mockResolvedValue(secureLoginResult),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('passes request metadata to the service, sets cookies, and strips tokens from the response body', async () => {
    const response = createResponseMock();

    const result = await controller.login(
      loginDto as any,
      {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-timezone': 'Asia/Bangkok',
        },
        ip: '203.0.113.10',
        connection: {
          remoteAddress: '10.0.0.20',
        },
      } as any,
      response as any,
    );

    expect(authService.login).toHaveBeenCalledWith(
      loginDto,
      'Mozilla/5.0',
      '203.0.113.10',
      'Asia/Bangkok',
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      'access-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(result).toEqual({
      message: expect.any(String),
      data: {
        user: authResponse,
      },
    });
  });

  it('falls back to Unknown Device and Unknown IP when request metadata is missing', async () => {
    const response = createResponseMock();

    await controller.login(
      loginDto as any,
      {
        headers: {},
        connection: {},
      } as any,
      response as any,
    );

    expect(authService.login).toHaveBeenCalledWith(
      loginDto,
      'Unknown Device',
      'Unknown IP',
      undefined,
    );
  });
});

describe('AuthController.getProfile', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(() => {
    authService = {
      findUserWithProfile: jest.fn().mockResolvedValue(profileUser),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('returns the authenticated profile with merged core and profile fields', async () => {
    const result = await controller.getProfile({
      user: {
        id: 'user-1',
      },
    } as any);

    expect(authService.findUserWithProfile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      message: expect.any(String),
      data: expect.objectContaining({
        id: 'user-1',
        email: 'viewer@gmail.com',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        companyName: 'Profile Co',
        stats: {
          finished: 3,
          disputes: 1,
          score: 4.2,
        },
      }),
    });
  });

  it('rejects profile viewing when the authenticated user can no longer be loaded', async () => {
    authService.findUserWithProfile.mockResolvedValueOnce(null);

    try {
      await controller.getProfile({
        user: {
          id: 'missing-user',
        },
      } as any);
      throw new Error('Expected UnauthorizedException');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        error: 'SESSION_REVOKED',
        message: 'Authenticated user not found',
      });
    }
  });

  it('preserves falsy profile values when mapping the authenticated profile response', async () => {
    authService.findUserWithProfile.mockResolvedValueOnce({
      ...profileUser,
      phoneNumber: '',
      isVerified: false,
      emailVerifiedAt: null,
      currentTrustScore: 0,
      badge: undefined,
      totalProjectsFinished: 0,
      totalDisputesLost: 0,
      profile: null,
    });

    const result = await controller.getProfile({
      user: {
        id: 'user-1',
      },
    } as any);

    expect(result.data).toEqual(
      expect.objectContaining({
        phoneNumber: '',
        isVerified: false,
        isEmailVerified: false,
        currentTrustScore: 0,
        avatarUrl: undefined,
        badge: 'NORMAL',
        stats: {
          finished: 0,
          disputes: 0,
          score: 0,
        },
      }),
    );
  });
});

describe('AuthController.updateProfile', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(() => {
    authService = {
      updateProfile: jest.fn().mockResolvedValue(authResponse),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('forwards the authenticated user id and wraps the updated profile payload', async () => {
    const updateProfileDto = {
      fullName: 'Updated User',
      bio: 'Updated profile bio',
      skills: ['NestJS'],
    };

    const result = await controller.updateProfile(
      {
        user: {
          id: 'user-1',
        },
      } as any,
      updateProfileDto as any,
    );

    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', updateProfileDto);
    expect(result).toEqual({
      message: expect.any(String),
      data: authResponse,
    });
  });
});

describe('AuthController.getProfile', () => {
  let controller: AuthController;
  let authService: { findUserWithProfile: jest.Mock };

  beforeEach(() => {
    authService = {
      findUserWithProfile: jest.fn().mockResolvedValue(persistedProfileUser),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('returns persisted account fields from the database instead of the sparse JWT payload', async () => {
    const result = await controller.getProfile({
      user: {
        id: 'user-1',
        email: 'jwt-only@gmail.com',
        role: UserRole.FREELANCER,
      },
    } as any);

    expect(authService.findUserWithProfile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      message: expect.any(String),
      data: {
        id: 'user-1',
        email: 'member@gmail.com',
        fullName: 'Persisted Member',
        phoneNumber: '0111222333',
        timeZone: 'Asia/Bangkok',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        bio: 'Experienced full-stack engineer',
        companyName: 'Acme Studio',
        skills: ['NestJS', 'React'],
        linkedinUrl: 'https://linkedin.com/in/member',
        cvUrl: 'https://cdn.example.com/member-cv.pdf',
        portfolioLinks: [
          {
            title: 'Portfolio',
            url: 'https://portfolio.example.com',
          },
        ],
        role: UserRole.FREELANCER,
        isVerified: true,
        isEmailVerified: true,
        currentTrustScore: 4.8,
        badge: BadgeType.TRUSTED,
        stats: {
          finished: 6,
          disputes: 1,
          score: 4.8,
        },
        createdAt: new Date('2026-03-01T09:00:00.000Z'),
        updatedAt: new Date('2026-03-27T09:00:00.000Z'),
      },
    });
  });

  it('returns account details even when the profile relation is missing', async () => {
    authService.findUserWithProfile.mockResolvedValueOnce({
      ...persistedProfileUser,
      profile: undefined,
    });

    const result = await controller.getProfile({
      user: {
        id: 'user-1',
        email: 'jwt-only@gmail.com',
        role: UserRole.FREELANCER,
      },
    } as any);

    expect(result.data.fullName).toBe('Persisted Member');
    expect(result.data.avatarUrl).toBeUndefined();
    expect(result.data.bio).toBeUndefined();
    expect(result.data.portfolioLinks).toBeUndefined();
  });

  it('throws unauthorized when the authenticated user no longer exists', async () => {
    authService.findUserWithProfile.mockResolvedValueOnce(null);

    await expect(
      controller.getProfile({
        user: {
          id: 'missing-user',
          email: 'missing@gmail.com',
          role: UserRole.CLIENT,
        },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthController.updateProfile', () => {
  let controller: AuthController;
  let authService: { updateProfile: jest.Mock };

  beforeEach(() => {
    authService = {
      updateProfile: jest.fn().mockResolvedValue(updatedProfileResponse),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('forwards the authenticated user id and returns the updated profile payload', async () => {
    const result = await controller.updateProfile(
      {
        user: {
          id: 'user-1',
        },
      } as any,
      profileUpdateDto as any,
    );

    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', profileUpdateDto);
    expect(result).toEqual({
      message: expect.any(String),
      data: updatedProfileResponse,
    });
  });
});
