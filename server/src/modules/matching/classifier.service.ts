import { Injectable, Logger } from '@nestjs/common';
import { MatchResult, ScoredCandidate, ClassificationLabel } from './interfaces/match.interfaces';

@Injectable()
export class ClassifierService {
  private readonly logger = new Logger(ClassifierService.name);

  /**
   * Layer 4: Business Logic + Classification
   * Computes final weighted score and assigns a classification label.
   */
  classifyAll(candidates: ScoredCandidate[]): MatchResult[] {
    this.logger.debug(`Classifying ${candidates.length} candidates...`);

    const results = candidates.map((candidate) => {
      // Step A: Normalization
      // Project uses trust score on a 0-5 scale. Convert to 0-100 scale.
      const normalizedTrust = (candidate.trustScore / 5) * 100;

      // Step B: Weighted Scoring
      let finalScore = 0;
      
      if (candidate.aiRelevanceScore !== null && candidate.aiRelevanceScore !== undefined) {
        // AI is available
        // 40% AI, 20% Tags, 40% Trust
        finalScore = (candidate.aiRelevanceScore * 0.40) + 
                     (candidate.tagOverlapScore * 0.20) + 
                     (normalizedTrust * 0.40);
      } else {
        // AI skipped or failed
        // 60% Tags, 40% Trust
        finalScore = (candidate.tagOverlapScore * 0.60) + 
                     (normalizedTrust * 0.40);
      }

      // Step C: Classification
      const classificationLabel = this.classify(candidate, finalScore);
      
      const basicReason = candidate.reasoning || 
        (candidate.tagOverlapScore > 60 ? 'Strong technical overlap.' : 'Partial technical match.');

      return {
        userId: candidate.userId,
        fullName: candidate.fullName,
        matchScore: Math.round(finalScore * 10) / 10,
        tagOverlapScore: Math.round(candidate.tagOverlapScore * 10) / 10,
        aiRelevanceScore: candidate.aiRelevanceScore ?? null,
        normalizedTrust: Math.round(normalizedTrust * 10) / 10,
        classificationLabel,
        reasoning: basicReason,
        matchedSkills: candidate.matchedSkills,
        candidateProfile: {
          bio: candidate.bio,
          kycStatus: candidate.kycStatus,
          trustScore: candidate.trustScore,
          totalProjectsFinished: candidate.totalProjectsFinished,
          disputesLost: candidate.disputesLost,
        },
      };
    });

    // Sort by final score descending
    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  private classify(candidate: ScoredCandidate, finalScore: number): ClassificationLabel {
    // ── PRIORITY 1: Safety check ──
    const isProvenBad = candidate.disputesLost > 0;
    const isLowScoreWithHistory = candidate.totalProjectsFinished > 0 && candidate.trustScore < 1.5;

    if (isProvenBad || isLowScoreWithHistory) {
      return ClassificationLabel.HIGH_RISK;
    }

    // ── PRIORITY 2: Technical excellence but unproven ──
    const relevanceScore = candidate.aiRelevanceScore ?? candidate.tagOverlapScore;
    if (relevanceScore >= 85 && candidate.trustScore < 2.5) {
      return ClassificationLabel.POTENTIAL;
    }

    // ── PRIORITY 3: Strong overall match ──
    if (finalScore >= 80 && candidate.kycStatus === 'VERIFIED') {
      return ClassificationLabel.PERFECT_MATCH;
    }

    // ── PRIORITY 4 (LOWEST): Everything else ──
    return ClassificationLabel.NORMAL;
  }
}
