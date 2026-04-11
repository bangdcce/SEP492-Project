import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  ValidateNested,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

import { AuthResponseDto } from './auth-response.dto';

class PortfolioLinkDto {
  @IsString()
  title: string;

  @IsUrl()
  url: string;
}

class CertificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  issuingOrganization: string;

  @IsString()
  @IsNotEmpty()
  issueMonth: string;

  @IsString()
  @Matches(/^\d{4}$/)
  issueYear: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  credentialId?: string;

  @IsUrl()
  credentialUrl: string;

  @IsOptional()
  @IsString()
  expirationMonth?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  expirationYear?: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Full name must be a string' })
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Full name must not exceed 50 characters' })
  @Matches(/^[a-zA-ZÀ-ỹ\s]+$/, {
    message: 'Full name can only contain letters and spaces',
  })
  fullName?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '0123456789',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone number must contain 10 to 11 digits',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Avatar URL must be a string' })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Short bio',
    example: 'I am a full-stack developer...',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  bio?: string;

  @ApiProperty({
    description: 'Company name (for freelancers)',
    example: 'ABC Software Company',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({
    description: 'Skill list (for freelancers)',
    example: ['React', 'Node.js', 'TypeScript'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({
    description: 'Portfolio links',
    example: [{ title: 'E-commerce Website', url: 'https://github.com/...' }],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioLinkDto)
  portfolioLinks?: PortfolioLinkDto[];

  @ApiProperty({
    description: 'LinkedIn profile URL',
    example: 'https://www.linkedin.com/in/username',
    required: false,
  })
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiProperty({
    description: 'CV URL (base64 or cloud URL)',
    example: 'data:application/pdf;base64,...',
    required: false,
  })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiProperty({
    description: 'Professional certifications',
    example: [
      {
        name: 'IBM Business Analyst',
        issuingOrganization: 'IBM',
        issueMonth: 'Nov',
        issueYear: '2025',
        credentialId: 'R3N2OL4NM58R',
        credentialUrl: 'https://www.credly.com/badges/example',
      },
    ],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];

  @ApiProperty({
    description: 'IANA time zone (for example: Asia/Ho_Chi_Minh)',
    example: 'Asia/Ho_Chi_Minh',
    required: false,
  })
  @IsOptional()
  @IsString()
  timeZone?: string;
}

export class UpdateProfileResponseDto {
  @ApiProperty({ description: 'Result message' })
  message: string;

  @ApiProperty({ description: 'Updated user data' })
  data: AuthResponseDto;
}
