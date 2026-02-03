import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
  IsIn,
  IsEnum,
} from 'class-validator';
import { LeaveStatus, LeaveType } from 'src/database/entities';

export class CreateLeaveRequestDto {
  @IsIn([LeaveType.LONG_TERM])
  @IsNotEmpty()
  type: LeaveType;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;

  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class ProcessLeaveRequestDto {
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}

export class CancelLeaveRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}

export class LeaveBalanceQueryDto {
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string; // YYYY-MM

  @IsBoolean()
  @IsOptional()
  includePending?: boolean;

  @IsString()
  @IsOptional()
  timeZone?: string;
}

export class ListLeaveRequestsQueryDto {
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsEnum(LeaveStatus)
  @IsOptional()
  status?: LeaveStatus;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string; // YYYY-MM
}

export class UpdateLeavePolicyDto {
  @IsInt()
  @Min(0)
  monthlyAllowanceMinutes: number;
}
