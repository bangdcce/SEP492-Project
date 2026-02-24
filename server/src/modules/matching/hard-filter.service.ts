import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { EligibleCandidate, SkillMatch } from './interfaces/match.interfaces';

@Injectable()
export class HardFilterService {
  private readonly logger = new Logger(HardFilterService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Layer 1: Deterministic Sieve
   * Filters out freelancers who are ineligible based on identity, availability, and status.
   * Uses a two-step approach:
   *   Step 1: Raw query to get IDs of users who pass all filters including active project count.
   *   Step 2: Load full entities with relations for the filtered IDs.
   */
  async filterEligibleCandidates(
    requestId: string,
    role: 'FREELANCER' | 'BROKER' = 'FREELANCER',
    options?: {
      requireKyc?: boolean;
      maxActiveProjects?: number;
    },
  ): Promise<EligibleCandidate[]> {
    const requireKyc = options?.requireKyc ?? true;
    const maxActiveProjects = options?.maxActiveProjects ?? 3;

    this.logger.debug(
      `Running Hard Filter for Request ${requestId} (role: ${role}, requireKyc: ${requireKyc}, maxProjects: ${maxActiveProjects})`,
    );

    const roleForeignKey = role === 'BROKER' ? '"brokerId"' : '"freelancerId"';
    const proposalsTable = role === 'BROKER' ? 'broker_proposals' : 'project_request_proposals';

    // ── Step 1: Get eligible user IDs using raw aggregate query ──
    // TypeORM's getMany() doesn't support HAVING with aggregates properly,
    // so we use getRawMany() first to get IDs, then load full entities.
    let rawQuery = `
      SELECT u.id AS "userId", COUNT(proj.id) AS "activeProjectCount"
      FROM users u
      LEFT JOIN projects proj
        ON proj.${roleForeignKey} = u.id
        AND proj.status IN ('INITIALIZING', 'PLANNING', 'IN_PROGRESS', 'TESTING', 'DISPUTED')
      WHERE u.role = $3
        AND u.status = 'ACTIVE'
        AND u."isBanned" = false
        AND u.id NOT IN (
          SELECT ${roleForeignKey} FROM ${proposalsTable}
          WHERE "requestId" = $1
        )
    `;
    const params: any[] = [requestId, maxActiveProjects, role];

    if (requireKyc) {
      rawQuery += ` AND u."isVerified" = true`;
    }

    rawQuery += ` GROUP BY u.id HAVING COUNT(proj.id) < $2`;

    const eligibleRows: { userId: string; activeProjectCount: string }[] =
      await this.userRepo.query(rawQuery, params);

    if (eligibleRows.length === 0) {
      this.logger.debug('Hard Filter: No eligible candidates found.');
      return [];
    }

    const eligibleIds = eligibleRows.map((r) => r.userId);
    const countsMap = new Map<string, number>(
      eligibleRows.map((r) => [r.userId, parseInt(r.activeProjectCount, 10) || 0]),
    );

    // ── Step 2: Load full entities with relations for the eligible IDs ──
    const users = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.profile', 'p')
      .leftJoinAndSelect('u.userSkills', 'us')
      .leftJoinAndSelect('us.skill', 's')
      .where('u.id IN (:...eligibleIds)', { eligibleIds })
      .getMany();

    // ── Step 3: Map to EligibleCandidate interface ──
    const candidates: EligibleCandidate[] = users.map((user) => {
      const skills: SkillMatch[] = (user.userSkills || []).map((us: any) => ({
        skillName: us.skill?.name || '',
        skillSlug: us.skill?.slug || '',
        aliases: this.parseAliases(us.skill?.aliases),
        category: us.skill?.category || '',
        priority: us.priority as 'PRIMARY' | 'SECONDARY',
        proficiencyLevel: us.proficiencyLevel ?? null,
        yearsOfExperience: us.yearsOfExperience ?? null,
        verificationStatus: us.verificationStatus || 'SELF_DECLARED',
        isMatch: false, // Set to true in Layer 2
      }));

      return {
        userId: user.id,
        fullName: user.fullName,
        bio: user.profile?.bio || '',
        rawProfileSkills: user.profile?.skills || [],
        skills,
        trustScore: Number(user.currentTrustScore) || 0,
        kycStatus: user.isVerified ? ('VERIFIED' as const) : ('UNVERIFIED' as const),
        activeProjectCount: countsMap.get(user.id) || 0,
        disputesLost: user.totalDisputesLost || 0,
        totalProjectsFinished: user.totalProjectsFinished || 0,
      };
    });

    this.logger.debug(`Hard Filter passed ${candidates.length} eligible candidates.`);
    return candidates;
  }

  private parseAliases(aliases: any): string[] {
    if (!aliases) return [];
    if (Array.isArray(aliases)) return aliases;
    if (typeof aliases === 'string') {
      try {
        return JSON.parse(aliases);
      } catch {
        // simple-array format: "React,React.js"
        return aliases.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }
}
