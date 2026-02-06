import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';

export interface UserSearchFilters {
  role?: UserRole;
  search?: string; // Name or Email
  skills?: string[]; // List of skill IDs or names
  minRating?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class UsersSearchService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ProfileEntity)
    private readonly profileRepo: Repository<ProfileEntity>,
    @InjectRepository(UserSkillEntity)
    private readonly userSkillRepo: Repository<UserSkillEntity>,
  ) {}

  async searchUsers(filters: UserSearchFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.userSkills', 'userSkill') // Assuming relation exists or will be added
      .leftJoinAndSelect('userSkill.skill', 'skill')
      .where('user.isBanned = :isBanned', { isBanned: false })
      .andWhere('user.isVerified = :isVerified', { isVerified: true });

    if (filters.role) {
      query.andWhere('user.role = :role', { role: filters.role });
    } else {
        // Default to finding Brokers and Freelancers if no role specified, or allow all?
        // Usually Discovery is for Partners.
        query.andWhere('user.role IN (:...roles)', { roles: [UserRole.BROKER, UserRole.FREELANCER] });
    }

    if (filters.search) {
      query.andWhere(new Brackets(qb => {
        qb.where('user.fullName ILIKE :search', { search: `%${filters.search}%` })
          .orWhere('profile.bio ILIKE :search', { search: `%${filters.search}%` });
      }));
    }

    if (filters.minRating) {
      query.andWhere('user.currentTrustScore >= :minRating', { minRating: filters.minRating });
    }

    // Skills filtering is complex on many-to-many.
    // For now simple approach: if user has ANY of the skills.
    // Ideally we want users who have ALL skills or at least some.
    // Let's implement ANY for now.
    if (filters.skills && filters.skills.length > 0) {
        // This logic might need refinement for "ALL" skills
        // For now, check if user has at least one matching skill
         query.innerJoin('user.userSkills', 'filterSkill')
              .innerJoin('filterSkill.skill', 's')
              .andWhere('s.name IN (:...skills)', { skills: filters.skills });
         // Distinct bc multiple skills might match same user
         query.distinct(true); 
    }

    query.skip(skip).take(limit);
    
    // Order by Trust Score desc by default
    query.orderBy('user.currentTrustScore', 'DESC');

    const [users, total] = await query.getManyAndCount();

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPublicProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, isBanned: false },
      relations: [
        'profile', 
        'userSkills', 
        'userSkills.skill', 
        // Add other relations like portfolio, reviews if needed
      ]
    });

    if (!user) return null;

    // Sanitize? 
    // We can rely on @Exclude in Entity or just return what's safe.
    // UserEntity has passwordHash but it shouldn't be serialized if we use ClassSerializerInterceptor, 
    // but explicit DTO mapping is better. For now returning entity.
    return user;
  }
}
