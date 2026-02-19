import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum HearingReminderType {
  T72H = 'T72H',
  T24H = 'T24H',
  T1H = 'T1H',
  T10M = 'T10M',
}

@Entity('hearing_reminder_deliveries')
@Unique('UQ_hearing_reminder_deliveries_hearing_user_type', ['hearingId', 'userId', 'reminderType'])
@Index('IDX_hearing_reminder_deliveries_hearing_type', ['hearingId', 'reminderType'])
@Index('IDX_hearing_reminder_deliveries_delivered_at', ['deliveredAt'])
export class HearingReminderDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hearingId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: HearingReminderType })
  reminderType: HearingReminderType;

  @Column({ type: 'timestamp' })
  scheduledFor: Date;

  @Column({ nullable: true })
  notificationId: string;

  @Column({ type: 'boolean', default: false })
  emailSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  emailSentAt: Date;

  @CreateDateColumn()
  deliveredAt: Date;

  @ManyToOne('DisputeHearingEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hearingId' })
  hearing: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @ManyToOne('NotificationEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'notificationId' })
  notification: any;
}
