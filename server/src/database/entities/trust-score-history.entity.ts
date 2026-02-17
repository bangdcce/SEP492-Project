import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('trust_score_history')
export class TrustScoreHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  ratingScore!: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  behaviorScore!: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  disputeScore!: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  verificationScore!: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  totalScore!: number | null;

  @CreateDateColumn()
  calculatedAt!: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: unknown;
}
