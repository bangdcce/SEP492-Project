import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('trust_score_history')
export class TrustScoreHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  ratingScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  behaviorScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  disputeScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  verificationScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  totalScore: number;

  @CreateDateColumn()
  calculatedAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
