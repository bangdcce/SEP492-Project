import { apiClient } from '@/shared/api/client';
import { UserRole } from '@/shared/types/user.types';

export interface UserSearchFilters {
  role?: UserRole;
  search?: string;
  skills?: string[];
  minRating?: number;
  page?: number;
  limit?: number;
}

export interface UserProfilePublic {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  currentTrustScore: number;
  createdAt: string;
  profile: {
    avatarUrl?: string;
    bio?: string;
    skills?: string[];
    portfolioLinks?: any[];
  };
  userSkills?: Array<{
    id: string;
    priority?: 'PRIMARY' | 'SECONDARY' | string;
    yearsOfExperience?: number | null;
    completedProjectsCount?: number | null;
    proficiencyLevel?: number | null;
    verificationStatus?: string;
    skill?: {
      id: string;
      name: string;
      slug?: string;
    } | null;
  }>;
}

export const discoveryApi = {
  searchUsers: async (filters: UserSearchFilters) => {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.search) params.append('search', filters.search);
    if (filters.skills && filters.skills.length) params.append('skills', filters.skills.join(','));
    if (filters.minRating) params.append('minRating', String(filters.minRating));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    return await apiClient.get(`/discovery/users?${params.toString()}`);
  },

  getPublicProfile: async (id: string): Promise<UserProfilePublic> => {
    return await apiClient.get(`/discovery/profile/${id}`);
  },
  
  // Invitation Methods
  inviteBroker: async (requestId: string, brokerId: string, message?: string) => {
    return await apiClient.post(`/project-requests/${requestId}/invite/broker`, {
      brokerId,
      message,
    });
  },

  inviteFreelancer: async (requestId: string, freelancerId: string, message?: string) => {
    return await apiClient.post(`/project-requests/${requestId}/invite/freelancer`, {
       freelancerId,
       message,
    });
  },

  getMyInvitations: async () => {
    return await apiClient.get('/project-requests/invitations/my');
  },

  respondToInvitation: async (invitationId: string, status: 'ACCEPTED' | 'REJECTED') => {
    return await apiClient.patch(`/project-requests/invitations/${invitationId}/respond`, {
      status,
    });
  }
};
