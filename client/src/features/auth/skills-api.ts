/**
 * Skills & Domains API (Public endpoints)
 */
import { apiClient } from '@/shared/api/client';

export interface SkillDomain {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category: string;
}

/**
 * Get list of skill domains for registration
 */
export const getSkillDomains = async (): Promise<SkillDomain[]> => {
  const response = await apiClient.get<{ success: boolean; data: SkillDomain[] }>(
    'public/skills/domains'
  );
  return response.data;
};

/**
 * Get list of skills for registration
 * @param role - Filter by role (FREELANCER or BROKER)
 */
export const getSkills = async (role?: 'FREELANCER' | 'BROKER'): Promise<Skill[]> => {
  const params = role ? { role } : {};
  const response = await apiClient.get<{ success: boolean; data: Skill[] }>(
    'public/skills/skills',
    { params }
  );
  return response.data;
};
