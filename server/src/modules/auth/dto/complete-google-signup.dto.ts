import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class CompleteGoogleSignupDto {
  @ApiProperty({
    description: 'Email từ Google OAuth',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    description: 'Tên đầy đủ từ Google',
    example: 'Nguyễn Văn A',
  })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0987654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message:
      'Số điện thoại phải là số điện thoại Việt Nam hợp lệ (10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Vai trò người dùng',
    enum: UserRole,
    example: UserRole.CLIENT,
  })
  @IsEnum(UserRole, { message: 'Role phải là CLIENT, BROKER hoặc FREELANCER' })
  @IsNotEmpty({ message: 'Role không được để trống' })
  role: string;

  @ApiPropertyOptional({
    description: 'Ảnh đại diện từ Google',
    example: 'https://lh3.googleusercontent.com/...',
  })
  @IsOptional()
  @IsString()
  picture?: string;
}
