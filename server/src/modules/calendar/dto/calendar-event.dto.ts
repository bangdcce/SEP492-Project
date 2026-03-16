import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsArray,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { EventType, EventPriority } from 'src/database/entities';

/**
 * DTO để tạo Calendar Event
 */
export class CreateCalendarEventDto {
  @IsEnum(EventType)
  @IsNotEmpty()
  type: EventType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(EventPriority)
  @IsOptional()
  priority?: EventPriority;

  // === TIMING ===
  @IsDateString()
  @IsNotEmpty()
  startTime: string; // ISO 8601

  @IsDateString()
  @IsNotEmpty()
  endTime: string; // ISO 8601

  // === REFERENCE (Polymorphic) ===
  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceType?: string; // 'DisputeHearing', 'Project', etc.

  @IsUUID()
  @IsOptional()
  referenceId?: string;

  // === LOCATION ===
  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  externalMeetingLink?: string;

  // === PARTICIPANTS ===
  @IsArray()
  @IsOptional()
  participantUserIds?: string[]; // User IDs để mời

  // === REMINDERS ===
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  reminderMinutes?: number[]; // [15, 60, 1440]

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  // === AUTO-SCHEDULE ===
  @IsBoolean()
  @IsOptional()
  useAutoSchedule?: boolean; // TRUE = để hệ thống chọn giờ & Staff
}

/**
 * DTO để cập nhật Calendar Event
 */
export class UpdateCalendarEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(EventPriority)
  @IsOptional()
  priority?: EventPriority;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  externalMeetingLink?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  reminderMinutes?: number[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

/**
 * DTO để query/filter Calendar Events
 */
export class CalendarEventFilterDto {
  @IsDateString()
  @IsOptional()
  startDate?: string; // Lấy events từ ngày này

  @IsDateString()
  @IsOptional()
  endDate?: string; // Đến ngày này

  @IsEnum(EventType)
  @IsOptional()
  type?: EventType;

  @IsUUID()
  @IsOptional()
  organizerId?: string;

  @IsUUID()
  @IsOptional()
  participantId?: string; // Events mà user này tham gia

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}
