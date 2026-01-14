import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ProjectRequestsService {
  constructor(
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepo: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectRequestAnswerEntity)
    private readonly answerRepo: Repository<ProjectRequestAnswerEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(clientId: any, dto: CreateProjectRequestDto, req: any) {
    // Create the main request
    const request = this.requestRepo.create({
      clientId: clientId,
      title: dto.title,
      description: dto.description,
      budgetRange: dto.budgetRange,
      intendedTimeline: dto.intendedTimeline,
      techPreferences: dto.techPreferences,
      status: dto.isDraft ? RequestStatus.DRAFT : RequestStatus.PENDING,
    });

    const savedRequest = await this.requestRepo.save(request);

    // Create answers
    if (dto.answers && dto.answers.length > 0) {
      const answers = dto.answers.map((ans) =>
        this.answerRepo.create({
          requestId: savedRequest.id,
          questionId: ans.questionId,
          optionId: ans.optionId,
          valueText: ans.valueText,
        }),
      );
      await this.answerRepo.save(answers);
    }

    // Return the full request with answers
    const fullRequest = await this.requestRepo.findOne({
      where: { id: savedRequest.id },
      relations: ['answers', 'answers.question', 'answers.option'],
    });

    // Audit Log
    try {
      if (fullRequest) {
        await this.auditLogsService.logCreate(
          'ProjectRequest',
          savedRequest.id,
          fullRequest as unknown as Record<string, unknown>,
          req,
        );
      }
    } catch (error) {
      console.error('Audit log failed', error);
    }

    return fullRequest;
  }

  async findAllByClient(clientId: string) {
    return this.requestRepo.find({
      where: { clientId },
      relations: ['answers'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    return this.requestRepo.findOne({
      where: { id },
      relations: ['answers', 'answers.question', 'answers.option'],
    });
  }

  async update(id: string, dto: UpdateProjectRequestDto) {
    const request = await this.findOne(id);
    if (!request) {
      throw new Error('Request not found');
    }

    // Update main fields
    if (dto.title) request.title = dto.title;
    if (dto.description) request.description = dto.description;
    if (dto.budgetRange) request.budgetRange = dto.budgetRange;
    if (dto.intendedTimeline) request.intendedTimeline = dto.intendedTimeline;
    if (dto.techPreferences) request.techPreferences = dto.techPreferences;

    // Manage status
    if (request.status === RequestStatus.DRAFT && dto.isDraft === false) {
      request.status = RequestStatus.PENDING;
    }
    if (dto.isDraft === true) {
      request.status = RequestStatus.DRAFT;
    }

    await this.requestRepo.save(request);

    // Update answers if provided
    if (dto.answers && dto.answers.length > 0) {
      await this.answerRepo.delete({ requestId: id });

      const answers = dto.answers.map((ans) =>
        this.answerRepo.create({
          requestId: id,
          questionId: ans.questionId,
          optionId: ans.optionId,
          valueText: ans.valueText,
        }),
      );
      await this.answerRepo.save(answers);
    }

    return this.findOne(id);
  }

  async findDraftsByClient(clientId: string) {
    return this.requestRepo.find({
      where: { clientId, status: RequestStatus.DRAFT },
      relations: ['answers', 'answers.question', 'answers.option'],
      order: { createdAt: 'DESC' },
    });
  }

  async findMatches(id: string) {
    const request = await this.findOne(id);
    if (!request) throw new Error('Request not found');

    const techPrefs = request.techPreferences
      ? request.techPreferences.split(',').map((s) => s.trim().toLowerCase())
      : [];

    const brokers = await this.requestRepo.manager
      .createQueryBuilder('UserEntity', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.role = :role', { role: 'BROKER' })
      .getMany();

    const scoredBrokers = brokers.map((broker) => {
      let score = 0;
      const skills = broker.profile?.skills?.map((s: string) => s.toLowerCase()) || [];

      const matchCount = techPrefs.filter((pref) => skills.includes(pref)).length;
      score += matchCount * 10;
      score += broker.currentTrustScore || 0;

      return { broker, score, matches: matchCount };
    });

    return scoredBrokers.filter((b) => b.score > 0).sort((a, b) => b.score - a.score);
  }
}
