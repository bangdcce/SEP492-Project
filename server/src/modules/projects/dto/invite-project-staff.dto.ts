import { IsUUID } from 'class-validator';

export class InviteProjectStaffDto {
  @IsUUID()
  staffId: string;
}
