import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HardFilterService, HardFilterInput } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';
import { AiRankerService, AiRankerInput } from './ai-ranker.service';
import { ClassifierService, ClassifiedResult } from './classifier.service';

export interface MatchingInput {
  requestId: string;
  specDescription: string;
  requiredTechStack: string[];
  budgetRange?: string;
  estimatedDuration?: string;
  excludeUserIds?: string[];
}

export interface MatchingOptions {
  role: 'BROKER' | 'FREELANCER';
  enableAi?: boolean;
  topN?: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly hardFilter: HardFilterService,
    private readonly tagScorer: TagScorerService,
    private readonly aiRanker: AiRankerService,
    private readonly classifier: ClassifierService,
    private readonly configService: ConfigService,
  ) {}

  async findMatches(
    input: MatchingInput,
    options: MatchingOptions,
  ): Promise<ClassifiedResult[]> {
    const aiEnabled =
      options.enableAi ??
      this.configService.get<string>('MATCHING_AI_ENABLED') === 'true';
    const topN =
      options.topN ??
      parseInt(this.configService.get<string>('MATCHING_AI_TOP_N') || '10', 10);

    this.logger.log(
      `Finding matches for request ${input.requestId} | role=${options.role} | ai=${aiEnabled} | topN=${topN}`,
    );

    // Step 1: Hard Filter
    const filterInput: HardFilterInput = {
      requestId: input.requestId,
      excludeUserIds: input.excludeUserIds,
    };
    const eligible = await this.hardFilter.filter(filterInput, {
      role: options.role,
    });
    this.logger.log(`Hard filter: ${eligible.length} candidates passed.`);

    if (eligible.length === 0) return [];

    // Step 2: Tag Scorer
    const tagged = this.tagScorer.score(eligible, input.requiredTechStack);
    this.logger.log(`Tag scorer: scored ${tagged.length} candidates.`);

    // Step 3: AI Ranker (optional)
    const topCandidates = tagged
      .sort((a, b) => b.tagOverlapScore - a.tagOverlapScore)
      .slice(0, topN);

    let ranked;
    if (aiEnabled) {
      const aiInput: AiRankerInput = {
        specDescription: input.specDescription,
        requiredTechStack: input.requiredTechStack,
        budgetRange: input.budgetRange,
        estimatedDuration: input.estimatedDuration,
      };
      ranked = await this.aiRanker.rank(aiInput, topCandidates);
      this.logger.log(`AI ranker: ranked ${ranked.length} candidates.`);
    } else {
      ranked = topCandidates.map((c) => ({
        ...c,
        aiRelevanceScore: null as number | null,
        reasoning: 'AI analysis was not enabled for this search.',
      }));
    }

    // Step 4: Classifier
    const classified = this.classifier.classify(ranked, aiEnabled);
    this.logger.log(
      `Classifier: classified ${classified.length} candidates. Top score: ${classified[0]?.matchScore}`,
    );

    return classified;
  }
}
