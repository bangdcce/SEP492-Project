import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('contracts')
export class ContractEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'varchar' })
  contractUrl: string;

  @Column({ type: 'text', nullable: true })
  termsContent: string;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', 'contracts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator: any;

  @OneToMany('DigitalSignatureEntity', 'contract')
  signatures: any[];
}
