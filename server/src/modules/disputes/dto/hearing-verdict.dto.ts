import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResolveDisputeDto } from './resolve-dispute.dto';
import { FollowUpActionDto, TransformFollowUpActions } from './follow-up-action.dto';

export class CloseHearingMinutesDto {
  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  findings: string;

  @TransformFollowUpActions()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowUpActionDto)
  @IsOptional()
  pendingActions?: FollowUpActionDto[];

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
