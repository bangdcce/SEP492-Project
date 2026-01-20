// ============================================================================
// CREATE STAFF SUGGESTION DTO
// ============================================================================
// Staff can suggest settlement amounts without creating a formal offer.
// This helps guide parties toward reasonable settlements based on similar cases.
// ============================================================================

import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStaffSuggestionDto {
  @ApiProperty({
    description: 'Suggested amount to be paid to the freelancer (in USD)',
    example: 350,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Suggested amount cannot be negative' })
  suggestedAmountToFreelancer: number;

  @ApiProperty({
    description: 'Suggested amount to be refunded to the client (in USD)',
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Suggested amount cannot be negative' })
  suggestedAmountToClient: number;

  @ApiProperty({
    description: 'Reasoning for the suggestion based on similar cases or platform guidelines',
    example:
      'Based on 5 similar cases where partial delivery was accepted, a 70-30 split in favor of the freelancer is typical. The delivered work covers phases 1-3 which represent ~70% of the project scope.',
  })
  @IsString()
  @MaxLength(2000)
  reasoning: string;

  @ApiPropertyOptional({
    description: 'References to similar case IDs for transparency',
    example: 'Similar cases: #D-2024-001, #D-2024-015, #D-2024-089',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  similarCaseReferences?: string;
}
