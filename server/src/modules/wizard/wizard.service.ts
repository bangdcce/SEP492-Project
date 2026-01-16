import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WizardQuestionEntity } from '../../database/entities/wizard-question.entity';
import { WizardOptionEntity } from '../../database/entities/wizard-option.entity';

@Injectable()
export class WizardService {
  constructor(
    @InjectRepository(WizardQuestionEntity)
    private readonly questionRepo: Repository<WizardQuestionEntity>,
    @InjectRepository(WizardOptionEntity)
    private readonly optionRepo: Repository<WizardOptionEntity>,
  ) {}

  async getWizardData() {
    // Fetch questions with their options, sorted by sortOrder
    const questions = await this.questionRepo.find({
      where: { isActive: true },
      relations: ['options'],
      order: {
        sortOrder: 'ASC',
        options: {
          sortOrder: 'ASC',
        },
      },
    });

    return questions;
  }
}
