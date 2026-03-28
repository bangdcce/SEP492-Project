import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  manager: {
    getRepository: jest.fn(),
  },
});

const fixedCreatedAt = new Date('2026-03-01T09:00:00.000Z');
const fixedUpdatedAt = new Date('2026-03-27T09:00:00.000Z');

const createProfile = (overrides: Partial<ProfileEntity> = {}) =>
  Object.assign(new ProfileEntity(), {
    id: 'profile-1',
    userId: 'user-1',
    avatarUrl: 'https://cdn.example.com/original-avatar.png',
    bio: 'Original bio',
    companyName: 'Original Studio',
    skills: ['NestJS'],
    portfolioLinks: [
      {
        title: 'Original Case Study',
        url: 'https://portfolio.example.com/original',
      },
    ],
    linkedinUrl: 'https://linkedin.com/in/original-member',
    cvUrl: 'https://cdn.example.com/original-cv.pdf',
    ...overrides,
  });

const createUser = (
  overrides: Partial<UserEntity> & {
    profile?: Partial<ProfileEntity> | undefined;
  } = {},
) => {
  const { profile, ...rest } = overrides;

  return Object.assign(new UserEntity(), {
    id: 'user-1',
    email: 'member@gmail.com',
    passwordHash: 'hashed-password',
    fullName: 'Persisted Member',
    phoneNumber: '0111222333',
    timeZone: 'UTC',
    role: UserRole.FREELANCER,
    isVerified: true,
    emailVerifiedAt: new Date('2026-03-20T09:00:00.000Z'),
    currentTrustScore: 4.8,
    totalProjectsFinished: 6,
    totalDisputesLost: 1,
    createdAt: fixedCreatedAt,
    updatedAt: fixedUpdatedAt,
    profile:
      profile === undefined ? createProfile() : profile ? createProfile(profile) : undefined,
    ...rest,
  });
};

describe('AuthService.updateProfile', () => {
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

    profileRepository.create.mockImplementation((data) =>
      Object.assign(new ProfileEntity(), {
        id: 'profile-1',
      }, data),
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
      {} as any,
      {} as any,
    );
  });

  it('creates a missing profile and preserves first-time LinkedIn and CV values', async () => {
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

    profileRepository.findOne.mockResolvedValueOnce(null);
    userRepository.findOne.mockResolvedValueOnce(
      createUser({
        fullName: 'Updated Member',
        phoneNumber: '0999888777',
        timeZone: 'Europe/Berlin',
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
      }),
    );

    const result = await service.updateProfile('user-1', updateProfileDto as any);

    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        fullName: 'Updated Member',
        phoneNumber: '0999888777',
        timeZone: 'Europe/Berlin',
      },
    );
    expect(profileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
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
    expect(profileRepository.save).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        fullName: 'Updated Member',
        phoneNumber: '0999888777',
        timeZone: 'Europe/Berlin',
        avatarUrl: 'https://cdn.example.com/new-avatar.png',
        bio: 'Updated bio',
        companyName: 'Updated Studio',
        skills: ['TypeScript', 'Testing'],
        linkedinUrl: 'https://linkedin.com/in/updated-member',
        cvUrl: 'https://cdn.example.com/updated-cv.pdf',
        role: UserRole.FREELANCER,
        isEmailVerified: true,
      }),
    );
  });

  it('updates only defined profile fields and allows clearing strings and arrays', async () => {
    const updateProfileDto = {
      avatarUrl: '',
      bio: '',
      companyName: 'Updated Studio',
      skills: [],
      linkedinUrl: '',
      cvUrl: '',
      portfolioLinks: [],
    };

    profileRepository.findOne.mockResolvedValueOnce(createProfile());
    userRepository.findOne.mockResolvedValueOnce(
      createUser({
        profile: {
          avatarUrl: '',
          bio: '',
          companyName: 'Updated Studio',
          skills: [],
          linkedinUrl: '',
          cvUrl: '',
          portfolioLinks: [],
        },
      }),
    );

    const result = await service.updateProfile('user-1', updateProfileDto as any);

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(profileRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      {
        avatarUrl: '',
        bio: '',
        companyName: 'Updated Studio',
        skills: [],
        portfolioLinks: [],
        linkedinUrl: '',
        cvUrl: '',
      },
    );
    expect(result.avatarUrl).toBe('');
    expect(result.bio).toBe('');
    expect(result.skills).toEqual([]);
    expect(result.portfolioLinks).toEqual([]);
  });

  it('throws when the user cannot be reloaded after the update completes', async () => {
    profileRepository.findOne.mockResolvedValueOnce(createProfile());
    userRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.updateProfile(
        'user-1',
        {
          bio: 'Updated bio',
        } as any,
      ),
    ).rejects.toThrow('User not found after update');

    expect(profileRepository.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      {
        bio: 'Updated bio',
      },
    );
  });
});
