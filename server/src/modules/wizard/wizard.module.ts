import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WizardController } from './wizard.controller';
import { WizardAdminController } from './wizard-admin.controller';
import { WizardService } from './wizard.service';
import { WizardQuestionEntity } from '../../database/entities/wizard-question.entity';
import { WizardOptionEntity } from '../../database/entities/wizard-option.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WizardQuestionEntity, WizardOptionEntity])],
  controllers: [WizardController, WizardAdminController],
  providers: [WizardService],
  exports: [WizardService],
})
export class WizardModule {}
