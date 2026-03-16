import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';

export enum RejectionAppealDecision {
  UPHOLD = 'UPHOLD',
  OVERTURN = 'OVERTURN',
}

export class ResolveRejectionAppealDto {
  @IsEnum(RejectionAppealDecision)
  decision: RejectionAppealDecision;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  resolution: string;
}
