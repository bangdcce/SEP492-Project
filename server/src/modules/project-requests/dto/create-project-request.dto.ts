import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectRequestAnswerDto {
  @ApiProperty()
  @IsNotEmpty()
  questionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  optionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  valueText?: string;
}

export class ProjectRequestAttachmentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  filename: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storagePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimetype?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  size?: number;

  @ApiPropertyOptional({ enum: ['requirements', 'attachment'] })
  @IsOptional()
  @IsIn(['requirements', 'attachment'])
  category?: 'requirements' | 'attachment';
}

export class CreateProjectRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetRange?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intendedTimeline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestedDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  techPreferences?: string;

  @ApiPropertyOptional({ description: 'Initial status for the request (e.g. PUBLIC_DRAFT, PRIVATE_DRAFT)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Legacy compatibility flag for saving as draft' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDraft?: boolean;

  @ApiPropertyOptional({ type: [ProjectRequestAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectRequestAttachmentDto)
  attachments?: ProjectRequestAttachmentDto[];

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  wizardProgressStep?: number;

  @ApiProperty({ type: [CreateProjectRequestAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectRequestAnswerDto)
  answers: CreateProjectRequestAnswerDto[];
}

import { RequestStatus } from '../../../database/entities/project-request.entity';

export class UpdateProjectRequestDto extends PartialType(CreateProjectRequestDto) {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  status?: RequestStatus;
}
