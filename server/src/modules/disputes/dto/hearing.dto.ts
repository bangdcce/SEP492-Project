import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsArray,
} from 'class-validator';
import { SpeakerRole, HearingTier } from 'src/database/entities';

/**
 * DTO để lên lịch phiên điều trần
 */
export class ScheduleHearingDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string; // ISO 8601 format

  @IsInt()
  @Min(15)
  @Max(240)
  @IsOptional()
  estimatedDurationMinutes?: number; // Default: 60

  @IsString()
  @IsOptional()
  agenda?: string; // Nội dung cần thảo luận

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[]; // Tài liệu yêu cầu chuẩn bị

  @IsEnum(HearingTier)
  @IsOptional()
  tier?: HearingTier; // Default: TIER_1 (Staff)

  @IsString()
  @IsOptional()
  externalMeetingLink?: string; // Link Google Meet/Zoom nếu cần video call
}

/**
 * DTO để Staff/Admin điều khiển Live Chat trong phiên điều trần
 */
export class ModerateHearingDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsEnum(SpeakerRole)
  @IsNotEmpty()
  speakerRole: SpeakerRole;
}

/**
 * DTO để bắt đầu/kết thúc phiên điều trần
 */
export class UpdateHearingStatusDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsString()
  @IsNotEmpty()
  action: 'start' | 'end' | 'cancel';

  @IsString()
  @IsOptional()
  summary?: string; // Tóm tắt (khi end)

  @IsString()
  @IsOptional()
  findings?: string; // Phát hiện quan trọng (khi end)

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pendingActions?: string[]; // Việc cần làm tiếp (khi end)

  @IsString()
  @IsOptional()
  cancelReason?: string; // Lý do hủy (khi cancel)
}

/**
 * DTO để participant phản hồi lời mời
 */
export class RespondHearingInviteDto {
  @IsUUID()
  @IsNotEmpty()
  participantId: string; // HearingParticipantEntity.id

  @IsString()
  @IsNotEmpty()
  response: 'accept' | 'decline' | 'tentative';

  @IsString()
  @IsOptional()
  declineReason?: string;
}
