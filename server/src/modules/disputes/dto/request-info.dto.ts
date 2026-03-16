import { IsISO8601, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RequestDisputeInfoDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsISO8601()
  deadlineAt?: string;
}
