import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsInt, Max, Min } from 'class-validator';
import { PayoutStatus } from '../../../database/entities';

export class PayoutRequestsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PayoutStatus, enumName: 'PayoutStatus' })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;
}
