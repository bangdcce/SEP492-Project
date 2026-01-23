import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import {
  CalendarEventEntity,
  EventType,
  EventStatus,
  EventPriority,
} from '../../database/entities/calendar-event.entity';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { SubmitTaskDto } from './dto/submit-task.dto';

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

/**
 * Response type for task status update
 * Includes the updated task AND milestone progress for real-time UI updates
 */
export interface TaskStatusUpdateResult {
  task: TaskEntity;
  milestoneId: string;
  milestoneProgress: number; // 0-100 percentage
  totalTasks: number;
  completedTasks: number;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarEventRepository: Repository<CalendarEventEntity>,
    private readonly auditLogsService: AuditLogsService,
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

  /**
   * Update task status and recalculate milestone progress
   * Returns both the updated task AND the new milestone progress for real-time UI updates
   */
  async updateStatus(id: string, status: KanbanStatus): Promise<TaskStatusUpdateResult> {
    // Step 1: Get the task to find its milestoneId
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = task.status;
    const milestoneId = task.milestoneId;

    // Step 2: Update the task status
    await this.taskRepository.update(id, { status });

    // Step 3: Refetch the updated task
    const updatedTask = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });

    if (!updatedTask) {
      throw new NotFoundException('Task not found after update');
    }

    this.logger.log(
      `Task ${id} status changed: ${previousStatus} → ${status} (Milestone: ${milestoneId})`,
    );

    // Step 4: Recalculate milestone progress
    const { progress, totalTasks, completedTasks } =
      await this.calculateMilestoneProgress(milestoneId);

    this.logger.log(
      `Milestone ${milestoneId} progress: ${completedTasks}/${totalTasks} = ${progress}%`,
    );

    return {
      task: updatedTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    };
  }

  /**
   * Submit task with proof of work
   * Moves task to DONE status with required evidence for dispute resolution
   *
   * @param id - Task ID
   * @param dto - SubmitTaskDto with proofLink and optional submissionNote
   * @param actorId - User ID of the person submitting (for audit log)
   * @param reqContext - Request context for audit logging
   * @throws BadRequestException if task is already done
   * @throws NotFoundException if task not found
   */
  async submitTask(
    id: string,
    dto: SubmitTaskDto,
    actorId?: string,
    reqContext?: RequestContext,
  ): Promise<TaskStatusUpdateResult> {
    // Step 1: Get the old task state (for audit logging)
    const oldTask = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });

    if (!oldTask) {
      throw new NotFoundException('Task not found');
    }

    // Check if task is already DONE
    if (oldTask.status === TaskStatus.DONE) {
      throw new BadRequestException('Task is already marked as done');
    }

    const previousStatus = oldTask.status;
    const milestoneId = oldTask.milestoneId;

    // Step 2: Prepare old data for audit log
    const oldData = {
      status: oldTask.status,
      submissionNote: oldTask.submissionNote,
      proofLink: oldTask.proofLink,
      submittedAt: oldTask.submittedAt,
    };

    // Step 3: Update the task with submission data
    const submittedAt = new Date();
    await this.taskRepository.update(id, {
      status: TaskStatus.DONE,
      submissionNote: dto.submissionNote ?? undefined,
      proofLink: dto.proofLink.trim(),
      submittedAt,
    });

    // Step 4: Refetch the updated task
    const updatedTask = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });

    if (!updatedTask) {
      throw new NotFoundException('Task not found after submission');
    }

    // Step 5: Prepare new data for audit log
    const newData = {
      status: TaskStatus.DONE,
      submissionNote: dto.submissionNote ?? undefined,
      proofLink: dto.proofLink.trim(),
      submittedAt,
    };

    // Step 6: Create audit log for task submission
    await this.auditLogsService.logUpdate('Task', id, oldData, newData, reqContext, actorId);

    this.logger.log(`Task ${id} submitted: ${previousStatus} → DONE | Proof: ${dto.proofLink}`);

    // Step 7: Recalculate milestone progress
    const { progress, totalTasks, completedTasks } =
      await this.calculateMilestoneProgress(milestoneId);

    this.logger.log(
      `Milestone ${milestoneId} progress after submission: ${completedTasks}/${totalTasks} = ${progress}%`,
    );

    return {
      task: updatedTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    };
  }

  /**
   * Calculate milestone progress based on completed tasks
   * Formula: (DONE tasks / Total tasks) * 100
   */
  private async calculateMilestoneProgress(milestoneId: string): Promise<{
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }> {
    // Count all tasks for this milestone
    const totalTasks = await this.taskRepository.count({
      where: { milestoneId },
    });

    if (totalTasks === 0) {
      return { progress: 0, totalTasks: 0, completedTasks: 0 };
    }

    // Count completed (DONE) tasks
    const completedTasks = await this.taskRepository.count({
      where: { milestoneId, status: TaskStatus.DONE },
    });

    // Calculate percentage (rounded to integer)
    const progress = Math.round((completedTasks / totalTasks) * 100);

    return { progress, totalTasks, completedTasks };
  }

  async createTask(data: {
    title: string;
    description?: string;
    projectId: string;
    milestoneId: string;
    specFeatureId?: string;
    startDate?: string;
    dueDate?: string;
    organizerId?: string; // User who created the task (for calendar)
  }): Promise<TaskEntity> {
    // Step A: Create the task
    const newTask = this.taskRepository.create({
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      milestoneId: data.milestoneId,
      status: TaskStatus.TODO,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });

    const saved = await this.taskRepository.save(newTask);
    this.logger.log(`Task created: ${saved.id} - ${saved.title}`);

    // Step B: Sync with Calendar (create calendar event if dates provided)
    if (data.startDate || data.dueDate) {
      await this.syncTaskToCalendar(saved, data.startDate, data.dueDate, data.organizerId);
    }

    const created = await this.taskRepository.findOne({
      where: { id: saved.id },
      relations: ['assignee'],
    });

    if (!created) {
      throw new NotFoundException('Task not found after creation');
    }

    return created;
  }

  /**
   * Sync Task to Calendar - Creates a CalendarEvent for the task
   * This enables the task to appear in Calendar views
   */
  private async syncTaskToCalendar(
    task: TaskEntity,
    startDate?: string,
    dueDate?: string,
    organizerId?: string,
  ): Promise<CalendarEventEntity | null> {
    try {
      // Determine start and end times
      const startTime = startDate ? new Date(startDate) : new Date();
      const endTime = dueDate ? new Date(dueDate) : new Date(startTime);

      // If only dueDate provided, set startTime to same day at 9 AM
      if (!startDate && dueDate) {
        startTime.setTime(endTime.getTime());
        startTime.setHours(9, 0, 0, 0);
        endTime.setHours(17, 0, 0, 0); // End at 5 PM
      }

      // Calculate duration in minutes
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      // Create calendar event linked to this task
      const calendarEvent = this.calendarEventRepository.create({
        type: EventType.TASK_DEADLINE,
        title: `Task: ${task.title}`,
        description: task.description || `Deadline for task: ${task.title}`,
        priority: EventPriority.MEDIUM,
        status: EventStatus.SCHEDULED,
        startTime,
        endTime,
        durationMinutes: Math.max(durationMinutes, 60), // Minimum 1 hour
        organizerId: organizerId || 'system', // Fallback to 'system' if no user
        referenceType: 'Task',
        referenceId: task.id,
        isAutoScheduled: true,
        metadata: {
          projectId: task.projectId,
          milestoneId: task.milestoneId,
          taskStatus: task.status,
        },
      });

      const savedEvent = await this.calendarEventRepository.save(calendarEvent);
      this.logger.log(`Calendar event created for task ${task.id}: ${savedEvent.id}`);

      return savedEvent;
    } catch (error: unknown) {
      // Log error but don't fail task creation
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to sync task to calendar: ${errorMessage}`, errorStack);
      return null;
    }
  }
}
