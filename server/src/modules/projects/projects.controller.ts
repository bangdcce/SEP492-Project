import {
  Controller,
  Delete,
  Get,
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
import { UserRole } from '../../database/entities/user.entity';
import {
  ProjectsService,
  MilestoneApprovalResult,
  CreateProjectMilestoneInput,
  UpdateProjectMilestoneInput,
} from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  private isPrivilegedRole(role?: string): boolean {
    return role === UserRole.ADMIN || role === UserRole.STAFF;
  }

  private assertCanReadProjectList(req: AuthenticatedRequest, targetUserId: string): void {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User authentication required');
    }

    if (requesterId === targetUserId || this.isPrivilegedRole(req.user?.role)) {
      return;
    }

    throw new ForbiddenException('You can only access your own project list');
  }

  private assertCanReadProjectDetail(req: AuthenticatedRequest, project: { clientId: string; brokerId: string; freelancerId?: string | null }): void {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User authentication required');
    }

    if (this.isPrivilegedRole(req.user?.role)) {
      return;
    }

    const isParticipant =
      requesterId === project.clientId ||
      requesterId === project.brokerId ||
      requesterId === project.freelancerId;

    if (!isParticipant) {
      throw new ForbiddenException('You are not authorized to access this project');
    }
  }

  @Get('list/:userId')
  listByUser(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: AuthenticatedRequest) {
    this.assertCanReadProjectList(req, userId);
    return this.projectsService.listByUser(userId);
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
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        (error instanceof Error &&
          (error.constructor.name === 'NotFoundException' ||
            error.constructor.name === 'ForbiddenException'))
      ) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to approve milestone ${id}: ${errorMessage}`);
      throw new InternalServerErrorException('Failed to approve milestone');
    }
  }
}
