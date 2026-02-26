import { IsString, IsUUID, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializeContractDto {
  @ApiProperty({
    description: 'ID of the approved ProjectSpec',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  specId: string;

  @ApiProperty({
    description: 'ID of the Freelancer assigned to this project',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  freelancerId: string;
}

export class SignContractDto {
  @ApiProperty({
    description: 'Client-generated signature hash for contract signing',
    example: '5f2730f249cf092ec0b8ce68f99ecf251f3ccf8508df34f4c9c8e49f13fbfa6f',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(512)
  signatureHash: string;
}
