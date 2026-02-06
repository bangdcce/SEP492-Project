import { IsNotEmpty, IsUUID } from 'class-validator';

export class LinkSubtaskDto {
  @IsUUID()
  @IsNotEmpty()
  subtaskId: string;
}
