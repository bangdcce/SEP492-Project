import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";

/**
 * API Client - Centralized Axios instance with interceptors
 */
class ApiClient {
  private client: AxiosInstance;

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
  }

  private setupInterceptors() {
    // Request interceptor - add timezone header
    this.client.interceptors.request.use(
      (config) => {
        // Token is now sent automatically via httpOnly cookie
        // No need to manually add Authorization header
        if (typeof Intl !== "undefined") {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) {
            (config.headers as any)["X-Timezone"] = tz;
          }
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
      async (error) => {
        // TODO: [DEV] Auth disabled for testing - Re-enable before production
        // if (error.response?.status === 401) {
        //   // Token in cookie is invalid or expired, redirect to login
        //   window.location.href = "/login";
        // }
        console.warn("[DEV] API Error:", error.response?.status, error.message);

        return Promise.reject(error);
      }
    );
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  public async post<T>(
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

  public async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  public async patch<T>(
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
}

export const apiClient = new ApiClient();
