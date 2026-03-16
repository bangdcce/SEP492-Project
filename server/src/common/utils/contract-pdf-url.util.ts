import { existsSync } from 'fs';
import { resolve } from 'path';

interface ContractPdfUrlOptions {
  appUrl?: string | null | undefined;
  appPort?: string | number | null | undefined;
  cwd?: string | undefined;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const looksLikeAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const hasLocalHttpsCertificates = (cwd: string): boolean => {
  const candidateRoots = [cwd, resolve(cwd, 'server')];
  return candidateRoots.some((root) => {
    const privateKey = resolve(root, 'secrets', 'private-key.pem');
    const certificate = resolve(root, 'secrets', 'public-certificate.pem');
    return existsSync(privateKey) && existsSync(certificate);
  });
};

export const resolveContractPdfBaseUrl = (
  options: ContractPdfUrlOptions = {},
): string => {
  const configuredAppUrl =
    options.appUrl?.toString().trim() || process.env.APP_URL?.trim() || null;
  if (configuredAppUrl) {
    return trimTrailingSlash(configuredAppUrl);
  }

  const port =
    options.appPort?.toString().trim() ||
    process.env.APP_PORT?.trim() ||
    '3000';
  const cwd = options.cwd || process.cwd();
  const protocol = hasLocalHttpsCertificates(cwd) ? 'https' : 'http';
  return `${protocol}://localhost:${port}`;
};

export const buildContractPdfUrl = (
  contractId: string,
  options: ContractPdfUrlOptions = {},
): string => {
  return `${resolveContractPdfBaseUrl(options)}/contracts/${contractId}/pdf`;
};

export const normalizeContractPdfUrl = (
  contractId: string,
  storedUrl: string | null | undefined,
  options: ContractPdfUrlOptions = {},
): string => {
  const canonicalUrl = buildContractPdfUrl(contractId, options);
  const rawValue = storedUrl?.trim();

  if (!rawValue) {
    return canonicalUrl;
  }

  const canonicalPathPattern = /^\/?contracts\/([^/]+)\/pdf\/?$/i;
  const legacyPlaceholderPattern = /^contracts\/[^/]+\.pdf$/i;

  const absoluteBackendMatch = rawValue.match(
    /^https?:\/\/[^/]+\/contracts\/([^/]+)\/pdf\/?$/i,
  );
  if (absoluteBackendMatch) {
    return absoluteBackendMatch[1] === contractId ? trimTrailingSlash(rawValue) : canonicalUrl;
  }

  if (looksLikeAbsoluteHttpUrl(rawValue)) {
    return rawValue;
  }

  const pathMatch = rawValue.match(canonicalPathPattern);
  if (pathMatch) {
    return pathMatch[1] === contractId ? canonicalUrl : canonicalUrl;
  }

  if (legacyPlaceholderPattern.test(rawValue)) {
    return canonicalUrl;
  }

  return canonicalUrl;
};
