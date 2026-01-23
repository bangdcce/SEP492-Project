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
  | UserRole.CLIENT_SME
  | UserRole.BROKER
  | UserRole.FREELANCER;

/**
 * Object containing only the registerable roles for validation
 */
export const REGISTERABLE_ROLES = {
  CLIENT: UserRole.CLIENT,
  CLIENT_SME: UserRole.CLIENT_SME,
  BROKER: UserRole.BROKER,
  FREELANCER: UserRole.FREELANCER,
} as const;

export class RegisterDto {
  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsNotDisposableEmail({ message: 'Không chấp nhận email tạm thời. Vui lòng sử dụng email thường xuyên.' })
  email: string;

  @ApiProperty({
    description:
      'Mật khẩu của người dùng (ít nhất 8 ký tự, có chữ thường, số và ký tự đặc biệt)',
    example: 'securepass123!',
    minLength: 8,
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải chứa ít nhất một chữ thường, một số và một ký tự đặc biệt (@$!%*?&)',
  })
  password: string;

  @ApiProperty({
    description: 'Họ và tên đầy đủ của người dùng (2-50 ký tự, chỉ chứa chữ cái và khoảng trắng)',
    example: 'Nguyễn Văn A',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Họ tên không được vượt quá 50 ký tự' })
  @Matches(/^[a-zA-ZÀ-ỹ\s]+$/, {
    message: 'Họ tên chỉ được chứa chữ cái và khoảng trắng',
  })
  fullName: string;

  @ApiProperty({
    description: 'Số điện thoại của người dùng (định dạng Việt Nam: 0[3|5|7|8|9]xxxxxxxx)',
    example: '0987654321',
    pattern: '^0[3|5|7|8|9][0-9]{8}$',
  })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^0[3|5|7|8|9][0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ. Định dạng đúng: 0[3|5|7|8|9]xxxxxxxx (ví dụ: 0987654321)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Vai trò của người dùng trong hệ thống (chỉ cho phép CLIENT, BROKER, FREELANCER)',
    enum: REGISTERABLE_ROLES,
    example: UserRole.CLIENT,
  })
  @IsEnum(REGISTERABLE_ROLES, { message: 'Role phải là CLIENT, BROKER hoặc FREELANCER' })
  @IsNotEmpty({ message: 'Role không được để trống' })
  role: RegisterableRole;

  @ApiPropertyOptional({
    description: 'Google reCAPTCHA token từ frontend',
    example: 'recaptcha_response_token',
  })
  @IsOptional()
  @IsString({ message: 'reCAPTCHA token phải là chuỗi ký tự' })
  recaptchaToken?: string;

  @ApiPropertyOptional({
    description: 'Domain IDs (UUIDs) cho BROKER và FREELANCER',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Domain IDs phải là mảng' })
  @IsString({ each: true, message: 'Mỗi domain ID phải là chuỗi UUID' })
  domainIds?: string[];

  @ApiPropertyOptional({
    description: 'Skill IDs (UUIDs) cho BROKER và FREELANCER',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Skill IDs phải là mảng' })
  @IsString({ each: true, message: 'Mỗi skill ID phải là chuỗi UUID' })
  skillIds?: string[];

  @ApiProperty({
    description: 'Xác nhận chấp nhận Điều khoản Dịch vụ',
    example: true,
  })
  @IsBoolean({ message: 'acceptTerms phải là boolean' })
  @IsNotEmpty({ message: 'Bạn phải chấp nhận Điều khoản Dịch vụ' })
  acceptTerms: boolean;

  @ApiProperty({
    description: 'Xác nhận chấp nhận Chính sách Bảo mật',
    example: true,
  })
  @IsBoolean({ message: 'acceptPrivacy phải là boolean' })
  @IsNotEmpty({ message: 'Bạn phải chấp nhận Chính sách Bảo mật' })
  acceptPrivacy: boolean;
}
