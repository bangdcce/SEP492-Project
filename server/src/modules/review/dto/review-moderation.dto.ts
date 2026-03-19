import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class ReviewModerationVersionDto {
  @IsInt()
  @Min(0)
  assignmentVersion: number;
}

export class ReviewModerationReassignDto extends ReviewModerationVersionDto {
  @IsUUID()
  assigneeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
