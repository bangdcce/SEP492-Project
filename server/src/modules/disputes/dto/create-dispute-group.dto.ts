import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { DisputeCategory } from 'src/database/entities';

export class CreateDisputeGroupDto {
  @IsNotEmpty()
  @IsUUID('4')
  projectId: string;

  @IsNotEmpty()
  @IsUUID('4')
  milestoneId: string;

  @IsUUID('4')
  @IsOptional()
  parentDisputeId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  defendantIds: string[];

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  evidence: string[];

  @IsOptional()
  @IsEnum(DisputeCategory)
  category?: DisputeCategory;

  @IsOptional()
  @IsNumber()
  @Min(0)
  disputedAmount?: number;
}
