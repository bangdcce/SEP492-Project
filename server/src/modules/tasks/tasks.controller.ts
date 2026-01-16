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
} from '@nestjs/common';
import { TasksService, BoardWithMilestones, KanbanStatus } from './tasks.service';
import { TaskStatus } from '../../database/entities/task.entity';

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
  async updateStatus(@Param('id') id: string, @Body('status') status: KanbanStatus | string) {
    const allowed: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];

    if (!allowed.includes(status as TaskStatus)) {
      throw new BadRequestException('Invalid status');
    }

    return this.tasksService.updateStatus(id, status as KanbanStatus);
  }

  @Post()
  async createTask(
    @Body()
    body: {
      title: string;
      description?: string;
      projectId: string;
      milestoneId: string;
    },
  ) {
    if (!body?.title || !body?.projectId || !body?.milestoneId) {
      throw new BadRequestException('title, projectId and milestoneId are required');
    }

    return this.tasksService.createTask({
      title: body.title,
      description: body.description,
      projectId: body.projectId,
      milestoneId: body.milestoneId,
    });
  }
}
