import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class CompleteGoogleSignupDto {
  @ApiProperty({
    description: 'Email returned by Google OAuth',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'Full name returned by Google',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '0987654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, {
    message:
      'Phone number must be a valid Vietnamese mobile number (10 digits, starting with 03, 05, 07, 08, or 09)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.CLIENT,
  })
  @IsEnum(UserRole, { message: 'Role must be CLIENT, BROKER, or FREELANCER' })
  @IsNotEmpty({ message: 'Role is required' })
  role: string;

  @ApiPropertyOptional({
    description: 'Avatar image returned by Google',
    example: 'https://lh3.googleusercontent.com/...',
  })
  @IsOptional()
  @IsString()
  picture?: string;
}
