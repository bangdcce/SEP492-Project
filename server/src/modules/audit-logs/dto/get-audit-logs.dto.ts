import { IsOptional, IsInt, IsString, Min } from 'class-validator';
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
}
