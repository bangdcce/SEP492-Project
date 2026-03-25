import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
  IsUrl,
  IsDateString,
  IsInt,
} from 'class-validator';
import { DeliverableType } from '../../../database/entities/milestone.entity';
import { ProjectSpecStatus } from '../../../database/entities/project-spec.entity';

export class CreateSpecFeatureDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsArray()
  @IsString({ each: true })
  @MinLength(10, { each: true, message: 'Acceptance criteria must be at least 10 chars long' })
  acceptanceCriteria: string[];

  @IsOptional()
  @IsString()
  inputOutputSpec?: string;
}

export class ReferenceLinkDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsUrl()
  url: string;
}

export class CreateMilestoneDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  duration?: number; // In days, optional

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsEnum(DeliverableType)
  deliverableType: DeliverableType;

  @IsNumber()
  @Min(0)
  retentionAmount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptanceCriteria?: string[]; // Copied from Spec Feature

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateProjectSpecDto {
  @IsUUID()
  requestId: string;

  @IsOptional()
  @IsUUID()
  parentSpecId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  totalBudget: number;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateMilestoneDto)
  milestones: CreateMilestoneDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpecFeatureDto)
  features?: CreateSpecFeatureDto[];

  @IsOptional()
  @IsString()
  techStack?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceLinkDto)
  referenceLinks?: ReferenceLinkDto[];

  @IsOptional()
  @IsObject()
  richContentJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsEnum(ProjectSpecStatus)
  status?: ProjectSpecStatus; // Explicitly allow status setting
}
