import { IsEnum } from 'class-validator';
import { ProjectStaffInviteStatus } from '../../../database/entities/project.entity';

export class RespondProjectStaffInviteDto {
  @IsEnum([ProjectStaffInviteStatus.ACCEPTED, ProjectStaffInviteStatus.REJECTED], {
    message: 'Status must be either ACCEPTED or REJECTED',
  })
  status: ProjectStaffInviteStatus.ACCEPTED | ProjectStaffInviteStatus.REJECTED;
}
