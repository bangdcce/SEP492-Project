import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WizardQuestionEntity } from './wizard-question.entity';

@Entity('wizard_options')
export class WizardOptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'question_id' })
  questionId: number;

  @Column({ type: 'varchar' })
  value: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ name: 'sort_order', type: 'int', nullable: true })
  sortOrder: number;

  @ManyToOne('WizardQuestionEntity', 'options', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: any;
}
