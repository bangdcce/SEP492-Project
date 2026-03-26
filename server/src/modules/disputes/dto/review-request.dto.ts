import { Transform } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ReviewRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  impactSummary?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceIds?: string[];
}
