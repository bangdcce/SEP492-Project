import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { StaffRecommendation } from '../../../database/entities/milestone.entity';

export class ReviewMilestoneStaffDto {
  @IsEnum(StaffRecommendation, {
    message: 'Recommendation must be either ACCEPT or REJECT',
  })
  recommendation: StaffRecommendation;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000, { message: 'Review note must not exceed 2000 characters' })
  note: string;
}
