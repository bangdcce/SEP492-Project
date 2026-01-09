import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

@Injectable()
export class ProjectRequestsService {
  constructor(
    @InjectRepository(ProjectRequestEntity)
    private readonly projectRequestRepository: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectRequestAnswerEntity)
    private readonly answerRepo: Repository<ProjectRequestAnswerEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async assignBroker(requestId: string, brokerId: string, req: any): Promise<ProjectRequestEntity> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lock the row to prevent race conditions (Pessimistic Write)
      // This ensures that if two brokers assign simultaneously, one waits for the other.
      const request = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(`Project request with ID ${requestId} not found`);
      }

      // 2. Validate Status and BrokerId
      if (request.status !== RequestStatus.PENDING) {
        throw new ConflictException(
          `Request cannot be processed. Current status: ${request.status}`,
        );
      }

      if (request.brokerId) {
        throw new ConflictException(
          `Request is already assigned to a broker (ID: ${request.brokerId})`,
        );
      }

      // 3. Update the request
      request.brokerId = brokerId;
      request.status = RequestStatus.PROCESSING;

      const savedRequest = await queryRunner.manager.save(request);

      // 4. Log the action
      await this.auditLogsService.logCustom(
        'ASSIGN_BROKER',
        'ProjectRequest',
        requestId,
        { brokerId, status: RequestStatus.PROCESSING },
        req, // Pass the request object here
        brokerId, // Actor ID
      );

      await queryRunner.commitTransaction();
      return savedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(status?: RequestStatus): Promise<ProjectRequestEntity[]> {
    const query = this.projectRequestRepository.createQueryBuilder('request');

    if (status) {
      query.where('request.status = :status', { status });
    }

    return await query.orderBy('request.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, user?: UserEntity): Promise<ProjectRequestEntity> {
    const request = await this.projectRequestRepository.findOne({
      where: { id },
      relations: [
        'client',
        'answers',
        'answers.question',
        'answers.option',
        'spec',
        'spec.milestones',
      ],
    });

    if (!request) {
      throw new NotFoundException(`Project request with ID ${id} not found`);
    }

    if (!user) return request; // If no user provided (internal call), return raw

    // Access Control Logic
    const isAdmin = user.role === UserRole.ADMIN;
    const isOwner = request.clientId === user.id;
    const isAssignedBroker = request.brokerId === user.id;
    const isPending = request.status === RequestStatus.PENDING;
    const isBroker = user.role === UserRole.BROKER;

    // 1. Admin: Allow all
    if (isAdmin) {
      return request;
    }

    // 2. Client: Must be owner
    if (user.role === UserRole.CLIENT && !isOwner) {
      throw new ForbiddenException('You do not have permission to view this request.');
    }

    // 3. Broker: Must be assigned OR request must be PENDING
    if (isBroker) {
      if (!isAssignedBroker && !isPending) {
        throw new ForbiddenException('You do not have permission to view this request.');
      }

      // Data Masking for Unassigned Brokers (PENDING requests)
      if (isPending && !isAssignedBroker) {
        if (request.client) {
          // Mask sensitive fields
          request.client.email = '********' as any;
          request.client.phoneNumber = '********' as any;
        }
      }
    }

    return request;
  }

  // --- Methods from Develop ---

  async create(clientId: any, dto: CreateProjectRequestDto, req: any) {
    // Create the main request
    const request = this.projectRequestRepository.create({
      clientId: clientId,
      title: dto.title,
      description: dto.description,
      budgetRange: dto.budgetRange,
      intendedTimeline: dto.intendedTimeline,
      techPreferences: dto.techPreferences,
      status: dto.isDraft ? RequestStatus.DRAFT : RequestStatus.PENDING,
    });

    const savedRequest = await this.projectRequestRepository.save(request);

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
    const fullRequest = await this.projectRequestRepository.findOne({
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
    return this.projectRequestRepository.find({
      where: { clientId },
      relations: ['answers'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateProjectRequestDto) {
    const request = await this.projectRequestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
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

    await this.projectRequestRepository.save(request);

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
    return this.projectRequestRepository.find({
      where: { clientId, status: RequestStatus.DRAFT },
      relations: ['answers', 'answers.question', 'answers.option'],
      order: { createdAt: 'DESC' },
    });
  }

  async findMatches(id: string) {
    const request = await this.projectRequestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');

    const techPrefs = request.techPreferences 
        ? request.techPreferences.split(',').map(s => s.trim().toLowerCase()) 
        : [];

    const brokers = await this.projectRequestRepository.manager.createQueryBuilder('UserEntity', 'user')
        .leftJoinAndSelect('user.profile', 'profile')
        .where('user.role = :role', { role: 'BROKER' })
        .getMany();

    const scoredBrokers = brokers.map(broker => {
        let score = 0;
        const skills = broker.profile?.skills?.map((s: string) => s.toLowerCase()) || [];
        
        const matchCount = techPrefs.filter(pref => skills.includes(pref)).length;
        score += matchCount * 10; 
        score += (broker.currentTrustScore || 0);

        return { broker, score, matches: matchCount };
    });

    return scoredBrokers
        .filter(b => b.score > 0)
        .sort((a, b) => b.score - a.score);
  }
}
