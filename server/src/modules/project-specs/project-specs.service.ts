import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
  SpecFeature,
  ClientFeature,
  ProjectSpecRequestContext,
  SpecFieldDiffEntry,
  SpecRejectionHistoryEntry,
  SpecSubmissionSnapshot,
} from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { ProjectSpecSignatureEntity } from '../../database/entities/project-spec-signature.entity';
import {
  ProjectRequestEntity,
  ProjectRequestCommercialBaseline,
  ProjectRequestCommercialFeature,
  ProjectRequestScopeBaseline,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { CreateClientSpecDto } from './dto/create-client-spec.dto';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { randomUUID } from 'crypto';
import { randomUUID } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { RequestChatService } from '../request-chat/request-chat.service';

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE CONSTANTS (from spec_project_governance.md)
// ─────────────────────────────────────────────────────────────────────────────

const GOVERNANCE_RULES = {
  // Milestone 1 không được vượt quá 30% tổng ngân sách
  MAX_FIRST_MILESTONE_PERCENT: 30,
  // Milestone cuối phải tối thiểu 20% tổng ngân sách
  MIN_LAST_MILESTONE_PERCENT: 20,
  // Tolerance cho so sánh budget (0.01 USD)
  BUDGET_TOLERANCE: 0.01,
};

// Từ ngữ cấm - gây tranh chấp (Keyword Warning System)
const BANNED_KEYWORDS = [
  // Từ ngữ cảm tính
  'đẹp',
  'sang trọng',
  'hiện đại',
  'thân thiện',
  'beautiful',
  'modern',
  'friendly',
  'elegant',
  // Từ ngữ định tính
  'nhanh',
  'tốt',
  'mạnh mẽ',
  'cao cấp',
  'fast',
  'good',
  'powerful',
  'premium',
  'smooth',
  'easy',
  'simple',
];

@Injectable()
export class ProjectSpecsService {
  private readonly logger = new Logger(ProjectSpecsService.name);

  constructor(
    @InjectRepository(ProjectSpecEntity)
    private readonly projectSpecsRepository: Repository<ProjectSpecEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestonesRepository: Repository<MilestoneEntity>,
    @InjectRepository(ProjectRequestEntity)
    private readonly projectRequestsRepository: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectSpecSignatureEntity)
    private readonly projectSpecSignaturesRepository: Repository<ProjectSpecSignatureEntity>,
    @InjectRepository(ProjectRequestProposalEntity)
    private readonly projectRequestProposalsRepository: Repository<ProjectRequestProposalEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly requestChatService: RequestChatService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GOVERNANCE VALIDATION METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate milestone budget distribution per Governance rules
   */
  private validateMilestoneBudget(
    milestones: CreateProjectSpecDto['milestones'],
    totalBudget: number,
  ): void {
    if (!milestones || milestones.length === 0) {
      throw new BadRequestException('At least one milestone is required');
    }

    const budget = new Decimal(totalBudget);
    const totalMilestoneAmount = milestones.reduce(
      (sum, m) => sum.plus(new Decimal(m.amount)),
      new Decimal(0),
    );

    // Rule 3: Tổng % phải chính xác bằng 100% (within tolerance)
    const budgetDiff = totalMilestoneAmount.minus(budget).abs();
    if (budgetDiff.greaterThan(GOVERNANCE_RULES.BUDGET_TOLERANCE)) {
      throw new BadRequestException(
        `Budget mismatch! Total milestones: $${totalMilestoneAmount.toFixed(2)}, ` +
          `Budget: $${budget.toFixed(2)}, Diff: $${budgetDiff.toFixed(2)}`,
      );
    }

    // Sort by sortOrder to identify first and last milestone
    const sorted = [...milestones].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const firstMilestone = sorted[0];
    const lastMilestone = sorted[sorted.length - 1];

    // Rule 1: Milestone 1 <= 30% tổng ngân sách
    const firstAmount = new Decimal(firstMilestone.amount);
    const firstPercent = firstAmount.dividedBy(budget).times(100);
    if (firstPercent.greaterThan(GOVERNANCE_RULES.MAX_FIRST_MILESTONE_PERCENT)) {
      throw new BadRequestException(
        `First milestone cannot exceed ${GOVERNANCE_RULES.MAX_FIRST_MILESTONE_PERCENT}% of total budget. ` +
          `Current: ${firstPercent.toFixed(1)}%`,
      );
    }

    // Rule 2: Milestone cuối >= 20% tổng ngân sách
    const lastAmount = new Decimal(lastMilestone.amount);
    const lastPercent = lastAmount.dividedBy(budget).times(100);
    if (lastPercent.lessThan(GOVERNANCE_RULES.MIN_LAST_MILESTONE_PERCENT)) {
      throw new BadRequestException(
        `Final milestone must be at least ${GOVERNANCE_RULES.MIN_LAST_MILESTONE_PERCENT}% of total budget. ` +
          `Current: ${lastPercent.toFixed(1)}%`,
      );
    }

    this.logger.log(
      `Milestone budget validation passed: First=${firstPercent.toFixed(1)}%, Last=${lastPercent.toFixed(1)}%`,
    );
  }

  private validateMilestoneStructure(
    milestones: CreateProjectSpecDto['milestones'],
    options?: {
      approvedDeadlineKey?: string | null;
    },
  ): void {
    const seenSortOrders = new Set<number>();
    const todayKey = this.getTodayDateKey();
    const sortedMilestones = [...milestones].sort(
      (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
    );
    let previousDueDateKey: string | null = null;

    sortedMilestones.forEach((milestone, index) => {
      const amount = new Decimal(milestone.amount);
      const retentionAmount = new Decimal(milestone.retentionAmount ?? 0);
      const retentionCap = amount.times(0.1);

      if (retentionAmount.greaterThan(amount)) {
        throw new BadRequestException(
          `Milestone ${index + 1} retention amount cannot exceed the milestone amount.`,
        );
      }

      if (retentionAmount.greaterThan(retentionCap)) {
        throw new BadRequestException(
          `Milestone ${index + 1} retention amount cannot exceed 10% of the milestone amount.`,
        );
      }

      const sortOrder = milestone.sortOrder ?? index;
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new BadRequestException(
          `Milestone ${index + 1} must have a non-negative integer sort order.`,
        );
      }

      if (seenSortOrders.has(sortOrder)) {
        throw new BadRequestException(
          `Milestones must have unique sortOrder values. Duplicate value: ${sortOrder}.`,
        );
      }
      seenSortOrders.add(sortOrder);

      if (!milestone.startDate) {
        throw new BadRequestException(`Milestone ${index + 1} start date is required.`);
      }

      if (!milestone.dueDate) {
        throw new BadRequestException(`Milestone ${index + 1} due date is required.`);
      }

      const startDateKey = this.normalizeDateOnlyInput(
        milestone.startDate,
        `Milestone ${index + 1} start date`,
      );
      const dueDateKey = this.normalizeDateOnlyInput(
        milestone.dueDate,
        `Milestone ${index + 1} due date`,
      );

      if (startDateKey < todayKey) {
        throw new BadRequestException(
          `Milestone ${index + 1} start date cannot be in the past.`,
        );
      }

      const minimumDueDateKey = startDateKey > todayKey ? startDateKey : todayKey;
      if (dueDateKey < minimumDueDateKey) {
        throw new BadRequestException(
          `Milestone ${index + 1} due date must be on or after ${minimumDueDateKey}.`,
        );
      }

      const startDate = new Date(`${startDateKey}T00:00:00.000Z`);
      const dueDate = new Date(`${dueDateKey}T00:00:00.000Z`);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(dueDate.getTime())) {
        throw new BadRequestException(`Milestone ${index + 1} has an invalid start or due date.`);
      }

      if (dueDate.getTime() < startDate.getTime()) {
        throw new BadRequestException(
          `Milestone ${index + 1} due date must be on or after the start date.`,
        );
      }

      if (previousDueDateKey && startDateKey < previousDueDateKey) {
        throw new BadRequestException(
          `Milestone ${index + 1} overlaps the previous milestone. Adjust the schedule to keep milestones sequential.`,
        );
      }

      if (options?.approvedDeadlineKey && dueDateKey > options.approvedDeadlineKey) {
        throw new BadRequestException(
          `Milestone ${index + 1} due date cannot exceed the approved delivery deadline ${options.approvedDeadlineKey}.`,
        );
      }

      if (
        options?.approvedDeadlineKey &&
        index === sortedMilestones.length - 1 &&
        dueDateKey !== options.approvedDeadlineKey
      ) {
        throw new BadRequestException(
          `Final milestone due date must match the approved delivery deadline ${options.approvedDeadlineKey}.`,
        );
      }

      previousDueDateKey = dueDateKey;
    });
  }

  private validateFullSpecBudgetAgainstParent(
    totalBudget: number,
    request: ProjectRequestEntity,
    parentSpec: ProjectSpecEntity | null,
  ): void {
    const approvedBaseline = this.resolveApprovedCommercialBaseline(request, parentSpec);

    const approvedBudget =
      approvedBaseline?.agreedBudget ?? approvedBaseline?.estimatedBudget ?? parentSpec?.totalBudget ?? null;

    if (!approvedBudget && !parentSpec) {
      return;
    }

    const fullSpecBudget = new Decimal(totalBudget);
    const approvedClientBudget = new Decimal(approvedBudget ?? totalBudget);
    const budgetDiff = fullSpecBudget.minus(approvedClientBudget);

    if (budgetDiff.abs().greaterThan(GOVERNANCE_RULES.BUDGET_TOLERANCE)) {
      throw new BadRequestException(
        `Full spec budget must match the approved commercial baseline. Full spec: $${fullSpecBudget.toFixed(2)}, ` +
          `Approved baseline: $${approvedClientBudget.toFixed(2)}`,
      );
    }
  }

  private normalizeCommercialBaselineForWorkflow(
    baseline?: ProjectRequestCommercialBaseline | null,
  ): ProjectRequestCommercialBaseline | null {
    if (!baseline) {
      return null;
    }

    const agreedBudget =
      typeof baseline.agreedBudget === 'number' && Number.isFinite(baseline.agreedBudget)
        ? baseline.agreedBudget
        : typeof baseline.estimatedBudget === 'number' && Number.isFinite(baseline.estimatedBudget)
          ? baseline.estimatedBudget
          : null;
    const agreedDeliveryDeadline =
      this.safeNormalizeDateOnlyInput(
        baseline.agreedDeliveryDeadline ?? baseline.estimatedTimeline ?? null,
      ) ?? null;
    const agreedClientFeatures = this.normalizeCommercialFeatures(
      baseline.agreedClientFeatures ?? baseline.clientFeatures,
    );

    return {
      ...baseline,
      estimatedBudget: agreedBudget,
      estimatedTimeline: agreedDeliveryDeadline,
      clientFeatures: agreedClientFeatures,
      agreedBudget,
      agreedDeliveryDeadline,
      agreedClientFeatures,
    };
  }

  private resolveApprovedClientFeatures(
    request: ProjectRequestEntity,
    parentSpec: ProjectSpecEntity | null,
  ): ClientFeature[] {
    const approvedBaseline = this.resolveApprovedCommercialBaseline(request, parentSpec);
    const baselineFeatures = approvedBaseline?.agreedClientFeatures ?? approvedBaseline?.clientFeatures;
    if (
      baselineFeatures?.length &&
      baselineFeatures.every((feature) => Boolean((feature as ClientFeature).id))
    ) {
      return baselineFeatures.map((feature) => ({
        id: (feature as ClientFeature).id || randomUUID(),
        title: this.sanitizePlainText(feature.title),
        description: this.sanitizePlainText(feature.description),
        priority: (feature.priority || 'SHOULD_HAVE') as ClientFeature['priority'],
      }));
    }

    return (parentSpec?.clientFeatures || []).map((feature) => ({
      id: feature.id,
      title: this.sanitizePlainText(feature.title),
      description: this.sanitizePlainText(feature.description),
      priority: feature.priority,
    }));
  }

  private resolveApprovedDeliveryDeadline(
    request: ProjectRequestEntity,
    parentSpec: ProjectSpecEntity | null,
  ): string | null {
    const approvedBaseline = this.resolveApprovedCommercialBaseline(request, parentSpec);
    return (
      this.safeNormalizeDateOnlyInput(
        approvedBaseline?.agreedDeliveryDeadline ?? approvedBaseline?.estimatedTimeline ?? null,
      ) ??
      this.assertRequestScopeBaselineReady(request).requestedDeadline
    );
  }

  private validateApprovedFeatureCoverage(
    features: SpecFeature[],
    milestones: CreateProjectSpecDto['milestones'],
    approvedClientFeatures: ClientFeature[],
  ): void {
    if (!approvedClientFeatures.length) {
      return;
    }

    const approvedFeatureIds = new Set(
      approvedClientFeatures.map((feature) => feature.id).filter((value): value is string => Boolean(value)),
    );
    const coveredFeatureIds = new Set<string>();

    const collectCoverage = (source: string, ids?: string[] | null) => {
      const normalizedIds = Array.from(
        new Set(
          (ids || [])
            .map((id) => this.sanitizePlainText(id))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      normalizedIds.forEach((id) => {
        if (!approvedFeatureIds.has(id)) {
          throw new BadRequestException(
            `${source} references an approved client feature that does not belong to the approved baseline.`,
          );
        }
        coveredFeatureIds.add(id);
      });
    };

    features.forEach((feature, index) => {
      collectCoverage(`Feature ${index + 1}`, feature.approvedClientFeatureIds);
    });

    milestones.forEach((milestone, index) => {
      collectCoverage(`Milestone ${index + 1}`, milestone.approvedClientFeatureIds);
    });

    const missingCoverage = approvedClientFeatures.filter(
      (feature) => feature.id && !coveredFeatureIds.has(feature.id),
    );
    if (missingCoverage.length > 0) {
      throw new BadRequestException(
        `Every approved client feature must be mapped to at least one technical feature or milestone. Missing: ${missingCoverage
          .map((feature) => feature.title)
          .join(', ')}`,
      );
    }
  }

  private assertSpecNotLockedForCommercialChanges(
    spec: ProjectSpecEntity,
    action: string,
  ): void {
    if (spec.specPhase !== SpecPhase.FULL_SPEC) {
      return;
    }

    if (spec.lockedByContractId) {
      throw new BadRequestException(
        `This full spec is locked by contract ${spec.lockedByContractId} and can no longer be ${action}.`,
      );
    }
  }

  /**
   * Check for banned keywords in text fields
   * Returns warnings (not errors) - per Governance doc, these are warnings not blocks
   */
  private checkBannedKeywords(text: string): string[] {
    const warnings: string[] = [];
    const lowerText = text.toLowerCase();

    for (const keyword of BANNED_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        warnings.push(
          `⚠️ Từ "${keyword}" có thể gây tranh chấp. Hãy mô tả cụ thể hơn (số liệu, màu sắc, style...).`,
        );
      }
    }

    return warnings;
  }

  private sanitizePlainText(value: string | null | undefined): string {
    return sanitizeHtml(value ?? '', {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }

  private sanitizeStructuredJson(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.sanitizePlainText(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeStructuredJson(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
          key,
          this.sanitizeStructuredJson(nested),
        ]),
      );
    }
    return value;
  }

  private normalizeHttpUrl(value: string): string {
    const trimmed = this.sanitizePlainText(value);
    if (!trimmed) {
      throw new BadRequestException('Reference URL is required');
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('Reference links must use http or https URLs.');
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException(`Invalid reference URL: ${trimmed}`);
    }
  }

  private normalizeReferenceLinks(
    links: Array<{ label: string; url: string }> | null | undefined,
  ): Array<{ label: string; url: string }> {
    if (!links?.length) {
      return [];
    }

    return links
      .map((link) => ({
        label: this.sanitizePlainText(link.label),
        url: this.normalizeHttpUrl(link.url),
      }))
      .filter((link) => link.label.length > 0 && link.url.length > 0);
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

  private getRequestProductTypeSnapshot(request: Pick<ProjectRequestEntity, 'answers'>): {
    code: string | null;
    label: string | null;
  } {
    const productTypeAnswer = (request.answers || []).find(
      (answer) => answer?.question?.code === 'PRODUCT_TYPE',
    );

    const normalizedCode = this.normalizeProductTypeComparable(
      productTypeAnswer?.valueText || productTypeAnswer?.option?.label,
    );
    const rawLabel = this.sanitizePlainText(
      productTypeAnswer?.option?.label || productTypeAnswer?.valueText,
    );
    const label = rawLabel
      ? this.humanizeProductTypeValue(rawLabel)
      : normalizedCode
        ? this.humanizeProductTypeValue(normalizedCode)
        : null;

    return {
      code: normalizedCode,
      label,
    };
  }

  private resolveLockedClientSpecProductType(
    request: Pick<ProjectRequestEntity, 'answers'>,
    requestedValue?: string | null,
  ): string | null {
    const requestProductType = this.getRequestProductTypeSnapshot(request);
    const requestedComparable = this.normalizeProductTypeComparable(requestedValue);
    const allowedComparables = new Set(
      [requestProductType.code, this.normalizeProductTypeComparable(requestProductType.label)].filter(
        (value): value is string => Boolean(value),
      ),
    );

    if (allowedComparables.size === 0) {
      return requestedValue ? this.sanitizePlainText(requestedValue) : null;
    }

    if (requestedComparable && !allowedComparables.has(requestedComparable)) {
      throw new BadRequestException(
        'Client spec Product Type must match the original request Product Type.',
      );
    }

    return requestProductType.label || requestProductType.code;
  }

  private normalizePositiveBudget(value: number, label: string): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new BadRequestException(`${label} must be greater than 0.`);
    }

    return normalized;
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private safeNormalizeDateOnlyInput(value?: string | null): string | null {
    const trimmed = `${value || ''}`.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return this.normalizeDateOnlyInput(trimmed, 'Date');
    } catch {
      return null;
    }
  }

  private getTodayDateKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeDateOnlyInput(value: string, label: string): string {
    const trimmed = `${value || ''}`.trim();
    const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)?.[1];
    if (!dateOnly) {
      throw new BadRequestException(`${label} must be a valid YYYY-MM-DD date.`);
    }
    return dateOnly;
  }

  private toPersistenceDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    return new Date(`${value}T00:00:00.000Z`);
  }

  private getDateKeyFromDate(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString().slice(0, 10);
  }

  private resolveRequestScopeBaseline(request: ProjectRequestEntity): ProjectRequestScopeBaseline {
    const stored = request.requestScopeBaseline || null;
    const requestProductType = this.getRequestProductTypeSnapshot(request);
    const legacyCreatedAtKey = this.getDateKeyFromDate(request.createdAt);
    const requestedDeadline =
      this.safeNormalizeDateOnlyInput(
        stored?.requestedDeadline ??
          request.requestedDeadline ??
          (/^\d{4}-\d{2}-\d{2}$/.test(`${request.intendedTimeline || ''}`)
            ? request.intendedTimeline
            : null) ??
          legacyCreatedAtKey,
      ) ?? null;

    return {
      productTypeCode: requestProductType.code ?? stored?.productTypeCode ?? null,
      productTypeLabel: requestProductType.label ?? stored?.productTypeLabel ?? null,
      projectGoalSummary:
        stored?.projectGoalSummary ??
        ([this.sanitizePlainText(request.title), this.sanitizePlainText(request.description)]
          .filter(Boolean)
          .join(': ') || null),
      requestedDeadline,
      requestTitle: this.sanitizePlainText(request.title),
      requestDescription: this.sanitizePlainText(request.description),
    };
  }

  private assertRequestScopeBaselineReady(request: ProjectRequestEntity): ProjectRequestScopeBaseline {
    const baseline = this.resolveRequestScopeBaseline(request);
    if (!baseline.requestedDeadline) {
      throw new BadRequestException(
        'Legacy request is missing a normalized requested deadline. Update the original request intake before continuing this spec flow.',
      );
    }

    return baseline;
  }

  private resolveClientSpecDeadlineFloor(request: ProjectRequestEntity): string {
    const todayKey = this.getTodayDateKey();
    const baseline = this.resolveRequestScopeBaseline(request);
    const requestAnchor = baseline.requestedDeadline || this.getDateKeyFromDate(request.createdAt);

    if (!requestAnchor) {
      return todayKey;
    }

    return requestAnchor > todayKey ? requestAnchor : todayKey;
  }

  private assertAgreedDeliveryDeadlineFloor(
    request: ProjectRequestEntity,
    agreedDeliveryDeadline: string,
  ): void {
    const floor = this.resolveClientSpecDeadlineFloor(request);
    if (agreedDeliveryDeadline < floor) {
      throw new BadRequestException(
        `Agreed delivery deadline cannot be earlier than ${floor}.`,
      );
    }
  }

  private buildSpecRequestContext(
    request: ProjectRequestEntity,
    spec: Pick<ProjectSpecEntity, 'requestId' | 'request' | 'estimatedTimeline' | 'parentSpec'>,
  ): ProjectSpecRequestContext {
    const scopeBaseline = this.resolveRequestScopeBaseline(request);
    const approvedBaseline =
      this.resolveApprovedCommercialBaseline(request, spec.parentSpec ?? null) ??
      this.normalizeCommercialBaselineForWorkflow(request.commercialBaseline);

    return {
      originalRequest: {
        title: scopeBaseline.requestTitle || request.title || null,
        description: scopeBaseline.requestDescription || request.description || null,
        budgetRange: request.budgetRange || null,
        requestedDeadline: scopeBaseline.requestedDeadline || null,
        productTypeLabel: scopeBaseline.productTypeLabel || null,
        projectGoalSummary: scopeBaseline.projectGoalSummary || null,
      },
      approvedCommercialBaseline: approvedBaseline
        ? {
            source: approvedBaseline.source || null,
            agreedBudget: approvedBaseline.agreedBudget ?? approvedBaseline.estimatedBudget ?? null,
            agreedDeliveryDeadline:
              approvedBaseline.agreedDeliveryDeadline ??
              approvedBaseline.estimatedTimeline ??
              spec.estimatedTimeline ??
              null,
            agreedClientFeatures:
              approvedBaseline.agreedClientFeatures ??
              approvedBaseline.clientFeatures ??
              null,
          }
        : null,
    };
  }

  private attachRequestContext<T extends ProjectSpecEntity | null>(spec: T): T {
    if (!spec?.request) {
      return spec;
    }

    spec.requestContext = this.buildSpecRequestContext(spec.request, spec);
    return spec;
  }

  private normalizeCommercialFeatures(
    features?: ClientFeature[] | null,
  ): ProjectRequestCommercialFeature[] | null {
    if (!features?.length) {
      return null;
    }

    const normalized = features
      .map((feature) => ({
        id: (feature as ClientFeature).id || null,
        title: this.sanitizePlainText(feature.title),
        description: this.sanitizePlainText(feature.description),
        priority: feature.priority,
      }))
      .filter((feature) => feature.title.length > 0 && feature.description.length > 0);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeApprovedClientFeatureIds(ids?: string[] | null): string[] | null {
    if (!ids?.length) {
      return null;
    }

    const normalized = Array.from(
      new Set(
        ids
          .map((id) => this.sanitizePlainText(id))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return normalized.length > 0 ? normalized : null;
  }

  private buildCommercialBaselineFromClientSpec(spec: ProjectSpecEntity): ProjectRequestCommercialBaseline {
    const agreedDeliveryDeadline =
      this.safeNormalizeDateOnlyInput(spec.estimatedTimeline ?? null) ?? null;
    const approvedClientFeatures = this.normalizeCommercialFeatures(spec.clientFeatures);

    return {
      source: 'CLIENT_SPEC',
      budgetRange: spec.request?.budgetRange ?? null,
      estimatedBudget: typeof spec.totalBudget === 'number' ? Number(spec.totalBudget) : Number(spec.totalBudget || 0),
      estimatedTimeline: agreedDeliveryDeadline,
      clientFeatures: approvedClientFeatures,
      agreedBudget:
        typeof spec.totalBudget === 'number' ? Number(spec.totalBudget) : Number(spec.totalBudget || 0),
      agreedDeliveryDeadline,
      agreedClientFeatures: approvedClientFeatures,
      sourceSpecId: spec.id,
      sourceChangeRequestId: null,
      approvedAt: new Date().toISOString(),
    };
  }

  private resolveApprovedCommercialBaseline(
    request: ProjectRequestEntity,
    parentSpec: ProjectSpecEntity | null,
  ): ProjectRequestCommercialBaseline | null {
    const normalizedRequestBaseline = this.normalizeCommercialBaselineForWorkflow(
      request.commercialBaseline,
    );
    if (normalizedRequestBaseline?.estimatedBudget != null) {
      return normalizedRequestBaseline;
    }

    if (parentSpec?.status === ProjectSpecStatus.CLIENT_APPROVED) {
      return this.normalizeCommercialBaselineForWorkflow(
        this.buildCommercialBaselineFromClientSpec(parentSpec),
      );
    }

    return null;
  }

  private buildSpecSubmissionSnapshot(spec: ProjectSpecEntity): SpecSubmissionSnapshot {
    return {
      phase: spec.specPhase,
      title: this.sanitizePlainText(spec.title),
      description: this.sanitizePlainText(spec.description),
      totalBudget: Number(spec.totalBudget || 0),
      projectCategory: spec.projectCategory ?? null,
      estimatedTimeline: spec.estimatedTimeline ?? null,
      clientFeatures: this.cloneJson(spec.clientFeatures || null),
      features: this.cloneJson(spec.features || null),
      techStack: spec.techStack ?? null,
      referenceLinks: this.cloneJson(spec.referenceLinks || null),
      milestones: (spec.milestones || [])
        .slice()
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map((milestone) => ({
          title: this.sanitizePlainText(milestone.title),
          description: this.sanitizePlainText(milestone.description),
          amount: Number(milestone.amount || 0),
          deliverableType: milestone.deliverableType,
          retentionAmount: Number(milestone.retentionAmount || 0),
          startDate: this.safeNormalizeDateOnlyInput(
            milestone.startDate ? new Date(milestone.startDate).toISOString().slice(0, 10) : null,
          ),
          dueDate: this.safeNormalizeDateOnlyInput(
            milestone.dueDate ? new Date(milestone.dueDate).toISOString().slice(0, 10) : null,
          ),
          sortOrder: milestone.sortOrder ?? null,
          acceptanceCriteria: this.cloneJson(milestone.acceptanceCriteria || null),
          approvedClientFeatureIds: this.cloneJson(milestone.approvedClientFeatureIds || null),
        })),
    };
  }

  private buildSpecSubmissionDiff(
    previousSnapshot: SpecSubmissionSnapshot | null | undefined,
    currentSnapshot: SpecSubmissionSnapshot,
  ): SpecFieldDiffEntry[] {
    const previous = previousSnapshot || null;
    const fields: Array<{ field: keyof SpecSubmissionSnapshot; label: string }> = [
      { field: 'title', label: 'Title' },
      { field: 'description', label: 'Description' },
      { field: 'totalBudget', label: 'Budget' },
      { field: 'projectCategory', label: 'Product Type' },
      { field: 'estimatedTimeline', label: 'Agreed Delivery Deadline' },
      { field: 'clientFeatures', label: 'Approved Client Features' },
      { field: 'features', label: 'Technical Features' },
      { field: 'techStack', label: 'Tech Stack' },
      { field: 'referenceLinks', label: 'Reference Links' },
      { field: 'milestones', label: 'Milestones' },
    ];

    return fields
      .filter(({ field }) => JSON.stringify(previous?.[field] ?? null) !== JSON.stringify(currentSnapshot[field] ?? null))
      .map(({ field, label }) => ({
        field,
        label,
        previous: this.cloneJson(previous?.[field] ?? null),
        next: this.cloneJson(currentSnapshot[field] ?? null),
      }));
  }

  private appendRejectionHistory(
    spec: ProjectSpecEntity,
    reason: string,
    rejectedByUserId: string,
  ): SpecRejectionHistoryEntry[] {
    const currentHistory = Array.isArray(spec.rejectionHistory) ? spec.rejectionHistory : [];
    return [
      ...currentHistory,
      {
        phase: spec.specPhase,
        reason,
        rejectedByUserId,
        rejectedAt: new Date().toISOString(),
      },
    ];
  }

  private emitSpecUpdated(
    spec: Pick<ProjectSpecEntity, 'id' | 'requestId' | 'request'>,
    userIds: Array<string | null | undefined>,
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    uniqueUserIds.forEach((userId) => {
      this.eventEmitter.emit('spec.updated', {
        userId,
        specId: spec.id,
        requestId: spec.requestId,
        entityType: 'ProjectSpec',
        entityId: spec.id,
      });
    });
  }

  private async emitRequestSystemMessage(requestId: string, content: string): Promise<void> {
    try {
      await this.requestChatService.createSystemMessage(requestId, content);
    } catch (error) {
      this.logger.warn(
        `Request chat system message failed for ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async findAcceptedFreelancerId(requestId: string): Promise<string | null> {
    const acceptedProposals = await this.projectRequestProposalsRepository.find({
      where: { requestId, status: 'ACCEPTED' },
      order: { createdAt: 'ASC' },
    });

    if (acceptedProposals.length > 1) {
      throw new BadRequestException(
        'Invalid request state: multiple accepted freelancers found for this request.',
      );
    }

    if (acceptedProposals.length === 1) {
      return acceptedProposals[0].freelancerId;
    }

    // Legacy compatibility: older builds stored freelancer invitation acceptance as PENDING.
    const legacyPendingProposals = await this.projectRequestProposalsRepository.find({
      where: { requestId, status: 'PENDING' },
      order: { createdAt: 'ASC' },
    });
    if (legacyPendingProposals.length > 1) {
      throw new BadRequestException(
        'Invalid request state: multiple legacy pending freelancer proposals found.',
      );
    }
    if (legacyPendingProposals.length === 1) {
      this.logger.warn(
        `Using legacy PENDING freelancer proposal as accepted signer for request ${requestId}.`,
      );
      return legacyPendingProposals[0].freelancerId;
    }

    return null;
  }

  private async notifyUser(payload: {
    userId?: string | null;
    title: string;
    body: string;
    relatedType?: string;
    relatedId?: string;
  }): Promise<void> {
    if (!payload.userId) {
      return;
    }

    await this.notificationsService.create({
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      relatedType: payload.relatedType || null,
      relatedId: payload.relatedId || null,
    });
  }

  private async getRequiredSignerIds(spec: ProjectSpecEntity): Promise<string[]> {
    if (!spec.request) {
      throw new BadRequestException('Spec request context is missing');
    }

    const signerIds = new Set<string>();
    signerIds.add(spec.request.clientId);
    signerIds.add(spec.request.brokerId);

    const freelancerId = await this.findAcceptedFreelancerId(spec.requestId);
    if (freelancerId) {
      signerIds.add(freelancerId);
      return Array.from(signerIds);
    }

    // New 2-phase flow requires freelancer for full-spec signing.
    if (spec.parentSpecId) {
      throw new BadRequestException(
        'Freelancer must be accepted before full spec can be fully signed.',
      );
    }

    // Legacy flow fallback (2-party).
    return Array.from(signerIds);
  }

  private async reconcileFullSpecSigningState(spec: ProjectSpecEntity): Promise<{
    requiredSignerIds: string[];
    signatures: ProjectSpecSignatureEntity[];
    allRequiredSigned: boolean;
    specStatus: ProjectSpecStatus;
  }> {
    const requiredSignerIds = await this.getRequiredSignerIds(spec);
    const signatures = await this.projectSpecSignaturesRepository.find({
      where: { specId: spec.id },
    });
    const signedUserIds = new Set(signatures.map((signature) => signature.userId));
    const allRequiredSigned = requiredSignerIds.every((id) => signedUserIds.has(id));

    if (allRequiredSigned && spec.status !== ProjectSpecStatus.ALL_SIGNED) {
      spec.status = ProjectSpecStatus.ALL_SIGNED;
      await this.projectSpecsRepository.save(spec);

      if (spec.request) {
        const terminalOrLaterRequestStatuses = new Set<RequestStatus>([
          RequestStatus.CONTRACT_PENDING,
          RequestStatus.CONVERTED_TO_PROJECT,
          RequestStatus.IN_PROGRESS,
          RequestStatus.COMPLETED,
        ]);

        if (!terminalOrLaterRequestStatuses.has(spec.request.status)) {
          spec.request.status = RequestStatus.CONTRACT_PENDING;
          await this.projectRequestsRepository.save(spec.request);
        }
      }
    }

    return {
      requiredSignerIds,
      signatures,
      allRequiredSigned,
      specStatus: spec.status,
    };
  }

  /**
   * Validate structured features JSON
   */
  private validateFeatures(features: SpecFeature[] | undefined): void {
    if (!features || features.length === 0) {
      return; // Features are optional for now (gradual migration)
    }

    for (const feature of features) {
      // Validate acceptance criteria
      if (!feature.acceptanceCriteria || feature.acceptanceCriteria.length === 0) {
        throw new BadRequestException(
          `Feature "${feature.title}" must have at least one acceptance criterion`,
        );
      }

      // Each criterion must be > 10 characters (chống spam)
      for (const criterion of feature.acceptanceCriteria) {
        if (criterion.length < 10) {
          throw new BadRequestException(
            `Acceptance criterion "${criterion}" is too short. Minimum 10 characters required.`,
          );
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: CLIENT SPEC (c_spec)
  // Broker creates a simplified spec → Client reviews → Client approves
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Broker creates a simplified client-readable spec
   */
  async createClientSpec(
    user: UserEntity,
    dto: CreateClientSpecDto,
    req: RequestContext,
  ): Promise<{ spec: ProjectSpecEntity; warnings: string[] }> {
    const warnings: string[] = [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Project Request
      const projectRequest = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: dto.requestId },
        relations: ['broker', 'answers', 'answers.question', 'answers.option'],
      });

      if (!projectRequest) {
        throw new NotFoundException('Project request not found');
      }

      if (projectRequest.brokerId !== user.id) {
        throw new ForbiddenException('You are not authorized to create a spec for this request');
      }

      // Check no existing non-rejected client spec
      const existingSpec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { requestId: dto.requestId, specPhase: SpecPhase.CLIENT_SPEC },
      });
      if (existingSpec) {
        throw new BadRequestException(
          'A client spec already exists for this request. Edit the existing one and resubmit it.',
        );
      }

      const sanitizedTitle = this.sanitizePlainText(dto.title);
      const sanitizedDescription = this.sanitizePlainText(dto.description);
      const sanitizedTimeline = this.normalizeDateOnlyInput(
        dto.agreedDeliveryDeadline ?? dto.estimatedTimeline,
        'Agreed delivery deadline',
      );
      this.assertAgreedDeliveryDeadlineFloor(projectRequest, sanitizedTimeline);
      const normalizedBudget = this.normalizePositiveBudget(
        dto.estimatedBudget,
        'Estimated budget',
      );
      const lockedProductType = this.resolveLockedClientSpecProductType(
        projectRequest,
        dto.projectCategory,
      );
      const mappedFeatures: ClientFeature[] = dto.clientFeatures.map((feature) => ({
        id: randomUUID(),
        title: this.sanitizePlainText(feature.title),
        description: this.sanitizePlainText(feature.description),
        priority: feature.priority,
      }));

      // 3. Check banned keywords (non-blocking warnings)
      const descWarnings = this.checkBannedKeywords(sanitizedDescription);
      warnings.push(...descWarnings);
      for (const feature of mappedFeatures) {
        warnings.push(...this.checkBannedKeywords(feature.description));
      }

      // 4. Save Client Spec
      const newSpec = queryRunner.manager.create(ProjectSpecEntity, {
        requestId: dto.requestId,
        specPhase: SpecPhase.CLIENT_SPEC,
        title: sanitizedTitle,
        description: sanitizedDescription,
        totalBudget: normalizedBudget,
        estimatedTimeline: sanitizedTimeline,
        projectCategory: lockedProductType,
        clientFeatures: mappedFeatures,
        referenceLinks: this.normalizeReferenceLinks(dto.referenceLinks),
        richContentJson: (this.sanitizeStructuredJson(dto.richContentJson) ?? null) as Record<
          string,
          unknown
        > | null,
        changeSummary: this.sanitizePlainText(dto.changeSummary) || null,
        status: ProjectSpecStatus.DRAFT,
      });
      const savedSpec = await queryRunner.manager.save(newSpec);

      // 5. Keep request status unchanged while c_spec is only a draft.
      // Request moves to SPEC_SUBMITTED when broker explicitly submits for client review.

      // 6. Audit Log
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'CREATE_CLIENT_SPEC',
        entityType: 'ProjectSpec',
        entityId: savedSpec.id,
        newData: {
          phase: SpecPhase.CLIENT_SPEC,
          estimatedBudget: normalizedBudget,
          productType: lockedProductType,
          featureCount: mappedFeatures.length,
          hasWarnings: warnings.length > 0,
        },
        req,
      });

      await queryRunner.commitTransaction();
      const fullSpec = await this.findOne(savedSpec.id);
      return { spec: fullSpec, warnings };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create client spec: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Broker edits existing simplified client-readable spec
   * Allowed only when c_spec is DRAFT or REJECTED
   */
  async updateClientSpec(
    user: UserEntity,
    specId: string,
    dto: CreateClientSpecDto,
    req: RequestContext,
  ): Promise<{ spec: ProjectSpecEntity; warnings: string[] }> {
    const warnings: string[] = [];
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.CLIENT_SPEC) {
      throw new BadRequestException('Only client specs can be edited with this endpoint');
    }
    if (spec.status !== ProjectSpecStatus.DRAFT && spec.status !== ProjectSpecStatus.REJECTED) {
      throw new BadRequestException(
        `Client spec can only be edited in DRAFT or REJECTED status. Current: ${spec.status}`,
      );
    }
    if (spec.requestId !== dto.requestId) {
      throw new BadRequestException('Request ID mismatch');
    }
    if (!spec.request || spec.request.brokerId !== user.id) {
      throw new ForbiddenException('Only assigned broker can edit this client spec');
    }

    const requestContext = await this.projectRequestsRepository.findOne({
      where: { id: spec.requestId },
      relations: ['answers', 'answers.question', 'answers.option'],
    });
    if (!requestContext) {
      throw new NotFoundException('Project request not found');
    }

    const sanitizedTitle = this.sanitizePlainText(dto.title);
    const sanitizedDescription = this.sanitizePlainText(dto.description);
    const sanitizedTimeline = this.normalizeDateOnlyInput(
      dto.agreedDeliveryDeadline ?? dto.estimatedTimeline,
      'Agreed delivery deadline',
    );
    this.assertAgreedDeliveryDeadlineFloor(requestContext, sanitizedTimeline);
    const normalizedBudget = this.normalizePositiveBudget(
      dto.estimatedBudget,
      'Estimated budget',
    );
    const lockedProductType = this.resolveLockedClientSpecProductType(
      requestContext,
      dto.projectCategory,
    );
    const mappedFeatures: ClientFeature[] = dto.clientFeatures.map((feature) => ({
      id: randomUUID(),
      title: this.sanitizePlainText(feature.title),
      description: this.sanitizePlainText(feature.description),
      priority: feature.priority,
    }));

    warnings.push(...this.checkBannedKeywords(sanitizedDescription));
    for (const feature of mappedFeatures) {
      warnings.push(...this.checkBannedKeywords(feature.description));
    }

    spec.title = sanitizedTitle;
    spec.description = sanitizedDescription;
    spec.totalBudget = normalizedBudget;
    spec.estimatedTimeline = sanitizedTimeline;
    spec.projectCategory = lockedProductType;
    spec.clientFeatures = mappedFeatures;
    spec.referenceLinks = this.normalizeReferenceLinks(dto.referenceLinks);
    spec.richContentJson = (this.sanitizeStructuredJson(dto.richContentJson) ?? null) as Record<
      string,
      unknown
    > | null;
    spec.changeSummary = this.sanitizePlainText(dto.changeSummary) || spec.changeSummary || null;
    // Preserve REJECTED until broker explicitly re-submits for review.

    await this.projectSpecsRepository.save(spec);

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'UPDATE_CLIENT_SPEC',
      entityType: 'ProjectSpec',
      entityId: spec.id,
      newData: {
        phase: SpecPhase.CLIENT_SPEC,
        estimatedBudget: normalizedBudget,
        productType: lockedProductType,
        featureCount: mappedFeatures.length,
        hasWarnings: warnings.length > 0,
        currentStatus: spec.status,
      },
      req,
    });

    const updatedSpec = await this.findOne(spec.id);
    return { spec: updatedSpec, warnings };
  }

  /**
   * Broker submits c_spec for client review: DRAFT → CLIENT_REVIEW
   */
  async submitForClientReview(
    user: UserEntity,
    specId: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.CLIENT_SPEC) {
      throw new BadRequestException('Only client specs can be submitted for client review');
    }
    if (spec.status !== ProjectSpecStatus.DRAFT && spec.status !== ProjectSpecStatus.REJECTED) {
      throw new BadRequestException(
        `Spec must be in DRAFT or REJECTED status. Current: ${spec.status}`,
      );
    }
    if (!spec.clientFeatures || spec.clientFeatures.length === 0) {
      throw new BadRequestException('Client spec must have at least one feature');
    }
    if (!spec.request || spec.request.brokerId !== user.id) {
      throw new ForbiddenException('Only assigned broker can submit this client spec');
    }

    this.assertRequestScopeBaselineReady(spec.request);
    if (spec.status === ProjectSpecStatus.REJECTED && !this.sanitizePlainText(spec.changeSummary)) {
      throw new BadRequestException(
        'Provide a change summary before resubmitting a rejected client spec.',
      );
    }

    const nextSnapshot = this.buildSpecSubmissionSnapshot(spec);
    const nextDiff = this.buildSpecSubmissionDiff(spec.lastSubmittedSnapshot, nextSnapshot);

    spec.status = ProjectSpecStatus.CLIENT_REVIEW;
    spec.rejectionReason = null;
    spec.submissionVersion = (spec.submissionVersion || 0) + 1;
    spec.lastSubmittedSnapshot = nextSnapshot;
    spec.lastSubmittedDiff = nextDiff;
    await this.projectSpecsRepository.save(spec);

    spec.request.status = RequestStatus.SPEC_SUBMITTED;
    await this.projectRequestsRepository.save(spec.request);

    await this.notifyUser({
      userId: spec.request.clientId,
      title: 'Client Spec ready for review',
      body: `Broker submitted "${spec.title}" for your review on ${spec.request.title}.`,
      relatedType: 'ProjectRequest',
      relatedId: spec.requestId,
    });

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'SUBMIT_CLIENT_SPEC_FOR_REVIEW',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { newStatus: spec.status },
      req,
    });

    await this.emitRequestSystemMessage(
      spec.requestId,
      'Broker submitted the client spec for client review.',
    );

    this.emitSpecUpdated(spec, [spec.request.clientId, spec.request.brokerId]);

    return spec;
  }

  /**
   * Client approves or rejects the c_spec
   * CLIENT_REVIEW → CLIENT_APPROVED / REJECTED
   */
  async clientReviewSpec(
    user: UserEntity,
    specId: string,
    action: 'APPROVE' | 'REJECT',
    reason: string | null,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.CLIENT_SPEC) {
      throw new BadRequestException('This action is only for client specs');
    }
    if (spec.status !== ProjectSpecStatus.CLIENT_REVIEW) {
      throw new BadRequestException(
        `Spec must be in CLIENT_REVIEW status. Current: ${spec.status}`,
      );
    }
    if (!spec.request || spec.request.clientId !== user.id) {
      throw new ForbiddenException('Only the project client can review this spec');
    }

    const brokerId = spec.request.brokerId;
    const requestTitle = spec.request.title || 'project request';
    let brokerNotification:
      | {
          title: string;
          body: string;
        }
      | undefined;

    if (action === 'APPROVE') {
      spec.status = ProjectSpecStatus.CLIENT_APPROVED;
      spec.clientApprovedAt = new Date();
      if (spec.request) {
        spec.request.status = RequestStatus.SPEC_APPROVED;
        spec.request.commercialBaseline = this.buildCommercialBaselineFromClientSpec(spec);
        await this.projectRequestsRepository.save(spec.request);
      }
      brokerNotification = {
        title: 'Client Spec approved',
        body: `Client approved "${spec.title}" for ${requestTitle}.`,
      };
    } else {
      const sanitizedReason = this.sanitizePlainText(reason);
      if (sanitizedReason.length < 10) {
        throw new BadRequestException('Rejection reason must be at least 10 characters');
      }
      spec.status = ProjectSpecStatus.REJECTED;
      spec.rejectionReason = sanitizedReason;
      spec.rejectionHistory = this.appendRejectionHistory(spec, sanitizedReason, user.id);
      if (spec.request) {
        spec.request.status = RequestStatus.BROKER_ASSIGNED;
        await this.projectRequestsRepository.save(spec.request);
      }
      brokerNotification = {
        title: 'Client Spec rejected',
        body: `Client rejected "${spec.title}". Reason: ${spec.rejectionReason.slice(0, 200)}`,
      };
    }

    await this.projectSpecsRepository.save(spec);
    await this.notifyUser({
      userId: brokerId,
      title: brokerNotification?.title || 'Client Spec updated',
      body: brokerNotification?.body || `Client updated "${spec.title}".`,
      relatedType: 'ProjectRequest',
      relatedId: spec.requestId,
    });

    await this.auditLogsService.log({
      actorId: user.id,
      action: action === 'APPROVE' ? 'CLIENT_APPROVE_SPEC' : 'CLIENT_REJECT_SPEC',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { action, reason: spec.rejectionReason || null, role: user.role },
      req,
    });

    await this.emitRequestSystemMessage(
      spec.requestId,
      action === 'APPROVE'
        ? 'Client approved the client spec and locked the commercial baseline.'
        : 'Client rejected the client spec and sent it back for revision.',
    );

    this.emitSpecUpdated(spec, [spec.request?.clientId, spec.request?.brokerId]);

    return spec;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: FULL SPEC (full_spec)
  // After freelancer assigned → Broker creates detailed spec → 3-party sign
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create full technical spec linked to parent client spec
   */
  async createFullSpec(
    user: UserEntity,
    createSpecDto: CreateProjectSpecDto,
    req: RequestContext,
    strictParent = true,
  ): Promise<{ spec: ProjectSpecEntity; warnings: string[] }> {
    const {
      requestId,
      milestones,
      totalBudget,
      features,
      techStack,
      referenceLinks,
      parentSpecId,
      richContentJson,
      ...specData
    } = createSpecDto;

    const warnings: string[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Project Request
      const projectRequest = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: requestId },
        relations: ['broker'],
      });
      if (!projectRequest) throw new NotFoundException('Project request not found');
      if (projectRequest.brokerId !== user.id) {
        throw new ForbiddenException('You are not authorized to create a spec for this request');
      }

      let parentSpec: ProjectSpecEntity | null = null;
      if (parentSpecId) {
        parentSpec = await queryRunner.manager.findOne(ProjectSpecEntity, {
          where: {
            id: parentSpecId,
            requestId,
            specPhase: SpecPhase.CLIENT_SPEC,
          },
        });
      } else {
        parentSpec = await queryRunner.manager.findOne(ProjectSpecEntity, {
          where: { requestId, specPhase: SpecPhase.CLIENT_SPEC },
          order: { createdAt: 'DESC' },
        });
      }

      if (parentSpec && parentSpec.status !== ProjectSpecStatus.CLIENT_APPROVED) {
        throw new BadRequestException(
          `Cannot create full spec: parent client spec is ${parentSpec.status}, expected CLIENT_APPROVED.`,
        );
      }
      if (strictParent && !parentSpec) {
        throw new BadRequestException(
          'Cannot create full spec: Client spec must be approved first.',
        );
      }

      const approvedBaseline = this.resolveApprovedCommercialBaseline(projectRequest, parentSpec);
      const requestScopeBaseline = this.assertRequestScopeBaselineReady(projectRequest);
      const approvedDeliveryDeadline = this.resolveApprovedDeliveryDeadline(
        projectRequest,
        parentSpec,
      );
      const approvedClientFeatures = this.resolveApprovedClientFeatures(
        projectRequest,
        parentSpec,
      );

      // Check no existing non-rejected full spec
      const existingFull = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: parentSpec
          ? { parentSpecId: parentSpec.id, specPhase: SpecPhase.FULL_SPEC }
          : { requestId, specPhase: SpecPhase.FULL_SPEC, parentSpecId: IsNull() },
        order: { createdAt: 'DESC' },
      });
      if (existingFull && existingFull.status !== ProjectSpecStatus.REJECTED) {
        throw new BadRequestException(
          parentSpec
            ? 'A full spec already exists for this client spec.'
            : 'A full spec already exists for this request. Edit the existing one instead.',
        );
      }

      // 3. Map features
      const mappedFeatures: SpecFeature[] = (features || []).map((f) => ({
        title: this.sanitizePlainText(f.title),
        description: this.sanitizePlainText(f.description),
        complexity: f.complexity,
        id: randomUUID(),
        acceptanceCriteria: (f.acceptanceCriteria || []).map((criteria) =>
          this.sanitizePlainText(criteria),
        ),
        inputOutputSpec: f.inputOutputSpec ? this.sanitizePlainText(f.inputOutputSpec) : '',
        approvedClientFeatureIds: this.normalizeApprovedClientFeatureIds(
          f.approvedClientFeatureIds,
        ),
      }));

      // 4. GOVERNANCE VALIDATION
      this.validateMilestoneStructure(milestones, {
        approvedDeadlineKey: approvedDeliveryDeadline,
      });
      this.validateMilestoneBudget(milestones, totalBudget);
      this.validateFullSpecBudgetAgainstParent(totalBudget, projectRequest, parentSpec);
      this.validateFeatures(mappedFeatures);
      this.validateApprovedFeatureCoverage(mappedFeatures, milestones, approvedClientFeatures);

      // 5. Check banned keywords (non-blocking)
      warnings.push(
        ...this.checkBannedKeywords(this.sanitizePlainText(specData.description || '')),
      );
      for (const feature of mappedFeatures) {
        warnings.push(...this.checkBannedKeywords(feature.description || ''));
      }

      // 6. Save Full Spec
      const newSpec = queryRunner.manager.create(ProjectSpecEntity, {
        requestId,
        specPhase: SpecPhase.FULL_SPEC,
        parentSpecId: parentSpec?.id ?? null,
        title: this.sanitizePlainText(specData.title),
        description: this.sanitizePlainText(specData.description),
        totalBudget,
        features: mappedFeatures,
        techStack: techStack ? this.sanitizePlainText(techStack) : '',
        referenceLinks: this.normalizeReferenceLinks(referenceLinks),
        richContentJson: (this.sanitizeStructuredJson(richContentJson) ?? null) as Record<
          string,
          unknown
        > | null,
        changeSummary: this.sanitizePlainText(createSpecDto.changeSummary) || null,
        status: createSpecDto.status || ProjectSpecStatus.DRAFT,
        projectCategory:
          requestScopeBaseline.productTypeLabel ??
          parentSpec?.projectCategory ??
          null,
        estimatedTimeline:
          approvedBaseline?.agreedDeliveryDeadline ??
          approvedBaseline?.estimatedTimeline ??
          approvedDeliveryDeadline ??
          parentSpec?.estimatedTimeline ??
          null,
        clientFeatures: approvedClientFeatures,
      });
      const savedSpec = await queryRunner.manager.save(newSpec);

      // 7. Save Milestones
      const newMilestones = milestones.map((m, index) =>
        queryRunner.manager.create(MilestoneEntity, {
          ...m,
          title: this.sanitizePlainText(m.title),
          description: this.sanitizePlainText(m.description),
          acceptanceCriteria: (m.acceptanceCriteria || []).map((criterion) =>
            this.sanitizePlainText(criterion),
          ),
          approvedClientFeatureIds: this.normalizeApprovedClientFeatureIds(
            m.approvedClientFeatureIds,
          ),
          projectSpecId: savedSpec.id,
          status: MilestoneStatus.PENDING,
          projectId: null,
          startDate: this.toPersistenceDate(
            m.startDate ? this.normalizeDateOnlyInput(m.startDate, `Milestone ${index + 1} start date`) : null,
          ),
          dueDate: this.toPersistenceDate(
            m.dueDate ? this.normalizeDateOnlyInput(m.dueDate, `Milestone ${index + 1} due date`) : null,
          ),
          sortOrder: m.sortOrder ?? index,
        }),
      );
      await queryRunner.manager.save(newMilestones);

      // 8. Audit Log
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'CREATE_FULL_SPEC',
        entityType: 'ProjectSpec',
        entityId: savedSpec.id,
        newData: {
          phase: SpecPhase.FULL_SPEC,
          parentSpecId: parentSpec?.id ?? null,
          totalBudget,
          milestoneCount: milestones.length,
          featureCount: features?.length || 0,
          hasWarnings: warnings.length > 0,
        },
        req,
      });

      await queryRunner.commitTransaction();
      const fullSpec = await this.findOne(savedSpec.id);
      return { spec: fullSpec, warnings };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create full spec: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Broker edits existing full technical spec draft
   * Allowed only when full_spec is DRAFT or REJECTED
   */
  async updateFullSpec(
    user: UserEntity,
    specId: string,
    dto: CreateProjectSpecDto,
    req: RequestContext,
  ): Promise<{ spec: ProjectSpecEntity; warnings: string[] }> {
    const warnings: string[] = [];
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.FULL_SPEC) {
      throw new BadRequestException('Only full specs can be edited with this endpoint');
    }
    this.assertSpecNotLockedForCommercialChanges(spec, 'edited');
    if (spec.status !== ProjectSpecStatus.DRAFT && spec.status !== ProjectSpecStatus.REJECTED) {
      throw new BadRequestException(
        `Full spec can only be edited in DRAFT or REJECTED status. Current: ${spec.status}`,
      );
    }
    if (spec.requestId !== dto.requestId) {
      throw new BadRequestException('Request ID mismatch');
    }
    if (!spec.request || spec.request.brokerId !== user.id) {
      throw new ForbiddenException('Only assigned broker can edit this full spec');
    }
    if (dto.parentSpecId && dto.parentSpecId !== spec.parentSpecId) {
      throw new BadRequestException('Parent spec cannot be changed for an existing full spec');
    }
    if (spec.milestones?.some((milestone) => milestone.projectId)) {
      throw new BadRequestException(
        'This full spec is already linked to project milestones and can no longer be edited.',
      );
    }

    const mappedFeatures: SpecFeature[] = (dto.features || []).map((feature) => ({
      title: this.sanitizePlainText(feature.title),
      description: this.sanitizePlainText(feature.description),
      complexity: feature.complexity,
      id: randomUUID(),
      acceptanceCriteria: (feature.acceptanceCriteria || []).map((criteria) =>
        this.sanitizePlainText(criteria),
      ),
      inputOutputSpec: feature.inputOutputSpec
        ? this.sanitizePlainText(feature.inputOutputSpec)
        : '',
      approvedClientFeatureIds: this.normalizeApprovedClientFeatureIds(
        feature.approvedClientFeatureIds,
      ),
    }));

    const approvedDeliveryDeadline = this.resolveApprovedDeliveryDeadline(
      spec.request,
      spec.parentSpec ?? null,
    );
    const approvedClientFeatures = this.resolveApprovedClientFeatures(
      spec.request,
      spec.parentSpec ?? null,
    );
    this.validateMilestoneStructure(dto.milestones, {
      approvedDeadlineKey: approvedDeliveryDeadline,
    });
    this.validateMilestoneBudget(dto.milestones, dto.totalBudget);
    this.validateFullSpecBudgetAgainstParent(dto.totalBudget, spec.request, spec.parentSpec ?? null);
    this.validateFeatures(mappedFeatures);
    this.validateApprovedFeatureCoverage(mappedFeatures, dto.milestones, approvedClientFeatures);

    const sanitizedDescription = this.sanitizePlainText(dto.description);
    warnings.push(...this.checkBannedKeywords(sanitizedDescription));
    for (const feature of mappedFeatures) {
      warnings.push(...this.checkBannedKeywords(feature.description || ''));
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const managedSpec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { id: specId },
      });
      if (!managedSpec) {
        throw new NotFoundException('Project spec not found');
      }

      managedSpec.title = this.sanitizePlainText(dto.title);
      managedSpec.description = sanitizedDescription;
      managedSpec.totalBudget = dto.totalBudget;
      managedSpec.features = mappedFeatures;
      managedSpec.techStack = dto.techStack ? this.sanitizePlainText(dto.techStack) : '';
      if (dto.referenceLinks !== undefined) {
        managedSpec.referenceLinks = this.normalizeReferenceLinks(dto.referenceLinks);
      }
      if (dto.richContentJson !== undefined) {
        managedSpec.richContentJson = (this.sanitizeStructuredJson(dto.richContentJson) ??
          null) as Record<string, unknown> | null;
      }
      const approvedBaseline = this.resolveApprovedCommercialBaseline(spec.request, spec.parentSpec ?? null);
      managedSpec.estimatedTimeline =
        approvedBaseline?.agreedDeliveryDeadline ??
        approvedBaseline?.estimatedTimeline ??
        approvedDeliveryDeadline ??
        managedSpec.estimatedTimeline ??
        null;
      managedSpec.clientFeatures = approvedClientFeatures;
      managedSpec.projectCategory =
        this.resolveRequestScopeBaseline(spec.request).productTypeLabel ??
        managedSpec.projectCategory ??
        null;
      managedSpec.changeSummary = this.sanitizePlainText(dto.changeSummary) || managedSpec.changeSummary || null;
      // Preserve current status (DRAFT/REJECTED) until broker explicitly submits for final review.

      await queryRunner.manager.save(managedSpec);

      await queryRunner.manager.delete(MilestoneEntity, { projectSpecId: specId });

      const updatedMilestones = dto.milestones.map((milestone, index) =>
        queryRunner.manager.create(MilestoneEntity, {
          ...milestone,
          title: this.sanitizePlainText(milestone.title),
          description: this.sanitizePlainText(milestone.description),
          acceptanceCriteria: (milestone.acceptanceCriteria || []).map((criterion) =>
            this.sanitizePlainText(criterion),
          ),
          approvedClientFeatureIds: this.normalizeApprovedClientFeatureIds(
            milestone.approvedClientFeatureIds,
          ),
          projectSpecId: specId,
          projectId: null,
          status: MilestoneStatus.PENDING,
          startDate: this.toPersistenceDate(
            milestone.startDate
              ? this.normalizeDateOnlyInput(milestone.startDate, `Milestone ${index + 1} start date`)
              : null,
          ),
          dueDate: this.toPersistenceDate(
            milestone.dueDate
              ? this.normalizeDateOnlyInput(milestone.dueDate, `Milestone ${index + 1} due date`)
              : null,
          ),
          sortOrder: milestone.sortOrder ?? index,
        }),
      );
      await queryRunner.manager.save(updatedMilestones);

      await this.auditLogsService.log({
        actorId: user.id,
        action: 'UPDATE_FULL_SPEC',
        entityType: 'ProjectSpec',
        entityId: specId,
        newData: {
          phase: SpecPhase.FULL_SPEC,
          totalBudget: dto.totalBudget,
          milestoneCount: dto.milestones.length,
          featureCount: dto.features?.length || 0,
          hasWarnings: warnings.length > 0,
          currentStatus: spec.status,
        },
        req,
      });

      await queryRunner.commitTransaction();
      const updatedSpec = await this.findOne(specId);
      return { spec: updatedSpec, warnings };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update full spec: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Submit full spec for 3-party final review: DRAFT → FINAL_REVIEW
   */
  async submitForFinalReview(
    user: UserEntity,
    specId: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.FULL_SPEC) {
      throw new BadRequestException('Only full specs can be submitted for final review');
    }
    this.assertSpecNotLockedForCommercialChanges(spec, 'submitted for final review');
    if (spec.status !== ProjectSpecStatus.DRAFT && spec.status !== ProjectSpecStatus.REJECTED) {
      throw new BadRequestException(
        `Spec must be in DRAFT or REJECTED status. Current: ${spec.status}`,
      );
    }
    if (!spec.milestones || spec.milestones.length === 0) {
      throw new BadRequestException('Full spec must have at least one milestone');
    }
    if (!spec.request || spec.request.brokerId !== user.id) {
      throw new ForbiddenException('Only assigned broker can submit this full spec');
    }
    if (spec.request.activeCommercialChangeRequest?.status === 'PENDING') {
      throw new BadRequestException(
        'Resolve the pending commercial change request before submitting the final spec for review.',
      );
    }

    this.assertRequestScopeBaselineReady(spec.request);
    if (spec.status === ProjectSpecStatus.REJECTED && !this.sanitizePlainText(spec.changeSummary)) {
      throw new BadRequestException(
        'Provide a change summary before resubmitting a rejected final spec.',
      );
    }

    const acceptedFreelancerId = await this.findAcceptedFreelancerId(spec.requestId);
    if (!acceptedFreelancerId) {
      throw new BadRequestException(
        'Freelancer must accept invitation before submitting full spec for final review.',
      );
    }

    const approvedDeliveryDeadline = this.resolveApprovedDeliveryDeadline(
      spec.request,
      spec.parentSpec ?? null,
    );
    const approvedClientFeatures = this.resolveApprovedClientFeatures(
      spec.request,
      spec.parentSpec ?? null,
    );
    const currentMilestones = (spec.milestones || []).map((milestone) => ({
      title: milestone.title,
      description: milestone.description,
      amount: Number(milestone.amount || 0),
      deliverableType: milestone.deliverableType,
      retentionAmount: Number(milestone.retentionAmount || 0),
      acceptanceCriteria: milestone.acceptanceCriteria || [],
      startDate: milestone.startDate ? new Date(milestone.startDate).toISOString().slice(0, 10) : undefined,
      dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString().slice(0, 10) : undefined,
      sortOrder: milestone.sortOrder ?? undefined,
      approvedClientFeatureIds: milestone.approvedClientFeatureIds || undefined,
    }));
    this.validateMilestoneStructure(currentMilestones, {
      approvedDeadlineKey: approvedDeliveryDeadline,
    });
    this.validateMilestoneBudget(currentMilestones, Number(spec.totalBudget || 0));
    this.validateFullSpecBudgetAgainstParent(Number(spec.totalBudget || 0), spec.request, spec.parentSpec ?? null);
    this.validateFeatures(spec.features || []);
    this.validateApprovedFeatureCoverage(spec.features || [], currentMilestones, approvedClientFeatures);

    const nextSnapshot = this.buildSpecSubmissionSnapshot(spec);
    const nextDiff = this.buildSpecSubmissionDiff(spec.lastSubmittedSnapshot, nextSnapshot);

    spec.status = ProjectSpecStatus.FINAL_REVIEW;
    spec.rejectionReason = null;
    spec.submissionVersion = (spec.submissionVersion || 0) + 1;
    spec.lastSubmittedSnapshot = nextSnapshot;
    spec.lastSubmittedDiff = nextDiff;
    await this.projectSpecsRepository.save(spec);

    await this.notifyUser({
      userId: spec.request.clientId,
      title: 'Final Spec ready for review',
      body: `Broker submitted "${spec.title}" for final review and signing.`,
      relatedType: 'ProjectRequest',
      relatedId: spec.requestId,
    });
    await this.notifyUser({
      userId: acceptedFreelancerId,
      title: 'Final Spec ready for review',
      body: `Final spec "${spec.title}" is ready for your review and signature.`,
      relatedType: 'ProjectRequest',
      relatedId: spec.requestId,
    });

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'SUBMIT_FULL_SPEC_FOR_REVIEW',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { newStatus: spec.status },
      req,
    });

    await this.emitRequestSystemMessage(
      spec.requestId,
      'Broker submitted the final spec for multi-party review.',
    );

    this.emitSpecUpdated(spec, [spec.request.clientId, spec.request.brokerId, acceptedFreelancerId]);

    return spec;
  }

  /**
   * Sign the full spec (Client / Broker / Freelancer)
   * When all 3 parties sign → status becomes ALL_SIGNED → ready for contract
   * TODO: Track individual signatures; for now transitions directly
   */
  async signSpec(
    user: UserEntity,
    specId: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.FULL_SPEC) {
      throw new BadRequestException('Only full specs can be signed');
    }
    this.assertSpecNotLockedForCommercialChanges(spec, 'signed again');
    if (spec.status !== ProjectSpecStatus.FINAL_REVIEW) {
      throw new BadRequestException(`Spec must be in FINAL_REVIEW status. Current: ${spec.status}`);
    }

    const requiredSignerIds = await this.getRequiredSignerIds(spec);
    if (!requiredSignerIds.includes(user.id)) {
      throw new ForbiddenException('You are not an eligible signer for this spec');
    }

    const existing = await this.projectSpecSignaturesRepository.findOne({
      where: { specId, userId: user.id },
    });
    if (existing) {
      const reconciled = await this.reconcileFullSpecSigningState(spec);
      if (reconciled.allRequiredSigned) {
        this.logger.warn(
          `Recovered fully-signed spec ${specId} on duplicate sign attempt by ${user.id}; status is now ${spec.status}.`,
        );
        return this.findOne(specId);
      }
      throw new BadRequestException('You have already signed this spec');
    }

    await this.projectSpecSignaturesRepository.save(
      this.projectSpecSignaturesRepository.create({
        specId,
        userId: user.id,
        signerRole: user.role,
      }),
    );

    const reconciled = await this.reconcileFullSpecSigningState(spec);

    try {
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'SIGN_FULL_SPEC',
        entityType: 'ProjectSpec',
        entityId: specId,
        newData: {
          signedBy: user.id,
          role: user.role,
          requiredSignerCount: reconciled.requiredSignerIds.length,
          signedCount: reconciled.signatures.length,
          allRequiredSigned: reconciled.allRequiredSigned,
          newStatus: reconciled.specStatus,
        },
        req,
      });
    } catch (error) {
      this.logger.warn(
        `Audit log failed after signing full spec ${specId} by ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const pendingSignerIds = reconciled.requiredSignerIds.filter((signerId) => signerId !== user.id);
    await this.notificationsService.createMany(
      pendingSignerIds.map((signerId) => ({
        userId: signerId,
        title: reconciled.allRequiredSigned ? 'Final Spec fully signed' : 'Final Spec signing updated',
        body: reconciled.allRequiredSigned
          ? `All required parties signed "${spec.title}". Contract handoff can begin.`
          : `${user.role} signed "${spec.title}". ${reconciled.signatures.length}/${reconciled.requiredSignerIds.length} signatures are complete.`,
        relatedType: 'ProjectRequest',
        relatedId: spec.requestId,
      })),
    );

    await this.emitRequestSystemMessage(
      spec.requestId,
      reconciled.allRequiredSigned
        ? 'All required parties signed the final spec. Contract handoff can begin.'
        : `${user.role} signed the final spec.`,
    );

    this.emitSpecUpdated(spec, reconciled.requiredSignerIds);

    return this.findOne(specId);
  }

  async requestFullSpecChanges(
    user: UserEntity,
    specId: string,
    reason: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);

    if (spec.specPhase !== SpecPhase.FULL_SPEC) {
      throw new BadRequestException('Only full specs can be returned for changes');
    }
    this.assertSpecNotLockedForCommercialChanges(spec, 'returned for changes');
    if (spec.status !== ProjectSpecStatus.FINAL_REVIEW) {
      throw new BadRequestException(
        `Only specs in FINAL_REVIEW can be returned for changes. Current: ${spec.status}`,
      );
    }

    const sanitizedReason = this.sanitizePlainText(reason);
    if (sanitizedReason.length < 10) {
      throw new BadRequestException('Change request reason must be at least 10 characters');
    }

    const requiredSignerIds = await this.getRequiredSignerIds(spec);
    if (!requiredSignerIds.includes(user.id)) {
      throw new ForbiddenException('You are not an eligible reviewer for this full spec');
    }

    const existingSignatureCount = spec.signatures?.length ?? 0;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const managedSpec = await queryRunner.manager.findOne(ProjectSpecEntity, {
        where: { id: specId },
        relations: ['request'],
      });

      if (!managedSpec) {
        throw new NotFoundException('Project spec not found');
      }

      managedSpec.status = ProjectSpecStatus.REJECTED;
      managedSpec.rejectionReason = sanitizedReason;
      managedSpec.rejectionHistory = this.appendRejectionHistory(
        managedSpec,
        sanitizedReason,
        user.id,
      );
      await queryRunner.manager.save(managedSpec);

      await queryRunner.manager.delete(ProjectSpecSignatureEntity, { specId });

      await queryRunner.commitTransaction();

      const requestTitle = spec.request?.title || 'project request';
      const notifiedUserIds = new Set<string>();

      for (const signerId of requiredSignerIds) {
        if (signerId === user.id || notifiedUserIds.has(signerId)) {
          continue;
        }
        notifiedUserIds.add(signerId);
        await this.notifyUser({
          userId: signerId,
          title: 'Full Spec changes requested',
          body: `${user.role} requested changes for "${spec.title}" on ${requestTitle}. Reason: ${sanitizedReason.slice(0, 200)}`,
          relatedType: 'ProjectRequest',
          relatedId: spec.requestId,
        });
      }

      await this.auditLogsService.log({
        actorId: user.id,
        action: 'REQUEST_FULL_SPEC_CHANGES',
        entityType: 'ProjectSpec',
        entityId: specId,
        newData: {
          newStatus: ProjectSpecStatus.REJECTED,
          clearedSignatureCount: existingSignatureCount,
          requestedBy: user.id,
          role: user.role,
          reason: sanitizedReason,
        },
        req,
      });

      await this.emitRequestSystemMessage(
        spec.requestId,
        `${user.role} requested changes on the final spec.`,
      );

      this.emitSpecUpdated(spec, requiredSignerIds);

      return this.findOne(specId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY: createSpec → routes to createFullSpec for backward compat
  // ═══════════════════════════════════════════════════════════════════════════

  async createSpec(
    user: UserEntity,
    createSpecDto: CreateProjectSpecDto,
    req: RequestContext,
  ): Promise<{ spec: ProjectSpecEntity; warnings: string[] }> {
    return this.createFullSpec(user, createSpecDto, req, false);
  }

  /**
   * Staff audit flow (legacy): DRAFT → PENDING_APPROVAL
   */
  async submitForApproval(
    user: UserEntity,
    specId: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);
    if (spec.status !== ProjectSpecStatus.DRAFT) {
      throw new BadRequestException(
        `Spec must be in DRAFT status to submit. Current: ${spec.status}`,
      );
    }

    spec.status = ProjectSpecStatus.PENDING_APPROVAL;
    await this.projectSpecsRepository.save(spec);

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'SUBMIT_FOR_APPROVAL',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { newStatus: spec.status },
      req,
    });
    return spec;
  }

  async approveSpec(
    user: UserEntity,
    specId: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);
    if (
      spec.status !== ProjectSpecStatus.PENDING_APPROVAL &&
      spec.status !== ProjectSpecStatus.PENDING_AUDIT
    ) {
      throw new BadRequestException(`Cannot approve spec in ${spec.status} status`);
    }

    spec.status = ProjectSpecStatus.APPROVED;
    await this.projectSpecsRepository.save(spec);

    if (spec.request) {
      spec.request.status = RequestStatus.SPEC_APPROVED;
      await this.projectRequestsRepository.save(spec.request);
    }

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'APPROVE_SPEC',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { approvedBy: user.id, role: user.role },
      req,
    });
    return spec;
  }

  async rejectSpec(
    user: UserEntity,
    specId: string,
    reason: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);
    spec.status = ProjectSpecStatus.REJECTED;
    spec.rejectionReason = reason;
    await this.projectSpecsRepository.save(spec);

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'REJECT_SPEC',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { rejectedBy: user.id, reason },
      req,
    });
    return spec;
  }

  private assertUserCanViewSpec(user: UserEntity, spec: ProjectSpecEntity): void {
    if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
      return;
    }

    const request = spec.request;
    if (!request) {
      throw new ForbiddenException('You are not authorized to view this spec');
    }

    if (request.clientId === user.id || request.brokerId === user.id) {
      return;
    }

    const hasMatchingFreelancerProposal = (request.proposals || []).some(
      (proposal) =>
        proposal.freelancerId === user.id &&
        ['ACCEPTED', 'PENDING'].includes(String(proposal.status || '').toUpperCase()),
    );
    if (hasMatchingFreelancerProposal) {
      return;
    }

    throw new ForbiddenException('You are not authorized to view this spec');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async findOne(id: string): Promise<ProjectSpecEntity> {
    const spec = await this.projectSpecsRepository.findOne({
      where: { id },
      relations: [
        'milestones',
        'request',
        'request.client',
        'request.broker',
        'request.proposals',
        'request.proposals.freelancer',
        'parentSpec',
        'signatures',
      ],
    });
    if (!spec) throw new NotFoundException(`Project Spec with ID ${id} not found`);
    return this.attachRequestContext(spec);
  }

  async findOneForUser(user: UserEntity, id: string): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(id);
    this.assertUserCanViewSpec(user, spec);
    return spec;
  }

  async findPendingSpecs(): Promise<ProjectSpecEntity[]> {
    return this.projectSpecsRepository.find({
      where: [
        { status: ProjectSpecStatus.PENDING_APPROVAL },
        { status: ProjectSpecStatus.PENDING_AUDIT },
      ],
      relations: ['request', 'request.client', 'request.broker'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all specs for a request (client spec + full spec)
   */
  async findSpecsByRequestId(requestId: string): Promise<ProjectSpecEntity[]> {
    const specs = await this.projectSpecsRepository.find({
      where: { requestId },
      relations: ['milestones', 'parentSpec', 'request', 'request.proposals'],
      order: { createdAt: 'ASC' },
    });
    return specs.map((spec) => this.attachRequestContext(spec));
  }

  async findSpecsByRequestIdForUser(
    user: UserEntity,
    requestId: string,
  ): Promise<ProjectSpecEntity[]> {
    const specs = await this.findSpecsByRequestId(requestId);
    if (specs.length > 0) {
      this.assertUserCanViewSpec(user, specs[0]);
    }
    return specs;
  }

  /**
   * Get client spec for a request
   */
  async findClientSpec(requestId: string): Promise<ProjectSpecEntity | null> {
    const spec = await this.projectSpecsRepository.findOne({
      where: { requestId, specPhase: SpecPhase.CLIENT_SPEC },
      relations: ['milestones', 'request', 'request.client', 'request.broker', 'request.proposals'],
    });
    return this.attachRequestContext(spec);
  }

  async findClientSpecForUser(user: UserEntity, requestId: string): Promise<ProjectSpecEntity | null> {
    const spec = await this.findClientSpec(requestId);
    if (!spec) {
      return null;
    }
    this.assertUserCanViewSpec(user, spec);
    return spec;
  }

  /**
   * Get full spec linked to a client spec
   */
  async findFullSpec(parentSpecId: string): Promise<ProjectSpecEntity | null> {
    const spec = await this.projectSpecsRepository.findOne({
      where: { parentSpecId, specPhase: SpecPhase.FULL_SPEC },
      relations: [
        'milestones',
        'parentSpec',
        'request',
        'request.client',
        'request.broker',
        'request.proposals',
      ],
    });
    return this.attachRequestContext(spec);
  }

  async findFullSpecForUser(user: UserEntity, parentSpecId: string): Promise<ProjectSpecEntity | null> {
    const spec = await this.findFullSpec(parentSpecId);
    if (!spec) {
      return null;
    }
    this.assertUserCanViewSpec(user, spec);
    return spec;
  }

  /**
   * Specs pending client review (for client dashboard)
   */
  async findPendingClientReview(clientId: string): Promise<ProjectSpecEntity[]> {
    return this.projectSpecsRepository
      .createQueryBuilder('spec')
      .leftJoinAndSelect('spec.request', 'request')
      .leftJoinAndSelect('request.broker', 'broker')
      .where('spec.specPhase = :phase', { phase: SpecPhase.CLIENT_SPEC })
      .andWhere('spec.status = :status', { status: ProjectSpecStatus.CLIENT_REVIEW })
      .andWhere('request.clientId = :clientId', { clientId })
      .orderBy('spec.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Specs in final review (for 3-party signing)
   */
  async findSpecsInFinalReview(userId: string): Promise<ProjectSpecEntity[]> {
    return this.projectSpecsRepository
      .createQueryBuilder('spec')
      .leftJoinAndSelect('spec.request', 'request')
      .leftJoinAndSelect('request.client', 'client')
      .leftJoinAndSelect('request.broker', 'broker')
      .leftJoinAndSelect('spec.milestones', 'milestones')
      .leftJoinAndSelect('spec.signatures', 'signatures')
      .where('spec.specPhase = :phase', { phase: SpecPhase.FULL_SPEC })
      .andWhere('spec.status = :status', { status: ProjectSpecStatus.FINAL_REVIEW })
      .andWhere(
        `(request.clientId = :userId OR request.brokerId = :userId OR EXISTS (
          SELECT 1
          FROM project_request_proposals proposal
          WHERE proposal."requestId" = request.id
            AND proposal."freelancerId" = :userId
            AND proposal.status = :acceptedStatus
        ))`,
        { userId, acceptedStatus: 'ACCEPTED' },
      )
      .orderBy('spec.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Legacy backward compat — single spec by request ID
   */
  async findByRequestId(requestId: string): Promise<ProjectSpecEntity | null> {
    const specs = await this.projectSpecsRepository.find({
      where: { requestId },
      relations: ['milestones'],
      order: { createdAt: 'DESC' },
    });
    return specs.find((spec) => spec.specPhase === SpecPhase.FULL_SPEC) ?? specs[0] ?? null;
  }
}
