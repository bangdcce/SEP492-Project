import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';

export interface HardFilterInput {
  requestId: string;
  excludeUserIds?: string[];
}

export interface HardFilterSkill {
  name: string;
  slug: string;
  aliases: string[];
  domainId: string | null;
  domainName: string | null;
  domainSlug: string | null;
  isPrimary: boolean;
  yearsExp: number;
  completedProjectsCount: number;
  lastUsedAt: Date | null;
  verificationStatus: string | null;
}

export interface HardFilterDomain {
  id: string | null;
  name: string;
  slug: string;
}

export interface HardFilterResult {
  candidateId: string;
  fullName: string;
  skills: HardFilterSkill[];
  rawProfileSkills: string[];
  domains: HardFilterDomain[];
  bio: string;
  trustScore: number;
  completedProjects: number;
  candidateProfile: any;
}

@Injectable()
export class HardFilterService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private buildCandidateDomains(user: UserEntity): HardFilterDomain[] {
    const domainMap = new Map<string, HardFilterDomain>();

    for (const userSkill of user.userSkills || []) {
      const skillDomain = userSkill?.skill?.domain;
      const domainId = String(
        skillDomain?.id || skillDomain?.slug || skillDomain?.name || '',
      ).trim();
      const domainSlug = String(skillDomain?.slug || '').trim();
      const domainName = String(skillDomain?.name || '').trim();

      if (!domainId || !domainSlug || !domainName) {
        continue;
      }

      domainMap.set(domainId, {
        id: String(skillDomain.id || ''),
        name: domainName,
        slug: domainSlug,
      });
    }

    for (const userDomain of (user as any).userSkillDomains || []) {
      const domain = userDomain?.domain;
      const domainId = String(domain?.id || domain?.slug || domain?.name || '').trim();
      const domainSlug = String(domain?.slug || '').trim();
      const domainName = String(domain?.name || '').trim();

      if (!domainId || !domainSlug || !domainName) {
        continue;
      }

      domainMap.set(domainId, {
        id: String(domain.id || ''),
        name: domainName,
        slug: domainSlug,
      });
    }

    return [...domainMap.values()];
  }

  async filter(
    input: HardFilterInput,
    options: { role: 'BROKER' | 'FREELANCER' },
  ): Promise<HardFilterResult[]> {
    const role = options.role === 'BROKER' ? UserRole.BROKER : UserRole.FREELANCER;

    const whereClause: any = { role, status: UserStatus.ACTIVE };

    // Exclude already-invited users
    if (input.excludeUserIds && input.excludeUserIds.length > 0) {
      whereClause.id = Not(In(input.excludeUserIds));
    }

    const users = await this.userRepo.find({
      where: whereClause,
      relations: [
        'userSkills',
        'userSkills.skill',
        'userSkills.skill.domain',
        'userSkillDomains',
        'userSkillDomains.domain',
        'profile',
      ],
    });

    // Hard filter: remove banned users
    const eligible = users.filter((u) => u.isBanned !== true);

    return eligible.map((u) => {
      const profile = (u as any).profile;
      const rawProfileSkills = Array.isArray(profile?.skills)
        ? profile.skills
            .map((skill: unknown) => String(skill || '').trim())
            .filter((skill: string) => skill.length > 0)
        : [];
      const domains = this.buildCandidateDomains(u);

      return {
        candidateId: u.id,
        fullName: u.fullName || u.email || 'Unknown',
        skills: (u.userSkills || []).map((us: any) => ({
          name: us.skill?.name || us.skillName || '',
          slug: us.skill?.slug || '',
          aliases: Array.isArray(us.skill?.aliases) ? us.skill.aliases : [],
          domainId: us.skill?.domain?.id || us.skill?.domainId || null,
          domainName: us.skill?.domain?.name || null,
          domainSlug: us.skill?.domain?.slug || null,
          isPrimary: String(us.priority || '').toUpperCase() === 'PRIMARY',
          yearsExp: us.yearsOfExperience ?? 0,
          completedProjectsCount: us.completedProjectsCount ?? 0,
          lastUsedAt: us.lastUsedAt ?? null,
          verificationStatus: us.verificationStatus ?? null,
        })),
        rawProfileSkills,
        domains,
        bio: profile?.bio || '',
        trustScore: Number(u.currentTrustScore) || 0,
        completedProjects: u.totalProjectsFinished || 0,
        candidateProfile: {
          companyName: profile?.companyName || null,
          portfolioLinks: profile?.portfolioLinks || [],
          bio: profile?.bio || '',
          domains: domains.map((domain) => domain.name),
        },
      };
    });
  }
}
