import { IsString, MinLength } from 'class-validator';

export class AppealRejectionDto {
  @IsString()
  @MinLength(10)
  reason: string;
}
