/**
 * Auth Feature - API Service
 */
import { apiClient } from "@/shared/api/client";
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
  Certification,
} from "./types";

/**
 * Sign in with email and password
 */
export const signIn = async (data: SignInRequest): Promise<SignInResponse> => {
  return await apiClient.post<SignInResponse>("/auth/login", data);
};

/**
 * Sign up new user
 */
export const signUp = async (data: SignUpRequest): Promise<SignUpResponse> => {
  return await apiClient.post<SignUpResponse>("/auth/register", data);
};

/**
 * Request OTP for password reset
 */
export const forgotPassword = async (
  data: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> => {
  return await apiClient.post<ForgotPasswordResponse>(
    "/auth/forgot-password",
    data,
  );
};

/**
 * Verify OTP code
 */
export const verifyOtp = async (
  data: VerifyOtpRequest,
): Promise<VerifyOtpResponse> => {
  return await apiClient.post<VerifyOtpResponse>("/auth/verify-otp", data);
};

/**
 * Reset password with verified OTP
 */
export const resetPassword = async (
  data: ResetPasswordRequest,
): Promise<ResetPasswordResponse> => {
  return await apiClient.post<ResetPasswordResponse>(
    "/auth/reset-password",
    data,
  );
};

/**
 * Refresh access token
 */
export const refreshToken = async (): Promise<{
  message: string;
  data: Record<string, never>;
}> => {
  return await apiClient.post<{ message: string; data: Record<string, never> }>(
    "/auth/refresh",
  );
};

/**
 * Sign out (optional - for server-side logout)
 */
export const signOut = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};

/**
 * Get user profile
 */
export const getProfile = async () => {
  return await apiClient.get("/auth/profile");
};

/**
 * Get authenticated session snapshot
 */
export const getSession = async () => {
  return await apiClient.get("/auth/session");
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
  certifications?: Certification[];
  companyName?: string;
  linkedinUrl?: string;
  cvUrl?: string;
  timeZone?: string;
}) => {
  return await apiClient.put("/auth/profile", data);
};

/**
 * Verify email with token from email link
 */
export const verifyEmail = async (
  token: string,
): Promise<{ message: string; email: string }> => {
  return await apiClient.get<{ message: string; email: string }>(
    `/auth/verify-email?token=${token}`,
  );
};

/**
 * Resend verification email
 */
export const resendVerificationEmail = async (
  email: string,
): Promise<{ message: string }> => {
  return await apiClient.post<{ message: string }>(
    "/auth/resend-verification",
    { email },
  );
};

/**
 * Check active obligations before account deletion
 */
export const checkObligations = async (): Promise<{
  hasObligations: boolean;
  activeProjects: number;
  walletBalance: number;
}> => {
  return await apiClient.get<{
    hasObligations: boolean;
    activeProjects: number;
    walletBalance: number;
  }>("/auth/check-obligations");
};

/**
 * Delete user account
 */
export const deleteAccount = async (
  password: string,
): Promise<{ message: string }> => {
  return await apiClient.post<{ message: string }>("/auth/delete-account", {
    password,
  });
};

/**
 * Upload CV (PDF or DOCX, max 5MB)
 */
export const uploadCV = async (
  file: File,
): Promise<{ cvUrl: string; message: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  return await apiClient.post<{ cvUrl: string; message: string }>(
    "/profile/cv",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
};

/**
 * Get CV download URL
 */
export const getCV = async (): Promise<{ cvUrl: string | null }> => {
  return await apiClient.get<{ cvUrl: string | null }>("/profile/cv");
};

/**
 * Delete CV
 */
export const deleteCV = async (): Promise<{ message: string }> => {
  return await apiClient.delete<{ message: string }>("/profile/cv");
};

/**
 * Update bio (max 1000 characters)
 */
export const updateBio = async (bio: string): Promise<{ message: string }> => {
  return await apiClient.patch<{ message: string }>("/profile/bio", { bio });
};

/**
 * Get user skills (with full details)
 */
export const getUserSkills = async (): Promise<{
  skills: {
    id: string;
    skillId: string;
    skillName: string;
    skillSlug: string;
    skillCategory: string;
    priority: "PRIMARY" | "SECONDARY";
    verificationStatus: string;
    proficiencyLevel: number | null;
    yearsOfExperience: number | null;
    portfolioUrl: string | null;
    completedProjectsCount: number;
    lastUsedAt: string | null;
  }[];
}> => {
  return await apiClient.get("/profile/skills");
};

/**
 * Update user skills
 */
export const updateUserSkills = async (
  skillIds: string[],
): Promise<{ message: string }> => {
  return await apiClient.put<{ message: string }>("/profile/skills", {
    skillIds,
  });
};

export const getSigningCredentialStatus = async (): Promise<{
  initialized: boolean;
  keyFingerprint?: string;
  keyAlgorithm?: string;
  keyVersion?: number;
  lockedUntil?: string | null;
  rotatedAt?: string | null;
  createdAt?: string | null;
}> => {
  return await apiClient.get("/profile/signing-credentials/status");
};

export const initializeSigningCredential = async (
  pin: string,
  modulusLength?: 2048 | 4096,
): Promise<{
  initialized: boolean;
  keyFingerprint?: string;
  keyAlgorithm?: string;
  keyVersion?: number;
}> => {
  return await apiClient.post("/profile/signing-credentials/initialize", {
    pin,
    modulusLength,
  });
};

export const rotateSigningCredential = async (
  oldPin: string,
  newPin: string,
  modulusLength?: 2048 | 4096,
): Promise<{
  initialized: boolean;
  keyFingerprint?: string;
  keyAlgorithm?: string;
  keyVersion?: number;
}> => {
  return await apiClient.post("/profile/signing-credentials/rotate", {
    oldPin,
    newPin,
    modulusLength,
  });
};
