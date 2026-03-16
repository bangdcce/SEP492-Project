import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';

/**
 * DTO để tạo đề xuất hòa giải
 */
export class CreateSettlementOfferDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId: string;

  @IsNumber()
  @Min(0)
  amountToFreelancer: number;

  @IsNumber()
  @Min(0)
  amountToClient: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  terms?: string; // Điều kiện/ghi chú kèm theo
}

/**
 * Enum cho hành động phản hồi Settlement
 */
export enum SettlementAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

/**
 * DTO để phản hồi đề xuất hòa giải
 */
export class RespondSettlementDto {
  @IsUUID()
  @IsNotEmpty()
  settlementId: string;

  @IsEnum(SettlementAction)
  @IsNotEmpty()
  action: SettlementAction;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  rejectReason?: string; // Bắt buộc nếu action = REJECT
}

/**
 * DTO để hủy đề xuất hòa giải (người tạo tự hủy)
 */
export class CancelSettlementDto {
  @IsUUID()
  @IsNotEmpty()
  settlementId: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  cancelReason?: string;
}
