import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DisputeResult, FaultType } from 'src/database/entities';

/**
 * DTO cho lý do phán quyết có cấu trúc chuẩn hóa
 * Giúp staff đưa ra phán quyết chuyên nghiệp, minh bạch, dễ hiểu
 */
export class VerdictReasoningDto {
  /**
   * Các điều khoản/chính sách bị vi phạm (format: "TOS-3.2: Mô tả ngắn gọn")
   * VD: ["TOS-3.2: Freelancer phải giao hàng đúng deadline", "SLA-5.1: Chất lượng phải đạt yêu cầu"]
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải trích dẫn ít nhất 1 điều khoản bị vi phạm' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  violatedPolicies: string[];

  /**
   * UUIDs của các evidence liên quan đến phán quyết
   */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  supportingEvidenceIds?: string[];

  /**
   * Nhận định về sự việc (fact-finding)
   * VD: "Dựa trên chat logs và screenshots, freelancer đã không giao deliverable sau 3 lần nhắc nhở..."
   */
  @IsString()
  @IsNotEmpty({ message: 'Nhận định sự việc không được để trống' })
  factualFindings: string;

  /**
   * Phân tích pháp lý/chính sách
   * VD: "Theo TOS-3.2, việc không giao hàng đúng hạn cấu thành vi phạm nghiêm trọng vì..."
   */
  @IsString()
  @IsNotEmpty({ message: 'Phân tích pháp lý không được để trống' })
  legalAnalysis: string;

  /**
   * Kết luận cuối cùng
   * VD: "Do đó, nền tảng xác định Defendant (freelancer) có lỗi và phải chịu trách nhiệm..."
   */
  @IsString()
  @IsNotEmpty({ message: 'Kết luận không được để trống' })
  conclusion: string;
}

/**
 * DTO để Staff/Admin ra phán quyết
 * Thay thế resolve-dispute.dto với đầy đủ thông tin penalty
 */
export class AdminVerdictDto {
  @IsUUID()
  @IsOptional()
  disputeId?: string;

  // === DECISION ===
  @IsEnum(DisputeResult, {
    message: 'Result phải là WIN_CLIENT, WIN_FREELANCER hoặc SPLIT',
  })
  @IsNotEmpty()
  result: DisputeResult;

  @IsEnum(FaultType)
  @IsNotEmpty()
  faultType: FaultType;

  @IsString()
  @IsNotEmpty({ message: 'Bên có lỗi không được để trống (raiser/defendant/both/none)' })
  faultyParty: string; // 'raiser' | 'defendant' | 'both' | 'none'

  @ValidateNested()
  @Type(() => VerdictReasoningDto)
  @IsNotEmpty({ message: 'Lý do phán quyết không được để trống' })
  reasoning: VerdictReasoningDto;

  @IsString()
  @IsOptional()
  adminComment?: string;

  // === MONEY SPLIT ===
  @IsNumber()
  @Min(0)
  amountToFreelancer: number;

  @IsNumber()
  @Min(0)
  amountToClient: number;

  // === PENALTY ===
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  trustScorePenalty?: number; // Điểm Trust Score bị trừ (0-100)

  @IsBoolean()
  @IsOptional()
  banUser?: boolean; // Cấm user hoạt động?

  @IsNumber()
  @Min(0)
  @IsOptional()
  banDurationDays?: number; // Số ngày bị cấm

  @IsString()
  @IsOptional()
  warningMessage?: string; // Cảnh cáo gửi cho bên có lỗi
}

/**
 * DTO để Admin phúc thẩm (override Staff verdict)
 */
export class AppealVerdictDto extends AdminVerdictDto {
  @IsUUID()
  @IsNotEmpty()
  overridesVerdictId: string; // Verdict ID của Staff bị override

  @IsString()
  @IsNotEmpty({ message: 'Lý do override không được để trống' })
  overrideReason: string;
}
