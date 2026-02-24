import { Injectable, Logger } from '@nestjs/common';
import { EligibleCandidate, ScoredCandidate } from './interfaces/match.interfaces';

@Injectable()
export class TagScorerService {
  private readonly logger = new Logger(TagScorerService.name);
  
  // Maximum points a single matched skill can contribute
  private readonly MAX_POINTS_PER_SKILL = 24; 
  // Base 10 + Priority 5 + Verified 3 + Portfolio 2 + Exp 2 + Prof 2 = 24

  /**
   * Layer 2: Deterministic Tag-Overlap Scoring
   * Calculates a score based on how well the candidate's skills match the required tech stack.
   */
  scoreAll(
    requiredTechStack: string[],
    candidates: EligibleCandidate[],
  ): ScoredCandidate[] {
    if (!requiredTechStack || requiredTechStack.length === 0) {
      this.logger.warn('No required tech stack provided. Base scores will be 0.');
      return candidates.map(c => ({
        ...c,
        tagOverlapScore: 0,
        matchedSkills: [],
      }));
    }

    // Normalized search terms
    const requiredSlugs = requiredTechStack.map(this.normalize);
    const maxPossiblePoints = requiredSlugs.length * this.MAX_POINTS_PER_SKILL;

    return candidates.map(candidate => {
      let totalPoints = 0;
      const matchedSkillNames = new Set<string>();

      // Make a copy of skills to mutate the isMatch flag
      const scoredSkills = [...candidate.skills];

      if (scoredSkills.length > 0) {
        // --- PRIMARY LOGIC (Structured Skills) ---
        for (const req of requiredSlugs) {
          // Find matching capability
          const matchIndex = scoredSkills.findIndex(
            (s) => this.normalize(s.skillName) === req || 
                   this.normalize(s.skillSlug) === req || 
                   s.aliases.some((alias) => this.normalize(alias) === req)
          );

          if (matchIndex !== -1) {
            const skill = scoredSkills[matchIndex];
            scoredSkills[matchIndex] = { ...skill, isMatch: true };
            matchedSkillNames.add(skill.skillName);

            let points = 10; // Base match

            if (skill.priority === 'PRIMARY') points += 5;
            if (skill.priority === 'SECONDARY') points += 2;
            
            if (skill.verificationStatus === 'PROJECT_VERIFIED') points += 3;
            if (skill.verificationStatus === 'PORTFOLIO_LINKED') points += 2;
            
            if (skill.yearsOfExperience && skill.yearsOfExperience >= 3) points += 2;
            if (skill.proficiencyLevel && skill.proficiencyLevel >= 7) points += 2;

            totalPoints += points;
          }
        }
      } else if (candidate.rawProfileSkills?.length > 0) {
        // --- FALLBACK LOGIC (Unstructured Profile Skills) ---
        // For new users who haven't populated UserSkillEntity
        const candidateRawSlugs = candidate.rawProfileSkills.map(this.normalize);
        
        for (const req of requiredSlugs) {
          if (candidateRawSlugs.includes(req) || 
              candidateRawSlugs.some(crs => crs.includes(req) || req.includes(crs))) {
             
             // Find original name for display
             const originalName = candidate.rawProfileSkills.find(
               s => this.normalize(s).includes(req) || req.includes(this.normalize(s))
             );
             if (originalName) matchedSkillNames.add(originalName);
             
             totalPoints += 10; // Base match points only, no bonuses
          }
        }
      }

      const tagOverlapScore = (totalPoints / maxPossiblePoints) * 100;

      return {
        ...candidate,
        skills: scoredSkills,
        tagOverlapScore: Math.min(100, Math.max(0, tagOverlapScore)), // clamp 0-100
        matchedSkills: Array.from(matchedSkillNames),
      };
    }).sort((a, b) => b.tagOverlapScore - a.tagOverlapScore); // Sort highest first
  }

  private normalize(str: string): string {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
