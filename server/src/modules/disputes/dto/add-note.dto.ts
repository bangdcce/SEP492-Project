import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum NoteType {
  GENERAL = 'GENERAL',
  EVIDENCE_REVIEW = 'EVIDENCE_REVIEW',
  DECISION = 'DECISION',
  FOLLOW_UP = 'FOLLOW_UP',
  WARNING = 'WARNING',
}

/**
 * DTO để Admin/Staff thêm ghi chú vào Dispute
 */
export class AddNoteDto {
  @IsNotEmpty({ message: 'Nội dung ghi chú không được để trống' })
  @IsString()
  content: string;

  /**
   * TRUE = Ghi chú nội bộ (chỉ Admin/Staff thấy)
   * FALSE = Ghi chú công khai (các bên liên quan đều thấy)
   */
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean = false;

  /**
   * Đánh dấu ghi chú quan trọng
   */
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean = false;

  /**
   * Loại ghi chú
   */
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType = NoteType.GENERAL;

  /**
   * File đính kèm (URLs)
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
