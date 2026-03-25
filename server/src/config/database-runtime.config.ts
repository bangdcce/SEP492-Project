const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export type DatabaseRuntimeConfig = {
  nodeEnv: string;
  host?: string;
  port: number;
  isDevelopment: boolean;
  isSupabasePooler: boolean;
  isSupabaseSessionMode: boolean;
  poolMax: number;
  poolIdleMs: number;
  poolConnTimeoutMs: number;
  poolMaxUses: number;
  poolAllowExitOnIdle: boolean;
  queryTimeoutMs: number;
  statementTimeoutMs: number;
};

export const resolveDatabaseRuntimeConfig = (
  env: Record<string, string | undefined>,
): DatabaseRuntimeConfig => {
  const nodeEnv = env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv !== 'production';
  const host = env.DB_HOST;
  const port = parseNumberEnv(env.DB_PORT, 5432);
  const isSupabasePooler = Boolean(host && host.includes('.pooler.supabase.com'));
  const isSupabaseSessionMode = isSupabasePooler && port === 5432;

  return {
    nodeEnv,
    host,
    port,
    isDevelopment,
    isSupabasePooler,
    isSupabaseSessionMode,
    poolMax: parseNumberEnv(env.DB_POOL_MAX, isDevelopment ? 4 : isSupabasePooler ? 8 : 20),
    poolIdleMs: parseNumberEnv(env.DB_POOL_IDLE_MS, isDevelopment ? 10000 : 30000),
    poolConnTimeoutMs: parseNumberEnv(
      env.DB_POOL_CONN_TIMEOUT_MS,
      isDevelopment ? 5000 : 10000,
    ),
    poolMaxUses: parseNumberEnv(env.DB_POOL_MAX_USES, isDevelopment ? 5000 : 10000),
    poolAllowExitOnIdle: parseBooleanEnv(
      env.DB_POOL_ALLOW_EXIT_ON_IDLE,
      isDevelopment,
    ),
    queryTimeoutMs: parseNumberEnv(env.DB_QUERY_TIMEOUT_MS, 30000),
    statementTimeoutMs: parseNumberEnv(env.DB_STATEMENT_TIMEOUT_MS, 30000),
  };
};

export const isBackgroundTaskEnabled = (
  env: Record<string, string | undefined>,
  key: string,
  options?: { enabledByDefaultInDevelopment?: boolean; enabledByDefaultInProduction?: boolean },
): boolean => {
  const explicit = env[key];
  if (explicit != null) {
    return parseBooleanEnv(explicit, false);
  }

  const isDevelopment = (env.NODE_ENV || 'development') !== 'production';
  if (isDevelopment) {
    return options?.enabledByDefaultInDevelopment ?? false;
  }

  return options?.enabledByDefaultInProduction ?? true;
};
