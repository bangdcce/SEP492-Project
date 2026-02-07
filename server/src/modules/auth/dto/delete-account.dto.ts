import { IsString, MinLength, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    description: 'Current password to confirm identity',
    example: 'currentPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({
    description: 'Optional reason for deleting the account',
    example: 'No longer need the service',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Reason must be at most 500 characters' })
  reason?: string;
}

export class DeleteAccountResponseDto {
  @ApiProperty({
    description: 'Result message',
    example: 'Account has been deleted successfully',
  })
  message: string;
}

export class ActiveObligationsResponseDto {
  @ApiProperty({
    description: 'Number of active projects',
    example: 2,
  })
  activeProjects: number;

  @ApiProperty({
    description: 'Wallet balance',
    example: 1500.00,
  })
  walletBalance: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Cannot delete account while having active projects or wallet balance',
  })
  message: string;
}
