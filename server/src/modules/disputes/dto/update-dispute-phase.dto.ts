import { IsEnum, IsNotEmpty } from 'class-validator';
import { DisputePhase } from 'src/database/entities';

export class UpdateDisputePhaseDto {
  @IsEnum(DisputePhase)
  @IsNotEmpty()
  phase: DisputePhase;
}
