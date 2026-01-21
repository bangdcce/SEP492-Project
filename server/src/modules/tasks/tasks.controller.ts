import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Logger,
  InternalServerErrorException,
  Req,
} from '@nestjs/common';
import {
  TasksService,
  BoardWithMilestones,
  KanbanStatus,
  TaskStatusUpdateResult,
} from './tasks.service';
import { TaskStatus } from '../../database/entities/task.entity';
import { SubmitTaskDto } from './dto/submit-task.dto';

// Interface for authenticated request with user context
interface AuthenticatedRequest {
  user?: { id: string };
  ip?: string;
  method: string;
  path: string;
  get: (header: string) => string | undefined;
}

@Controller('tasks')
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

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ): Promise<TaskStatusUpdateResult> {
    const allowed: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];

    if (!allowed.includes(status as TaskStatus)) {
      throw new BadRequestException('Invalid status');
    }

    return this.tasksService.updateStatus(id, status as KanbanStatus);
  }

  /**
   * Submit task with proof of work
   * Freelancer marks task as DONE with evidence (proof link required)
   *
   * @param id - Task ID
   * @param dto - SubmitTaskDto (validated by ValidationPipe)
   * @param req - Request object for audit logging context
   */
  @Post(':id/submit')
  async submitTask(
    @Param('id') id: string,
    @Body() dto: SubmitTaskDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TaskStatusUpdateResult> {
    this.logger.log(`Task submission: ${id} | Proof: ${dto.proofLink}`);

    // Extract actor ID from authenticated user (if available)
    const actorId = req.user?.id;

    // Extract request context for audit logging
    const reqContext = {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
    };

    return await this.tasksService.submitTask(id, dto, actorId, reqContext);
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
    },
  ) {
    if (!body?.title || !body?.projectId || !body?.milestoneId) {
      throw new BadRequestException('title, projectId and milestoneId are required');
    }

    this.logger.log(`Creating task: ${body.title} for project ${body.projectId}`);

    return this.tasksService.createTask({
      title: body.title,
      description: body.description,
      projectId: body.projectId,
      milestoneId: body.milestoneId,
      specFeatureId: body.specFeatureId,
      startDate: body.startDate,
      dueDate: body.dueDate,
    });
  }
}
