import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { fromBuffer } from 'file-type';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  DisputeEvidenceEntity,
  DisputeEntity,
  DisputePartyEntity,
  DisputeActivityEntity,
  DisputeHearingEntity,
  HearingStatus,
  DisputeAction,
  UserRole,
  DisputeStatus,
  DisputePhase,
} from 'src/database/entities';
import { DISPUTE_EVENTS } from '../events/dispute.events';
import { isDisputeAppealFlowStatus, isDisputeClosedStatus } from '../dispute-docket';

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
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
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
  'application/json': 5 * 1024 * 1024,
  'application/msword': 15 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 15 * 1024 * 1024,
  'application/vnd.ms-excel': 15 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 15 * 1024 * 1024,
  'video/mp4': 50 * 1024 * 1024,
  'video/webm': 50 * 1024 * 1024,
  'audio/mpeg': 20 * 1024 * 1024,
  'audio/wav': 20 * 1024 * 1024,
  'application/zip': 50 * 1024 * 1024,
  'application/x-zip-compressed': 50 * 1024 * 1024,
};

const ABSOLUTE_MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_EVIDENCE_PER_USER_PER_DISPUTE = 20;
const SIGNED_URL_CACHE_TTL_SECONDS = 55 * 60;
const SIGNED_URL_BATCH_SIZE = 20;
const BUCKET_NAME = 'disputes';
const VIRUSTOTAL_BASE_URL = 'https://www.virustotal.com/api/v3';
const VIRUSTOTAL_BLOCK_THRESHOLD = 1;
const VIRUSTOTAL_SCAN_CACHE_PREFIX = 'virustotal_scan:';
const DEFAULT_VIRUSTOTAL_SCAN_CACHE_TTL_SECONDS = 15 * 60;
const DEFAULT_VIRUSTOTAL_UNKNOWN_HASH_CACHE_TTL_SECONDS = 5 * 60;
const DEFAULT_VIRUSTOTAL_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_VIRUSTOTAL_MAX_RETRIES = 2;
const DEFAULT_VIRUSTOTAL_RETRY_BASE_DELAY_MS = 250;

// =============================================================================
// INTERFACES
// =============================================================================
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFileName?: string;
}

export interface FileContentValidationResult {
  isValid: boolean;
  error?: string;
  actualMimeType?: string | null;
}

export interface GitEvidenceInput {
  repoUrl: string;
  commitHash?: string;
  branch?: string;
  filePaths?: string[];
}

export interface GitEvidenceMetadata {
  provider: 'github' | 'gitlab' | 'bitbucket';
  owner: string;
  repo: string;
  commitHash?: string;
}

export interface GitEvidenceValidationResult {
  valid: boolean;
  error?: string;
  metadata?: GitEvidenceMetadata;
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
  uploaderName?: string;
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
  errorCode?:
    | 'STAFF_UPLOAD_FORBIDDEN'
    | 'HEARING_EVIDENCE_WINDOW_CLOSED'
    | 'EVIDENCE_UPLOAD_FORBIDDEN';
  isDuplicate?: boolean;
  existingEvidenceId?: string;
  warning?: string;
}

export interface EvidenceWithSignedUrl extends DisputeEvidenceEntity {
  signedUrl?: string;
}

// =============================================================================
// EVIDENCE SERVICE
// =============================================================================
@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);
  private supabase: SupabaseClient;
  private bucketName = BUCKET_NAME;

  constructor(
    @InjectRepository(DisputeEvidenceEntity)
    private readonly evidenceRepo: Repository<DisputeEvidenceEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputePartyEntity)
    private readonly disputePartyRepo: Repository<DisputePartyEntity>,
    @InjectRepository(DisputeActivityEntity)
    private readonly activityRepo: Repository<DisputeActivityEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async isDisputePartyMember(dispute: DisputeEntity, userId: string): Promise<boolean> {
    if (dispute.raisedById === userId || dispute.defendantId === userId) {
      return true;
    }
    const groupId = dispute.groupId || dispute.id;
    const membership = await this.disputePartyRepo.findOne({
      where: { groupId, userId },
      select: ['id'],
    });
    return Boolean(membership);
  }

  // ===========================================================================
  // UNIT FUNCTION: validateFileUpload
  // ===========================================================================
  validateFileUpload(fileName: string, fileSize: number, mimeType: string): FileValidationResult {
    const normalizedMimeType = this.normalizeMimeType(mimeType);

    // 1. Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(normalizedMimeType)) {
      return {
        isValid: false,
        error: `File type '${mimeType}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    // 2. Check file size by type
    const maxSizeForType = FILE_SIZE_LIMITS[normalizedMimeType] || ABSOLUTE_MAX_FILE_SIZE;
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
    if (!this.validateExtensionMatchesMime(sanitized, normalizedMimeType)) {
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

  private normalizeMimeType(mimeType: string): string {
    if (mimeType === 'application/x-zip-compressed') {
      return 'application/zip';
    }
    return mimeType;
  }

  private isProbablyText(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 512));
    for (const byte of sample) {
      if (byte === 0) {
        return false;
      }
    }
    return true;
  }

  private isValidJson(buffer: Buffer): boolean {
    try {
      const content = buffer.toString('utf8');
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  private async validateFileContent(
    fileBuffer: Buffer,
    declaredMimeType: string,
  ): Promise<FileContentValidationResult> {
    const normalizedDeclared = this.normalizeMimeType(declaredMimeType);

    const detected = await fromBuffer(fileBuffer);
    const detectedMime = detected?.mime ? this.normalizeMimeType(detected.mime) : null;

    if (detectedMime && detectedMime !== normalizedDeclared) {
      return {
        isValid: false,
        error: `Detected content type '${detectedMime}' does not match declared '${normalizedDeclared}'`,
        actualMimeType: detectedMime,
      };
    }

    if (!detectedMime) {
      if (normalizedDeclared === 'application/json') {
        if (!this.isValidJson(fileBuffer)) {
          return {
            isValid: false,
            error: 'Declared JSON file is not valid JSON content',
          };
        }
      } else if (normalizedDeclared === 'text/plain') {
        if (!this.isProbablyText(fileBuffer)) {
          return {
            isValid: false,
            error: 'Declared text file contains binary data',
          };
        }
      } else if (normalizedDeclared === 'application/zip') {
        return {
          isValid: false,
          error: 'Unable to validate ZIP file signature',
        };
      }
    }

    return {
      isValid: true,
      actualMimeType: detectedMime,
    };
  }

  async validateGitEvidence(input: GitEvidenceInput): Promise<GitEvidenceValidationResult> {
    const trimmedUrl = input.repoUrl?.trim();
    if (!trimmedUrl) {
      return { valid: false, error: 'Repository URL is required' };
    }

    const githubCommit = /github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-fA-F]{7,40})/i;
    const githubRepo = /github\.com\/([^/]+)\/([^/]+)/i;
    const gitlabCommit = /gitlab\.com\/([^/]+)\/([^/]+)\/-\/commit\/([0-9a-fA-F]{7,40})/i;
    const bitbucketCommit = /bitbucket\.org\/([^/]+)\/([^/]+)\/commits\/([0-9a-fA-F]{7,40})/i;

    let provider: GitEvidenceMetadata['provider'] | null = null;
    let owner = '';
    let repo = '';
    let commitHash = input.commitHash?.trim();

    let match = trimmedUrl.match(githubCommit);
    if (match) {
      provider = 'github';
      owner = match[1];
      repo = match[2];
      commitHash = commitHash || match[3];
    } else {
      match = trimmedUrl.match(githubRepo);
      if (match) {
        provider = 'github';
        owner = match[1];
        repo = match[2];
      }
    }

    if (!provider) {
      match = trimmedUrl.match(gitlabCommit);
      if (match) {
        provider = 'gitlab';
        owner = match[1];
        repo = match[2];
        commitHash = commitHash || match[3];
      }
    }

    if (!provider) {
      match = trimmedUrl.match(bitbucketCommit);
      if (match) {
        provider = 'bitbucket';
        owner = match[1];
        repo = match[2];
        commitHash = commitHash || match[3];
      }
    }

    if (!provider) {
      return { valid: false, error: 'Unsupported Git provider or invalid URL format' };
    }

    const metadata: GitEvidenceMetadata = {
      provider,
      owner,
      repo,
      commitHash: commitHash || undefined,
    };

    if (provider === 'github' && commitHash) {
      const exists = await this.verifyGitHubCommitExists(owner, repo, commitHash);
      if (!exists) {
        return { valid: false, error: 'GitHub commit not found', metadata };
      }
    }

    return { valid: true, metadata };
  }

  private async verifyGitHubCommitExists(
    owner: string,
    repo: string,
    commitHash: string,
  ): Promise<boolean> {
    const apiToken = this.configService.get<string>('GITHUB_API_TOKEN');
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };

    if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
    }

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits/${commitHash}`,
        { headers },
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private parsePositiveIntConfig(
    key: string,
    fallback: number,
    min: number = 0,
    max: number = Number.MAX_SAFE_INTEGER,
  ): number {
    const rawValue = this.configService.get<string>(key);
    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
      return fallback;
    }

    const normalized = Math.floor(parsedValue);
    if (normalized < min) {
      return min;
    }
    if (normalized > max) {
      return max;
    }

    return normalized;
  }

  private getVirusTotalFailOpenPolicy(): boolean {
    const raw = this.configService.get<string>('VIRUSTOTAL_FAIL_OPEN');
    if (raw == null) {
      return true;
    }

    return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
  }

  private getVirusTotalCacheKey(fileHash: string): string {
    return `${VIRUSTOTAL_SCAN_CACHE_PREFIX}${fileHash}`;
  }

  private async getVirusTotalCachedResult(
    fileHash: string,
  ): Promise<{ blocked: boolean; reason?: string } | null> {
    const cacheKey = this.getVirusTotalCacheKey(fileHash);

    try {
      const cached = await this.cacheManager.get<{ blocked: boolean; reason?: string }>(cacheKey);
      if (cached && typeof cached.blocked === 'boolean') {
        return {
          blocked: cached.blocked,
          reason: cached.reason,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[VirusTotal] cache read failed for hash=${fileHash}: ${message}`);
    }

    return null;
  }

  private async setVirusTotalCachedResult(
    fileHash: string,
    value: { blocked: boolean; reason?: string },
    ttlSeconds: number,
  ): Promise<void> {
    const cacheKey = this.getVirusTotalCacheKey(fileHash);

    try {
      await this.cacheManager.set(cacheKey, value, ttlSeconds * 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[VirusTotal] cache write failed for hash=${fileHash}: ${message}`);
    }
  }

  private isVirusTotalRetriableStatus(status?: number): boolean {
    if (!status) {
      return true;
    }

    return status === 408 || status === 429 || status >= 500;
  }

  private async sleep(milliseconds: number): Promise<void> {
    if (milliseconds <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private async scanWithVirusTotal(
    fileHash: string,
  ): Promise<{ blocked: boolean; reason?: string }> {
    const apiKey = this.configService.get<string>('VIRUSTOTAL_API_KEY');
    if (!apiKey) {
      return { blocked: false };
    }

    const cachedDecision = await this.getVirusTotalCachedResult(fileHash);
    if (cachedDecision) {
      return cachedDecision;
    }

    const baseUrl =
      (this.configService.get<string>('VIRUSTOTAL_API_URL') || VIRUSTOTAL_BASE_URL).replace(
        /\/+$/,
        '',
      );
    const timeoutMs = this.parsePositiveIntConfig(
      'VIRUSTOTAL_REQUEST_TIMEOUT_MS',
      DEFAULT_VIRUSTOTAL_REQUEST_TIMEOUT_MS,
      500,
      30000,
    );
    const maxRetries = this.parsePositiveIntConfig(
      'VIRUSTOTAL_MAX_RETRIES',
      DEFAULT_VIRUSTOTAL_MAX_RETRIES,
      0,
      5,
    );
    const retryBaseDelayMs = this.parsePositiveIntConfig(
      'VIRUSTOTAL_RETRY_BASE_DELAY_MS',
      DEFAULT_VIRUSTOTAL_RETRY_BASE_DELAY_MS,
      0,
      5000,
    );
    const failOpen = this.getVirusTotalFailOpenPolicy();
    const scanCacheTtlSeconds = this.parsePositiveIntConfig(
      'VIRUSTOTAL_SCAN_CACHE_TTL_SECONDS',
      DEFAULT_VIRUSTOTAL_SCAN_CACHE_TTL_SECONDS,
      30,
      24 * 60 * 60,
    );
    const unknownHashCacheTtlSeconds = this.parsePositiveIntConfig(
      'VIRUSTOTAL_UNKNOWN_HASH_CACHE_TTL_SECONDS',
      DEFAULT_VIRUSTOTAL_UNKNOWN_HASH_CACHE_TTL_SECONDS,
      30,
      24 * 60 * 60,
    );

    let lastStatus: number | undefined;
    let lastErrorMessage = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(`${baseUrl}/files/${fileHash}`, {
          headers: {
            'x-apikey': apiKey,
          },
          timeout: timeoutMs,
        });

        const stats = response?.data?.data?.attributes?.last_analysis_stats;
        const malicious = Number(stats?.malicious || 0);
        const suspicious = Number(stats?.suspicious || 0);

        const decision =
          malicious + suspicious >= VIRUSTOTAL_BLOCK_THRESHOLD
            ? {
                blocked: true,
                reason: `VirusTotal flagged file (malicious: ${malicious}, suspicious: ${suspicious})`,
              }
            : { blocked: false };

        await this.setVirusTotalCachedResult(fileHash, decision, scanCacheTtlSeconds);
        return decision;
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        lastStatus = status;
        lastErrorMessage = error instanceof Error ? error.message : String(error);

        if (status === 404) {
          const cleanDecision = { blocked: false };
          await this.setVirusTotalCachedResult(
            fileHash,
            cleanDecision,
            unknownHashCacheTtlSeconds,
          );
          return cleanDecision;
        }

        if (this.isVirusTotalRetriableStatus(status) && attempt < maxRetries) {
          const delay = retryBaseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    const statusLabel = lastStatus ? `status=${lastStatus}` : 'status=network';
    if (failOpen) {
      this.logger.warn(
        `[VirusTotal] scan skipped (${statusLabel}) hash=${fileHash} reason=${lastErrorMessage || 'unknown'}`,
      );
      return { blocked: false };
    }

    this.logger.error(
      `[VirusTotal] fail-closed (${statusLabel}) hash=${fileHash} reason=${lastErrorMessage || 'unknown'}`,
    );
    return {
      blocked: true,
      reason: 'VirusTotal scan unavailable (fail-closed policy)',
    };
  }

  private sanitizeFileName(fileName: string): string | null {
    if (!fileName || typeof fileName !== 'string') {
      return null;
    }

    // Remove path components
    const baseName = fileName.split(/[\\/]/).pop() || '';

    // Remove control characters first, then replace file-system-dangerous characters.
    const withoutControlChars = Array.from(baseName)
      .filter((char) => char.charCodeAt(0) >= 32)
      .join('');
    const sanitized = withoutControlChars
      .replace(/[<>:"/\\|?*]/g, '_')
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
      'application/json': ['json'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'application/vnd.ms-excel': ['xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
      'video/mp4': ['mp4'],
      'video/webm': ['webm'],
      'audio/mpeg': ['mp3'],
      'audio/wav': ['wav'],
      'application/zip': ['zip'],
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

    if (uploaderRole === UserRole.STAFF || uploaderRole === UserRole.ADMIN) {
      return {
        success: false,
        error: 'Staff cannot upload evidence for disputes',
        errorCode: 'STAFF_UPLOAD_FORBIDDEN',
      };
    }

    const isParticipant = await this.isDisputePartyMember(dispute, uploaderId);
    if (!isParticipant) {
      return {
        success: false,
        error: 'Only dispute participants can upload evidence',
        errorCode: 'EVIDENCE_UPLOAD_FORBIDDEN',
      };
    }

    const activeLiveHearing = await this.hearingRepo.findOne({
      where: {
        disputeId,
        status: HearingStatus.IN_PROGRESS,
      },
      select: ['id', 'isEvidenceIntakeOpen'],
      order: { startedAt: 'DESC' },
    });

    if (isDisputeClosedStatus(dispute.status)) {
      return {
        success: false,
        error: 'This dispute is archived. Evidence uploads are locked after the verdict is issued.',
        errorCode: 'DISPUTE_READ_ONLY',
      };
    }

    if (isDisputeAppealFlowStatus(dispute.status) && !activeLiveHearing) {
      return {
        success: false,
        error:
          'Appeal evidence can only be uploaded during the active appeal hearing while evidence intake is open.',
        errorCode: 'DISPUTE_READ_ONLY',
      };
    }

    if (activeLiveHearing && !activeLiveHearing.isEvidenceIntakeOpen) {
      return {
        success: false,
        error:
          'Live hearing evidence intake is closed. Ask moderator to open intake before uploading.',
        errorCode: 'HEARING_EVIDENCE_WINDOW_CLOSED',
      };
    }

    // Justification required when uploading outside EVIDENCE_SUBMISSION phase
    if (
      activeLiveHearing &&
      dispute.phase !== DisputePhase.EVIDENCE_SUBMISSION &&
      (!description || description.trim().length < 10)
    ) {
      return {
        success: false,
        error:
          'A description/justification (min 10 characters) is required when submitting evidence outside the Evidence Submission phase.',
        errorCode: 'EVIDENCE_UPLOAD_FORBIDDEN',
      };
    }

    // 2. Validate file
    const validation = this.validateFileUpload(fileName, fileSize, mimeType);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const contentValidation = await this.validateFileContent(fileBuffer, mimeType);
    if (!contentValidation.isValid) {
      return { success: false, error: contentValidation.error };
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

      // Virus scanning (best-effort)
      const scanResult = await this.scanWithVirusTotal(fileHash);
      if (scanResult.blocked) {
        await this.supabase.storage.from(this.bucketName).remove([storagePath.path]);
        await this.evidenceRepo.delete(savedEvidence.id);
        return {
          success: false,
          error: scanResult.reason || 'File failed malware scan',
        };
      }

      const warning =
        this.normalizeMimeType(mimeType) === 'application/zip'
          ? 'Consider submitting a GitHub link instead of ZIP for source code evidence.'
          : undefined;

      this.eventEmitter?.emit(DISPUTE_EVENTS.EVIDENCE_ADDED, {
        disputeId,
        evidenceId: savedEvidence.id,
        uploaderId,
        uploaderRole,
        uploaderName: input.uploaderName,
        fileName: savedEvidence.fileName,
        mimeType: savedEvidence.mimeType,
        fileSize: savedEvidence.fileSize,
        description: savedEvidence.description,
        uploadedAt: savedEvidence.uploadedAt,
      });
      if (dispute.status === DisputeStatus.INFO_REQUESTED && uploaderId === dispute.raisedById) {
        dispute.status = DisputeStatus.PREVIEW;
        dispute.infoProvidedAt = new Date();
        await this.disputeRepo.save(dispute);

        await this.activityRepo.save(
          this.activityRepo.create({
            disputeId,
            actorId: uploaderId,
            actorRole: uploaderRole,
            action: DisputeAction.INFO_PROVIDED,
            description: 'Additional evidence submitted for review',
            metadata: { evidenceId: savedEvidence.id },
          }),
        );

        this.eventEmitter?.emit(DISPUTE_EVENTS.INFO_PROVIDED, {
          disputeId,
          userId: uploaderId,
          providedAt: dispute.infoProvidedAt,
        });
      }

      // Upload successful
      return {
        success: true,
        evidence: savedEvidence,
        warning,
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
    const isParticipant = await this.isDisputePartyMember(dispute, requesterId);
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
    const isParticipant = await this.isDisputePartyMember(dispute, requesterId);
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
          console.error(
            `[EvidenceService] Failed to generate signed URLs for ${paths.length} file(s):`,
            error.message,
            'Paths:',
            paths,
          );
          // Add items without signed URLs — frontend will show "URL Unavailable"
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
  cleanupOrphanEvidenceRecords(): number {
    // This is a placeholder - actual implementation would depend on
    // how you track failed uploads (e.g., comparing DB records with
    // actual files in Supabase storage)
    return 0;
  }

  // ===========================================================================
  // COMPOSE FUNCTION: exportEvidencePackage — ZIP with manifest for court
  // ===========================================================================
  async exportEvidencePackage(
    disputeId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ stream: NodeJS.ReadableStream; fileName: string }> {
    // Verify access
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    const isStaffOrAdmin = [UserRole.ADMIN, UserRole.STAFF].includes(userRole);
    if (!isStaffOrAdmin) {
      const isParty = await this.disputePartyRepo.findOne({
        where: { disputeId, userId },
      });
      if (!isParty && dispute.raisedById !== userId && dispute.defendantId !== userId) {
        throw new ForbiddenException('You do not have access to this dispute');
      }
    }

    // Load all non-flagged evidence
    const evidenceList = await this.evidenceRepo.find({
      where: { disputeId, isFlagged: false },
      order: { uploadedAt: 'ASC' },
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 6 } });

    const manifest: Array<{
      index: number;
      evidenceId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      sha256: string;
      uploadedBy: string;
      uploaderRole: string;
      uploadedAt: string;
      description: string | null;
      archivePath: string;
    }> = [];
    const omittedFiles: Array<{
      evidenceId: string;
      fileName: string;
      storagePath: string;
      reason: string;
    }> = [];

    let index = 0;
    for (const evidence of evidenceList) {
      index++;
      const ext = evidence.fileName?.split('.').pop() || 'bin';
      const archivePath = `evidence/${String(index).padStart(3, '0')}_${evidence.id.slice(0, 8)}.${ext}`;

      // Download file from Supabase
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(evidence.storagePath);

      if (error || !data) {
        omittedFiles.push({
          evidenceId: evidence.id,
          fileName: evidence.fileName,
          storagePath: evidence.storagePath,
          reason: error?.message || 'File unavailable in storage',
        });
        this.logger.warn(
          `Skipping evidence ${evidence.id} during export because download failed: ${error?.message || 'File unavailable in storage'}`,
        );
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      archive.append(buffer, { name: archivePath });

      manifest.push({
        index,
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        fileSize: evidence.fileSize,
        mimeType: evidence.mimeType,
        sha256: evidence.fileHash || '',
        uploadedBy: evidence.uploaderId,
        uploaderRole: evidence.uploaderRole,
        uploadedAt: evidence.uploadedAt?.toISOString() || '',
        description: evidence.description || null,
        archivePath,
      });
    }

    // Add manifest.json
    archive.append(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          disputeId,
          expectedFiles: evidenceList.length,
          totalFiles: manifest.length,
          isComplete: omittedFiles.length === 0,
          omittedFiles,
          exportedBy: userId,
          files: manifest,
        },
        null,
        2,
      ),
      { name: 'manifest.json' },
    );

    // Finalize
    archive.finalize();

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `dispute_${disputeId.slice(0, 8)}_evidence_${dateStr}.zip`;

    return { stream: archive, fileName };
  }
}
