import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AutoScheduleTuningDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7 * 24 * 60)
  minNoticeMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  lookaheadDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  forceNearTermMinutes?: number;

  @IsOptional()
  @IsString()
  bypassReason?: string;

  @IsOptional()
  @IsDateString()
  selectedSlotStart?: string;
}
