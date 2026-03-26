import axios from "axios";
import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { API_CONFIG, ROUTES, STORAGE_KEYS } from "@/constants";
import {
  getStoredJson,
  removeStoredItem,
  setStoredJsonAuto,
} from "@/shared/utils/storage";
import { tokenRefreshManager } from "./token-refresh-manager";

const TRACE_SESSION_KEY = "interdev-trace-session-id";

const generateTraceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getBrowserSessionId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(TRACE_SESSION_KEY);
  if (cached) {
    return cached;
  }

  const created = generateTraceId();
  window.sessionStorage.setItem(TRACE_SESSION_KEY, created);
  return created;
};

type InternalRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
  _suppressAuthFailureRedirect?: boolean;
};

/**
 * API Client - Centralized Axios instance with interceptors
 */
class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<void> | null = null;
  private sessionReconcilePromise: Promise<void> | null = null;
  private isRedirectingToLogin = false;
  private lastLoginTime: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true, // Enable sending cookies with requests
    });

    this.setupInterceptors();

    // Listen for login events to track last login time
    if (typeof window !== 'undefined') {
      window.addEventListener('userLoggedIn', () => {
        this.lastLoginTime = Date.now();
      });
    }
  }

  private setupInterceptors() {
    // Request interceptor - add timezone header
    this.client.interceptors.request.use(
      (config) => {
        if (typeof FormData !== "undefined" && config.data instanceof FormData) {
          config.headers = config.headers ?? {};

          // Let the browser/XHR set multipart boundary automatically for FormData payloads.
          if (typeof (config.headers as { delete?: (name: string) => void }).delete === "function") {
            (config.headers as { delete: (name: string) => void }).delete("Content-Type");
          } else {
            delete (config.headers as Record<string, unknown>)["Content-Type"];
            delete (config.headers as Record<string, unknown>)["content-type"];
          }
        }

        // Token is now sent automatically via httpOnly cookie
        // No need to manually add Authorization header
        if (typeof Intl !== "undefined") {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) {
            config.headers = config.headers ?? {};
            (config.headers as Record<string, string>)["X-Timezone"] = tz;
          }
        }

        config.headers = config.headers ?? {};
        if (!(config.headers as Record<string, string>)["X-Request-Id"]) {
          (config.headers as Record<string, string>)["X-Request-Id"] = generateTraceId();
        }

        const sessionId = getBrowserSessionId();
        if (sessionId) {
          (config.headers as Record<string, string>)["X-Session-Id"] = sessionId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const originalRequest = (error.config || {}) as InternalRequestConfig;

        if (
          status !== 401 ||
          originalRequest._skipAuthRefresh ||
          this.isPublicAuthEndpoint(originalRequest.url)
        ) {
          return Promise.reject(error);
        }

        if (this.isRefreshEndpoint(originalRequest.url)) {
          this.handleAuthFailure(Boolean(originalRequest._suppressAuthFailureRedirect));
          return Promise.reject(error);
        }

        if (originalRequest._retry) {
          this.handleAuthFailure(Boolean(originalRequest._suppressAuthFailureRedirect));
          return Promise.reject(error);
        }

        // Avoid refresh attempts immediately after login (cookies may not be fully set)
        const timeSinceLogin = Date.now() - this.lastLoginTime;
        const isRecentLogin = this.lastLoginTime > 0 && timeSinceLogin < 5000; // 5 seconds
        
        if (isRecentLogin) {
          // Simple retry without refresh - cookies should work on retry
          await new Promise(resolve => setTimeout(resolve, 200));
          originalRequest._retry = true;
          
          try {
            return await this.client.request(originalRequest);
          } catch (retryError) {
            // If still 401 after retry, fall through to normal refresh flow
          }
        }

        try {
          await this.refreshAccessTokenSingleFlight();
          originalRequest._retry = true;
          return await this.client.request(originalRequest);
        } catch (refreshError) {
          if (this.shouldAttemptSessionReconcile(refreshError)) {
            try {
              await this.reconcileSessionSingleFlight();
              originalRequest._retry = true;
              return await this.client.request(originalRequest);
            } catch {
              // Fall through to deterministic auth failure handling.
            }
          }
          this.handleAuthFailure(Boolean(originalRequest._suppressAuthFailureRedirect));
          return Promise.reject(refreshError);
        }
      }
    );
  }

  private isRefreshEndpoint(url?: string): boolean {
    if (!url) return false;
    return url.includes("/auth/refresh");
  }

  private isPublicAuthEndpoint(url?: string): boolean {
    if (!url) return false;
    const normalizedUrl = url.toLowerCase();
    const publicAuthPaths = [
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify-otp",
      "/auth/verify-email",
      "/auth/resend-verification",
    ];
    return publicAuthPaths.some((path) => normalizedUrl.includes(path));
  }

  private async refreshAccessTokenSingleFlight(): Promise<void> {
    if (!this.refreshPromise) {
      const refreshConfig: InternalRequestConfig = {
        _skipAuthRefresh: true,
      };

      this.refreshPromise = this.client
        .post("/auth/refresh", undefined, refreshConfig)
        .then(() => {
          return undefined;
        })
        .catch((error) => {
          throw error;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    await this.refreshPromise;
  }

  private getAuthErrorCode(error: unknown): string | null {
    const axiosError = error as AxiosError<{ error?: string }>;
    const code = axiosError?.response?.data?.error;
    return typeof code === "string" ? code : null;
  }

  private shouldAttemptSessionReconcile(error: unknown): boolean {
    const code = this.getAuthErrorCode(error);
    // Multi-tab refresh races can invalidate an older refresh token after another tab rotated it.
    return code === "INVALID_REFRESH" || code === "SESSION_REVOKED";
  }

  private async reconcileSessionSingleFlight(): Promise<void> {
    if (!this.sessionReconcilePromise) {
      const sessionConfig: InternalRequestConfig = {
        _skipAuthRefresh: true,
        _suppressAuthFailureRedirect: true,
        timeout: 8000,
      };

      this.sessionReconcilePromise = this.client
        .get<{ data?: Record<string, unknown> }>("/auth/session", sessionConfig)
        .then((response) => {
          const sessionUser = response?.data?.data;
          if (!sessionUser) {
            throw new Error("Session reconcile failed");
          }
          setStoredJsonAuto(STORAGE_KEYS.USER, sessionUser);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("userDataUpdated"));
          }
        })
        .finally(() => {
          this.sessionReconcilePromise = null;
        });
    }

    await this.sessionReconcilePromise;
  }

  private handleAuthFailure(suppressRedirect: boolean = false) {
    removeStoredItem(STORAGE_KEYS.USER);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("userDataUpdated"));
      const authPaths = new Set<string>([
        ROUTES.LOGIN,
        ROUTES.REGISTER,
        ROUTES.FORGOT_PASSWORD,
        ROUTES.VERIFY_EMAIL,
      ]);

      if (
        !suppressRedirect &&
        !authPaths.has(window.location.pathname) &&
        !this.isRedirectingToLogin
      ) {
        this.isRedirectingToLogin = true;
        window.location.assign(ROUTES.LOGIN);
      }
    }
  }

  public async bootstrapSession(): Promise<{
    isAuthenticated: boolean;
    user: Record<string, unknown> | null;
  }> {
    const cachedUser = getStoredJson<Record<string, unknown>>(STORAGE_KEYS.USER);
    try {
      const response = await this.get<{ message?: string; data?: Record<string, unknown> }>(
        "/auth/session",
        {
          _suppressAuthFailureRedirect: true,
          timeout: 8000,
        } as InternalRequestConfig,
      );
      const sessionUser = response?.data || null;

      if (sessionUser) {
        setStoredJsonAuto(STORAGE_KEYS.USER, sessionUser);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("userDataUpdated"));
        }
        return { isAuthenticated: true, user: sessionUser };
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError?.response?.status;

      if (!status || status >= 500) {
        return { isAuthenticated: Boolean(cachedUser), user: cachedUser ?? null };
      }

      // Session is invalid; fall through to clear stale storage.
    }

    if (cachedUser) {
      removeStoredItem(STORAGE_KEYS.USER);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("userDataUpdated"));
      }
    }
    return { isAuthenticated: false, user: null };
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  public async getResponse<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return await this.client.get<T>(url, config);
  }

  public async post<T = any>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(
      url,
      data,
      config
    );
    return response.data;
  }

  public async put<T = any>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  public async patch<T = any>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(
      url,
      data,
      config
    );
    return response.data;
  }

  /**
   * Start proactive token refresh
   * Call this when user is authenticated to prevent session interruptions
   */
  public startProactiveRefresh(): void {
    tokenRefreshManager.start(async () => {
      await this.refreshAccessTokenSingleFlight();
    });
  }

  /**
   * Stop proactive token refresh
   * Call this when user logs out
   */
  public stopProactiveRefresh(): void {
    tokenRefreshManager.stop();
  }
}

export const apiClient = new ApiClient();
