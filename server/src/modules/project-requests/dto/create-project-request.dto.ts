
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty({ type: [CreateProjectRequestAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectRequestAnswerDto)
  answers: CreateProjectRequestAnswerDto[];
}
