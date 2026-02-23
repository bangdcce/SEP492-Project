import { Injectable, Logger } from '@nestjs/common';
import { HardFilterService } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';
import { AiRankerService } from './ai-ranker.service';
import { ClassifierService } from './classifier.service';
import { MatchingInput, MatchResult } from './interfaces/match.interfaces';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly hardFilterService: HardFilterService,
    private readonly tagScorerService: TagScorerService,
    private readonly aiRankerService: AiRankerService,
    private readonly classifierService: ClassifierService,
  ) {}

  /**
   * Orchestrates the 4-layer matching pipeline.
   * Receives parsed MatchingInput from the caller (domain separation).
   */
  async findMatches(
    input: MatchingInput,
    options?: {
      enableAi?: boolean;
      topN?: number;
      requireKyc?: boolean;
      role?: 'FREELANCER' | 'BROKER';
    },
  ): Promise<MatchResult[]> {
    const enableAi = options?.enableAi ?? true;
    const topN = options?.topN ?? 10;
    const requireKyc = options?.requireKyc ?? true;
    const role = options?.role ?? 'FREELANCER';

    this.logger.log(`Starting matching pipeline for Request ${input.requestId} (AI enabled: ${enableAi})`);

    // Layer 1: Hard Filter
    const eligibleCandidates = await this.hardFilterService.filterEligibleCandidates(
      input.requestId,
      role,
      { requireKyc, maxActiveProjects: 3 },
    );

    if (eligibleCandidates.length === 0) {
      this.logger.log(`No eligible candidates found after Layer 1 for Request ${input.requestId}`);
      return [];
    }

    // Layer 2: Deterministic Tag Scoring
    const scoredCandidates = this.tagScorerService.scoreAll(
      input.requiredTechStack,
      eligibleCandidates,
    );

    let candidatesForClassification = scoredCandidates;

    // Layer 3: AI Ranker (Optional)
    if (enableAi) {
      // Take top N strictly from Layer 2
      const topCandidates = scoredCandidates.slice(0, topN);
      const remainingCandidates = scoredCandidates.slice(topN);

      const aiRankedCandidates = await this.aiRankerService.rankBatch(
        input,
        topCandidates,
      );

      // Re-merge
      candidatesForClassification = [...aiRankedCandidates, ...remainingCandidates];
    } else {
      // Ensure aiRelevanceScore is explicitly null if AI was bypassed
      candidatesForClassification = scoredCandidates.map(c => ({
        ...c,
        aiRelevanceScore: null,
      }));
    }

    // Layer 4: Classification
    const finalResults = this.classifierService.classifyAll(candidatesForClassification);

    this.logger.log(`Matching pipeline completed for Request ${input.requestId}. Returning ${finalResults.length} candidates.`);
    return finalResults;
  }
}
