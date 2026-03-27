import { Injectable } from '@nestjs/common';
import { HardFilterResult, HardFilterSkill } from './hard-filter.service';

export interface TagScoreResult extends HardFilterResult {
  tagOverlapScore: number; // 0-100
  matchedSkills: string[];
}

type MatchKind = 'EXACT_SKILL' | 'SKILL_ALIAS' | 'DOMAIN' | 'PROFILE';

type MatchSignal = {
  score: number;
  label: string;
  kind: MatchKind;
};

const normalizeTerm = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isLooseMatch = (left: string, right: string): boolean =>
  left === right || left.includes(right) || right.includes(left);

@Injectable()
export class TagScorerService {
  score(candidates: HardFilterResult[], requiredTechStack: string[]): TagScoreResult[] {
    return this.scoreAll(requiredTechStack, candidates);
  }

  scoreAll(requiredTechStack: string[], candidates: HardFilterResult[]): TagScoreResult[] {
    const normalizedRequired = [
      ...new Set(
        (requiredTechStack || [])
          .map((term) => normalizeTerm(term))
          .filter((term) => term.length > 0),
      ),
    ];

    if (normalizedRequired.length === 0) {
      return candidates.map((candidate) => ({
        ...candidate,
        tagOverlapScore: 0,
        matchedSkills: [],
      }));
    }

    return candidates.map((candidate) => {
      const matchedLabels = new Set<string>();
      const totalScore = normalizedRequired.reduce((sum, requiredTerm) => {
        const bestSignal = this.findBestSignal(candidate, requiredTerm);
        if (bestSignal) {
          matchedLabels.add(bestSignal.label);
          return sum + bestSignal.score;
        }

        return sum;
      }, 0);

      return {
        ...candidate,
        tagOverlapScore: Math.round((totalScore / normalizedRequired.length) * 1000) / 10,
        matchedSkills: [...matchedLabels],
      };
    });
  }

  private findBestSignal(candidate: HardFilterResult, requiredTerm: string): MatchSignal | null {
    const skillSignals = (candidate.skills || [])
      .map((skill) => this.matchStructuredSkill(requiredTerm, skill))
      .filter((signal): signal is MatchSignal => Boolean(signal));
    const domainSignals = (candidate.domains || [])
      .map((domain) => {
        const domainNames = [domain.name, domain.slug]
          .map((value) => normalizeTerm(value))
          .filter((value) => value.length > 0);

        if (!domainNames.some((value) => isLooseMatch(value, requiredTerm))) {
          return null;
        }

        return {
          score: 0.72,
          label: `${domain.name} domain`,
          kind: 'DOMAIN' as const,
        };
      })
      .filter((signal): signal is MatchSignal => Boolean(signal));
    const profileSignals = (candidate.rawProfileSkills || [])
      .map((profileSkill) => this.matchProfileSkill(requiredTerm, profileSkill))
      .filter((signal): signal is MatchSignal => Boolean(signal));

    const bestSignal = [...skillSignals, ...domainSignals, ...profileSignals].sort(
      (left, right) => right.score - left.score,
    )[0];

    return bestSignal ?? null;
  }

  private matchStructuredSkill(requiredTerm: string, skill: HardFilterSkill): MatchSignal | null {
    const names = [skill.name, skill.slug]
      .map((value) => normalizeTerm(value))
      .filter((value) => value.length > 0);
    const aliases = (skill.aliases || [])
      .map((value) => normalizeTerm(value))
      .filter((value) => value.length > 0);
    const domains = [skill.domainName, skill.domainSlug]
      .map((value) => normalizeTerm(value || ''))
      .filter((value) => value.length > 0);

    const exactSkillMatch = names.some((value) => isLooseMatch(value, requiredTerm));
    const aliasMatch = aliases.some((value) => isLooseMatch(value, requiredTerm));
    const domainMatch = domains.some((value) => isLooseMatch(value, requiredTerm));

    if (!exactSkillMatch && !aliasMatch && !domainMatch) {
      return null;
    }

    const base = exactSkillMatch ? 0.9 : aliasMatch ? 0.82 : 0.68;
    const cap = exactSkillMatch ? 1.0 : aliasMatch ? 0.96 : 0.9;
    const yearsExpBoost = Math.min(0.06, Math.max(0, Number(skill.yearsExp || 0)) * 0.015);
    const projectHistoryBoost = Math.min(
      0.08,
      Math.max(0, Number(skill.completedProjectsCount || 0)) * 0.02,
    );
    const primaryBoost = skill.isPrimary ? 0.05 : 0;
    const recentUseBoost = this.getRecencyBoost(skill.lastUsedAt);

    return {
      score: Math.min(
        cap,
        base + yearsExpBoost + projectHistoryBoost + primaryBoost + recentUseBoost,
      ),
      label:
        domainMatch && !exactSkillMatch && !aliasMatch && skill.domainName
          ? `${skill.name} (${skill.domainName})`
          : skill.name,
      kind: exactSkillMatch ? 'EXACT_SKILL' : aliasMatch ? 'SKILL_ALIAS' : 'DOMAIN',
    };
  }

  private matchProfileSkill(requiredTerm: string, profileSkill: string): MatchSignal | null {
    const normalizedProfileSkill = normalizeTerm(profileSkill);
    if (!normalizedProfileSkill || !isLooseMatch(normalizedProfileSkill, requiredTerm)) {
      return null;
    }

    return {
      score: normalizedProfileSkill === requiredTerm ? 0.55 : 0.48,
      label: profileSkill,
      kind: 'PROFILE',
    };
  }

  private getRecencyBoost(lastUsedAt: Date | null): number {
    if (!lastUsedAt) {
      return 0;
    }

    const timestamp = new Date(lastUsedAt).getTime();
    if (Number.isNaN(timestamp)) {
      return 0;
    }

    const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    if (ageInDays <= 180) {
      return 0.05;
    }
    if (ageInDays <= 365) {
      return 0.03;
    }
    if (ageInDays <= 730) {
      return 0.01;
    }
    return 0;
  }
}
