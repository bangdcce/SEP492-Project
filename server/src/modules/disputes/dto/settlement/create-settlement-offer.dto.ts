// ============================================================================
// CREATE SETTLEMENT OFFER DTO
// ============================================================================

import { IsNumber, IsOptional, IsString, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSettlementOfferDto {
  @ApiProperty({
    description: 'Amount to be paid to the freelancer (in USD)',
    example: 300,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Amount to freelancer cannot be negative' })
  amountToFreelancer: number;

  @ApiProperty({
    description: 'Amount to be refunded to the client (in USD)',
    example: 200,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Amount to client cannot be negative' })
  amountToClient: number;

  @ApiPropertyOptional({
    description: 'Optional terms or conditions for the settlement',
    example:
      'Client accepts partial work delivered for phases 1-3. Freelancer agrees to forfeit payment for phase 4.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({
    description: 'Custom expiry time in hours (default: 48, min: 24, max: 72)',
    example: 48,
    minimum: 24,
    maximum: 72,
  })
  @IsOptional()
  @IsNumber()
  @Min(24)
  @Max(72)
  expiryHours?: number;

  @ApiPropertyOptional({
    description: 'Whether to exclude weekends from expiry calculation',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeWeekends?: boolean;
}
