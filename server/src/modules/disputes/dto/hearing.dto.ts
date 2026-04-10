import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsString,
  IsArray,
  IsBoolean,
  IsIn,
  IsUrl,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { coerceExternalMeetingLinkForValidation } from '../../../common/utils/external-meeting-link.util';
import {
  SpeakerRole,
  HearingTier,
  HearingStatementType,
  HearingParticipantRole,
  DisputePhase,
} from 'src/database/entities';
import { FollowUpActionDto, TransformFollowUpActions } from './follow-up-action.dto';

/**
 * DTO ?? len l?ch phien ?i?u tr?n
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
  @MaxLength(2000)
  @IsOptional()
  agenda?: string; // N?i dung c?n th?o lu?n

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[]; // Tai li?u yeu c?u chu?n b?

  @IsEnum(HearingTier)
  @IsOptional()
  tier?: HearingTier; // Default: TIER_1 (Staff)

  @Transform(({ value }) => coerceExternalMeetingLinkForValidation(value))
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    {
      message:
        'externalMeetingLink must be a valid URL. Google Meet links must use a code like abc-defg-hij.',
    },
  )
  @MaxLength(500)
  externalMeetingLink?: string; // Link Google Meet/Zoom n?u c?n video call

  @ApiPropertyOptional({
    description: 'Emergency hearing flag to bypass 24h notice rule',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional({
    description:
      'Dev/test-only bypass reason for controlled scheduling experiments when dispute test mode is enabled.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  testBypassReason?: string;
}

/**
 * DTO ?? Staff/Admin ?i?u khi?n Live Chat trong phien ?i?u tr?n
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
 * DTO ?? b?t ??u/k?t thuc phien ?i?u tr?n
 */
export class UpdateHearingStatusDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsString()
  @IsNotEmpty()
  action: 'start' | 'end' | 'cancel';

  @IsString()
  @MaxLength(5000)
  @IsNotEmpty()
  summary: string;

  @IsString()
  @MaxLength(5000)
  @IsNotEmpty()
  findings: string;

  @TransformFollowUpActions()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowUpActionDto)
  @IsOptional()
  pendingActions?: FollowUpActionDto[];

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  noShowNote?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  cancelReason?: string; // Ly do h?y (khi cancel)
}

/**
 * DTO ?? participant ph?n h?i l?i m?i
 */
export class RespondHearingInviteDto {
  @IsUUID()
  @IsNotEmpty()
  participantId: string; // EventParticipantEntity.id (calendar invite participant)

  @IsString()
  @IsNotEmpty()
  response: 'accept' | 'decline' | 'tentative';

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  declineReason?: string;
}

export class HearingStatementContentBlockDto {
  @IsString()
  @MaxLength(32)
  @IsNotEmpty()
  kind:
    | 'SUMMARY'
    | 'FACTS'
    | 'EVIDENCE_BASIS'
    | 'ANALYSIS'
    | 'REMEDY'
    | 'ATTESTATION'
    | 'CUSTOM';

  @IsString()
  @MaxLength(120)
  @IsOptional()
  heading?: string;

  @IsString()
  @MaxLength(4000)
  @IsNotEmpty()
  body: string;
}

/**
 * DTO n?p l?i khai (draft ho?c submit)
 */
export class SubmitHearingStatementDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsEnum(HearingStatementType)
  @IsNotEmpty()
  type: HearingStatementType;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(10000)
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @ValidateNested({ each: true })
  @Type(() => HearingStatementContentBlockDto)
  @IsArray()
  @IsOptional()
  contentBlocks?: HearingStatementContentBlockDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  citedEvidenceIds?: string[];

  @IsBoolean()
  @IsOptional()
  platformDeclarationAccepted?: boolean;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  changeSummary?: string;

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
 * DTO ph?n quy?t OBJECTION (SUSTAINED ho?c OVERRULED)
 */
export class ResolveObjectionDto {
  @IsUUID()
  @IsNotEmpty()
  statementId: string;

  @IsIn(['SUSTAINED', 'OVERRULED'])
  @IsNotEmpty()
  ruling: 'SUSTAINED' | 'OVERRULED';
}

/**
 * DTO ??t cau h?i trong hearing
 */
export class AskHearingQuestionDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;

  @IsString()
  @MaxLength(2000)
  @IsNotEmpty()
  question: string;

  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  deadlineMinutes?: number; // Default: 10 minutes
}

/**
 * DTO tr? l?i cau h?i trong hearing
 */
export class AnswerHearingQuestionDto {
  @IsString()
  @MaxLength(5000)
  @IsNotEmpty()
  answer: string;
}

/**
 * DTO k?t thuc hearing
 */
export class EndHearingDto {
  @IsUUID()
  @IsNotEmpty()
  hearingId: string;

  @IsString()
  @MaxLength(5000)
  @IsNotEmpty()
  summary: string;

  @IsString()
  @MaxLength(5000)
  @IsNotEmpty()
  findings: string;

  @TransformFollowUpActions()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowUpActionDto)
  @IsOptional()
  pendingActions?: FollowUpActionDto[];

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  noShowNote?: string;

  @IsOptional()
  @IsBoolean()
  forceEnd?: boolean;
}

/**
 * DTO d?i l?ch phien ?i?u tr?n
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
  @MaxLength(2000)
  @IsOptional()
  agenda?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredDocuments?: string[];

  @Transform(({ value }) => coerceExternalMeetingLinkForValidation(value))
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    {
      message:
        'externalMeetingLink must be a valid URL. Google Meet links must use a code like abc-defg-hij.',
    },
  )
  @MaxLength(500)
  externalMeetingLink?: string;

  @ApiPropertyOptional({
    description: 'Emergency hearing flag to bypass 24h notice rule',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional({
    description:
      'Dev/test-only bypass reason for controlled scheduling experiments when dispute test mode is enabled.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  testBypassReason?: string;
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
  @MaxLength(1000)
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
  @MaxLength(1000)
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
  @MaxLength(1000)
  @IsNotEmpty()
  reason: string;
}

export class PauseHearingDto {
  @IsString()
  @MaxLength(1000)
  @IsNotEmpty()
  reason: string;
}

