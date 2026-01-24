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
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SpeakerRole, HearingTier, HearingStatementType } from 'src/database/entities';

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

  @ApiPropertyOptional({
    description: 'Emergency hearing flag to bypass 24h notice rule',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
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

/**
 * DTO nộp lời khai (draft hoặc submit)
 */
export class SubmitHearingStatementDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsEnum(HearingStatementType)
  @IsNotEmpty()
  type: HearingStatementType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsUUID()
  @IsOptional()
  replyToStatementId?: string;

  @IsUUID()
  @IsOptional()
  retractionOfStatementId?: string;

  @IsUUID()
  @IsOptional()
  draftId?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

/**
 * DTO đặt câu hỏi trong hearing
 */
export class AskHearingQuestionDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  deadlineMinutes?: number; // Default: 10 minutes
}

/**
 * DTO kết thúc hearing
 */
export class EndHearingDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  findings?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pendingActions?: string[];

  @IsOptional()
  @IsBoolean()
  forceEnd?: boolean;
}

/**
 * DTO dời lịch phiên điều trần
 */
export class RescheduleHearingDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string; // ISO 8601 format

  @IsInt()
  @Min(15)
  @Max(240)
  @IsOptional()
  estimatedDurationMinutes?: number;

  @IsString()
  @IsOptional()
  agenda?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[];

  @IsString()
  @IsOptional()
  externalMeetingLink?: string;

  @ApiPropertyOptional({
    description: 'Emergency hearing flag to bypass 24h notice rule',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}
