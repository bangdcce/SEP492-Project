import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TasksService, KanbanBoard, KanbanStatus } from './tasks.service';
import { TaskStatus } from '../../database/entities/task.entity';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('board/:projectId')
  async getBoard(@Param('projectId') projectId: string): Promise<KanbanBoard> {
    return this.tasksService.getKanbanBoard(projectId);
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
