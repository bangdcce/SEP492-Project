import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  riskLevel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['SERVER', 'CLIENT'])
  source?: 'SERVER' | 'CLIENT';

  @IsOptional()
  @IsString()
  @IsIn(['HTTP', 'UI_BREADCRUMB', 'DB_CHANGE', 'ERROR', 'AUTH', 'EXPORT'])
  eventCategory?: 'HTTP' | 'UI_BREADCRUMB' | 'DB_CHANGE' | 'ERROR' | 'AUTH' | 'EXPORT';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  errorOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  incidentOnly?: boolean;

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsString()
  fingerprint?: string;

  @IsOptional()
  @IsString()
  @IsIn(['json', 'csv', 'xlsx'])
  format?: 'json' | 'csv' | 'xlsx';
}
