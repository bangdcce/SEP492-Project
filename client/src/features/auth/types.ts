/**
 * Auth Feature - Type Definitions
 */

export type UserRole = 'client' | 'broker' | 'freelancer' | 'admin' | 'ADMIN' | 'CLIENT' | 'BROKER' | 'FREELANCER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  businessName?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioLink {
  title: string;
  url: string;
}

// ============================================
// Sign In
// ============================================
export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ============================================
// Sign Up
// ============================================
export interface SignUpRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  recaptchaToken?: string;
}

export interface SignUpResponse {
  message: string;
  user: User;
}

// ============================================
// Forgot Password Flow
// ============================================
export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  message: string;
  data: {
    message: string;
    isValid: boolean;
  };
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// ============================================
// Auth State
// ============================================
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
