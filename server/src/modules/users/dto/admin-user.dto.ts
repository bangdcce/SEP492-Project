import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';

export class BanUserDto {
  @ApiProperty({
    description: 'Reason for banning user',
    example: 'Multiple violations of terms of service',
  })
  @IsString()
  reason: string;
}

export class UnbanUserDto {
  @ApiProperty({
    description: 'Reason for unbanning user',
    example: 'Restored after appeal',
  })
  @IsString()
  reason: string;
}

export class ResetUserPasswordDto {
  @ApiProperty({
    description: 'New temporary password',
    example: 'TempPass123!',
  })
  @IsString()
  newPassword: string;

  @ApiPropertyOptional({
    description: 'Send notification email to user',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;
}

export class UserFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Search by email or name',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by ban status',
  })
  @IsBoolean()
  @IsOptional()
  isBanned?: boolean;

  @ApiPropertyOptional({
    description: 'Current page',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
