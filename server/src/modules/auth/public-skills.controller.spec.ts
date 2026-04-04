import { SkillCategory } from '../../database/entities/skill.entity';
import { PublicSkillsController } from './public-skills.controller';

const createRepositoryMock = () => ({
  find: jest.fn(),
});

describe('PublicSkillsController.getDomains', () => {
  let controller: PublicSkillsController;
  let domainRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    domainRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();

    controller = new PublicSkillsController(
      domainRepo as any,
      skillRepo as any,
    );
  });

  it('returns active domains ordered for registration', async () => {
    domainRepo.find.mockResolvedValue([
      {
        id: 'domain-1',
        name: 'Web Development',
        slug: 'web-development',
        description: 'Build web applications',
        icon: 'globe',
      },
      {
        id: 'domain-2',
        name: 'Mobile App',
        slug: 'mobile-app',
        description: 'Build mobile products',
        icon: 'smartphone',
      },
    ]);

    const result = await controller.getDomains();

    expect(domainRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon'],
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 'domain-1',
          name: 'Web Development',
          slug: 'web-development',
          description: 'Build web applications',
          icon: 'globe',
        },
        {
          id: 'domain-2',
          name: 'Mobile App',
          slug: 'mobile-app',
          description: 'Build mobile products',
          icon: 'smartphone',
        },
      ],
    });
  });

  it('returns an empty array when no active domains exist', async () => {
    domainRepo.find.mockResolvedValue([]);

    const result = await controller.getDomains();

    expect(result).toEqual({
      success: true,
      data: [],
    });
  });
});

describe('PublicSkillsController.getSkills', () => {
  let controller: PublicSkillsController;
  let domainRepo: ReturnType<typeof createRepositoryMock>;
  let skillRepo: ReturnType<typeof createRepositoryMock>;

  beforeEach(() => {
    domainRepo = createRepositoryMock();
    skillRepo = createRepositoryMock();

    controller = new PublicSkillsController(
      domainRepo as any,
      skillRepo as any,
    );
  });

  it('returns all active skills when role is omitted', async () => {
    skillRepo.find.mockResolvedValue([
      {
        id: 'skill-1',
        name: 'ReactJS',
        slug: 'reactjs',
        description: 'Frontend library',
        icon: 'react',
        category: SkillCategory.FRONTEND,
      },
    ]);

    const result = await controller.getSkills();

    expect(skillRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon', 'category'],
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 'skill-1',
          name: 'ReactJS',
          slug: 'reactjs',
          description: 'Frontend library',
          icon: 'react',
          category: SkillCategory.FRONTEND,
        },
      ],
    });
  });

  it('filters active skills for freelancer registration when role is FREELANCER', async () => {
    skillRepo.find.mockResolvedValue([]);

    await controller.getSkills('FREELANCER');

    expect(skillRepo.find).toHaveBeenCalledWith({
      where: { isActive: true, forFreelancer: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon', 'category'],
    });
  });

  it('filters active skills for broker registration when role is BROKER', async () => {
    skillRepo.find.mockResolvedValue([]);

    await controller.getSkills('BROKER');

    expect(skillRepo.find).toHaveBeenCalledWith({
      where: { isActive: true, forBroker: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon', 'category'],
    });
  });

  it('falls back to all active skills when role is unsupported', async () => {
    skillRepo.find.mockResolvedValue([]);

    const result = await controller.getSkills('CLIENT');

    expect(skillRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      select: ['id', 'name', 'slug', 'description', 'icon', 'category'],
    });
    expect(result).toEqual({
      success: true,
      data: [],
    });
  });
});
