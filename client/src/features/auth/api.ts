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
  PortfolioLink,
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

/**
 * Get user profile
 */
export const getProfile = async () => {
  return await apiClient.get('/auth/profile');
};

/**
 * Update user profile
 */
export const updateProfile = async (data: {
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  bio?: string;
  skills?: string[];
  portfolioLinks?: PortfolioLink[];
  companyName?: string;
  linkedinUrl?: string;
  cvUrl?: string;
  timeZone?: string;
}) => {
  return await apiClient.put('/auth/profile', data);
};

/**
 * Verify email with token from email link
 */
export const verifyEmail = async (token: string): Promise<{ message: string; email: string }> => {
  return await apiClient.get<{ message: string; email: string }>(
    `/auth/verify-email?token=${token}`
  );
};

/**
 * Resend verification email
 */
export const resendVerificationEmail = async (email: string): Promise<{ message: string }> => {
  return await apiClient.post<{ message: string }>('/auth/resend-verification', { email });
};
