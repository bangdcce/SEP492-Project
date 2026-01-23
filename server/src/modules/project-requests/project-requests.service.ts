import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  BrokerProposalEntity,
  ProposalStatus,
} from '../../database/entities/broker-proposal.entity';

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

  async create(clientId: string, dto: CreateProjectRequestDto, req: RequestContext) {
    // ... same as before
    const request = this.requestRepo.create({
      clientId: clientId,
      title: dto.title,
      description: dto.description,
      budgetRange: dto.budgetRange,
      intendedTimeline: dto.intendedTimeline,
      techPreferences: dto.techPreferences,
      // Default to PUBLIC_DRAFT for new non-drafts
      status: dto.isDraft ? RequestStatus.DRAFT : RequestStatus.PUBLIC_DRAFT,
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

  async findAll(status?: RequestStatus) {
    const options: FindManyOptions<ProjectRequestEntity> = {
      relations: ['answers', 'answers.question', 'answers.option', 'client', 'broker'],
      order: { createdAt: 'DESC' },
    };
    if (status) {
      options.where = { status };
    }
    return this.requestRepo.find(options);
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
    if (dto.status) {
      // Phase 2: Toggle Visibility Logic
      // If Client switches PUBLIC -> PRIVATE: System automatically Denies all pending Broker applications.
      if (
        request.status === RequestStatus.PUBLIC_DRAFT &&
        dto.status === RequestStatus.PRIVATE_DRAFT
      ) {
        await this.denyPendingProposals(request.id);
      }
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

  async findOne(id: string, user?: UserEntity) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: [
        'answers',
        'answers.question',
        'answers.option',
        'client',
        'brokerProposals',
        'brokerProposals.broker',
        'spec',
        'spec.milestones',
      ],
    });
    
    for (const p of otherProposals) {
        if (p.brokerId !== brokerId) {
            p.status = ProposalStatus.REJECTED;
            await this.brokerProposalRepo.save(p);
        }
    }

    if (!request) return null;

    if (user) {
      if (user.role === UserRole.CLIENT && request.clientId !== user.id) {
        throw new Error('Forbidden: You can only view your own requests');
      }
    }

    return request;
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
    const involvedBrokerIds = new Set(existingProposals.map((p) => p.brokerId));

    return brokers.filter((b) => !involvedBrokerIds.has(b.id));
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

  // --- Broker Self-Assignment (C02) ---

  async assignBroker(requestId: string, brokerId: string, req?: RequestContext) {
    const request = await this.findOne(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Only allow assignment if request is PENDING (waiting for broker)
    if (request.status !== RequestStatus.PENDING) {
      throw new Error(
        `Cannot assign broker. Request status is ${request.status}, expected PENDING`,
      );
    }

    // Check if already has a broker
    if (request.brokerId) {
      throw new Error('Request already has a broker assigned');
    }

    // Assign broker and change status to PROCESSING
    request.brokerId = brokerId;
    request.status = RequestStatus.PROCESSING;

    const savedRequest = await this.requestRepo.save(request);

    // Audit Log
    try {
      await this.auditLogsService.logUpdate(
        'ProjectRequest',
        requestId,
        { brokerId: null, status: RequestStatus.PENDING },
        { brokerId, status: RequestStatus.PROCESSING },
        req,
      );
    } catch (error) {
      console.error('Audit log failed', error);
    }

    return savedRequest;
  }

  // --- Phase 2: Hire Broker ---

  async acceptBroker(requestId: string, brokerId: string) {
    const request = await this.findOne(requestId);
    if (!request) throw new Error('Request not found');

    // Expected state: PUBLIC_DRAFT or PRIVATE_DRAFT
    // Also possibly PENDING_SPECS if legacy
    if (
      request.status !== RequestStatus.PUBLIC_DRAFT &&
      request.status !== RequestStatus.PRIVATE_DRAFT &&
      request.status !== RequestStatus.PENDING_SPECS
    ) {
      throw new Error('Request is not in a valid state to accept a broker');
    }

    // 1. Assign Broker
    request.brokerId = brokerId;

    // 2. Change Status -> BROKER_ASSIGNED
    request.status = RequestStatus.BROKER_ASSIGNED;

    await this.requestRepo.save(request);

    // 3. Update Proposal Status
    // Update the successful proposal to ACCEPTED
    await this.brokerProposalRepo.update(
      { requestId, brokerId },
      { status: ProposalStatus.ACCEPTED },
    );

    // 4. Reject other Pending proposals?
    // "System automatically Denies all pending Broker applications" - mostly for mode switch, but usually implies exclusivity
    // We will reject all other PENDING proposals for this request
    const otherProposals = await this.brokerProposalRepo.find({
      where: { requestId, status: ProposalStatus.PENDING },
    });

    for (const p of otherProposals) {
      if (p.brokerId !== brokerId) {
        p.status = ProposalStatus.REJECTED;
        await this.brokerProposalRepo.save(p);
      }
    }

    return this.findOne(requestId);
  }

  private async denyPendingProposals(requestId: string) {
    const pendingProposals = await this.brokerProposalRepo.find({
      where: { requestId, status: ProposalStatus.PENDING },
    });
    for (const p of pendingProposals) {
      p.status = ProposalStatus.REJECTED; // or some DENIED status if available, REJECTED is fine
      await this.brokerProposalRepo.save(p);
    }
  }

  // --- Phase 3: Finalizing Specs ---

  async approveSpecs(requestId: string) {
    const request = await this.findOne(requestId);
    if (!request) throw new Error('Request not found');

    // logic: "Client clicks 'Approve Spec' -> Status changes to SPEC_APPROVED"
    if (
      request.status !== RequestStatus.BROKER_ASSIGNED &&
      request.status !== RequestStatus.PENDING_SPECS
    ) {
      console.warn('Approving specs from unexpected status:', request.status);
      // Allow it but log warning? Or strict check?
      // Strict check preferred for workflow integrity
      // throw new Error('Request must have a Broker Assigned to approve specs');
    }

    request.status = RequestStatus.SPEC_APPROVED;
    return this.requestRepo.save(request);
  }

  // --- Phase 5: Finalize Project ---

  async convertToProject(requestId: string) {
    const request = await this.findOne(requestId);
    if (!request) throw new Error('Request not found');

    // "Upon 3-way acceptance -> Create new Project entity. Move Request status to CONVERTED_TO_PROJECT."

    // TODO: Create Project Entity logic here (or call ProjectService)
    // e.g. const project = await this.projectService.createFromRequest(request);

    request.status = RequestStatus.CONVERTED_TO_PROJECT;
    return this.requestRepo.save(request);
  }
  async seedTestData(clientId: string) {
    // 0. Validate Client
    const userRepo = this.requestRepo.manager.getRepository(UserEntity);
    let client = await userRepo.findOne({ where: { id: clientId } });
    if (!client) {
      console.log(`Client ${clientId} not found. Creating dummy client...`);
      client = userRepo.create({
        id: clientId,
        email: `test.client.${Date.now()}@interdev.com`, // Unique email
        fullName: 'Test Client',
        role: UserRole.CLIENT,
        passwordHash: 'hashed_dummy_password',
        isVerified: true,
      });
      await userRepo.save(client);
    }

    // 1. Find a Broker to assign
    let broker = await userRepo.findOne({ where: { email: 'test.broker@interdev.com' } });

    if (!broker) {
      broker = await userRepo.findOne({ where: { role: UserRole.BROKER } });
    }

    if (!broker) {
      // Create a dummy broker if none exists
      console.log('No broker found, creating dummy broker for testing...');
      broker = userRepo.create({
        email: `test.broker.${Date.now()}@interdev.com`, // Unique email
        fullName: 'Test Broker',
        role: UserRole.BROKER,
        passwordHash: 'hashed_dummy_password',
        isVerified: true,
      });
      await userRepo.save(broker);
    }

    const requests: ProjectRequestEntity[] = [];

    // 2. Create Phase 3 Request (SPEC_APPROVED) -> "Hire Freelancer" UI
    const phase3 = this.requestRepo.create({
      clientId,
      title: 'Test Project - Phase 3 (Freelancer Hiring)',
      description:
        'This is a generated test request in Phase 3. Specs are approved, now looking for freelancers.',
      budgetRange: '$5,000 - $10,000',
      intendedTimeline: '2 Months',
      techPreferences: 'React, NestJS, PostgreSQL',
      status: RequestStatus.SPEC_APPROVED,
      brokerId: broker.id,
      createdAt: new Date(),
    });
    requests.push(await this.requestRepo.save(phase3));

    // 3. Create Phase 4 Request (CONTRACT_PENDING) -> "Contract" UI
    const phase4 = this.requestRepo.create({
      clientId,
      title: 'Test Project - Phase 4 (Contract)',
      description:
        'This is a generated test request in Phase 4. Freelancers found, contract pending.',
      budgetRange: '$15,000+',
      intendedTimeline: '4 Months',
      techPreferences: 'Flutter, Firebase',
      status: RequestStatus.CONTRACT_PENDING,
      brokerId: broker.id,
      createdAt: new Date(),
    });
    requests.push(await this.requestRepo.save(phase4));

    return requests;
  }
}
