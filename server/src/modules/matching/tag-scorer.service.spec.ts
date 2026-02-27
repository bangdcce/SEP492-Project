import { Test, TestingModule } from '@nestjs/testing';
import { TagScorerService } from './tag-scorer.service';
import { EligibleCandidate } from './interfaces/match.interfaces';

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

  describe('scoreAll', () => {
    it('should calculate 0 score if requiredTechStack is empty', () => {
      const candidates: EligibleCandidate[] = [
        {
          userId: '1',
          fullName: 'Test User',
          bio: '',
          rawProfileSkills: [],
          skills: [
            {
              skillName: 'React',
              skillSlug: 'react',
              aliases: [],
              category: 'FRONTEND',
              priority: 'PRIMARY',
              proficiencyLevel: 8,
              yearsOfExperience: 5,
              verificationStatus: 'PROJECT_VERIFIED',
              isMatch: false,
            },
          ],
          trustScore: 4.5,
          kycStatus: 'VERIFIED',
          activeProjectCount: 0,
          disputesLost: 0,
          totalProjectsFinished: 10,
        },
      ];

      const scored = service.scoreAll([], candidates);
      expect(scored[0].tagOverlapScore).toBe(0);
      expect(scored[0].matchedSkills.length).toBe(0);
    });

    it('should correctly calculate max possible points and score based on matching skills', () => {
      // Max points per skill = 24. Required skills = 2. Max possible points = 48.
      const requiredTechStack = ['React', 'NestJS'];

      const perfectCandidate: EligibleCandidate = {
        userId: '1',
        fullName: 'Perfect User',
        bio: '',
        rawProfileSkills: [],
        skills: [
          {
            skillName: 'React',
            skillSlug: 'react',
            aliases: [],
            category: 'FRONTEND',
            priority: 'PRIMARY', // +5
            proficiencyLevel: 10, // +2
            yearsOfExperience: 4, // +2
            verificationStatus: 'PROJECT_VERIFIED', // +3
            // Base score for match: 10
            // Total for React: 10 + 5 + 2 + 2 + 3 = 22
            isMatch: false,
          },
          {
            skillName: 'NestJS',
            skillSlug: 'nestjs',
            aliases: [],
            category: 'BACKEND',
            priority: 'PRIMARY', // +5
            proficiencyLevel: 8, // +2
            yearsOfExperience: 3, // +2
            verificationStatus: 'PORTFOLIO_LINKED', // +2
            // Base score for match: 10
            // Total for NestJS: 10 + 5 + 2 + 2 + 2 = 21
            isMatch: false,
          },
        ],
        trustScore: 5.0,
        kycStatus: 'VERIFIED',
        activeProjectCount: 0,
        disputesLost: 0,
        totalProjectsFinished: 10,
      };

      const candidates = [perfectCandidate];
      const scored = service.scoreAll(requiredTechStack, candidates);

      // (22 + 21) / 48 * 100 = 43 / 48 * 100 = 89.58%
      expect(scored[0].tagOverlapScore).toBeCloseTo(89.58, 2);
      expect(scored[0].matchedSkills).toContain('React');
      expect(scored[0].matchedSkills).toContain('NestJS');
    });

    it('should fallback to rawProfileSkills if UserSkillEntity skills are empty', () => {
      const requiredTechStack = ['PostgreSQL', 'AWS'];

      const fallbackCandidate: EligibleCandidate = {
        userId: '2',
        fullName: 'New User',
        bio: '',
        rawProfileSkills: ['PostgreSQL DB', 'AWS CloudServices', 'Docker'],
        skills: [], // No structured skills yet
        trustScore: 3.0,
        kycStatus: 'UNVERIFIED',
        activeProjectCount: 0,
        disputesLost: 0,
        totalProjectsFinished: 0,
      };

      // Max possible points for 2 skills = 48 (24 * 2)
      // Base match points = 10 per skill. Total points = 20.
      // Score = 20 / 48 * 100 = 41.67%
      const scored = service.scoreAll(requiredTechStack, [fallbackCandidate]);

      expect(scored[0].tagOverlapScore).toBeCloseTo(41.67, 2);
      expect(scored[0].matchedSkills.length).toBe(2);
      // It should extract the original raw strings
      expect(scored[0].matchedSkills).toContain('PostgreSQL DB');
      expect(scored[0].matchedSkills).toContain('AWS CloudServices');
    });
  });
});
