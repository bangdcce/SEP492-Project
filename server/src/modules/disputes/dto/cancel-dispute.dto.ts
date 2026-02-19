import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelDisputeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
