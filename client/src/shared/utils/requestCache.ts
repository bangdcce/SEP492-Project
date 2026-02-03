type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

const nowMs = () => Date.now();

export const getCachedValue = <T>(key: string): T | undefined => {
  const entry = cacheStore.get(key);
  if (!entry || entry.expiresAt <= nowMs()) {
    return undefined;
  }
  return entry.value as T;
};

export const setCachedValue = <T>(key: string, value: T, ttlMs: number) => {
  cacheStore.set(key, { value, expiresAt: nowMs() + ttlMs });
};

export const cachedFetch = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> => {
  const entry = cacheStore.get(key);
  if (entry?.value !== undefined && entry.expiresAt > nowMs()) {
    return entry.value as T;
  }
  if (entry?.inFlight) {
    return entry.inFlight as Promise<T>;
  }

  const request = fetcher()
    .then((value) => {
      cacheStore.set(key, { value, expiresAt: nowMs() + ttlMs });
      return value;
    })
    .catch((error) => {
      cacheStore.delete(key);
      throw error;
    });

  cacheStore.set(key, { ...entry, inFlight: request, expiresAt: nowMs() + ttlMs });
  return request;
};

export const invalidateCacheByPrefix = (prefix: string) => {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};
