import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum WorkspaceMessageType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export interface WorkspaceMessageAttachment {
  url: string;
  name: string;
  type: string;
}

export interface WorkspaceMessageEditHistoryEntry {
  content: string;
  editedAt: string;
  editorId: string | null;
}

@Entity('workspace_messages')
@Index(['projectId', 'createdAt'])
@Index(['taskId', 'createdAt'])
export class WorkspaceMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: WorkspaceMessageType.USER,
  })
  messageType: WorkspaceMessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  attachments: WorkspaceMessageAttachment[] | null;

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  editHistory: WorkspaceMessageEditHistoryEntry[] | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  riskFlags: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: any;

  @ManyToOne('TaskEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'taskId' })
  task: any;
}

