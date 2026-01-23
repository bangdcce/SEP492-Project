// ============================================================================
// RESPOND TO SETTLEMENT DTO
// ============================================================================

import {
  IsBoolean,
  IsString,
  IsOptional,
  ValidateIf,
  IsNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RespondToSettlementDto {
  @ApiProperty({
    description: 'Whether to accept the settlement offer',
    example: true,
  })
  @IsBoolean()
  accept: boolean;

  @ApiPropertyOptional({
    description:
      'Reason for rejection (REQUIRED if accept = false, min 50 characters). ' +
      'Please explain why you are rejecting so the other party can make a better counter-offer.',
    example:
      'The proposed split does not reflect the work delivered. I completed 80% of the project including all core features. The 50-50 split is unfair given my significant contribution.',
    minLength: 50,
    maxLength: 1000,
  })
  @ValidateIf((o) => o.accept === false)
  @IsNotEmpty({ message: 'Rejection reason is required when declining a settlement' })
  @IsString()
  @MinLength(50, {
    message:
      'Please provide a detailed rejection reason (minimum 50 characters) to help the other party understand your position',
  })
  @MaxLength(1000)
  rejectedReason?: string;
}
