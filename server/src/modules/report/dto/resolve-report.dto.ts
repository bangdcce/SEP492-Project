import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from 'src/database/entities/report.entity';

export class ResolveReportDto {
  @ApiProperty({ enum: [ReportStatus.RESOLVED, ReportStatus.REJECTED] })
  @IsEnum(ReportStatus)
  status: ReportStatus.RESOLVED | ReportStatus.REJECTED;

  @ApiPropertyOptional({ description: 'Ghi chú của admin' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;

  @ApiPropertyOptional({ description: 'Xóa review nếu resolve (chỉ khi status = RESOLVED)' })
  @IsOptional()
  @IsBoolean()
  deleteReview?: boolean;
}
