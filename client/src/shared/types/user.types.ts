export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  BROKER = 'BROKER',
  CLIENT = 'CLIENT',
  FREELANCER = 'FREELANCER',
}

export interface UserProfile {
    avatarUrl?: string;
    bio?: string;
    skills?: string[];
    portfolioLinks?: { title: string; url: string }[];
}

export interface User {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isVerified: boolean;
    currentTrustScore: number;
    createdAt: string;
    profile?: UserProfile;
    userSkills?: any[];
}
