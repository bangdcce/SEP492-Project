import {
  Controller,
  Delete,
  Get,
  HttpException,
  Patch,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeliverableType } from '../../database/entities/milestone.entity';
import { ProjectStaffInviteStatus } from '../../database/entities/project.entity';
import { UserRole } from '../../database/entities/user.entity';
import {
  ProjectsService,
  MilestoneApprovalResult,
  CreateProjectMilestoneInput,
  UpdateProjectMilestoneInput,
} from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { hasAnyUserRole } from '../auth/utils/role.utils';
import { InviteProjectStaffDto } from './dto/invite-project-staff.dto';
import { RespondProjectStaffInviteDto } from './dto/respond-project-staff-invite.dto';
import { ReviewMilestoneStaffDto } from './dto/review-milestone-staff.dto';

// Interface for authenticated request with user context
interface AuthenticatedRequest {
  user?: { id: string; role?: UserRole | string };
  ip?: string;
  method: string;
  path: string;
  get: (header: string) => string | undefined;
}

// DTO for milestone approval
interface ApproveMilestoneDto {
  feedback?: string;
}

interface CreateMilestoneDto {
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

interface UpdateMilestoneDto {
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

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  private isAdminRole(role?: UserRole | string): boolean {
    return hasAnyUserRole(role, [UserRole.ADMIN]);
  }

  private hasRole(role: UserRole | string | undefined, ...allowedRoles: UserRole[]): boolean {
    return hasAnyUserRole(role, allowedRoles);
  }

  private assertCanReadProjectList(req: AuthenticatedRequest, targetUserId: string): void {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User authentication required');
    }

    if (requesterId === targetUserId || this.isAdminRole(req.user?.role)) {
      return;
    }

    throw new ForbiddenException('You can only access your own project list');
  }

  private assertCanReadProjectDetail(
    req: AuthenticatedRequest,
    project: {
      clientId: string;
      brokerId: string;
      freelancerId?: string | null;
      staffId?: string | null;
      staffInviteStatus?: ProjectStaffInviteStatus | null;
    },
  ): void {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User authentication required');
    }

    if (this.isAdminRole(req.user?.role)) {
      return;
    }

    const isAssignedStaff =
      this.hasRole(req.user?.role, UserRole.STAFF) &&
      requesterId === project.staffId &&
      project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED;

    const isParticipant =
      requesterId === project.clientId ||
      requesterId === project.brokerId ||
      requesterId === project.freelancerId;

    if (!isParticipant && !isAssignedStaff) {
      throw new ForbiddenException('You are not authorized to access this project');
    }
  }

  @Get('list/:userId')
  listByUser(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: AuthenticatedRequest) {
    this.assertCanReadProjectList(req, userId);
    return this.projectsService.listByUser(userId);
  }

  @Get('staff-candidates')
  async listStaffCandidates(@Req() req: AuthenticatedRequest) {
    if (!this.hasRole(req.user?.role, UserRole.CLIENT, UserRole.ADMIN)) {
      throw new ForbiddenException('Only clients can browse staff candidates');
    }

    return this.projectsService.listStaffCandidates();
  }

  @Get('pending-invites')
  async getPendingInvites(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!this.hasRole(req.user?.role, UserRole.STAFF, UserRole.ADMIN)) {
      throw new ForbiddenException('Only staff users can access pending invites');
    }

    return this.projectsService.getPendingInvitesForStaff(userId);
  }

  @Get('staff/active')
  async getActiveSupervisedProjects(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!this.hasRole(req.user?.role, UserRole.STAFF, UserRole.ADMIN)) {
      throw new ForbiddenException('Only staff users can access active supervised projects');
    }

    return this.projectsService.getActiveSupervisedProjectsForStaff(userId);
  }

  @Get(':id')
  async getProject(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    const project = await this.projectsService.findOne(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    this.assertCanReadProjectDetail(req, project);

    return project;
  }

  @Post(':id/invite-staff')
  async inviteStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteProjectStaffDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!this.hasRole(req.user?.role, UserRole.CLIENT, UserRole.ADMIN)) {
      throw new ForbiddenException('Only the client can invite a staff reviewer');
    }

    return this.projectsService.inviteStaff(id, userId, dto.staffId);
  }

  @Post(':id/staff-response')
  async respondToStaffInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondProjectStaffInviteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!this.hasRole(req.user?.role, UserRole.STAFF, UserRole.ADMIN)) {
      throw new ForbiddenException('Only staff users can respond to project invites');
    }

    return this.projectsService.respondToStaffInvite(id, userId, dto.status);
  }

  @Post(':projectId/milestones')
  async createMilestone(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateMilestoneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const payload: CreateProjectMilestoneInput = {
      title: dto.title,
      description: dto.description,
      amount: dto.amount,
      startDate: dto.startDate,
      dueDate: dto.dueDate,
      sortOrder: dto.sortOrder,
      deliverableType: dto.deliverableType,
      retentionAmount: dto.retentionAmount,
      acceptanceCriteria: dto.acceptanceCriteria,
    };

    return this.projectsService.createMilestone(projectId, userId, payload);
  }

  @Patch('milestones/:id')
  async updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMilestoneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const payload: UpdateProjectMilestoneInput = {
      title: dto.title,
      description: dto.description,
      amount: dto.amount,
      startDate: dto.startDate,
      dueDate: dto.dueDate,
      sortOrder: dto.sortOrder,
      deliverableType: dto.deliverableType,
      retentionAmount: dto.retentionAmount,
      acceptanceCriteria: dto.acceptanceCriteria,
    };

    return this.projectsService.updateMilestoneStructure(id, userId, payload);
  }

  @Delete('milestones/:id')
  async deleteMilestone(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    await this.projectsService.deleteMilestoneStructure(id, userId);
    return { success: true };
  }

  @Post('milestones/:id/request-review')
  async requestMilestoneReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!this.hasRole(req.user?.role, UserRole.FREELANCER)) {
      throw new ForbiddenException('Only the assigned freelancer can request milestone review');
    }

    return this.projectsService.requestMilestoneReview(id, userId);
  }

  @Post('milestones/:id/staff-review')
  async reviewMilestoneAsStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewMilestoneStaffDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!this.hasRole(req.user?.role, UserRole.STAFF, UserRole.ADMIN)) {
      throw new ForbiddenException('Only staff users can review milestones');
    }

    return this.projectsService.reviewMilestoneAsStaff(id, userId, {
      recommendation: dto.recommendation,
      note: dto.note,
    });
  }

  /**
   * Approve a milestone and release funds
   * Only Client or Broker can approve
   *
   * @param id - Milestone UUID
   * @param dto - Optional approval data (feedback)
   * @param req - Authenticated request
   */
  @Post('milestones/:id/approve')
  async approveMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveMilestoneDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MilestoneApprovalResult> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required to approve milestone');
    }

    this.logger.log(`Milestone approval request: ${id} by user ${userId}`);

    // Extract request context for audit logging
    const reqContext = {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
    };

    try {
      const result = await this.projectsService.approveMilestone(
        id,
        userId,
        dto?.feedback,
        reqContext,
      );

      this.logger.log(
        `✅ Milestone ${id} approved successfully. Funds released: ${result.fundsReleased}`,
      );

      return result;
    } catch (error: unknown) {
      // Preserve expected HTTP failures from the service layer.
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to approve milestone ${id}: ${errorMessage}`);
      throw new InternalServerErrorException('Failed to approve milestone');
    }
  }
}
