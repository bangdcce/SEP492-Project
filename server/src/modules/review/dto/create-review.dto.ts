import {
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // Nếu bạn dùng Swagger

export class CreateReviewDto {
  @ApiProperty({ description: 'ID của dự án đã hoàn thành' })
  @IsNotEmpty()
  @IsUUID('4')
  projectId: string;

  @ApiProperty({ description: 'ID của người được đánh giá (Freelancer/Broker/Client)' })
  @IsNotEmpty()
  @IsUUID('4')
  targetUserId: string;

  @ApiProperty({ description: 'Điểm đánh giá từ 1 đến 5', minimum: 1, maximum: 5 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Nhận xét chi tiết', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Nhận xét không được quá 1000 ký tự' })
  comment?: string;
}
