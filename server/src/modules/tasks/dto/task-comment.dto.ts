import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdateTaskCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
