import { IsNotEmpty, IsString, IsArray, IsOptional } from 'class-validator';

/**
 * DTO để gửi khiếu nại lại (Appeal) sau khi dispute đã được resolve
 */
export class AppealDto {
  @IsNotEmpty({ message: 'Lý do khiếu nại không được để trống' })
  @IsString()
  reason: string;

  /**
   * Bằng chứng bổ sung cho khiếu nại (URLs)
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalEvidence?: string[];
}

/**
 * DTO để Admin xử lý khiếu nại (Appeal)
 */
export class ResolveAppealDto {
  @IsNotEmpty({ message: 'Kết quả xử lý khiếu nại không được để trống' })
  @IsString()
  resolution: string;

  /**
   * TRUE = Chấp nhận khiếu nại, mở lại case
   * FALSE = Từ chối khiếu nại, giữ nguyên kết quả cũ
   */
  @IsNotEmpty()
  accepted: boolean;
}
