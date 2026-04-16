import { Injectable, Logger } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { TagScoreResult } from './tag-scorer.service';

export interface AiRankerInput {
  specDescription: string;
  requiredTechStack: string[];
  budgetRange?: string;
  estimatedDuration?: string;
}

export interface AiRankedResult extends TagScoreResult {
  aiRelevanceScore: number | null; // 0-100 or null if AI skipped
  reasoning: string;
}

type ParsedAiItem = {
  id?: unknown;
  candidateId?: unknown;
  userId?: unknown;
  score?: unknown;
  reasoning?: unknown;
};

const STRUCTURED_COLLECTION_KEYS = [
  'results',
  'rankings',
  'candidates',
  'matches',
  'items',
  'data',
] as const;

@Injectable()
export class AiRankerService {
  private readonly logger = new Logger(AiRankerService.name);

  constructor(private readonly llmClient: LlmClientService) {}

  /**
   * Rank all candidates in a SINGLE batched LLM call
   * instead of one call per candidate (saves rate-limited API quota).
   */
  async rank(input: AiRankerInput, candidates: TagScoreResult[]): Promise<AiRankedResult[]> {
    if (candidates.length === 0) return [];

    try {
      const prompt = this.buildBatchPrompt(input, candidates);
      const response = await this.llmClient.analyze(prompt);

      if (response && response.content) {
        const parsed = this.parseBatchResponse(response.content, candidates);
        return parsed;
      }

      this.logger.warn('LLM returned empty response for batch ranking');
      return candidates.map((c) => ({
        ...c,
        aiRelevanceScore: null,
        reasoning: 'AI analysis unavailable.',
      }));
    } catch (err) {
      this.logger.warn('Batch AI ranking failed', err);
      return candidates.map((c) => ({
        ...c,
        aiRelevanceScore: null,
        reasoning: 'AI analysis failed.',
      }));
    }
  }

  /**
   * Build a SINGLE prompt that evaluates ALL candidates at once.
   * This reduces N API calls to just 1.
   */
  private buildBatchPrompt(input: AiRankerInput, candidates: TagScoreResult[]): string {
    const formatLimitedList = (values: string[], limit: number, emptyLabel: string): string => {
      const cleaned = values.map((value) => String(value || '').trim()).filter(Boolean);

      if (cleaned.length === 0) {
        return emptyLabel;
      }

      const visibleValues = cleaned.slice(0, limit);
      return cleaned.length > limit
        ? `${visibleValues.join(', ')} (+${cleaned.length - limit} more)`
        : visibleValues.join(', ');
    };

    const candidateBlocks = candidates
      .map((c, idx) => {
        const skillsList = c.skills
          .slice(0, 6)
          .map(
            (s) =>
              `${s.name}${
                s.domainName ? ` [domain: ${s.domainName}]` : ''
              } (${s.isPrimary ? 'primary' : 'secondary'}, ${s.yearsExp}y exp, ${
                s.completedProjectsCount
              } skill-projects${s.lastUsedAt ? `, last used ${new Date(s.lastUsedAt).getFullYear()}` : ''})`,
          )
          .join(', ');
        const domainList = formatLimitedList(
          c.domains.map((domain) => domain.name),
          4,
          'No domains listed',
        );
        const profileTags = formatLimitedList(c.rawProfileSkills, 5, 'No profile tags listed');
        const matchedSkills = formatLimitedList(c.matchedSkills, 5, 'None');

        return `CANDIDATE ${idx + 1} (id: "${c.candidateId}"):
- Name: ${c.fullName}
- Bio: ${c.bio || 'No bio provided'}
- Domains: ${domainList}
- Profile Tags: ${profileTags}
- Skills: ${skillsList || 'No skills listed'}
- Trust Score: ${c.trustScore}/5
- Completed Projects: ${c.completedProjects}
- Tag Overlap: ${c.tagOverlapScore}%
- Matched Signals: ${matchedSkills}`;
      })
      .join('\n\n');

    return `You are an expert technical recruiter AI. Evaluate how well each candidate fits the project.

PROJECT REQUIREMENTS:
- Description: ${input.specDescription || 'Not specified'}
- Required Tech Stack: ${input.requiredTechStack.join(', ') || 'Not specified'}
- Budget Range: ${input.budgetRange || 'Not specified'}
- Estimated Duration: ${input.estimatedDuration || 'Not specified'}

CANDIDATES TO EVALUATE:

${candidateBlocks}

SCORING PRIORITIES:
- Reward direct overlap with required tech stack and concrete matched signals most heavily.
- Reward relevant domain history, recent hands-on work, and stronger completed-project evidence.
- Use trust score as a reliability signal, but do not let trust outweigh clear skill mismatch.
- Penalize vague profiles or candidates with little evidence tied to the request.

Respond ONLY with a valid JSON array (no markdown, no code fences). Each element must have "id", "score" (0-100), and "reasoning" (one short sentence, max 24 words, mention strongest fit and biggest gap):
[
  { "id": "candidate-uuid", "score": 85, "reasoning": "Strong delivery history in X, but limited evidence for Y." },
  ...
]`;
  }

  /**
   * Parse the batched response and map back to candidates.
   */
  private parseBatchResponse(content: string, candidates: TagScoreResult[]): AiRankedResult[] {
    try {
      const cleaned = this.normalizeStructuredContent(content);
      const parsed = this.extractStructuredItems(JSON.parse(cleaned));

      // Build a map of id -> AI result
      const aiMap = new Map<string, { score: number; reasoning: string }>();
      for (const item of parsed) {
        const itemId = String(item.id ?? item.candidateId ?? item.userId ?? '').trim();
        if (!itemId) {
          continue;
        }

        aiMap.set(itemId, {
          score: (() => {
            const parsedScore = typeof item.score === 'number' ? item.score : Number(item.score);

            return Number.isFinite(parsedScore)
              ? Math.min(100, Math.max(0, Math.round(parsedScore)))
              : 0;
          })(),
          reasoning:
            typeof item.reasoning === 'string' && item.reasoning.trim().length > 0
              ? item.reasoning.trim()
              : 'No reasoning provided.',
        });
      }

      return candidates.map((c) => {
        const ai = aiMap.get(c.candidateId);
        return {
          ...c,
          aiRelevanceScore: ai?.score ?? null,
          reasoning: ai?.reasoning || 'AI did not evaluate this candidate.',
        };
      });
    } catch (err) {
      this.logger.warn('Failed to parse batch AI response', err);
      return candidates.map((c) => ({
        ...c,
        aiRelevanceScore: null,
        reasoning: 'AI analysis unavailable.',
      }));
    }
  }

  private normalizeStructuredContent(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
      return cleaned;
    }

    const firstArrayIndex = cleaned.indexOf('[');
    const firstObjectIndex = cleaned.indexOf('{');
    const firstIndexCandidates = [firstArrayIndex, firstObjectIndex].filter((value) => value >= 0);

    if (firstIndexCandidates.length === 0) {
      return cleaned;
    }

    const startIndex = Math.min(...firstIndexCandidates);
    const candidatePayload = cleaned.slice(startIndex).trim();

    if (candidatePayload.startsWith('[')) {
      const lastArrayIndex = candidatePayload.lastIndexOf(']');
      if (lastArrayIndex >= 0) {
        return candidatePayload.slice(0, lastArrayIndex + 1);
      }
    }

    if (candidatePayload.startsWith('{')) {
      const lastObjectIndex = candidatePayload.lastIndexOf('}');
      if (lastObjectIndex >= 0) {
        return candidatePayload.slice(0, lastObjectIndex + 1);
      }
    }

    return candidatePayload;
  }

  private extractStructuredItems(payload: unknown): ParsedAiItem[] {
    if (Array.isArray(payload)) {
      return payload as ParsedAiItem[];
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    for (const key of STRUCTURED_COLLECTION_KEYS) {
      const items = (payload as Record<string, unknown>)[key];
      if (Array.isArray(items)) {
        return items as ParsedAiItem[];
      }
    }

    return [payload as ParsedAiItem];
  }
}
