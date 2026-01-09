import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export enum HearingStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  RESCHEDULED = 'RESCHEDULED',
}

export enum HearingStatementType {
  OPENING = 'OPENING', // Lời khai mở đầu
  EVIDENCE = 'EVIDENCE', // Trình bày bằng chứng
  REBUTTAL = 'REBUTTAL', // Phản bác
  CLOSING = 'CLOSING', // Kết luận
  QUESTION = 'QUESTION', // Câu hỏi từ Admin
  ANSWER = 'ANSWER', // Trả lời
}

/**
 * DTO để schedule một phiên điều trần
 */
export class ScheduleHearingDto {
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  agenda?: string; // Nội dung cần thảo luận

  @IsOptional()
  @IsString()
  meetingLink?: string; // Link Google Meet/Zoom

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[]; // Tài liệu yêu cầu các bên chuẩn bị

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  additionalParticipantIds?: string[]; // Thêm người tham gia khác (nhân chứng)
}

/**
 * DTO để reschedule phiên điều trần
 */
export class RescheduleHearingDto {
  @IsNotEmpty()
  @IsDateString()
  newScheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * DTO để gửi statement trong phiên điều trần
 */
export class SubmitStatementDto {
  @IsNotEmpty()
  @IsEnum(HearingStatementType)
  type: HearingStatementType;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[]; // URLs của file đính kèm

  @IsOptional()
  @IsUUID('4')
  replyToStatementId?: string; // Nếu là phản bác/trả lời statement trước
}

/**
 * DTO Admin đặt câu hỏi cho các bên
 */
export class AdminQuestionDto {
  @IsNotEmpty()
  @IsUUID('4')
  targetUserId: string; // Người cần trả lời

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  question: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  deadlineMinutes?: number; // Hạn trả lời tính bằng phút

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean; // Bắt buộc trả lời trước khi kết phiên
}

/**
 * DTO để trả lời câu hỏi từ Admin
 */
export class AnswerQuestionDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  answer: string;
}

/**
 * DTO để conclude phiên điều trần
 */
export class ConcludeHearingDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  summary: string; // Tóm tắt phiên điều trần

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  findings?: string; // Những phát hiện quan trọng

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pendingActions?: string[]; // Các việc cần làm tiếp

  @IsOptional()
  @IsBoolean()
  forceClose?: boolean; // Bỏ qua các câu hỏi chưa được trả lời
}

/**
 * Response interface cho Hearing
 */
export interface HearingResponse {
  id: string;
  disputeId: string;
  status: HearingStatus;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  agenda?: string;
  meetingLink?: string;
  requiredDocuments?: string[];
  summary?: string;
  findings?: string;
  moderatorId: string;
  participants: HearingParticipant[];
  statements: HearingStatement[];
  questions: HearingQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HearingParticipant {
  id: string;
  hearingId: string;
  userId: string;
  role: 'RAISER' | 'DEFENDANT' | 'WITNESS' | 'MODERATOR';
  joinedAt?: Date;
  leftAt?: Date;
  isOnline: boolean;
}

export interface HearingStatement {
  id: string;
  hearingId: string;
  participantId: string;
  type: HearingStatementType;
  content: string;
  attachments?: string[];
  replyToStatementId?: string;
  createdAt: Date;
}

export interface HearingQuestion {
  id: string;
  hearingId: string;
  askedById: string;
  targetUserId: string;
  question: string;
  answer?: string;
  answeredAt?: Date;
  deadline?: Date;
}
