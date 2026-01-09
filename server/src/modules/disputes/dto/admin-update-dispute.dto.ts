import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { DisputeCategory, DisputePriority } from 'src/database/entities';

/**
 * DTO để Admin cập nhật thông tin Dispute
 */
export class AdminUpdateDisputeDto {
  /**
   * Cập nhật loại tranh chấp
   */
  @IsOptional()
  @IsEnum(DisputeCategory)
  category?: DisputeCategory;

  /**
   * Cập nhật mức độ ưu tiên
   */
  @IsOptional()
  @IsEnum(DisputePriority)
  priority?: DisputePriority;

  /**
   * Cập nhật số tiền tranh chấp
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  disputedAmount?: number;

  /**
   * Gia hạn deadline phản hồi (số ngày từ bây giờ)
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  extendResponseDeadlineDays?: number;

  /**
   * Gia hạn deadline xử lý (số ngày từ bây giờ)
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  extendResolutionDeadlineDays?: number;
}
