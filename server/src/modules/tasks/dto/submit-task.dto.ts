import { IsString, IsNotEmpty, IsUrl, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for submitting a task with proof of work
 * Used when a Freelancer marks a task as DONE with evidence
 */
export class SubmitTaskDto {
  /**
   * Proof link (required) - URL to evidence of completion
   * Examples: GitHub PR, Loom video, Figma file, etc.
   * Critical for dispute resolution
   */
  @IsString()
  @IsNotEmpty({ message: 'Proof link is required to submit task' })
  @MaxLength(500, { message: 'Proof link must not exceed 500 characters' })
  proofLink: string;

  /**
   * Submission note (optional) - Description of what was completed
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Submission note must not exceed 2000 characters' })
  submissionNote?: string;
}
