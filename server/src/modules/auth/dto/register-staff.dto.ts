import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../../database/entities/kyc-verification.entity';
import { IsNotDisposableEmail } from '../../../common/validators/disposable-email.validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';

export class RegisterStaffDto {
  @ApiProperty({
    description: 'User email address',
    example: 'staff.user@gmail.com',
    format: 'email',
  })
  @Transform(trimString)
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsNotDisposableEmail({
    message:
      'Please use an email from a reputable provider (Gmail, Outlook, Yahoo, etc.) or university email.',
  })
  email!: string;

  @ApiProperty({
    description:
      'User password (minimum 8 characters, with lowercase and number/special character)',
    example: 'securepass123',
    minLength: 8,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[\d@$!%*?&])/, {
    message:
      'Password must contain at least one lowercase letter and one number or special character (@$!%*?&)',
  })
  password!: string;

  @ApiProperty({
    description: 'User full name (2-50 characters, letters and spaces only)',
    example: 'John Doe',
    minLength: 2,
    maxLength: 50,
  })
  @Transform(trimString)
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(50, { message: 'Full name must not exceed 50 characters' })
  @Matches(/^[a-zA-ZÀ-ỹ\s]+$/, {
    message: 'Full name can only contain letters and spaces',
  })
  fullName!: string;

  @ApiProperty({
    description: 'Phone number (Vietnam format: 0[3|5|7|8|9]xxxxxxxx)',
    example: '0987654321',
    pattern: '^0[3|5|7|8|9][0-9]{8}$',
  })
  @Transform(trimString)
  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^0[3|5|7|8|9][0-9]{8}$/, {
    message:
      'Invalid phone number format. Correct format: 0[3|5|7|8|9]xxxxxxxx (e.g., 0987654321)',
  })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'Google reCAPTCHA token from frontend',
    example: 'recaptcha_response_token',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'reCAPTCHA token must be a string' })
  recaptchaToken?: string;

  @ApiProperty({
    description: 'Confirm acceptance of Terms of Service',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'acceptTerms must be a boolean' })
  @IsNotEmpty({ message: 'You must accept the Terms of Service' })
  acceptTerms!: boolean;

  @ApiProperty({
    description: 'Confirm acceptance of Privacy Policy',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'acceptPrivacy must be a boolean' })
  @IsNotEmpty({ message: 'You must accept the Privacy Policy' })
  acceptPrivacy!: boolean;

  @ApiProperty({
    description: 'Full name shown on the identity document',
    example: 'Nguyen Van A',
  })
  @Transform(trimString)
  @IsString({ message: 'fullNameOnDocument must be a string' })
  @IsNotEmpty({ message: 'fullNameOnDocument is required' })
  @MaxLength(255, { message: 'fullNameOnDocument must not exceed 255 characters' })
  fullNameOnDocument!: string;

  @ApiProperty({
    description: 'Document type',
    enum: DocumentType,
    example: DocumentType.CCCD,
  })
  @IsEnum(DocumentType, { message: 'documentType must be CCCD, PASSPORT, or DRIVER_LICENSE' })
  documentType!: DocumentType;

  @ApiProperty({
    description: 'Identity document number',
    example: '001234567890',
  })
  @Transform(trimString)
  @IsString({ message: 'documentNumber must be a string' })
  @IsNotEmpty({ message: 'documentNumber is required' })
  @MaxLength(32, { message: 'documentNumber must not exceed 32 characters' })
  documentNumber!: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsDateString({}, { message: 'dateOfBirth must be a valid ISO date string' })
  @IsNotEmpty({ message: 'dateOfBirth is required' })
  dateOfBirth!: string;

  @ApiProperty({
    description: 'Current address on the manual KYC form',
    example: '123 Street, Ward, District, City',
  })
  @Transform(trimString)
  @IsString({ message: 'address must be a string' })
  @IsNotEmpty({ message: 'address is required' })
  @MaxLength(500, { message: 'address must not exceed 500 characters' })
  address!: string;
}
