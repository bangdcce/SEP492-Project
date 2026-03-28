import { readFile } from 'fs/promises';
import * as path from 'path';
import AppDataSource from '../data-source';
import {
  ProjectRequestEntity,
  type ProjectRequestAttachmentMetadata,
} from '../database/entities/project-request.entity';
import { RequestMessageEntity } from '../database/entities/request-message.entity';
import type { WorkspaceMessageAttachment } from '../database/entities/workspace-message.entity';
import { extractUploadStoragePath } from '../common/utils/public-upload-url.util';
import {
  extractProjectRequestStoragePath,
  extractRequestChatStoragePath,
  uploadProjectRequestFile,
  uploadRequestChatFile,
} from '../common/utils/supabase-object-storage.util';

const isDryRun = process.argv.includes('--dry-run');

type MigrationCounters = {
  scannedRows: number;
  updatedRows: number;
  migratedFiles: number;
  missingFiles: number;
  skippedFiles: number;
};

const projectRequestCounters: MigrationCounters = {
  scannedRows: 0,
  updatedRows: 0,
  migratedFiles: 0,
  missingFiles: 0,
  skippedFiles: 0,
};

const requestChatCounters: MigrationCounters = {
  scannedRows: 0,
  updatedRows: 0,
  migratedFiles: 0,
  missingFiles: 0,
  skippedFiles: 0,
};

const resolveLocalFilePath = (storagePath: string): string =>
  path.resolve(process.cwd(), `.${storagePath}`);

const shouldMigrateProjectRequestAttachment = (
  attachment: ProjectRequestAttachmentMetadata | null | undefined,
): string | null => {
  const objectStoragePath =
    extractProjectRequestStoragePath(attachment?.storagePath) ||
    extractProjectRequestStoragePath(attachment?.url);
  if (objectStoragePath) {
    return null;
  }

  const localStoragePath =
    extractUploadStoragePath(attachment?.storagePath) ||
    extractUploadStoragePath(attachment?.url);
  if (!localStoragePath?.startsWith('/uploads/project-requests/')) {
    return null;
  }

  return localStoragePath;
};

const shouldMigrateRequestChatAttachment = (
  attachment: WorkspaceMessageAttachment | null | undefined,
): string | null => {
  const objectStoragePath =
    extractRequestChatStoragePath(attachment?.storagePath) ||
    extractRequestChatStoragePath(attachment?.url);
  if (objectStoragePath) {
    return null;
  }

  const localStoragePath =
    extractUploadStoragePath(attachment?.storagePath) ||
    extractUploadStoragePath(attachment?.url);
  if (!localStoragePath?.startsWith('/uploads/request-chat/')) {
    return null;
  }

  return localStoragePath;
};

const migrateProjectRequestAttachments = async () => {
  const repo = AppDataSource.getRepository(ProjectRequestEntity);
  const requests = await repo
    .createQueryBuilder('request')
    .select(['request.id', 'request.clientId', 'request.attachments'])
    .where('request.attachments IS NOT NULL')
    .getMany();

  for (const request of requests) {
    projectRequestCounters.scannedRows += 1;
    const currentAttachments = Array.isArray(request.attachments) ? request.attachments : [];
    let changed = false;

    const nextAttachments = await Promise.all(
      currentAttachments.map(async (attachment) => {
        const localStoragePath = shouldMigrateProjectRequestAttachment(attachment);
        if (!localStoragePath) {
          projectRequestCounters.skippedFiles += 1;
          return attachment;
        }

        const absolutePath = resolveLocalFilePath(localStoragePath);
        let fileBuffer: Buffer;
        try {
          fileBuffer = await readFile(absolutePath);
        } catch {
          projectRequestCounters.missingFiles += 1;
          console.warn(
            `[attachments:migrate] Missing project request file for ${request.id}: ${absolutePath}`,
          );
          return attachment;
        }

        const fileName = attachment.filename || path.basename(absolutePath);
        const mimeType = attachment.mimetype || 'application/octet-stream';

        if (isDryRun) {
          projectRequestCounters.migratedFiles += 1;
          changed = true;
          return {
            ...attachment,
            storagePath: `[dry-run] ${localStoragePath}`,
            url: `[dry-run] ${localStoragePath}`,
          };
        }

        const storagePath = await uploadProjectRequestFile(
          fileBuffer,
          request.clientId || request.id,
          fileName,
          mimeType,
        );

        projectRequestCounters.migratedFiles += 1;
        changed = true;
        return {
          ...attachment,
          filename: fileName,
          mimetype: mimeType,
          size:
            typeof attachment.size === 'number' && Number.isFinite(attachment.size)
              ? attachment.size
              : fileBuffer.length,
          storagePath,
          url: storagePath,
        };
      }),
    );

    if (changed) {
      projectRequestCounters.updatedRows += 1;
      if (!isDryRun) {
        await repo.update({ id: request.id }, { attachments: nextAttachments });
      }
    }
  }
};

const migrateRequestChatAttachments = async () => {
  const repo = AppDataSource.getRepository(RequestMessageEntity);
  const messages = await repo
    .createQueryBuilder('message')
    .select(['message.id', 'message.requestId', 'message.attachments'])
    .where('message.attachments IS NOT NULL')
    .getMany();

  for (const message of messages) {
    requestChatCounters.scannedRows += 1;
    const currentAttachments = Array.isArray(message.attachments) ? message.attachments : [];
    let changed = false;

    const nextAttachments = await Promise.all(
      currentAttachments.map(async (attachment) => {
        const localStoragePath = shouldMigrateRequestChatAttachment(attachment);
        if (!localStoragePath) {
          requestChatCounters.skippedFiles += 1;
          return attachment;
        }

        const absolutePath = resolveLocalFilePath(localStoragePath);
        let fileBuffer: Buffer;
        try {
          fileBuffer = await readFile(absolutePath);
        } catch {
          requestChatCounters.missingFiles += 1;
          console.warn(
            `[attachments:migrate] Missing request chat file for ${message.id}: ${absolutePath}`,
          );
          return attachment;
        }

        const fileName = attachment.name || path.basename(absolutePath);
        const mimeType = attachment.type || 'application/octet-stream';

        if (isDryRun) {
          requestChatCounters.migratedFiles += 1;
          changed = true;
          return {
            ...attachment,
            storagePath: `[dry-run] ${localStoragePath}`,
            url: `[dry-run] ${localStoragePath}`,
          };
        }

        const storagePath = await uploadRequestChatFile(
          fileBuffer,
          message.requestId || message.id,
          fileName,
          mimeType,
        );

        requestChatCounters.migratedFiles += 1;
        changed = true;
        return {
          ...attachment,
          name: fileName,
          type: mimeType,
          storagePath,
          url: storagePath,
        };
      }),
    );

    if (changed) {
      requestChatCounters.updatedRows += 1;
      if (!isDryRun) {
        await repo.update({ id: message.id }, { attachments: nextAttachments });
      }
    }
  }
};

const printSummary = (label: string, counters: MigrationCounters) => {
  console.log(`[attachments:migrate] ${label}`);
  console.log(`  scannedRows=${counters.scannedRows}`);
  console.log(`  updatedRows=${counters.updatedRows}`);
  console.log(`  migratedFiles=${counters.migratedFiles}`);
  console.log(`  missingFiles=${counters.missingFiles}`);
  console.log(`  skippedFiles=${counters.skippedFiles}`);
};

const main = async () => {
  await AppDataSource.initialize();

  try {
    console.log(
      `[attachments:migrate] Starting ${isDryRun ? 'dry-run ' : ''}migration of legacy local attachments`,
    );
    await migrateProjectRequestAttachments();
    await migrateRequestChatAttachments();
    printSummary('project_requests.attachments', projectRequestCounters);
    printSummary('request_messages.attachments', requestChatCounters);
  } finally {
    await AppDataSource.destroy();
  }
};

void main().catch((error) => {
  console.error('[attachments:migrate] Failed:', error);
  process.exitCode = 1;
});
