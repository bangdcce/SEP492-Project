import { IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../../database/entities/kyc-verification.entity';

export class SubmitKycDto {
  @ApiProperty({
    description: 'Họ và tên đầy đủ trên CCCD',
    example: 'Nguyen Van A',
  })
  @IsString()
  @IsNotEmpty()
  fullNameOnDocument: string;

  @ApiProperty({
    description: 'Số CCCD/Passport',
    example: '001234567890',
  })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiProperty({
    description: 'Loại giấy tờ',
    enum: ['CCCD', 'PASSPORT', 'DRIVER_LICENSE'],
    example: 'CCCD',
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: 'Ngày sinh',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiPropertyOptional({
    description: 'Ngày hết hạn CCCD',
    example: '2035-01-01',
  })
  @IsDateString()
  @IsOptional()
  documentExpiryDate?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ thường trú',
    example: '123 Street, Ward, District, City',
  })
  @IsString()
  @IsOptional()
  address?: string;
}
