import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason } from 'src/database/entities/report.entity';

export class CreateReportDto {
  @ApiProperty({ description: 'ID của review bị report' })
  @IsNotEmpty()
  @IsUUID()
  reviewId: string;

  @ApiProperty({ enum: ReportReason, description: 'Lý do report' })
  @IsNotEmpty()
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết (tối đa 500 ký tự)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
