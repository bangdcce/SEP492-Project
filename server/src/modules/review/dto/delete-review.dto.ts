import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteReviewDto {
  @ApiProperty({ description: 'Lý do xóa review (bắt buộc)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
