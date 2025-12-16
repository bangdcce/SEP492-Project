import { apiClient } from "@/shared/api/client";
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
} from "./types";

/**
 * Auth API Endpoints
 */
const ENDPOINTS = {
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  LOGOUT: "/auth/logout",
  REFRESH: "/auth/refresh",
  ME: "/auth/me",
};

/**
 * Auth API Service
 */
export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>(ENDPOINTS.LOGIN, payload),

  register: (payload: RegisterPayload) =>
    apiClient.post<AuthResponse>(ENDPOINTS.REGISTER, payload),

  logout: () => apiClient.post<void>(ENDPOINTS.LOGOUT),

  refreshToken: (refreshToken: string) =>
    apiClient.post<AuthResponse>(ENDPOINTS.REFRESH, { refreshToken }),

  getMe: () => apiClient.get<User>(ENDPOINTS.ME),
};
