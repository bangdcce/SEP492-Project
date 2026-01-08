import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';

@Entity('profiles')
export class ProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  // Thêm vào ProfileEntity
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string;

  @Column({ type: 'text', array: true, nullable: true })
  skills: string[];

  @Column({ type: 'jsonb', nullable: true })
  portfolioLinks: Array<{ title: string; url: string }>;

  @Column({ type: 'jsonb', nullable: true })
  bankInfo: Record<string, any>;

  // Relations
  @OneToOne('UserEntity', 'profile', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
