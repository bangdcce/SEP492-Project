import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ProjectSpecEntity } from './project-spec.entity';

@Entity('project_spec_signatures')
@Index(['specId', 'userId'], { unique: true })
export class ProjectSpecSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'specId' })
  specId: string;

  @Column({ name: 'userId' })
  userId: string;

  @Column({ name: 'signerRole', type: 'varchar', length: 32 })
  signerRole: string;

  @CreateDateColumn()
  signedAt: Date;

  @ManyToOne(() => ProjectSpecEntity, (spec) => spec.signatures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'specId' })
  spec: ProjectSpecEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
