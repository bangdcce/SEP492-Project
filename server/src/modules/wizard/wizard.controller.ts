import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WizardService } from './wizard.service';
import { WizardQuestionEntity } from '../../database/entities/wizard-question.entity';

@ApiTags('Wizard')
@Controller('wizard')
export class WizardController {
  constructor(private readonly wizardService: WizardService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Get all wizard questions and options' })
  @ApiResponse({
    status: 200,
    description: 'List of active wizard questions with options.',
    type: [WizardQuestionEntity],
  })
  async getQuestions() {
    return this.wizardService.getWizardData();
  }
}
