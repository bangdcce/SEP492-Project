import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RejectPayoutRequestDto {
  @ApiProperty({ example: 'Insufficient KYC verification for withdrawal' })
  @IsString()
  @MaxLength(1000)
  reason: string;
}
