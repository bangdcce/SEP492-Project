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

  async rank(
    input: AiRankerInput,
    candidates: TagScoreResult[],
  ): Promise<AiRankedResult[]> {
    const results: AiRankedResult[] = [];

    for (const candidate of candidates) {
      try {
        // Generate prompt
        const prompt = this.buildPrompt(input, candidate);

        // Call LLM
        const response = await this.llmClient.analyze(prompt);

        if (response && response.content) {
          const parsed = this.parseResponse(response.content);
          results.push({
            ...candidate,
            aiRelevanceScore: parsed.score,
            reasoning: parsed.reasoning,
          });
        } else {
          results.push({
            ...candidate,
            aiRelevanceScore: null,
            reasoning: 'AI analysis unavailable.',
          });
        }
      } catch (err) {
        this.logger.warn(
          `AI ranking failed for candidate ${candidate.candidateId}`,
          err,
        );
        results.push({
          ...candidate,
          aiRelevanceScore: null,
          reasoning: 'AI analysis failed.',
        });
      }
    }

    return results;
  }

  private buildPrompt(input: AiRankerInput, candidate: TagScoreResult): string {
    const skillsList = candidate.skills
      .map(
        (s) =>
          `${s.name} (${s.isPrimary ? 'primary' : 'secondary'}, ${s.yearsExp}y exp)`,
      )
      .join(', ');

    return `You are an expert technical recruiter AI. Evaluate how well this candidate fits the project.

PROJECT REQUIREMENTS:
- Description: ${input.specDescription || 'Not specified'}
- Required Tech Stack: ${input.requiredTechStack.join(', ') || 'Not specified'}
- Budget Range: ${input.budgetRange || 'Not specified'}
- Estimated Duration: ${input.estimatedDuration || 'Not specified'}

CANDIDATE PROFILE:
- Name: ${candidate.fullName}
- Bio: ${candidate.bio || 'No bio provided'}
- Skills: ${skillsList || 'No skills listed'}
- Trust Score: ${candidate.trustScore}/100
- Completed Projects: ${candidate.completedProjects}
- Tag Overlap Score: ${candidate.tagOverlapScore}/100
- Matched Skills: ${candidate.matchedSkills.join(', ') || 'None'}

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "score": <number 0-100>,
  "reasoning": "<one paragraph explaining your assessment>"
}`;
  }

  private parseResponse(content: string): {
    score: number;
    reasoning: string;
  } {
    try {
      // Strip markdown code fences if present
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsed = JSON.parse(cleaned);
      return {
        score:
          typeof parsed.score === 'number'
            ? Math.min(100, Math.max(0, Math.round(parsed.score)))
            : 0,
        reasoning: parsed.reasoning || 'No reasoning provided.',
      };
    } catch {
      return { score: 0, reasoning: content.substring(0, 300) };
    }
  }
}
