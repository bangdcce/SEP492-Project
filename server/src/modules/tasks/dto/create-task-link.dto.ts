import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateTaskLinkDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
