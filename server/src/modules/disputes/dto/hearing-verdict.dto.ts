import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResolveDisputeDto } from './resolve-dispute.dto';

export class CloseHearingMinutesDto {
  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  findings: string;

  @IsOptional()
  @IsBoolean()
  forceEnd?: boolean;

  @IsString()
  @IsOptional()
  noShowNote?: string;
}

export class IssueHearingVerdictDto {
  @ValidateNested()
  @Type(() => ResolveDisputeDto)
  @IsNotEmpty()
  verdict: ResolveDisputeDto;

  @ValidateNested()
  @Type(() => CloseHearingMinutesDto)
  @IsNotEmpty()
  closeHearing: CloseHearingMinutesDto;
}
