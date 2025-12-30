import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { WizardOptionEntity } from './wizard-option.entity';
import { ProjectRequestAnswerEntity } from './project-request-answer.entity';

@Entity('wizard_questions')
export class WizardQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText: string;

  @Column({ name: 'input_type', type: 'varchar', length: 50, nullable: true })
  inputType: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relations
  @OneToMany(() => WizardOptionEntity, (option) => option.question)
  options: WizardOptionEntity[];

  @OneToMany(() => ProjectRequestAnswerEntity, (answer) => answer.question)
  answers: ProjectRequestAnswerEntity[];
}
