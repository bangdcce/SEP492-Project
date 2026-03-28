import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import type { WorkspaceMessageAttachment, WorkspaceMessageEditHistoryEntry } from './workspace-message.entity';

export enum RequestMessageType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

@Entity('request_messages')
@Index(['requestId', 'createdAt'])
export class RequestMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  requestId: string;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: RequestMessageType.USER,
  })
  messageType: RequestMessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  attachments: WorkspaceMessageAttachment[] | null;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  editHistory: WorkspaceMessageEditHistoryEntry[] | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne('ProjectRequestEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: unknown;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: unknown;

  @ManyToOne(() => RequestMessageEntity, (message) => message.replies, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'replyToId' })
  replyTo: RequestMessageEntity | null;

  @OneToMany(() => RequestMessageEntity, (message) => message.replyTo)
  replies: RequestMessageEntity[];
}
