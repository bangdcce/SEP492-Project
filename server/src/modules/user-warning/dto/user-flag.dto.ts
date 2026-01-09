import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { UserFlagType, FlagStatus } from '../types';

export class CreateUserFlagDto {
  @IsEnum(UserFlagType)
  type: UserFlagType;

  @IsString()
  description: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  severity?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateUserFlagDto {
  @IsOptional()
  @IsEnum(FlagStatus)
  status?: FlagStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  severity?: number;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  resolution?: string;
}

export class QueryUserFlagsDto {
  @IsOptional()
  @IsEnum(UserFlagType)
  type?: UserFlagType;

  @IsOptional()
  @IsEnum(FlagStatus)
  status?: FlagStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  minSeverity?: number;
}

export class AppealFlagDto {
  @IsString()
  reason: string;

  @IsOptional()
  evidence?: string[];
}
