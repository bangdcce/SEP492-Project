import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class MatchQueryDto {
  @ApiPropertyOptional({
    description: 'Whether to enable AI semantic matching. Default is true if AI keys are configured.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enableAi?: boolean;

  @ApiPropertyOptional({
    description: 'Number of top candidates (from deterministic phase) to send to AI for semantic ranking.',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  topN?: number;

  @ApiPropertyOptional({
    description: 'Whether to require candidates to be KYC verified.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requireKyc?: boolean;

  @ApiPropertyOptional({
    description: 'The target role to match against. Defaults to FREELANCER.',
    enum: [UserRole.FREELANCER, UserRole.BROKER],
    default: UserRole.FREELANCER,
  })
  @IsOptional()
  @IsEnum([UserRole.FREELANCER, UserRole.BROKER])
  role?: 'FREELANCER' | 'BROKER';
}
