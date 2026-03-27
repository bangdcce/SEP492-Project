import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePayoutRequestDto {
  @ApiProperty()
  @IsUUID()
  payoutMethodId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Withdraw earnings for March sprint' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
