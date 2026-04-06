import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RejectStaffApplicationDto {
  @ApiProperty({
    description: 'Reason for rejecting the staff application',
    example: 'Your background does not match the current staff requirements.',
  })
  @IsString()
  rejectionReason: string;
}
