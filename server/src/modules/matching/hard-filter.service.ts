import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';

export interface HardFilterInput {
  requestId: string;
  excludeUserIds?: string[];
}

export interface HardFilterResult {
  candidateId: string;
  fullName: string;
  skills: { name: string; isPrimary: boolean; yearsExp: number }[];
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

  async filter(
    input: HardFilterInput,
    options: { role: 'BROKER' | 'FREELANCER' },
  ): Promise<HardFilterResult[]> {
    const role =
      options.role === 'BROKER' ? UserRole.BROKER : UserRole.FREELANCER;

    const whereClause: any = { role, status: UserStatus.ACTIVE };

    // Exclude already-invited users
    if (input.excludeUserIds && input.excludeUserIds.length > 0) {
      whereClause.id = Not(In(input.excludeUserIds));
    }

    const users = await this.userRepo.find({
      where: whereClause,
      relations: ['userSkills', 'userSkills.skill', 'profile'],
    });

    // Hard filter: remove banned users
    const eligible = users.filter((u) => u.isBanned !== true);

    return eligible.map((u) => {
      const profile = (u as any).profile;
      return {
        candidateId: u.id,
        fullName: u.fullName || u.email || 'Unknown',
        skills: (u.userSkills || []).map((us: any) => ({
          name: us.skill?.name || us.skillName || '',
          isPrimary: us.isPrimary ?? false,
          yearsExp: us.yearsOfExperience ?? 0,
        })),
        bio: profile?.bio || '',
        trustScore: Number(u.currentTrustScore) || 50,
        completedProjects: u.totalProjectsFinished || 0,
        candidateProfile: {
          companyName: profile?.companyName || null,
          portfolioLinks: profile?.portfolioLinks || [],
          bio: profile?.bio || '',
        },
      };
    });
  }
}
