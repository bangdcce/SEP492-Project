import type { CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';

type SameSiteValue = NonNullable<CookieOptions['sameSite']>;

const DEFAULT_ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const parseBoolean = (value?: string): boolean | undefined => {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return undefined;
};

const parsePositiveNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const parseSameSite = (value?: string): SameSiteValue => {
  if (!value) return 'lax';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'none') return 'none';
  if (normalized === 'strict') return 'strict';
  return 'lax';
};

const splitCsvValues = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const isLocalHostLike = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('0.0.0.0')
  );
};

const isHttpsLike = (value: string): boolean => value.toLowerCase().startsWith('https://');

export type AuthCookiePolicy = {
  accessToken: CookieOptions;
  refreshToken: CookieOptions;
  clear: CookieOptions;
};

export const buildAuthCookiePolicy = (configService: ConfigService): AuthCookiePolicy => {
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';
  const topologyHints = [
    configService.get<string>('APP_URL') || '',
    configService.get<string>('FRONTEND_URL') || '',
    ...splitCsvValues(configService.get<string>('CORS_ORIGIN')),
  ].filter(Boolean);
  const localTopology = topologyHints.some((value) => isLocalHostLike(value));
  const httpsTopology = topologyHints.some((value) => isHttpsLike(value));

  const secureFromEnv = parseBoolean(configService.get<string>('AUTH_COOKIE_SECURE'));
  let secure = secureFromEnv ?? (isProduction && !localTopology);

  let sameSite = parseSameSite(configService.get<string>('AUTH_COOKIE_SAME_SITE'));
  if (sameSite === 'none' && !secure) {
    // SameSite=None requires Secure. Prefer secure cookies on HTTPS; otherwise degrade to lax.
    if (httpsTopology) {
      secure = true;
    } else {
      sameSite = 'lax';
    }
  }

  const domain = configService.get<string>('AUTH_COOKIE_DOMAIN') || undefined;
  const path = configService.get<string>('AUTH_COOKIE_PATH') || '/';
  const accessMaxAge = parsePositiveNumber(
    configService.get<string>('AUTH_ACCESS_COOKIE_MAX_AGE_MS'),
    DEFAULT_ACCESS_COOKIE_MAX_AGE_MS,
  );
  const refreshMaxAge = parsePositiveNumber(
    configService.get<string>('AUTH_REFRESH_COOKIE_MAX_AGE_MS'),
    DEFAULT_REFRESH_COOKIE_MAX_AGE_MS,
  );

  const baseOptions: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite,
    path,
    domain,
  };

  return {
    accessToken: {
      ...baseOptions,
      maxAge: accessMaxAge,
    },
    refreshToken: {
      ...baseOptions,
      maxAge: refreshMaxAge,
    },
    clear: {
      ...baseOptions,
      maxAge: 0,
    },
  };
};
