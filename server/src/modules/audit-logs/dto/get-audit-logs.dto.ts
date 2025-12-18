import { IsOptional, IsInt, IsString, Min, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

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
  @Type(() => Number)
  @IsInt()
  userId?: number; // Lọc theo ID người thực hiện

  @IsOptional()
  @IsString()
  entityType?: string; // Lọc theo loại đối tượng (Project, User...)

  @IsOptional()
  @IsString()
  action?: string; // Lọc theo hành động (LOGIN, CREATE...)

  // ===== NEW FILTERS =====

  @IsOptional()
  @IsDateString()
  dateFrom?: string; // Lọc từ ngày (ISO format: 2024-12-01)

  @IsOptional()
  @IsDateString()
  dateTo?: string; // Lọc đến ngày (ISO format: 2024-12-31)

  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  riskLevel?: string; // Lọc theo mức độ rủi ro
}
