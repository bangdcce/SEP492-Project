import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ContractEntity } from '../../database/entities/contract.entity';
import { DisputeEntity, DisputeStatus } from '../../database/entities/dispute.entity';
import {
  DeliverableType,
  MilestoneEntity,
  MilestoneStatus,
} from '../../database/entities/milestone.entity';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { MilestoneLockPolicyService } from './milestone-lock-policy.service';

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
  currency: string;
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

export interface CreateProjectMilestoneInput {
  title: string;
  description?: string;
  amount?: number;
  startDate?: string;
  dueDate?: string;
  sortOrder?: number;
  deliverableType?: DeliverableType;
  retentionAmount?: number;
  acceptanceCriteria?: string[];
}

export interface UpdateProjectMilestoneInput {
  title?: string;
  description?: string | null;
  amount?: number;
  startDate?: string | null;
  dueDate?: string | null;
  sortOrder?: number | null;
  deliverableType?: DeliverableType;
  retentionAmount?: number | null;
  acceptanceCriteria?: string[] | null;
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
    private readonly milestoneLockPolicyService: MilestoneLockPolicyService,
  ) {}

  private parseAmountOrDefault(input: unknown, fallback: number): number {
    if (input === undefined || input === null || input === '') {
      return fallback;
    }
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('Amount must be a non-negative number');
    }
    return parsed;
  }

  private parseOptionalDate(input: unknown): Date | null {
    if (input === undefined || input === null || input === '') {
      return null;
    }

    const parsed = new Date(String(input));
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO date string.');
    }
    return parsed;
  }

  private async assertBrokerCanMutateMilestones(
    projectId: string,
    userId: string,
  ): Promise<ProjectEntity> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (project.brokerId !== userId) {
      throw new ForbiddenException('Only the assigned broker can mutate milestone scope');
    }

    if (project.status === ProjectStatus.DISPUTED) {
      throw new BadRequestException(
        'Project is under dispute. Milestone scope mutation is disabled.',
      );
    }

    return project;
  }

  private assertRetentionDoesNotExceedAmount(amount: number, retentionAmount: number): void {
    if (new Decimal(retentionAmount).greaterThan(new Decimal(amount))) {
      throw new BadRequestException('Milestone retentionAmount cannot exceed milestone amount');
    }
  }

  private async assertMilestoneBudgetWithinProject(project: ProjectEntity): Promise<void> {
    const milestones = await this.milestoneRepository.find({
      where: { projectId: project.id },
    });

    const totalMilestoneAmount = milestones.reduce(
      (sum, milestone) => sum.plus(new Decimal(milestone.amount || 0)),
      new Decimal(0),
    );
    const projectBudget = new Decimal(project.totalBudget || 0);

    for (const milestone of milestones) {
      this.assertRetentionDoesNotExceedAmount(
        Number(milestone.amount || 0),
        Number(milestone.retentionAmount || 0),
      );
    }

    if (totalMilestoneAmount.greaterThan(projectBudget)) {
      throw new BadRequestException(
        `Milestone total exceeds project budget (${totalMilestoneAmount.toFixed(2)} > ${projectBudget.toFixed(2)}).`,
      );
    }
  }

  async createMilestone(
    projectId: string,
    userId: string,
    payload: CreateProjectMilestoneInput,
  ): Promise<MilestoneEntity> {
    const project = await this.assertBrokerCanMutateMilestones(projectId, userId);
    await this.milestoneLockPolicyService.assertCanMutateMilestoneStructure(projectId);

    const title = payload.title?.trim();
    if (!title) {
      throw new BadRequestException('Milestone title is required');
    }

    const existingMilestoneCount = await this.milestoneRepository.count({
      where: { projectId },
    });
    const nextSortOrder = payload.sortOrder ?? existingMilestoneCount + 1;
    const amount = this.parseAmountOrDefault(payload.amount, 0);
    const retentionAmount = this.parseAmountOrDefault(payload.retentionAmount, 0);
    const startDate = this.parseOptionalDate(payload.startDate);
    const dueDate = this.parseOptionalDate(payload.dueDate);
    this.assertRetentionDoesNotExceedAmount(amount, retentionAmount);

    if (startDate && dueDate && dueDate < startDate) {
      throw new BadRequestException('Milestone dueDate must be greater than or equal to startDate');
    }

    const milestone = this.milestoneRepository.create({
      projectId,
      title,
      description: payload.description?.trim() || undefined,
      amount,
      deliverableType: payload.deliverableType ?? DeliverableType.OTHER,
      retentionAmount,
      acceptanceCriteria: Array.isArray(payload.acceptanceCriteria)
        ? payload.acceptanceCriteria
        : undefined,
      startDate: startDate ?? undefined,
      dueDate: dueDate ?? undefined,
      sortOrder: nextSortOrder,
      status: MilestoneStatus.PENDING,
    });

    const savedMilestone = await this.milestoneRepository.save(milestone);

    try {
      await this.assertMilestoneBudgetWithinProject(project);
      return savedMilestone;
    } catch (error) {
      await this.milestoneRepository.remove(savedMilestone);
      throw error;
    }
  }

  async updateMilestoneStructure(
    milestoneId: string,
    userId: string,
    payload: UpdateProjectMilestoneInput,
  ): Promise<MilestoneEntity> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }
    if (!milestone.projectId) {
      throw new BadRequestException('Milestone is not linked to a project');
    }
    const previousMilestoneState = { ...milestone };

    const project = await this.assertBrokerCanMutateMilestones(milestone.projectId, userId);
    await this.milestoneLockPolicyService.assertCanMutateMilestoneStructure(milestone.projectId);

    const hasAnyUpdate =
      payload.title !== undefined ||
      payload.description !== undefined ||
      payload.amount !== undefined ||
      payload.startDate !== undefined ||
      payload.dueDate !== undefined ||
      payload.sortOrder !== undefined ||
      payload.deliverableType !== undefined ||
      payload.retentionAmount !== undefined ||
      payload.acceptanceCriteria !== undefined;

    if (!hasAnyUpdate) {
      throw new BadRequestException('No milestone structure fields provided to update');
    }

    if (payload.title !== undefined) {
      const title = payload.title?.trim();
      if (!title) {
        throw new BadRequestException('Milestone title cannot be empty');
      }
      milestone.title = title;
    }

    if (payload.description !== undefined) {
      milestone.description = (payload.description?.trim() || null) as unknown as string;
    }

    if (payload.amount !== undefined) {
      milestone.amount = this.parseAmountOrDefault(payload.amount, milestone.amount);
    }

    if (payload.startDate !== undefined) {
      milestone.startDate = this.parseOptionalDate(payload.startDate) as unknown as Date;
    }

    if (payload.dueDate !== undefined) {
      milestone.dueDate = this.parseOptionalDate(payload.dueDate) as unknown as Date;
    }

    if (milestone.startDate && milestone.dueDate && milestone.dueDate < milestone.startDate) {
      throw new BadRequestException('Milestone dueDate must be greater than or equal to startDate');
    }

    if (payload.sortOrder !== undefined) {
      if (payload.sortOrder === null) {
        milestone.sortOrder = null as unknown as number;
      } else if (!Number.isInteger(payload.sortOrder) || payload.sortOrder < 0) {
        throw new BadRequestException('Milestone sortOrder must be a non-negative integer');
      } else {
        milestone.sortOrder = payload.sortOrder;
      }
    }

    if (payload.deliverableType !== undefined) {
      milestone.deliverableType = payload.deliverableType;
    }

    if (payload.retentionAmount !== undefined) {
      if (payload.retentionAmount === null) {
        milestone.retentionAmount = 0;
      } else {
        milestone.retentionAmount = this.parseAmountOrDefault(
          payload.retentionAmount,
          milestone.retentionAmount,
        );
      }
    }

    this.assertRetentionDoesNotExceedAmount(
      Number(milestone.amount || 0),
      Number(milestone.retentionAmount || 0),
    );

    if (payload.acceptanceCriteria !== undefined) {
      milestone.acceptanceCriteria = Array.isArray(payload.acceptanceCriteria)
        ? payload.acceptanceCriteria
        : (null as unknown as string[]);
    }

    const savedMilestone = await this.milestoneRepository.save(milestone);

    try {
      await this.assertMilestoneBudgetWithinProject(project);
      return savedMilestone;
    } catch (error) {
      await this.milestoneRepository.save(previousMilestoneState);
      throw error;
    }
  }

  async deleteMilestoneStructure(milestoneId: string, userId: string): Promise<void> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }
    if (!milestone.projectId) {
      throw new BadRequestException('Milestone is not linked to a project');
    }

    const project = await this.assertBrokerCanMutateMilestones(milestone.projectId, userId);
    await this.milestoneLockPolicyService.assertCanMutateMilestoneStructure(milestone.projectId);

    const milestoneBackup = { ...milestone };
    await this.milestoneRepository.remove(milestone);
    try {
      await this.assertMilestoneBudgetWithinProject(project);
    } catch (error) {
      await this.milestoneRepository.save(milestoneBackup);
      throw error;
    }
  }

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
        'currency',
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
      DisputeStatus.TRIAGE_PENDING,
      DisputeStatus.PREVIEW,
      DisputeStatus.PENDING_REVIEW,
      DisputeStatus.INFO_REQUESTED,
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
        currency: project.currency,
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
    let project: ProjectEntity | null = (milestone.project as ProjectEntity) || null;

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

    const activeContract = await this.milestoneLockPolicyService.findLatestActivatedContract(
      project.id,
    );
    const snapshot = Array.isArray(activeContract?.milestoneSnapshot)
      ? activeContract.milestoneSnapshot
      : [];
    if (snapshot.length > 0) {
      const snapshotEntry = snapshot.find((entry) => entry.projectMilestoneId === milestone.id);
      if (!snapshotEntry) {
        throw new BadRequestException('Milestone not found in contract snapshot');
      }

      const currentAmount = new Decimal(milestone.amount).toDecimalPlaces(2);
      const snapshotAmount = new Decimal(snapshotEntry.amount).toDecimalPlaces(2);
      if (!currentAmount.equals(snapshotAmount)) {
        throw new BadRequestException('Milestone amount mismatch with contract snapshot');
      }
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
      `💰 FUNDS RELEASED: Milestone "${milestone.title}" (${milestone.amount} ${
        project.currency || 'USD'
      }) approved by user ${userId}`,
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
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['contracts'],
    });
    if (!project) {
      return null;
    }

    if (Array.isArray(project.contracts)) {
      project.contracts = [...project.contracts].sort((a: ContractEntity, b: ContractEntity) => {
        const aActivated = a.activatedAt ? new Date(a.activatedAt).getTime() : 0;
        const bActivated = b.activatedAt ? new Date(b.activatedAt).getTime() : 0;
        if (aActivated !== bActivated) {
          return bActivated - aActivated;
        }

        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      });
    }

    return project;
  }
}
