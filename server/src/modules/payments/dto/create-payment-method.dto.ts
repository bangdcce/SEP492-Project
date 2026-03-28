import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PaymentMethodType } from '../../../database/entities';

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: PaymentMethodType, enumName: 'PaymentMethodType' })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiPropertyOptional({ example: 'Primary PayPal' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ example: 'client@example.com' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.PAYPAL_ACCOUNT)
  @IsEmail()
  @MaxLength(255)
  paypalEmail?: string;

  @ApiPropertyOptional({ example: 'Visa' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CARD_ACCOUNT)
  @IsString()
  @MaxLength(50)
  cardBrand?: string;

  @ApiPropertyOptional({ example: '4242' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CARD_ACCOUNT)
  @IsString()
  @MaxLength(4)
  cardLast4?: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CARD_ACCOUNT)
  @IsString()
  @MaxLength(255)
  cardholderName?: string;

  @ApiPropertyOptional({ example: 12 })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CARD_ACCOUNT)
  @IsInt()
  @Min(1)
  @Max(12)
  cardExpiryMonth?: number;

  @ApiPropertyOptional({ example: 2028 })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.CARD_ACCOUNT)
  @IsInt()
  @Min(2024)
  @Max(2100)
  cardExpiryYear?: number;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.BANK_ACCOUNT)
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ example: 'VCB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankCode?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.BANK_ACCOUNT)
  @IsString()
  @MaxLength(30)
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === PaymentMethodType.BANK_ACCOUNT)
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
  isDefault?: boolean;
}
