import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CommercialFeatureDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  @IsIn(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE'])
  priority?: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
}

export class CreateCommercialChangeRequestDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  proposedBudget: number;

  @IsOptional()
  @IsString()
  proposedTimeline?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommercialFeatureDto)
  proposedClientFeatures?: CommercialFeatureDto[];

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  parentSpecId?: string;
}

export class RespondCommercialChangeRequestDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  note?: string;
}
