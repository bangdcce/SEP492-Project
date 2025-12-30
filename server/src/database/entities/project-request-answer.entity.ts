import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('project_request_answers')
export class ProjectRequestAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ name: 'option_id', nullable: true })
  optionId: string;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText: string;

  @ManyToOne('ProjectRequestEntity', 'answers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: any;

  @ManyToOne('WizardQuestionEntity', 'answers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: any;

  @ManyToOne('WizardOptionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'option_id' })
  option: any;
}
