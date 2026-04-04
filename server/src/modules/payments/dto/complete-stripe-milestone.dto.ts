import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CompleteStripeMilestoneDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({
    example: 'cs_test_a1b2c3d4',
    description: 'Stripe Checkout Session id returned to the app in the success URL.',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
