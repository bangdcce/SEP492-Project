import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'ID người dùng', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Email người dùng', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Họ tên đầy đủ', example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0123456789' })
  phoneNumber: string;

  @ApiProperty({ description: 'Vai trò người dùng', example: 'CLIENT' })
  role: string;

  @ApiProperty({ description: 'Trạng thái xác thực', example: false })
  isVerified: boolean;

  @ApiProperty({ description: 'Điểm tin cậy hiện tại', example: 5.0 })
  currentTrustScore: number;

  @ApiProperty({ description: 'Thời gian tạo tài khoản', example: '2025-12-18T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Thời gian cập nhật cuối', example: '2025-12-18T10:00:00Z' })
  updatedAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Thông tin người dùng', type: AuthResponseDto })
  user: AuthResponseDto;

  @ApiProperty({ 
    description: 'Access token để xác thực API calls', 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' 
  })
  accessToken: string;

  @ApiProperty({ 
    description: 'Refresh token để làm mới access token', 
    example: 'abc123def456...' 
  })
  refreshToken: string;
}

export class LogoutResponseDto {
  @ApiProperty({ description: 'Thông báo kết quả', example: 'Đăng xuất thành công' })
  message: string;
}