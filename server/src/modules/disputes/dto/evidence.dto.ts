import { IsNotEmpty, IsUUID, IsString, IsOptional, IsNumber, Min } from 'class-validator';

/**
 * DTO để upload bằng chứng cho Dispute
 * Frontend gửi storagePath sau khi upload file lên Supabase
 */
export class UploadEvidenceDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId: string;

  @IsString()
  @IsNotEmpty({ message: 'Storage path không được để trống' })
  storagePath: string; // e.g., "disputes/user_123/evidence_001.png"

  @IsString()
  @IsNotEmpty()
  fileName: string; // Tên file gốc để hiển thị

  @IsNumber()
  @Min(1)
  fileSize: number; // bytes

  @IsString()
  @IsNotEmpty()
  mimeType: string; // "image/png", "application/pdf"

  @IsString()
  @IsOptional()
  description?: string; // Caption cho bằng chứng

  @IsString()
  @IsOptional()
  fileHash?: string; // SHA-256 hash để verify integrity
}

/**
 * DTO để Admin/Staff flag bằng chứng
 */
export class FlagEvidenceDto {
  @IsUUID()
  @IsNotEmpty()
  evidenceId: string;

  @IsString()
  @IsNotEmpty({ message: 'Lý do flag không được để trống' })
  flagReason: string;
}
