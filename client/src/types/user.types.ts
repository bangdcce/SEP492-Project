/**
 * User Types
 */


export type UserRole = 'ADMIN' | 'STAFF' | 'BROKER' | 'CLIENT' | 'FREELANCER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phoneNumber?: string;
  isVerified: boolean;
  currentTrustScore: number;
  createdAt: string;
  updatedAt: string;
  // Có thể bổ sung thêm các quan hệ nếu cần: profile, socialAccounts, ...
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
