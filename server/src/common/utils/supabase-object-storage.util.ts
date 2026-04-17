import { randomUUID } from 'crypto';
import { basename, extname } from 'path';
import { supabaseClient, supabaseConfig } from '../../config/supabase.config';

type StorageScope = 'project-requests' | 'request-chat';

const STORAGE_PREFIXES: Record<StorageScope, string> = {
  'project-requests': 'project-requests',
  'request-chat': 'request-chat',
};

const STORAGE_BUCKETS: Record<StorageScope, string> = {
  'project-requests': supabaseConfig.buckets.projectRequests,
  'request-chat': supabaseConfig.buckets.requestChat,
};

const ensuredBuckets = new Map<string, Promise<void>>();

const sanitizeObjectFilename = (fileName: string): string => {
  const normalized = basename(String(fileName || 'attachment'))
    .normalize('NFC')
    .replace(/[\u0000-\u001F<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .trim();

  return normalized || 'attachment';
};

const ensureBucketExists = async (bucketName: string): Promise<void> => {
  if (!bucketName?.trim()) {
    throw new Error('Supabase bucket name is missing');
  }

  const existing = ensuredBuckets.get(bucketName);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const { data, error } = await supabaseClient.storage.getBucket(bucketName);
    if (!error && data) {
      return;
    }

    const getBucketMessage = `${error?.message || ''}`.toLowerCase();
    const missingBucket =
      !data &&
      (!error ||
        getBucketMessage.includes('not found') ||
        getBucketMessage.includes('does not exist') ||
        getBucketMessage.includes('404'));

    if (!missingBucket) {
      throw new Error(
        `Failed to inspect bucket "${bucketName}": ${error?.message || 'unknown error'}`,
      );
    }

    const { error: createError } = await supabaseClient.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: '50MB',
    });

    if (createError) {
      const createMessage = `${createError.message || ''}`.toLowerCase();
      const alreadyExists =
        createMessage.includes('already exists') || createMessage.includes('duplicate');
      if (!alreadyExists) {
        throw new Error(`Failed to create bucket "${bucketName}": ${createError.message}`);
      }
    }
  })();

  ensuredBuckets.set(bucketName, pending);

  try {
    await pending;
  } catch (error) {
    ensuredBuckets.delete(bucketName);
    throw error;
  }
};

const buildScopedStoragePath = (
  scope: StorageScope,
  ownerKey: string,
  fileName: string,
): string => {
  const prefix = STORAGE_PREFIXES[scope];
  const normalizedOwnerKey = String(ownerKey || 'unscoped')
    .trim()
    .replace(/[^\w/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\/+|\/+$/g, '');
  const sanitizedFileName = sanitizeObjectFilename(fileName);
  const extension = extname(sanitizedFileName);
  const baseName = extension ? sanitizedFileName.slice(0, -extension.length) : sanitizedFileName;
  const uniqueDirectory = `${baseName}-${Date.now()}-${randomUUID().slice(0, 8)}`;

  return `${prefix}/${normalizedOwnerKey}/${uniqueDirectory}/${sanitizedFileName}`;
};

const isValidScopedStoragePath = (
  value: string | null | undefined,
  scope: StorageScope,
): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/^[a-z]+:\/\//i.test(normalized)) {
    return false;
  }

  if (normalized.startsWith('/') || normalized.includes('\\')) {
    return false;
  }

  if (normalized.includes('?') || normalized.includes('#')) {
    return false;
  }

  return normalized.startsWith(`${STORAGE_PREFIXES[scope]}/`);
};

const extractScopedStoragePath = (
  value: string | null | undefined,
  scope: StorageScope,
): string | null => {
  const normalized = `${value || ''}`.trim();
  if (!normalized) {
    return null;
  }

  return isValidScopedStoragePath(normalized, scope) ? normalized : null;
};

const uploadToScopedBucket = async (input: {
  scope: StorageScope;
  ownerKey: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
}): Promise<string> => {
  const bucketName = STORAGE_BUCKETS[input.scope];
  const storagePath = buildScopedStoragePath(input.scope, input.ownerKey, input.fileName);
  await ensureBucketExists(bucketName);

  const { error } = await supabaseClient.storage
    .from(bucketName)
    .upload(storagePath, input.fileBuffer, {
      contentType: input.mimeType || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return storagePath;
};

const createSignedUrlForScopedObject = async (
  scope: StorageScope,
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> => {
  if (!isValidScopedStoragePath(storagePath, scope)) {
    return '';
  }

  await ensureBucketExists(STORAGE_BUCKETS[scope]);
  const { data, error } = await supabaseClient.storage
    .from(STORAGE_BUCKETS[scope])
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    const message = `${error.message || ''}`.toLowerCase();
    if (message.includes('not found')) {
      return '';
    }
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data?.signedUrl || '';
};

export const extractProjectRequestStoragePath = (value?: string | null): string | null =>
  extractScopedStoragePath(value, 'project-requests');

export const extractRequestChatStoragePath = (value?: string | null): string | null =>
  extractScopedStoragePath(value, 'request-chat');

export const uploadProjectRequestFile = async (
  fileBuffer: Buffer,
  draftOwnerId: string,
  fileName: string,
  mimeType: string,
): Promise<string> =>
  uploadToScopedBucket({
    scope: 'project-requests',
    ownerKey: `drafts/${draftOwnerId}`,
    fileName,
    fileBuffer,
    mimeType,
  });

export const uploadRequestChatFile = async (
  fileBuffer: Buffer,
  requestId: string,
  fileName: string,
  mimeType: string,
): Promise<string> =>
  uploadToScopedBucket({
    scope: 'request-chat',
    ownerKey: requestId,
    fileName,
    fileBuffer,
    mimeType,
  });

export const getProjectRequestSignedUrl = async (
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> => createSignedUrlForScopedObject('project-requests', storagePath, expiresIn);

export const getRequestChatSignedUrl = async (
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> => createSignedUrlForScopedObject('request-chat', storagePath, expiresIn);
