import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WizardQuestionEntity } from '../../database/entities/wizard-question.entity';
import { WizardOptionEntity } from '../../database/entities/wizard-option.entity';
import { UpdateWizardQuestionDto } from './dto/update-wizard-question.dto';
import { CreateWizardQuestionDto } from './dto/create-wizard-question.dto';

type WizardOptionMetadata = {
  recommendedProductTypes?: string[];
  group?: 'COMMON' | 'SPECIALIZED';
  templateTags?: string[];
  isSuggestedDefault?: boolean;
};

const normalizeWizardValue = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const FEATURE_OPTION_METADATA: Record<string, WizardOptionMetadata> = {
  AUTH: {
    recommendedProductTypes: ['ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'SYSTEM'],
    group: 'COMMON',
    templateTags: ['account', 'login'],
    isSuggestedDefault: true,
  },
  PRODUCT_CATALOG: {
    recommendedProductTypes: ['ECOMMERCE'],
    group: 'SPECIALIZED',
    templateTags: ['catalog', 'commerce'],
    isSuggestedDefault: true,
  },
  CART_PAYMENT: {
    recommendedProductTypes: ['ECOMMERCE'],
    group: 'SPECIALIZED',
    templateTags: ['checkout', 'commerce'],
    isSuggestedDefault: true,
  },
  BOOKING: {
    recommendedProductTypes: ['CORP_WEBSITE', 'WEB_APP', 'MOBILE_APP'],
    group: 'SPECIALIZED',
    templateTags: ['booking', 'service'],
  },
  CHAT: {
    recommendedProductTypes: ['WEB_APP', 'MOBILE_APP', 'ECOMMERCE'],
    group: 'SPECIALIZED',
    templateTags: ['communication'],
  },
  MAPS: {
    recommendedProductTypes: ['CORP_WEBSITE', 'WEB_APP', 'MOBILE_APP'],
    group: 'SPECIALIZED',
    templateTags: ['location'],
  },
  BLOG_NEWS: {
    recommendedProductTypes: ['LANDING_PAGE', 'CORP_WEBSITE'],
    group: 'SPECIALIZED',
    templateTags: ['content', 'seo'],
  },
  ADMIN_DASHBOARD: {
    recommendedProductTypes: ['ECOMMERCE', 'WEB_APP', 'SYSTEM'],
    group: 'COMMON',
    templateTags: ['operations', 'reporting'],
    isSuggestedDefault: true,
  },
  REPORTING: {
    recommendedProductTypes: ['WEB_APP', 'SYSTEM', 'ECOMMERCE'],
    group: 'COMMON',
    templateTags: ['analytics'],
  },
  NOTIFICATIONS: {
    recommendedProductTypes: ['WEB_APP', 'MOBILE_APP', 'ECOMMERCE', 'SYSTEM'],
    group: 'COMMON',
    templateTags: ['communication'],
  },
  MULTI_LANG: {
    recommendedProductTypes: ['LANDING_PAGE', 'CORP_WEBSITE', 'ECOMMERCE'],
    group: 'SPECIALIZED',
    templateTags: ['content', 'localization'],
  },
};

const PRODUCT_TYPE_OPTION_METADATA: Record<string, WizardOptionMetadata> = {
  LANDING_PAGE: { templateTags: ['LANDING_PAGE_STARTER'], isSuggestedDefault: true },
  CORP_WEBSITE: { templateTags: ['LANDING_PAGE_STARTER'] },
  ECOMMERCE: { templateTags: ['ECOMMERCE_STANDARD'], isSuggestedDefault: true },
  E_COMMERCE: { templateTags: ['ECOMMERCE_STANDARD'], isSuggestedDefault: true },
  WEB_APP: { templateTags: ['SAAS_PORTAL'], isSuggestedDefault: true },
  SAAS: { templateTags: ['SAAS_PORTAL'], isSuggestedDefault: true },
  MARKETPLACE: { templateTags: ['SERVICE_MARKETPLACE'] },
  MOBILE_APP: { templateTags: ['SERVICE_MARKETPLACE'] },
  SYSTEM: { templateTags: ['SAAS_PORTAL'] },
};

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

    return questions.map((question) => ({
      ...question,
      options: (question.options || []).map((option) => ({
        ...option,
        ...this.getOptionMetadata(question.code, option),
      })),
    }));
  }

  private getOptionMetadata(
    questionCode: string,
    option: Pick<WizardOptionEntity, 'value' | 'label'>,
  ): WizardOptionMetadata {
    const normalizedValue = normalizeWizardValue(option.value || option.label);

    if (questionCode === 'FEATURES') {
      return FEATURE_OPTION_METADATA[normalizedValue] || { group: 'SPECIALIZED' };
    }

    if (questionCode === 'PRODUCT_TYPE') {
      return PRODUCT_TYPE_OPTION_METADATA[normalizedValue] || {};
    }

    return {};
  }

  // ===== ADMIN METHODS =====

  async createQuestion(createDto: CreateWizardQuestionDto) {
    // Ensure code is unique
    const existing = await this.questionRepo.findOne({ where: { code: createDto.code } });
    if (existing) {
      throw new BadRequestException(`Wizard question with code "${createDto.code}" already exists`);
    }

    // Determine sort order (append to end by default)
    const currentCount = await this.questionRepo.count();
    const sortOrder = createDto.sortOrder ?? currentCount + 1;

    const question = this.questionRepo.create({
      code: createDto.code,
      label: createDto.label,
      helpText: createDto.helpText,
      inputType: createDto.inputType,
      isActive: createDto.isActive ?? true,
      sortOrder,
    });

    const savedQuestion = await this.questionRepo.save(question);

    // Create options if provided
    if (createDto.options && Array.isArray(createDto.options)) {
      const options = createDto.options.map((opt, index) =>
        this.optionRepo.create({
          questionId: savedQuestion.id,
          value: opt.value,
          label: opt.label,
          sortOrder: opt.sortOrder ?? index + 1,
        }),
      );
      await this.optionRepo.save(options);
    }

    return this.getQuestionDetailForAdmin(savedQuestion.id);
  }

  async getAllQuestionsForAdmin() {
    // Fetch ALL questions (including inactive)
    const questions = await this.questionRepo.find({
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

  async getQuestionDetailForAdmin(id: number) {
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['options'],
      order: {
        options: {
          sortOrder: 'ASC',
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Wizard question with ID ${id} not found`);
    }

    return question;
  }

  async updateQuestion(id: number, updateDto: UpdateWizardQuestionDto) {
    // Find existing question
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['options'],
    });

    if (!question) {
      throw new NotFoundException(`Wizard question with ID ${id} not found`);
    }

    // Update question fields
    if (updateDto.code !== undefined) question.code = updateDto.code;
    if (updateDto.label !== undefined) question.label = updateDto.label;
    if (updateDto.helpText !== undefined) question.helpText = updateDto.helpText;
    if (updateDto.inputType !== undefined) question.inputType = updateDto.inputType;
    if (updateDto.isActive !== undefined) question.isActive = updateDto.isActive;
    if (updateDto.sortOrder !== undefined) question.sortOrder = updateDto.sortOrder;

    await this.questionRepo.save(question);

    // Update options if provided
    if (updateDto.options && Array.isArray(updateDto.options)) {
      // Get existing option IDs
      const existingOptionIds = question.options.map(opt => opt.id);
      const updatedOptionIds = updateDto.options
        .filter(opt => opt.id)
        .map(opt => opt.id);

      // Delete options that are not in the updated list
      const optionsToDelete = existingOptionIds.filter(
        id => !updatedOptionIds.includes(id),
      );
      if (optionsToDelete.length > 0) {
        await this.optionRepo.delete(optionsToDelete);
      }

      // Update or create options
      for (const optionDto of updateDto.options) {
        if (optionDto.id) {
          // Update existing option
          const existingOption = question.options.find(opt => opt.id === optionDto.id);
          if (existingOption) {
            existingOption.value = optionDto.value;
            existingOption.label = optionDto.label;
            existingOption.sortOrder = optionDto.sortOrder ?? existingOption.sortOrder;
            await this.optionRepo.save(existingOption);
          }
        } else {
          // Create new option
          const newOption = this.optionRepo.create({
            questionId: id,
            value: optionDto.value,
            label: optionDto.label,
            sortOrder: optionDto.sortOrder ?? 0,
          });
          await this.optionRepo.save(newOption);
        }
      }
    }

    // Fetch updated question with options
    return this.getQuestionDetailForAdmin(id);
  }

  async deleteQuestion(id: number) {
    const question = await this.questionRepo.findOne({ where: { id } });

    if (!question) {
      throw new NotFoundException(`Wizard question with ID ${id} not found`);
    }

    // Check if question has answers (used in project requests)
    // If so, set inactive instead of hard delete
    const hasAnswers = await this.questionRepo
      .createQueryBuilder('q')
      .innerJoin('q.answers', 'a')
      .where('q.id = :id', { id })
      .getCount();

    if (hasAnswers > 0) {
      // Soft delete: set isActive to false
      question.isActive = false;
      await this.questionRepo.save(question);
      return {
        message: 'Question has been deactivated (soft delete) because it has existing answers',
        deleted: false,
        deactivated: true,
      };
    }

    // Hard delete if no answers
    await this.questionRepo.remove(question);
    return {
      message: 'Question deleted successfully',
      deleted: true,
      deactivated: false,
    };
  }
}
