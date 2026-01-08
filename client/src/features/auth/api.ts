/**
 * Auth Feature - API Service
 */
import { apiClient } from '@/shared/api/client';
import type {
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from './types';

/**
 * Sign in with email and password
 */
export const signIn = async (data: SignInRequest): Promise<SignInResponse> => {
  return await apiClient.post<SignInResponse>('/auth/login', data);
};

/**
 * Sign up new user
 */
export const signUp = async (data: SignUpRequest): Promise<SignUpResponse> => {
  return await apiClient.post<SignUpResponse>('/auth/register', data);
};

/**
 * Request OTP for password reset
 */
export const forgotPassword = async (
  data: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> => {
  return await apiClient.post<ForgotPasswordResponse>(
    '/auth/forgot-password',
    data
  );
};

/**
 * Verify OTP code
 */
export const verifyOtp = async (
  data: VerifyOtpRequest
): Promise<VerifyOtpResponse> => {
  return await apiClient.post<VerifyOtpResponse>(
    '/auth/verify-otp',
    data
  );
};

/**
 * Reset password with verified OTP
 */
export const resetPassword = async (
  data: ResetPasswordRequest
): Promise<ResetPasswordResponse> => {
  return await apiClient.post<ResetPasswordResponse>(
    '/auth/reset-password',
    data
  );
};

/**
 * Refresh access token
 */
export const refreshToken = async (refreshToken: string): Promise<{ accessToken: string }> => {
  return await apiClient.post<{ accessToken: string }>(
    '/auth/refresh',
    { refreshToken }
  );
};

/**
 * Sign out (optional - for server-side logout)
 */
export const signOut = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};
