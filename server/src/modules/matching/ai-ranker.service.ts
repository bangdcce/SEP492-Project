import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { LlmClientService } from './llm-client.service';
import { MatchingInput, ScoredCandidate } from './interfaces/match.interfaces';

@Injectable()
export class AiRankerService {
  private readonly logger = new Logger(AiRankerService.name);

  constructor(
    private readonly llmClient: LlmClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Layer 3: AI Semantic Analysis
   * Enhances top candidates with LLM-based reasoning and contextual fit.
   */
  async rankBatch(
    input: MatchingInput,
    candidates: ScoredCandidate[],
  ): Promise<ScoredCandidate[]> {
    if (candidates.length === 0) return candidates;

    this.logger.log(`Running AI Ranker on top ${candidates.length} candidates...`);

    const specHash = this.hashSpec(input);
    const results: ScoredCandidate[] = [];

    // Process sequentially to respect rate limits
    for (const candidate of candidates) {
      try {
        const cacheKey = `match:ai:${input.requestId}:${candidate.userId}:${specHash}`;
        
        // Check cache first
        const cached = await this.cacheManager.get<{ aiRelevanceScore: number; reasoning: string }>(cacheKey);

        if (cached) {
          results.push({
            ...candidate,
            aiRelevanceScore: cached.aiRelevanceScore,
            reasoning: cached.reasoning,
          });
          continue;
        }

        // Generate prompt
        const prompt = this.buildPrompt(input, candidate);
        
        // Call LLM
        const response = await this.llmClient.analyze(prompt);
        
        if (!response) {
          // Graceful degradation: LLM failed, keep deterministic score
          results.push({
            ...candidate,
            aiRelevanceScore: null,
            reasoning: 'AI evaluation unavailable. Deterministic score used.',
          });
          continue;
        }

        // Parse result with 4-tier fallback
        const parsed = this.parseAiResponse(response.content, candidate.tagOverlapScore);
        
        if (parsed) {
          // Cache successful result for 1 hour (3600000 ms)
          await this.cacheManager.set(cacheKey, parsed, 3600000);
          
          results.push({
            ...candidate,
            aiRelevanceScore: parsed.aiRelevanceScore,
            reasoning: parsed.reasoning,
          });
        } else {
          // Parsing completely failed
          results.push({
            ...candidate,
            aiRelevanceScore: null,
            reasoning: 'AI evaluation failed to parse. Deterministic score used.',
          });
        }
      } catch (error: any) {
        this.logger.error(`Failed AI ranking for user ${candidate.userId}: ${error.message}`);
        
        // Fallback to deterministic
        results.push({
          ...candidate,
          aiRelevanceScore: null,
          reasoning: 'AI evaluation error. Deterministic score used.',
        });
      }
    }

    return results;
  }

  private buildPrompt(input: MatchingInput, candidate: ScoredCandidate): string {
    const skillsString = candidate.skills.length > 0 
      ? candidate.skills.map(s => `${s.skillName} (${s.priority}, ${s.yearsOfExperience || 0}yrs, ${s.verificationStatus})`).join(', ')
      : candidate.rawProfileSkills.join(', ');

    return `
You are a Senior Technical Recruiter for a freelance IT platform.
You must evaluate candidate relevance. Be conservative — only give high scores to candidates who strongly match.

PROJECT REQUIREMENTS:
- Description: ${input.specDescription}
- Required Tech Stack: ${input.requiredTechStack.join(', ')}
- Budget: ${input.budgetRange || 'Not specified'}
- Timeline: ${input.estimatedDuration || 'Not specified'}

CANDIDATE:
- Name: ${candidate.fullName}
- Bio: ${candidate.bio}
- Skills: ${skillsString}
- Trust Score: ${candidate.trustScore}/5
- Projects Completed: ${candidate.totalProjectsFinished}
- KYC: ${candidate.kycStatus}

Analyze this candidate's relevance to the project.
Consider: domain experience, transferable skills, tech stack depth.
If unsure about a candidate's fit, estimate conservatively (lower score).

CRITICAL INSTRUCTIONS:
- Return ONLY a raw JSON object. Do NOT include markdown, code fences, or any text before/after the JSON.
- aiRelevanceScore must be an integer between 0 and 100.
- reasoning must be 2-3 sentences maximum.

{
  "aiRelevanceScore": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation>"
}
    `.trim();
  }

  private parseAiResponse(raw: string, tagOverlapScore: number): { aiRelevanceScore: number; reasoning: string } | null {
    let rawJson: any = null;

    // Step 1: Try direct JSON.parse
    try {
      rawJson = JSON.parse(raw.trim());
    } catch {}

    // Step 2: Extract JSON from markdown fences or surrounding text
    if (!rawJson) {
      const jsonMatch = raw.match(/\{[\s\S]*?"aiRelevanceScore"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          rawJson = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }

    // Step 3: Regex extraction as last resort
    if (!rawJson) {
      const scoreMatch = raw.match(/"aiRelevanceScore"\s*:\s*(\d+)/);
      const reasonMatch = raw.match(/"reasoning"\s*:\s*"([^"]+)"/);
      
      if (scoreMatch) {
        rawJson = {
          aiRelevanceScore: parseInt(scoreMatch[1], 10),
          reasoning: reasonMatch?.[1] || 'AI analysis completed.',
        };
      }
    }

    if (rawJson) {
       return this.validateAndClamp(rawJson, tagOverlapScore);
    }

    // Step 4: Complete failure
    return null;
  }

  private validateAndClamp(parsed: any, tagOverlapScore: number): { aiRelevanceScore: number; reasoning: string } {
    let baseScore = Number(parsed.aiRelevanceScore);
    if (!Number.isFinite(baseScore)) baseScore = 50;
    
    // Clamp 0-100
    baseScore = Math.max(0, Math.min(100, baseScore));

    // Never let AI alone override a bad deterministic score heavily
    if (tagOverlapScore < 20) {
      baseScore = Math.min(baseScore, tagOverlapScore + 30);
    }

    return {
      aiRelevanceScore: baseScore,
      reasoning: String(parsed.reasoning || 'AI analysis completed.').slice(0, 500).trim(),
    };
  }

  private hashSpec(input: MatchingInput): string {
    const raw = input.specDescription + '|' + input.requiredTechStack.sort().join(',');
    return createHash('md5').update(raw).digest('hex').slice(0, 12);
  }
}
