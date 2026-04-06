import { BadRequestException, NotFoundException } from '@nestjs/common';

import { SkillCategory } from '../../database/entities/skill.entity';
import {
  SkillPriority,
  SkillVerificationStatus,
  UserSkillEntity,
} from '../../database/entities/user-skill.entity';
import { supabaseClient } from '../../config/supabase.config';
import { ProfileController } from './profile.controller';

jest.mock('../../config/supabase.config', () => ({
  supabaseClient: {
    storage: {
      from: jest.fn(),
    },
  },
}));

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const mockSigningCredentialsService = {
  getCredentialStatus: jest.fn(),
  initializeCredential: jest.fn(),
  rotateCredential: jest.fn(),
};

describe('ProfileController.getCV', () => {
  let controller: ProfileController;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;
  const mockedFrom = supabaseClient.storage.from as jest.Mock;

  beforeEach(() => {
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();
    mockedFrom.mockReset();

    controller = new ProfileController(
      profileRepo as any,
      userSkillRepo as any,
      skillRepo as any,
      mockSigningCredentialsService as any,
    );
  });

  it('returns null when the user has no CV', async () => {
    profileRepo.findOne.mockResolvedValue(null);

    const result = await controller.getCV({
      user: { id: 'user-1' },
    } as any);

    expect(profileRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(result).toEqual({ cvUrl: null });
  });

  it('returns the stored public CV URL as-is', async () => {
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'https://cdn.example.com/member-cv.pdf',
    });

    const result = await controller.getCV({
      user: { id: 'user-1' },
    } as any);

    expect(mockedFrom).not.toHaveBeenCalled();
    expect(result).toEqual({
      cvUrl: 'https://cdn.example.com/member-cv.pdf',
    });
  });

  it('returns a signed CV URL when the stored value is a storage path', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: {
        signedUrl: 'https://signed.example.com/cv-download',
      },
      error: null,
    });
    mockedFrom.mockReturnValue({
      createSignedUrl,
    });
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'cvs/user-1/member-cv.pdf',
    });

    const result = await controller.getCV({
      user: { id: 'user-1' },
    } as any);

    expect(mockedFrom).toHaveBeenCalledWith('cvs');
    expect(createSignedUrl).toHaveBeenCalledWith('cvs/user-1/member-cv.pdf', 3600);
    expect(result).toEqual({
      cvUrl: 'https://signed.example.com/cv-download',
    });
  });

  it('throws not found when the storage path cannot be signed', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Object not found',
      },
    });
    mockedFrom.mockReturnValue({
      createSignedUrl,
    });
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'cvs/user-1/missing-cv.pdf',
    });

    await expect(
      controller.getCV({
        user: { id: 'user-1' },
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProfileController.getMySkills', () => {
  let controller: ProfileController;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;

  const createUserSkill = (
    overrides: Partial<UserSkillEntity> & {
      skill?: Record<string, unknown>;
    } = {},
  ) =>
    Object.assign(new UserSkillEntity(), {
      id: 'user-skill-1',
      userId: 'user-1',
      skillId: 'skill-1',
      priority: SkillPriority.PRIMARY,
      verificationStatus: SkillVerificationStatus.PROJECT_VERIFIED,
      proficiencyLevel: 8,
      yearsOfExperience: 4,
      portfolioUrl: 'https://portfolio.example.com/react',
      completedProjectsCount: 5,
      lastUsedAt: new Date('2026-03-20T10:00:00.000Z'),
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      skill: {
        id: 'skill-1',
        name: 'ReactJS',
        slug: 'reactjs',
        category: SkillCategory.FRONTEND,
      },
      ...overrides,
    });

  beforeEach(() => {
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();

    controller = new ProfileController(
      profileRepo as any,
      userSkillRepo as any,
      skillRepo as any,
      mockSigningCredentialsService as any,
    );
  });

  it('returns mapped skills with full details for the authenticated user', async () => {
    userSkillRepo.find.mockResolvedValue([
      createUserSkill(),
      createUserSkill({
        id: 'user-skill-2',
        skillId: 'skill-2',
        priority: SkillPriority.SECONDARY,
        verificationStatus: SkillVerificationStatus.SELF_DECLARED,
        proficiencyLevel: 6,
        yearsOfExperience: 2,
        portfolioUrl: null,
        completedProjectsCount: 1,
        lastUsedAt: null,
        skill: {
          id: 'skill-2',
          name: 'NestJS',
          slug: 'nestjs',
          category: SkillCategory.BACKEND,
        },
      }),
    ]);

    const result = await controller.getMySkills({
      user: { id: 'user-1' },
    } as any);

    expect(userSkillRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: ['skill'],
      order: { priority: 'ASC', createdAt: 'DESC' },
    });
    expect(result).toEqual({
      skills: [
        {
          id: 'user-skill-1',
          skillId: 'skill-1',
          skillName: 'ReactJS',
          skillSlug: 'reactjs',
          skillCategory: SkillCategory.FRONTEND,
          priority: SkillPriority.PRIMARY,
          verificationStatus: SkillVerificationStatus.PROJECT_VERIFIED,
          proficiencyLevel: 8,
          yearsOfExperience: 4,
          portfolioUrl: 'https://portfolio.example.com/react',
          completedProjectsCount: 5,
          lastUsedAt: new Date('2026-03-20T10:00:00.000Z'),
        },
        {
          id: 'user-skill-2',
          skillId: 'skill-2',
          skillName: 'NestJS',
          skillSlug: 'nestjs',
          skillCategory: SkillCategory.BACKEND,
          priority: SkillPriority.SECONDARY,
          verificationStatus: SkillVerificationStatus.SELF_DECLARED,
          proficiencyLevel: 6,
          yearsOfExperience: 2,
          portfolioUrl: null,
          completedProjectsCount: 1,
          lastUsedAt: null,
        },
      ],
    });
  });

  it('returns an empty skills array when the user has not added any skills', async () => {
    userSkillRepo.find.mockResolvedValue([]);

    const result = await controller.getMySkills({
      user: { id: 'user-2' },
    } as any);

    expect(result).toEqual({
      skills: [],
    });
  });
});

describe('ProfileController.deleteCV', () => {
  let controller: ProfileController;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;
  const mockedFrom = supabaseClient.storage.from as jest.Mock;

  beforeEach(() => {
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();
    mockedFrom.mockReset();

    controller = new ProfileController(
      profileRepo as any,
      userSkillRepo as any,
      skillRepo as any,
      mockSigningCredentialsService as any,
    );
  });

  it('deletes a stored CV path and clears the profile reference', async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({ remove });
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'cvs/user-1/member-cv.pdf',
    });

    const result = await controller.deleteCV({
      user: { id: 'user-1' },
    } as any);

    expect(mockedFrom).toHaveBeenCalledWith('cvs');
    expect(remove).toHaveBeenCalledWith(['cvs/user-1/member-cv.pdf']);
    expect(profileRepo.update).toHaveBeenCalledWith({ userId: 'user-1' }, { cvUrl: '' });
    expect(result).toEqual({ message: 'CV deleted successfully' });
  });

  it('extracts the storage path from a public CV URL before deletion', async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({ remove });
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'https://cdn.example.com/storage/v1/object/public/cvs/cvs/user-1/member-cv.pdf',
    });

    await controller.deleteCV({
      user: { id: 'user-1' },
    } as any);

    expect(remove).toHaveBeenCalledWith(['cvs/cvs/user-1/member-cv.pdf']);
  });

  it('throws not found when the user has no CV to delete', async () => {
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: '',
    });

    await expect(
      controller.deleteCV({
        user: { id: 'user-1' },
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still clears the database reference when storage deletion reports an error', async () => {
    const remove = jest.fn().mockResolvedValue({
      error: { message: 'Storage removal failed' },
    });
    mockedFrom.mockReturnValue({ remove });
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'cvs/user-1/member-cv.pdf',
    });

    const result = await controller.deleteCV({
      user: { id: 'user-1' },
    } as any);

    expect(profileRepo.update).toHaveBeenCalledWith({ userId: 'user-1' }, { cvUrl: '' });
    expect(result).toEqual({ message: 'CV deleted successfully' });
  });

  it('throws bad request when clearing the CV reference fails', async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    mockedFrom.mockReturnValue({ remove });
    profileRepo.findOne.mockResolvedValue({
      userId: 'user-1',
      cvUrl: 'cvs/user-1/member-cv.pdf',
    });
    profileRepo.update.mockRejectedValue(new Error('DB write failed'));

    await expect(
      controller.deleteCV({
        user: { id: 'user-1' },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ProfileController.updateBio', () => {
  let controller: ProfileController;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();

    controller = new ProfileController(
      profileRepo as any,
      userSkillRepo as any,
      skillRepo as any,
      mockSigningCredentialsService as any,
    );
  });

  it('creates a profile and stores the trimmed bio when none exists', async () => {
    profileRepo.findOne.mockResolvedValue(null);
    profileRepo.create.mockReturnValue({
      userId: 'user-1',
      bio: 'Refined bio',
    });

    const result = await controller.updateBio({ user: { id: 'user-1' } } as any, {
      bio: '  Refined bio  ',
    });

    expect(profileRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      bio: 'Refined bio',
    });
    expect(profileRepo.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: 'Bio updated successfully' });
  });

  it('updates the existing profile bio with trimmed content', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      bio: 'Old bio',
    });

    const result = await controller.updateBio({ user: { id: 'user-1' } } as any, {
      bio: '  Updated bio  ',
    });

    expect(profileRepo.update).toHaveBeenCalledWith({ userId: 'user-1' }, { bio: 'Updated bio' });
    expect(result).toEqual({ message: 'Bio updated successfully' });
  });

  it('rejects empty bio content', async () => {
    await expect(
      controller.updateBio({ user: { id: 'user-1' } } as any, { bio: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects bio values longer than one thousand characters', async () => {
    await expect(
      controller.updateBio({ user: { id: 'user-1' } } as any, { bio: 'a'.repeat(1001) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ProfileController.updateSkills', () => {
  let controller: ProfileController;
  let profileRepo: ReturnType<typeof createRepositoryMock>;
  let userSkillRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    profileRepo = createRepositoryMock();
    userSkillRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();

    controller = new ProfileController(
      profileRepo as any,
      userSkillRepo as any,
      skillRepo as any,
      mockSigningCredentialsService as any,
    );
  });

  it('rejects requests when skillIds is not an array', async () => {
    await expect(
      controller.updateSkills({ user: { id: 'user-1' } } as any, { skillIds: 'skill-1' as any }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects requests when the skill list is empty', async () => {
    await expect(
      controller.updateSkills({ user: { id: 'user-1' } } as any, { skillIds: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects requests when one or more submitted skill ids are invalid', async () => {
    skillRepo.find.mockResolvedValue([{ id: 'skill-1' }]);

    await expect(
      controller.updateSkills({ user: { id: 'user-1' } } as any, {
        skillIds: ['skill-1', 'missing-skill'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces the skill set and returns the added and removed counts', async () => {
    skillRepo.find.mockResolvedValue([{ id: 'skill-1' }, { id: 'skill-2' }]);
    userSkillRepo.find.mockResolvedValue([
      { userId: 'user-1', skillId: 'skill-2' },
      { userId: 'user-1', skillId: 'skill-3' },
    ]);

    const result = await controller.updateSkills({ user: { id: 'user-1' } } as any, {
      skillIds: ['skill-1', 'skill-2'],
    });

    expect(userSkillRepo.delete).toHaveBeenCalled();
    expect(userSkillRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        skillId: 'skill-1',
        priority: SkillPriority.SECONDARY,
        verificationStatus: SkillVerificationStatus.SELF_DECLARED,
      }),
    ]);
    expect(result).toEqual({
      message: 'Skills updated successfully',
      addedCount: 1,
      removedCount: 1,
    });
  });

  it('returns zero added and removed counts when the submitted skills already match', async () => {
    skillRepo.find.mockResolvedValue([{ id: 'skill-1' }, { id: 'skill-2' }]);
    userSkillRepo.find.mockResolvedValue([
      { userId: 'user-1', skillId: 'skill-1' },
      { userId: 'user-1', skillId: 'skill-2' },
    ]);

    const result = await controller.updateSkills({ user: { id: 'user-1' } } as any, {
      skillIds: ['skill-1', 'skill-2'],
    });

    expect(userSkillRepo.delete).not.toHaveBeenCalled();
    expect(userSkillRepo.save).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: 'Skills updated successfully',
      addedCount: 0,
      removedCount: 0,
    });
  });
});
