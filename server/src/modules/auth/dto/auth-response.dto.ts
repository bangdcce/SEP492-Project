import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffApplicationStatus } from '../../../database/entities/staff-application.entity';

export enum BadgeType {
  NEW = 'NEW',
  VERIFIED = 'VERIFIED',
  TRUSTED = 'TRUSTED',
  WARNING = 'WARNING',
  NORMAL = 'NORMAL',
}

export class UserStatsDto {
  @ApiProperty({ description: 'Number of completed projects', example: 5 })
  finished: number;

  @ApiProperty({ description: 'Number of lost disputes', example: 0 })
  disputes: number;

  @ApiProperty({ description: 'Trust score (0-5)', example: 4.5 })
  score: number;
}

export class CertificationItemDto {
  @ApiProperty({ description: 'Certification name', example: 'IBM Business Analyst' })
  name: string;

  @ApiProperty({ description: 'Issuing organization', example: 'IBM' })
  issuingOrganization: string;

  @ApiProperty({ description: 'Issue month', example: 'Nov' })
  issueMonth: string;

  @ApiProperty({ description: 'Issue year', example: '2025' })
  issueYear: string;

  @ApiProperty({
    description: 'Credential identifier',
    example: 'R3N2OL4NM58R',
    required: false,
  })
  credentialId?: string;

  @ApiProperty({
    description: 'Credential verification URL',
    example: 'https://www.credly.com/badges/example',
  })
  credentialUrl: string;

  @ApiProperty({ description: 'Expiration month', example: 'Nov', required: false })
  expirationMonth?: string;

  @ApiProperty({ description: 'Expiration year', example: '2028', required: false })
  expirationYear?: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  fullName: string;

  @ApiProperty({ description: 'Phone number', example: '0123456789', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({
    description: 'IANA time zone (for example: Asia/Ho_Chi_Minh)',
    example: 'Asia/Ho_Chi_Minh',
  })
  timeZone: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Short bio',
    example: 'Software developer...',
    required: false,
  })
  bio?: string;

  @ApiProperty({
    description: 'Company name (for freelancers)',
    example: 'ABC Company',
    required: false,
  })
  companyName?: string;

  @ApiProperty({
    description: 'Skills (for freelancers)',
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

  @ApiProperty({
    description: 'Professional certifications',
    type: [CertificationItemDto],
    required: false,
  })
  certifications?: CertificationItemDto[];

  @ApiProperty({ description: 'User role', example: 'CLIENT' })
  role: string;

  @ApiProperty({ description: 'Verification status', example: false })
  isVerified: boolean;

  @ApiProperty({ description: 'Whether the email is verified', example: true })
  isEmailVerified: boolean;

  @ApiPropertyOptional({
    description: 'Staff application approval status when the account role is STAFF',
    enum: StaffApplicationStatus,
  })
  staffApprovalStatus?: StaffApplicationStatus;

  @ApiPropertyOptional({
    description: 'When the staff application was reviewed',
    example: '2026-04-06T10:00:00.000Z',
    nullable: true,
  })
  staffApplicationReviewedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Rejection reason for a staff application',
    example: 'Not a fit for the current staff openings',
    nullable: true,
  })
  staffRejectionReason?: string | null;

  @ApiProperty({ description: 'Current trust score', example: 5.0 })
  currentTrustScore: number;

  @ApiProperty({
    description: 'Calculated user badge',
    enum: BadgeType,
    example: 'VERIFIED',
  })
  badge: BadgeType;

  @ApiProperty({
    description: 'Aggregated user statistics',
    type: UserStatsDto,
  })
  stats: UserStatsDto;

  @ApiProperty({ description: 'Account creation timestamp', example: '2025-12-18T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2025-12-18T10:00:00Z' })
  updatedAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'User information', type: AuthResponseDto })
  user: AuthResponseDto;

  @ApiProperty({
    description: 'Access token used to authorize API calls',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token used to renew the access token',
    example: 'abc123def456...',
  })
  refreshToken: string;
}

export class LogoutResponseDto {
  @ApiProperty({ description: 'Result message', example: 'Logout successful' })
  message: string;
}
