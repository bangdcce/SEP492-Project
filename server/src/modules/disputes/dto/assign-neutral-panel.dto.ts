import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AssignNeutralPanelDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  reviewerIds: string[];

  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}
