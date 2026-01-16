import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveKycDto {
  @ApiPropertyOptional({
    description: 'Ghi chú khi duyệt',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectKycDto {
  @ApiProperty({
    description: 'Lý do từ chối',
    example: 'Ảnh CCCD không rõ ràng',
  })
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}
