import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const upperCaseString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export enum DisputeEscalationRequestKind {
  SUPPORT_ESCALATION = 'SUPPORT_ESCALATION',
  ADMIN_OVERSIGHT = 'ADMIN_OVERSIGHT',
  NEUTRAL_PANEL = 'NEUTRAL_PANEL',
}

export class RequestEscalationDto {
  @Transform(upperCaseString)
  @IsEnum(DisputeEscalationRequestKind)
  kind: DisputeEscalationRequestKind;

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
