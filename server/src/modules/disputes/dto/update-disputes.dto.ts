import { IsNotEmpty, IsUUID, IsString, IsArray } from 'class-validator';

export class UpdateDisputeDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  evidence: string[];
}
