import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches, IsEmail } from 'class-validator';

/**
 * DTO for requesting password reset via Email OTP
 */
export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address registered with account',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;
}

/**
 * DTO for verifying OTP (sent to email)
 */
export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address that received OTP',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty({
    description: '6-digit OTP code received via email',
    example: '123456',
  })
  @IsString({ message: 'OTP must be a string' })
  @IsNotEmpty({ message: 'OTP cannot be empty' })
  @Matches(/^[0-9]{6}$/, {
    message: 'OTP must be 6 digits',
  })
  otp: string;
}

/**
 * DTO for resetting password with OTP
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
  })
  @IsString({ message: 'OTP must be a string' })
  @IsNotEmpty({ message: 'OTP cannot be empty' })
  otp: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters, with lowercase and number/special character)',
    example: 'newpassword123',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[\d@$!%*?&])/, {
    message: 'Mật khẩu phải chứa ít nhất một chữ thường và một số/ký tự đặc biệt (@$!%*?&)',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password',
    example: 'NewPassword123',
  })
  @IsString({ message: 'Password confirmation must be a string' })
  @IsNotEmpty({ message: 'Password confirmation cannot be empty' })
  confirmPassword: string;
}

/**
 * Response DTOs
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Result message',
    example: 'OTP code has been sent to your email',
  })
  message: string;

  @ApiProperty({
    description: 'Masked email address',
    example: 'us***@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Thời gian hết hạn OTP (giây)',
    example: 300,
  })
  expiresIn: number;
}

export class VerifyOtpResponseDto {
  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Xác thực OTP thành công',
  })
  message: string;

  @ApiProperty({
    description: 'OTP có hợp lệ hay không',
    example: true,
  })
  isValid: boolean;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Đặt lại mật khẩu thành công',
  })
  message: string;
}
