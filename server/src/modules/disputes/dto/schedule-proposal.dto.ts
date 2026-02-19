import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDisputeScheduleProposalDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
