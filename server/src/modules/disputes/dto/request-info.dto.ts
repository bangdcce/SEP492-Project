import { IsString, MinLength } from 'class-validator';

export class RequestDisputeInfoDto {
  @IsString()
  @MinLength(10)
  reason: string;
}
