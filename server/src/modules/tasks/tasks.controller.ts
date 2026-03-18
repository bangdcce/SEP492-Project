import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Logger,
  InternalServerErrorException,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import {
  TasksService,
  BoardWithMilestones,
  KanbanStatus,
  TaskStatusUpdateResult,
  SubmissionReviewResult,
  ProjectRecentActivityItem,
} from './tasks.service';
import { TaskEntity, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { CreateTaskLinkDto } from './dto/create-task-link.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { LinkSubtaskDto } from './dto/link-subtask.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { UserRole } from '../../database/entities/user.entity';

// Interface for authenticated request with user context
interface AuthenticatedRequest {
  user?: { id: string; role?: UserRole };
  ip?: string;
  method: string;
  path: string;
  get: (header: string) => string | undefined;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(private readonly tasksService: TasksService) {}

  @Get('board/:projectId')
  async getBoard(@Param('projectId') projectId: string): Promise<BoardWithMilestones> {
    try {
      this.logger.log(`Fetching board for project: ${projectId}`);
      return await this.tasksService.getKanbanBoard(projectId);
    } catch (error) {
      this.logger.error(`Error fetching board for project ${projectId}:`, error);
      throw new InternalServerErrorException('Failed to fetch project board');
    }
  }

  @Get('project/:projectId/recent-activity')
  getProjectRecentActivity(
    @Param('projectId') projectId: string,
  ): Promise<ProjectRecentActivityItem[]> {
    return this.tasksService.getProjectRecentActivity(projectId);
  }

  @Get(':id/history')
  getTaskHistory(@Param('id') id: string) {
    return this.tasksService.getTaskHistory(id);
  }

  @Get(':id/comments')
  getTaskComments(@Param('id') id: string) {
    return this.tasksService.getTaskComments(id);
  }

  @Get(':id/links')
  getTaskLinks(@Param('id') id: string) {
    return this.tasksService.getTaskLinks(id);
  }

  @Get(':id/submissions')
  getTaskSubmissions(@Param('id') id: string) {
    return this.tasksService.getTaskSubmissions(id);
  }

  @Post(':id/links')
  addTaskLink(@Param('id') id: string, @Body() body: CreateTaskLinkDto) {
    return this.tasksService.addTaskLink(id, body);
  }

  @Delete(':id/links/:linkId')
  async deleteTaskLink(@Param('id') id: string, @Param('linkId') linkId: string) {
    await this.tasksService.deleteTaskLink(id, linkId);
    return { success: true };
  }

  @Get(':id/subtasks')
  getSubtasks(@Param('id') id: string) {
    return this.tasksService.getSubtasks(id);
  }

  @Post(':id/subtasks')
  createSubtask(@Param('id') id: string, @Body() body: CreateSubtaskDto) {
    return this.tasksService.createSubtask(id, body);
  }

  @Post(':id/subtasks/link')
  linkSubtask(@Param('id') id: string, @Body() body: LinkSubtaskDto) {
    return this.tasksService.linkExistingSubtask(id, body.subtaskId);
  }

  @Post('upload-attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  )
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.tasksService.uploadFile(file);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body('content') content: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!content) throw new BadRequestException('Content is required');
    // JwtAuthGuard ensures user exists, but TS needs reassurance or fallback
    return this.tasksService.addComment(id, content, req.user?.id || 'SYSTEM');
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<TaskStatusUpdateResult> {
    const allowed: TaskStatus[] = [
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS,
      TaskStatus.IN_REVIEW,
      TaskStatus.REVISIONS_REQUIRED,
      TaskStatus.DONE,
    ];

    if (!allowed.includes(status as TaskStatus)) {
      throw new BadRequestException('Invalid status');
    }

    return this.tasksService.updateStatus(id, status as KanbanStatus, req.user?.id);
  }

  @Post(':id/submissions')
  submitWork(
    @Param('id') id: string,
    @Body() dto: CreateSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.submitWork(id, dto, req.user?.id || 'SYSTEM');
  }

  /**
   * Review a task submission (Approve or Request Changes)
   * 
   * SECURITY: Only CLIENT or STAFF users can review submissions
   * Freelancers cannot review their own work
   * 
   * @param id - Task ID
   * @param submissionId - Submission ID to review
   * @param dto - ReviewSubmissionDto with status and optional reviewNote
   * @param req - Request object for user context
   */
  @Patch(':id/submissions/:submissionId/review')
  async reviewSubmission(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubmissionReviewResult> {
    const currentUser = req.user;

    // Security Check: Only CLIENT or STAFF can review submissions
    if (!currentUser) {
      throw new ForbiddenException('Authentication required');
    }

    const userRole = currentUser.role?.toUpperCase();
    const canReview =
      userRole === 'CLIENT' ||
      userRole === UserRole.CLIENT ||
      userRole === 'STAFF' ||
      userRole === UserRole.STAFF;

    if (!canReview) {
      throw new ForbiddenException(
        'Only Clients or Staff can review submissions. Freelancers cannot review their own work.',
      );
    }

    this.logger.log(
      `Submission review: Task ${id}, Submission ${submissionId}, Status: ${dto.status}, Reviewer: ${currentUser.id}`,
    );

    return this.tasksService.reviewSubmission(
      id,
      submissionId,
      dto,
      currentUser.id,
      currentUser.role,
    );
  }

  @Patch(':id')
  async updateTask(
    @Param('id') id: string,
    @Body() body: Partial<TaskEntity>,
    @Req() req: AuthenticatedRequest,
  ) {
    this.logger.log(`Update Task ${id} requested by user: ${req.user?.id || 'ANONYMOUS'}`);
    return this.tasksService.updateTask(id, body, req.user?.id);
  }

  @Post()
  async createTask(
    @Body()
    body: {
      title: string;
      description?: string;
      projectId: string;
      milestoneId: string;
      specFeatureId?: string;
      startDate?: string;
      dueDate?: string;
      priority?: TaskPriority;
      storyPoints?: number;
      labels?: string[];
      reporterId?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body?.title || !body?.projectId || !body?.milestoneId) {
      throw new BadRequestException('title, projectId and milestoneId are required');
    }

    const reporterId = body.reporterId || req.user?.id;

    this.logger.log(`Creating task: ${body.title} for project ${body.projectId}`);

    return this.tasksService.createTask({
      title: body.title,
      description: body.description,
      projectId: body.projectId,
      milestoneId: body.milestoneId,
      specFeatureId: body.specFeatureId,
      startDate: body.startDate,
      dueDate: body.dueDate,
      priority: body.priority,
      storyPoints: body.storyPoints,
      labels: body.labels,
      reporterId,
    });
  }
}
