import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignBrokerDto {
  @IsNotEmpty()
  @IsUUID()
  brokerId: string;
}
