import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { WizardOptionEntity } from './wizard-option.entity';
import { ProjectRequestAnswerEntity } from './project-request-answer.entity';

@Entity('wizard_questions')
export class WizardQuestionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText: string;

  @Column({ name: 'input_type', type: 'varchar', nullable: true })
  inputType: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  // Relations
  @OneToMany(() => WizardOptionEntity, (option) => option.question)
  options: WizardOptionEntity[];

  @OneToMany(() => ProjectRequestAnswerEntity, (answer) => answer.question)
  answers: ProjectRequestAnswerEntity[];
}
