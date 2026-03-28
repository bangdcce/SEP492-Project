import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const upperCaseString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export enum NeutralPanelRecommendation {
  UPHOLD = 'UPHOLD',
  OVERTURN = 'OVERTURN',
  NEEDS_HEARING = 'NEEDS_HEARING',
}

export class SubmitNeutralPanelRecommendationDto {
  @Transform(upperCaseString)
  @IsEnum(NeutralPanelRecommendation)
  recommendation: NeutralPanelRecommendation;

  @Transform(trimString)
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  rationale: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;
}
