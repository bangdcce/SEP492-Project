import { DisputeCategory } from "../../staff/types/staff.types";

export interface CreateDisputeDto {
  milestoneId: string;
  projectId: string;
  reason: string; // The "Other" text or selected radio value
  category: DisputeCategory;
  defendantId: string;
  evidenceFiles?: File[]; // For upload
  disputedAmount?: number; // Optional override, usually defaults to escrow funded
}

export interface DisputeEvidenceDto {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  isFlagged?: boolean; // For staff only
}
