import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { DisputeCategory } from 'src/database/entities';

export class CreateDisputeDto {
  @IsNotEmpty()
  @IsUUID('4')
  projectId: string;

  @IsNotEmpty()
  @IsUUID('4')
  milestoneId: string;

  @IsUUID('4')
  @IsOptional()
  parentDisputeId?: string;

  @IsNotEmpty()
  @IsUUID('4')
  defendantId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  reason: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  evidence: string[];

  /**
   * Loại tranh chấp
   */
  @IsOptional()
  @IsEnum(DisputeCategory)
  category?: DisputeCategory;

  /**
   * Số tiền tranh chấp (USD)
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  disputedAmount?: number;

  @IsBoolean()
  @IsNotEmpty()
  disclaimerAccepted: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  disclaimerVersion?: string;
}
