import { Test, TestingModule } from '@nestjs/testing';
import { HardFilterResult } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';

const createCandidate = (overrides: Partial<HardFilterResult> = {}): HardFilterResult => ({
  candidateId: 'candidate-1',
  fullName: 'Candidate',
  skills: [],
  rawProfileSkills: [],
  domains: [],
  bio: '',
  trustScore: 4,
  completedProjects: 0,
  candidateProfile: {},
  ...overrides,
});

describe('TagScorerService', () => {
  let service: TagScorerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TagScorerService],
    }).compile();

    service = module.get<TagScorerService>(TagScorerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns zero overlap when no request tags are provided', () => {
    const scored = service.scoreAll([], [createCandidate()]);

    expect(scored[0].tagOverlapScore).toBe(0);
    expect(scored[0].matchedSkills).toEqual([]);
  });

  it('matches aliases and returns the canonical skill label', () => {
    const scored = service.scoreAll(
      ['React'],
      [
        createCandidate({
          skills: [
            {
              name: 'ReactJS',
              slug: 'reactjs',
              aliases: ['React', 'React.js'],
              domainId: null,
              domainName: 'Web Development',
              domainSlug: 'web-development',
              isPrimary: true,
              yearsExp: 4,
              completedProjectsCount: 3,
              lastUsedAt: new Date('2025-12-01T00:00:00.000Z'),
              verificationStatus: 'PROJECT_VERIFIED',
            },
          ],
        }),
      ],
    );

    expect(scored[0].tagOverlapScore).toBeGreaterThan(80);
    expect(scored[0].matchedSkills).toContain('ReactJS');
  });

  it('matches a domain tag against a related structured skill', () => {
    const scored = service.scoreAll(
      ['FinTech'],
      [
        createCandidate({
          skills: [
            {
              name: 'Banking',
              slug: 'banking',
              aliases: [],
              domainId: 'domain-fintech',
              domainName: 'FinTech',
              domainSlug: 'fintech',
              isPrimary: true,
              yearsExp: 5,
              completedProjectsCount: 4,
              lastUsedAt: new Date('2026-01-15T00:00:00.000Z'),
              verificationStatus: 'PROJECT_VERIFIED',
            },
          ],
        }),
      ],
    );

    expect(scored[0].tagOverlapScore).toBeGreaterThanOrEqual(75);
    expect(scored[0].matchedSkills).toContain('Banking (FinTech)');
  });

  it('uses raw profile tags as a fallback when structured skills are missing', () => {
    const scored = service.scoreAll(
      ['PostgreSQL', 'AWS'],
      [
        createCandidate({
          rawProfileSkills: ['PostgreSQL DB', 'AWS CloudServices', 'Docker'],
        }),
      ],
    );

    expect(scored[0].tagOverlapScore).toBeGreaterThan(40);
    expect(scored[0].matchedSkills).toContain('PostgreSQL DB');
    expect(scored[0].matchedSkills).toContain('AWS CloudServices');
  });

  it('boosts candidates with stronger history signals for the same domain match', () => {
    const recentExperienced = createCandidate({
      candidateId: 'recent',
      skills: [
        {
          name: 'Banking',
          slug: 'banking',
          aliases: [],
          domainId: 'domain-fintech',
          domainName: 'FinTech',
          domainSlug: 'fintech',
          isPrimary: true,
          yearsExp: 6,
          completedProjectsCount: 5,
          lastUsedAt: new Date('2026-01-15T00:00:00.000Z'),
          verificationStatus: 'PROJECT_VERIFIED',
        },
      ],
    });
    const staleLightweight = createCandidate({
      candidateId: 'stale',
      skills: [
        {
          name: 'Banking',
          slug: 'banking',
          aliases: [],
          domainId: 'domain-fintech',
          domainName: 'FinTech',
          domainSlug: 'fintech',
          isPrimary: false,
          yearsExp: 1,
          completedProjectsCount: 0,
          lastUsedAt: new Date('2022-01-15T00:00:00.000Z'),
          verificationStatus: 'SELF_DECLARED',
        },
      ],
    });

    const scored = service.scoreAll(['FinTech'], [recentExperienced, staleLightweight]);

    expect(scored[0].candidateId).toBe('recent');
    expect(scored[0].tagOverlapScore).toBeGreaterThan(scored[1].tagOverlapScore);
  });
});
