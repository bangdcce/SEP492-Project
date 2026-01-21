import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';

export class BanUserDto {
  @ApiProperty({
    description: 'Lý do ban user',
    example: 'Vi phạm điều khoản sử dụng nhiều lần',
  })
  @IsString()
  reason: string;
}

export class UnbanUserDto {
  @ApiProperty({
    description: 'Lý do unban user',
    example: 'Đã phục hồi sau khiếu nại',
  })
  @IsString()
  reason: string;
}

export class ResetUserPasswordDto {
  @ApiProperty({
    description: 'Mật khẩu tạm thời mới',
    example: 'TempPass123!',
  })
  @IsString()
  newPassword: string;

  @ApiPropertyOptional({
    description: 'Gửi email thông báo cho user',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;
}

export class UserFilterDto {
  @ApiPropertyOptional({
    description: 'Filter theo role',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Search theo email hoặc tên',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter theo trạng thái ban',
  })
  @IsBoolean()
  @IsOptional()
  isBanned?: boolean;

  @ApiPropertyOptional({
    description: 'Trang hiện tại',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Số lượng mỗi trang',
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
