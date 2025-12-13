import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('wizard_options')
export class WizardOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  questionId: string;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;

  @ManyToOne('WizardQuestionEntity', 'options', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: any;
}
