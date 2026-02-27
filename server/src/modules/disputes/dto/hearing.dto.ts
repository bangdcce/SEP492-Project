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
import {
  SpeakerRole,
  HearingTier,
  HearingStatementType,
  HearingParticipantRole,
  DisputePhase,
} from 'src/database/entities';

/**
 * DTO ﾄ黛ｻ・lﾃｪn l盻議h phiﾃｪn ﾄ訴盻「 tr蘯ｧn
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
  agenda?: string; // N盻冓 dung c蘯ｧn th蘯｣o lu蘯ｭn

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[]; // Tﾃi li盻㎡ yﾃｪu c蘯ｧu chu蘯ｩn b盻・

  @IsEnum(HearingTier)
  @IsOptional()
  tier?: HearingTier; // Default: TIER_1 (Staff)

  @IsString()
  @IsOptional()
  externalMeetingLink?: string; // Link Google Meet/Zoom n蘯ｿu c蘯ｧn video call

  @ApiPropertyOptional({
    description: 'Emergency hearing flag to bypass 24h notice rule',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}

/**
 * DTO ﾄ黛ｻ・Staff/Admin ﾄ訴盻「 khi盻ハ Live Chat trong phiﾃｪn ﾄ訴盻「 tr蘯ｧn
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
 * DTO ﾄ黛ｻ・b蘯ｯt ﾄ黛ｺｧu/k蘯ｿt thﾃｺc phiﾃｪn ﾄ訴盻「 tr蘯ｧn
 */
export class UpdateHearingStatusDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsString()
  @IsNotEmpty()
  action: 'start' | 'end' | 'cancel';

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  findings: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pendingActions?: string[];

  @IsString()
  @IsOptional()
  noShowNote?: string;

  @IsString()
  @IsOptional()
  cancelReason?: string; // Lﾃｽ do h盻ｧy (khi cancel)
}

/**
 * DTO ﾄ黛ｻ・participant ph蘯｣n h盻妬 l盻拱 m盻拱
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
 * DTO n盻冪 l盻拱 khai (draft ho蘯ｷc submit)
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
 * DTO ﾄ黛ｺｷt cﾃ｢u h盻淑 trong hearing
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
 * DTO tr蘯｣ l盻拱 cﾃ｢u h盻淑 trong hearing
 */
export class AnswerHearingQuestionDto {
  @IsString()
  @IsNotEmpty()
  answer: string;
}

/**
 * DTO k蘯ｿt thﾃｺc hearing
 */
export class EndHearingDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  findings: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pendingActions?: string[];

  @IsString()
  @IsOptional()
  noShowNote?: string;

  @IsOptional()
  @IsBoolean()
  forceEnd?: boolean;
}

/**
 * DTO d盻拱 l盻議h phiﾃｪn ﾄ訴盻「 tr蘯ｧn
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

export class TransitionHearingPhaseDto {
  @IsUUID()
  @IsOptional()
  hearingId?: string;

  @IsEnum(DisputePhase)
  @IsNotEmpty()
  phase: DisputePhase;
}

export class ExtendHearingDto {
  @IsUUID()
  @IsOptional()
  hearingId?: string;

  @IsInt()
  @Min(5)
  @Max(240)
  additionalMinutes: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class InviteSupportStaffDto {
  @IsUUID()
  @IsOptional()
  hearingId?: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(HearingParticipantRole)
  @IsOptional()
  participantRole?: HearingParticipantRole;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class DispatchHearingRemindersDto {
  @IsDateString()
  @IsOptional()
  at?: string;
}

export class OpenEvidenceIntakeDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class PauseHearingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

