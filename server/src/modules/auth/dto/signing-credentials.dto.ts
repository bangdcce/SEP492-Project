import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class InitializeSigningCredentialDto {
  @ApiProperty({
    description: 'User-defined signing PIN used to unlock the private key',
    example: '123456',
  })
  @IsString()
  @Matches(/^\d{4,8}$/)
  pin: string;

  @ApiProperty({
    description: 'RSA modulus length for generated keypair',
    required: false,
    enum: [2048, 4096],
    default: 2048,
  })
  @IsOptional()
  @IsIn([2048, 4096])
  modulusLength?: number;
}

export class RotateSigningCredentialDto {
  @ApiProperty({
    description: 'Current signing PIN',
    example: '123456',
  })
  @IsString()
  @Matches(/^\d{4,8}$/)
  oldPin: string;

  @ApiProperty({
    description: 'New signing PIN',
    example: '654321',
  })
  @IsString()
  @Matches(/^\d{4,8}$/)
  newPin: string;

  @ApiProperty({
    description: 'RSA modulus length for rotated keypair',
    required: false,
    enum: [2048, 4096],
    default: 2048,
  })
  @IsOptional()
  @IsIn([2048, 4096])
  modulusLength?: number;
}
