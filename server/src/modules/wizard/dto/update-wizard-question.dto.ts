import { IsString, IsBoolean, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWizardOptionDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsString()
  value: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateWizardQuestionDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsString()
  inputType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWizardOptionDto)
  options?: UpdateWizardOptionDto[];
}
