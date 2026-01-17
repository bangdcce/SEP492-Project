import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
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
  techPreferences?: string;

  @ApiPropertyOptional({ default: false, description: 'Set to true to save as draft' })
  @IsOptional()
  isDraft?: boolean;

  @ApiProperty({ type: [CreateProjectRequestAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectRequestAnswerDto)
  @Type(() => CreateProjectRequestAnswerDto)
  answers: CreateProjectRequestAnswerDto[];
}

import { RequestStatus } from '../../../database/entities/project-request.entity';

export class UpdateProjectRequestDto extends PartialType(CreateProjectRequestDto) {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  status?: RequestStatus;
}
