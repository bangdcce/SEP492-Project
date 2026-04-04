import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const walletTransactionRanges = ['7d', '30d', '90d'] as const;
export type WalletTransactionRange = (typeof walletTransactionRanges)[number];

export class WalletTransactionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: walletTransactionRanges })
  @IsOptional()
  @IsIn(walletTransactionRanges)
  range?: WalletTransactionRange;
}
