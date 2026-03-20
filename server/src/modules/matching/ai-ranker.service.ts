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
    const candidateBlocks = candidates
      .map((c, idx) => {
        const skillsList = c.skills
          .map(
            (s) =>
              `${s.name}${
                s.domainName ? ` [domain: ${s.domainName}]` : ''
              } (${s.isPrimary ? 'primary' : 'secondary'}, ${s.yearsExp}y exp, ${
                s.completedProjectsCount
              } skill-projects${s.lastUsedAt ? `, last used ${new Date(s.lastUsedAt).getFullYear()}` : ''})`,
          )
          .join(', ');
        const domainList = c.domains.map((domain) => domain.name).join(', ');
        const profileTags = c.rawProfileSkills.join(', ');

        return `CANDIDATE ${idx + 1} (id: "${c.candidateId}"):
- Name: ${c.fullName}
- Bio: ${c.bio || 'No bio provided'}
- Domains: ${domainList || 'No domains listed'}
- Profile Tags: ${profileTags || 'No profile tags listed'}
- Skills: ${skillsList || 'No skills listed'}
- Trust Score: ${c.trustScore}/5
- Completed Projects: ${c.completedProjects}
- Tag Overlap: ${c.tagOverlapScore}%
- Matched Skills: ${c.matchedSkills.join(', ') || 'None'}`;
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

Respond ONLY with a valid JSON array (no markdown, no code fences). Each element must have "id", "score" (0-100), and "reasoning" (one sentence):
[
  { "id": "candidate-uuid", "score": 85, "reasoning": "Strong match because..." },
  ...
]`;
  }

  /**
   * Parse the batched response and map back to candidates.
   */
  private parseBatchResponse(content: string, candidates: TagScoreResult[]): AiRankedResult[] {
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed: Array<{ id: string; score: number; reasoning: string }> = JSON.parse(cleaned);

      // Build a map of id -> AI result
      const aiMap = new Map<string, { score: number; reasoning: string }>();
      for (const item of parsed) {
        aiMap.set(item.id, {
          score:
            typeof item.score === 'number' ? Math.min(100, Math.max(0, Math.round(item.score))) : 0,
          reasoning: item.reasoning || 'No reasoning provided.',
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
      // Fallback: treat entire content as a single reasoning
      return candidates.map((c) => ({
        ...c,
        aiRelevanceScore: null,
        reasoning: content?.substring(0, 200) || 'AI analysis failed to parse.',
      }));
    }
  }
}
