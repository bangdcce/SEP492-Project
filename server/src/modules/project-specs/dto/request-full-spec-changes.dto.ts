import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RequestFullSpecChangesDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;
}
