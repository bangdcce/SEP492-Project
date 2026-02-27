import { Injectable } from '@nestjs/common';
import { AiRankedResult } from './ai-ranker.service';

export interface ClassifiedResult extends AiRankedResult {
  matchScore: number; // 0-100 final weighted score
  normalizedTrust: number; // 0-100 (trust score normalized)
  classificationLabel: 'PERFECT_MATCH' | 'POTENTIAL' | 'HIGH_RISK' | 'NORMAL';
}

@Injectable()
export class ClassifierService {
  classify(candidates: AiRankedResult[], aiEnabled: boolean): ClassifiedResult[] {
    return candidates
      .map((c) => {
        const normalizedTrust = Math.min(100, Math.max(0, Number(c.trustScore) * 20));
        const matchScore = this.calculateFinalScore(c, aiEnabled, normalizedTrust);
        const classificationLabel = this.assignLabel(matchScore, c.aiRelevanceScore, aiEnabled);

        return {
          ...c,
          matchScore,
          normalizedTrust,
          classificationLabel,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateFinalScore(c: AiRankedResult, aiEnabled: boolean, normalizedTrust: number): number {

    if (aiEnabled && c.aiRelevanceScore !== null) {
      // AI enabled: 50% AI + 30% Tag + 20% Trust
      const score =
        c.aiRelevanceScore * 0.5 +
        c.tagOverlapScore * 0.3 +
        normalizedTrust * 0.2;
      return Math.round(score * 10) / 10;
    }

    // AI disabled: 70% Tag + 30% Trust
    const score = c.tagOverlapScore * 0.7 + normalizedTrust * 0.3;
    return Math.round(score * 10) / 10;
  }

  private assignLabel(
    matchScore: number,
    aiScore: number | null,
    aiEnabled: boolean,
  ): ClassifiedResult['classificationLabel'] {
    if (aiEnabled && aiScore !== null) {
      if (matchScore > 85 && aiScore > 80) return 'PERFECT_MATCH';
      if (matchScore < 50 || aiScore < 40) return 'HIGH_RISK';
      if (matchScore > 50) return 'POTENTIAL';
      return 'HIGH_RISK';
    }

    // AI disabled
    if (matchScore > 50) return 'NORMAL';
    return 'HIGH_RISK';
  }
}
