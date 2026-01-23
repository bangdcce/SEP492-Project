import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DisputeResult, FaultType } from 'src/database/entities';
import { VerdictReasoningDto } from './verdict.dto';

export class ResolveDisputeDto {
  @IsOptional()
  @IsEnum(DisputeResult, {
    message: 'Result phải là WIN_CLIENT, WIN_FREELANCER hoặc SPLIT',
  })
  result?: DisputeResult;

  @IsOptional()
  @IsEnum(DisputeResult, {
    message: 'Verdict phải là WIN_CLIENT, WIN_FREELANCER hoặc SPLIT',
  })
  verdict?: DisputeResult;

  @IsNotEmpty({ message: 'Admin comment (lý do phán quyết) là bắt buộc' })
  @IsString()
  adminComment: string;

  @IsEnum(FaultType)
  @IsNotEmpty()
  faultType: FaultType;

  @IsString()
  @IsNotEmpty({ message: 'Bên có lỗi không được để trống (raiser/defendant/both/none)' })
  faultyParty: string;

  @ValidateNested()
  @Type(() => VerdictReasoningDto)
  @IsNotEmpty({ message: 'Lý do phán quyết không được để trống' })
  reasoning: VerdictReasoningDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountToFreelancer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountToClient?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trustScorePenalty?: number;

  @IsOptional()
  @IsBoolean()
  banUser?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  banDurationDays?: number;

  @IsOptional()
  @IsString()
  warningMessage?: string;

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
