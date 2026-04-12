import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';

export class CreateClientFeatureDto {
  @IsOptional()
  @IsString()
  id?: string;

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

  @Matches(/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}.*$/i, {
    message: 'Reference links must be a valid http/https URL or bare domain.',
  })
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
  @Min(1)
  estimatedBudget: number;

  @IsOptional()
  @IsString()
  estimatedTimeline?: string;

  @IsOptional()
  @IsDateString()
  agreedDeliveryDeadline?: string;

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

  @IsOptional()
  @IsString()
  changeSummary?: string;
}
