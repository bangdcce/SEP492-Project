import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from '../../../database/entities/task.entity';

@Entity('task_links')
export class TaskLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('TaskEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;
}
