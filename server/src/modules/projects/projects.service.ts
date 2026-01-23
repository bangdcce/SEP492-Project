import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { DisputeEntity, DisputeStatus } from '../../database/entities/dispute.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';

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

// Response type for milestone approval
export interface MilestoneApprovalResult {
  milestone: MilestoneEntity;
  previousStatus: MilestoneStatus;
  fundsReleased: boolean;
  message: string;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly auditLogsService: AuditLogsService,
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
    const activeDisputeStatuses = [
      DisputeStatus.OPEN,
      DisputeStatus.IN_MEDIATION,
      DisputeStatus.APPEALED,
    ];

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

  /**
   * Approve a milestone and release funds
   * Only Project Owner (Client) or Broker can approve
   *
   * @param milestoneId - Milestone ID
   * @param userId - User attempting to approve
   * @param feedback - Optional feedback from the client
   * @param reqContext - Request context for audit logging
   * @throws ForbiddenException if user is not authorized
   * @throws BadRequestException if not all tasks are done
   */
  async approveMilestone(
    milestoneId: string,
    userId: string,
    feedback?: string,
    reqContext?: RequestContext,
  ): Promise<MilestoneApprovalResult> {
    // Step 1: Fetch the milestone with project relation
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId },
      relations: ['project'],
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    // Step 2: Check user authorization (must be Client or Broker of the project)
    let project: ProjectEntity | null = (milestone.project as unknown as ProjectEntity) || null;

    // If no project relation, try to find by projectId
    if (!project && milestone.projectId) {
      project = await this.projectRepository.findOne({
        where: { id: milestone.projectId },
      });
    }

    if (!project) {
      throw new NotFoundException('Project not found for this milestone');
    }

    const isAuthorized = project.clientId === userId || project.brokerId === userId;
    if (!isAuthorized) {
      throw new ForbiddenException(
        'Only the Project Owner (Client) or Broker can approve milestones',
      );
    }

    // Step 3: Check if milestone is already completed or paid
    if (milestone.status === MilestoneStatus.COMPLETED) {
      throw new BadRequestException('Milestone is already completed');
    }

    if (milestone.status === MilestoneStatus.PAID) {
      throw new BadRequestException('Milestone has already been paid');
    }

    // Step 4: Check if all tasks in this milestone are DONE
    const tasks = await this.taskRepository.find({
      where: { milestoneId },
    });

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;

    if (totalTasks === 0) {
      throw new BadRequestException('Milestone has no tasks to approve');
    }

    if (doneTasks < totalTasks) {
      throw new BadRequestException(
        `Cannot approve milestone: ${doneTasks}/${totalTasks} tasks completed. All tasks must be done before approval.`,
      );
    }

    // Step 5: Prepare old data for audit log
    const oldData = {
      status: milestone.status,
      feedback: milestone.feedback,
    };

    const previousStatus = milestone.status;

    // Step 6: Update milestone status to COMPLETED
    milestone.status = MilestoneStatus.COMPLETED;
    if (feedback) {
      milestone.feedback = feedback;
    }

    const updatedMilestone = await this.milestoneRepository.save(milestone);

    // Step 7: Simulate fund release (in real system, this would call payment service)
    this.logger.log(
      `💰 FUNDS RELEASED: Milestone "${milestone.title}" (${milestone.amount} VND) approved by user ${userId}`,
    );

    // Step 8: Create audit log for milestone approval (Critical financial action)
    const newData = {
      status: MilestoneStatus.COMPLETED,
      feedback: feedback || null,
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
    };

    await this.auditLogsService.logUpdate(
      'Milestone',
      milestoneId,
      oldData,
      newData,
      reqContext,
      userId,
    );

    this.logger.log(
      `✅ Milestone ${milestoneId} approved: ${previousStatus} → COMPLETED | Tasks: ${doneTasks}/${totalTasks} | Amount: ${milestone.amount}`,
    );

    return {
      milestone: updatedMilestone,
      previousStatus,
      fundsReleased: true,
      message: `Milestone "${milestone.title}" has been approved. Funds will be released.`,
    };
  }
  async findOne(id: string): Promise<ProjectEntity | null> {
    return this.projectRepository.findOne({
      where: { id },
      relations: ['contracts'],
    });
  }
}
