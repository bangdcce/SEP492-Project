import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  Matches,
  MaxLength,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';
import { IsNotDisposableEmail } from '../../../common/validators/disposable-email.validator';

/**
 * Allowed user roles for self-registration
 *
 * ADMIN and STAFF roles are excluded from self-registration for security reasons.
 * These roles should only be assigned by existing administrators.
 */
export type RegisterableRole =
  | UserRole.CLIENT
  | UserRole.BROKER
  | UserRole.FREELANCER;

/**
 * Object containing only the registerable roles for validation
 */
export const REGISTERABLE_ROLES = {
  CLIENT: UserRole.CLIENT,
  BROKER: UserRole.BROKER,
  FREELANCER: UserRole.FREELANCER,
} as const;

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@gmail.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsNotDisposableEmail({
    message: 'Please use an email from a reputable provider (Gmail, Outlook, Yahoo, etc.) or university email.',
  })
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters, with lowercase and number/special character)',
    example: 'securepass123',
    minLength: 8,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[\d@$!%*?&])/, {
    message: 'Password must contain at least one lowercase letter and one number or special character (@$!%*?&)',
  })
  password: string;

  @ApiProperty({
    description: 'User full name (2-50 characters, letters and spaces only)',
    example: 'John Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(50, { message: 'Full name must not exceed 50 characters' })
  @Matches(/^[a-zA-ZÀ-ỹ\s]+$/, {
    message: 'Full name can only contain letters and spaces',
  })
  fullName: string;

  @ApiProperty({
    description: 'Phone number (Vietnam format: 0[3|5|7|8|9]xxxxxxxx)',
    example: '0987654321',
    pattern: '^0[3|5|7|8|9][0-9]{8}$',
  })
  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^0[3|5|7|8|9][0-9]{8}$/, {
    message: 'Invalid phone number format. Correct format: 0[3|5|7|8|9]xxxxxxxx (e.g., 0987654321)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'User role in the system (only CLIENT, BROKER, FREELANCER allowed)',
    enum: REGISTERABLE_ROLES,
    example: UserRole.CLIENT,
  })
  @IsEnum(REGISTERABLE_ROLES, { message: 'Role must be CLIENT, BROKER, or FREELANCER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: RegisterableRole;

  @ApiPropertyOptional({
    description: 'Google reCAPTCHA token from frontend',
    example: 'recaptcha_response_token',
  })
  @IsOptional()
  @IsString({ message: 'reCAPTCHA token must be a string' })
  recaptchaToken?: string;

  @ApiPropertyOptional({
    description: 'Domain IDs (UUIDs) for BROKER and FREELANCER',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Domain IDs must be an array' })
  @IsString({ each: true, message: 'Each domain ID must be a UUID string' })
  domainIds?: string[];

  @ApiPropertyOptional({
    description: 'Skill IDs (UUIDs) for BROKER and FREELANCER',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Skill IDs must be an array' })
  @IsString({ each: true, message: 'Each skill ID must be a UUID string' })
  skillIds?: string[];

  @ApiProperty({
    description: 'Confirm acceptance of Terms of Service',
    example: true,
  })
  @IsBoolean({ message: 'acceptTerms must be a boolean' })
  @IsNotEmpty({ message: 'You must accept the Terms of Service' })
  acceptTerms: boolean;

  @ApiProperty({
    description: 'Confirm acceptance of Privacy Policy',
    example: true,
  })
  @IsBoolean({ message: 'acceptPrivacy must be a boolean' })
  @IsNotEmpty({ message: 'You must accept the Privacy Policy' })
  acceptPrivacy: boolean;
}
