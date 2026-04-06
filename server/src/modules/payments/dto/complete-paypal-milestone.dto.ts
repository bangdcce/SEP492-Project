import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CompletePayPalMilestoneDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiPropertyOptional({
    description: 'Server-side PayPal order id returned by the create-order endpoint.',
  })
  @IsOptional()
  @ValidateIf((dto: CompletePayPalMilestoneDto) => !dto.order)
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Captured PayPal order payload returned by the PayPal JavaScript SDK legacy flow.',
  })
  @IsOptional()
  @ValidateIf((dto: CompletePayPalMilestoneDto) => !dto.orderId)
  @IsObject()
  order?: Record<string, unknown>;
}
