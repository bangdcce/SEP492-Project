import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PayoutMethodType } from '../../../database/entities';

export class CreatePayoutMethodDto {
  @ApiProperty({ enum: PayoutMethodType, enumName: 'PayoutMethodType' })
  @IsEnum(PayoutMethodType)
  type: PayoutMethodType;

  @ApiPropertyOptional({ example: 'Primary cashout PayPal' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ example: 'cashout@example.com' })
  @ValidateIf((dto: CreatePayoutMethodDto) => dto.type === PayoutMethodType.PAYPAL_EMAIL)
  @IsEmail()
  @MaxLength(255)
  paypalEmail?: string;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @ValidateIf((dto: CreatePayoutMethodDto) => dto.type === PayoutMethodType.BANK_ACCOUNT)
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ example: 'VCB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankCode?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @ValidateIf((dto: CreatePayoutMethodDto) => dto.type === PayoutMethodType.BANK_ACCOUNT)
  @IsString()
  @MaxLength(30)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @ValidateIf((dto: CreatePayoutMethodDto) => dto.type === PayoutMethodType.BANK_ACCOUNT)
  @IsString()
  @MaxLength(255)
  accountHolderName?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh Main Branch' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchName?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean;
}
