import { IsNotEmpty, IsString, IsArray, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO để bị đơn (Defendant) gửi phản hồi và bằng chứng phản bác
 */
export class DefendantResponseDto {
  @IsNotEmpty({ message: 'Lời giải trình không được để trống' })
  @IsString()
  @MaxLength(5000)
  response: string;

  /**
   * Bằng chứng phản bác (URLs)
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}
