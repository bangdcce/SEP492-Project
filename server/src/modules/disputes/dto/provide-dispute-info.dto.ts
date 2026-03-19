import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProvideDisputeInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceIds?: string[];
}
