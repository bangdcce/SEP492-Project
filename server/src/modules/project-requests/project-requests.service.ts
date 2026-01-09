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
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { BrokerProposalEntity, ProposalStatus } from '../../database/entities/broker-proposal.entity';

@Injectable()
export class ProjectRequestsService {
  constructor(
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepo: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectRequestAnswerEntity)
    private readonly answerRepo: Repository<ProjectRequestAnswerEntity>,
    @InjectRepository(BrokerProposalEntity)
    private readonly brokerProposalRepo: Repository<BrokerProposalEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ... (existing create/update methods)

  async create(clientId: any, dto: CreateProjectRequestDto, req: any) {
    // ... same as before
    const request = this.requestRepo.create({
      clientId: clientId,
      title: dto.title,
      description: dto.description,
      budgetRange: dto.budgetRange,
      intendedTimeline: dto.intendedTimeline,
      techPreferences: dto.techPreferences,
      // Default to PUBLIC_DRAFT for new drafts
      status: dto.isDraft ? RequestStatus.PUBLIC_DRAFT : RequestStatus.PENDING_SPECS,
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

  // ... existing methods ...
  
  // (No changes needed for simple lookups)

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
    if (dto.status) {
        request.status = dto.status;
    }
    
    // Legacy/Boolean handling (isDraft) - Only apply if status NOT explicitly set (or if we want to support both mixed)
    // If user sends isDraft=false, we generally mean "Submit/Publish".
    if (!dto.status && request.status !== RequestStatus.PENDING_SPECS && dto.isDraft === false) {
       // Only transition to PENDING_SPECS if we are in a draft state
       if (
        request.status === RequestStatus.DRAFT || 
        request.status === RequestStatus.PUBLIC_DRAFT || 
        request.status === RequestStatus.PRIVATE_DRAFT
       ) {
         request.status = RequestStatus.PENDING_SPECS;
       }
    }

    if (!dto.status && dto.isDraft === true) {
      request.status = RequestStatus.PUBLIC_DRAFT;
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

  async findAllByClient(clientId: string) {
    return this.requestRepo.find({
      where: { clientId },
      relations: ['answers', 'answers.question', 'answers.option'],
      order: { createdAt: 'DESC' },
    });
  }

  async findDraftsByClient(clientId: string) {
    return this.requestRepo.find({
      where: { clientId, status: RequestStatus.DRAFT },
      relations: ['answers', 'answers.question', 'answers.option'],
      order: { createdAt: 'DESC' },
    });
  }


  async findOne(id: string) {
    return this.requestRepo.findOne({
      where: { id },
      relations: ['answers', 'answers.question', 'answers.option', 'client', 'brokerProposals', 'brokerProposals.broker'],
    });
  }

  async findMatches(id: string) {
    // For now, return all brokers. In future, implement matching logic based on techPreferences vs Broker Skills.
    // Query UserEntity where role = BROKER
    // Since we don't have UserRepo injected here, we might need to inject it or use QueryBuilder if possible.
    // Or simpler, just return empty list or mock if we can't access Users easily.
    // Actually, let's just use a raw query or try to inject UserRepo if possible.
    // Wait, UserEntity IS imported. We should InjectRepository(UserEntity).
    
    // Instead of changing constructor too much (risk breaking tests/module), 
    // I will try to use `this.requestRepo.manager.getRepository(UserEntity)`.
    const userRepo = this.requestRepo.manager.getRepository(UserEntity);
    const brokers = await userRepo.find({ where: { role: UserRole.BROKER } });
    
    // Exclude already invited/applied
    // Fetch proposals
    const existingProposals = await this.brokerProposalRepo.find({ where: { requestId: id } });
    const involvedBrokerIds = new Set(existingProposals.map(p => p.brokerId));
    
    return brokers.filter(b => !involvedBrokerIds.has(b.id));
  }

  async inviteBroker(requestId: string, brokerId: string) {
    const proposal = this.brokerProposalRepo.create({
        requestId,
        brokerId,
        status: ProposalStatus.INVITED,
    });
    return this.brokerProposalRepo.save(proposal);
  }

  async applyToRequest(requestId: string, brokerId: string, coverLetter: string) {
     const proposal = this.brokerProposalRepo.create({
        requestId,
        brokerId,
        coverLetter,
        status: ProposalStatus.PENDING,
    });
    return this.brokerProposalRepo.save(proposal);
  }
}
