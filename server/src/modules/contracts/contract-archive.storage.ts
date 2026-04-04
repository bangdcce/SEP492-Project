import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface PersistedContractArchive {
  storagePath: string;
  reused: boolean;
}

@Injectable()
export class ContractArchiveStorageService {
  private readonly logger = new Logger(ContractArchiveStorageService.name);
  private supabase: SupabaseClient | null | undefined;

  buildStoragePath(contractId: string, documentHash: string): string {
    return `contracts/${contractId}/${documentHash}.pdf`;
  }

  async persistPdfArtifact(
    contractId: string,
    documentHash: string,
    pdfBuffer: Buffer,
  ): Promise<PersistedContractArchive | null> {
    const supabase = this.getClient();
    if (!supabase) {
      return null;
    }

    const storagePath = this.buildStoragePath(contractId, documentHash);
    const { error } = await supabase.storage.from(this.getBucketName()).upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      cacheControl: '31536000',
      upsert: false,
    });

    if (!error) {
      return { storagePath, reused: false };
    }

    const message = (error.message || '').toLowerCase();
    if (
      message.includes('already exists') ||
      message.includes('duplicate') ||
      message.includes('the resource already exists')
    ) {
      return { storagePath, reused: true };
    }

    this.logger.warn(
      `Failed to persist contract archive for ${contractId} at ${storagePath}: ${error.message}`,
    );
    return null;
  }

  async downloadPdfArtifact(storagePath: string): Promise<Buffer | null> {
    if (!storagePath) {
      return null;
    }

    const supabase = this.getClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.storage.from(this.getBucketName()).download(storagePath);

    if (error || !data) {
      const message = (error?.message || '').toLowerCase();
      if (message.includes('object not found') || message.includes('not found')) {
        this.logger.warn(`Contract archive object missing at ${storagePath}`);
      } else if (error) {
        this.logger.warn(
          `Failed to download contract archive from ${storagePath}: ${error.message}`,
        );
      }
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getBucketName(): string {
    const bucket = (process.env.SUPABASE_CONTRACTS_BUCKET || 'contracts').trim();
    return bucket || 'contracts';
  }

  private getClient(): SupabaseClient | null {
    if (this.supabase !== undefined) {
      return this.supabase;
    }

    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey =
      process.env.SUPABASE_SERVICE_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      '';

    const hasUsableUrl = Boolean(
      supabaseUrl && !supabaseUrl.includes('your-project.supabase.co'),
    );
    const hasUsableKey = Boolean(supabaseKey && !supabaseKey.includes('your-service-role-key'));

    if (!hasUsableUrl || !hasUsableKey) {
      this.logger.warn(
        'Contract archive storage disabled: missing Supabase URL/service key or using placeholder values.',
      );
      this.supabase = null;
      return this.supabase;
    }

    this.supabase = createClient(supabaseUrl!, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return this.supabase;
  }
}
