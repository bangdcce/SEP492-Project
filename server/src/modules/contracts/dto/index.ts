import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeliverableType } from '../../../database/entities/milestone.entity';

export class InitializeContractDto {
  @ApiProperty({
    description: 'ID of the approved ProjectSpec',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  specId: string;

  @ApiProperty({
    description: 'ID of the freelancer assigned to this project',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  freelancerId?: string;
}

export class SignContractDto {
  @ApiProperty({
    description: 'Current server-generated content hash for the contract version being signed',
    example: '5f2730f249cf092ec0b8ce68f99ecf251f3ccf8508df34f4c9c8e49f13fbfa6f',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(512)
  contentHash: string;
}

export class UpdateContractDraftMilestoneDto {
  @ApiProperty({
    description: 'Immutable contract milestone key. Preserve when editing an existing draft item.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  contractMilestoneKey?: string;

  @ApiProperty({
    description: 'Original spec milestone id if this snapshot item came from the source spec',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  sourceSpecMilestoneId?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number | null;

  @ApiProperty({ enum: DeliverableType, required: false })
  @IsOptional()
  @IsEnum(DeliverableType)
  deliverableType?: DeliverableType | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retentionAmount?: number | null;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptanceCriteria?: string[] | null;
}

export class UpdateContractDraftDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ required: false, example: 'USD' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(10)
  currency?: string;

  @ApiProperty({ type: [UpdateContractDraftMilestoneDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateContractDraftMilestoneDto)
  milestoneSnapshot?: UpdateContractDraftMilestoneDto[];
}

export class CreateSignatureSessionDto {
  @ApiProperty({
    description: 'Legal signature provider code',
    example: 'VN_CA_SANDBOX',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  provider?: string;
}

export class SignatureProviderWebhookDto {
  @ApiProperty({
    description: 'Contract identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: 'Provider session identifier',
    required: false,
    example: 'sigsess_123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerSessionId?: string;

  @ApiProperty({
    description: 'Provider status',
    example: 'VERIFIED',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  status: string;

  @ApiProperty({
    description: 'Certificate serial returned by provider',
    required: false,
    example: 'CA-2026-000001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  certificateSerial?: string;

  @ApiProperty({
    description: 'Verification timestamp',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  verifiedAt?: string;

  @ApiProperty({
    description: 'Provider payload/evidence',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}
