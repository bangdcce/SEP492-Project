import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateClientFeatureDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
}

export class ClientSpecReferenceLinkDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsUrl()
  url: string;
}

export class CreateClientSpecDto {
  @IsUUID()
  requestId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  estimatedBudget: number;

  @IsString()
  @IsNotEmpty()
  estimatedTimeline: string;

  @IsOptional()
  @IsString()
  projectCategory?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientFeatureDto)
  clientFeatures: CreateClientFeatureDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientSpecReferenceLinkDto)
  referenceLinks?: ClientSpecReferenceLinkDto[];

  @IsOptional()
  @IsObject()
  richContentJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  templateCode?: string;
}
