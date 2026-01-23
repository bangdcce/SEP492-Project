// ============================================================================
// STAFF ASSIGNMENT DTOs
// ============================================================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
  MinLength,
} from 'class-validator';

// =============================================================================
// EARLY RELEASE
// =============================================================================

export class EarlyReleaseDto {
  @ApiPropertyOptional({
    description: 'Actual end time (ISO string). Defaults to current time if not provided.',
    example: '2026-01-20T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  actualEndTime?: string;

  @ApiPropertyOptional({
    description: 'Reason for early ending',
    example: 'Parties reached agreement quickly',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  reason?: string;
}

// =============================================================================
// EMERGENCY REASSIGN
// =============================================================================

export enum ReassignReason {
  SICK_LEAVE = 'SICK_LEAVE',
  EMERGENCY = 'EMERGENCY',
  OVERLOAD = 'OVERLOAD',
  CONFLICT = 'CONFLICT',
  MANUAL = 'MANUAL',
}

export enum ReassignUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class EmergencyReassignDto {
  @ApiProperty({
    description: 'ID of the original staff being replaced',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  originalStaffId: string;

  @ApiProperty({
    description: 'Reason for reassignment',
    enum: ReassignReason,
    example: ReassignReason.SICK_LEAVE,
  })
  @IsEnum(ReassignReason)
  reason: ReassignReason;

  @ApiProperty({
    description: 'Urgency level',
    enum: ReassignUrgency,
    example: ReassignUrgency.HIGH,
  })
  @IsEnum(ReassignUrgency)
  urgency: ReassignUrgency;

  @ApiPropertyOptional({
    description: 'Preferred replacement staff ID',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsOptional()
  @IsUUID()
  preferredReplacementId?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the reassignment',
    example: 'Staff called in sick at 7am',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// =============================================================================
// SCHEDULE HEARING
// =============================================================================

export class ScheduleHearingDto {
  @ApiProperty({
    description: 'Dispute ID to schedule hearing for',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  })
  @IsUUID()
  disputeId: string;

  @ApiPropertyOptional({
    description:
      'Scheduled start time (ISO string). If not provided, auto-schedule will find optimal time.',
    example: '2026-01-21T14:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledStartTime?: string;

  @ApiProperty({
    description:
      'Duration in minutes. Must be between minMinutes and maxMinutes from complexity estimation.',
    example: 60,
    minimum: 30,
    maximum: 180,
  })
  @IsNumber()
  @Min(30, { message: 'Minimum hearing duration is 30 minutes' })
  @Max(180, { message: 'Maximum hearing duration is 180 minutes' })
  durationMinutes: number;

  @ApiPropertyOptional({
    description: 'Staff ID to assign. If not provided, auto-assignment will select.',
    example: 'd4e5f6a7-b8c9-0123-def0-234567890123',
  })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({
    description: 'Use auto-scheduling to find optimal time slot',
    default: true,
  })
  @IsOptional()
  useAutoSchedule?: boolean;

  @ApiPropertyOptional({
    description: 'Additional notes for the hearing',
    example: 'High-value dispute, expect detailed discussion',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// =============================================================================
// FILLER TASK
// =============================================================================

export class AssignFillerTaskDto {
  @ApiProperty({
    description: 'Staff ID to assign task to',
    example: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
  })
  @IsUUID()
  staffId: string;

  @ApiProperty({
    description: 'Type of filler task',
    enum: [
      'REVIEW_EVIDENCE',
      'DRAFT_VERDICT',
      'APPROVE_KYC',
      'REVIEW_SETTLEMENT',
      'CHECK_PENDING_DISPUTES',
      'DOCUMENTATION',
    ],
    example: 'REVIEW_EVIDENCE',
  })
  @IsString()
  taskType: string;

  @ApiPropertyOptional({
    description: 'Related entity ID (e.g., dispute ID for evidence review)',
    example: 'f6a7b8c9-d0e1-2345-f012-456789012345',
  })
  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @ApiPropertyOptional({
    description: 'Deadline for task completion',
    example: '2026-01-20T12:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

// =============================================================================
// WORKLOAD QUERY
// =============================================================================

export class WorkloadQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for workload query',
    example: '2026-01-20',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for workload query',
    example: '2026-01-27',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific staff IDs',
    type: [String],
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  staffIds?: string[];

  @ApiPropertyOptional({
    description: 'Include only overloaded staff',
    default: false,
  })
  @IsOptional()
  onlyOverloaded?: boolean;
}

// =============================================================================
// REASSIGN DISPUTE (Manual)
// =============================================================================

export class ReassignDisputeDto {
  @ApiProperty({
    description: 'ID của staff mới sẽ xử lý dispute',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsUUID()
  newStaffId: string;

  @ApiProperty({
    description: 'Lý do reassign',
    example: 'Rebalancing workload between staff members',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'Please provide a detailed reason (minimum 10 characters)' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm cho việc reassign',
    example: 'Staff A is overloaded this week',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// =============================================================================
// SESSION ADJOURN
// =============================================================================

export class AdjournSessionDto {
  @ApiProperty({
    description: 'Reason for adjourning the session',
    example: 'Time limit reached. Case requires additional evidence review.',
    minLength: 20,
  })
  @IsString()
  @MinLength(20, { message: 'Please provide a detailed reason (minimum 20 characters)' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Preferred reschedule date/time',
    example: '2026-01-21T14:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  preferredRescheduleTime?: string;

  @ApiPropertyOptional({
    description: 'Notes for the next session',
    example: 'Need to review additional bank statements submitted by client',
  })
  @IsOptional()
  @IsString()
  notesForNextSession?: string;
}
