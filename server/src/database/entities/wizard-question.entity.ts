import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity('wizard_questions')
export class WizardQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text', nullable: true })
  helpText: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  inputType: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relations
  @OneToMany('WizardOptionEntity', 'question')
  options: any[];

  @OneToMany('ProjectRequestAnswerEntity', 'question')
  answers: any[];
}
