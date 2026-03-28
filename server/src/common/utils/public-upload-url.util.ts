import type { Request } from 'express';

type RequestLike = Pick<Request, 'protocol' | 'headers' | 'get'> | null | undefined;

const PLACEHOLDER_HOSTS = new Set(['your-domain.com', 'example.com']);

const normalizeBaseUrlCandidate = (value?: string | null): string | null => {
  const raw = `${value || ''}`.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
};

export const extractUploadStoragePath = (value?: string | null): string | null => {
  const raw = `${value || ''}`.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('/uploads/')) {
    return raw;
  }

  if (raw.startsWith('uploads/')) {
    return `/${raw}`;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname;
    }
  } catch {
    return null;
  }

  return null;
};

export const resolveRequestOrigin = (req?: RequestLike): string | null => {
  if (!req) {
    return null;
  }

  const forwardedProto = req.headers?.['x-forwarded-proto'];
  const forwardedHost = req.headers?.['x-forwarded-host'];
  const protocol =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ||
    req.protocol ||
    'http';
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
    req.get?.('host') ||
    req.headers?.host;

  if (!host) {
    return null;
  }

  return normalizeBaseUrlCandidate(`${protocol}://${host}`);
};

export const resolvePublicUploadBaseUrl = (req?: RequestLike): string | null =>
  resolveRequestOrigin(req) ||
  normalizeBaseUrlCandidate(process.env.PUBLIC_API_URL) ||
  normalizeBaseUrlCandidate(process.env.BACKEND_URL) ||
  normalizeBaseUrlCandidate(process.env.VITE_API_URL);

export const buildPublicUploadUrl = (pathname: string, req?: RequestLike): string => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const baseUrl = resolvePublicUploadBaseUrl(req);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
};
