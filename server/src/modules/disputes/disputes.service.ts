import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DisputeEntity,
  DisputeResult,
  DisputeStatus,
  DisputePhase,
  DisputeCategory,
  DisputePriority,
  DisputeType,
  DisputeNoteEntity,
  DisputeActivityEntity,
  DisputeEvidenceEntity,
  DisputeMessageEntity,
  DisputeAction,
  DisputeHearingEntity,
  HearingTier,
  HearingStatus,
  DisputeVerdictEntity,
  EscrowEntity,
  EscrowStatus,
  MilestoneEntity,
  MilestoneStatus,
  ProjectEntity,
  ProjectStatus,
  TransactionEntity,
  TransactionStatus,
  TransactionType,
  UserEntity,
  UserRole,
  WalletEntity,
  MessageType,
} from 'src/database/entities';
import {
  DataSource,
  In,
  Not,
  QueryRunner,
  Repository,
  Brackets,
  LessThan,
  LessThanOrEqual,
  Between,
  MoreThan,
  IsNull,
  SelectQueryBuilder,
} from 'typeorm';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-disputes.dto';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import {
  DisputeResolvedEvent,
  MoneyDistribution,
  ResolutionResult,
  TransferDetail,
} from './interfaces/resolution.interface';
import { DisputeStateMachine, determineLoser } from './dispute-state-machine';
import { DISPUTE_EVENTS } from './events/dispute.events';
import { AddNoteDto } from './dto/add-note.dto';
import { DefendantResponseDto } from './dto/defendant-response.dto';
import { AppealDto } from './dto/appeal.dto';
import { AdminUpdateDisputeDto } from './dto/admin-update-dispute.dto';
import { SendDisputeMessageDto, HideMessageDto } from './dto/message.dto';
import {
  DisputeFilterDto,
  DisputeSortBy,
  SortOrder,
  PaginatedDisputesResponse,
} from './dto/dispute-filter.dto';
import { UserWarningService } from '../user-warning/user-warning.service';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { SettlementService } from './services/settlement.service';
import { HearingService } from './services/hearing.service';
import { VerdictService } from './services/verdict.service';
import { AppealVerdictDto } from './dto/verdict.dto';
import { StaffAssignmentService } from './services/staff-assignment.service';
import { CalendarService } from '../calendar/calendar.service';

// Constants for deadlines
const DEFAULT_RESPONSE_DEADLINE_DAYS = 7;
const DEFAULT_RESOLUTION_DEADLINE_DAYS = 14;
const URGENT_THRESHOLD_HOURS = 48; // Dispute được coi là urgent nếu còn < 48h
const DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS = 7;
const DEFAULT_HEARING_DURATION_MINUTES = 60;
const DEFAULT_HEARING_MIN_NOTICE_HOURS = 24;
const DEFAULT_SETTLEMENT_WINDOW_HOURS = 24;
const DEADLINE_SETTLEMENT_WINDOW_HOURS = 48;
const REJECTION_APPEAL_WINDOW_HOURS = 24;
const DISMISSAL_HOLD_HOURS = 24;
const DISMISSAL_RATE_SAMPLE_WINDOW_DAYS = 30;
const DISMISSAL_RATE_ALERT_THRESHOLD = 0.3;
const DISMISSAL_RATE_MIN_SAMPLES = 10;
const DISMISSAL_AUDIT_SAMPLE_RATE = 0.1;
const MESSAGE_RATE_LIMIT = {
  MIN_INTERVAL_MS: 1000,
  MAX_PER_MINUTE: 10,
  BLOCK_DURATION_MS: 60 * 1000,
} as const;

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);
  private disputeStatsCache?: {
    value: {
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      overdue: number;
      urgent: number;
    };
    expiresAt: number;
  };
  private readonly disputeStatsTtlMs = 60 * 1000;

  constructor(
    @InjectRepository(MilestoneEntity)
    private milestoneRepo: Repository<MilestoneEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(DisputeEntity)
    private disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeEvidenceEntity)
    private evidenceRepo: Repository<DisputeEvidenceEntity>,
    @InjectRepository(DisputeMessageEntity)
    private messageRepo: Repository<DisputeMessageEntity>,
    @InjectRepository(DisputeHearingEntity)
    private hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(DisputeVerdictEntity)
    private verdictRepo: Repository<DisputeVerdictEntity>,
    @InjectRepository(EscrowEntity)
    private escrowRepo: Repository<EscrowEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(WalletEntity)
    private walletRepo: Repository<WalletEntity>,
    @InjectRepository(TransactionEntity)
    private transactionRepo: Repository<TransactionEntity>,
    @InjectRepository(DisputeNoteEntity)
    private noteRepo: Repository<DisputeNoteEntity>,
    @InjectRepository(DisputeActivityEntity)
    private activityRepo: Repository<DisputeActivityEntity>,

    private readonly dataSource: DataSource,
    private readonly trustScoreService: TrustScoreService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userWarningService: UserWarningService,
    private readonly settlementService: SettlementService,
    private readonly hearingService: HearingService,
    private readonly verdictService: VerdictService,
    private readonly staffAssignmentService: StaffAssignmentService,
    private readonly calendarService: CalendarService,
  ) {}

  private async ensureLegacyFlowAllowed(disputeId: string): Promise<void> {
    const verdict = await this.verdictRepo.findOne({ where: { disputeId } });
    if (verdict) {
      throw new BadRequestException(
        'Dispute already uses verdict workflow. Use verdict endpoints instead of legacy resolve/appeal.',
      );
    }
  }

  private readonly messageRateLimit = new Map<
    string,
    {
      lastMessageAtMs: number;
      windowStartMs: number;
      countInWindow: number;
      blockedUntilMs?: number;
    }
  >();

  private async buildMessageEventPayload(message: DisputeMessageEntity) {
    let senderSummary: { id: string; fullName?: string; email?: string; role?: UserRole } | undefined;
    if (message.senderId) {
      const sender = await this.userRepo.findOne({
        where: { id: message.senderId },
        select: ['id', 'fullName', 'email', 'role'],
      });
      if (sender) {
        senderSummary = {
          id: sender.id,
          fullName: sender.fullName,
          email: sender.email,
          role: sender.role,
        };
      }
    }

    return {
      messageId: message.id,
      disputeId: message.disputeId,
      hearingId: message.hearingId,
      senderId: message.senderId || undefined,
      senderRole: message.senderRole,
      type: message.type,
      content: message.content,
      metadata: message.metadata,
      replyToMessageId: message.replyToMessageId,
      relatedEvidenceId: message.relatedEvidenceId,
      isHidden: message.isHidden,
      hiddenReason: message.hiddenReason,
      createdAt: message.createdAt,
      sender: senderSummary,
    };
  }

  async create(raisedBy: string, dto: CreateDisputeDto) {
    const {
      projectId,
      milestoneId,
      defendantId,
      reason,
      evidence,
      category,
      disputedAmount,
      parentDisputeId,
    } = dto;
    const disputeCategory = category || DisputeCategory.OTHER;
    if (disputeCategory === DisputeCategory.SCOPE_CHANGE) {
      throw new BadRequestException(
        'Scope changes must be handled via Change Request, not dispute.',
      );
    }

    const now = new Date();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedDispute: DisputeEntity;
    let project: ProjectEntity;
    let escrow: EscrowEntity;
    let raiserRole: UserRole;
    let defendantRole: UserRole;

    try {
      project = await queryRunner.manager.findOne(ProjectEntity, {
        where: {
          id: projectId,
          status: In([ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED, ProjectStatus.DISPUTED]),
        },
        lock: { mode: 'pessimistic_read' },
      });
      if (!project) {
        throw new NotFoundException('Project not found or not eligible for dispute');
      }

      if (project.status === ProjectStatus.PAID) {
        throw new BadRequestException('Project is already paid. Dispute requires manual support');
      }

      const milestone = await queryRunner.manager.findOne(MilestoneEntity, {
        where: { id: milestoneId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!milestone) {
        throw new NotFoundException('Milestone not found');
      }

      if (milestone.projectId !== projectId) {
        throw new BadRequestException('Milestone does not belong to this project');
      }

      if (milestone.status === MilestoneStatus.PAID) {
        throw new BadRequestException('Milestone is already paid. Dispute requires manual support');
      }
      const allowedMilestoneStatuses = parentDisputeId
        ? [MilestoneStatus.COMPLETED, MilestoneStatus.LOCKED]
        : this.getAllowedMilestoneStatusesForDispute(disputeCategory);
      if (!allowedMilestoneStatuses.includes(milestone.status)) {
        throw new BadRequestException(
          `Milestone status "${milestone.status}" does not allow ${disputeCategory} disputes. ` +
            `Allowed statuses: ${allowedMilestoneStatuses.join(', ')}`,
        );
      }

      escrow = await queryRunner.manager.findOne(EscrowEntity, {
        where: { milestoneId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundException('Escrow not found');
      }

      const allowedEscrowStatuses = parentDisputeId
        ? [EscrowStatus.FUNDED, EscrowStatus.DISPUTED]
        : [EscrowStatus.FUNDED];
      if (!allowedEscrowStatuses.includes(escrow.status)) {
        throw new BadRequestException('Escrow is not in HOLD state for dispute');
      }

      const projectMember = [project.clientId, project.brokerId, project.freelancerId].filter(
        Boolean,
      );
      if (!projectMember.includes(raisedBy)) {
        throw new BadRequestException('You are not a member of this project');
      }
      if (!projectMember.includes(defendantId)) {
        throw new BadRequestException('Defendant is not a member of this project');
      }
      if (raisedBy === defendantId) {
        throw new BadRequestException('You cannot dispute yourself');
      }

      const activeStatuses = [
        DisputeStatus.OPEN,
        DisputeStatus.PENDING_REVIEW,
        DisputeStatus.INFO_REQUESTED,
        DisputeStatus.IN_MEDIATION,
        DisputeStatus.REJECTION_APPEALED,
        DisputeStatus.APPEALED,
      ];

      let parentDispute: DisputeEntity | null = null;
      if (parentDisputeId) {
        parentDispute = await queryRunner.manager.findOne(DisputeEntity, {
          where: { id: parentDisputeId },
          lock: { mode: 'pessimistic_read' },
        });

        if (!parentDispute) {
          throw new BadRequestException('Parent dispute not found');
        }

        if (parentDispute.projectId !== projectId || parentDispute.milestoneId !== milestoneId) {
          throw new BadRequestException('Parent dispute does not match project/milestone');
        }

        if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(parentDispute.status)) {
          throw new BadRequestException('Parent dispute is already closed');
        }

        const existingForDefendant = await queryRunner.manager.findOne(DisputeEntity, {
          where: {
            milestoneId,
            defendantId,
            status: In(activeStatuses),
          },
          lock: { mode: 'pessimistic_read' },
        });
        if (existingForDefendant) {
          throw new BadRequestException(
            'Active dispute already exists for this defendant. Add evidence to existing dispute.',
          );
        }
      } else {
        const existingDispute = await queryRunner.manager.findOne(DisputeEntity, {
          where: { milestoneId, status: In(activeStatuses) },
          lock: { mode: 'pessimistic_read' },
        });
        if (existingDispute) {
          throw new BadRequestException(
            'This milestone already has an active dispute. Add evidence instead.',
          );
        }
      }

      raiserRole = this.determineUserRole(raisedBy, project);
      defendantRole = this.determineUserRole(defendantId, project);
      const disputeType = this.determineDisputeType(raiserRole, defendantRole);

      const amount = disputedAmount || Number(escrow.totalAmount);
      const priority = this.calculatePriority(amount, disputeCategory, project.currency);

      const responseDeadline = new Date(
        now.getTime() + DEFAULT_RESPONSE_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
      );
      const resolutionDeadline = new Date(
        now.getTime() + DEFAULT_RESOLUTION_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
      );

      const dispute = this.disputeRepo.create({
        raisedById: raisedBy,
        raiserRole,
        projectId,
        milestoneId,
        defendantId,
        defendantRole,
        disputeType,
        category: disputeCategory,
        priority,
        disputedAmount: amount,
        reason,
        evidence,
        phase: DisputePhase.PRESENTATION,
        status: DisputeStatus.PENDING_REVIEW,
        responseDeadline,
        resolutionDeadline,
        parentDisputeId: parentDisputeId || null,
        groupId: parentDispute?.groupId || parentDispute?.id || null,
      });

      escrow.status = EscrowStatus.DISPUTED;
      project.status = ProjectStatus.DISPUTED;
      milestone.status = MilestoneStatus.LOCKED;

      await queryRunner.manager.save(EscrowEntity, escrow);
      await queryRunner.manager.save(MilestoneEntity, milestone);
      await queryRunner.manager.save(ProjectEntity, project);
      savedDispute = await queryRunner.manager.save(DisputeEntity, dispute);

      if (!parentDisputeId && !savedDispute.groupId) {
        savedDispute.groupId = savedDispute.id;
        await queryRunner.manager.update(
          DisputeEntity,
          { id: savedDispute.id },
          { groupId: savedDispute.groupId },
        );
      }

      if (!escrow.disputeId) {
        escrow.disputeId = savedDispute.id;
      }
      await queryRunner.manager.save(EscrowEntity, escrow);

      await this.verdictService.createDisputeSignature(
        queryRunner,
        savedDispute,
        raisedBy,
        raiserRole,
        {
          termsContentSnapshot: 'Dispute terms acknowledgment',
          termsVersion: 'v1',
        },
      );

      await this.logActivity(
        queryRunner,
        savedDispute.id,
        raisedBy,
        raiserRole,
        DisputeAction.CREATED,
        `Dispute created: ${raiserRole} vs ${defendantRole}`,
        {
          reason,
          category: disputeCategory,
          disputedAmount: amount,
          parentDisputeId: parentDisputeId || null,
        },
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const assignment = await this.autoAssignStaff(savedDispute.id);
    let availability: Awaited<ReturnType<typeof this.checkInitialAvailability>> | null = null;
    try {
      availability = await this.checkInitialAvailability(
        savedDispute,
        project,
        assignment?.staffId || '',
        assignment?.complexity?.timeEstimation?.recommendedMinutes,
      );
    } catch (error) {
      this.logger.warn(
        `Initial availability check failed for dispute ${savedDispute.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    this.eventEmitter.emit(DISPUTE_EVENTS.CREATED, {
      disputeId: savedDispute.id,
      projectId,
      raisedById: raisedBy,
      raiserRole,
      defendantId,
      defendantRole,
      responseDeadline: savedDispute.responseDeadline,
      assignedStaffId: assignment?.staffId || null,
      availabilitySlots: availability?.slots || [],
    });

    return savedDispute;
  }

  // =============================================================================
  // DANH SÁCH DISPUTES VỚI PAGINATION & FILTERS
  // =============================================================================

  /**
   * Lấy danh sách disputes với pagination, filters, và smart sorting
   * Disputes gần hết hạn + priority cao sẽ được đẩy lên đầu
   */
  async getAll(filters: DisputeFilterDto = {}): Promise<PaginatedDisputesResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = DisputeSortBy.URGENCY,
      sortOrder = SortOrder.DESC,
      status,
      statusIn,
      category,
      priority,
      disputeType,
      projectId,
      raisedById,
      defendantId,
      assignedStaffId,
      unassignedOnly,
      createdFrom,
      createdTo,
      deadlineBefore,
      deadlineFrom,
      deadlineTo,
      minDisputedAmount,
      maxDisputedAmount,
      overdueOnly,
      urgentOnly,
      appealed,
      search,
    } = filters;

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoin('dispute.raiser', 'raiser')
      .leftJoin('dispute.defendant', 'defendant')
      .leftJoin('dispute.project', 'project')
      .addSelect([
        'raiser.id',
        'raiser.fullName',
        'raiser.email',
        'defendant.id',
        'defendant.fullName',
        'defendant.email',
        'project.id',
        'project.title',
      ]);

    // === FILTERS ===
    if (statusIn && statusIn.length > 0) {
      qb.andWhere('dispute.status IN (:...statusIn)', { statusIn });
    } else if (status) {
      qb.andWhere('dispute.status = :status', { status });
    }

    if (category) {
      qb.andWhere('dispute.category = :category', { category });
    }

    if (priority) {
      qb.andWhere('dispute.priority = :priority', { priority });
    }

    if (disputeType) {
      qb.andWhere('dispute.disputeType = :disputeType', { disputeType });
    }

    if (projectId) {
      qb.andWhere('dispute.projectId = :projectId', { projectId });
    }

    if (raisedById) {
      qb.andWhere('dispute.raisedById = :raisedById', { raisedById });
    }

    if (defendantId) {
      qb.andWhere('dispute.defendantId = :defendantId', { defendantId });
    }

    if (assignedStaffId) {
      qb.andWhere('dispute.assignedStaffId = :assignedStaffId', { assignedStaffId });
    } else if (unassignedOnly) {
      qb.andWhere('dispute.assignedStaffId IS NULL');
    }

    // Date filters
    if (createdFrom) {
      qb.andWhere('dispute.createdAt >= :createdFrom', { createdFrom: new Date(createdFrom) });
    }

    if (createdTo) {
      qb.andWhere('dispute.createdAt <= :createdTo', { createdTo: new Date(createdTo) });
    }

    if (deadlineBefore) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineBefore', {
        deadlineBefore: new Date(deadlineBefore),
      });
    }

    if (deadlineFrom) {
      qb.andWhere('dispute.resolutionDeadline >= :deadlineFrom', {
        deadlineFrom: new Date(deadlineFrom),
      });
    }

    if (deadlineTo) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineTo', {
        deadlineTo: new Date(deadlineTo),
      });
    }

    if (minDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount >= :minDisputedAmount', { minDisputedAmount });
    }

    if (maxDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount <= :maxDisputedAmount', { maxDisputedAmount });
    }

    // Special filters
    const now = new Date();
    if (overdueOnly) {
      qb.andWhere('dispute.resolutionDeadline < :now', { now });
      qb.andWhere('dispute.status NOT IN (:...resolvedStatuses)', {
        resolvedStatuses: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED],
      });
    }

    if (urgentOnly) {
      const urgentThreshold = new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000);
      qb.andWhere('dispute.resolutionDeadline BETWEEN :now AND :urgentThreshold', {
        now,
        urgentThreshold,
      });
      qb.andWhere('dispute.status NOT IN (:...resolvedStatuses)', {
        resolvedStatuses: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED],
      });
    }

    if (appealed === true) {
      qb.andWhere('dispute.isAppealed = true');
    }

    if (search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('dispute.reason ILIKE :search', { search: `%${search}%` })
            .orWhere('dispute.adminComment ILIKE :search', { search: `%${search}%` })
            .orWhere('dispute.messages ILIKE :search', { search: `%${search}%` });
        }),
      );
    }

    // === SMART SORTING ===
    if (sortBy === DisputeSortBy.URGENCY) {
      // Custom urgency scoring: priority + deadline proximity
      // Disputes CRITICAL + sắp hết hạn lên đầu
      const priorityScoreSql = `CASE 
          WHEN dispute.priority = 'CRITICAL' THEN 4
          WHEN dispute.priority = 'HIGH' THEN 3
          WHEN dispute.priority = 'MEDIUM' THEN 2
          ELSE 1
        END`;

      const deadlineScoreSql = `CASE 
          WHEN dispute.resolutionDeadline < NOW() THEN 100
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '24 hours' THEN 50
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '48 hours' THEN 25
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '7 days' THEN 10
          ELSE 0
        END`;

      const urgencyScoreSql = `(${priorityScoreSql}) + (${deadlineScoreSql})`;
      const urgencyScoreAlias = 'urgencyscore';

      qb.addSelect(urgencyScoreSql, urgencyScoreAlias);

      // Sort by combined urgency (higher = more urgent)
      qb.orderBy('dispute.status', 'ASC') // OPEN, IN_MEDIATION first
        .addOrderBy(urgencyScoreAlias, 'DESC')
        .addOrderBy('dispute.createdAt', 'DESC');
    } else {
      // Standard sorting
      const orderDirection = sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';

      switch (sortBy) {
        case DisputeSortBy.PRIORITY:
          qb.orderBy(
            `CASE 
              WHEN dispute.priority = 'CRITICAL' THEN 1
              WHEN dispute.priority = 'HIGH' THEN 2
              WHEN dispute.priority = 'MEDIUM' THEN 3
              ELSE 4
            END`,
            orderDirection === 'DESC' ? 'ASC' : 'DESC', // CRITICAL first when DESC
          );
          break;
        case DisputeSortBy.DEADLINE:
          qb.orderBy('dispute.resolutionDeadline', orderDirection, 'NULLS LAST');
          break;
        case DisputeSortBy.DISPUTED_AMOUNT:
          qb.orderBy('dispute.disputedAmount', orderDirection, 'NULLS LAST');
          break;
        default:
          qb.orderBy(`dispute.${sortBy}`, orderDirection);
      }
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const data = await qb.getMany();

    // Enhance data with computed fields
    const enhancedData = data.map((dispute) => ({
      ...dispute,
      isOverdue: dispute.resolutionDeadline && dispute.resolutionDeadline < now,
      isUrgent:
        dispute.resolutionDeadline &&
        dispute.resolutionDeadline > now &&
        dispute.resolutionDeadline <
          new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000),
      hoursUntilDeadline: dispute.resolutionDeadline
        ? Math.round((dispute.resolutionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60))
        : null,
    }));

    // Calculate stats (for admin dashboard)
    const stats = await this.getDisputeStats();

    return {
      data: enhancedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      stats,
    };
  }

  /**
   * Lấy disputes liên quan đến user (tôi kiện / kiện tôi / project của tôi)
   */
  async getMyDisputes(
    userId: string,
    filters: DisputeFilterDto = {},
  ): Promise<PaginatedDisputesResponse> {
    const { asRaiser, asDefendant, asInvolved, ...restFilters } = filters;

    // Nếu không chỉ định role cụ thể, lấy tất cả disputes liên quan
    if (!asRaiser && !asDefendant && !asInvolved) {
      filters.asInvolved = true;
    }

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoin('dispute.raiser', 'raiser')
      .leftJoin('dispute.defendant', 'defendant')
      .leftJoin('dispute.project', 'project')
      .addSelect([
        'raiser.id',
        'raiser.fullName',
        'raiser.email',
        'defendant.id',
        'defendant.fullName',
        'defendant.email',
        'project.id',
        'project.title',
      ]);

    // Build WHERE clause based on user's role in disputes
    qb.andWhere(
      new Brackets((sub) => {
        if (asRaiser || filters.asInvolved) {
          sub.orWhere('dispute.raisedById = :userId', { userId });
        }
        if (asDefendant || filters.asInvolved) {
          sub.orWhere('dispute.defendantId = :userId', { userId });
        }
        if (filters.asInvolved) {
          // Also include disputes where user is involved in the project (e.g., as broker)
          sub.orWhere('project.clientId = :userId', { userId });
          sub.orWhere('project.freelancerId = :userId', { userId });
          sub.orWhere('project.brokerId = :userId', { userId });
        }
      }),
    );

    // Apply remaining filters
    return this.applyFiltersAndPaginate(qb, restFilters);
  }

  /**
   * Lấy thống kê disputes cho dashboard
   */
  async getDisputeStats(): Promise<{
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    urgent: number;
  }> {
    const cached = this.disputeStatsCache;
    const nowMs = Date.now();
    if (cached && cached.expiresAt > nowMs) {
      return cached.value;
    }

    const now = new Date();
    const urgentThreshold = new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000);

    const [byStatus, byPriority, overdue, urgent] = await Promise.all([
      // By status
      this.disputeRepo
        .createQueryBuilder('d')
        .select('d.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('d.status')
        .getRawMany(),

      // By priority (only active disputes)
      this.disputeRepo
        .createQueryBuilder('d')
        .select('d.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('d.status NOT IN (:...resolved)', {
          resolved: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED],
        })
        .groupBy('d.priority')
        .getRawMany(),

      // Overdue count
      this.disputeRepo.count({
        where: {
          resolutionDeadline: LessThan(now),
          status: Not(In([DisputeStatus.RESOLVED, DisputeStatus.REJECTED])),
        },
      }),

      // Urgent count (< 48h)
      this.disputeRepo.count({
        where: {
          resolutionDeadline: Between(now, urgentThreshold),
          status: Not(In([DisputeStatus.RESOLVED, DisputeStatus.REJECTED])),
        },
      }),
    ]);

    const stats = {
      byStatus: (byStatus as Array<{ status: string; count: string }>).reduce(
        (acc, { status, count }) => ({ ...acc, [status]: Number(count) }),
        {} as Record<string, number>,
      ),
      byPriority: (byPriority as Array<{ priority: string; count: string }>).reduce(
        (acc, { priority, count }) => ({ ...acc, [priority]: Number(count) }),
        {} as Record<string, number>,
      ),
      overdue,
      urgent,
    };

    this.disputeStatsCache = {
      value: stats,
      expiresAt: nowMs + this.disputeStatsTtlMs,
    };

    return stats;
  }

  /**
   * Helper: Apply filters and paginate to QueryBuilder
   */
  private async applyFiltersAndPaginate(
    qb: SelectQueryBuilder<DisputeEntity>,
    filters: Omit<DisputeFilterDto, 'asRaiser' | 'asDefendant' | 'asInvolved'>,
  ): Promise<PaginatedDisputesResponse> {
    const {
      page = 1,
      limit = 20,
      sortBy = DisputeSortBy.URGENCY,
      sortOrder = SortOrder.DESC,
      status,
      statusIn,
      category,
      priority,
      assignedStaffId,
      unassignedOnly,
      createdFrom,
      createdTo,
      deadlineBefore,
      deadlineFrom,
      deadlineTo,
      minDisputedAmount,
      maxDisputedAmount,
    } = filters;

    if (statusIn && statusIn.length > 0) {
      qb.andWhere('dispute.status IN (:...statusIn)', { statusIn });
    } else if (status) {
      qb.andWhere('dispute.status = :status', { status });
    }
    if (category) qb.andWhere('dispute.category = :category', { category });
    if (priority) qb.andWhere('dispute.priority = :priority', { priority });
    if (assignedStaffId) {
      qb.andWhere('dispute.assignedStaffId = :assignedStaffId', { assignedStaffId });
    } else if (unassignedOnly) {
      qb.andWhere('dispute.assignedStaffId IS NULL');
    }
    if (createdFrom) {
      qb.andWhere('dispute.createdAt >= :createdFrom', { createdFrom: new Date(createdFrom) });
    }
    if (createdTo) {
      qb.andWhere('dispute.createdAt <= :createdTo', { createdTo: new Date(createdTo) });
    }
    if (deadlineBefore) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineBefore', {
        deadlineBefore: new Date(deadlineBefore),
      });
    }
    if (deadlineFrom) {
      qb.andWhere('dispute.resolutionDeadline >= :deadlineFrom', {
        deadlineFrom: new Date(deadlineFrom),
      });
    }
    if (deadlineTo) {
      qb.andWhere('dispute.resolutionDeadline <= :deadlineTo', {
        deadlineTo: new Date(deadlineTo),
      });
    }
    if (minDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount >= :minDisputedAmount', { minDisputedAmount });
    }
    if (maxDisputedAmount !== undefined) {
      qb.andWhere('dispute.disputedAmount <= :maxDisputedAmount', { maxDisputedAmount });
    }

    // Sorting
    if (sortBy === DisputeSortBy.URGENCY) {
      qb.orderBy('dispute.resolutionDeadline', 'ASC', 'NULLS LAST')
        .addOrderBy('dispute.priority', 'DESC')
        .addOrderBy('dispute.createdAt', 'DESC');
    } else {
      qb.orderBy(`dispute.${sortBy}`, sortOrder);
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const now = new Date();
    const enhancedData = data.map((dispute: DisputeEntity) => ({
      ...dispute,
      isOverdue: dispute.resolutionDeadline && dispute.resolutionDeadline < now,
      isUrgent:
        dispute.resolutionDeadline &&
        dispute.resolutionDeadline > now &&
        dispute.resolutionDeadline <
          new Date(now.getTime() + URGENT_THRESHOLD_HOURS * 60 * 60 * 1000),
    }));

    return {
      data: enhancedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getDetail(disputeId: string) {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);
    }
    return dispute;
  }

  async escalateToMediation(staffId: string, disputeId: string): Promise<DisputeEntity> {
    const staff = await this.userRepo.findOne({
      where: { id: staffId },
      select: ['id', 'role'],
    });
    if (!staff) {
      throw new NotFoundException('User not found');
    }
    if (![UserRole.STAFF, UserRole.ADMIN].includes(staff.role)) {
      throw new ForbiddenException('Only staff or admin can accept disputes');
    }

    return await this.dataSource.transaction(async (manager) => {
      const disputeRepo = manager.getRepository(DisputeEntity);
      const activityRepo = manager.getRepository(DisputeActivityEntity);

      const dispute = await disputeRepo.findOne({
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
        throw new BadRequestException(`Cannot accept dispute in status ${dispute.status}`);
      }

      const previousStatus = dispute.status;
      const wasAssigned = Boolean(dispute.assignedStaffId);
      if (dispute.assignedStaffId && dispute.assignedStaffId !== staffId && staff.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Dispute is already assigned to another staff member');
      }

      const now = new Date();
      if (!dispute.assignedStaffId) {
        dispute.assignedStaffId = staffId;
        dispute.assignedAt = now;
      }

      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.IN_MEDIATION);
      const updated = await disputeRepo.save(dispute);

      await activityRepo.save(
        activityRepo.create({
          disputeId: dispute.id,
          actorId: staff.id,
          actorRole: staff.role,
          action: DisputeAction.REVIEW_ACCEPTED,
          description: 'Dispute accepted for mediation',
          metadata: {
            previousStatus,
            assignedStaffId: dispute.assignedStaffId,
          },
        }),
      );

      if (!wasAssigned && dispute.assignedStaffId) {
        this.eventEmitter.emit(DISPUTE_EVENTS.ASSIGNED, {
          disputeId: dispute.id,
          staffId: dispute.assignedStaffId,
          assignedAt: now,
        });
      }

      this.eventEmitter.emit(DISPUTE_EVENTS.ESCALATED, {
        disputeId: dispute.id,
        adminId: staff.id,
      });

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId: dispute.id,
        previousStatus,
        newStatus: updated.status,
      });

      return updated;
    });
  }

  async escalateToHearing(
    disputeId: string,
    triggeredById: string,
  ): Promise<{
    manualRequired: boolean;
    reason?: string;
    hearingId?: string;
    scheduledAt?: Date;
  }> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'status', 'assignedStaffId', 'raisedById'],
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
      return { manualRequired: true, reason: 'Dispute already closed' };
    }

    const existing = await this.hearingRepo.findOne({
      where: {
        disputeId: dispute.id,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS]),
      },
      select: ['id', 'scheduledAt'],
    });
    if (existing) {
      return {
        manualRequired: false,
        hearingId: existing.id,
        scheduledAt: existing.scheduledAt,
      };
    }

    let moderatorId = dispute.assignedStaffId;
    if (!moderatorId) {
      const assignment = await this.autoAssignStaff(dispute.id);
      if (assignment?.staffId) {
        moderatorId = assignment.staffId;
      }
    }

    if (!moderatorId) {
      const triggeredUser = await this.userRepo.findOne({
        where: { id: triggeredById },
        select: ['id', 'role'],
      });
      if (triggeredUser && [UserRole.STAFF, UserRole.ADMIN].includes(triggeredUser.role)) {
        moderatorId = triggeredUser.id;
      }
    }

    if (!moderatorId) {
      return { manualRequired: true, reason: 'No staff available to moderate hearing' };
    }

    const participantsResult = await this.hearingService.determineRequiredParticipants(
      dispute.id,
      HearingTier.TIER_1,
      moderatorId,
    );
    const participantIds = participantsResult.participants.map((p) => p.userId);

    if (participantIds.length === 0) {
      return { manualRequired: true, reason: 'No participants available for hearing' };
    }

    const complexity = await this.staffAssignmentService
      .estimateDisputeComplexity(dispute.id)
      .catch(() => null);
    const durationMinutes =
      complexity?.timeEstimation?.recommendedMinutes ?? DEFAULT_HEARING_DURATION_MINUTES;

    const rangeStart = new Date(
      Date.now() + DEFAULT_HEARING_MIN_NOTICE_HOURS * 60 * 60 * 1000,
    );
    const rangeEnd = this.addDays(rangeStart, DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS);

    const userTimezones = await this.resolveUserTimezones(participantIds);
    const slotsResult = await this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes,
      dateRange: { start: rangeStart, end: rangeEnd },
      userTimezones,
    });

    if (!slotsResult.slots.length) {
      this.logger.warn(
        `Auto-schedule failed for dispute ${dispute.id}: ${slotsResult.noSlotsReason || 'no slots'}`,
      );
      return { manualRequired: true, reason: slotsResult.noSlotsReason };
    }

    const selected = slotsResult.slots[0];
    const hearing = await this.hearingService.scheduleHearing(
      {
        disputeId: dispute.id,
        scheduledAt: selected.start.toISOString(),
        estimatedDurationMinutes: durationMinutes,
        tier: HearingTier.TIER_1,
      },
      moderatorId,
    );

    return {
      manualRequired: false,
      hearingId: hearing.hearing.id,
      scheduledAt: hearing.hearing.scheduledAt,
    };
  }

  async updateDisputes(userId: string, disputeId: string, dto: UpdateDisputeDto) {
    const { message, evidence } = dto;

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId, status: Not(In([DisputeStatus.REJECTED, DisputeStatus.RESOLVED])) },
    });

    // Check dispute exists FIRST
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Then check authorization
    if (userId !== dispute.defendantId && userId !== dispute.raisedById) {
      throw new BadRequestException('You are not authorized to perform this action');
    }

    if (!message && (!evidence || evidence.length === 0)) {
      throw new BadRequestException('Request body cannot be empty');
    }

    if (message) {
      dispute.messages = message;
    }

    if (evidence) {
      const existingEvidence = dispute.evidence || [];

      const newEvidence = [...new Set([...existingEvidence, ...evidence])];

      dispute.evidence = newEvidence;
    }
    const now = new Date();
    let infoProvided = false;
    if (
      dispute.status === DisputeStatus.INFO_REQUESTED &&
      userId === dispute.raisedById
    ) {
      dispute.status = DisputeStateMachine.transition(
        dispute.status,
        DisputeStatus.PENDING_REVIEW,
      );
      dispute.infoProvidedAt = now;
      infoProvided = true;
    }

    const savedDispute = await this.disputeRepo.save(dispute);
    if (infoProvided) {
      await this.activityRepo.save(
        this.activityRepo.create({
          disputeId,
          actorId: userId,
          actorRole: userId === dispute.raisedById ? dispute.raiserRole : dispute.defendantRole,
          action: DisputeAction.INFO_PROVIDED,
          description: 'Additional info submitted for review',
          metadata: { messageProvided: Boolean(message), evidenceCount: evidence?.length || 0 },
        }),
      );
      this.eventEmitter.emit(DISPUTE_EVENTS.INFO_PROVIDED, {
        disputeId,
        userId,
        providedAt: now,
      });
    }
    return savedDispute;
  }

  // =============================================================================
  // MESSAGE SERVICE (LIVE CHAT)
  // =============================================================================

  private checkMessageRateLimit(
    disputeId: string,
    userId: string,
  ): { allowed: boolean; retryAfterSeconds?: number; reason?: string } {
    const key = `${disputeId}:${userId}`;
    const nowMs = Date.now();
    const state = this.messageRateLimit.get(key) || {
      lastMessageAtMs: 0,
      windowStartMs: nowMs,
      countInWindow: 0,
      blockedUntilMs: undefined,
    };

    if (state.blockedUntilMs && nowMs < state.blockedUntilMs) {
      const retryAfterSeconds = Math.ceil((state.blockedUntilMs - nowMs) / 1000);
      return {
        allowed: false,
        retryAfterSeconds,
        reason: 'Too many messages. Please wait before sending again.',
      };
    }

    if (
      state.lastMessageAtMs &&
      nowMs - state.lastMessageAtMs < MESSAGE_RATE_LIMIT.MIN_INTERVAL_MS
    ) {
      state.blockedUntilMs = nowMs + MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS;
      this.messageRateLimit.set(key, state);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS / 1000),
        reason: 'Message rate limit exceeded. Please slow down.',
      };
    }

    if (nowMs - state.windowStartMs > 60 * 1000) {
      state.windowStartMs = nowMs;
      state.countInWindow = 0;
    }

    state.countInWindow += 1;
    if (state.countInWindow > MESSAGE_RATE_LIMIT.MAX_PER_MINUTE) {
      state.blockedUntilMs = nowMs + MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS;
      this.messageRateLimit.set(key, state);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(MESSAGE_RATE_LIMIT.BLOCK_DURATION_MS / 1000),
        reason: 'Message rate limit exceeded. Please wait before sending again.',
      };
    }

    state.lastMessageAtMs = nowMs;
    this.messageRateLimit.set(key, state);

    return { allowed: true };
  }

  private getPhaseLabel(phase: DisputePhase): string {
    switch (phase) {
      case DisputePhase.PRESENTATION:
        return 'Presentation';
      case DisputePhase.CROSS_EXAMINATION:
        return 'Cross-examination';
      case DisputePhase.INTERROGATION:
        return 'Interrogation';
      case DisputePhase.DELIBERATION:
        return 'Deliberation';
      default:
        return 'Presentation';
    }
  }

  private getPhaseAccess(
    phase: DisputePhase,
    senderId: string,
    dispute: DisputeEntity,
  ): { allowed: boolean; reason?: string } {
    const isRaiser = dispute.raisedById === senderId;
    const isDefendant = dispute.defendantId === senderId;

    switch (phase) {
      case DisputePhase.PRESENTATION:
        return isRaiser
          ? { allowed: true }
          : { allowed: false, reason: 'Only the raiser can speak in the presentation phase.' };
      case DisputePhase.CROSS_EXAMINATION:
        return isDefendant
          ? { allowed: true }
          : {
              allowed: false,
              reason: 'Only the defendant can speak in the cross-examination phase.',
            };
      case DisputePhase.INTERROGATION:
        return {
          allowed: false,
          reason: 'Only staff or admin can speak in the interrogation phase.',
        };
      case DisputePhase.DELIBERATION:
        return {
          allowed: false,
          reason: 'Chat is locked during deliberation.',
        };
      default:
        return { allowed: true };
    }
  }

  private async logSystemMessage(
    disputeId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<DisputeMessageEntity> {
    const message = this.messageRepo.create({
      disputeId,
      senderId: null,
      senderRole: 'SYSTEM',
      type: MessageType.SYSTEM_LOG,
      content,
      metadata,
    });

    const savedMessage = await this.messageRepo.save(message);

    this.eventEmitter.emit(
      DISPUTE_EVENTS.MESSAGE_SENT,
      await this.buildMessageEventPayload(savedMessage),
    );

    return savedMessage;
  }

  async sendDisputeMessage(
    dto: SendDisputeMessageDto,
    senderId: string,
    senderRole: UserRole,
  ): Promise<DisputeMessageEntity> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: dto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
      throw new BadRequestException('Cannot send messages to a closed dispute');
    }

    const phase = dispute.phase ?? DisputePhase.PRESENTATION;
    const isSystemType = [MessageType.SYSTEM_LOG, MessageType.ADMIN_ANNOUNCEMENT].includes(
      dto.type,
    );
    if (phase === DisputePhase.DELIBERATION && !isSystemType) {
      throw new ForbiddenException('Chat is locked during deliberation.');
    }

    const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(senderRole);
    const isParty = dispute.raisedById === senderId || dispute.defendantId === senderId;
    let isHearingParticipant = false;

    if (dto.hearingId) {
      const chatPermission = await this.hearingService.getChatPermission(dto.hearingId, senderId);
      if (!chatPermission.allowed) {
        throw new ForbiddenException(chatPermission.reason);
      }
      if (chatPermission.hearing.disputeId !== dispute.id) {
        throw new BadRequestException('Hearing does not belong to this dispute');
      }
      isHearingParticipant = true;
    }

    if (!isStaffOrAdmin && !isParty && !isHearingParticipant) {
      throw new ForbiddenException('You are not allowed to send messages in this dispute');
    }

    if (
      [MessageType.SYSTEM_LOG, MessageType.ADMIN_ANNOUNCEMENT].includes(dto.type) &&
      !isStaffOrAdmin
    ) {
      throw new ForbiddenException('Only staff or admin can send this message type');
    }

    if (!isStaffOrAdmin) {
      const access = this.getPhaseAccess(phase, senderId, dispute);
      if (!access.allowed) {
        throw new ForbiddenException(access.reason || 'You cannot send messages in this phase.');
      }

      const lockStatus = await this.settlementService.checkChatLockStatus(dispute.id, senderId);
      if (lockStatus.isLocked) {
        throw new ForbiddenException(lockStatus.reason || 'Chat is locked');
      }
    }

    if (dto.type === MessageType.TEXT) {
      if (!dto.content || dto.content.trim().length === 0) {
        throw new BadRequestException('Message content is required');
      }
    } else if (!dto.content && !dto.metadata && !dto.relatedEvidenceId) {
      throw new BadRequestException('Message content or metadata is required');
    }

    if (dto.type === MessageType.EVIDENCE_LINK && !dto.relatedEvidenceId) {
      throw new BadRequestException('relatedEvidenceId is required for evidence links');
    }

    const rateLimit = this.checkMessageRateLimit(dispute.id, senderId);
    if (!rateLimit.allowed) {
      throw new BadRequestException({
        message: rateLimit.reason,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    if (dto.replyToMessageId) {
      const replyTarget = await this.messageRepo.findOne({
        where: { id: dto.replyToMessageId },
      });

      if (!replyTarget || replyTarget.disputeId !== dispute.id) {
        throw new BadRequestException('Reply message not found in this dispute');
      }

      if (dto.hearingId || replyTarget.hearingId) {
        if (dto.hearingId !== replyTarget.hearingId) {
          throw new BadRequestException('Reply message must belong to the same hearing');
        }
      }
    }

    if (dto.relatedEvidenceId) {
      const evidence = await this.evidenceRepo.findOne({
        where: { id: dto.relatedEvidenceId, disputeId: dispute.id },
      });
      if (!evidence) {
        throw new BadRequestException('Evidence not found in this dispute');
      }
    }

    const message = this.messageRepo.create({
      disputeId: dispute.id,
      senderId,
      senderRole,
      type: dto.type,
      content: dto.content?.trim(),
      replyToMessageId: dto.replyToMessageId,
      relatedEvidenceId: dto.relatedEvidenceId,
      hearingId: dto.hearingId,
      metadata: dto.metadata,
    });

    const savedMessage = await this.messageRepo.save(message);

    this.eventEmitter.emit(
      DISPUTE_EVENTS.MESSAGE_SENT,
      await this.buildMessageEventPayload(savedMessage),
    );

    return savedMessage;
  }

  async getDisputeMessages(
    disputeId: string,
    userId: string,
    userRole: UserRole,
    options: { hearingId?: string; limit?: number; includeHidden?: boolean } = {},
  ): Promise<DisputeMessageEntity[]> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'raisedById', 'defendantId', 'assignedStaffId', 'escalatedToAdminId'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(userRole);
    const isParty = userId === dispute.raisedById || userId === dispute.defendantId;
    const isAssignedStaff = userRole === UserRole.STAFF && userId === dispute.assignedStaffId;
    const isEscalatedAdmin = userId === dispute.escalatedToAdminId;

    if (!isStaffOrAdmin && !isParty && !isAssignedStaff && !isEscalatedAdmin) {
      throw new ForbiddenException('You are not allowed to view messages for this dispute');
    }

    if (options.hearingId) {
      const hearing = await this.hearingRepo.findOne({
        where: { id: options.hearingId },
        select: ['id', 'disputeId'],
      });
      if (!hearing || hearing.disputeId !== dispute.id) {
        throw new BadRequestException('Hearing does not belong to this dispute');
      }
    }

    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 200) : 50;

    const qb = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.disputeId = :disputeId', { disputeId })
      .orderBy('message.createdAt', 'ASC')
      .take(limit);

    if (options.hearingId) {
      qb.andWhere('message.hearingId = :hearingId', { hearingId: options.hearingId });
    }

    if (!isStaffOrAdmin || !options.includeHidden) {
      qb.andWhere('message.isHidden = :isHidden', { isHidden: false });
    }

    return await qb.getMany();
  }

  async updatePhase(
    disputeId: string,
    phase: DisputePhase,
    actorId: string,
    actorRole: UserRole,
  ): Promise<DisputeEntity> {
    if (![UserRole.STAFF, UserRole.ADMIN].includes(actorRole)) {
      throw new ForbiddenException('Only staff or admin can update dispute phase');
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
      throw new BadRequestException('Cannot change phase for a closed dispute');
    }

    const previousPhase = dispute.phase ?? DisputePhase.PRESENTATION;
    if (previousPhase === phase) {
      return dispute;
    }

    dispute.phase = phase;
    const updated = await this.disputeRepo.save(dispute);

    await this.logSystemMessage(dispute.id, `Phase changed to ${this.getPhaseLabel(phase)}.`, {
      previousPhase,
      newPhase: phase,
      updatedById: actorId,
      updatedByRole: actorRole,
    });

    return updated;
  }

  async hideMessage(
    dto: HideMessageDto,
    hiddenById: string,
    hiddenByRole: UserRole,
  ): Promise<DisputeMessageEntity> {
    if (![UserRole.STAFF, UserRole.ADMIN].includes(hiddenByRole)) {
      throw new ForbiddenException('Only staff or admin can hide messages');
    }

    const message = await this.messageRepo.findOne({
      where: { id: dto.messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isHidden) {
      throw new BadRequestException('Message is already hidden');
    }

    if (hiddenByRole === UserRole.STAFF) {
      const dispute = await this.disputeRepo.findOne({
        where: { id: message.disputeId },
        select: ['id', 'assignedStaffId'],
      });

      if (!dispute) {
        throw new NotFoundException('Dispute not found');
      }

      let canModerate = dispute.assignedStaffId === hiddenById;

      if (message.hearingId && !canModerate) {
        const hearing = await this.hearingRepo.findOne({
          where: { id: message.hearingId },
          select: ['id', 'moderatorId'],
        });
        if (hearing?.moderatorId === hiddenById) {
          canModerate = true;
        }
      }

      if (!canModerate) {
        throw new ForbiddenException(
          'Only assigned staff or hearing moderator can hide this message',
        );
      }
    }

    message.isHidden = true;
    message.hiddenReason = dto.hiddenReason;
    message.hiddenById = hiddenById;
    message.hiddenAt = new Date();

    const savedMessage = await this.messageRepo.save(message);

    this.eventEmitter.emit(DISPUTE_EVENTS.MESSAGE_HIDDEN, {
      messageId: savedMessage.id,
      disputeId: savedMessage.disputeId,
      hearingId: savedMessage.hearingId,
      hiddenById: savedMessage.hiddenById,
      hiddenReason: savedMessage.hiddenReason,
      replacementText: 'Tin nhắn đã bị ẩn bởi Admin',
    });

    return savedMessage;
  }

  // =============================================================================
  // HÀM CHÍNH: RESOLVE DISPUTE (All or Nothing Transaction)
  // =============================================================================

  /**
   * 🔥 HÀM KHỔNG LỒ: Resolve Dispute với Database Transaction
   *
   * Flow:
   * 1. Lock records (Pessimistic Lock)
   * 2. Validate state machine
   * 3. Update Dispute status -> RESOLVED
   * 4. Execute money transfers based on verdict
   * 5. Update Project/Milestone status
   * 6. Penalize loser (update totalDisputesLost + recalculate trust score)
   * 7. Create audit log
   * 8. Emit event for real-time notification
   *
   * @throws BadRequestException | NotFoundException | ForbiddenException
   */

  async resolveDispute(
    adminId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
    req?: RequestContext,
  ): Promise<ResolutionResult> {
    await this.ensureLegacyFlowAllowed(disputeId);

    const result = dto.result ?? dto.verdict;
    if (!result) {
      throw new BadRequestException('Verdict is required');
    }

    if (!dto.faultType || !dto.faultyParty || !dto.reasoning) {
      throw new BadRequestException(
        'faultType, faultyParty, and reasoning are required for verdict workflow',
      );
    }

    const adjudicator = await this.userRepo.findOne({
      where: { id: adminId },
      select: ['id', 'role'],
    });
    if (!adjudicator) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);
    }

    const escrow = await this.escrowRepo.findOne({ where: { milestoneId: dispute.milestoneId } });
    if (!escrow) {
      throw new NotFoundException(`Escrow for Milestone "${dispute.milestoneId}" not found`);
    }

    const project = await this.projectRepo.findOne({ where: { id: dispute.projectId } });
    if (!project) {
      throw new NotFoundException(`Project "${dispute.projectId}" not found`);
    }

    const milestone = await this.milestoneRepo.findOne({ where: { id: dispute.milestoneId } });
    if (!milestone) {
      throw new NotFoundException(`Milestone "${dispute.milestoneId}" not found`);
    }

    let amountToFreelancer = dto.amountToFreelancer;
    let amountToClient = dto.amountToClient;

    if (amountToFreelancer == null || amountToClient == null) {
      if (dto.splitRatioClient == null) {
        throw new BadRequestException(
          'amountToFreelancer/amountToClient or splitRatioClient is required',
        );
      }

      const fundedAmount =
        escrow.fundedAmount && escrow.fundedAmount > 0 ? escrow.fundedAmount : escrow.totalAmount;
      const platformFee = escrow.platformFee || 0;
      const remaining = new Decimal(fundedAmount).minus(platformFee);

      if (remaining.lessThan(0)) {
        throw new BadRequestException('Platform fee exceeds funded amount');
      }

      if (result === DisputeResult.WIN_CLIENT) {
        amountToClient = remaining.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
        amountToFreelancer = 0;
      } else if (result === DisputeResult.WIN_FREELANCER) {
        amountToClient = 0;
        amountToFreelancer = remaining.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      } else {
        const clientRatio = new Decimal(dto.splitRatioClient).dividedBy(100);
        amountToClient = remaining
          .times(clientRatio)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
        amountToFreelancer = remaining
          .minus(amountToClient)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }
    }

    const verdictPayload = {
      disputeId,
      result,
      faultType: dto.faultType,
      faultyParty: dto.faultyParty,
      reasoning: dto.reasoning,
      amountToFreelancer,
      amountToClient,
      trustScorePenalty: dto.trustScorePenalty,
      banUser: dto.banUser,
      banDurationDays: dto.banDurationDays,
      warningMessage: dto.warningMessage,
      adminComment: dto.adminComment,
    };

    const verdictResult = await this.verdictService.issueVerdict(
      verdictPayload,
      adjudicator.id,
      adjudicator.role,
    );

    const resolvedDispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!resolvedDispute) {
      throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);
    }

    const { loserId, winnerId } = determineLoser(
      result,
      resolvedDispute.raisedById,
      resolvedDispute.defendantId,
      resolvedDispute.disputeType,
    );

    if (loserId) {
      await this.userWarningService.checkAndFlagAfterDisputeLoss(loserId, disputeId, result);
      if (resolvedDispute.category === DisputeCategory.FRAUD) {
        await this.userWarningService.flagForFraud(
          loserId,
          disputeId,
          `Thua dispute voi category FRAUD: ${dto.adminComment || ''}`.trim() ||
            'Thua dispute voi category FRAUD',
        );
      }
    }

    const walletIds = verdictResult.transfers.map((transfer) => transfer.walletId);
    const wallets = walletIds.length
      ? await this.walletRepo.find({ where: { id: In(walletIds) } })
      : [];
    const walletById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    const transferDetails = verdictResult.transfers.map((transfer): TransferDetail => {
      const wallet = walletById.get(transfer.walletId);
      const type =
        transfer.type === TransactionType.REFUND
          ? 'REFUND'
          : transfer.type === TransactionType.ESCROW_RELEASE
            ? 'RELEASE'
            : 'FEE';
      return {
        toUserId: wallet?.userId ?? '',
        toWalletId: transfer.walletId,
        amount: transfer.amount,
        type,
        description: transfer.description || 'Verdict transfer',
      };
    });

    await this.auditLogsService.logCustom(
      'RESOLVE_DISPUTE',
      'Dispute',
      disputeId,
      {
        verdict: result,
        adminComment: dto.adminComment,
        moneyDistribution: verdictResult.distribution,
        transfers: transferDetails.map((transfer) => ({
          toUserId: transfer.toUserId,
          amount: transfer.amount,
          type: transfer.type,
        })),
        loserId,
        winnerId,
        penaltyApplied: verdictResult.verdict.trustScorePenalty > 0,
        trustScoreUpdate: null,
      },
      req as Record<string, unknown> | undefined,
      adjudicator.id,
    );

    const resolvedEvent: DisputeResolvedEvent = {
      disputeId,
      projectId: project.id,
      verdict: result,
      clientId: project.clientId,
      freelancerId: project.freelancerId,
      brokerId: project.brokerId,
      loserId,
      winnerId,
      moneyDistribution: verdictResult.distribution,
      adminComment: dto.adminComment || dto.reasoning?.conclusion,
      adminId: adjudicator.id,
      resolvedAt: resolvedDispute.resolvedAt,
    };

    this.eventEmitter.emit(DISPUTE_EVENTS.RESOLVED, resolvedEvent);

    return {
      disputeId,
      verdict: result,
      moneyDistribution: verdictResult.distribution,
      transfers: transferDetails,
      loserId,
      winnerId,
      penaltyApplied: verdictResult.verdict.trustScorePenalty > 0,
      projectStatusUpdated: project.status,
      milestoneStatusUpdated: milestone.status,
      escrowStatusUpdated: escrow.status,
      trustScoreUpdated: null,
      resolvedAt: resolvedDispute.resolvedAt,
      adminId: adjudicator.id,
    };
  }

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Tính toán phân chia tiền dựa trên verdict
   */

  private calculateMoneyDistribution(
    verdict: DisputeResult,
    escrow: EscrowEntity,
    splitRatioClient: number = 50,
  ): MoneyDistribution {
    const { totalAmount, developerShare, brokerShare, platformFee } = escrow;

    switch (verdict) {
      case DisputeResult.WIN_CLIENT:
        return {
          clientAmount: totalAmount,
          brokerAmount: 0,
          freelancerAmount: 0,
          platformFee: 0,
          totalAmount,
        };

      case DisputeResult.WIN_FREELANCER:
        // Freelancer thắng: Chia theo tỷ lệ đã định trong Escrow
        return {
          clientAmount: 0,
          freelancerAmount: developerShare,
          brokerAmount: brokerShare,
          platformFee: platformFee,
          totalAmount,
        };

      case DisputeResult.SPLIT: {
        // Chia theo tỷ lệ - SỬ DỤNG DECIMAL.JS cho USD
        const total = new Decimal(totalAmount);
        const clientRatioDecimal = new Decimal(splitRatioClient).dividedBy(100);
        const freelancerRatioDecimal = new Decimal(1).minus(clientRatioDecimal);

        // Phần Client nhận (không mất phí)
        const clientAmount = total
          .times(clientRatioDecimal)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        // Phần Freelancer nhận (chia theo tỷ lệ gốc, có trừ phí)
        const freelancerPortion = total.times(freelancerRatioDecimal);
        const freelancerAmount = freelancerPortion
          .times(new Decimal(escrow.developerPercentage).dividedBy(100))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const brokerAmount = freelancerPortion
          .times(new Decimal(escrow.brokerPercentage).dividedBy(100))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        // Platform fee: phần còn lại sau khi chia freelancer + broker
        // Đảm bảo tổng = totalAmount (tránh lỗi làm tròn)
        const platformFeeAmount = total
          .minus(clientAmount)
          .minus(freelancerAmount)
          .minus(brokerAmount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        return {
          clientAmount: clientAmount.toNumber(),
          freelancerAmount: freelancerAmount.toNumber(),
          brokerAmount: brokerAmount.toNumber(),
          platformFee: platformFeeAmount.toNumber(),
          totalAmount,
        };
      }

      default:
        throw new BadRequestException(`Invalid verdict: ${verdict}`);
    }
  }

  /**
   * Thực hiện chuyển tiền vào các ví
   *
   * 🔥 IMPORTANT: Logic phân chia tiền phụ thuộc vào dispute type:
   * - CLIENT_VS_FREELANCER / FREELANCER_VS_CLIENT: Standard flow
   * - CLIENT_VS_BROKER / BROKER_VS_CLIENT: Client vs Broker
   * - FREELANCER_VS_BROKER / BROKER_VS_FREELANCER: Freelancer vs Broker
   */
  private async executeMoneyTransfers(
    queryRunner: QueryRunner,
    verdict: DisputeResult,
    escrow: EscrowEntity,
    project: ProjectEntity,
    distribution: MoneyDistribution,
    dispute: DisputeEntity, // Thêm dispute để biết dispute type
  ): Promise<
    Array<{
      toUserId: string;
      toWalletId: string;
      amount: number;
      type: string;
      description: string;
      transactionId: string;
    }>
  > {
    const transfers: Array<{
      toUserId: string;
      toWalletId: string;
      amount: number;
      type: string;
      description: string;
      transactionId: string;
    }> = [];

    // Helper function để tạo transaction và cập nhật wallet

    const transferToWallet = async (
      userId: string,
      amount: number,
      type: TransactionType,
      description: string,
    ) => {
      // Skip if amount is zero or negative
      if (amount <= 0) return null;

      const wallet = await queryRunner.manager.findOne(WalletEntity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet for User "${userId}" not found`);
      }

      // Cập nhật balance - SỬ DỤNG DECIMAL.JS cho USD
      wallet.balance = new Decimal(wallet.balance)
        .plus(amount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      if (type === TransactionType.REFUND) {
        // Client nhận refund
        const newHeldBalance = new Decimal(wallet.heldBalance)
          .minus(amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
        wallet.heldBalance = Math.max(0, newHeldBalance);
      } else if (type === TransactionType.ESCROW_RELEASE) {
        // Freelancer/Broker nhận tiền
        wallet.totalEarned = new Decimal(wallet.totalEarned)
          .plus(amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      await queryRunner.manager.save(WalletEntity, wallet);

      // Tạo Transaction record
      const transaction = queryRunner.manager.create(TransactionEntity, {
        walletId: wallet.id,
        amount,
        fee: 0,
        netAmount: amount,
        currency: 'USD',
        type,
        status: TransactionStatus.COMPLETED,
        referenceType: 'Escrow',
        referenceId: escrow.id,
        description,
        metadata: {
          disputeId: escrow.disputeId,
          projectId: project.id,
          verdict,
        },
      });

      const savedTransaction = await queryRunner.manager.save(TransactionEntity, transaction);

      return {
        toUserId: userId,
        toWalletId: wallet.id,
        amount,
        type: type === TransactionType.REFUND ? 'REFUND' : 'RELEASE',
        description,
        transactionId: savedTransaction.id,
      };
    };

    // PERFORMANCE: Build transfer promises array for parallel execution
    type TransferResult = {
      toUserId: string;
      toWalletId: string;
      amount: number;
      type: string;
      description: string;
      transactionId: string;
    };

    const transferPromises: Promise<TransferResult | null>[] = [];

    // =========================================================================
    // SMART TRANSFER ROUTING based on dispute type
    // =========================================================================
    //
    // "clientAmount" trong distribution KHÔNG PHẢI luôn đi đến project.clientId!
    // Nó đi đến "bên thắng kiểu client" dựa trên dispute type.
    //
    // Ví dụ:
    // - CLIENT_VS_FREELANCER + WIN_CLIENT → Client nhận clientAmount ✓
    // - BROKER_VS_FREELANCER + WIN_CLIENT → BROKER nhận (vì broker là "client side" trong dispute này)
    // =========================================================================

    const { clientSideRecipient, freelancerSideRecipient } = this.determineTransferRecipients(
      dispute.disputeType,
      project,
    );

    // Queue transfers based on verdict
    if (distribution.clientAmount > 0) {
      transferPromises.push(
        transferToWallet(
          clientSideRecipient,
          distribution.clientAmount,
          // REFUND nếu là client thật, ESCROW_RELEASE nếu là broker/freelancer đóng vai client side
          clientSideRecipient === project.clientId
            ? TransactionType.REFUND
            : TransactionType.ESCROW_RELEASE,
          `${clientSideRecipient === project.clientId ? 'Refund' : 'Payment'} from Dispute #${escrow.disputeId} - ${verdict}`,
        ),
      );
    }

    if (distribution.freelancerAmount > 0) {
      transferPromises.push(
        transferToWallet(
          freelancerSideRecipient,
          distribution.freelancerAmount,
          TransactionType.ESCROW_RELEASE,
          `Payment from Dispute #${escrow.disputeId} - ${verdict}`,
        ),
      );
    }

    // Broker amount - chỉ khi project có broker VÀ broker không phải là một trong hai bên chính của dispute
    const isDisputeInvolvingBroker = [
      DisputeType.CLIENT_VS_BROKER,
      DisputeType.BROKER_VS_CLIENT,
      DisputeType.FREELANCER_VS_BROKER,
      DisputeType.BROKER_VS_FREELANCER,
    ].includes(dispute.disputeType);

    if (distribution.brokerAmount > 0 && project.brokerId && !isDisputeInvolvingBroker) {
      // Broker chỉ nhận commission nếu không phải bên tranh chấp
      transferPromises.push(
        transferToWallet(
          project.brokerId,
          distribution.brokerAmount,
          TransactionType.ESCROW_RELEASE,
          `Commission from Dispute #${escrow.disputeId} - ${verdict}`,
        ),
      );
    }

    // PERFORMANCE: Execute all transfers in parallel
    const results = await Promise.all(transferPromises);
    transfers.push(...(results.filter(Boolean) as TransferResult[]));

    // Platform fee - chuyển vào ví Platform (có thể là một admin wallet)
    // Tùy vào thiết kế hệ thống, có thể bỏ qua hoặc tạo wallet riêng
    if (distribution.platformFee > 0) {
      this.logger.log(`[MoneyTransfer] Platform Fee: $${distribution.platformFee} USD`);
      // Có thể tạo transaction cho platform wallet ở đây
    }

    return transfers;
  }

  private async checkDismissalRateAndFlag(staffId: string): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - DISMISSAL_RATE_SAMPLE_WINDOW_DAYS);

    const [dismissedCount, acceptedCount] = await Promise.all([
      this.activityRepo.count({
        where: {
          actorId: staffId,
          action: DisputeAction.REJECTED,
          timestamp: MoreThan(since),
        },
      }),
      this.activityRepo.count({
        where: {
          actorId: staffId,
          action: DisputeAction.REVIEW_ACCEPTED,
          timestamp: MoreThan(since),
        },
      }),
    ]);

    const totalReviewed = dismissedCount + acceptedCount;
    if (totalReviewed < DISMISSAL_RATE_MIN_SAMPLES) {
      return;
    }

    const dismissalRate = dismissedCount / totalReviewed;
    if (dismissalRate >= DISMISSAL_RATE_ALERT_THRESHOLD) {
      this.eventEmitter.emit('staff.dismissal_rate_high', {
        staffId,
        dismissalRate,
        dismissedCount,
        totalReviewed,
        windowDays: DISMISSAL_RATE_SAMPLE_WINDOW_DAYS,
      });
    }
  }

  async releaseExpiredDismissalHolds(
    asOf: Date = new Date(),
  ): Promise<{ processed: number; released: number }> {
    const disputes = await this.disputeRepo.find({
      where: {
        status: DisputeStatus.REJECTED,
        dismissalHoldUntil: LessThanOrEqual(asOf),
        rejectionAppealedAt: IsNull(),
      },
    });

    if (disputes.length === 0) {
      return { processed: 0, released: 0 };
    }

    let released = 0;
    for (const dispute of disputes) {
      await this.escrowRepo.update(
        { milestoneId: dispute.milestoneId },
        { status: EscrowStatus.FUNDED },
      );
      await this.disputeRepo.update(dispute.id, { dismissalHoldUntil: null });
      released += 1;
      this.eventEmitter.emit(
        'dispute.dismissal_hold_released',
        {
          disputeId: dispute.id,
          releasedAt: asOf,
        },
      );
    }

    return { processed: disputes.length, released };
  }

  /**
   * Log activity vào database (trong transaction)
   */
  private getAllowedMilestoneStatusesForDispute(
    category: DisputeCategory,
  ): MilestoneStatus[] {
    const inProgressLike = [MilestoneStatus.IN_PROGRESS, MilestoneStatus.REVISIONS_REQUIRED];

    switch (category) {
      case DisputeCategory.QUALITY:
        return [MilestoneStatus.SUBMITTED, MilestoneStatus.REVISIONS_REQUIRED];
      case DisputeCategory.DEADLINE:
      case DisputeCategory.COMMUNICATION:
      case DisputeCategory.PAYMENT:
      case DisputeCategory.SCOPE_CHANGE:
      case DisputeCategory.CONTRACT:
      case DisputeCategory.FRAUD:
      case DisputeCategory.OTHER:
      default:
        return [MilestoneStatus.SUBMITTED, ...inProgressLike];
    }
  }

  /**
   * X?c ??nh role c?a user trong project
   */
  private determineUserRole(userId: string, project: ProjectEntity): UserRole {
    if (userId === project.clientId) return UserRole.CLIENT;
    if (userId === project.freelancerId) return UserRole.FREELANCER;
    if (userId === project.brokerId) return UserRole.BROKER;
    throw new BadRequestException('User is not a member of this project');
  }

  /**
   * X?c ??nh lo?i dispute d?a tr?n roles
   */
  private determineDisputeType(raiserRole: UserRole, defendantRole: UserRole): DisputeType {
    const typeMap: Record<string, DisputeType> = {
      CLIENT_FREELANCER: DisputeType.CLIENT_VS_FREELANCER,
      CLIENT_BROKER: DisputeType.CLIENT_VS_BROKER,
      FREELANCER_CLIENT: DisputeType.FREELANCER_VS_CLIENT,
      FREELANCER_BROKER: DisputeType.FREELANCER_VS_BROKER,
      BROKER_CLIENT: DisputeType.BROKER_VS_CLIENT,
      BROKER_FREELANCER: DisputeType.BROKER_VS_FREELANCER,
    };

    const key = `${raiserRole}_${defendantRole}`;
    return typeMap[key] || DisputeType.CLIENT_VS_FREELANCER;
  }

  /**
   * T?nh priority d?a tr?n s? ti?n v? category
   */
  private calculatePriority(
    amount: number,
    category?: DisputeCategory,
    currency: string = 'USD',
  ): DisputePriority {
    if (category === DisputeCategory.FRAUD) {
      return DisputePriority.CRITICAL;
    }

    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const normalizedCurrency = (currency || 'USD').toUpperCase();

    const thresholds =
      normalizedCurrency === 'VND'
        ? { low: 1_000_000, medium: 10_000_000, high: 50_000_000 }
        : { low: 50, medium: 500, high: 2_000 };

    if (safeAmount <= thresholds.low) return DisputePriority.LOW;
    if (safeAmount <= thresholds.medium) return DisputePriority.MEDIUM;
    if (safeAmount <= thresholds.high) return DisputePriority.HIGH;
    return DisputePriority.CRITICAL;
  }

  private async autoAssignStaff(disputeId: string) {
    try {
      return await this.staffAssignmentService.autoAssignStaffToDispute(disputeId);
    } catch (error) {
      this.logger.warn(
        `Auto-assign staff failed for dispute ${disputeId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  private async checkInitialAvailability(
    dispute: DisputeEntity,
    project: ProjectEntity,
    staffId: string,
    durationMinutes?: number,
  ) {
    if (!staffId) {
      return null;
    }

    const participantIds = [dispute.raisedById, dispute.defendantId, staffId].filter(Boolean);
    if (participantIds.length === 0) {
      return null;
    }

    const rangeStart = new Date(
      Date.now() + DEFAULT_HEARING_MIN_NOTICE_HOURS * 60 * 60 * 1000,
    );
    const rangeEnd = this.addDays(rangeStart, DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS);
    const userTimezones = await this.resolveUserTimezones(participantIds);

    return this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes: durationMinutes || DEFAULT_HEARING_DURATION_MINUTES,
      dateRange: { start: rangeStart, end: rangeEnd },
      userTimezones,
    });
  }

  private async resolveUserTimezones(userIds: string[]): Promise<Record<string, string>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return {};
    }

    const users = await this.userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'timeZone'],
    });

    const map: Record<string, string> = {};
    users.forEach((user) => {
      map[user.id] = user.timeZone || 'UTC';
    });

    uniqueIds.forEach((id) => {
      if (!map[id]) {
        map[id] = 'UTC';
      }
    });

    return map;
  }


  private async logActivity(
    queryRunner: QueryRunner,
    disputeId: string,
    actorId: string,
    actorRole: UserRole,
    action: DisputeAction,
    description: string,
    metadata?: Record<string, unknown>,
    isInternal: boolean = false,
  ): Promise<DisputeActivityEntity> {
    const activity = queryRunner.manager.create(DisputeActivityEntity, {
      disputeId,
      actorId,
      actorRole,
      action,
      description,
      metadata,
      isInternal,
    });
    return queryRunner.manager.save(DisputeActivityEntity, activity);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}
