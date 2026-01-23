import { IsString, IsUUID, IsNotEmpty } from 'class-validator';
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
    description: 'ID of the contract to sign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;
}
