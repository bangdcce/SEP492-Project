import api from '@/lib/axiosClient';
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
  userSkills?: any[]; // Simplified for now
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

    const response = await api.get(`/discovery/users?${params.toString()}`);
    return response.data;
  },

  getPublicProfile: async (id: string): Promise<UserProfilePublic> => {
    const response = await api.get(`/discovery/profile/${id}`);
    return response.data;
  },
  
  // Invitation Methods
  inviteBroker: async (requestId: string, brokerId: string, message?: string) => {
    const response = await api.post(`/project-requests/${requestId}/invite/broker`, {
      brokerId,
      message,
    });
    return response.data;
  },

  inviteFreelancer: async (requestId: string, freelancerId: string, message?: string) => {
    const response = await api.post(`/project-requests/${requestId}/invite/freelancer`, {
       freelancerId,
       message,
    });
    return response.data;
  },

  getMyInvitations: async () => {
    const response = await api.get('/project-requests/invitations/my');
    return response.data;
  }
};
