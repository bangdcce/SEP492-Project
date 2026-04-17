import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectMilestoneDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MaxLength(2000, { message: 'Rejection reason must not exceed 2000 characters' })
  reason: string;
}
