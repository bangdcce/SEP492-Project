import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file manually (before NestJS ConfigModule initializes)
// Always load server/.env regardless of current working directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });

// Supabase configuration for file storage
export const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  serviceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    'your-service-role-key',
  buckets: {
    kyc: process.env.SUPABASE_KYC_BUCKET || 'kyc-documents',
    projectRequests:
      process.env.SUPABASE_PROJECT_REQUESTS_BUCKET || 'project-request-attachments',
    requestChat: process.env.SUPABASE_REQUEST_CHAT_BUCKET || 'request-chat-attachments',
  },
};

const trimmedServiceKey = supabaseConfig.serviceRoleKey?.trim() || '';
const looksLikeJwt = trimmedServiceKey.split('.').length === 3;
const serviceKeyForClient = trimmedServiceKey || 'your-service-role-key';

console.log('[Supabase Config] URL:', supabaseConfig.url);
console.log('[Supabase Config] KYC Bucket:', supabaseConfig.buckets.kyc);
console.log('[Supabase Config] Project Request Bucket:', supabaseConfig.buckets.projectRequests);
console.log('[Supabase Config] Request Chat Bucket:', supabaseConfig.buckets.requestChat);
console.log('[Supabase Config] Has Key:', !!trimmedServiceKey);
console.log('[Supabase Config] Key Format OK:', looksLikeJwt);

// Allow insecure TLS only when explicitly enabled for a local/dev environment.
if (process.env.ALLOW_INSECURE_SUPABASE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[Supabase Config] TLS verification disabled by ALLOW_INSECURE_SUPABASE_TLS=true');
}

// Create Supabase client with service role (bypass RLS)
export const supabaseClient = createClient(supabaseConfig.url, serviceKeyForClient, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      console.log('[Supabase Fetch] Request to:', input);
      return fetch(input, init).catch((err) => {
        console.error('[Supabase Fetch] Error:', err.message, err.cause);
        throw err;
      });
    },
  },
});

// Helper to get storage bucket
export const getKycBucket = () => {
  return supabaseClient.storage.from(supabaseConfig.buckets.kyc);
};

export const getProjectRequestBucket = () => {
  return supabaseClient.storage.from(supabaseConfig.buckets.projectRequests);
};

export const getRequestChatBucket = () => {
  return supabaseClient.storage.from(supabaseConfig.buckets.requestChat);
};
