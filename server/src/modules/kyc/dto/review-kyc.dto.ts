import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveKycDto {
  @ApiPropertyOptional({
    description: 'Review note',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectKycDto {
  @ApiProperty({
    description: 'Rejection reason',
    example: 'The ID card image is unclear',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'rejectionReason must not be empty' })
  rejectionReason: string;
}
