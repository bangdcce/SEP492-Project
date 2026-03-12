import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { FundingGateway } from '../../../database/entities';

export class FundMilestoneDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiPropertyOptional({
    enum: FundingGateway,
    enumName: 'FundingGateway',
    default: FundingGateway.INTERNAL_SANDBOX,
  })
  @IsEnum(FundingGateway)
  gateway: FundingGateway = FundingGateway.INTERNAL_SANDBOX;
}
