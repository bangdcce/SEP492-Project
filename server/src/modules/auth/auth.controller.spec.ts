import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

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

const profileResponse: AuthResponseDto = {
  id: 'user-1',
  email: 'viewer@gmail.com',
  fullName: 'Viewer User',
  phoneNumber: '0987654321',
  timeZone: 'Asia/Bangkok',
  avatarUrl: 'https://cdn.example.com/avatar.png',
  bio: 'Profile bio',
  companyName: 'Profile Co',
  skills: ['NestJS', 'TypeScript'],
  linkedinUrl: 'https://www.linkedin.com/in/viewer',
  cvUrl: 'https://cdn.example.com/cv.pdf',
  portfolioLinks: [{ title: 'Portfolio', url: 'https://example.com' }],
  role: UserRole.CLIENT,
  isVerified: true,
  isEmailVerified: true,
  currentTrustScore: 4.2,
  badge: BadgeType.VERIFIED,
  stats: {
    finished: 3,
    disputes: 1,
    score: 4.2,
  },
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
  updatedAt: new Date('2026-03-27T09:00:00.000Z'),
};

const persistedProfileResponse: AuthResponseDto = {
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

  it('rethrows service exceptions so the HTTP layer can return the conflict response', async () => {
    authService.register.mockRejectedValueOnce(new ConflictException('Email already exists'));

    await expect(
      controller.register(registerDto as any, '127.0.0.1', {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AuthController.verifyEmail', () => {
  let controller: AuthController;
  let emailVerificationService: Record<string, jest.Mock>;

  beforeEach(() => {
    emailVerificationService = {
      verifyEmail: jest.fn().mockResolvedValue({
        message: 'Email verified successfully',
        email: 'member@gmail.com',
      }),
    };

    controller = new AuthController(
      {
        register: jest.fn(),
        login: jest.fn(),
      } as any,
      emailVerificationService as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('passes the token to the verification service and returns its payload', async () => {
    const result = await controller.verifyEmail('valid-token');

    expect(emailVerificationService.verifyEmail).toHaveBeenCalledWith('valid-token');
    expect(result).toEqual({
      message: 'Email verified successfully',
      email: 'member@gmail.com',
    });
  });

  it('rethrows service errors so the HTTP layer can return a bad request response', async () => {
    emailVerificationService.verifyEmail.mockRejectedValueOnce(
      new BadRequestException('Invalid token'),
    );

    await expect(controller.verifyEmail('invalid-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('AuthController.resendVerification', () => {
  let controller: AuthController;
  let emailVerificationService: Record<string, jest.Mock>;

  beforeEach(() => {
    emailVerificationService = {
      resendVerificationEmail: jest.fn().mockResolvedValue({
        message: 'Verification email sent. Please check your inbox.',
      }),
    };

    controller = new AuthController(
      {
        register: jest.fn(),
        login: jest.fn(),
      } as any,
      emailVerificationService as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('passes the email to the verification service and returns its payload', async () => {
    const result = await controller.resendVerification('member@gmail.com');

    expect(emailVerificationService.resendVerificationEmail).toHaveBeenCalledWith(
      'member@gmail.com',
    );
    expect(result).toEqual({
      message: 'Verification email sent. Please check your inbox.',
    });
  });

  it('rethrows service errors so the HTTP layer can return the not found response', async () => {
    emailVerificationService.resendVerificationEmail.mockRejectedValueOnce(
      new NotFoundException('User not found'),
    );

    await expect(controller.resendVerification('missing@gmail.com')).rejects.toBeInstanceOf(
      NotFoundException,
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

describe('AuthController.logout', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(() => {
    authService = {
      logout: jest.fn().mockResolvedValue({
        message: 'Logout successful',
      }),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('passes the authenticated user id and refresh token to the service, then clears auth cookies', async () => {
    const response = createResponseMock();

    const result = await controller.logout(
      {
        user: {
          id: 'user-1',
        },
        cookies: {
          refreshToken: 'refresh-token',
        },
      } as any,
      response as any,
    );

    expect(authService.logout).toHaveBeenCalledWith('user-1', 'refresh-token');
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(result).toEqual({
      message: 'Logout successful',
      data: null,
    });
  });

  it('passes undefined refresh token when the cookie is missing', async () => {
    const response = createResponseMock();

    await controller.logout(
      {
        user: {
          id: 'user-2',
        },
        cookies: {},
      } as any,
      response as any,
    );

    expect(authService.logout).toHaveBeenCalledWith('user-2', undefined);
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
      data: profileResponse,
    });
  });

  it('rejects profile viewing when the authenticated user can no longer be loaded', async () => {
    authService.findUserWithProfile.mockResolvedValueOnce(null);

    await expect(
      controller.getProfile({
        user: {
          id: 'missing-user',
        },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('preserves falsy profile values when mapping the authenticated profile response', async () => {
    authService.findUserWithProfile.mockResolvedValueOnce({
      ...profileUser,
      phoneNumber: '',
      isVerified: false,
      emailVerifiedAt: null,
      currentTrustScore: 0,
      profile: {
        avatarUrl: undefined,
        bio: undefined,
        companyName: undefined,
        skills: undefined,
        linkedinUrl: undefined,
        cvUrl: undefined,
        portfolioLinks: undefined,
      },
      badge: 'NORMAL',
      totalProjectsFinished: 0,
      totalDisputesLost: 0,
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
      data: persistedProfileResponse,
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

describe('AuthController.getSession', () => {
  let controller: AuthController;
  let authService: { getSessionUser: jest.Mock };

  beforeEach(() => {
    authService = {
      getSessionUser: jest.fn().mockResolvedValue(updatedProfileResponse),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('returns the authenticated session snapshot from the service', async () => {
    const result = await controller.getSession({
      user: {
        id: 'user-1',
      },
    } as any);

    expect(authService.getSessionUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      message: 'Session is valid',
      data: updatedProfileResponse,
    });
  });

  it('rethrows service errors so the HTTP layer can return an unauthorized response', async () => {
    authService.getSessionUser.mockRejectedValueOnce(
      new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Authenticated user not found',
      }),
    );

    await expect(
      controller.getSession({
        user: {
          id: 'missing-user',
        },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthController.refreshToken', () => {
  let controller: AuthController;
  let authService: { refreshToken: jest.Mock };

  beforeEach(() => {
    authService = {
      refreshToken: jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('refreshes tokens, sets cookies, and returns an empty data payload', async () => {
    const response = createResponseMock();

    const result = await controller.refreshToken(
      {
        cookies: {
          refreshToken: 'current-refresh-token',
        },
      } as any,
      response as any,
    );

    expect(authService.refreshToken).toHaveBeenCalledWith('current-refresh-token');
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      'new-access-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      'new-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(result).toEqual({
      message: 'Token refreshed successfully',
      data: {},
    });
  });

  it('rejects when the refresh token cookie is missing', async () => {
    const response = createResponseMock();

    await expect(
      controller.refreshToken(
        {
          cookies: {},
        } as any,
        response as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('clears cookies and rethrows when the service rejects the refresh token', async () => {
    const response = createResponseMock();
    authService.refreshToken.mockRejectedValueOnce(
      new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Session has been revoked',
      }),
    );

    await expect(
      controller.refreshToken(
        {
          cookies: {
            refreshToken: 'stale-refresh-token',
          },
          headers: {
            'user-agent': 'Mozilla/5.0',
          },
          ip: '203.0.113.10',
        } as any,
        response as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(response.clearCookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
  });
});

describe('AuthController.forgotPassword', () => {
  let controller: AuthController;
  let authService: { forgotPassword: jest.Mock };

  beforeEach(() => {
    authService = {
      forgotPassword: jest.fn().mockResolvedValue({
        message: 'OTP code has been sent to your email',
        email: 'me***@gmail.com',
        expiresIn: 300,
      }),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('forwards the payload and wraps the forgot-password response', async () => {
    const payload = {
      email: 'member@gmail.com',
    };

    const result = await controller.forgotPassword(payload as any);

    expect(authService.forgotPassword).toHaveBeenCalledWith(payload);
    expect(result).toEqual({
      message: 'OTP code has been sent',
      data: {
        message: 'OTP code has been sent to your email',
        email: 'me***@gmail.com',
        expiresIn: 300,
      },
    });
  });

  it('rethrows service errors for invalid forgot-password requests', async () => {
    authService.forgotPassword.mockRejectedValueOnce(
      new BadRequestException('Email does not exist'),
    );

    await expect(
      controller.forgotPassword({
        email: 'missing@gmail.com',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuthController.verifyOtp', () => {
  let controller: AuthController;
  let authService: { verifyOtp: jest.Mock };

  beforeEach(() => {
    authService = {
      verifyOtp: jest.fn(),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('returns the valid OTP result from the service', async () => {
    authService.verifyOtp.mockResolvedValueOnce({
      message: 'OTP code is valid',
      isValid: true,
    });

    const result = await controller.verifyOtp({
      email: 'member@gmail.com',
      otp: '123456',
    } as any);

    expect(authService.verifyOtp).toHaveBeenCalledWith({
      email: 'member@gmail.com',
      otp: '123456',
    });
    expect(result).toEqual({
      message: 'OTP is valid',
      data: {
        message: 'OTP code is valid',
        isValid: true,
      },
    });
  });

  it('returns the invalid OTP result from the service without throwing', async () => {
    authService.verifyOtp.mockResolvedValueOnce({
      message: 'Incorrect OTP code',
      isValid: false,
    });

    const result = await controller.verifyOtp({
      email: 'member@gmail.com',
      otp: '654321',
    } as any);

    expect(result).toEqual({
      message: 'OTP is invalid',
      data: {
        message: 'Incorrect OTP code',
        isValid: false,
      },
    });
  });
});

describe('AuthController.resetPassword', () => {
  let controller: AuthController;
  let authService: { resetPassword: jest.Mock };

  beforeEach(() => {
    authService = {
      resetPassword: jest.fn(),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('forwards the payload and wraps the reset-password response', async () => {
    authService.resetPassword.mockResolvedValueOnce({
      message: 'Password reset successful. Please login again.',
    });

    const payload = {
      email: 'member@gmail.com',
      otp: '123456',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    };

    const result = await controller.resetPassword(payload as any);

    expect(authService.resetPassword).toHaveBeenCalledWith(payload);
    expect(result).toEqual({
      message: 'ﾄ雪ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu thﾃnh cﾃｴng',
      data: {
        message: 'Password reset successful. Please login again.',
      },
    });
  });

  it('rethrows unauthorized reset-password errors from the service', async () => {
    authService.resetPassword.mockRejectedValueOnce(
      new UnauthorizedException('Invalid OTP code'),
    );

    await expect(
      controller.resetPassword({
        email: 'member@gmail.com',
        otp: '000000',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthController.checkObligations', () => {
  let controller: AuthController;
  let authService: { checkActiveObligations: jest.Mock };

  beforeEach(() => {
    authService = {
      checkActiveObligations: jest.fn().mockResolvedValue({
        hasObligations: true,
        activeProjects: 2,
        walletBalance: 150,
      }),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('returns the obligation snapshot for the authenticated user', async () => {
    const result = await controller.checkObligations({
      user: {
        id: 'user-1',
      },
    } as any);

    expect(authService.checkActiveObligations).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      hasObligations: true,
      activeProjects: 2,
      walletBalance: 150,
    });
  });
});

describe('AuthController.deleteAccount', () => {
  let controller: AuthController;
  let authService: { deleteAccount: jest.Mock };

  beforeEach(() => {
    authService = {
      deleteAccount: jest.fn().mockResolvedValue({
        message: 'Account has been deleted successfully',
      }),
    };

    controller = new AuthController(
      authService as any,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
  });

  it('forwards the payload, clears auth cookies, and returns the delete result', async () => {
    const response = createResponseMock();
    const payload = {
      password: 'currentPassword123',
      reason: 'No longer need the service',
    };

    const result = await controller.deleteAccount(
      {
        user: {
          id: 'user-1',
        },
      } as any,
      payload as any,
      response as any,
    );

    expect(authService.deleteAccount).toHaveBeenCalledWith('user-1', payload);
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
    expect(result).toEqual({
      message: 'Account has been deleted successfully',
    });
  });

  it('rethrows bad-request delete-account errors from the service', async () => {
    authService.deleteAccount.mockRejectedValueOnce(
      new BadRequestException('Cannot delete account while having active projects or wallet balance'),
    );

    await expect(
      controller.deleteAccount(
        {
          user: {
            id: 'user-1',
          },
        } as any,
        {
          password: 'currentPassword123',
        } as any,
        createResponseMock() as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
