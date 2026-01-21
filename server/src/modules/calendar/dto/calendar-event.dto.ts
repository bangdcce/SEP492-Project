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
  title: string;

  @IsString()
  @IsOptional()
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
  referenceType?: string; // 'DisputeHearing', 'Project', etc.

  @IsUUID()
  @IsOptional()
  referenceId?: string;

  // === LOCATION ===
  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
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
  title?: string;

  @IsString()
  @IsOptional()
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
  location?: string;

  @IsString()
  @IsOptional()
  externalMeetingLink?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  reminderMinutes?: number[];

  @IsString()
  @IsOptional()
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
  @Max(100)
  @IsOptional()
  limit?: number;
}
