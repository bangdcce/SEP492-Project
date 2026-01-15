import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';

export interface KanbanBoard {
  TODO: TaskEntity[];
  IN_PROGRESS: TaskEntity[];
  DONE: TaskEntity[];
}

export interface BoardWithMilestones {
  tasks: KanbanBoard;
  milestones: MilestoneEntity[];
}

export type KanbanStatus = TaskStatus.TODO | TaskStatus.IN_PROGRESS | TaskStatus.DONE;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
  ) {}

  async getKanbanBoard(projectId: string): Promise<BoardWithMilestones> {
    // Fetch all tasks for the project
    const tasks = await this.taskRepository.find({
      where: { projectId },
      relations: ['assignee'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

    // Fetch all milestones for the project
    const milestones = await this.milestoneRepository.find({
      where: { projectId },
      order: { startDate: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    // Group tasks by status
    const board: KanbanBoard = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };

    for (const task of tasks) {
      if (task.status === TaskStatus.TODO) {
        board.TODO.push(task);
      } else if (task.status === TaskStatus.IN_PROGRESS) {
        board.IN_PROGRESS.push(task);
      } else if (task.status === TaskStatus.DONE) {
        board.DONE.push(task);
      }
    }

    return {
      tasks: board,
      milestones,
    };
  }

  async updateStatus(id: string, status: KanbanStatus): Promise<TaskEntity> {
    await this.taskRepository.update(id, { status });
    const updated = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });
    if (!updated) {
      throw new NotFoundException('Task not found');
    }
    return updated;
  }

  async createTask(data: {
    title: string;
    description?: string;
    projectId: string;
    milestoneId: string;
  }): Promise<TaskEntity> {
    const newTask = this.taskRepository.create({
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      milestoneId: data.milestoneId,
      status: TaskStatus.TODO,
    });

    const saved = await this.taskRepository.save(newTask);

    const created = await this.taskRepository.findOne({
      where: { id: saved.id },
      relations: ['assignee'],
    });

    if (!created) {
      throw new NotFoundException('Task not found after creation');
    }

    return created;
  }
}
