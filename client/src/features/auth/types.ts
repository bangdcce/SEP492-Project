/**
 * Auth Feature - Type Definitions
 */

export type UserRole =
  | 'client'
  | 'broker'
  | 'freelancer'
  | 'admin'
  | 'staff'
  | 'ADMIN'
  | 'CLIENT'
  | 'BROKER'
  | 'FREELANCER'
  | 'STAFF';

export type NonStaffSignUpRole = 'CLIENT' | 'BROKER' | 'FREELANCER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  timeZone?: string;
  businessName?: string;
  profilePicture?: string;
  staffApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  staffApplicationReviewedAt?: string | null;
  staffRejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioLink {
  title: string;
  url: string;
}

export interface Certification {
  id?: string;
  name: string;
  issuingOrganization: string;
  issueMonth: string;
  issueYear: string;
  credentialId?: string;
  credentialUrl: string;
  expirationMonth?: string;
  expirationYear?: string;
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
  role: NonStaffSignUpRole;
  recaptchaToken?: string;
  domainIds?: string[]; // UUID arrays instead of slugs
  skillIds?: string[]; // UUID arrays instead of slugs
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface StaffSignUpFormValues {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  recaptchaToken?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  fullNameOnDocument: string;
  documentType: string;
  documentNumber: string;
  dateOfBirth: string;
  address: string;
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
