import { IsNotEmpty, IsUUID, IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { MessageType } from 'src/database/entities';

/**
 * DTO để gửi tin nhắn trong phòng chat Dispute
 * Hỗ trợ Rich Chat: Reply, Quote Evidence, Metadata
 */
export class SendDisputeMessageDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId: string;

  @IsEnum(MessageType)
  @IsNotEmpty()
  type: MessageType;

  @IsString()
  @IsOptional()
  content?: string; // Nội dung text (required cho TEXT type)

  // === Reply tin nhắn khác (Thread) ===
  @IsUUID()
  @IsOptional()
  replyToMessageId?: string;

  // === Đối chất bằng chứng (Evidence Rebuttal) ===
  @IsUUID()
  @IsOptional()
  relatedEvidenceId?: string;

  // === Hearing Context (Nếu chat trong phiên điều trần) ===
  @IsUUID()
  @IsOptional()
  hearingId?: string;

  // === Metadata cho ảnh/file/special messages ===
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
  /*
    Ví dụ:
    - IMAGE: { storagePath: '...', width: 800, height: 600 }
    - FILE: { storagePath: '...', fileName: '...' }
    - SETTLEMENT_PROPOSAL: { settlementId: 'uuid-123' }
  */
}

/**
 * DTO để Admin/Staff ẩn tin nhắn vi phạm
 */
export class HideMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty({ message: 'Lý do ẩn tin nhắn không được để trống' })
  hiddenReason: string;
}
