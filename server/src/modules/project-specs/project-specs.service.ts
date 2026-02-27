import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
  SpecFeature,
  ClientFeature,
} from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { ProjectSpecSignatureEntity } from '../../database/entities/project-spec-signature.entity';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { CreateClientSpecDto } from './dto/create-client-spec.dto';
import { UserEntity } from '../../database/entities/user.entity';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';

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
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly dataSource: DataSource,
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

    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        relatedType: payload.relatedType || null,
        relatedId: payload.relatedId || null,
      }),
    );
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
        relations: ['broker'],
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
      if (existingSpec && existingSpec.status !== ProjectSpecStatus.REJECTED) {
        throw new BadRequestException(
          'A client spec already exists for this request. Edit the existing one or wait for client review.',
        );
      }

      const sanitizedTitle = this.sanitizePlainText(dto.title);
      const sanitizedDescription = this.sanitizePlainText(dto.description);
      const mappedFeatures: ClientFeature[] = dto.clientFeatures.map((feature) => ({
        id: uuidv4(),
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
        totalBudget: dto.estimatedBudget,
        estimatedTimeline: dto.estimatedTimeline,
        projectCategory: dto.projectCategory || undefined,
        clientFeatures: mappedFeatures,
        referenceLinks: dto.referenceLinks || [],
        richContentJson: (this.sanitizeStructuredJson(dto.richContentJson) ??
          null) as Record<string, unknown> | null,
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
          estimatedBudget: dto.estimatedBudget,
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

    const sanitizedTitle = this.sanitizePlainText(dto.title);
    const sanitizedDescription = this.sanitizePlainText(dto.description);
    const mappedFeatures: ClientFeature[] = dto.clientFeatures.map((feature) => ({
      id: uuidv4(),
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
    spec.totalBudget = dto.estimatedBudget;
    spec.estimatedTimeline = this.sanitizePlainText(dto.estimatedTimeline);
    spec.projectCategory = dto.projectCategory
      ? this.sanitizePlainText(dto.projectCategory)
      : null;
    spec.clientFeatures = mappedFeatures;
    spec.referenceLinks = dto.referenceLinks || [];
    spec.richContentJson = (this.sanitizeStructuredJson(dto.richContentJson) ??
      null) as Record<string, unknown> | null;
    // Preserve REJECTED until broker explicitly re-submits for review.

    await this.projectSpecsRepository.save(spec);

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'UPDATE_CLIENT_SPEC',
      entityType: 'ProjectSpec',
      entityId: spec.id,
      newData: {
        phase: SpecPhase.CLIENT_SPEC,
        estimatedBudget: dto.estimatedBudget,
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
      throw new BadRequestException(`Spec must be in DRAFT or REJECTED status. Current: ${spec.status}`);
    }
    if (!spec.clientFeatures || spec.clientFeatures.length === 0) {
      throw new BadRequestException('Client spec must have at least one feature');
    }
    if (!spec.request || spec.request.brokerId !== user.id) {
      throw new ForbiddenException('Only assigned broker can submit this client spec');
    }

    spec.status = ProjectSpecStatus.CLIENT_REVIEW;
    spec.rejectionReason = null;
    await this.projectSpecsRepository.save(spec);

    spec.request.status = RequestStatus.SPEC_SUBMITTED;
    await this.projectRequestsRepository.save(spec.request);

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'SUBMIT_CLIENT_SPEC_FOR_REVIEW',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { newStatus: spec.status },
      req,
    });

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
      throw new BadRequestException(`Spec must be in CLIENT_REVIEW status. Current: ${spec.status}`);
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
        await this.projectRequestsRepository.save(spec.request);
      }
      brokerNotification = {
        title: 'Client Spec approved',
        body: `Client approved "${spec.title}" for ${requestTitle}.`,
      };
    } else {
      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Rejection reason must be at least 10 characters');
      }
      spec.status = ProjectSpecStatus.REJECTED;
      spec.rejectionReason = reason;
      brokerNotification = {
        title: 'Client Spec rejected',
        body: `Client rejected "${spec.title}". Reason: ${reason.trim().slice(0, 200)}`,
      };
    }

    await this.projectSpecsRepository.save(spec);
    await this.notifyUser({
      userId: brokerId,
      title: brokerNotification?.title || 'Client Spec updated',
      body: brokerNotification?.body || `Client updated "${spec.title}".`,
      relatedType: 'ProjectSpec',
      relatedId: spec.id,
    });

    await this.auditLogsService.log({
      actorId: user.id,
      action: action === 'APPROVE' ? 'CLIENT_APPROVE_SPEC' : 'CLIENT_REJECT_SPEC',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { action, reason: reason || null, role: user.role },
      req,
    });

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
        throw new BadRequestException('Cannot create full spec: Client spec must be approved first.');
      }

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
        id: uuidv4(),
        acceptanceCriteria: (f.acceptanceCriteria || []).map((criteria) =>
          this.sanitizePlainText(criteria),
        ),
        inputOutputSpec: f.inputOutputSpec
          ? this.sanitizePlainText(f.inputOutputSpec)
          : '',
      }));

      // 4. GOVERNANCE VALIDATION
      this.validateMilestoneBudget(milestones, totalBudget);
      this.validateFeatures(mappedFeatures);

      // 5. Check banned keywords (non-blocking)
      warnings.push(...this.checkBannedKeywords(this.sanitizePlainText(specData.description || '')));
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
        referenceLinks: referenceLinks || [],
        richContentJson: (this.sanitizeStructuredJson(richContentJson) ??
          null) as Record<string, unknown> | null,
        status: createSpecDto.status || ProjectSpecStatus.DRAFT,
        projectCategory: parentSpec?.projectCategory || null,
        estimatedTimeline: parentSpec?.estimatedTimeline || null,
        clientFeatures: parentSpec?.clientFeatures || null,
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
          projectSpecId: savedSpec.id,
          status: MilestoneStatus.PENDING,
          projectId: null,
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
      id: uuidv4(),
      acceptanceCriteria: (feature.acceptanceCriteria || []).map((criteria) =>
        this.sanitizePlainText(criteria),
      ),
      inputOutputSpec: feature.inputOutputSpec
        ? this.sanitizePlainText(feature.inputOutputSpec)
        : '',
    }));

    this.validateMilestoneBudget(dto.milestones, dto.totalBudget);
    this.validateFeatures(mappedFeatures);

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
        managedSpec.referenceLinks = dto.referenceLinks;
      }
      if (dto.richContentJson !== undefined) {
        managedSpec.richContentJson = (this.sanitizeStructuredJson(dto.richContentJson) ??
          null) as Record<string, unknown> | null;
      }
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
          projectSpecId: specId,
          projectId: null,
          status: MilestoneStatus.PENDING,
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
    if (spec.status !== ProjectSpecStatus.DRAFT && spec.status !== ProjectSpecStatus.REJECTED) {
      throw new BadRequestException(`Spec must be in DRAFT or REJECTED status. Current: ${spec.status}`);
    }
    if (!spec.milestones || spec.milestones.length === 0) {
      throw new BadRequestException('Full spec must have at least one milestone');
    }
    if (!spec.request || spec.request.brokerId !== user.id) {
      throw new ForbiddenException('Only assigned broker can submit this full spec');
    }

    const acceptedFreelancerId = await this.findAcceptedFreelancerId(spec.requestId);
    if (!acceptedFreelancerId) {
      throw new BadRequestException(
        'Freelancer must accept invitation before submitting full spec for final review.',
      );
    }

    spec.status = ProjectSpecStatus.FINAL_REVIEW;
    spec.rejectionReason = null;
    await this.projectSpecsRepository.save(spec);

    await this.auditLogsService.log({
      actorId: user.id,
      action: 'SUBMIT_FULL_SPEC_FOR_REVIEW',
      entityType: 'ProjectSpec',
      entityId: specId,
      newData: { newStatus: spec.status },
      req,
    });

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

    return this.findOne(specId);
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

  async approveSpec(user: UserEntity, specId: string, req: RequestContext): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);
    if (spec.status !== ProjectSpecStatus.PENDING_APPROVAL && spec.status !== ProjectSpecStatus.PENDING_AUDIT) {
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

  async rejectSpec(user: UserEntity, specId: string, reason: string, req: RequestContext): Promise<ProjectSpecEntity> {
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
    return this.projectSpecsRepository.find({
      where: { requestId },
      relations: ['milestones', 'parentSpec'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get client spec for a request
   */
  async findClientSpec(requestId: string): Promise<ProjectSpecEntity | null> {
    return this.projectSpecsRepository.findOne({
      where: { requestId, specPhase: SpecPhase.CLIENT_SPEC },
      relations: ['milestones', 'request', 'request.client', 'request.broker'],
    });
  }

  /**
   * Get full spec linked to a client spec
   */
  async findFullSpec(parentSpecId: string): Promise<ProjectSpecEntity | null> {
    return this.projectSpecsRepository.findOne({
      where: { parentSpecId, specPhase: SpecPhase.FULL_SPEC },
      relations: ['milestones', 'parentSpec', 'request', 'request.client', 'request.broker'],
    });
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
