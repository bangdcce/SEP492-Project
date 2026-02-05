import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsDateString,
  IsArray,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  DisputeStatus,
  DisputeCategory,
  DisputePriority,
  DisputeType,
  DisputeEntity,
} from 'src/database/entities';

export enum DisputeSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  PRIORITY = 'priority',
  DEADLINE = 'resolutionDeadline',
  URGENCY = 'urgency', // Custom: Combines priority + deadline proximity
  DISPUTED_AMOUNT = 'disputedAmount',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class DisputeFilterDto {
  // === PAGINATION ===
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // === SORTING ===
  @IsOptional()
  @IsEnum(DisputeSortBy)
  sortBy?: DisputeSortBy = DisputeSortBy.URGENCY;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  // === FILTERS ===
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value;
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsEnum(DisputeStatus, { each: true })
  statusIn?: DisputeStatus[];

  @IsOptional()
  @IsEnum(DisputeCategory)
  category?: DisputeCategory;

  @IsOptional()
  @IsEnum(DisputePriority)
  priority?: DisputePriority;

  @IsOptional()
  @IsEnum(DisputeType)
  disputeType?: DisputeType;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  raisedById?: string;

  @IsOptional()
  @IsString()
  defendantId?: string;

  @IsOptional()
  @IsString()
  assignedStaffId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unassignedOnly?: boolean;

  // === DATE FILTERS ===
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  deadlineBefore?: string;

  @IsOptional()
  @IsDateString()
  deadlineFrom?: string;

  @IsOptional()
  @IsDateString()
  deadlineTo?: string;

  // === AMOUNT FILTERS ===
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minDisputedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDisputedAmount?: number;

  // === SPECIAL FILTERS ===
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean; // Chỉ lấy dispute quá hạn

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  urgentOnly?: boolean; // Chỉ lấy dispute sắp hết hạn (< 48h)

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  appealed?: boolean; // Chỉ lấy dispute đã bị appeal

  @IsOptional()
  @IsString()
  search?: string; // Tìm kiếm theo reason, adminComment

  // === USER-SPECIFIC (for /my endpoint) ===
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  asRaiser?: boolean; // Disputes tôi tạo

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  asDefendant?: boolean; // Disputes kiện tôi

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  asInvolved?: boolean; // Disputes liên quan đến project của tôi (bao gồm broker)
}

/**
 * Response format cho paginated disputes
 */
export interface PaginatedDisputesResponse {
  data: DisputeEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  stats?: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    urgent: number;
  };
}
