import { IsEnum, IsOptional, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { UserFlagType, FlagStatus } from '../types';

export class CreateUserFlagDto {
  @IsEnum(UserFlagType)
  type: UserFlagType;

  @IsString()
  @MaxLength(2000)
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
  @MaxLength(2000)
  adminNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
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
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  evidence?: string[];
}
