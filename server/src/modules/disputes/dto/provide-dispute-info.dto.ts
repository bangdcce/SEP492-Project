import { IsArray, IsOptional, IsString } from 'class-validator';

export class ProvideDisputeInfoDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceIds?: string[];
}
