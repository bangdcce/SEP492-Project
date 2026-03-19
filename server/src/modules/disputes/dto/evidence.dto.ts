import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

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
  @MaxLength(500)
  storagePath: string; // e.g., "disputes/user_123/evidence_001.png"

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string; // Tên file gốc để hiển thị

  @IsNumber()
  @Min(1)
  fileSize: number; // bytes

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string; // "image/png", "application/pdf"

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string; // Caption cho bằng chứng

  @IsString()
  @IsOptional()
  @MaxLength(64)
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
  @MaxLength(1000)
  flagReason: string;
}
