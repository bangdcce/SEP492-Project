import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AvailabilityType } from 'src/database/entities';

/**
 * DTO để tạo User Availability (one-time)
 */
export class CreateAvailabilityDto {
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsEnum(AvailabilityType)
  @IsNotEmpty()
  type: AvailabilityType;

  @IsString()
  @IsOptional()
  note?: string;
}

/**
 * DTO cho recurring availability slot
 */
class RecurringSlotDto {
  @IsNotEmpty()
  dayOfWeek: number; // 0=CN, 1=T2...

  @IsString()
  @IsNotEmpty()
  startTime: string; // "08:00"

  @IsString()
  @IsNotEmpty()
  endTime: string; // "17:00"
}

/**
 * DTO để tạo Recurring Availability (giờ làm việc hàng tuần)
 */
export class CreateRecurringAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringSlotDto)
  slots: RecurringSlotDto[];

  @IsEnum(AvailabilityType)
  @IsNotEmpty()
  type: AvailabilityType;

  @IsDateString()
  @IsOptional()
  startDate?: string; // Ngày bắt đầu hiệu lực

  @IsDateString()
  @IsOptional()
  endDate?: string; // Ngày kết thúc (null = vĩnh viễn)

  @IsString()
  @IsOptional()
  note?: string;
}

/**
 * DTO để set availability (one-time + recurring)
 */
export class SetAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAvailabilityDto)
  @IsOptional()
  slots?: CreateAvailabilityDto[];

  @ValidateNested()
  @Type(() => CreateRecurringAvailabilityDto)
  @IsOptional()
  recurring?: CreateRecurringAvailabilityDto;

  @IsBoolean()
  @IsOptional()
  allowConflicts?: boolean;

  @IsString()
  @IsOptional()
  timeZone?: string;
}

/**
 * DTO để query availability
 */
export class AvailabilityQueryDto {
  @IsUUID()
  @IsOptional()
  userId?: string; // Nếu không truyền = lấy của current user

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(AvailabilityType)
  @IsOptional()
  type?: AvailabilityType;

  @IsBoolean()
  @IsOptional()
  includeRecurring?: boolean; // TRUE = expand recurring slots
}

/**
 * DTO để tìm time slots available chung cho nhiều users
 */
export class FindCommonAvailabilityDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  userIds: string[];

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsNotEmpty()
  durationMinutes: number; // Cần slot bao nhiêu phút
}
