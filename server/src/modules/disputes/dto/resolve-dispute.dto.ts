import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DisputeResult } from 'src/database/entities';

export class ResolveDisputeDto {
  @IsNotEmpty({ message: 'Verdict (kết quả phán quyết) là bắt buộc' })
  @IsEnum(DisputeResult, {
    message: 'Verdict phải là WIN_CLIENT, WIN_FREELANCER hoặc SPLIT',
  })
  verdict: DisputeResult;

  @IsNotEmpty({ message: 'Admin comment (lý do phán quyết) là bắt buộc' })
  @IsString()
  adminComment: string;

  /**
   * Tỷ lệ % tiền trả về Client (chỉ dùng khi verdict = SPLIT)
   * VD: splitRatioClient = 60 nghĩa là Client nhận 60%, Freelancer nhận 40%
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  splitRatioClient?: number;
}
