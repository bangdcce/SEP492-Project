import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestDisputeInfoDto {
  @IsString()
  @MinLength(10)
  reason: string;

  @IsOptional()
  @IsISO8601()
  deadlineAt?: string;
}
