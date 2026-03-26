import { IsUUID } from 'class-validator';

export class AssignAppealOwnerDto {
  @IsUUID('4')
  adminId: string;
}
