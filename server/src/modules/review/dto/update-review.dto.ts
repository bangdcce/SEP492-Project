import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ description: 'Điểm đánh giá mới (1-5)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Nội dung nhận xét mới' })
  @IsOptional() // <--- Quan trọng
  @IsString()
  @MaxLength(1000, { message: 'Nhận xét không được quá 1000 ký tự' })
  comment?: string;
}
