import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ClientAuditEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  eventName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  journeyStep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  route?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateClientAuditEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientAuditEventDto)
  events: ClientAuditEventDto[];
}
