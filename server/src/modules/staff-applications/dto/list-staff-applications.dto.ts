import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StaffApplicationStatus } from '../../../database/entities/staff-application.entity';

export class ListStaffApplicationsDto {
  @ApiPropertyOptional({
    enum: StaffApplicationStatus,
    description: 'Filter by staff-application status',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue || normalizedValue.toUpperCase() === 'ALL') {
      return undefined;
    }

    return normalizedValue;
  })
  @IsEnum(StaffApplicationStatus)
  @IsOptional()
  status?: StaffApplicationStatus;

  @ApiPropertyOptional({
    description: 'Search by applicant full name or email',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Current page',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
