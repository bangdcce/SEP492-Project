import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO đềEgửi khiếu nại lại (Appeal) sau khi dispute đã được resolve
 */
export class AppealDto {
  @IsNotEmpty({ message: 'Lý do khiếu nại không được đềEtrống' })
  @IsString()
  @MinLength(200, { message: 'Appeal reason must be at least 200 characters' })
  @MaxLength(2000)
  reason: string;

  /**
   * Bằng chứng bềEsung cho khiếu nại (URLs)
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalEvidence?: string[];

  @IsBoolean()
  @IsNotEmpty()
  disclaimerAccepted: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  disclaimerVersion?: string;
}

/**
 * DTO đềEAdmin xử lý khiếu nại (Appeal)
 */
export class ResolveAppealDto {
  @IsNotEmpty({ message: 'Kết quả xử lý khiếu nại không được đềEtrống' })
  @IsString()
  resolution: string;

  /**
   * TRUE = Chấp nhận khiếu nại, mềElại case
   * FALSE = Từ chối khiếu nại, giữ nguyên kết quả cũ
   */
  @IsNotEmpty()
  accepted: boolean;
}

