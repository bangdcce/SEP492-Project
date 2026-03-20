import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, In, MoreThan } from 'typeorm';
import { QuotaService } from '../subscriptions/quota.service';
import { QuotaAction } from '../../database/entities/quota-usage-log.entity';
import {
  ProjectRequestEntity,
  ProjectRequestAttachmentMetadata,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ContractEntity } from '../../database/entities/contract.entity';
import {
  BrokerProposalEntity,
  ProposalStatus,
} from '../../database/entities/broker-proposal.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
} from '../../database/entities/project-spec.entity';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractsService } from '../contracts/contracts.service';

const BROKER_APPLICATION_CAP = 10;
const BROKER_APPLICATION_WINDOW_HOURS = 72;
const ACTIVE_BROKER_APPLICATION_STATUSES = [ProposalStatus.PENDING, ProposalStatus.INVITED] as const;

type BrokerHistorySummary = {
  projectId: string;
  title: string;
  status: ProjectStatus;
  updatedAt: Date;
};

type RequestFlowPhase =
  | 'REQUEST_INTAKE'
  | 'SPEC_WORKFLOW'
  | 'FREELANCER_SELECTION'
  | 'FINAL_SPEC_REVIEW'
  | 'CONTRACT'
  | 'PROJECT_CREATED';

@Injectable()
export class ProjectRequestsService {
  constructor(
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepo: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectRequestAnswerEntity)
    private readonly answerRepo: Repository<ProjectRequestAnswerEntity>,
    @InjectRepository(BrokerProposalEntity)
    private readonly brokerProposalRepo: Repository<BrokerProposalEntity>,
    @InjectRepository(ProjectRequestProposalEntity)
    private readonly freelancerProposalRepo: Repository<ProjectRequestProposalEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(ContractEntity)
    private readonly contractRepo: Repository<ContractEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly matchingService: MatchingService,
    private readonly quotaService: QuotaService,
    private readonly notificationsService: NotificationsService,
    private readonly contractsService: ContractsService,
  ) {}

  private toUserHandle(user?: Pick<UserEntity, 'email'> | null): string | null {
    if (!user?.email) {
      return null;
    }

    const localPart = user.email.split('@')[0]?.trim();
    return localPart ? `@${localPart}` : null;
  }

  private normalizeAttachments(
    attachments?: ProjectRequestAttachmentMetadata[] | null,
  ): ProjectRequestAttachmentMetadata[] {
    if (!attachments?.length) {
      return [];
    }

    return attachments
      .map((attachment) => ({
        filename: `${attachment?.filename || ''}`.trim(),
        url: `${attachment?.url || ''}`.trim(),
        mimetype: attachment?.mimetype?.trim() || null,
        size:
          typeof attachment?.size === 'number' && Number.isFinite(attachment.size)
            ? attachment.size
            : null,
        category:
          attachment?.category === 'requirements' ? 'requirements' : 'attachment',
      }))
      .filter((attachment) => attachment.filename.length > 0 && attachment.url.length > 0);
  }

  private getBrokerApplicationWindowStart(referenceAt: Date = new Date()): Date {
    return new Date(referenceAt.getTime() - BROKER_APPLICATION_WINDOW_HOURS * 60 * 60 * 1000);
  }

  private async getBrokerApplicationCapSummary(requestId: string, referenceAt: Date = new Date()) {
    const windowStart = this.getBrokerApplicationWindowStart(referenceAt);
    const activeApplications = await this.brokerProposalRepo.count({
      where: {
        requestId,
        status: In([...ACTIVE_BROKER_APPLICATION_STATUSES]),
        createdAt: MoreThan(windowStart),
      },
    });

    return {
      cap: BROKER_APPLICATION_CAP,
      windowHours: BROKER_APPLICATION_WINDOW_HOURS,
      activeApplications,
      remainingSlots: Math.max(0, BROKER_APPLICATION_CAP - activeApplications),
      hasCapacity: activeApplications < BROKER_APPLICATION_CAP,
      windowStartedAt: windowStart,
      windowEndsAt: new Date(windowStart.getTime() + BROKER_APPLICATION_WINDOW_HOURS * 60 * 60 * 1000),
    };
  }

  private async assertBrokerApplicationSlotAvailable(requestId: string): Promise<void> {
    const slotSummary = await this.getBrokerApplicationCapSummary(requestId);
    if (!slotSummary.hasCapacity) {
      throw new BadRequestException(
        `Broker application limit reached for this request. Only ${BROKER_APPLICATION_CAP} active applications are allowed within ${BROKER_APPLICATION_WINDOW_HOURS} hours.`,
      );
    }
  }

  private async loadProjectHistoryMap(
    roleKey: 'brokerId' | 'freelancerId',
    userIds: string[],
  ): Promise<Map<string, BrokerHistorySummary[]>> {
    const normalizedIds = Array.from(new Set(userIds.filter(Boolean)));
    if (normalizedIds.length === 0) {
      return new Map();
    }

    const projects = await this.projectRepo
      .createQueryBuilder('project')
      .select([
        'project.id',
        'project.title',
        'project.status',
        'project.updatedAt',
        `project.${roleKey}`,
      ])
      .where(`project.${roleKey} IN (:...userIds)`, { userIds: normalizedIds })
      .andWhere('project.status IN (:...statuses)', {
        statuses: [ProjectStatus.COMPLETED, ProjectStatus.IN_PROGRESS, ProjectStatus.TESTING],
      })
      .orderBy('project.updatedAt', 'DESC')
      .getMany();

    const result = new Map<string, BrokerHistorySummary[]>();
    for (const project of projects) {
      const ownerId = String(project[roleKey] || '');
      if (!ownerId) {
        continue;
      }

      const current = result.get(ownerId) || [];
      if (current.length >= 3) {
        continue;
      }
      current.push({
        projectId: project.id,
        title: project.title,
        status: project.status,
        updatedAt: project.updatedAt,
      });
      result.set(ownerId, current);
    }

    return result;
  }

  private async loadBrokerHistoryMap(
    brokerIds: string[],
  ): Promise<Map<string, BrokerHistorySummary[]>> {
    return this.loadProjectHistoryMap('brokerId', brokerIds);
  }

  private async loadFreelancerHistoryMap(
    freelancerIds: string[],
  ): Promise<Map<string, BrokerHistorySummary[]>> {
    return this.loadProjectHistoryMap('freelancerId', freelancerIds);
  }

  private resolveSelectedFreelancerProposal(request: ProjectRequestEntity) {
    const proposals = request.proposals || [];
    return (
      proposals.find((proposal) => String(proposal?.status || '').toUpperCase() === 'ACCEPTED') ||
      proposals.find((proposal) => String(proposal?.status || '').toUpperCase() === 'PENDING') ||
      null
    );
  }

  private toPhaseNumber(phase: RequestFlowPhase): number {
    switch (phase) {
      case 'REQUEST_INTAKE':
        return 1;
      case 'SPEC_WORKFLOW':
        return 2;
      case 'FREELANCER_SELECTION':
        return 3;
      case 'FINAL_SPEC_REVIEW':
        return 4;
      case 'CONTRACT':
      case 'PROJECT_CREATED':
        return 5;
      default:
        return 1;
    }
  }

  private pickLatestSpecByPhase(
    specs: Array<Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>>,
    phase: SpecPhase,
  ) {
    return [...specs]
      .filter((spec) => spec.specPhase === phase)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )[0] ?? null;
  }

  private buildFlowSnapshot(input: {
    request: ProjectRequestEntity;
    clientSpec: Pick<ProjectSpecEntity, 'id' | 'status'> | null;
    fullSpec: Pick<ProjectSpecEntity, 'id' | 'status'> | null;
    linkedProject: Pick<ProjectEntity, 'id' | 'status'> | null;
    linkedContract: Pick<ContractEntity, 'id' | 'status' | 'activatedAt'> | null;
  }) {
    const { request, clientSpec, fullSpec, linkedProject, linkedContract } = input;
    const selectedFreelancer = this.resolveSelectedFreelancerProposal(request);

    let phase: RequestFlowPhase =
      request.status === RequestStatus.CONVERTED_TO_PROJECT || linkedProject
        ? 'PROJECT_CREATED'
        : request.status === RequestStatus.CONTRACT_PENDING || linkedContract
          ? 'CONTRACT'
          : request.status === RequestStatus.SPEC_APPROVED || request.status === RequestStatus.HIRING
            ? 'FREELANCER_SELECTION'
            : request.status === RequestStatus.BROKER_ASSIGNED ||
                request.status === RequestStatus.PENDING_SPECS ||
                request.status === RequestStatus.SPEC_SUBMITTED
              ? 'SPEC_WORKFLOW'
              : 'REQUEST_INTAKE';

    if (fullSpec?.status === ProjectSpecStatus.FINAL_REVIEW) {
      phase = 'FINAL_SPEC_REVIEW';
    } else if (fullSpec?.status === ProjectSpecStatus.ALL_SIGNED) {
      phase = linkedContract ? 'CONTRACT' : 'FINAL_SPEC_SIGNED';
    } else if (clientSpec?.status === ProjectSpecStatus.CLIENT_REVIEW) {
      phase = 'CLIENT_SPEC_REVIEW';
    }

    return {
      phase,
      phaseNumber: this.toPhaseNumber(phase),
      status: request.status,
      brokerAssigned: Boolean(request.brokerId),
      freelancerSelected: Boolean(selectedFreelancer),
      clientSpecStatus: clientSpec?.status ?? null,
      fullSpecStatus: fullSpec?.status ?? null,
      linkedContractId: linkedContract?.id ?? null,
      linkedProjectId: linkedProject?.id ?? null,
      contractActivated: Boolean(linkedContract?.activatedAt),
      readOnly: Boolean(linkedProject) || request.status === RequestStatus.CONVERTED_TO_PROJECT,
      nextAction:
        phase === 'REQUEST_INTAKE'
          ? 'SELECT_BROKER'
          : phase === 'SPEC_WORKFLOW'
            ? 'REVIEW_OR_PREPARE_SPEC'
            : phase === 'FREELANCER_SELECTION'
              ? 'SELECT_FREELANCER'
              : phase === 'FINAL_SPEC_REVIEW'
                ? 'FINALIZE_SPEC'
                : phase === 'CONTRACT'
                  ? 'COMPLETE_CONTRACT_HANDOFF'
                  : 'OPEN_PROJECT',
    };
  }

  private buildViewerPermissions(input: {
    request: ProjectRequestEntity;
    user?: UserEntity;
    linkedProject: Pick<ProjectEntity, 'id'> | null;
    linkedContract: Pick<ContractEntity, 'id'> | null;
    flowSnapshot?: {
      phase: RequestFlowPhase;
      phaseNumber: number;
      status: RequestStatus;
      brokerAssigned: boolean;
      freelancerSelected: boolean;
      linkedContractId: string | null;
      linkedProjectId: string | null;
      contractActivated: boolean;
      readOnly: boolean;
      nextAction: string;
      clientSpecStatus: ProjectSpecStatus | null;
      fullSpecStatus: ProjectSpecStatus | null;
    };
  }) {
    const { request, user, linkedProject, linkedContract, flowSnapshot } = input;
    const role = user?.role;
    const isClient = role === UserRole.CLIENT && request.clientId === user?.id;
    const isAssignedBroker = role === UserRole.BROKER && request.brokerId === user?.id;
    const isInternal = role === UserRole.ADMIN || role === UserRole.STAFF;
    const isFreelancerViewer =
      role === UserRole.FREELANCER &&
      Boolean(
        request.proposals?.some(
          (proposal) =>
            proposal.freelancerId === user?.id &&
            ['INVITED', 'PENDING', 'ACCEPTED'].includes(String(proposal.status || '').toUpperCase()),
        ),
      );

    return {
      canViewRequest: Boolean(user),
      canViewSpecs: isClient || isAssignedBroker || isInternal || isFreelancerViewer,
      canViewBrokerMatches: isClient || isInternal,
      canInviteBroker: isClient && !request.brokerId && !flowSnapshot?.readOnly,
      canAcceptBroker: isClient && !request.brokerId && !flowSnapshot?.readOnly,
      canReleaseBrokerSlot: (isClient || isInternal) && !request.brokerId && !flowSnapshot?.readOnly,
      canApplyAsBroker:
        role === UserRole.BROKER &&
        !request.brokerId &&
        ![RequestStatus.CONVERTED_TO_PROJECT, RequestStatus.CONTRACT_PENDING].includes(request.status),
      canViewContract: Boolean(linkedContract),
      canOpenLinkedProject: Boolean(linkedProject),
      canInviteFreelancer:
        (isAssignedBroker || isInternal) &&
        Boolean(flowSnapshot?.clientSpecStatus === ProjectSpecStatus.CLIENT_APPROVED) &&
        !flowSnapshot?.freelancerSelected &&
        !flowSnapshot?.readOnly,
      canRespondAsFreelancer:
        isFreelancerViewer &&
        !flowSnapshot?.readOnly &&
        flowSnapshot?.phaseNumber >= 3,
      canInitializeContract:
        (isAssignedBroker || isInternal) &&
        flowSnapshot?.fullSpecStatus === ProjectSpecStatus.ALL_SIGNED &&
        !linkedContract,
    };
  }

  private buildBrokerSelectionSummary(input: {
    request: ProjectRequestEntity;
    brokerApplications: Array<{
      id: string;
      status: string;
      coverLetter?: string | null;
      createdAt?: Date | null;
      broker?: {
        id: string;
        fullName?: string | null;
        email?: string | null;
        handle?: string | null;
        currentTrustScore?: number | null;
        totalProjectsFinished?: number | null;
        totalDisputesLost?: number | null;
        recentProjects?: Array<BrokerHistorySummary>;
      } | null;
    }>;
    slots: Awaited<ReturnType<ProjectRequestsService['getBrokerApplicationCapSummary']>>;
  }) {
    const selectedBroker =
      input.brokerApplications.find((proposal) => proposal.broker?.id === input.request.brokerId) ?? null;

    return {
      assignedBrokerId: input.request.brokerId ?? null,
      assignedBroker:
        selectedBroker?.broker ??
        (input.request.broker
          ? {
              id: input.request.broker.id,
              fullName: input.request.broker.fullName,
              email: input.request.broker.email,
              handle: this.toUserHandle(input.request.broker),
              currentTrustScore: input.request.broker.currentTrustScore ?? 0,
              totalProjectsFinished: input.request.broker.totalProjectsFinished ?? 0,
              totalDisputesLost: input.request.broker.totalDisputesLost ?? 0,
              recentProjects: [],
            }
          : null),
      totalApplications: input.brokerApplications.length,
      activeApplications: input.brokerApplications.filter((proposal) =>
        [ProposalStatus.PENDING, ProposalStatus.INVITED, ProposalStatus.ACCEPTED].includes(
          proposal.status as ProposalStatus,
        ),
      ).length,
      slots: input.slots,
      items: input.brokerApplications,
    };
  }

  private buildFreelancerSelectionSummary(
    request: ProjectRequestEntity,
    freelancerHistoryById: Map<string, BrokerHistorySummary[]>,
  ) {
    const items = (request.proposals || []).map((proposal) => ({
      id: proposal.id,
      status: proposal.status,
      coverLetter: proposal.coverLetter ?? null,
      createdAt: proposal.createdAt ?? null,
      freelancer: proposal.freelancer
        ? {
            id: proposal.freelancer.id,
            fullName: proposal.freelancer.fullName,
            email: proposal.freelancer.email,
            handle: this.toUserHandle(proposal.freelancer),
            currentTrustScore: proposal.freelancer.currentTrustScore ?? 0,
            totalProjectsFinished: proposal.freelancer.totalProjectsFinished ?? 0,
            totalDisputesLost: proposal.freelancer.totalDisputesLost ?? 0,
            recentProjects:
              freelancerHistoryById.get(proposal.freelancer.id)?.map((project) => ({
                id: project.projectId,
                title: project.title,
                status: project.status,
                updatedAt: project.updatedAt,
              })) ?? [],
          }
        : null,
    }));

    const selectedEntry =
      items.find((proposal) => String(proposal.status || '').toUpperCase() === 'ACCEPTED') ||
      items.find((proposal) => String(proposal.status || '').toUpperCase() === 'PENDING') ||
      null;

    return {
      total: items.length,
      invited: items.filter((proposal) => String(proposal.status || '').toUpperCase() === 'INVITED').length,
      pending: items.filter((proposal) => String(proposal.status || '').toUpperCase() === 'PENDING').length,
      accepted: items.filter((proposal) => String(proposal.status || '').toUpperCase() === 'ACCEPTED').length,
      rejected: items.filter((proposal) => String(proposal.status || '').toUpperCase() === 'REJECTED').length,
      selectedFreelancerId: selectedEntry?.freelancer?.id ?? null,
      selectedFreelancer: selectedEntry,
      items,
    };
  }

  private buildBrokerDraftSpecSummary(input: {
    clientSpec: Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase'> | null;
    fullSpec: Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase'> | null;
  }) {
    const { clientSpec, fullSpec } = input;
    return {
      clientSpec: clientSpec
        ? {
            id: clientSpec.id,
            title: clientSpec.title,
            status: clientSpec.status,
            specPhase: clientSpec.specPhase,
          }
        : null,
      fullSpec: fullSpec
        ? {
            id: fullSpec.id,
            title: fullSpec.title,
            status: fullSpec.status,
            specPhase: fullSpec.specPhase,
          }
        : null,
      clientApproved:
        clientSpec?.status === ProjectSpecStatus.CLIENT_APPROVED ||
        clientSpec?.status === ProjectSpecStatus.APPROVED,
      fullSpecReadyForContract: fullSpec?.status === ProjectSpecStatus.ALL_SIGNED,
      fullSpecNeedsReview: fullSpec?.status === ProjectSpecStatus.FINAL_REVIEW,
    };
  }

  private buildMarketVisibility(input: {
    request: ProjectRequestEntity;
    linkedProject: Pick<ProjectEntity, 'id'> | null;
    brokerSlots: Awaited<ReturnType<ProjectRequestsService['getBrokerApplicationCapSummary']>>;
    freelancerSelectionSummary: ReturnType<ProjectRequestsService['buildFreelancerSelectionSummary']>;
  }) {
    const isProjectLinked = Boolean(input.linkedProject);
    const brokerMarket =
      isProjectLinked || Boolean(input.request.brokerId)
        ? 'CLOSED'
        : input.request.status === RequestStatus.PRIVATE_DRAFT
          ? 'DIRECT_INVITE_ONLY'
          : 'OPEN';

    const freelancerMarket =
      isProjectLinked || input.freelancerSelectionSummary.selectedFreelancerId
        ? 'CLOSED'
        : [RequestStatus.SPEC_APPROVED, RequestStatus.HIRING, RequestStatus.CONTRACT_PENDING].includes(
              input.request.status,
            )
          ? 'OPEN'
          : 'LOCKED';

    return {
      brokerMarket,
      freelancerMarket,
      brokerSlotCapReached: !input.brokerSlots.hasCapacity,
      brokerSlots: input.brokerSlots,
    };
  }

  private async notifyUsers(inputs: Array<{
    userId?: string | null;
    title: string;
    body: string;
    relatedType?: string | null;
    relatedId?: string | null;
  }>) {
    const deduped = new Map<
      string,
      { userId: string; title: string; body: string; relatedType?: string | null; relatedId?: string | null }
    >();

    for (const input of inputs) {
      if (!input.userId) {
        continue;
      }

      const key = `${input.userId}:${input.title}:${input.relatedType || ''}:${input.relatedId || ''}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          userId: input.userId,
          title: input.title,
          body: input.body,
          relatedType: input.relatedType ?? null,
          relatedId: input.relatedId ?? null,
        });
      }
    }

    await this.notificationsService.createMany(Array.from(deduped.values()));
  }

  private async buildRequestReadModel(request: ProjectRequestEntity, user?: UserEntity) {
    const specs = (request.specs || []) as Array<
      Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
    >;
    const clientSpec = this.pickLatestSpecByPhase(specs, SpecPhase.CLIENT_SPEC);
    const fullSpec = this.pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC);

    const linkedProject =
      (await this.projectRepo.findOne({
        where: { requestId: request.id },
        relations: ['client', 'broker', 'freelancer'],
      })) ?? null;

    const linkedContract =
      linkedProject?.id != null
        ? ((await this.contractRepo.find({
            where: { projectId: linkedProject.id },
            order: { createdAt: 'DESC' },
            take: 1,
          }))?.[0] ?? null)
        : null;

    const brokerHistoryById = await this.loadBrokerHistoryMap(
      (request.brokerProposals || [])
        .map((proposal) => proposal?.brokerId)
        .filter((value): value is string => Boolean(value)),
    );
    const freelancerHistoryById = await this.loadFreelancerHistoryMap(
      (request.proposals || [])
        .map((proposal) => proposal?.freelancerId)
        .filter((value): value is string => Boolean(value)),
    );

    const brokerApplications = (request.brokerProposals || []).map((proposal) => ({
      id: proposal.id,
      status: proposal.status,
      coverLetter: proposal.coverLetter ?? null,
      createdAt: proposal.createdAt ?? null,
      broker: proposal.broker
        ? {
            id: proposal.broker.id,
            fullName: proposal.broker.fullName,
            email: proposal.broker.email,
            handle: this.toUserHandle(proposal.broker),
            currentTrustScore: proposal.broker.currentTrustScore ?? 0,
            totalProjectsFinished: proposal.broker.totalProjectsFinished ?? 0,
            totalDisputesLost: proposal.broker.totalDisputesLost ?? 0,
            recentProjects:
              brokerHistoryById.get(proposal.broker.id)?.map((project) => ({
                id: project.projectId,
                title: project.title,
                status: project.status,
                updatedAt: project.updatedAt,
              })) ?? [],
          }
        : null,
    }));

    const brokerApplicationSlots = await this.getBrokerApplicationCapSummary(request.id);
    const brokerSelectionSummary = this.buildBrokerSelectionSummary({
      request,
      brokerApplications,
      slots: brokerApplicationSlots,
    });
    const freelancerSelectionSummary = this.buildFreelancerSelectionSummary(
      request,
      freelancerHistoryById,
    );
    const brokerDraftSpecSummary = this.buildBrokerDraftSpecSummary({
      clientSpec,
      fullSpec,
    });
    const flowSnapshot = this.buildFlowSnapshot({
      request,
      clientSpec,
      fullSpec,
      linkedProject,
      linkedContract,
    });
    const requestProgress = {
      phase: flowSnapshot.phase,
      status: flowSnapshot.status,
      brokerAssigned: flowSnapshot.brokerAssigned,
      freelancerSelected: flowSnapshot.freelancerSelected,
      clientSpecStatus: flowSnapshot.clientSpecStatus,
      fullSpecStatus: flowSnapshot.fullSpecStatus,
      linkedContractId: flowSnapshot.linkedContractId,
      linkedProjectId: flowSnapshot.linkedProjectId,
      contractActivated: flowSnapshot.contractActivated,
    };

    const viewerPermissions = this.buildViewerPermissions({
      request,
      user,
      linkedProject,
      linkedContract,
      flowSnapshot,
    });
    const marketVisibility = this.buildMarketVisibility({
      request,
      linkedProject,
      brokerSlots: brokerApplicationSlots,
      freelancerSelectionSummary,
    });

    return {
      ...request,
      attachments: this.normalizeAttachments(request.attachments),
      freelancerProposals: request.proposals,
      specSummary: {
        clientSpec: clientSpec
          ? {
              id: clientSpec.id,
              title: clientSpec.title,
              status: clientSpec.status,
              specPhase: clientSpec.specPhase,
            }
          : null,
        fullSpec: fullSpec
          ? {
              id: fullSpec.id,
              title: fullSpec.title,
              status: fullSpec.status,
              specPhase: fullSpec.specPhase,
            }
          : null,
      },
      linkedProjectSummary: linkedProject
        ? {
            id: linkedProject.id,
            title: linkedProject.title,
            status: linkedProject.status,
            client: linkedProject.client
              ? {
                  id: linkedProject.client.id,
                  fullName: linkedProject.client.fullName,
                  handle: this.toUserHandle(linkedProject.client),
                }
              : null,
            broker: linkedProject.broker
              ? {
                  id: linkedProject.broker.id,
                  fullName: linkedProject.broker.fullName,
                  handle: this.toUserHandle(linkedProject.broker),
                }
              : null,
            freelancer: linkedProject.freelancer
              ? {
                  id: linkedProject.freelancer.id,
                  fullName: linkedProject.freelancer.fullName,
                  handle: this.toUserHandle(linkedProject.freelancer),
                }
              : null,
          }
        : null,
      linkedContractSummary: linkedContract
        ? {
            id: linkedContract.id,
            status: linkedContract.status,
            activatedAt: linkedContract.activatedAt,
            contractUrl: linkedContract.contractUrl,
            title: linkedContract.title,
            projectId: linkedContract.projectId,
          }
        : null,
      brokerApplicationSummary: {
        total: brokerApplications.length,
        invited: brokerApplications.filter((proposal) => proposal.status === ProposalStatus.INVITED).length,
        pending: brokerApplications.filter((proposal) => proposal.status === ProposalStatus.PENDING).length,
        accepted: brokerApplications.filter((proposal) => proposal.status === ProposalStatus.ACCEPTED).length,
        rejected: brokerApplications.filter((proposal) => proposal.status === ProposalStatus.REJECTED).length,
        assignedBrokerId: request.brokerId ?? null,
        items: brokerApplications,
        slots: brokerApplicationSlots,
      },
      flowSnapshot,
      brokerSelectionSummary,
      freelancerSelectionSummary,
      brokerDraftSpecSummary,
      marketVisibility,
      requestProgress,
      viewerPermissions,
    };
  }

  private async findOneEntity(id: string) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: [
        'answers',
        'answers.question',
        'answers.option',
        'client',
        'broker',
        'brokerProposals',
        'brokerProposals.broker',
        'proposals',
        'proposals.freelancer',
        'specs',
        'specs.milestones',
      ],
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  // ... (existing create/update methods)

  async create(clientId: string, dto: CreateProjectRequestDto, req: RequestContext) {
    // Quota check: enforce free-tier limit on active requests
    await this.quotaService.checkQuota(clientId, QuotaAction.CREATE_REQUEST);

    const request = this.requestRepo.create({
      clientId: clientId,
      title: dto.title,
      description: dto.description,
      budgetRange: dto.budgetRange,
      intendedTimeline: dto.intendedTimeline,
      techPreferences: dto.techPreferences,
      attachments: this.normalizeAttachments(dto.attachments),
      wizardProgressStep: dto.wizardProgressStep ?? 1,
      status:
        (dto.status as RequestStatus) ??
        (dto.isDraft ? RequestStatus.DRAFT : RequestStatus.PUBLIC_DRAFT),
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

    await this.quotaService.incrementUsage(clientId, QuotaAction.CREATE_REQUEST, {
      requestId: savedRequest.id,
    });
    if (fullRequest) {
      await this.notifyUsers([
        {
          userId: clientId,
          title: 'Project request created',
          body: `Request "${fullRequest.title}" has been created and is now being tracked.`,
          relatedType: 'ProjectRequest',
          relatedId: fullRequest.id,
        },
      ]);
    }

    return fullRequest;
  }

  // ... existing methods ...

  async findAll(status?: RequestStatus) {
    const options: FindManyOptions<ProjectRequestEntity> = {
      relations: ['answers', 'answers.question', 'answers.option', 'client', 'broker', 'brokerProposals', 'brokerProposals.broker'],
      order: { createdAt: 'DESC' },
    };
    if (status) {
      options.where = { status };
    }
    return this.requestRepo.find(options);
  }

  async update(id: string, dto: UpdateProjectRequestDto, user?: UserEntity, req?: RequestContext) {
    const request = await this.findOneEntity(id);

    if (user) {
      const isOwner = user.role === UserRole.CLIENT && request.clientId === user.id;
      const isInternal = user.role === UserRole.ADMIN || user.role === UserRole.STAFF;
      const isAssignedBroker = user.role === UserRole.BROKER && request.brokerId === user.id;
      if (!isOwner && !isInternal && !isAssignedBroker) {
        throw new ForbiddenException('Forbidden: You cannot update this request');
      }
    }

    // Update main fields
    if (dto.title) request.title = dto.title;
    if (dto.description) request.description = dto.description;
    if (dto.budgetRange) request.budgetRange = dto.budgetRange;
    if (dto.intendedTimeline) request.intendedTimeline = dto.intendedTimeline;
    if (dto.techPreferences) request.techPreferences = dto.techPreferences;
    if (dto.attachments) request.attachments = this.normalizeAttachments(dto.attachments);
    if (dto.wizardProgressStep !== undefined) {
      request.wizardProgressStep = dto.wizardProgressStep;
    }

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

  async publish(requestId: string, userId: string, req?: RequestContext) {
    const request = await this.findOne(requestId, {
      id: userId,
      role: UserRole.CLIENT,
    } as UserEntity);
    const previousStatus = request.status;

    const publishableStatuses = [
      RequestStatus.DRAFT,
      RequestStatus.PRIVATE_DRAFT,
      RequestStatus.PUBLIC_DRAFT,
    ];

    if (!publishableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `Request cannot be published from status "${request.status}"`,
      );
    }

    if (request.brokerId) {
      throw new BadRequestException('Cannot publish a request that already has a broker assigned');
    }

    if (request.status === RequestStatus.PUBLIC_DRAFT) {
      return request;
    }

    request.status = RequestStatus.PUBLIC_DRAFT;
    await this.requestRepo.save(request);

    try {
      await this.auditLogsService.logUpdate(
        'ProjectRequest',
        requestId,
        { status: previousStatus },
        { status: RequestStatus.PUBLIC_DRAFT },
        req,
      );
    } catch (error) {
      console.error('Audit log failed', error);
    }

    return this.findOne(requestId, {
      id: userId,
      role: UserRole.CLIENT,
    } as UserEntity);
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
    const request = await this.findOneEntity(id);

    if (user) {
      if (user.role === UserRole.CLIENT && request.clientId !== user.id) {
        throw new ForbiddenException('Forbidden: You can only view your own requests');
      }

      if (user.role === UserRole.BROKER) {
        // If request is ASSIGNED to someone else, broker cannot view it
        // Except maybe if they are an admin, but Role is BROKER so they are not admin
        if (request.status === RequestStatus.PROCESSING && request.brokerId && request.brokerId !== user.id) {
          throw new ForbiddenException('Forbidden: Request is assigned to another broker');
        }

        // If PENDING (unassigned), mask client data
        if (request.status === RequestStatus.PENDING && request.client) {
          request.client.email = '********';
          request.client.phoneNumber = '********';
        }
      }

      if (user.role === UserRole.FREELANCER) {
        const hasProposal = request.proposals?.some(
          (proposal) =>
            proposal.freelancerId === user.id &&
            ['INVITED', 'PENDING', 'ACCEPTED'].includes((proposal.status || '').toUpperCase()),
        );
        if (!hasProposal) {
          throw new ForbiddenException('Forbidden: You are not invited to this request');
        }
      }
    }

    return this.buildRequestReadModel(request, user);
  }

  async findMatches(id: string, userId?: string) {
    const request = await this.findOneEntity(id);

    // Quota check: enforce free-tier limit on AI match searches (daily)
    if (userId) {
      await this.quotaService.checkQuota(userId, QuotaAction.AI_MATCH_SEARCH);
    }

    const techStack = request.techPreferences 
      ? request.techPreferences.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const input = {
      requestId: request.id,
      specDescription: request.description,
      requiredTechStack: techStack,
      budgetRange: request.budgetRange,
      estimatedDuration: request.intendedTimeline,
    };

    const results = await this.matchingService.findMatches(input, { role: 'BROKER' });

    // Track quota usage after successful match search
    if (userId) {
      await this.quotaService.incrementUsage(userId, QuotaAction.AI_MATCH_SEARCH, {
        requestId: id,
        candidatesFound: results.length,
      });
    }

    return results;
  }

  async inviteBroker(requestId: string, brokerId: string, message?: string, inviterId?: string) {
    // 0. Quota check: enforce free-tier limit on invites per request
    if (inviterId) {
      await this.quotaService.checkQuota(inviterId, QuotaAction.INVITE_BROKER, requestId);
    }

    // 1. Check if request exists
    const request = await this.findOneEntity(requestId);

    // 2. Check if already has a broker
    if (request.brokerId) throw new Error('Request already has a broker assigned');

    // 3. Check if already invited or applied
    const existing = await this.brokerProposalRepo.findOne({
      where: { requestId, brokerId },
    });

    if (existing) {
      if (existing.status === ProposalStatus.INVITED) {
        throw new Error('Broker already invited');
      }
      if (existing.status === ProposalStatus.PENDING) {
        throw new Error('Broker has already applied');
      }
      // If rejected/accepted, maybe allow re-invite? For now assume strict uniqueness.
      throw new Error(`Broker already has proposal status: ${existing.status}`);
    }

    const proposal = this.brokerProposalRepo.create({
      requestId,
      brokerId,
      status: ProposalStatus.INVITED,
      coverLetter: message, // saving message in coverLetter for invites
    });
    const savedProposal = await this.brokerProposalRepo.save(proposal);
    if (inviterId) {
      await this.quotaService.incrementUsage(inviterId, QuotaAction.INVITE_BROKER, {
        entityId: requestId,
        brokerId,
      });
    }
    await this.notifyUsers([
      {
        userId: brokerId,
        title: 'New broker invitation',
        body: `You were invited to collaborate on "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);
    return savedProposal;
  }

  async inviteFreelancer(requestId: string, freelancerId: string, message?: string) {
    const request = await this.findOneEntity(requestId);

    const existing = await this.freelancerProposalRepo.findOne({
      where: { requestId, freelancerId },
    });

    if (existing) {
      throw new Error(
        `Freelancer already associated with this request (Status: ${existing.status})`,
      );
    }

    const proposal = this.freelancerProposalRepo.create({
      requestId,
      freelancerId,
      status: 'INVITED',
      coverLetter: message,
    });
    const savedProposal = await this.freelancerProposalRepo.save(proposal);
    await this.notifyUsers([
      {
        userId: freelancerId,
        title: 'New freelancer invitation',
        body: `You were invited to participate in "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);
    return savedProposal;
  }

  async getInvitationsForUser(userId: string, role: UserRole) {
    if (role === UserRole.BROKER) {
      return this.brokerProposalRepo.find({
        where: {
          brokerId: userId,
          status: In([ProposalStatus.INVITED, ProposalStatus.PENDING, ProposalStatus.ACCEPTED]),
        },
        relations: ['request', 'request.client'],
        order: { createdAt: 'DESC' },
      });
    } else if (role === UserRole.FREELANCER) {
      return this.freelancerProposalRepo.find({
        where: { freelancerId: userId, status: 'INVITED' },
        relations: ['request', 'request.client'],
        order: { createdAt: 'DESC' },
      });
    }
    return [];
  }

  async getFreelancerRequestAccessList(userId: string) {
    return this.freelancerProposalRepo.find({
      where: {
        freelancerId: userId,
        status: In(['INVITED', 'ACCEPTED', 'PENDING']),
      },
      relations: ['request', 'request.client', 'request.broker'],
      order: { createdAt: 'DESC' },
    });
  }

  async applyToRequest(requestId: string, brokerId: string, coverLetter: string) {
    const request = await this.findOneEntity(requestId);

    if (request.status !== RequestStatus.PUBLIC_DRAFT) {
      throw new BadRequestException('Request is not open for marketplace applications.');
    }

    if (request.brokerId) {
      throw new BadRequestException('Request already has a broker assigned.');
    }

    await this.assertBrokerApplicationSlotAvailable(requestId);

    // Check if the broker has already applied to this request
    const existingProposal = await this.brokerProposalRepo.findOne({
      where: { requestId, brokerId },
    });

    if (existingProposal) {
      throw new BadRequestException('Broker already has an application or invitation for this request');
    }

    await this.quotaService.checkQuota(brokerId, QuotaAction.APPLY_TO_REQUEST);
    const proposal = this.brokerProposalRepo.create({
      requestId,
      brokerId,
      coverLetter,
      status: ProposalStatus.PENDING,
    });
    const savedProposal = await this.brokerProposalRepo.save(proposal);
    await this.quotaService.incrementUsage(brokerId, QuotaAction.APPLY_TO_REQUEST, {
      requestId,
    });
    await this.notifyUsers([
      {
        userId: request.clientId,
        title: 'Broker applied to your request',
        body: `A broker applied to "${request.title}". Review the profile and decide whether to assign them.`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);
    return savedProposal;
  }

  // --- Broker Self-Assignment (C02) ---

  async assignBroker(requestId: string, brokerId: string, req?: RequestContext) {
    const request = await this.findOneEntity(requestId);

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

    await this.notifyUsers([
      {
        userId: request.clientId,
        title: 'Broker assigned',
        body: `A broker is now assigned to "${request.title}". Specification work can begin.`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      {
        userId: brokerId,
        title: 'You were assigned to a request',
        body: `You are now the assigned broker for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);

    return this.findOne(requestId);
  }

  // --- Phase 2: Hire Broker ---

  async acceptBroker(requestId: string, brokerId: string, clientId?: string) {
    const request = await this.findOneEntity(requestId);
    
    if (clientId && request.clientId !== clientId) {
      throw new ForbiddenException('Forbidden: You can only accept brokers for your own requests');
    }

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

    await this.notifyUsers([
      {
        userId: request.clientId,
        title: 'Broker accepted',
        body: `You accepted a broker for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      {
        userId: brokerId,
        title: 'Your broker proposal was accepted',
        body: `You were selected as broker for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      ...otherProposals
        .filter((proposal) => proposal.brokerId !== brokerId)
        .map((proposal) => ({
          userId: proposal.brokerId,
          title: 'Broker application closed',
          body: `A slot was released on "${request.title}" because another broker was selected.`,
          relatedType: 'ProjectRequest',
          relatedId: requestId,
        })),
    ]);

    return this.findOne(requestId);
  }

  async releaseBrokerSlot(requestId: string, proposalId: string, actor: UserEntity) {
    const request = await this.findOneEntity(requestId);
    const isOwner = actor.role === UserRole.CLIENT && request.clientId === actor.id;
    const isInternal = actor.role === UserRole.ADMIN || actor.role === UserRole.STAFF;
    if (!isOwner && !isInternal) {
      throw new ForbiddenException('Only the client or internal staff can release a broker slot.');
    }
    if (request.brokerId) {
      throw new BadRequestException('Cannot release broker slots after a broker has been assigned.');
    }

    const proposal = await this.brokerProposalRepo.findOne({
      where: { id: proposalId, requestId },
    });
    if (!proposal) {
      throw new NotFoundException('Broker proposal not found.');
    }

    if (!ACTIVE_BROKER_APPLICATION_STATUSES.includes(proposal.status as (typeof ACTIVE_BROKER_APPLICATION_STATUSES)[number])) {
      throw new BadRequestException(`Proposal status ${proposal.status} cannot be released.`);
    }

    proposal.status = ProposalStatus.REJECTED;
    await this.brokerProposalRepo.save(proposal);
    await this.notifyUsers([
      {
        userId: proposal.brokerId,
        title: 'Broker slot released',
        body: `Your active slot on "${request.title}" was released to free space for other candidates.`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      {
        userId: request.clientId,
        title: 'Broker slot released',
        body: `A broker slot was released on "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);

    return this.findOne(requestId, actor);
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
    const request = await this.findOneEntity(requestId);

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
    const saved = await this.requestRepo.save(request);
    await this.notifyUsers([
      {
        userId: request.clientId,
        title: 'Specs approved',
        body: `You approved the specification set for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      {
        userId: request.brokerId,
        title: 'Client approved specs',
        body: `The client approved specs for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);
    return saved;
  }

  private async ensureProjectHandoffForRequest(request: ProjectRequestEntity, actor: UserEntity) {
    const existingProject = await this.projectRepo.findOne({
      where: { requestId: request.id },
      relations: ['client', 'broker', 'freelancer'],
    });

    if (existingProject) {
      return existingProject;
    }

    const specs = (request.specs || []) as Array<
      Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
    >;
    const fullSpec = this.pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC);

    if (!fullSpec) {
      throw new BadRequestException('Cannot convert request without a finalized full specification.');
    }

    if (![ProjectSpecStatus.ALL_SIGNED, ProjectSpecStatus.APPROVED].includes(fullSpec.status)) {
      throw new BadRequestException(
        `Full spec is not ready for project handoff. Current status: ${fullSpec.status}.`,
      );
    }

    if (!request.brokerId) {
      throw new BadRequestException('Cannot convert request without an assigned broker.');
    }

    if (
      actor.role !== UserRole.ADMIN &&
      actor.role !== UserRole.STAFF &&
      request.brokerId !== actor.id
    ) {
      throw new ForbiddenException('Only the assigned broker or internal staff can convert this request.');
    }

    if (actor.role === UserRole.BROKER && request.brokerId === actor.id) {
      await this.contractsService.initializeContract(actor, fullSpec.id);
    }

    const linkedProject = await this.projectRepo.findOne({
      where: { requestId: request.id },
      relations: ['client', 'broker', 'freelancer'],
    });

    if (!linkedProject) {
      throw new BadRequestException(
        'Project handoff is not ready. Initialize contract/project from the finalized spec before conversion.',
      );
    }

    return linkedProject;
  }

  // --- Phase 5: Finalize Project ---

  async convertToProject(requestId: string, actor: UserEntity) {
    const request = await this.findOneEntity(requestId);
    const linkedProject = await this.ensureProjectHandoffForRequest(request, actor);

    request.status = RequestStatus.CONVERTED_TO_PROJECT;
    await this.requestRepo.save(request);
    await this.notifyUsers([
      {
        userId: request.clientId,
        title: 'Request converted to project',
        body: linkedProject
          ? `Request "${request.title}" is now linked to project ${linkedProject.title}.`
          : `Request "${request.title}" has been converted to project workflow.`,
        relatedType: linkedProject ? 'Project' : 'ProjectRequest',
        relatedId: linkedProject?.id ?? requestId,
      },
      {
        userId: request.brokerId,
        title: 'Project kickoff is ready',
        body: linkedProject
          ? `Request "${request.title}" is now linked to project ${linkedProject.title}.`
          : `Request "${request.title}" entered project workflow.`,
        relatedType: linkedProject ? 'Project' : 'ProjectRequest',
        relatedId: linkedProject?.id ?? requestId,
      },
    ]);
    return this.findOne(requestId, actor);
  }
  async deleteRequest(requestId: string, userId: string, req?: RequestContext) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['proposals'],
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // 1. Only the owner can delete
    if (request.clientId !== userId) {
      throw new ForbiddenException('You can only delete your own requests');
    }

    // 2. Only deletable in draft statuses
    const deletableStatuses = [
      RequestStatus.DRAFT,
      RequestStatus.PUBLIC_DRAFT,
      RequestStatus.PRIVATE_DRAFT,
    ];
    if (!deletableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `Cannot delete request with status "${request.status}". Only draft requests can be deleted.`,
      );
    }

    // 3. No broker assigned
    if (request.brokerId) {
      throw new BadRequestException(
        'Cannot delete a request that has a broker assigned. Use Dispute or Report to resolve.',
      );
    }

    // 4. No accepted freelancer proposals
    const acceptedProposal = await this.freelancerProposalRepo.findOne({
      where: { requestId, status: 'ACCEPTED' },
    });
    if (acceptedProposal) {
      throw new BadRequestException(
        'Cannot delete a request that has an accepted freelancer.',
      );
    }

    // 5. Cascade delete associated data
    await this.answerRepo.delete({ requestId });
    await this.brokerProposalRepo.delete({ requestId });
    await this.freelancerProposalRepo.delete({ requestId });

    // 6. Delete the request
    await this.requestRepo.remove(request);

    // 7. Audit log
    try {
      await this.auditLogsService.logDelete(
        'ProjectRequest',
        requestId,
        { title: request.title, status: request.status },
        req,
      );
    } catch (error) {
      console.error('Audit log failed for delete', error);
    }

    return { success: true, message: 'Request deleted successfully' };
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

  async respondToInvitation(
    invitationId: string,
    userId: string,
    role: UserRole,
    status: 'ACCEPTED' | 'REJECTED',
  ) {
    if (role === UserRole.BROKER) {
      const proposal = await this.brokerProposalRepo.findOne({
        where: { id: invitationId, brokerId: userId },
        relations: ['request'],
      });
      if (!proposal) throw new Error('Invitation not found');
      if (proposal.status !== ProposalStatus.INVITED) {
        throw new Error(`Cannot respond to invitation with status: ${proposal.status}`);
      }

      proposal.status = status === 'ACCEPTED' ? ProposalStatus.ACCEPTED : ProposalStatus.REJECTED;

      // If ACCEPTED, logic might differ (e.g. they join discussion vs becomes the sole broker).
      // For now, if they ACCEPT an invite, they become a CANDIDATE (PENDING) or if the invite was explicit, maybe they just join?
      // Usually "Invite" means "Please Apply". If they accept, they become PENDING application?
      // OR if it's a direct private invite, maybe they become ACCEPTED immediately if the client pre-approved?
      // Let's assume: Client Invited -> Broker Accepts -> Broker becomes "PENDING" (Applied) or "ACCEPTED" (Hired).
      // For safety, let's say they become PENDING (Applied) so Client can confirm?
      // OR if it was "Private Invite", maybe the Client already wants them.
      // Let's stick to: Invite -> Accept = PROPOSAL SUBMITTED (PENDING).
      // Wait, if it's "Private Project", the Client picked them. So Accept = Hired?
      // Let's go with: Accept = PENDING (Candidate). Client must finalizing "Hiring".

      // actually, if status is ACCEPTED here, we map it to ProposalStatus.PENDING?
      // "Accepting an invitation" usually means "I am interested, here is my bid" or just "I join".
      // Let's map "ACCEPTED" response to ProposalStatus.PENDING (Applied).
      if (status === 'ACCEPTED') {
        // Keep as ACCEPTED to indicate "Ready to Hire"
        proposal.status = ProposalStatus.ACCEPTED;
      } else {
        proposal.status = ProposalStatus.REJECTED; // Declined the invite
      }

      const savedProposal = await this.brokerProposalRepo.save(proposal);
      await this.notifyUsers([
        {
          userId: proposal.request?.clientId,
          title:
            status === 'ACCEPTED'
              ? 'Broker accepted your invitation'
              : 'Broker declined your invitation',
          body: `Invitation response recorded for "${proposal.request?.title || proposal.requestId}".`,
          relatedType: 'ProjectRequest',
          relatedId: proposal.requestId,
        },
      ]);
      return savedProposal;
    } else if (role === UserRole.FREELANCER) {
      const proposal = await this.freelancerProposalRepo.findOne({
        where: { id: invitationId, freelancerId: userId },
        relations: ['request'],
      });
      if (!proposal) throw new Error('Invitation not found');

      if (proposal.status !== 'INVITED') {
        throw new Error(`Cannot respond to invitation with status: ${proposal.status}`);
      }

      const request = proposal.request;
      if (!request) {
        throw new Error('Request not found for this invitation');
      }
      if (status === 'ACCEPTED') {
        const requestWithSpecs = await this.findOneEntity(proposal.requestId);
        const clientSpec = this.pickLatestSpecByPhase(
          (requestWithSpecs.specs || []) as Array<
            Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
          >,
          SpecPhase.CLIENT_SPEC,
        );

        const clientApproved =
          clientSpec?.status === ProjectSpecStatus.CLIENT_APPROVED ||
          clientSpec?.status === ProjectSpecStatus.APPROVED ||
          request.status === RequestStatus.SPEC_APPROVED ||
          request.status === RequestStatus.HIRING;

        if (!clientApproved) {
          throw new BadRequestException(
            'Freelancer can only accept after the broker draft has been approved by the client.',
          );
        }
      }

      if (status === 'ACCEPTED') {
        const existingAccepted = await this.freelancerProposalRepo.findOne({
          where: { requestId: proposal.requestId, status: 'ACCEPTED' },
        });
        if (existingAccepted && existingAccepted.id !== proposal.id) {
          throw new BadRequestException('A freelancer has already been accepted for this request');
        }

        proposal.status = 'ACCEPTED';

        await this.freelancerProposalRepo
          .createQueryBuilder()
          .update()
          .set({ status: 'REJECTED' })
          .where('requestId = :requestId', { requestId: proposal.requestId })
          .andWhere('id != :id', { id: proposal.id })
          .andWhere('status IN (:...statuses)', { statuses: ['INVITED', 'PENDING'] })
          .execute();
      } else {
        proposal.status = 'REJECTED';
      }
      const savedProposal = await this.freelancerProposalRepo.save(proposal);
      await this.notifyUsers([
        {
          userId: request.clientId,
          title:
            status === 'ACCEPTED'
              ? 'Freelancer accepted your invitation'
              : 'Freelancer declined your invitation',
          body: `Invitation response recorded for "${request.title}".`,
          relatedType: 'ProjectRequest',
          relatedId: request.id,
        },
        {
          userId: request.brokerId,
          title:
            status === 'ACCEPTED'
              ? 'Freelancer accepted invitation'
              : 'Freelancer declined invitation',
          body: `Invitation response recorded for "${request.title}".`,
          relatedType: 'ProjectRequest',
          relatedId: request.id,
        },
      ]);
      return savedProposal;
    }

    throw new Error('Invalid role');
  }
}
