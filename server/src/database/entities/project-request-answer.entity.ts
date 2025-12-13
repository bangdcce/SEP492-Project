import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('project_request_answers')
export class ProjectRequestAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column()
  questionId: string;

  @Column({ nullable: true })
  optionId: string;

  @Column({ type: 'text', nullable: true })
  valueText: string;

  @ManyToOne('ProjectRequestEntity', 'answers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: any;

  @ManyToOne('WizardQuestionEntity', 'answers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: any;

  @ManyToOne('WizardOptionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'optionId' })
  option: any;
}
