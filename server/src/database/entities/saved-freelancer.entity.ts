import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

@Entity('saved_freelancers')
@Index(['clientId', 'freelancerId'], { unique: true })
export class SavedFreelancerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @Column()
  freelancerId: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne('UserEntity', 'savedFreelancers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'freelancerId' })
  freelancer: any;
}
