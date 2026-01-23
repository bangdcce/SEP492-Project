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
  bucketName: process.env.SUPABASE_KYC_BUCKET || 'kyc-documents',
};

const trimmedServiceKey = supabaseConfig.serviceRoleKey?.trim() || '';
const looksLikeJwt = trimmedServiceKey.split('.').length === 3;
const serviceKeyForClient = trimmedServiceKey || 'your-service-role-key';

console.log('[Supabase Config] URL:', supabaseConfig.url);
console.log('[Supabase Config] Bucket:', supabaseConfig.bucketName);
console.log('[Supabase Config] Has Key:', !!trimmedServiceKey);
console.log('[Supabase Config] Key Format OK:', looksLikeJwt);

// Disable SSL verification for testing (if fetch fails)
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('[Supabase Config] TLS verification disabled');
}

// Create Supabase client with service role (bypass RLS)
export const supabaseClient = createClient(
  supabaseConfig.url,
  serviceKeyForClient,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (...args) => {
        console.log('[Supabase Fetch] Request to:', args[0]);
        return fetch(...args).catch(err => {
          console.error('[Supabase Fetch] Error:', err.message, err.cause);
          throw err;
        });
      },
    },
  }
);

// Helper to get storage bucket
export const getKycBucket = () => {
  return supabaseClient.storage.from(supabaseConfig.bucketName);
};
