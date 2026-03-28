import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePayPalMilestoneOrderDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiPropertyOptional({
    example: 'paypal',
    description: 'Funding source chosen by the PayPal JS SDK, for example paypal or card.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @ApiPropertyOptional({ example: 'https://localhost:5173/client/workspace/project-1?view=board' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'https://localhost:5173/client/workspace/project-1?view=board' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cancelUrl?: string;
}
