import { IsString, IsBoolean, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWizardOptionDto {
  @IsString()
  value: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateWizardQuestionDto {
  @IsString()
  code: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsString()
  inputType: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWizardOptionDto)
  options?: CreateWizardOptionDto[];
}

