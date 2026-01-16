import { ApiProperty } from '@nestjs/swagger';

// Enum để Swagger hiểu được các giá trị badge hợp lệ
export enum BadgeType {
  NEW = 'NEW',
  VERIFIED = 'VERIFIED',
  TRUSTED = 'TRUSTED',
  WARNING = 'WARNING',
  NORMAL = 'NORMAL',
}

// DTO cho stats object
export class UserStatsDto {
  @ApiProperty({ description: 'Số dự án đã hoàn thành', example: 5 })
  finished: number;

  @ApiProperty({ description: 'Số lần thua tranh chấp', example: 0 })
  disputes: number;

  @ApiProperty({ description: 'Điểm uy tín (0-5)', example: 4.5 })
  score: number;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'ID người dùng', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Email người dùng', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Họ tên đầy đủ', example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0123456789', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({
    description: 'URL ảnh đại diện',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Giới thiệu bản thân',
    example: 'Software developer...',
    required: false,
  })
  bio?: string;

  @ApiProperty({
    description: 'Tên công ty (cho freelancer)',
    example: 'ABC Company',
    required: false,
  })
  companyName?: string;

  @ApiProperty({
    description: 'Kỹ năng (cho freelancer)',
    example: ['React', 'Node.js'],
    required: false,
  })
  skills?: string[];

  @ApiProperty({
    description: 'LinkedIn URL',
    example: 'https://linkedin.com/in/username',
    required: false,
  })
  linkedinUrl?: string;

  @ApiProperty({
    description: 'CV URL',
    example: 'data:application/pdf;base64,...',
    required: false,
  })
  cvUrl?: string;

  @ApiProperty({ description: 'Portfolio links', required: false })
  portfolioLinks?: Array<{ title: string; url: string }>;

  @ApiProperty({ description: 'Vai trò người dùng', example: 'CLIENT' })
  role: string;

  @ApiProperty({ description: 'Trạng thái xác thực', example: false })
  isVerified: boolean;

  @ApiProperty({ description: 'Điểm tin cậy hiện tại', example: 5.0 })
  currentTrustScore: number;

  @ApiProperty({
    description: 'Huy hiệu người dùng (tự động tính toán)',
    enum: BadgeType,
    example: 'VERIFIED',
  })
  badge: BadgeType;

  @ApiProperty({
    description: 'Thống kê tổng hợp của người dùng',
    type: UserStatsDto,
  })
  stats: UserStatsDto;

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
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token để làm mới access token',
    example: 'abc123def456...',
  })
  refreshToken: string;
}

export class LogoutResponseDto {
  @ApiProperty({ description: 'Thông báo kết quả', example: 'Đăng xuất thành công' })
  message: string;
}
