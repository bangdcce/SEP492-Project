import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { DisputeEntity, DisputeStatus } from '../../database/entities/dispute.entity';

// Response type with enriched dispute info
export interface ProjectWithDisputeInfo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  clientId: string;
  brokerId: string;
  freelancerId: string | null;
  totalBudget: number;
  createdAt: Date;
  // Dispute enrichment
  hasActiveDispute: boolean;
  activeDisputeCount: number;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
  ) {}

  /**
   * List projects for a user with dispute status enrichment
   * Returns projects where user is client, broker, or freelancer
   * Enriched with hasActiveDispute and activeDisputeCount
   */
  async listByUser(userId: string): Promise<ProjectWithDisputeInfo[]> {
    // Step 1: Fetch base projects
    const projects = await this.projectRepository.find({
      where: [{ clientId: userId }, { brokerId: userId }, { freelancerId: userId }],
      select: [
        'id',
        'title',
        'description',
        'status',
        'clientId',
        'brokerId',
        'freelancerId',
        'totalBudget',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });

    if (projects.length === 0) {
      return [];
    }

    // Step 2: Fetch active disputes for all projects in one query
    const projectIds = projects.map((p) => p.id);
    const activeDisputeStatuses = [DisputeStatus.OPEN, DisputeStatus.IN_MEDIATION, DisputeStatus.APPEALED];

    const disputeCounts = await this.disputeRepository
      .createQueryBuilder('dispute')
      .select('dispute.projectId', 'projectId')
      .addSelect('COUNT(dispute.id)', 'count')
      .where('dispute.projectId IN (:...projectIds)', { projectIds })
      .andWhere('dispute.status IN (:...statuses)', { statuses: activeDisputeStatuses })
      .groupBy('dispute.projectId')
      .getRawMany<{ projectId: string; count: string }>();

    // Step 3: Create a map for quick lookup
    const disputeCountMap = new Map<string, number>();
    for (const dc of disputeCounts) {
      disputeCountMap.set(dc.projectId, parseInt(dc.count, 10));
    }

    this.logger.debug(`Found ${disputeCounts.length} projects with active disputes`);

    // Step 4: Enrich projects with dispute info
    const enrichedProjects: ProjectWithDisputeInfo[] = projects.map((project) => {
      const activeDisputeCount = disputeCountMap.get(project.id) || 0;
      return {
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        clientId: project.clientId,
        brokerId: project.brokerId,
        freelancerId: project.freelancerId,
        totalBudget: Number(project.totalBudget),
        createdAt: project.createdAt,
        hasActiveDispute: activeDisputeCount > 0,
        activeDisputeCount,
      };
    });

    return enrichedProjects;
  }
}
