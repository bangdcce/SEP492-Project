import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  ProjectEntity,
  ProjectStatus,
  ProjectStaffInviteStatus,
} from '../../database/entities/project.entity';
import {
  ContractEntity,
  ContractMilestoneSnapshotItem,
} from '../../database/entities/contract.entity';
import { DisputeEntity, DisputeStatus } from '../../database/entities/dispute.entity';
import { ReviewEntity } from '../../database/entities/review.entity';
import {
  DeliverableType,
  MilestoneEntity,
  MilestoneStatus,
  StaffRecommendation,
} from '../../database/entities/milestone.entity';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { MilestoneLockPolicyService } from './milestone-lock-policy.service';
import { EscrowReleaseService } from '../payments/escrow-release.service';
import { WorkspaceChatService } from '../workspace-chat/workspace-chat.service';

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
  staffId: string | null;
  staffInviteStatus: ProjectStaffInviteStatus | null;
  // Dispute enrichment
  hasActiveDispute: boolean;
  activeDisputeCount: number;
  client?: ProjectParticipantSummary | null;
  broker?: ProjectParticipantSummary | null;
  freelancer?: ProjectParticipantSummary | null;
  reviewSummary?: ProjectReviewSummary;
  pendingReviewTargets?: PendingReviewTarget[];
}

export interface ProjectParticipantSummary {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
}

export interface PendingReviewTarget {
  id: string;
  fullName: string;
  role: string;
}

export interface ProjectReviewSummary {
  totalReviewSlots: number;
  completedReviews: number;
  pendingReviews: number;
  currentUserPendingReviews: number;
  currentUserCanReview: boolean;
}

export interface StaffCandidateSummary {
  id: string;
  fullName: string;
  email: string;
}

export interface PendingProjectInvite {
  id: string;
  title: string;
  description: string | null;
  clientId: string;
  clientName: string | null;
  createdAt: Date;
  staffInviteStatus: ProjectStaffInviteStatus | null;
}

export interface ActiveSupervisedProjectSummary {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  totalBudget: number;
  currency: string;
  clientId: string;
  clientName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffReviewMilestoneInput {
  recommendation: StaffRecommendation;
  note: string;
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
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AuditLogsService,
    private readonly milestoneLockPolicyService: MilestoneLockPolicyService,
    private readonly escrowReleaseService: EscrowReleaseService,
    @Optional()
    private readonly workspaceChatService?: WorkspaceChatService,
  ) {}

  private async recordWorkspaceSystemMessage(
    projectId: string,
    content: string,
    taskId?: string | null,
  ): Promise<void> {
    if (!this.workspaceChatService) {
      return;
    }

    try {
      await this.workspaceChatService.createSystemMessage(projectId, content, {
        taskId: taskId ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Workspace audit message skipped for project ${projectId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private mapProjectParticipant(
    user:
      | Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'>
      | null
      | undefined,
  ): ProjectParticipantSummary | null {
    if (!user?.id) {
      return null;
    }
    return {
      id: user.id,
      fullName: user.fullName || null,
      email: user.email || null,
      role: user.role,
    };
  }

  private buildProjectMemberList(project: {
    clientId: string;
    brokerId: string;
    freelancerId?: string | null;
    client?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'> | null;
    broker?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'> | null;
    freelancer?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'> | null;
  }): ProjectParticipantSummary[] {
    const members = [
      project.client
        ? this.mapProjectParticipant(project.client)
        : {
            id: project.clientId,
            fullName: null,
            email: null,
            role: 'CLIENT',
          },
      project.broker
        ? this.mapProjectParticipant(project.broker)
        : {
            id: project.brokerId,
            fullName: null,
            email: null,
            role: 'BROKER',
          },
      project.freelancerId
        ? project.freelancer
          ? this.mapProjectParticipant(project.freelancer)
          : {
              id: project.freelancerId,
              fullName: null,
              email: null,
              role: 'FREELANCER',
            }
        : null,
    ].filter((member): member is ProjectParticipantSummary => Boolean(member?.id));

    return Array.from(new Map(members.map((member) => [member.id, member])).values());
  }

  private buildReviewState(
    project: {
      id: string;
      status: string;
      clientId: string;
      brokerId: string;
      freelancerId?: string | null;
      client?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'> | null;
      broker?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'> | null;
      freelancer?: Pick<UserEntity, 'id' | 'fullName' | 'email' | 'role'> | null;
    },
    viewerId: string | null,
    existingPairs: Set<string>,
  ): {
    reviewSummary: ProjectReviewSummary;
    pendingReviewTargets: PendingReviewTarget[];
  } {
    const members = this.buildProjectMemberList(project);
    const totalReviewSlots =
      members.length > 1 ? members.length * (members.length - 1) : 0;
    let completedReviews = 0;
    for (const member of members) {
      for (const target of members) {
        if (member.id === target.id) continue;
        if (existingPairs.has(`${project.id}:${member.id}:${target.id}`)) {
          completedReviews += 1;
        }
      }
    }

    const currentUserCanReview =
      project.status === ProjectStatus.COMPLETED &&
      Boolean(viewerId && members.some((member) => member.id === viewerId));

    const pendingReviewTargets =
      currentUserCanReview && viewerId
        ? members
            .filter((member) => member.id !== viewerId)
            .filter(
              (member) =>
                !existingPairs.has(`${project.id}:${viewerId}:${member.id}`),
            )
            .map((member) => ({
              id: member.id,
              fullName:
                member.fullName ||
                member.email ||
                `${member.role.charAt(0)}${member.role.slice(1).toLowerCase()}`,
              role: member.role,
            }))
        : [];

    return {
      reviewSummary: {
        totalReviewSlots,
        completedReviews,
        pendingReviews: Math.max(totalReviewSlots - completedReviews, 0),
        currentUserPendingReviews: pendingReviewTargets.length,
        currentUserCanReview,
      },
      pendingReviewTargets,
    };
  }

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

    if (typeof input !== 'string' && typeof input !== 'number' && !(input instanceof Date)) {
      throw new BadRequestException('Invalid date format. Use ISO date string.');
    }

    const parsed = new Date(input);
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

  private findSnapshotEntryForMilestone(
    snapshot: ContractMilestoneSnapshotItem[],
    milestone: MilestoneEntity,
  ): ContractMilestoneSnapshotItem | undefined {
    return (
      (milestone.sourceContractMilestoneKey
        ? snapshot.find(
            (entry) => entry.contractMilestoneKey === milestone.sourceContractMilestoneKey,
          )
        : undefined) ??
      snapshot.find((entry) => entry.projectMilestoneId === milestone.id) ??
      (Number.isInteger(milestone.sortOrder)
        ? snapshot.find((entry) => entry.sortOrder === milestone.sortOrder)
        : undefined)
    );
  }

  private async getProjectOrThrow(projectId: string, relations: string[] = []): Promise<ProjectEntity> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations,
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  private async getMilestoneWithProjectOrThrow(
    milestoneId: string,
  ): Promise<{ milestone: MilestoneEntity; project: ProjectEntity }> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${milestoneId} not found`);
    }

    if (!milestone.projectId) {
      throw new BadRequestException('Milestone is not linked to a project');
    }

    const project = await this.getProjectOrThrow(milestone.projectId);
    return { milestone, project };
  }

  private async calculateMilestoneTaskProgress(milestoneId: string): Promise<{
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }> {
    const totalTasks = await this.taskRepository.count({
      where: { milestoneId, parentTaskId: IsNull() },
    });

    if (totalTasks === 0) {
      return { progress: 0, totalTasks: 0, completedTasks: 0 };
    }

    const completedTasks = await this.taskRepository.count({
      where: { milestoneId, status: TaskStatus.DONE, parentTaskId: IsNull() },
    });

    return {
      progress: Math.round((completedTasks / totalTasks) * 100),
      totalTasks,
      completedTasks,
    };
  }

  private clearStaffReviewDecision(milestone: MilestoneEntity): void {
    milestone.reviewedByStaffId = null;
    milestone.staffRecommendation = null;
    milestone.staffReviewNote = null;
  }

  private sanitizeProjectStaffRelation(project: ProjectEntity | null): ProjectEntity | null {
    if (!project?.staff) {
      return project;
    }

    project.staff = {
      id: project.staff.id,
      fullName: project.staff.fullName,
      email: project.staff.email,
    };

    return project;
  }

  async listStaffCandidates(): Promise<StaffCandidateSummary[]> {
    const staffUsers = await this.userRepository.find({
      where: {
        role: UserRole.STAFF,
        isBanned: false,
        status: UserStatus.ACTIVE,
      },
      select: ['id', 'fullName', 'email'],
      order: { fullName: 'ASC' },
    });

    return staffUsers.map((staff) => ({
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
    }));
  }

  async inviteStaff(projectId: string, clientId: string, staffId: string): Promise<ProjectEntity> {
    const project = await this.getProjectOrThrow(projectId, ['staff']);

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Only the project client can invite a staff reviewer');
    }

    if (project.status === ProjectStatus.DISPUTED) {
      throw new ConflictException('Cannot invite staff while the project is under dispute');
    }

    const staffUser = await this.userRepository.findOne({
      where: {
        id: staffId,
        role: UserRole.STAFF,
        isBanned: false,
        status: UserStatus.ACTIVE,
      },
    });
    if (!staffUser) {
      throw new BadRequestException('Selected staff user is invalid or unavailable');
    }

    if (
      project.staffId &&
      project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED &&
      project.staffId !== staffId
    ) {
      throw new BadRequestException('This project already has an accepted staff reviewer');
    }

    if (
      project.staffId === staffId &&
      project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED
    ) {
      const refreshedProject = await this.findOne(project.id);
      return refreshedProject ?? project;
    }

    project.staffId = staffUser.id;
    project.staffInviteStatus = ProjectStaffInviteStatus.PENDING;

    const savedProject = await this.projectRepository.save(project);
    const refreshedProject = await this.findOne(savedProject.id);
    if (!refreshedProject) {
      throw new NotFoundException(`Project ${savedProject.id} not found`);
    }
    return refreshedProject;
  }

  async respondToStaffInvite(
    projectId: string,
    staffUserId: string,
    status: ProjectStaffInviteStatus.ACCEPTED | ProjectStaffInviteStatus.REJECTED,
  ): Promise<ProjectEntity> {
    const project = await this.getProjectOrThrow(projectId, ['contracts', 'staff']);

    if (project.staffId !== staffUserId) {
      throw new ForbiddenException('You are not the invited staff reviewer for this project');
    }

    if (project.staffInviteStatus !== ProjectStaffInviteStatus.PENDING) {
      throw new BadRequestException('This staff invite is no longer pending');
    }

    if (status === ProjectStaffInviteStatus.REJECTED) {
      project.staffInviteStatus = ProjectStaffInviteStatus.REJECTED;
      project.staffId = null;
    } else {
      project.staffInviteStatus = ProjectStaffInviteStatus.ACCEPTED;
    }

    const savedProject = await this.projectRepository.save(project);
    const refreshedProject = await this.findOne(savedProject.id);
    if (!refreshedProject) {
      throw new NotFoundException(`Project ${savedProject.id} not found`);
    }
    return refreshedProject;
  }

  async getPendingInvitesForStaff(staffUserId: string): Promise<PendingProjectInvite[]> {
    const pendingProjects = await this.projectRepository.find({
      where: {
        staffId: staffUserId,
        staffInviteStatus: ProjectStaffInviteStatus.PENDING,
      },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });

    return pendingProjects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      clientId: project.clientId,
      clientName: project.client?.fullName ?? null,
      createdAt: project.createdAt,
      staffInviteStatus: project.staffInviteStatus ?? null,
    }));
  }

  async getActiveSupervisedProjectsForStaff(
    staffUserId: string,
  ): Promise<ActiveSupervisedProjectSummary[]> {
    const activeProjects = await this.projectRepository.find({
      where: {
        staffId: staffUserId,
        staffInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
      },
      relations: ['client'],
      order: { updatedAt: 'DESC' },
    });

    return activeProjects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description ?? null,
      status: project.status,
      totalBudget: Number(project.totalBudget ?? 0),
      currency: project.currency || 'USD',
      clientId: project.clientId,
      clientName: project.client?.fullName ?? null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  }

  async requestMilestoneReview(milestoneId: string, requesterId: string): Promise<MilestoneEntity> {
    const { milestone, project } = await this.getMilestoneWithProjectOrThrow(milestoneId);

    if (project.freelancerId !== requesterId) {
      throw new ForbiddenException('Only the assigned freelancer can request milestone review');
    }

    if (project.status === ProjectStatus.DISPUTED) {
      throw new ConflictException('Cannot request milestone review while the project is disputed');
    }

    if (
      [MilestoneStatus.COMPLETED, MilestoneStatus.PAID, MilestoneStatus.LOCKED].includes(
        milestone.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot request review for milestone with status "${milestone.status}"`,
      );
    }

    if (
      [
        MilestoneStatus.SUBMITTED,
        MilestoneStatus.PENDING_STAFF_REVIEW,
        MilestoneStatus.PENDING_CLIENT_APPROVAL,
      ].includes(milestone.status)
    ) {
      throw new BadRequestException('Milestone review has already been requested');
    }

    const { progress, totalTasks } = await this.calculateMilestoneTaskProgress(milestone.id);
    if (totalTasks === 0) {
      throw new BadRequestException('Milestone has no tasks to review');
    }

    if (progress < 100) {
      throw new BadRequestException('All milestone tasks must be DONE before requesting review');
    }

    milestone.status =
      project.staffId && project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED
        ? MilestoneStatus.PENDING_STAFF_REVIEW
        : MilestoneStatus.SUBMITTED;
    milestone.submittedAt = new Date();
    this.clearStaffReviewDecision(milestone);

    return this.milestoneRepository.save(milestone);
  }

  async reviewMilestoneAsStaff(
    milestoneId: string,
    reviewerId: string,
    payload: StaffReviewMilestoneInput,
  ): Promise<MilestoneEntity> {
    const { milestone, project } = await this.getMilestoneWithProjectOrThrow(milestoneId);

    if (project.status === ProjectStatus.DISPUTED) {
      throw new ConflictException('Cannot review milestone while the project is disputed');
    }

    const isAssignedStaff =
      project.staffId === reviewerId &&
      project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED;
    if (!isAssignedStaff) {
      throw new ForbiddenException('Only the assigned staff reviewer can review this milestone');
    }

    if (milestone.status !== MilestoneStatus.PENDING_STAFF_REVIEW) {
      throw new BadRequestException(
        `Cannot staff-review milestone with status "${milestone.status}"`,
      );
    }

    const trimmedNote = payload.note.trim();
    if (!trimmedNote) {
      throw new BadRequestException('Staff review note is required');
    }

    milestone.reviewedByStaffId = reviewerId;
    milestone.staffRecommendation = payload.recommendation;
    milestone.staffReviewNote = trimmedNote;

    if (payload.recommendation === StaffRecommendation.ACCEPT) {
      milestone.status = MilestoneStatus.PENDING_CLIENT_APPROVAL;
    } else {
      milestone.status = MilestoneStatus.IN_PROGRESS;
      milestone.submittedAt = null;
    }

    return this.milestoneRepository.save(milestone);
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
  async listByUser(userId: string, viewerId?: string): Promise<ProjectWithDisputeInfo[]> {
    // Step 1: Fetch base projects
    const projects = await this.projectRepository.find({
      where: [
        { clientId: userId },
        { brokerId: userId },
        { freelancerId: userId },
        { staffId: userId },
      ],
      relations: ['client', 'broker', 'freelancer', 'staff'],
      select: [
        'id',
        'title',
        'description',
        'status',
        'clientId',
        'brokerId',
        'freelancerId',
        'staffId',
        'staffInviteStatus',
        'totalBudget',
        'currency',
        'createdAt',
        'client',
        'broker',
        'freelancer',
        'staff',
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

    const reviews = await this.reviewRepository.find({
      where: { projectId: In(projectIds) },
      select: ['projectId', 'reviewerId', 'targetUserId'],
    });
    const reviewPairSet = new Set(
      reviews.map(
        (review) => `${review.projectId}:${review.reviewerId}:${review.targetUserId}`,
      ),
    );

    // Step 3: Create a map for quick lookup
    const disputeCountMap = new Map<string, number>();
    for (const dc of disputeCounts) {
      disputeCountMap.set(dc.projectId, parseInt(dc.count, 10));
    }

    this.logger.debug(`Found ${disputeCounts.length} projects with active disputes`);

    // Step 4: Enrich projects with dispute info
    const enrichedProjects: ProjectWithDisputeInfo[] = projects.map((project) => {
      const activeDisputeCount = disputeCountMap.get(project.id) || 0;
      const reviewState = this.buildReviewState(
        project as ProjectEntity & {
          client?: UserEntity | null;
          broker?: UserEntity | null;
          freelancer?: UserEntity | null;
        },
        viewerId || userId,
        reviewPairSet,
      );
      return {
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        clientId: project.clientId,
        brokerId: project.brokerId,
        freelancerId: project.freelancerId,
        staffId: project.staffId,
        staffInviteStatus: project.staffInviteStatus,
        totalBudget: Number(project.totalBudget),
        currency: project.currency,
        createdAt: project.createdAt,
        hasActiveDispute: activeDisputeCount > 0,
        activeDisputeCount,
        client: this.mapProjectParticipant(project.client),
        broker: this.mapProjectParticipant(project.broker),
        freelancer: this.mapProjectParticipant(project.freelancer),
        reviewSummary: reviewState.reviewSummary,
        pendingReviewTargets: reviewState.pendingReviewTargets,
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
    let oldData: { status: MilestoneStatus; feedback: string | null } | null = null;
    let previousStatus: MilestoneStatus | null = null;
    let updatedMilestone: MilestoneEntity | null = null;
    let totalTasks = 0;
    let doneTasks = 0;
    let releaseTransactionIds: string[] = [];
    let logCurrency = 'USD';
    let auditProjectId: string | null = null;
    let approvalActorLabel = 'Authorized user';
    let approvedMilestoneTitle = 'Milestone';
    let approvedMilestoneAmount = '0.00';

    await this.dataSource.transaction(async (manager) => {
      const milestoneRepository = manager.getRepository(MilestoneEntity);
      const projectRepository = manager.getRepository(ProjectEntity);
      const taskRepository = manager.getRepository(TaskEntity);

      const milestone = await milestoneRepository
        .createQueryBuilder('milestone')
        .setLock('pessimistic_write')
        .where('milestone.id = :milestoneId', { milestoneId })
        .getOne();

      if (!milestone) {
        throw new NotFoundException(`Milestone ${milestoneId} not found`);
      }

      const project = await projectRepository
        .createQueryBuilder('project')
        .setLock('pessimistic_write')
        .where('project.id = :projectId', { projectId: milestone.projectId })
        .getOne();

      if (!project) {
        throw new NotFoundException('Project not found for this milestone');
      }

      if (project.status === ProjectStatus.DISPUTED) {
        throw new ConflictException('Cannot approve milestone while the project is under dispute');
      }

      const isAuthorized = project.clientId === userId || project.brokerId === userId;
      if (!isAuthorized) {
        throw new ForbiddenException(
          'Only the Project Owner (Client) or Broker can approve milestones',
        );
      }

      auditProjectId = project.id;
      approvalActorLabel = project.clientId === userId ? 'Client' : 'Broker';

      if (milestone.status === MilestoneStatus.COMPLETED) {
        throw new BadRequestException('Milestone is already completed');
      }

      if (milestone.status === MilestoneStatus.PAID) {
        throw new BadRequestException('Milestone has already been paid');
      }

      const approvableStatuses = [
        MilestoneStatus.SUBMITTED,
        MilestoneStatus.PENDING_CLIENT_APPROVAL,
      ];
      if (!approvableStatuses.includes(milestone.status)) {
        throw new BadRequestException(
          `Cannot approve milestone with status "${milestone.status}". Only SUBMITTED or PENDING_CLIENT_APPROVAL milestones can be approved.`,
        );
      }

      const tasks = await taskRepository.find({
        where: { milestoneId },
      });

      totalTasks = tasks.length;
      doneTasks = tasks.filter((task) => task.status === TaskStatus.DONE).length;

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
        const snapshotEntry = this.findSnapshotEntryForMilestone(snapshot, milestone);
        if (!snapshotEntry) {
          throw new BadRequestException('Milestone not found in contract snapshot');
        }

        const currentAmount = new Decimal(milestone.amount).toDecimalPlaces(2);
        const snapshotAmount = new Decimal(snapshotEntry.amount).toDecimalPlaces(2);
        if (!currentAmount.equals(snapshotAmount)) {
          throw new BadRequestException('Milestone amount mismatch with contract snapshot');
        }
        if (snapshotEntry.title !== milestone.title) {
          throw new BadRequestException('Milestone title mismatch with contract snapshot');
        }
      }

      oldData = {
        status: milestone.status,
        feedback: milestone.feedback ?? null,
      };

      previousStatus = milestone.status;
      milestone.status = MilestoneStatus.COMPLETED;
      if (feedback) {
        milestone.feedback = feedback;
      }

      updatedMilestone = await milestoneRepository.save(milestone);
      logCurrency = project.currency || 'USD';
      approvedMilestoneTitle = milestone.title;
      approvedMilestoneAmount = new Decimal(milestone.amount).toDecimalPlaces(2).toString();

      const releaseResult = await this.escrowReleaseService.releaseForApprovedMilestone(
        milestone.id,
        userId,
        manager,
      );
      releaseTransactionIds = releaseResult.releaseTransactionIds;

      this.logger.log(
        `💰 FUNDS RELEASED: Milestone "${milestone.title}" (${milestone.amount} ${logCurrency}) approved by user ${userId} | tx=${releaseTransactionIds.join(',')}`,
      );
    });

    const newData = {
      status: MilestoneStatus.COMPLETED,
      feedback: feedback || null,
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
      releaseTransactionIds,
    };

    await this.auditLogsService.logUpdate(
      'Milestone',
      milestoneId,
      oldData ?? {},
      newData,
      reqContext,
      userId,
    );

    if (auditProjectId) {
      await this.recordWorkspaceSystemMessage(
        auditProjectId,
        `${approvalActorLabel} authorized release of ${approvedMilestoneAmount} ${logCurrency} for milestone "${approvedMilestoneTitle}".`,
      );
    }

    this.logger.log(
      `✅ Milestone ${milestoneId} approved: ${previousStatus} → COMPLETED | Tasks: ${doneTasks}/${totalTasks} | ReleaseTx: ${releaseTransactionIds.length}`,
    );

    return {
      milestone: updatedMilestone as MilestoneEntity,
      previousStatus: previousStatus as MilestoneStatus,
      fundsReleased: true,
      message: `Milestone "${updatedMilestone?.title}" has been approved. Funds have been released.`,
    };
  }
  async findOne(id: string, viewerId?: string): Promise<(ProjectEntity & ProjectWithDisputeInfo) | null> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['contracts', 'staff', 'client', 'broker', 'freelancer'],
    });
    if (!project) {
      return null;
    }

    if (Array.isArray(project.contracts)) {
      const contracts = project.contracts as ContractEntity[];
      project.contracts = [...contracts].sort((a: ContractEntity, b: ContractEntity) => {
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

    const normalizedProject = this.sanitizeProjectStaffRelation(project);
    const activeDisputeStatuses = [
      DisputeStatus.OPEN,
      DisputeStatus.TRIAGE_PENDING,
      DisputeStatus.PREVIEW,
      DisputeStatus.PENDING_REVIEW,
      DisputeStatus.INFO_REQUESTED,
      DisputeStatus.IN_MEDIATION,
      DisputeStatus.APPEALED,
    ];
    const activeDisputeCount = await this.disputeRepository.count({
      where: {
        projectId: id,
        status: In(activeDisputeStatuses),
      },
    });

    const reviews = await this.reviewRepository.find({
      where: { projectId: id },
      select: ['projectId', 'reviewerId', 'targetUserId'],
    });
    const reviewPairSet = new Set(
      reviews.map(
        (review) => `${review.projectId}:${review.reviewerId}:${review.targetUserId}`,
      ),
    );
    const reviewState = this.buildReviewState(
      normalizedProject as ProjectEntity & {
        client?: UserEntity | null;
        broker?: UserEntity | null;
        freelancer?: UserEntity | null;
      },
      viewerId || null,
      reviewPairSet,
    );

    return {
      ...normalizedProject,
      hasActiveDispute: activeDisputeCount > 0,
      activeDisputeCount,
      client: this.mapProjectParticipant(normalizedProject.client),
      broker: this.mapProjectParticipant(normalizedProject.broker),
      freelancer: this.mapProjectParticipant(normalizedProject.freelancer),
      reviewSummary: reviewState.reviewSummary,
      pendingReviewTargets: reviewState.pendingReviewTargets,
    };
  }
}
