import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from '../../../database/entities/task.entity';
import { UserEntity } from '../../../database/entities/user.entity';

@Entity('task_attachments')
export class TaskAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  taskId: string;

  @Column()
  uploaderId: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 255, default: 'attachment' })
  fileName: string;

  @Column({ type: 'varchar', length: 50, default: 'image' })
  fileType: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('TaskEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: UserEntity;
}
