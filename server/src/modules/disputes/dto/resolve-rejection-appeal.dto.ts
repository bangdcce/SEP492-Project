import { IsEnum, IsString, MinLength } from 'class-validator';

export enum RejectionAppealDecision {
  UPHOLD = 'UPHOLD',
  OVERTURN = 'OVERTURN',
}

export class ResolveRejectionAppealDto {
  @IsEnum(RejectionAppealDecision)
  decision: RejectionAppealDecision;

  @IsString()
  @MinLength(5)
  resolution: string;
}
