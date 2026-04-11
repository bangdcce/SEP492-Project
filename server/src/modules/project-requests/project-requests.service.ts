import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, In, MoreThan } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { QuotaService } from '../subscriptions/quota.service';
import { QuotaAction } from '../../database/entities/quota-usage-log.entity';
import {
  ProjectRequestEntity,
  ProjectRequestAttachmentMetadata,
  ProjectRequestCommercialBaseline,
  ProjectRequestCommercialChangeRequest,
  ProjectRequestCommercialFeature,
  ProjectRequestScopeBaseline,
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
import {
  RequestChatService,
  type RequestSystemMessageOptions,
} from '../request-chat/request-chat.service';
import { hasOperationalStaffAccess } from '../auth/utils/role.utils';
import {
  buildPublicUploadUrl,
  extractUploadStoragePath,
} from '../../common/utils/public-upload-url.util';
import {
  extractProjectRequestStoragePath,
  getProjectRequestSignedUrl,
} from '../../common/utils/supabase-object-storage.util';
import {
  CreateCommercialChangeRequestDto,
  RespondCommercialChangeRequestDto,
} from './dto/commercial-change-request.dto';

const BROKER_APPLICATION_CAP = 10;
const BROKER_APPLICATION_WINDOW_HOURS = 72;
const ACTIVE_BROKER_APPLICATION_STATUSES = [
  ProposalStatus.PENDING,
  ProposalStatus.INVITED,
] as const;
const FREELANCER_PENDING_CLIENT_APPROVAL = 'PENDING_CLIENT_APPROVAL' as const;
const ACTIVE_FREELANCER_PROPOSAL_STATUSES = [
  FREELANCER_PENDING_CLIENT_APPROVAL,
  'INVITED',
  'PENDING',
  'ACCEPTED',
] as const;
const DATE_ONLY_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUDGET_CODE_RANGES: Record<string, { min?: number; max?: number }> = {
  UNDER_1K: { min: 0, max: 1000 },
  '1K_5K': { min: 1000, max: 5000 },
  '5K_10K': { min: 5000, max: 10000 },
  '10K_25K': { min: 10000, max: 25000 },
  ABOVE_25K: { min: 25000 },
};

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
    private readonly requestChatService: RequestChatService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private toUserHandle(user?: Pick<UserEntity, 'email'> | null): string | null {
    if (!user?.email) {
      return null;
    }

    const localPart = user.email.split('@')[0]?.trim();
    return localPart ? `@${localPart}` : null;
  }

  private getTodayDateInputValue(referenceDate: Date = new Date()): string {
    const year = referenceDate.getFullYear();
    const month = `${referenceDate.getMonth() + 1}`.padStart(2, '0');
    const day = `${referenceDate.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private normalizeIntendedTimeline(value?: string): string | undefined {
    const normalizedValue = `${value || ''}`.trim();
    if (!normalizedValue) {
      return undefined;
    }

    if (
      DATE_ONLY_INPUT_PATTERN.test(normalizedValue) &&
      normalizedValue < this.getTodayDateInputValue()
    ) {
      throw new BadRequestException('Expected completion date cannot be in the past.');
    }

    return normalizedValue;
  }

  private normalizeRequestedDeadline(value?: string | null): string | undefined {
    const normalizedValue = `${value || ''}`.trim();
    if (!normalizedValue) {
      return undefined;
    }

    const parsedDate = new Date(normalizedValue);
    const dateOnly =
      DATE_ONLY_INPUT_PATTERN.exec(normalizedValue)?.[0] ||
      (Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().slice(0, 10));

    if (!dateOnly) {
      throw new BadRequestException('Requested deadline must be a valid YYYY-MM-DD date.');
    }

    if (dateOnly < this.getTodayDateInputValue()) {
      throw new BadRequestException('Expected completion date cannot be in the past.');
    }

    return dateOnly;
  }

  private safeNormalizeRequestedDeadline(value?: string | null): string | null {
    try {
      return this.normalizeRequestedDeadline(value) ?? null;
    } catch {
      return null;
    }
  }

  private parseBudgetToken(value: string): number | null {
    const normalized = value.replace(/[$,\s]/g, '').toUpperCase();
    const match = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?$/);
    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) {
      return null;
    }

    const multiplier =
      match[2] === 'K'
        ? 1000
        : match[2] === 'M'
          ? 1000000
          : match[2] === 'B'
            ? 1000000000
            : 1;

    return Math.round(amount * multiplier);
  }

  private parseBudgetRange(value?: string | null): { min?: number; max?: number } | null {
    const raw = `${value || ''}`.trim();
    if (!raw) {
      return null;
    }

    const normalizedCode = raw.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    if (BUDGET_CODE_RANGES[normalizedCode]) {
      return BUDGET_CODE_RANGES[normalizedCode];
    }

    const normalizedRaw = raw.toUpperCase();
    if (BUDGET_CODE_RANGES[normalizedRaw]) {
      return BUDGET_CODE_RANGES[normalizedRaw];
    }

    const compactMatches = raw.match(/\d[\d,.]*(?:\.\d+)?\s*[kKmMbB]?/g) || [];
    const compactNumbers = compactMatches
      .map((segment) => this.parseBudgetToken(segment))
      .filter((number): number is number => Number.isFinite(number) && number >= 0);

    if (compactNumbers.length > 0) {
      if (raw.includes('+') || /above|over|more than/i.test(raw)) {
        return { min: compactNumbers[0] };
      }

      if (/under|below|less than|up to/i.test(raw)) {
        return { min: 0, max: compactNumbers[0] };
      }

      if (compactNumbers.length === 1) {
        return { min: compactNumbers[0], max: compactNumbers[0] };
      }

      return {
        min: Math.min(...compactNumbers),
        max: Math.max(...compactNumbers),
      };
    }

    const numericMatches = raw.match(/\d[\d,.]*/g) || [];
    const numbers = numericMatches
      .map((segment) => Number(segment.replace(/[^\d.]/g, '')))
      .filter((number) => Number.isFinite(number) && number >= 0);

    if (numbers.length === 0) {
      return null;
    }

    if (raw.includes('+') || /above|over|more than/i.test(raw)) {
      return { min: numbers[0] };
    }

    if (/under|below|less than|up to/i.test(raw)) {
      return { min: 0, max: numbers[0] };
    }

    if (numbers.length === 1) {
      return { min: numbers[0], max: numbers[0] };
    }

    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
    };
  }

  private formatCurrencyValue(value: number): string {
    return `$${Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  private evaluateProposedBudgetAgainstRequestRange(
    requestBudgetRange: string | null | undefined,
    proposedBudget: number | null | undefined,
  ): {
    requestBudgetRange: string | null;
    proposedBudgetOutsideRequestRange: boolean;
    proposedBudgetRangeWarning: string | null;
  } {
    const normalizedRange = `${requestBudgetRange || ''}`.trim() || null;

    if (typeof proposedBudget !== 'number' || !Number.isFinite(proposedBudget) || proposedBudget < 0) {
      return {
        requestBudgetRange: normalizedRange,
        proposedBudgetOutsideRequestRange: false,
        proposedBudgetRangeWarning: null,
      };
    }

    const parsedRange = this.parseBudgetRange(normalizedRange);
    if (!parsedRange) {
      return {
        requestBudgetRange: normalizedRange,
        proposedBudgetOutsideRequestRange: false,
        proposedBudgetRangeWarning: null,
      };
    }

    const isBelowMin =
      typeof parsedRange.min === 'number' && Number.isFinite(parsedRange.min)
        ? proposedBudget < parsedRange.min
        : false;
    const isAboveMax =
      typeof parsedRange.max === 'number' && Number.isFinite(parsedRange.max)
        ? proposedBudget > parsedRange.max
        : false;
    const isOutside = isBelowMin || isAboveMax;

    return {
      requestBudgetRange: normalizedRange,
      proposedBudgetOutsideRequestRange: isOutside,
      proposedBudgetRangeWarning: isOutside
        ? `Proposed budget ${this.formatCurrencyValue(proposedBudget)} is outside the request budget range (${normalizedRange || 'original wizard range'}). ` +
          'Client must explicitly acknowledge this warning before approval.'
        : null,
    };
  }

  private getDateKeyFromDate(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const parsedDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return this.getTodayDateInputValue(parsedDate);
  }

  private sanitizePlainText(value?: string | null): string {
    return `${value || ''}`.trim();
  }

  private isUuid(value?: string | null): boolean {
    const normalized = this.sanitizePlainText(value);
    return UUID_PATTERN.test(normalized);
  }

  private deriveCommercialFeatureId(title: string, index: number): string {
    const normalizedTitle = this.sanitizePlainText(title)
      .toLowerCase()
      .replace(/\s+/g, ' ');
    const seed = `commercial-feature:${index + 1}:${normalizedTitle}`;
    const hex = createHash('sha1').update(seed).digest('hex').slice(0, 32);
    const chars = hex.split('');
    chars[12] = '4';
    const variantNibble = Number.parseInt(chars[16], 16);
    chars[16] = ((Number.isNaN(variantNibble) ? 0 : variantNibble) & 0x3 | 0x8).toString(16);

    return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars
      .slice(12, 16)
      .join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20, 32).join('')}`;
  }

  private humanizeProductTypeValue(value: string): string {
    return value
      .trim()
      .replace(/[_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private normalizeProductTypeComparable(value?: string | null): string | null {
    const sanitized = this.sanitizePlainText(value);
    if (!sanitized) {
      return null;
    }

    return sanitized
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private getRequestProductTypeSnapshot(
    request: Pick<ProjectRequestEntity, 'answers'>,
  ): Pick<ProjectRequestScopeBaseline, 'productTypeCode' | 'productTypeLabel'> {
    const productTypeAnswer = (request.answers || []).find(
      (answer) => answer?.question?.code === 'PRODUCT_TYPE',
    );

    const normalizedCode = this.normalizeProductTypeComparable(
      productTypeAnswer?.valueText || productTypeAnswer?.option?.label,
    );
    const rawLabel = this.sanitizePlainText(
      productTypeAnswer?.option?.label || productTypeAnswer?.valueText,
    );

    return {
      productTypeCode: normalizedCode,
      productTypeLabel: rawLabel
        ? this.humanizeProductTypeValue(rawLabel)
        : normalizedCode
          ? this.humanizeProductTypeValue(normalizedCode)
          : null,
    };
  }

  private buildProjectGoalSummary(
    title?: string | null,
    description?: string | null,
  ): string | null {
    const normalizedTitle = this.sanitizePlainText(title);
    const normalizedDescription = this.sanitizePlainText(description);
    if (!normalizedTitle && !normalizedDescription) {
      return null;
    }
    if (!normalizedDescription) {
      return normalizedTitle;
    }
    const compactDescription =
      normalizedDescription.length > 220
        ? `${normalizedDescription.slice(0, 217).trimEnd()}...`
        : normalizedDescription;
    return normalizedTitle ? `${normalizedTitle}: ${compactDescription}` : compactDescription;
  }

  private buildRequestScopeBaseline(request: ProjectRequestEntity): ProjectRequestScopeBaseline {
    const derivedDeadline =
      this.safeNormalizeRequestedDeadline(
        request.requestedDeadline ??
          (DATE_ONLY_INPUT_PATTERN.test(`${request.intendedTimeline || ''}`)
            ? request.intendedTimeline
            : undefined),
      ) ?? null;
    const productTypeSnapshot = this.getRequestProductTypeSnapshot(request);
    const stored = request.requestScopeBaseline || null;

    return {
      productTypeCode: productTypeSnapshot.productTypeCode ?? stored?.productTypeCode ?? null,
      productTypeLabel: productTypeSnapshot.productTypeLabel ?? stored?.productTypeLabel ?? null,
      projectGoalSummary:
        this.buildProjectGoalSummary(request.title, request.description) ??
        stored?.projectGoalSummary ??
        null,
      requestedDeadline: derivedDeadline ?? stored?.requestedDeadline ?? null,
      requestTitle: this.sanitizePlainText(request.title),
      requestDescription: this.sanitizePlainText(request.description),
    };
  }

  private resolveCommercialChangeTimelineFloor(
    request: ProjectRequestEntity,
    baseline: ProjectRequestCommercialBaseline,
  ): string {
    const todayKey = this.getTodayDateInputValue();
    const requestScopeBaseline = this.buildRequestScopeBaseline(request);
    const candidates = [
      todayKey,
      requestScopeBaseline.requestedDeadline,
      this.safeNormalizeRequestedDeadline(
        baseline.agreedDeliveryDeadline ?? baseline.estimatedTimeline ?? undefined,
      ),
      this.getDateKeyFromDate(request.createdAt),
    ].filter((value): value is string => Boolean(value));

    return candidates.reduce(
      (latest, candidate) => (candidate > latest ? candidate : latest),
      todayKey,
    );
  }

  private buildPublicUploadUrl(pathname: string): string {
    return buildPublicUploadUrl(pathname);
  }

  private async resolveAttachmentUrl(
    attachment: Pick<ProjectRequestAttachmentMetadata, 'url' | 'storagePath'>,
  ): Promise<string> {
    const objectStoragePath =
      extractProjectRequestStoragePath(attachment?.storagePath) ||
      extractProjectRequestStoragePath(attachment?.url);
    if (objectStoragePath) {
      return getProjectRequestSignedUrl(objectStoragePath);
    }

    const storagePath =
      extractUploadStoragePath(attachment?.storagePath) ||
      extractUploadStoragePath(attachment?.url);
    const rawUrl = `${attachment?.url || ''}`.trim();

    if (storagePath) {
      return this.buildPublicUploadUrl(storagePath);
    }

    return rawUrl;
  }

  private normalizeCommercialFeatures(
    features?: ProjectRequestCommercialFeature[] | null,
  ): ProjectRequestCommercialFeature[] | null {
    if (!features?.length) {
      return null;
    }

    const normalized = features
      .map((feature, index) => {
        const title = `${feature?.title || ''}`.trim();
        const description = `${feature?.description || ''}`.trim();
        const existingId = this.sanitizePlainText(feature?.id);

        return {
          id: this.isUuid(existingId) ? existingId : this.deriveCommercialFeatureId(title, index),
          title,
          description,
          priority: feature?.priority ?? null,
        };
      })
      .filter((feature) => feature.title.length > 0 && feature.description.length > 0);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCommercialBaseline(
    baseline?: ProjectRequestCommercialBaseline | null,
  ): ProjectRequestCommercialBaseline | null {
    if (!baseline) {
      return null;
    }

    return {
      source:
        baseline.source === 'CLIENT_SPEC' || baseline.source === 'COMMERCIAL_CHANGE'
          ? baseline.source
          : 'REQUEST',
      budgetRange: `${baseline.budgetRange || ''}`.trim() || null,
      estimatedBudget:
        typeof baseline.estimatedBudget === 'number' && Number.isFinite(baseline.estimatedBudget)
          ? baseline.estimatedBudget
          : typeof baseline.agreedBudget === 'number' && Number.isFinite(baseline.agreedBudget)
            ? baseline.agreedBudget
            : null,
      estimatedTimeline:
        `${baseline.estimatedTimeline || baseline.agreedDeliveryDeadline || ''}`.trim() || null,
      clientFeatures: this.normalizeCommercialFeatures(
        baseline.clientFeatures ?? baseline.agreedClientFeatures,
      ),
      agreedBudget:
        typeof baseline.agreedBudget === 'number' && Number.isFinite(baseline.agreedBudget)
          ? baseline.agreedBudget
          : typeof baseline.estimatedBudget === 'number' &&
              Number.isFinite(baseline.estimatedBudget)
            ? baseline.estimatedBudget
            : null,
      agreedDeliveryDeadline:
        this.safeNormalizeRequestedDeadline(
          `${baseline.agreedDeliveryDeadline || baseline.estimatedTimeline || ''}`.trim() ||
            undefined,
        ) ?? null,
      agreedClientFeatures: this.normalizeCommercialFeatures(
        baseline.agreedClientFeatures ?? baseline.clientFeatures,
      ),
      sourceSpecId: `${baseline.sourceSpecId || ''}`.trim() || null,
      sourceChangeRequestId: `${baseline.sourceChangeRequestId || ''}`.trim() || null,
      approvedAt: `${baseline.approvedAt || ''}`.trim() || null,
    };
  }

  private normalizeCommercialChangeRequest(
    value?: ProjectRequestCommercialChangeRequest | null,
  ): ProjectRequestCommercialChangeRequest | null {
    if (!value?.id) {
      return null;
    }

    return {
      id: value.id,
      status: value.status === 'APPROVED' || value.status === 'REJECTED' ? value.status : 'PENDING',
      reason: `${value.reason || ''}`.trim(),
      requestedByBrokerId: `${value.requestedByBrokerId || ''}`.trim(),
      requestedAt: `${value.requestedAt || ''}`.trim(),
      respondedAt: `${value.respondedAt || ''}`.trim() || null,
      respondedByClientId: `${value.respondedByClientId || ''}`.trim() || null,
      responseNote: `${value.responseNote || ''}`.trim() || null,
      currentBudget:
        typeof value.currentBudget === 'number' && Number.isFinite(value.currentBudget)
          ? value.currentBudget
          : null,
      proposedBudget:
        typeof value.proposedBudget === 'number' && Number.isFinite(value.proposedBudget)
          ? value.proposedBudget
          : null,
      currentTimeline: `${value.currentTimeline || ''}`.trim() || null,
      proposedTimeline: `${value.proposedTimeline || ''}`.trim() || null,
      currentClientFeatures: this.normalizeCommercialFeatures(value.currentClientFeatures),
      proposedClientFeatures: this.normalizeCommercialFeatures(value.proposedClientFeatures),
      parentSpecId: `${value.parentSpecId || ''}`.trim() || null,
      requestBudgetRange: `${value.requestBudgetRange || ''}`.trim() || null,
      proposedBudgetOutsideRequestRange: Boolean(value.proposedBudgetOutsideRequestRange),
      proposedBudgetRangeWarning: `${value.proposedBudgetRangeWarning || ''}`.trim() || null,
      clientAcknowledgedBudgetRangeWarning: Boolean(value.clientAcknowledgedBudgetRangeWarning),
      clientAcknowledgedBudgetRangeWarningAt:
        `${value.clientAcknowledgedBudgetRangeWarningAt || ''}`.trim() || null,
    };
  }

  private normalizeAttachments(
    attachments?: ProjectRequestAttachmentMetadata[] | null,
  ): ProjectRequestAttachmentMetadata[] {
    if (!attachments?.length) {
      return [];
    }

    return attachments
      .map((attachment) => {
        const objectStoragePath =
          extractProjectRequestStoragePath(attachment?.storagePath) ||
          extractProjectRequestStoragePath(attachment?.url);
        const localStoragePath =
          extractUploadStoragePath(attachment?.storagePath) ||
          extractUploadStoragePath(attachment?.url);
        const storagePath = objectStoragePath ?? localStoragePath;
        const rawUrl = `${attachment?.url || ''}`.trim();

        return {
          filename: `${attachment?.filename || ''}`.trim(),
          storagePath,
          url: objectStoragePath || localStoragePath || rawUrl,
          mimetype: attachment?.mimetype?.trim() || null,
          size:
            typeof attachment?.size === 'number' && Number.isFinite(attachment.size)
              ? attachment.size
              : null,
          category: attachment?.category === 'requirements' ? 'requirements' : 'attachment',
        };
      })
      .filter(
        (attachment) =>
          attachment.filename.length > 0 &&
          (attachment.url.length > 0 || `${attachment.storagePath || ''}`.length > 0),
      );
  }

  private async hydrateAttachments(
    attachments?: ProjectRequestAttachmentMetadata[] | null,
  ): Promise<ProjectRequestAttachmentMetadata[]> {
    const normalized = this.normalizeAttachments(attachments);
    return Promise.all(
      normalized.map(async (attachment) => ({
        ...attachment,
        url: await this.resolveAttachmentUrl(attachment),
      })),
    );
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
      windowEndsAt: new Date(
        windowStart.getTime() + BROKER_APPLICATION_WINDOW_HOURS * 60 * 60 * 1000,
      ),
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

  private isActiveFreelancerProposalStatus(status?: string | null) {
    return ACTIVE_FREELANCER_PROPOSAL_STATUSES.includes(
      String(status || '').toUpperCase() as (typeof ACTIVE_FREELANCER_PROPOSAL_STATUSES)[number],
    );
  }

  private resolveActiveFreelancerProposal(request: ProjectRequestEntity) {
    const proposals = request.proposals || [];
    return (
      proposals.find((proposal) => String(proposal?.status || '').toUpperCase() === 'ACCEPTED') ||
      proposals.find((proposal) => String(proposal?.status || '').toUpperCase() === 'INVITED') ||
      proposals.find(
        (proposal) =>
          String(proposal?.status || '').toUpperCase() === FREELANCER_PENDING_CLIENT_APPROVAL,
      ) ||
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
    specs: Array<
      Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
    >,
    phase: SpecPhase,
  ) {
    return (
      [...specs]
        .filter((spec) => spec.specPhase === phase)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime(),
        )[0] ?? null
    );
  }

  private async buildOriginalRequestContext(request: ProjectRequestEntity) {
    return {
      title: request.title,
      description: request.description,
      budgetRange: request.budgetRange ?? null,
      intendedTimeline: request.intendedTimeline ?? null,
      requestedDeadline:
        this.buildRequestScopeBaseline(request).requestedDeadline ??
        request.requestedDeadline ??
        null,
      techPreferences: request.techPreferences ?? null,
      attachments: await this.hydrateAttachments(request.attachments),
    };
  }

  private maskUserContact(user?: UserEntity | null) {
    if (!user) {
      return;
    }

    user.email = '********';
    if ('phoneNumber' in user) {
      (user as UserEntity & { phoneNumber?: string | null }).phoneNumber = '********';
    }
  }

  private resolveCommercialBaseline(
    request: ProjectRequestEntity,
  ): ProjectRequestCommercialBaseline | null {
    const normalized = this.normalizeCommercialBaseline(request.commercialBaseline);
    if (normalized) {
      return normalized;
    }

    return {
      source: 'REQUEST',
      budgetRange: request.budgetRange ?? null,
      estimatedBudget: null,
      estimatedTimeline:
        this.buildRequestScopeBaseline(request).requestedDeadline ??
        request.intendedTimeline ??
        null,
      clientFeatures: null,
      agreedBudget: null,
      agreedDeliveryDeadline:
        this.buildRequestScopeBaseline(request).requestedDeadline ??
        request.requestedDeadline ??
        null,
      agreedClientFeatures: null,
      sourceSpecId: null,
      sourceChangeRequestId: null,
      approvedAt: null,
    };
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
        : request.status === RequestStatus.CONTRACT_PENDING ||
            linkedContract ||
            fullSpec?.status === ProjectSpecStatus.ALL_SIGNED
          ? 'CONTRACT'
          : fullSpec || selectedFreelancer || request.status === RequestStatus.HIRING
            ? 'FINAL_SPEC_REVIEW'
            : request.status === RequestStatus.SPEC_APPROVED ||
                clientSpec?.status === ProjectSpecStatus.CLIENT_APPROVED ||
                clientSpec?.status === ProjectSpecStatus.APPROVED
              ? 'FREELANCER_SELECTION'
              : request.status === RequestStatus.BROKER_ASSIGNED ||
                  request.status === RequestStatus.PENDING_SPECS ||
                  request.status === RequestStatus.SPEC_SUBMITTED
                ? 'SPEC_WORKFLOW'
                : 'REQUEST_INTAKE';

    if (fullSpec?.status === ProjectSpecStatus.FINAL_REVIEW) {
      phase = 'FINAL_SPEC_REVIEW';
    } else if (fullSpec?.status === ProjectSpecStatus.ALL_SIGNED) {
      phase = 'CONTRACT';
    } else if (clientSpec?.status === ProjectSpecStatus.CLIENT_REVIEW) {
      phase = 'SPEC_WORKFLOW';
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
            ? clientSpec?.status === ProjectSpecStatus.CLIENT_REVIEW
              ? 'CLIENT_REVIEW_PENDING'
              : 'REVIEW_OR_PREPARE_SPEC'
            : phase === 'FREELANCER_SELECTION'
              ? 'SELECT_FREELANCER'
              : phase === 'FINAL_SPEC_REVIEW'
                ? fullSpec?.status === ProjectSpecStatus.FINAL_REVIEW
                  ? 'COMPLETE_SPEC_SIGNING'
                  : 'PREPARE_FINAL_SPEC'
                : phase === 'CONTRACT'
                  ? linkedContract
                    ? 'COMPLETE_CONTRACT_HANDOFF'
                    : 'INITIALIZE_CONTRACT'
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
    const isInternal = hasOperationalStaffAccess(user);
    const isFreelancerViewer =
      role === UserRole.FREELANCER &&
      Boolean(
        request.proposals?.some(
          (proposal) =>
            proposal.freelancerId === user?.id &&
            ['INVITED', 'PENDING', 'ACCEPTED'].includes(
              String(proposal.status || '').toUpperCase(),
            ),
        ),
      );
    const hasPendingFreelancerApprovals = Boolean(
      request.proposals?.some(
        (proposal) =>
          String(proposal.status || '').toUpperCase() === FREELANCER_PENDING_CLIENT_APPROVAL,
      ),
    );
    const hasActiveFreelancerProposal = Boolean(this.resolveActiveFreelancerProposal(request));
    const phaseNumber = flowSnapshot?.phaseNumber ?? 0;
    const isReadOnly = Boolean(flowSnapshot?.readOnly);

    return {
      canViewRequest: Boolean(user),
      canViewSpecs: isClient || isAssignedBroker || isInternal || isFreelancerViewer,
      canViewBrokerMatches: isClient || isInternal,
      canInviteBroker: isClient && !request.brokerId && !flowSnapshot?.readOnly,
      canAcceptBroker: isClient && !request.brokerId && !flowSnapshot?.readOnly,
      canReleaseBrokerSlot:
        (isClient || isInternal) && !request.brokerId && !flowSnapshot?.readOnly,
      canApplyAsBroker:
        role === UserRole.BROKER &&
        request.status === RequestStatus.PUBLIC_DRAFT &&
        !request.brokerId &&
        ![RequestStatus.CONVERTED_TO_PROJECT, RequestStatus.CONTRACT_PENDING].includes(
          request.status,
        ),
      canViewContract: Boolean(linkedContract),
      canOpenLinkedProject: Boolean(linkedProject),
      canInviteFreelancer:
        (isAssignedBroker || isInternal) &&
        Boolean(flowSnapshot?.clientSpecStatus === ProjectSpecStatus.CLIENT_APPROVED) &&
        !hasActiveFreelancerProposal &&
        !isReadOnly,
      canApproveFreelancerInvite:
        isClient && !isReadOnly && phaseNumber >= 3 && hasPendingFreelancerApprovals,
      canRespondAsFreelancer: isFreelancerViewer && !isReadOnly && phaseNumber >= 3,
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
      input.brokerApplications.find((proposal) => proposal.broker?.id === input.request.brokerId) ??
      null;

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
      freelancerId: proposal.freelancerId,
      brokerId: proposal.brokerId ?? null,
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
      broker: proposal.broker
        ? {
            id: proposal.broker.id,
            fullName: proposal.broker.fullName,
            email: proposal.broker.email,
            handle: this.toUserHandle(proposal.broker),
            currentTrustScore: proposal.broker.currentTrustScore ?? 0,
            totalProjectsFinished: proposal.broker.totalProjectsFinished ?? 0,
            totalDisputesLost: proposal.broker.totalDisputesLost ?? 0,
            recentProjects: [],
          }
        : null,
    }));

    const selectedEntry =
      items.find((proposal) => String(proposal.status || '').toUpperCase() === 'ACCEPTED') ||
      items.find((proposal) => String(proposal.status || '').toUpperCase() === 'PENDING') ||
      null;

    return {
      total: items.length,
      invited: items.filter((proposal) => String(proposal.status || '').toUpperCase() === 'INVITED')
        .length,
      pendingClientApproval: items.filter(
        (proposal) =>
          String(proposal.status || '').toUpperCase() === FREELANCER_PENDING_CLIENT_APPROVAL,
      ).length,
      pending: items.filter((proposal) => String(proposal.status || '').toUpperCase() === 'PENDING')
        .length,
      accepted: items.filter(
        (proposal) => String(proposal.status || '').toUpperCase() === 'ACCEPTED',
      ).length,
      rejected: items.filter(
        (proposal) => String(proposal.status || '').toUpperCase() === 'REJECTED',
      ).length,
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
    freelancerSelectionSummary: ReturnType<
      ProjectRequestsService['buildFreelancerSelectionSummary']
    >;
  }) {
    const isProjectLinked = Boolean(input.linkedProject);
    const brokerMarket =
      isProjectLinked || Boolean(input.request.brokerId)
        ? 'CLOSED'
        : input.request.status === RequestStatus.PRIVATE_DRAFT
          ? 'DIRECT_INVITE_ONLY'
          : 'OPEN';

    const freelancerMarket =
      isProjectLinked || Boolean(this.resolveActiveFreelancerProposal(input.request))
        ? 'CLOSED'
        : [
              RequestStatus.SPEC_APPROVED,
              RequestStatus.HIRING,
              RequestStatus.CONTRACT_PENDING,
            ].includes(input.request.status)
          ? 'OPEN'
          : 'LOCKED';

    return {
      brokerMarket,
      freelancerMarket,
      brokerSlotCapReached: !input.brokerSlots.hasCapacity,
      brokerSlots: input.brokerSlots,
    };
  }

  private async notifyUsers(
    inputs: Array<{
      userId?: string | null;
      title: string;
      body: string;
      relatedType?: string | null;
      relatedId?: string | null;
    }>,
  ) {
    const deduped = new Map<
      string,
      {
        userId: string;
        title: string;
        body: string;
        relatedType?: string | null;
        relatedId?: string | null;
      }
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

  private emitRequestUpdated(requestId: string, userIds: Array<string | null | undefined>) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    uniqueUserIds.forEach((userId) => {
      this.eventEmitter.emit('request.updated', {
        userId,
        requestId,
        entityType: 'ProjectRequest',
        entityId: requestId,
      });
    });
  }

  private async buildRequestListReadModel(request: ProjectRequestEntity) {
    const hydratedAttachments = await this.hydrateAttachments(request.attachments);

    return {
      ...request,
      attachments: hydratedAttachments,
      requestScopeBaseline: this.buildRequestScopeBaseline(request),
      commercialBaseline: this.resolveCommercialBaseline(request),
      activeCommercialChangeRequest: this.normalizeCommercialChangeRequest(
        request.activeCommercialChangeRequest,
      ),
    };
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
        ? ((
            await this.contractRepo.find({
              where: { projectId: linkedProject.id },
              order: { createdAt: 'DESC' },
              take: 1,
            })
          )?.[0] ?? null)
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
      brokerId: proposal.brokerId,
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
    const isBrokerViewer = user?.role === UserRole.BROKER;
    const isAssignedBrokerViewer = isBrokerViewer && request.brokerId === user?.id;
    const visibleBrokerApplications =
      isBrokerViewer && !isAssignedBrokerViewer
        ? brokerApplications.filter((proposal) => proposal.brokerId === user?.id)
        : brokerApplications;
    const brokerSelectionSummary = this.buildBrokerSelectionSummary({
      request,
      brokerApplications: visibleBrokerApplications,
      slots: brokerApplicationSlots,
    });
    const marketVisibility = this.buildMarketVisibility({
      request,
      linkedProject,
      brokerSlots: brokerApplicationSlots,
      freelancerSelectionSummary,
    });
    const hydratedAttachments = await this.hydrateAttachments(request.attachments);
    const originalRequestContext = await this.buildOriginalRequestContext(request);

    return {
      ...request,
      attachments: hydratedAttachments,
      originalRequestContext,
      requestScopeBaseline: this.buildRequestScopeBaseline(request),
      commercialBaseline: this.resolveCommercialBaseline(request),
      activeCommercialChangeRequest: this.normalizeCommercialChangeRequest(
        request.activeCommercialChangeRequest,
      ),
      freelancerProposals: request.proposals,
      specSummary: {
        clientSpec: viewerPermissions.canViewSpecs && clientSpec
          ? {
              id: clientSpec.id,
              title: clientSpec.title,
              status: clientSpec.status,
              specPhase: clientSpec.specPhase,
            }
          : null,
        fullSpec: viewerPermissions.canViewSpecs && fullSpec
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
        total: visibleBrokerApplications.length,
        invited: visibleBrokerApplications.filter(
          (proposal) => proposal.status === ProposalStatus.INVITED,
        ).length,
        pending: visibleBrokerApplications.filter(
          (proposal) => proposal.status === ProposalStatus.PENDING,
        ).length,
        accepted: visibleBrokerApplications.filter(
          (proposal) => proposal.status === ProposalStatus.ACCEPTED,
        ).length,
        rejected: visibleBrokerApplications.filter(
          (proposal) => proposal.status === ProposalStatus.REJECTED,
        ).length,
        assignedBrokerId: request.brokerId ?? null,
        items: visibleBrokerApplications,
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
        'proposals.broker',
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
    try {
      // Quota check: enforce free-tier limit on active requests
      await this.quotaService.checkQuota(clientId, QuotaAction.CREATE_REQUEST);
      const intendedTimeline = this.normalizeIntendedTimeline(dto.intendedTimeline);
      const requestedDeadline = this.normalizeRequestedDeadline(
        dto.requestedDeadline ??
          (DATE_ONLY_INPUT_PATTERN.test(`${dto.intendedTimeline || ''}`)
            ? dto.intendedTimeline
            : undefined),
      );

      const request = this.requestRepo.create({
        clientId: clientId,
        title: dto.title,
        description: dto.description,
        budgetRange: dto.budgetRange,
        intendedTimeline,
        requestedDeadline: requestedDeadline ?? null,
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

      if (fullRequest) {
        fullRequest.requestScopeBaseline = this.buildRequestScopeBaseline(fullRequest);
        await this.requestRepo.save(fullRequest);
      }

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
      } catch (_error) {
        console.error('Create Request Audit Log Failed');
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
        this.emitRequestUpdated(fullRequest.id, [clientId, fullRequest.brokerId]);
      }

      const result = fullRequest ?? savedRequest;
      console.log(`Create Request Successful: ${result.status}`);
      return result;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Create Request Failed: ${messageText}`);
      throw error;
    }
  }

  // ... existing methods ...

  async findAll(status?: RequestStatus) {
    const options: FindManyOptions<ProjectRequestEntity> = {
      relations: [
        'answers',
        'answers.question',
        'answers.option',
        'client',
        'broker',
        'brokerProposals',
        'brokerProposals.broker',
      ],
      order: { createdAt: 'DESC' },
    };
    if (status) {
      options.where = { status };
    }
    const requests = await this.requestRepo.find(options);
    return Promise.all(
      requests.map((request) => this.buildRequestListReadModel(request)),
    );
  }

  async update(id: string, dto: UpdateProjectRequestDto, user?: UserEntity, req?: RequestContext) {
    try {
      const request = await this.findOneEntity(id);

      if (user) {
        const isOwner = user.role === UserRole.CLIENT && request.clientId === user.id;
        const isInternal = hasOperationalStaffAccess(user);
        const isAssignedBroker = user.role === UserRole.BROKER && request.brokerId === user.id;
        if (!isOwner && !isInternal && !isAssignedBroker) {
          throw new ForbiddenException('Forbidden: You cannot update this request');
        }
      }

      // Update main fields
      if (dto.title) request.title = dto.title;
      if (dto.description) request.description = dto.description;
      if (dto.budgetRange) request.budgetRange = dto.budgetRange;
      if (dto.intendedTimeline !== undefined) {
        const intendedTimeline = this.normalizeIntendedTimeline(dto.intendedTimeline);
        request.intendedTimeline = intendedTimeline ?? null;
      }
      if (dto.requestedDeadline !== undefined || dto.intendedTimeline !== undefined) {
        request.requestedDeadline =
          this.normalizeRequestedDeadline(
            dto.requestedDeadline ??
              (DATE_ONLY_INPUT_PATTERN.test(`${dto.intendedTimeline || ''}`)
                ? dto.intendedTimeline
                : undefined),
          ) ?? null;
      }
      if (dto.techPreferences) request.techPreferences = dto.techPreferences;
      if (dto.attachments) request.attachments = this.normalizeAttachments(dto.attachments);
      if (dto.wizardProgressStep !== undefined) {
        request.wizardProgressStep = dto.wizardProgressStep;
      }

      if (dto.status) {
        if (
          request.status === RequestStatus.PUBLIC_DRAFT &&
          dto.status === RequestStatus.PRIVATE_DRAFT
        ) {
          await this.denyPendingProposals(request.id);
        }
        request.status = dto.status;
      }

      await this.requestRepo.save(request);

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

      const refreshedRequest = await this.findOneEntity(id);
      refreshedRequest.requestScopeBaseline = this.buildRequestScopeBaseline(refreshedRequest);
      await this.requestRepo.save(refreshedRequest);
      this.emitRequestUpdated(id, [refreshedRequest.clientId, refreshedRequest.brokerId]);

      const updatedRequest = await this.findOne(id);
      console.log(`Update Request Successful: "${id}" -> "${updatedRequest.status}"`);
      return updatedRequest;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Update Request Failed: ${message}`);
      throw error;
    }
  }

  async publish(requestId: string, userId: string, req?: RequestContext) {
    try {
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
        throw new BadRequestException(
          'Cannot publish a request that already has a broker assigned',
        );
      }

      if (request.status === RequestStatus.PUBLIC_DRAFT) {
        console.log(`Publish Request Successful: "${requestId}" -> "${request.status}"`);
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
      } catch (_error) {
        console.error('Publish Request Audit Log Failed');
      }

      const publishedRequest = await this.findOne(requestId, {
        id: userId,
        role: UserRole.CLIENT,
      } as UserEntity);
      console.log(`Publish Request Successful: "${requestId}" -> "${publishedRequest.status}"`);
      return publishedRequest;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Publish Request Failed: ${message}`);
      throw error;
    }
  }

  async findAllByClient(clientId: string) {
    const requests = await this.requestRepo.find({
      where: { clientId },
      relations: ['answers', 'answers.question', 'answers.option'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      requests.map((request) => this.buildRequestListReadModel(request)),
    );
  }

  async findDraftsByClient(clientId: string) {
    const requests = await this.requestRepo.find({
      where: { clientId, status: RequestStatus.DRAFT },
      relations: ['answers', 'answers.question', 'answers.option'],
      order: { createdAt: 'DESC' },
    });

    const hydratedRequests = await Promise.all(
      requests.map((request) => this.buildRequestListReadModel(request)),
    );

    console.log(`Find My Drafts Successful: ${hydratedRequests.length} draft request(s)`);

    return hydratedRequests;
  }

  async findOne(id: string, user?: UserEntity) {
    try {
      const request = await this.findOneEntity(id);

      if (user) {
        if (user.role === UserRole.STAFF && !hasOperationalStaffAccess(user)) {
          throw new ForbiddenException(
            'Forbidden: Staff operational access requires admin approval.',
          );
        }

        if (user.role === UserRole.CLIENT && request.clientId !== user.id) {
          throw new ForbiddenException('Forbidden: You can only view your own requests');
        }

        if (user.role === UserRole.BROKER) {
          const isAssignedBroker = request.brokerId === user.id;
          const hasActiveProposalAccess = Boolean(
            request.brokerProposals?.some(
              (proposal) =>
                proposal.brokerId === user.id &&
                [ProposalStatus.INVITED, ProposalStatus.PENDING, ProposalStatus.ACCEPTED].includes(
                  proposal.status as ProposalStatus,
                ),
            ),
          );
          const isOpenMarketplaceRequest =
            !request.brokerId &&
            [RequestStatus.PUBLIC_DRAFT, RequestStatus.PENDING].includes(request.status);
          const isPrivateInviteRequest =
            !request.brokerId &&
            request.status === RequestStatus.PRIVATE_DRAFT &&
            hasActiveProposalAccess;

          if (!isAssignedBroker && !isOpenMarketplaceRequest && !isPrivateInviteRequest) {
            throw new ForbiddenException(
              'Forbidden: You can only view open marketplace requests, your invitations, or requests assigned to you',
            );
          }

          // Marketplace viewers can review the request, but contact details stay hidden until assigned.
          if (!isAssignedBroker && request.client) {
            request.client.email = '********';
            if ('phoneNumber' in request.client) {
              (request.client as UserEntity & { phoneNumber?: string | null }).phoneNumber =
                '********';
            }
          }
        }

        if (user.role === UserRole.FREELANCER) {
          const hasProposal = request.proposals?.some(
            (proposal) =>
              proposal.freelancerId === user.id &&
              ['INVITED', 'PENDING', 'ACCEPTED'].includes((proposal.status || '').toUpperCase()),
          );
          const isOpenMarketplaceRequest =
            request.status === RequestStatus.SPEC_APPROVED &&
            Boolean(request.brokerId) &&
            !this.resolveActiveFreelancerProposal(request);

          if (!hasProposal && !isOpenMarketplaceRequest) {
            throw new ForbiddenException(
              'Forbidden: You can only view freelancer marketplace requests or requests where you are invited',
            );
          }

          if (!hasProposal && request.client) {
            this.maskUserContact(request.client);
          }
        }
      }

      const readModel = await this.buildRequestReadModel(request, user);
      console.log(`Get Request Detail Successful: "${id}"`);
      return readModel;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Get Request Detail Failed: ${message}`);
      throw error;
    }
  }

  private async emitRequestSystemMessage(
    requestId: string,
    content: string,
    options?: RequestSystemMessageOptions,
  ) {
    try {
      await this.requestChatService.createSystemMessage(requestId, content, options);
    } catch (error) {
      console.warn(
        `Request chat system message failed for ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private assertCommercialChangeRequestAllowed(input: {
    request: ProjectRequestEntity;
    latestFullSpec: Pick<ProjectSpecEntity, 'id' | 'status'> | null;
  }) {
    const { request, latestFullSpec } = input;

    if (!request.brokerId) {
      throw new BadRequestException('Commercial change requests require an assigned broker');
    }

    if (
      request.status === RequestStatus.CONTRACT_PENDING ||
      request.status === RequestStatus.CONVERTED_TO_PROJECT
    ) {
      throw new BadRequestException('Commercial changes are locked after contract handoff begins');
    }

    if (
      latestFullSpec &&
      ![ProjectSpecStatus.DRAFT, ProjectSpecStatus.REJECTED].includes(latestFullSpec.status)
    ) {
      if (latestFullSpec.status === ProjectSpecStatus.FINAL_REVIEW) {
        throw new BadRequestException(
          'Full spec is already in final review. Request changes on the full spec before proposing a commercial update.',
        );
      }

      throw new BadRequestException(
        `Commercial changes are not allowed while full spec is ${latestFullSpec.status}.`,
      );
    }
  }

  private buildBaselineFromApprovedChange(
    request: ProjectRequestEntity,
    changeRequest: ProjectRequestCommercialChangeRequest,
  ): ProjectRequestCommercialBaseline {
    const existingBaseline = this.resolveCommercialBaseline(request);
    const effectiveBudget =
      changeRequest.proposedBudget ??
      changeRequest.currentBudget ??
      existingBaseline?.agreedBudget ??
      existingBaseline?.estimatedBudget ??
      null;
    const effectiveTimeline =
      this.safeNormalizeRequestedDeadline(
        changeRequest.proposedTimeline ??
          changeRequest.currentTimeline ??
          existingBaseline?.agreedDeliveryDeadline ??
          existingBaseline?.estimatedTimeline ??
          undefined,
      ) ?? null;
    const effectiveFeatures =
      this.normalizeCommercialFeatures(changeRequest.proposedClientFeatures) ??
      this.normalizeCommercialFeatures(changeRequest.currentClientFeatures) ??
      this.normalizeCommercialFeatures(
        existingBaseline?.agreedClientFeatures ?? existingBaseline?.clientFeatures,
      );

    return {
      source: 'COMMERCIAL_CHANGE',
      budgetRange: request.budgetRange ?? null,
      estimatedBudget: effectiveBudget,
      estimatedTimeline: effectiveTimeline,
      clientFeatures: effectiveFeatures,
      agreedBudget: effectiveBudget,
      agreedDeliveryDeadline: effectiveTimeline,
      agreedClientFeatures: effectiveFeatures,
      sourceSpecId: changeRequest.parentSpecId ?? existingBaseline?.sourceSpecId ?? null,
      sourceChangeRequestId: changeRequest.id,
      approvedAt: changeRequest.respondedAt ?? new Date().toISOString(),
    };
  }

  async createCommercialChangeRequest(
    requestId: string,
    actor: UserEntity,
    dto: CreateCommercialChangeRequestDto,
    req: RequestContext,
  ) {
    const request = await this.findOneEntity(requestId);
    const isAssignedBroker = actor.role === UserRole.BROKER && request.brokerId === actor.id;
    const isInternal = hasOperationalStaffAccess(actor);

    if (!isAssignedBroker && !isInternal) {
      throw new ForbiddenException(
        'Only the assigned broker or internal staff can propose commercial changes.',
      );
    }

    const specs = (request.specs || []) as Array<
      Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
    >;
    const clientSpec = this.pickLatestSpecByPhase(specs, SpecPhase.CLIENT_SPEC);
    const fullSpec = this.pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC);
    const baseline = this.resolveCommercialBaseline(request);

    if (
      !baseline?.estimatedBudget ||
      ![ProjectSpecStatus.CLIENT_APPROVED, ProjectSpecStatus.APPROVED].includes(
        clientSpec?.status as ProjectSpecStatus,
      )
    ) {
      throw new BadRequestException(
        'Commercial changes are only available after the client approves the client spec baseline.',
      );
    }

    this.assertCommercialChangeRequestAllowed({
      request,
      latestFullSpec: fullSpec,
    });

    const existingChangeRequest = this.normalizeCommercialChangeRequest(
      request.activeCommercialChangeRequest,
    );
    if (existingChangeRequest?.status === 'PENDING') {
      throw new BadRequestException(
        'There is already an open commercial change request for this request.',
      );
    }

    const currentFeatures = this.normalizeCommercialFeatures(
      baseline.agreedClientFeatures ?? baseline.clientFeatures,
    );
    const hasProposedFeatureInput = Array.isArray(dto.proposedClientFeatures);
    const proposedFeatures = hasProposedFeatureInput
      ? this.normalizeCommercialFeatures(dto.proposedClientFeatures)
      : currentFeatures;
    const proposedTimelineInput = `${dto.proposedTimeline || ''}`.trim();
    const hasProposedTimelineInput = proposedTimelineInput.length > 0;
    const currentTimeline =
      this.safeNormalizeRequestedDeadline(
        baseline.agreedDeliveryDeadline ?? baseline.estimatedTimeline ?? undefined,
      ) ?? null;
    const proposedTimeline = hasProposedTimelineInput
      ? this.normalizeRequestedDeadline(proposedTimelineInput)
      : currentTimeline;
    const commercialTimelineFloor = this.resolveCommercialChangeTimelineFloor(request, baseline);

    if (hasProposedTimelineInput && proposedTimeline && proposedTimeline < commercialTimelineFloor) {
      throw new BadRequestException(
        `Commercial change timeline cannot be earlier than ${commercialTimelineFloor}. Use this flow only to preserve or extend the approved/requested deadline.`,
      );
    }

    const hasBudgetChange =
      typeof (baseline.agreedBudget ?? baseline.estimatedBudget) === 'number' &&
      Math.abs((dto.proposedBudget ?? 0) - (baseline.agreedBudget ?? baseline.estimatedBudget ?? 0)) >
        0.01;
    const hasTimelineChange = hasProposedTimelineInput && proposedTimeline !== currentTimeline;
    const hasFeatureChange =
      hasProposedFeatureInput &&
      JSON.stringify(proposedFeatures || []) !== JSON.stringify(currentFeatures || []);

    if (!hasBudgetChange && !hasTimelineChange && !hasFeatureChange) {
      throw new BadRequestException(
        'Commercial change request must actually change budget, timeline, or client-facing features.',
      );
    }

    const budgetRangeEvaluation = this.evaluateProposedBudgetAgainstRequestRange(
      request.budgetRange ?? baseline.budgetRange ?? null,
      dto.proposedBudget,
    );

    const commercialChangeRequest: ProjectRequestCommercialChangeRequest = {
      id: randomUUID(),
      status: 'PENDING',
      reason: `${dto.reason || ''}`.trim(),
      requestedByBrokerId: actor.id,
      requestedAt: new Date().toISOString(),
      respondedAt: null,
      respondedByClientId: null,
      responseNote: null,
      currentBudget: baseline.agreedBudget ?? baseline.estimatedBudget ?? null,
      proposedBudget: dto.proposedBudget,
      currentTimeline,
      proposedTimeline,
      currentClientFeatures: currentFeatures,
      proposedClientFeatures: proposedFeatures,
      parentSpecId: dto.parentSpecId || clientSpec?.id || null,
      requestBudgetRange: budgetRangeEvaluation.requestBudgetRange,
      proposedBudgetOutsideRequestRange: budgetRangeEvaluation.proposedBudgetOutsideRequestRange,
      proposedBudgetRangeWarning: budgetRangeEvaluation.proposedBudgetRangeWarning,
      clientAcknowledgedBudgetRangeWarning: false,
      clientAcknowledgedBudgetRangeWarningAt: null,
    };

    if (commercialChangeRequest.reason.length < 10) {
      throw new BadRequestException('Commercial change reason must be at least 10 characters.');
    }

    request.activeCommercialChangeRequest = commercialChangeRequest;
    await this.requestRepo.save(request);

    await this.auditLogsService.log({
      actorId: actor.id,
      action: 'CREATE_COMMERCIAL_CHANGE_REQUEST',
      entityType: 'ProjectRequest',
      entityId: requestId,
      newData: commercialChangeRequest as unknown as Record<string, unknown>,
      req,
    });

    await this.notifyUsers([
      {
        userId: request.clientId,
        title: 'Commercial change requested',
        body: `Broker proposed a commercial change for "${request.title}". Review the updated budget/timeline before final spec approval.`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      {
        userId: request.brokerId,
        title: 'Commercial change submitted',
        body: `Your commercial change request for "${request.title}" is waiting for client approval.`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);

    await this.emitRequestSystemMessage(
      requestId,
      'Broker submitted a commercial change request for client approval.',
    );

    return this.findOne(requestId, actor);
  }

  async respondCommercialChangeRequest(
    requestId: string,
    changeRequestId: string,
    actor: UserEntity,
    dto: RespondCommercialChangeRequestDto,
    req: RequestContext,
  ) {
    const request = await this.findOneEntity(requestId);
    if (actor.role !== UserRole.CLIENT || request.clientId !== actor.id) {
      throw new ForbiddenException('Only the request owner can respond to commercial changes.');
    }

    const changeRequest = this.normalizeCommercialChangeRequest(
      request.activeCommercialChangeRequest,
    );
    if (!changeRequest || changeRequest.id !== changeRequestId) {
      throw new NotFoundException('Commercial change request not found.');
    }
    if (changeRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `Commercial change request is already ${changeRequest.status.toLowerCase()}.`,
      );
    }

    const specs = (request.specs || []) as Array<
      Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
    >;
    const fullSpec = this.pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC);
    this.assertCommercialChangeRequestAllowed({
      request,
      latestFullSpec: fullSpec,
    });

    const budgetRangeEvaluation = this.evaluateProposedBudgetAgainstRequestRange(
      request.budgetRange ?? changeRequest.requestBudgetRange ?? null,
      changeRequest.proposedBudget,
    );

    if (
      dto.action === 'APPROVE' &&
      budgetRangeEvaluation.proposedBudgetOutsideRequestRange &&
      !dto.acknowledgeOutOfRangeBudgetWarning
    ) {
      throw new BadRequestException(
        budgetRangeEvaluation.proposedBudgetRangeWarning ||
          'Proposed budget is outside the original request range. Please acknowledge the warning before approval.',
      );
    }

    changeRequest.status = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    changeRequest.respondedAt = new Date().toISOString();
    changeRequest.respondedByClientId = actor.id;
    changeRequest.responseNote = `${dto.note || ''}`.trim() || null;
    changeRequest.requestBudgetRange = budgetRangeEvaluation.requestBudgetRange;
    changeRequest.proposedBudgetOutsideRequestRange =
      budgetRangeEvaluation.proposedBudgetOutsideRequestRange;
    changeRequest.proposedBudgetRangeWarning = budgetRangeEvaluation.proposedBudgetRangeWarning;

    if (dto.action === 'APPROVE' && budgetRangeEvaluation.proposedBudgetOutsideRequestRange) {
      changeRequest.clientAcknowledgedBudgetRangeWarning = true;
      changeRequest.clientAcknowledgedBudgetRangeWarningAt = changeRequest.respondedAt;
    } else {
      changeRequest.clientAcknowledgedBudgetRangeWarning = false;
      changeRequest.clientAcknowledgedBudgetRangeWarningAt = null;
    }

    if (dto.action === 'APPROVE') {
      request.commercialBaseline = this.buildBaselineFromApprovedChange(request, changeRequest);
    }

    request.activeCommercialChangeRequest = changeRequest;
    await this.requestRepo.save(request);

    if (dto.action === 'APPROVE' && fullSpec?.id) {
      const fullSpecEntity = await this.findOneEntity(requestId).then((entity) =>
        (entity.specs || []).find((spec) => spec.id === fullSpec.id),
      );
      if (
        fullSpecEntity &&
        [ProjectSpecStatus.DRAFT, ProjectSpecStatus.REJECTED].includes(fullSpecEntity.status)
      ) {
        fullSpecEntity.status = ProjectSpecStatus.REJECTED;
        fullSpecEntity.rejectionReason =
          'Commercial baseline changed. Review budget, timeline, and client-facing features before resubmitting.';
        await this.requestRepo.manager.getRepository(ProjectSpecEntity).save(fullSpecEntity);
      }
    }

    await this.auditLogsService.log({
      actorId: actor.id,
      action:
        dto.action === 'APPROVE'
          ? 'APPROVE_COMMERCIAL_CHANGE_REQUEST'
          : 'REJECT_COMMERCIAL_CHANGE_REQUEST',
      entityType: 'ProjectRequest',
      entityId: requestId,
      newData: changeRequest as unknown as Record<string, unknown>,
      req,
    });

    await this.notifyUsers([
      {
        userId: request.brokerId,
        title:
          dto.action === 'APPROVE' ? 'Commercial change approved' : 'Commercial change rejected',
        body:
          dto.action === 'APPROVE'
            ? `Client approved the commercial change for "${request.title}". Update the final spec to match the new baseline.`
            : `Client rejected the commercial change for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
      {
        userId: request.clientId,
        title:
          dto.action === 'APPROVE' ? 'Commercial baseline updated' : 'Commercial change closed',
        body:
          dto.action === 'APPROVE'
            ? `You approved the commercial update for "${request.title}".`
            : `You rejected the commercial update for "${request.title}".`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      },
    ]);

    await this.emitRequestSystemMessage(
      requestId,
      dto.action === 'APPROVE'
        ? 'Client approved the commercial change request. The final spec baseline was updated.'
        : 'Client rejected the commercial change request.',
    );

    return this.findOne(requestId, actor);
  }

  async findMatches(id: string, userId?: string) {
    try {
      const request = await this.findOneEntity(id);

      // Quota check: enforce free-tier limit on AI match searches (daily)
      if (userId) {
        await this.quotaService.checkQuota(userId, QuotaAction.AI_MATCH_SEARCH);
      }

      const techStack = request.techPreferences
        ? request.techPreferences
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
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

      console.log(`Find Matches Successful: ${results.length} candidate(s) for request "${id}"`);
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Find Matches Failed: ${message}`);
      throw error;
    }
  }

  async inviteBroker(requestId: string, brokerId: string, message?: string, inviterId?: string) {
    try {
      if (inviterId) {
        await this.quotaService.checkQuota(inviterId, QuotaAction.INVITE_BROKER, requestId);
      }

      const request = await this.findOneEntity(requestId);

      if (request.brokerId) throw new Error('Request already has a broker assigned');

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
        throw new Error(`Broker already has proposal status: ${existing.status}`);
      }

      const proposal = this.brokerProposalRepo.create({
        requestId,
        brokerId,
        status: ProposalStatus.INVITED,
        coverLetter: message,
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
      await this.emitRequestSystemMessage(
        requestId,
        'Client invited a broker to collaborate on this request.',
      );
      console.log(`Invite Broker Successful: "${requestId}" -> "${brokerId}"`);
      return savedProposal;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Invite Broker Failed: ${messageText}`);
      throw error;
    }
  }

  async inviteFreelancer(
    requestId: string,
    freelancerId: string,
    message: string | undefined,
    actor: Pick<UserEntity, 'id' | 'role'>,
  ) {
    try {
      const request = await this.findOneEntity(requestId);
      const isAssignedBroker = actor.role === UserRole.BROKER && request.brokerId === actor.id;
      const isInternal = hasOperationalStaffAccess(actor);
      if (!isAssignedBroker && !isInternal) {
        throw new ForbiddenException(
          'Only the assigned broker or internal staff can recommend freelancers.',
        );
      }

      const specs = (request.specs || []) as Array<
        Pick<ProjectSpecEntity, 'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'>
      >;
      const clientSpec = this.pickLatestSpecByPhase(specs, SpecPhase.CLIENT_SPEC);
      const activeFreelancerProposal = this.resolveActiveFreelancerProposal(request);
      if (activeFreelancerProposal) {
        throw new BadRequestException(
          'Only one freelancer can be active for a request at a time.',
        );
      }

      const canRecommendFreelancer =
        clientSpec?.status === ProjectSpecStatus.CLIENT_APPROVED && !activeFreelancerProposal;
      if (!canRecommendFreelancer) {
        throw new BadRequestException(
          'Freelancer recommendations are only available after the client approves the client spec.',
        );
      }

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
        brokerId: request.brokerId ?? (isAssignedBroker ? actor.id : null),
        status: FREELANCER_PENDING_CLIENT_APPROVAL,
        coverLetter: message,
      });
      const savedProposal = await this.freelancerProposalRepo.save(proposal);
      await this.notifyUsers([
        {
          userId: request.clientId,
          title: 'Broker recommended a freelancer',
          body: `A freelancer recommendation is pending your review for "${request.title}".`,
          relatedType: 'ProjectRequest',
          relatedId: requestId,
        },
      ]);
      await this.emitRequestSystemMessage(
        requestId,
        'Broker recommended a freelancer and is waiting for client approval.',
      );
      console.log(`Invite Freelancer Successful: "${requestId}" -> "${freelancerId}"`);
      return savedProposal;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Invite Freelancer Failed: ${messageText}`);
      throw error;
    }
  }

  async approveFreelancerInvite(requestId: string, proposalId: string, clientId: string) {
    try {
      const request = await this.findOneEntity(requestId);

      if (request.clientId !== clientId) {
        throw new ForbiddenException(
          'Forbidden: You can only approve freelancer recommendations for your own requests',
        );
      }

      const proposal = await this.freelancerProposalRepo.findOne({
        where: { id: proposalId, requestId },
        relations: ['freelancer'],
      });
      if (!proposal) {
        throw new NotFoundException('Freelancer proposal not found.');
      }

      if (String(proposal.status || '').toUpperCase() !== FREELANCER_PENDING_CLIENT_APPROVAL) {
        throw new BadRequestException(
          `Proposal status ${proposal.status} cannot be approved by the client.`,
        );
      }

      const acceptedFreelancer = (request.proposals || []).find(
        (candidate) =>
          candidate.id !== proposal.id && String(candidate.status || '').toUpperCase() === 'ACCEPTED',
      );
      if (acceptedFreelancer) {
        throw new BadRequestException('A freelancer has already been accepted for this request');
      }

      proposal.status = 'INVITED';
      const savedProposal = await this.freelancerProposalRepo.save(proposal);
      const competingRecommendations = (request.proposals || []).filter(
        (candidate) =>
          candidate.id !== proposal.id &&
          this.isActiveFreelancerProposalStatus(candidate.status) &&
          String(candidate.status || '').toUpperCase() !== 'ACCEPTED',
      );

      for (const competingRecommendation of competingRecommendations) {
        competingRecommendation.status = 'REJECTED';
        await this.freelancerProposalRepo.save(competingRecommendation);
      }

      await this.notifyUsers([
        {
          userId: proposal.freelancerId,
          title: 'You were invited to a project',
          body: `You were invited to participate in "${request.title}".`,
          relatedType: 'ProjectRequest',
          relatedId: requestId,
        },
        {
          userId: proposal.brokerId ?? request.brokerId,
          title: 'Client approved your freelancer recommendation',
          body: `Your freelancer recommendation was approved for "${request.title}".`,
          relatedType: 'ProjectRequest',
          relatedId: requestId,
        },
      ]);
      await this.emitRequestSystemMessage(
        requestId,
        'Client approved the freelancer recommendation and sent an invitation.',
      );

      console.log(`Approve Freelancer Invite Successful: "${proposalId}"`);
      return savedProposal;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Approve Freelancer Invite Failed: ${messageText}`);
      throw error;
    }
  }

  async rejectFreelancerInvite(requestId: string, proposalId: string, clientId: string) {
    try {
      const request = await this.findOneEntity(requestId);

      if (request.clientId !== clientId) {
        throw new ForbiddenException(
          'Forbidden: You can only reject freelancer recommendations for your own requests',
        );
      }

      const proposal = await this.freelancerProposalRepo.findOne({
        where: { id: proposalId, requestId },
      });
      if (!proposal) {
        throw new NotFoundException('Freelancer proposal not found.');
      }

      if (String(proposal.status || '').toUpperCase() !== FREELANCER_PENDING_CLIENT_APPROVAL) {
        throw new BadRequestException(
          `Proposal status ${proposal.status} cannot be rejected by the client.`,
        );
      }

      proposal.status = 'REJECTED';
      const savedProposal = await this.freelancerProposalRepo.save(proposal);

      await this.notifyUsers([
        {
          userId: proposal.brokerId ?? request.brokerId,
          title: 'Client rejected your freelancer recommendation',
          body: `Your freelancer recommendation was rejected for "${request.title}".`,
          relatedType: 'ProjectRequest',
          relatedId: requestId,
        },
      ]);
      await this.emitRequestSystemMessage(
        requestId,
        'Client rejected the freelancer recommendation.',
      );

      console.log(`Reject Freelancer Invite Successful: "${proposalId}"`);
      return savedProposal;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Reject Freelancer Invite Failed: ${messageText}`);
      throw error;
    }
  }

  async getInvitationsForUser(userId: string, role: UserRole) {
    if (role === UserRole.BROKER) {
      const invitations = await this.brokerProposalRepo.find({
        where: {
          brokerId: userId,
          status: In([ProposalStatus.INVITED, ProposalStatus.PENDING, ProposalStatus.ACCEPTED]),
        },
        relations: ['request', 'request.client'],
        order: { createdAt: 'DESC' },
      });
      console.log(`Get My Invitations Successful: ${role} -> ${invitations.length} invitation(s)`);
      return invitations;
    } else if (role === UserRole.FREELANCER) {
      const invitations = await this.freelancerProposalRepo.find({
        where: { freelancerId: userId, status: 'INVITED' },
        relations: ['request', 'request.client'],
        order: { createdAt: 'DESC' },
      });
      console.log(`Get My Invitations Successful: ${role} -> ${invitations.length} invitation(s)`);
      return invitations;
    }
    console.log(`Get My Invitations Successful: ${role} -> 0 invitation(s)`);
    return [];
  }

  async getFreelancerRequestAccessList(userId: string) {
    const requests = await this.freelancerProposalRepo.find({
      where: {
        freelancerId: userId,
        status: In(['INVITED', 'ACCEPTED', 'PENDING']),
      },
      relations: ['request', 'request.client', 'request.broker'],
      order: { createdAt: 'DESC' },
    });
    console.log(`Get Freelancer Request Access List Successful: ${requests.length} request(s)`);
    return requests;
  }

  async getFreelancerMarketplaceRequests() {
    const requests = await this.requestRepo.find({
      where: { status: RequestStatus.SPEC_APPROVED },
      relations: ['client', 'broker', 'proposals'],
      order: { createdAt: 'DESC' },
    });

    const openRequests = requests.filter(
      (request) => Boolean(request.brokerId) && !this.resolveActiveFreelancerProposal(request),
    );

    const hydratedRequests = await Promise.all(
      openRequests.map(async (request) => {
        this.maskUserContact(request.client);

        return {
          ...request,
          attachments: await this.hydrateAttachments(request.attachments),
          proposals: [],
        };
      }),
    );

    console.log(
      `Get Freelancer Marketplace Requests Successful: ${hydratedRequests.length} request(s)`,
    );
    return hydratedRequests;
  }

  async applyToRequest(requestId: string, brokerId: string, coverLetter: string) {
    try {
      const request = await this.findOneEntity(requestId);

      if (request.status !== RequestStatus.PUBLIC_DRAFT) {
        throw new BadRequestException('Request is not open for marketplace applications.');
      }

      if (request.brokerId) {
        throw new BadRequestException('Request already has a broker assigned.');
      }

      await this.assertBrokerApplicationSlotAvailable(requestId);

      const existingProposal = await this.brokerProposalRepo.findOne({
        where: { requestId, brokerId },
      });

      if (existingProposal) {
        throw new BadRequestException(
          'Broker already has an application or invitation for this request',
        );
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
      console.log(`Apply To Request Successful: "${requestId}" -> "${brokerId}"`);
      return savedProposal;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Apply To Request Failed: ${messageText}`);
      throw error;
    }
  }

  // --- Broker Self-Assignment (C02) ---

  async assignBroker(requestId: string, brokerId: string, req?: RequestContext) {
    void requestId;
    void brokerId;
    void req;

    const message =
      'Brokers cannot assign marketplace requests to themselves. Apply to the request and wait for the client to select you.';
    console.error(`Assign Broker Failed: ${message}`);
    throw new ForbiddenException(message);
  }

  // --- Phase 2: Hire Broker ---

  async acceptBroker(requestId: string, brokerId: string, clientId?: string) {
    try {
      const request = await this.findOneEntity(requestId);

      if (clientId && request.clientId !== clientId) {
        throw new ForbiddenException(
          'Forbidden: You can only accept brokers for your own requests',
        );
      }

      if (
        request.status !== RequestStatus.PUBLIC_DRAFT &&
        request.status !== RequestStatus.PRIVATE_DRAFT &&
        request.status !== RequestStatus.PENDING_SPECS
      ) {
        throw new Error('Request is not in a valid state to accept a broker');
      }

      request.brokerId = brokerId;
      request.status = RequestStatus.BROKER_ASSIGNED;

      await this.requestRepo.save(request);

      await this.brokerProposalRepo.update(
        { requestId, brokerId },
        { status: ProposalStatus.ACCEPTED },
      );

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
      await this.emitRequestSystemMessage(requestId, 'Client selected a broker for this request.', {
        skipNotificationUserIds: [brokerId, request.clientId],
        notificationTitle: 'Broker assignment update',
      });

      const acceptedRequest = await this.findOne(requestId);
      console.log(`Accept Broker Successful: "${requestId}" -> "${brokerId}"`);
      return acceptedRequest;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Accept Broker Failed: ${messageText}`);
      throw error;
    }
  }

  async releaseBrokerSlot(requestId: string, proposalId: string, actor: UserEntity) {
    try {
      const request = await this.findOneEntity(requestId);
      const isOwner = actor.role === UserRole.CLIENT && request.clientId === actor.id;
      const isInternal = hasOperationalStaffAccess(actor);
      if (!isOwner && !isInternal) {
        throw new ForbiddenException(
          'Only the client or internal staff can release a broker slot.',
        );
      }
      if (request.brokerId) {
        throw new BadRequestException(
          'Cannot release broker slots after a broker has been assigned.',
        );
      }

      const proposal = await this.brokerProposalRepo.findOne({
        where: { id: proposalId, requestId },
      });
      if (!proposal) {
        throw new NotFoundException('Broker proposal not found.');
      }

      if (
        !ACTIVE_BROKER_APPLICATION_STATUSES.includes(
          proposal.status as (typeof ACTIVE_BROKER_APPLICATION_STATUSES)[number],
        )
      ) {
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
      await this.emitRequestSystemMessage(
        requestId,
        'A broker application slot was released for this request.',
      );

      const releasedRequest = await this.findOne(requestId, actor);
      console.log(`Release Broker Slot Successful: "${proposalId}"`);
      return releasedRequest;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Release Broker Slot Failed: ${messageText}`);
      throw error;
    }
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
    await this.emitRequestSystemMessage(
      requestId,
      'Client approved the specification set and the request is moving forward.',
    );
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
      throw new BadRequestException(
        'Cannot convert request without a finalized full specification.',
      );
    }

    if (![ProjectSpecStatus.ALL_SIGNED, ProjectSpecStatus.APPROVED].includes(fullSpec.status)) {
      throw new BadRequestException(
        `Full spec is not ready for project handoff. Current status: ${fullSpec.status}.`,
      );
    }

    if (!request.brokerId) {
      throw new BadRequestException('Cannot convert request without an assigned broker.');
    }

    if (!hasOperationalStaffAccess(actor) && request.brokerId !== actor.id) {
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
    await this.emitRequestSystemMessage(
      requestId,
      linkedProject
        ? `Request was converted into project "${linkedProject.title}".`
        : 'Request moved into project workflow.',
    );
    return this.findOne(requestId, actor);
  }
  async deleteRequest(requestId: string, userId: string, req?: RequestContext) {
    try {
      const request = await this.requestRepo.findOne({
        where: { id: requestId },
        relations: ['proposals'],
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      if (request.clientId !== userId) {
        throw new ForbiddenException('You can only delete your own requests');
      }

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

      if (request.brokerId) {
        throw new BadRequestException(
          'Cannot delete a request that has a broker assigned. Use Dispute or Report to resolve.',
        );
      }

      const acceptedProposal = await this.freelancerProposalRepo.findOne({
        where: { requestId, status: 'ACCEPTED' },
      });
      if (acceptedProposal) {
        throw new BadRequestException('Cannot delete a request that has an accepted freelancer.');
      }

      await this.answerRepo.delete({ requestId });
      await this.brokerProposalRepo.delete({ requestId });
      await this.freelancerProposalRepo.delete({ requestId });
      await this.requestRepo.remove(request);

      try {
        await this.auditLogsService.logDelete(
          'ProjectRequest',
          requestId,
          { title: request.title, status: request.status },
          req,
        );
      } catch (_error) {
        console.error('Delete Request Audit Log Failed');
      }

      const result = { success: true, message: 'Request deleted successfully' };
      console.log(`Delete Request Successful: "${requestId}"`);
      return result;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Delete Request Failed: ${messageText}`);
      throw error;
    }
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
    try {
      if (role === UserRole.BROKER) {
        const proposal = await this.brokerProposalRepo.findOne({
          where: { id: invitationId, brokerId: userId },
          relations: ['request'],
        });
        if (!proposal) throw new Error('Invitation not found');
        if (proposal.status !== ProposalStatus.INVITED) {
          throw new Error(`Cannot respond to invitation with status: ${proposal.status}`);
        }

        if (status === 'ACCEPTED') {
          const request = proposal.request;
          if (!request) {
            throw new Error('Request not found for this invitation');
          }

          if (request.brokerId && request.brokerId !== userId) {
            throw new BadRequestException(
              'Another broker has already been assigned to this request.',
            );
          }

          proposal.status = ProposalStatus.ACCEPTED;
          request.brokerId = userId;

          if (
            request.status === RequestStatus.PUBLIC_DRAFT ||
            request.status === RequestStatus.PRIVATE_DRAFT ||
            request.status === RequestStatus.PENDING_SPECS
          ) {
            request.status = RequestStatus.BROKER_ASSIGNED;
          }

          await this.requestRepo.save(request);

          const competingProposals = await this.brokerProposalRepo.find({
            where: {
              requestId: proposal.requestId,
              status: In([ProposalStatus.INVITED, ProposalStatus.PENDING, ProposalStatus.ACCEPTED]),
            },
          });

          for (const competingProposal of competingProposals) {
            if (competingProposal.id === proposal.id) {
              continue;
            }
            competingProposal.status = ProposalStatus.REJECTED;
            await this.brokerProposalRepo.save(competingProposal);
          }
        } else {
          proposal.status = ProposalStatus.REJECTED;
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
        console.log(
          `Respond To Invitation Successful: role="${role}" invitation="${invitationId}" status="${status}"`,
        );
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
              Pick<
                ProjectSpecEntity,
                'id' | 'title' | 'status' | 'specPhase' | 'updatedAt' | 'createdAt'
              >
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
            throw new BadRequestException(
              'A freelancer has already been accepted for this request',
            );
          }

          proposal.status = 'ACCEPTED';

          await this.freelancerProposalRepo
            .createQueryBuilder()
            .update()
            .set({ status: 'REJECTED' })
            .where('requestId = :requestId', { requestId: proposal.requestId })
            .andWhere('id != :id', { id: proposal.id })
            .andWhere('status IN (:...statuses)', {
              statuses: ['INVITED', 'PENDING', FREELANCER_PENDING_CLIENT_APPROVAL],
            })
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
        console.log(
          `Respond To Invitation Successful: role="${role}" invitation="${invitationId}" status="${status}"`,
        );
        return savedProposal;
      }

      throw new Error('Invalid role');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`Respond To Invitation Failed: ${messageText}`);
      throw error;
    }
  }
}
