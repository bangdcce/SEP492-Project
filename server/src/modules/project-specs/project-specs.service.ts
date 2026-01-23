import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecFeature,
} from '../../database/entities/project-spec.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { v4 as uuidv4 } from 'uuid';

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

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  async createSpec(
    user: UserEntity,
    createSpecDto: CreateProjectSpecDto,
    req: RequestContext,
  ): Promise<{ spec: ProjectSpecEntity; warnings: string[] }> {
    const { requestId, milestones, totalBudget, features, techStack, referenceLinks, ...specData } =
      createSpecDto;

    // Collect warnings (non-blocking)
    const warnings: string[] = [];

    // Use queryRunner for transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Project Request
      const projectRequest = await queryRunner.manager.findOne(ProjectRequestEntity, {
        where: { id: requestId },
        relations: ['broker'],
      });

      if (!projectRequest) {
        throw new NotFoundException('Project request not found');
      }

      // Check ownership
      if (projectRequest.brokerId !== user.id) {
        throw new ForbiddenException('You are not authorized to create a spec for this request');
      }

      // Map features and add IDs
      const mappedFeatures: SpecFeature[] = (features || []).map((f) => ({
        ...f,
        id: uuidv4(),
        inputOutputSpec: f.inputOutputSpec || '',
      }));

      // 2. GOVERNANCE VALIDATION: Milestone Budget Rules
      this.validateMilestoneBudget(milestones, totalBudget);

      // 3. GOVERNANCE VALIDATION: Features JSON Structure
      this.validateFeatures(mappedFeatures);

      // 4. Check for banned keywords (non-blocking warnings)
      const descWarnings = this.checkBannedKeywords(specData.description || '');
      warnings.push(...descWarnings);

      for (const feature of mappedFeatures) {
        const featureWarnings = this.checkBannedKeywords(feature.description || '');
        warnings.push(...featureWarnings);
      }

      // 5. Save Project Spec
      const newSpec = queryRunner.manager.create(ProjectSpecEntity, {
        requestId,
        totalBudget,
        features: mappedFeatures,
        techStack: techStack || '',
        referenceLinks: referenceLinks || [],
        ...specData,
        status: createSpecDto.status || ProjectSpecStatus.DRAFT,
      });
      const savedSpec = await queryRunner.manager.save(newSpec);

      // 6. Save Milestones
      const newMilestones = milestones.map((m, index) =>
        queryRunner.manager.create(MilestoneEntity, {
          ...m,
          projectSpecId: savedSpec.id,
          status: MilestoneStatus.PENDING,
          projectId: null,
          sortOrder: m.sortOrder ?? index,
        }),
      );

      await queryRunner.manager.save(newMilestones);

      // 7. Update Project Request Status
      projectRequest.status = RequestStatus.SPEC_SUBMITTED;
      await queryRunner.manager.save(projectRequest);

      // 8. Audit Log
      await this.auditLogsService.log({
        actorId: user.id,
        action: 'SUBMIT_SPEC',
        entityType: 'ProjectSpec',
        entityId: savedSpec.id,
        newData: {
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
      this.logger.error(`Failed to create project spec: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Submit spec for approval (DRAFT -> PENDING_APPROVAL / PENDING_AUDIT)
   */
  async submitForApproval(
    user: UserEntity,
    specId: string,
    req: RequestContext,
  ): Promise<ProjectSpecEntity> {
    const spec = await this.findOne(specId);

    if (spec.status !== ProjectSpecStatus.DRAFT) {
      throw new BadRequestException(`Spec must be in DRAFT status to submit. Current: ${spec.status}`);
    }

    // Determine if audit is required based on Broker reputation
    // For now, always go to PENDING_APPROVAL (Staff audit logic can be added later)
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

  /**
   * Approve spec (Client or Staff action)
   */
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

    // Sync Parent Request Status
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

  /**
   * Reject spec with reason
   */
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

  async findOne(id: string): Promise<ProjectSpecEntity> {
    const spec = await this.projectSpecsRepository.findOne({
      where: { id },
      relations: ['milestones', 'request', 'request.client'],
    });

    if (!spec) {
      throw new NotFoundException(`Project Spec with ID ${id} not found`);
    }

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
   * Get spec by request ID
   */
  async findByRequestId(requestId: string): Promise<ProjectSpecEntity | null> {
    return this.projectSpecsRepository.findOne({
      where: { requestId },
      relations: ['milestones'],
    });
  }
}

