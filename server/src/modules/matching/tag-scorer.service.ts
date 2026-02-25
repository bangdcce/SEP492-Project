import { Injectable } from '@nestjs/common';
import { HardFilterResult } from './hard-filter.service';

export interface TagScoreResult extends HardFilterResult {
  tagOverlapScore: number; // 0-100
  matchedSkills: string[];
}

@Injectable()
export class TagScorerService {
  score(
    candidates: HardFilterResult[],
    requiredTechStack: string[],
  ): TagScoreResult[] {
    if (!requiredTechStack || requiredTechStack.length === 0) {
      // No tech stack specified — everyone gets a baseline score
      return candidates.map((c) => ({
        ...c,
        tagOverlapScore: 0,
        matchedSkills: [],
      }));
    }

    const normalizedRequired = requiredTechStack.map((t) =>
      t.toLowerCase().trim(),
    );

    return candidates.map((candidate) => {
      const candidateSkillNames = candidate.skills.map((s) =>
        s.name.toLowerCase().trim(),
      );

      const matched = normalizedRequired.filter((req) =>
        candidateSkillNames.some(
          (cs) => cs === req || cs.includes(req) || req.includes(cs),
        ),
      );

      const tagOverlapScore =
        normalizedRequired.length > 0
          ? Math.round((matched.length / normalizedRequired.length) * 100)
          : 0;

      return {
        ...candidate,
        tagOverlapScore,
        matchedSkills: matched,
      };
    });
  }
}
