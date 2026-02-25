export interface MatchingInput {
  requestId: string;
  specDescription: string;
  requiredTechStack: string[];
  budgetRange?: string;
  estimatedDuration?: string;
}

export interface EligibleCandidate {
  userId: string;
  fullName: string;
  bio: string;
  rawProfileSkills: string[];     // from ProfileEntity.skills
  skills: SkillMatch[];           // from UserSkillEntity
  trustScore: number;
  kycStatus: 'VERIFIED' | 'UNVERIFIED';
  activeProjectCount: number;
  disputesLost: number;
  totalProjectsFinished: number;
}

export interface SkillMatch {
  skillName: string;
  skillSlug: string;
  aliases: string[];
  category: string;
  priority: 'PRIMARY' | 'SECONDARY';
  proficiencyLevel: number | null;
  yearsOfExperience: number | null;
  verificationStatus: string;
  isMatch: boolean;
}

export interface MatchResult {
  userId: string;
  fullName: string;
  matchScore: number;             // 0-100 (final weighted)
  tagOverlapScore: number;        // 0-100 (deterministic)
  aiRelevanceScore: number | null; // 0-100 (from LLM)
  normalizedTrust: number;        // 0-100
  classificationLabel: ClassificationLabel;
  reasoning: string;
  matchedSkills: string[];
  candidateProfile: any;
}

export enum ClassificationLabel {
  PERFECT_MATCH = 'PERFECT_MATCH',
  POTENTIAL = 'POTENTIAL',
  HIGH_RISK = 'HIGH_RISK',
  NORMAL = 'NORMAL',
}

export interface ScoredCandidate extends EligibleCandidate {
  tagOverlapScore: number;
  matchedSkills: string[];
  aiRelevanceScore?: number | null;
  reasoning?: string;
}
