
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { CreateProjectRequestDto } from './dto/create-project-request.dto';
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
      status: RequestStatus.PENDING,
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
        await this.auditLogsService.logCreate('ProjectRequest', savedRequest.id, fullRequest, req);
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
}
