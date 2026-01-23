import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

/**
 * DTO để User đánh giá Staff sau khi dispute được resolve
 */
export class CreateResolutionFeedbackDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number; // Rating tổng thể (1-5 sao)

  @IsString()
  @IsOptional()
  comment?: string; // Nhận xét chi tiết

  // === DETAILED CRITERIA (Optional) ===
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  fairnessRating?: number; // Công bằng

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  responsivenessRating?: number; // Tốc độ phản hồi

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  professionalismRating?: number; // Chuyên nghiệp

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  clarityRating?: number; // Giải thích rõ ràng

  @IsBoolean()
  @IsOptional()
  isSatisfied?: boolean; // Hài lòng với kết quả?
}
