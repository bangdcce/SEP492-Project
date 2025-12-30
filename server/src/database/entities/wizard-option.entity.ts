import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WizardQuestionEntity } from './wizard-question.entity';

@Entity('wizard_options')
export class WizardOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number;

  @ManyToOne(() => WizardQuestionEntity, (question) => question.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: WizardQuestionEntity;
}
