import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { DisputeCategory } from 'src/database/entities';

export class CreateDisputeDto {
  @IsNotEmpty()
  @IsUUID('4')
  projectId: string;

  @IsNotEmpty()
  @IsUUID('4')
  milestoneId: string;

  @IsNotEmpty()
  @IsUUID('4')
  defendantId: string;

  @IsNotEmpty()
  @IsString()
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
   * Số tiền tranh chấp (VND)
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  disputedAmount?: number;
}
