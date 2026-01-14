import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ProjectCategoryEntity } from './project-category.entity';

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  COMPLETED = 'COMPLETED',
  PAID = 'PAID',
  DISPUTED = 'DISPUTED',
  CANCELED = 'CANCELED',
}

export enum PricingModel {
  FIXED_PRICE = 'FIXED_PRICE',
  TIME_MATERIALS = 'TIME_MATERIALS',
}

@Entity('projects')
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  requestId: string;

  @Column()
  clientId: string;

  @Column()
  brokerId: string;

  @Column({ nullable: true })
  freelancerId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalBudget: number;

  @Column({ type: 'varchar', length: 10, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PricingModel,
    nullable: true,
  })
  pricingModel: PricingModel;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  status: ProjectStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ManyToOne('ProjectRequestEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requestId' })
  request: any;

  @ManyToOne('UserEntity', 'clientProjects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: any;

  @ManyToOne('UserEntity', 'brokerProjects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: any;

  @ManyToOne('UserEntity', 'freelancerProjects', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'freelancerId' })
  freelancer: any;

  @OneToMany('MilestoneEntity', 'project')
  milestones: any[];

  @OneToMany('ContractEntity', 'project')
  contracts: any[];

  @OneToMany('DocumentEntity', 'project')
  documents: any[];

  @ManyToMany(() => ProjectCategoryEntity)
  @JoinTable({
    name: 'project_category_map',
    joinColumn: {
      name: 'project_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'category_id',
      referencedColumnName: 'id',
    },
  })
  categories: ProjectCategoryEntity[];
}
