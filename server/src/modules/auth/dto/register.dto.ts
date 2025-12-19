import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RegisterRole {
  CLIENT = 'CLIENT',
  BROKER = 'BROKER', 
  FREELANCER = 'FREELANCER',
}

export class RegisterDto {
  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    description: 'Mật khẩu của người dùng',
    example: 'password123',
    minLength: 6,
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @ApiProperty({
    description: 'Họ và tên đầy đủ của người dùng',
    example: 'Nguyễn Văn A',
  })
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({
    description: 'Số điện thoại của người dùng',
    example: '0123456789',
  })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phoneNumber: string;

  @ApiProperty({
    description: 'Vai trò của người dùng trong hệ thống',
    enum: RegisterRole,
    example: RegisterRole.CLIENT,
  })
  @IsEnum(RegisterRole, { message: 'Role phải là CLIENT, BROKER hoặc FREELANCER' })
  @IsNotEmpty({ message: 'Role không được để trống' })
  role: RegisterRole;
}