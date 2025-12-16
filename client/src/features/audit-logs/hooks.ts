import { useState, useEffect, useCallback, useRef } from "react";
import { auditLogsApi } from "./api";
import type { AuditLog, AuditLogFilters, AuditLogListResponse } from "./types";

/**
 * Hook to fetch audit logs with filters and pagination
 * Handles StrictMode double-render by using AbortController
 */
export function useAuditLogs(initialFilters?: AuditLogFilters) {
  const [data, setData] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<AuditLogListResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>(
    initialFilters || { page: 1, limit: 20 }
  );

  // Track if component is mounted
  const isMounted = useRef(true);

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await auditLogsApi.getAll(filters, signal);
        // Only update state if still mounted
        if (isMounted.current) {
          setData(response.data);
          setMeta(response.meta);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (isMounted.current) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch audit logs")
          );
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [filters]
  );

  useEffect(() => {
    isMounted.current = true;
    const abortController = new AbortController();

    fetchLogs(abortController.signal);

    // Cleanup: abort request and mark as unmounted
    return () => {
      isMounted.current = false;
      abortController.abort();
    };
  }, [fetchLogs]);

  const updateFilters = (newFilters: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const goToPage = (page: number) => {
    updateFilters({ page });
  };

  const refresh = () => {
    const abortController = new AbortController();
    fetchLogs(abortController.signal);
  };

  return {
    data,
    meta,
    loading,
    error,
    filters,
    updateFilters,
    goToPage,
    refresh,
  };
}

/**
 * Hook to fetch a single audit log by ID
 */
export function useAuditLog(id: number) {
  const [data, setData] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    if (!id) return;

    isMounted.current = true;
    const abortController = new AbortController();

    setLoading(true);
    auditLogsApi
      .getById(id, abortController.signal)
      .then((result) => {
        if (isMounted.current) {
          setData(result);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (isMounted.current) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch audit log")
          );
        }
      })
      .finally(() => {
        if (isMounted.current) {
          setLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
      abortController.abort();
    };
  }, [id]);

  return { data, loading, error };
}
