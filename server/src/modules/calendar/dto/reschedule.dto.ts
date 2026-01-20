import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho proposed time slot
 */
class TimeSlotDto {
  @IsDateString()
  @IsNotEmpty()
  start: string;

  @IsDateString()
  @IsNotEmpty()
  end: string;
}

/**
 * DTO để yêu cầu dời lịch event
 */
export class CreateRescheduleRequestDto {
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty({ message: 'Lý do dời lịch không được để trống' })
  reason: string;

  // === Có thể chọn 1 trong 2 cách ===

  // Cách 1: User tự đề xuất giờ
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  @IsOptional()
  proposedTimeSlots?: TimeSlotDto[]; // Tối đa 3 slots

  // Cách 2: Để hệ thống tự tìm
  @IsBoolean()
  @IsOptional()
  useAutoSchedule?: boolean;
}

/**
 * DTO để Staff/Admin xử lý reschedule request
 */
export class ProcessRescheduleRequestDto {
  @IsUUID()
  @IsNotEmpty()
  requestId: string;

  @IsString()
  @IsNotEmpty()
  action: 'approve' | 'reject';

  // Nếu approve - chọn time slot mới
  @IsDateString()
  @IsOptional()
  selectedNewStartTime?: string;

  @IsString()
  @IsOptional()
  processNote?: string;
}

/**
 * DTO để participant phản hồi lời mời event
 */
export class RespondEventInviteDto {
  @IsUUID()
  @IsNotEmpty()
  participantId: string; // EventParticipantEntity.id

  @IsString()
  @IsNotEmpty()
  response: 'accept' | 'decline' | 'tentative';

  @IsString()
  @IsOptional()
  responseNote?: string;
}
