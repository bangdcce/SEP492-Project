import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Họ và tên đầy đủ của người dùng',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Họ tên không được vượt quá 50 ký tự' })
  @Matches(/^[a-zA-ZÀ-ỹ\s]+$/, {
    message: 'Họ tên chỉ được chứa chữ cái và khoảng trắng',
  })
  fullName?: string;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0123456789',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Số điện thoại phải là 10-11 chữ số',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'URL ảnh đại diện',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Avatar URL phải là chuỗi ký tự' })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Giới thiệu bản thân',
    example: 'Tôi là một lập trình viên fullstack...',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bio phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Bio không được vượt quá 500 ký tự' })
  bio?: string;
}

export class UpdateProfileResponseDto {
  @ApiProperty({ description: 'Thông báo kết quả' })
  message: string;

  @ApiProperty({ description: 'Dữ liệu người dùng sau khi cập nhật' })
  data: any;
}
