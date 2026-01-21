import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

import {
  DisputeEvidenceEntity,
  DisputeEntity,
  UserRole,
  DisputeStatus,
} from 'src/database/entities';

// =============================================================================
// CONSTANTS
// =============================================================================
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
];

const FILE_SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/gif': 5 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'application/pdf': 25 * 1024 * 1024,
  'text/plain': 1 * 1024 * 1024,
  'application/msword': 15 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 15 * 1024 * 1024,
  'application/vnd.ms-excel': 15 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 15 * 1024 * 1024,
  'video/mp4': 50 * 1024 * 1024,
  'video/webm': 50 * 1024 * 1024,
  'audio/mpeg': 20 * 1024 * 1024,
  'audio/wav': 20 * 1024 * 1024,
};

const ABSOLUTE_MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_EVIDENCE_PER_USER_PER_DISPUTE = 20;
const SIGNED_URL_CACHE_TTL_SECONDS = 55 * 60;
const SIGNED_URL_BATCH_SIZE = 20;
const BUCKET_NAME = 'disputes';

// =============================================================================
// INTERFACES
// =============================================================================
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFileName?: string;
}

export interface StoragePathResult {
  path: string;
  sanitizedFileName: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingEvidenceId?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  error?: string;
}

export interface UploadEvidenceInput {
  disputeId: string;
  uploaderId: string;
  uploaderRole: UserRole;
  fileBuffer: Buffer;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
}

export interface UploadEvidenceResult {
  success: boolean;
  evidence?: DisputeEvidenceEntity;
  error?: string;
  isDuplicate?: boolean;
  existingEvidenceId?: string;
}

export interface EvidenceWithSignedUrl extends DisputeEvidenceEntity {
  signedUrl?: string;
}

// =============================================================================
// EVIDENCE SERVICE
// =============================================================================
@Injectable()
export class EvidenceService {
  private supabase: SupabaseClient;
  private bucketName = BUCKET_NAME;

  constructor(
    @InjectRepository(DisputeEvidenceEntity)
    private readonly evidenceRepo: Repository<DisputeEvidenceEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ===========================================================================
  // UNIT FUNCTION: validateFileUpload
  // ===========================================================================
  validateFileUpload(fileName: string, fileSize: number, mimeType: string): FileValidationResult {
    // 1. Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        isValid: false,
        error: `File type '${mimeType}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    // 2. Check file size by type
    const maxSizeForType = FILE_SIZE_LIMITS[mimeType] || ABSOLUTE_MAX_FILE_SIZE;
    if (fileSize > maxSizeForType) {
      const maxSizeMB = Math.round(maxSizeForType / (1024 * 1024));
      return {
        isValid: false,
        error: `File size exceeds limit for ${mimeType}. Maximum: ${maxSizeMB}MB`,
      };
    }

    // 3. Absolute max check
    if (fileSize > ABSOLUTE_MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds absolute maximum of 50MB`,
      };
    }

    // 4. Sanitize filename
    const sanitized = this.sanitizeFileName(fileName);
    if (!sanitized) {
      return {
        isValid: false,
        error: 'Invalid file name',
      };
    }

    // 5. Validate extension matches MIME
    if (!this.validateExtensionMatchesMime(sanitized, mimeType)) {
      return {
        isValid: false,
        error: 'File extension does not match content type',
      };
    }

    return {
      isValid: true,
      sanitizedFileName: sanitized,
    };
  }

  private sanitizeFileName(fileName: string): string | null {
    if (!fileName || typeof fileName !== 'string') {
      return null;
    }

    // Remove path components
    const baseName = fileName.split(/[\\/]/).pop() || '';

    // Replace dangerous characters
    const sanitized = baseName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.{2,}/g, '.')
      .trim();

    // Must have valid extension
    const ext = sanitized.split('.').pop()?.toLowerCase();
    if (!ext || ext === sanitized) {
      return null;
    }

    // Length check
    if (sanitized.length > 255 || sanitized.length < 3) {
      return null;
    }

    return sanitized;
  }

  private validateExtensionMatchesMime(fileName: string, mimeType: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();

    const mimeToExt: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'text/plain': ['txt'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'application/vnd.ms-excel': ['xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
      'video/mp4': ['mp4'],
      'video/webm': ['webm'],
      'audio/mpeg': ['mp3'],
      'audio/wav': ['wav'],
    };

    const allowedExts = mimeToExt[mimeType];
    return allowedExts ? allowedExts.includes(ext || '') : false;
  }

  // ===========================================================================
  // UNIT FUNCTION: generateStoragePath
  // ===========================================================================
  generateStoragePath(disputeId: string, uploaderId: string, fileName: string): StoragePathResult {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const sanitizedFileName = `${timestamp}_${randomSuffix}.${ext}`;

    const path = `disputes/${disputeId}/${uploaderId}/${sanitizedFileName}`;

    return {
      path,
      sanitizedFileName,
    };
  }

  // ===========================================================================
  // UNIT FUNCTION: calculateFileHash
  // ===========================================================================
  calculateFileHash(fileBuffer: Buffer): string {
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  // ===========================================================================
  // UNIT FUNCTION: checkDuplicateEvidence (SCOPED TO DISPUTE)
  // ===========================================================================
  async checkDuplicateEvidence(disputeId: string, fileHash: string): Promise<DuplicateCheckResult> {
    const existingEvidence = await this.evidenceRepo.findOne({
      where: {
        disputeId,
        fileHash,
        isFlagged: false,
      },
    });

    if (existingEvidence) {
      return {
        isDuplicate: true,
        existingEvidenceId: existingEvidence.id,
      };
    }

    return { isDuplicate: false };
  }

  // ===========================================================================
  // UNIT FUNCTION: checkRateLimit
  // ===========================================================================
  async checkRateLimit(disputeId: string, uploaderId: string): Promise<RateLimitResult> {
    const count = await this.evidenceRepo.count({
      where: {
        disputeId,
        uploaderId,
      },
    });

    const remaining = MAX_EVIDENCE_PER_USER_PER_DISPUTE - count;

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        error: `Maximum ${MAX_EVIDENCE_PER_USER_PER_DISPUTE} evidence files per user per dispute exceeded`,
      };
    }

    return {
      allowed: true,
      remaining,
    };
  }

  // ===========================================================================
  // HELPER: getRemainingQuota
  // ===========================================================================
  async getRemainingQuota(
    disputeId: string,
    uploaderId: string,
  ): Promise<{ remaining: number; used: number; total: number }> {
    const used = await this.evidenceRepo.count({
      where: {
        disputeId,
        uploaderId,
      },
    });

    return {
      remaining: Math.max(0, MAX_EVIDENCE_PER_USER_PER_DISPUTE - used),
      used,
      total: MAX_EVIDENCE_PER_USER_PER_DISPUTE,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTION: uploadEvidence (REFINED FLOW)
  // DB-first approach: Save record first, upload to storage, rollback on failure
  // ===========================================================================

  async uploadEvidence(input: UploadEvidenceInput): Promise<UploadEvidenceResult> {
    const {
      disputeId,
      uploaderId,
      uploaderRole,
      fileBuffer,
      fileName,
      fileSize,
      mimeType,
      description,
    } = input;

    // 1. Verify dispute exists and is in valid state
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      return { success: false, error: 'Dispute not found' };
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      return { success: false, error: 'Cannot upload evidence to a resolved dispute' };
    }

    // 2. Validate file
    const validation = this.validateFileUpload(fileName, fileSize, mimeType);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // 3. Check rate limit
    const rateLimit = await this.checkRateLimit(disputeId, uploaderId);
    if (!rateLimit.allowed) {
      return { success: false, error: rateLimit.error };
    }

    // 4. Calculate hash and check duplicate
    const fileHash = this.calculateFileHash(fileBuffer);
    const duplicateCheck = await this.checkDuplicateEvidence(disputeId, fileHash);
    if (duplicateCheck.isDuplicate) {
      return {
        success: false,
        error: 'This file has already been uploaded to this dispute',
        isDuplicate: true,
        existingEvidenceId: duplicateCheck.existingEvidenceId,
      };
    }

    // 5. Generate storage path
    const storagePath = this.generateStoragePath(
      disputeId,
      uploaderId,
      validation.sanitizedFileName!,
    );

    // 6. Save DB record FIRST to reserve the slot
    const evidence = this.evidenceRepo.create({
      disputeId,
      uploaderId,
      uploaderRole,
      fileName: validation.sanitizedFileName,
      fileSize,
      mimeType,
      fileHash,
      storagePath: storagePath.path,
      description,
    });

    const savedEvidence = await this.evidenceRepo.save(evidence);

    // 7. Upload to Supabase Storage
    try {
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath.path, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        // Upload failed - delete the DB record
        await this.evidenceRepo.delete(savedEvidence.id);
        return {
          success: false,
          error: `Failed to upload file to storage: ${uploadError.message}`,
        };
      }

      // Upload successful
      return {
        success: true,
        evidence: savedEvidence,
      };
    } catch (error) {
      // Unexpected error - cleanup DB record
      await this.evidenceRepo.delete(savedEvidence.id);
      return {
        success: false,
        error: `Unexpected error during upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ===========================================================================
  // COMPOSE FUNCTION: flagEvidence
  // ===========================================================================
  async flagEvidence(
    evidenceId: string,
    flaggedBy: string,
    flagReason: string,
  ): Promise<DisputeEvidenceEntity> {
    const evidence = await this.evidenceRepo.findOne({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    if (evidence.isFlagged) {
      throw new BadRequestException('Evidence is already flagged');
    }

    evidence.isFlagged = true;
    evidence.flagReason = flagReason;
    evidence.flaggedById = flaggedBy;
    evidence.flaggedAt = new Date();

    return this.evidenceRepo.save(evidence);
  }

  // ===========================================================================
  // COMPOSE FUNCTION: getEvidenceList (WITH CACHING)
  // ===========================================================================
  async getEvidenceList(
    disputeId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<EvidenceWithSignedUrl[]> {
    // 1. Verify dispute access
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // 2. Check access permission
    const isParticipant = dispute.raisedById === requesterId || dispute.defendantId === requesterId;
    const isStaffOrAdmin = requesterRole === UserRole.STAFF || requesterRole === UserRole.ADMIN;

    if (!isParticipant && !isStaffOrAdmin) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    // 3. Build query
    const query = this.evidenceRepo
      .createQueryBuilder('evidence')
      .leftJoinAndSelect('evidence.uploader', 'uploader')
      .where('evidence.disputeId = :disputeId', { disputeId });

    // Regular users cannot see flagged evidence
    if (!isStaffOrAdmin) {
      query.andWhere('evidence.isFlagged = :isFlagged', { isFlagged: false });
    }

    query.orderBy('evidence.uploadedAt', 'DESC');

    const evidenceList = await query.getMany();

    // 4. Generate signed URLs with caching
    return this.generateSignedUrlsWithCache(evidenceList);
  }

  // ===========================================================================
  // HELPER: getEvidenceById
  // ===========================================================================
  async getEvidenceById(
    evidenceId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<EvidenceWithSignedUrl | null> {
    const evidence = await this.evidenceRepo.findOne({
      where: { id: evidenceId },
      relations: ['dispute', 'uploader'],
    });

    if (!evidence) {
      return null;
    }

    // Check access
    const dispute = evidence.dispute as DisputeEntity;
    const isParticipant = dispute.raisedById === requesterId || dispute.defendantId === requesterId;
    const isStaffOrAdmin = requesterRole === UserRole.STAFF || requesterRole === UserRole.ADMIN;

    if (!isParticipant && !isStaffOrAdmin) {
      throw new ForbiddenException('You do not have access to this evidence');
    }

    // Regular users cannot see flagged evidence
    if (evidence.isFlagged && !isStaffOrAdmin) {
      return null;
    }

    // Generate signed URL
    const withSignedUrls = await this.generateSignedUrlsWithCache([evidence]);
    return withSignedUrls[0] || null;
  }

  // ===========================================================================
  // HELPER: generateSignedUrlsWithCache (BATCHED + CACHED)
  // ===========================================================================
  private async generateSignedUrlsWithCache(
    evidenceList: DisputeEvidenceEntity[],
  ): Promise<EvidenceWithSignedUrl[]> {
    if (evidenceList.length === 0) {
      return [];
    }

    const results: EvidenceWithSignedUrl[] = [];
    const uncachedEvidence: DisputeEvidenceEntity[] = [];

    // 1. Check cache first
    for (const evidence of evidenceList) {
      const cacheKey = `signed_url:${evidence.id}`;
      const cachedUrl = await this.cacheManager.get<string>(cacheKey);

      if (cachedUrl) {
        results.push({ ...evidence, signedUrl: cachedUrl });
      } else {
        uncachedEvidence.push(evidence);
      }
    }

    // 2. Generate signed URLs for uncached items in batches
    if (uncachedEvidence.length > 0) {
      const chunks = this.chunkArray(uncachedEvidence, SIGNED_URL_BATCH_SIZE);

      for (const chunk of chunks) {
        const paths = chunk.map((e) => e.storagePath);

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrls(paths, 3600); // 1 hour expiry

        if (error) {
          console.error('Error generating signed URLs:', error);
          // Add items without signed URLs
          for (const evidence of chunk) {
            results.push({ ...evidence, signedUrl: undefined });
          }
          continue;
        }

        // Cache and add to results
        for (let i = 0; i < chunk.length; i++) {
          const evidence = chunk[i];
          const signedUrl = data?.[i]?.signedUrl;

          if (signedUrl) {
            const cacheKey = `signed_url:${evidence.id}`;
            await this.cacheManager.set(cacheKey, signedUrl, SIGNED_URL_CACHE_TTL_SECONDS * 1000);
          }

          results.push({ ...evidence, signedUrl });
        }
      }
    }

    return results;
  }

  // ===========================================================================
  // HELPER: chunkArray
  // ===========================================================================
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // ===========================================================================
  // HELPER: cleanupOrphanEvidenceRecords (for cron job)
  // Note: Since entity doesn't have status field, this would need
  // a different approach - perhaps a separate tracking table or
  // checking Supabase storage directly
  // ===========================================================================
  async cleanupOrphanEvidenceRecords(): Promise<number> {
    // This is a placeholder - actual implementation would depend on
    // how you track failed uploads (e.g., comparing DB records with
    // actual files in Supabase storage)
    return 0;
  }
}
