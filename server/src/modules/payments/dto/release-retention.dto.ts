import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReleaseRetentionDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Allow manual override of the warranty wait window. Intended for admin/staff emergency release flows.',
  })
  @IsOptional()
  @IsBoolean()
  bypassWarranty?: boolean;

  @ApiPropertyOptional({
    maxLength: 300,
    description: 'Optional reason recorded for audit metadata when retention is released.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
