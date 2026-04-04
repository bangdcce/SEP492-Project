import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsUUID } from 'class-validator';

export class CreateStripeCheckoutSessionDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({
    description:
      'Absolute URL that Stripe should return the browser to after checkout completes or is cancelled.',
    example:
      'https://localhost:5173/client/workspace/project-id?view=board&milestone=milestone-id',
  })
  @IsUrl({
    require_protocol: true,
    require_tld: false,
  })
  returnUrl: string;
}
