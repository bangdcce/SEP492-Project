import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskSubmissionStatus } from '../entities/task-submission.entity';

/**
 * DTO for reviewing a task submission
 * Only CLIENT or STAFF users can review submissions
 */
export class ReviewSubmissionDto {
  @IsEnum([TaskSubmissionStatus.APPROVED, TaskSubmissionStatus.REQUEST_CHANGES], {
    message: 'Status must be either APPROVED or REQUEST_CHANGES',
  })
  status: TaskSubmissionStatus.APPROVED | TaskSubmissionStatus.REQUEST_CHANGES;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Review note must not exceed 2000 characters' })
  reviewNote?: string;
}
