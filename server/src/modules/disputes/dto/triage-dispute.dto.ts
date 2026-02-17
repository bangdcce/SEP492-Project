import { IsEnum, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export enum TriageActionType {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  REQUEST_INFO = 'REQUEST_INFO',
  COMPLETE_PREVIEW = 'COMPLETE_PREVIEW',
}

export class TriageDisputeDto {
  @IsEnum(TriageActionType)
  action: TriageActionType;

  @IsOptional()
  @IsString()
  @MinLength(5)
  reason?: string;

  @IsOptional()
  @IsISO8601()
  deadlineAt?: string;
}
