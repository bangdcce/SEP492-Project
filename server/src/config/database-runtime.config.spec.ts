import {
  isBackgroundTaskEnabled,
  resolveDatabaseRuntimeConfig,
} from './database-runtime.config';

describe('database-runtime.config', () => {
  describe('resolveDatabaseRuntimeConfig', () => {
    it('uses shared-dev safe defaults for Supabase transaction pooler', () => {
      const runtime = resolveDatabaseRuntimeConfig({
        NODE_ENV: 'development',
        DB_HOST: 'aws-1-ap-south-1.pooler.supabase.com',
        DB_PORT: '6543',
      });

      expect(runtime.isDevelopment).toBe(true);
      expect(runtime.isSupabasePooler).toBe(true);
      expect(runtime.isSupabaseSessionMode).toBe(false);
      expect(runtime.poolMax).toBe(4);
      expect(runtime.poolIdleMs).toBe(10000);
      expect(runtime.poolConnTimeoutMs).toBe(5000);
      expect(runtime.poolAllowExitOnIdle).toBe(true);
    });

    it('detects Supabase session mode on port 5432', () => {
      const runtime = resolveDatabaseRuntimeConfig({
        NODE_ENV: 'production',
        DB_HOST: 'aws-1-ap-south-1.pooler.supabase.com',
        DB_PORT: '5432',
      });

      expect(runtime.isSupabasePooler).toBe(true);
      expect(runtime.isSupabaseSessionMode).toBe(true);
    });

    it('honors explicit pool overrides', () => {
      const runtime = resolveDatabaseRuntimeConfig({
        NODE_ENV: 'production',
        DB_HOST: 'db.internal',
        DB_PORT: '5432',
        DB_POOL_MAX: '12',
        DB_POOL_IDLE_MS: '15000',
        DB_POOL_CONN_TIMEOUT_MS: '7000',
        DB_POOL_MAX_USES: '2500',
        DB_POOL_ALLOW_EXIT_ON_IDLE: 'false',
        DB_QUERY_TIMEOUT_MS: '45000',
        DB_STATEMENT_TIMEOUT_MS: '45000',
      });

      expect(runtime.poolMax).toBe(12);
      expect(runtime.poolIdleMs).toBe(15000);
      expect(runtime.poolConnTimeoutMs).toBe(7000);
      expect(runtime.poolMaxUses).toBe(2500);
      expect(runtime.poolAllowExitOnIdle).toBe(false);
      expect(runtime.queryTimeoutMs).toBe(45000);
      expect(runtime.statementTimeoutMs).toBe(45000);
    });
  });

  describe('isBackgroundTaskEnabled', () => {
    it('keeps background tasks disabled by default in development', () => {
      expect(
        isBackgroundTaskEnabled(
          { NODE_ENV: 'development' },
          'HEARING_AUTO_START_ENABLED',
          {
            enabledByDefaultInDevelopment: false,
            enabledByDefaultInProduction: true,
          },
        ),
      ).toBe(false);
    });

    it('keeps background tasks enabled by default in production', () => {
      expect(
        isBackgroundTaskEnabled(
          { NODE_ENV: 'production' },
          'HEARING_AUTO_START_ENABLED',
          {
            enabledByDefaultInDevelopment: false,
            enabledByDefaultInProduction: true,
          },
        ),
      ).toBe(true);
    });

    it('honors explicit env overrides', () => {
      expect(
        isBackgroundTaskEnabled(
          { NODE_ENV: 'production', HEARING_AUTO_START_ENABLED: 'false' },
          'HEARING_AUTO_START_ENABLED',
          {
            enabledByDefaultInDevelopment: false,
            enabledByDefaultInProduction: true,
          },
        ),
      ).toBe(false);
    });
  });
});
