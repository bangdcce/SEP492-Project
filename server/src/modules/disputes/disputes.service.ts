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
        : [MilestoneStatus.COMPLETED];
      if (!allowedMilestoneStatuses.includes(milestone.status)) {
        throw new BadRequestException('Milestone is not eligible for dispute');
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
      const priority = this.calculatePriority(amount, category);

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
        category: category || DisputeCategory.OTHER,
        priority,
        disputedAmount: amount,
        reason,
        evidence,
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
        { reason, category, disputedAmount: amount, parentDisputeId: parentDisputeId || null },
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const assignment = await this.autoAssignStaff(savedDispute.id);
    const availability = await this.checkInitialAvailability(
      savedDispute,
      project,
      assignment?.staffId || '',
      assignment?.complexity?.timeEstimation?.recommendedMinutes,
    );

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
      category,
      priority,
      disputeType,
      projectId,
      raisedById,
      defendantId,
      createdFrom,
      createdTo,
      deadlineBefore,
      overdueOnly,
      urgentOnly,
      appealed,
      search,
    } = filters;

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.raiser', 'raiser')
      .leftJoinAndSelect('dispute.defendant', 'defendant')
      .leftJoinAndSelect('dispute.project', 'project');

    // === FILTERS ===
    if (status) {
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
      qb.addSelect(
        `CASE 
          WHEN dispute.priority = 'CRITICAL' THEN 4
          WHEN dispute.priority = 'HIGH' THEN 3
          WHEN dispute.priority = 'MEDIUM' THEN 2
          ELSE 1
        END`,
        'priorityScore',
      );

      qb.addSelect(
        `CASE 
          WHEN dispute.resolutionDeadline < NOW() THEN 100
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '24 hours' THEN 50
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '48 hours' THEN 25
          WHEN dispute.resolutionDeadline < NOW() + INTERVAL '7 days' THEN 10
          ELSE 0
        END`,
        'deadlineScore',
      );

      // Sort by combined urgency (higher = more urgent)
      qb.orderBy('dispute.status', 'ASC') // OPEN, IN_MEDIATION first
        .addOrderBy('priorityScore + deadlineScore', 'DESC')
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
      .leftJoinAndSelect('dispute.raiser', 'raiser')
      .leftJoinAndSelect('dispute.defendant', 'defendant')
      .leftJoinAndSelect('dispute.project', 'project');

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

    return {
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
      category,
      priority,
    } = filters;

    if (status) qb.andWhere('dispute.status = :status', { status });
    if (category) qb.andWhere('dispute.category = :category', { category });
    if (priority) qb.andWhere('dispute.priority = :priority', { priority });

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

    this.eventEmitter.emit(DISPUTE_EVENTS.MESSAGE_SENT, {
      messageId: savedMessage.id,
      disputeId: savedMessage.disputeId,
      hearingId: savedMessage.hearingId,
      senderId: savedMessage.senderId,
      senderRole: savedMessage.senderRole,
      type: savedMessage.type,
      createdAt: savedMessage.createdAt,
    });

    return savedMessage;
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
   * Xác định Escrow status dựa trên verdict
   */
  private getEscrowStatusFromVerdict(verdict: DisputeResult): EscrowStatus {
    switch (verdict) {
      case DisputeResult.WIN_CLIENT:
        return EscrowStatus.REFUNDED;
      case DisputeResult.WIN_FREELANCER:
        return EscrowStatus.RELEASED;
      case DisputeResult.SPLIT:
        // Có thể thêm status RESOLVED cho Escrow nếu cần
        return EscrowStatus.RELEASED; // Hoặc tạo mới: EscrowStatus.RESOLVED
      default:
        return EscrowStatus.DISPUTED;
    }
  }

  /**
   * 🔥 CRITICAL: Xác định ai nhận tiền dựa trên dispute type
   *
   * Trong dispute, có 2 "sides":
   * - Client Side: Người đứng về phía "client" (có thể là client, hoặc broker trong BROKER_VS_FREELANCER)
   * - Freelancer Side: Người đứng về phía "freelancer"
   *
   * WIN_CLIENT → Client Side nhận tiền
   * WIN_FREELANCER → Freelancer Side nhận tiền
   */
  private determineTransferRecipients(
    disputeType: DisputeType,
    project: ProjectEntity,
  ): { clientSideRecipient: string; freelancerSideRecipient: string } {
    switch (disputeType) {
      // Client là "client side", Freelancer là "freelancer side" - STANDARD
      case DisputeType.CLIENT_VS_FREELANCER:
      case DisputeType.FREELANCER_VS_CLIENT:
        return {
          clientSideRecipient: project.clientId,
          freelancerSideRecipient: project.freelancerId,
        };

      // Client là "client side", Broker là "freelancer side"
      case DisputeType.CLIENT_VS_BROKER:
      case DisputeType.BROKER_VS_CLIENT:
        return {
          clientSideRecipient: project.clientId,
          freelancerSideRecipient: project.brokerId, // Broker nhận phần "freelancer"
        };

      // Freelancer là "client side" (bên kiện), Broker là "freelancer side" (bị kiện)
      case DisputeType.FREELANCER_VS_BROKER:
        return {
          clientSideRecipient: project.freelancerId, // Freelancer đóng vai "client side"
          freelancerSideRecipient: project.brokerId,
        };

      // Broker là "client side" (bên kiện), Freelancer là "freelancer side" (bị kiện)
      case DisputeType.BROKER_VS_FREELANCER:
        return {
          clientSideRecipient: project.brokerId, // Broker đóng vai "client side"
          freelancerSideRecipient: project.freelancerId,
        };

      // Default: Standard client vs freelancer
      default:
        return {
          clientSideRecipient: project.clientId,
          freelancerSideRecipient: project.freelancerId,
        };
    }
  }

  /**
   * Xác định Project/Milestone status dựa trên verdict
   */
  private getProjectMilestoneStatus(verdict: DisputeResult): {
    newProjectStatus: ProjectStatus;
    newMilestoneStatus: MilestoneStatus;
  } {
    switch (verdict) {
      case DisputeResult.WIN_CLIENT:
        // Client thắng = Hủy dự án
        return {
          newProjectStatus: ProjectStatus.CANCELED,
          newMilestoneStatus: MilestoneStatus.PENDING, // Hoặc tạo status CANCELLED
        };

      case DisputeResult.WIN_FREELANCER:
        // Freelancer thắng = Ép nhận hàng
        return {
          newProjectStatus: ProjectStatus.COMPLETED,
          newMilestoneStatus: MilestoneStatus.PAID,
        };

      case DisputeResult.SPLIT:
        // Hòa giải = Completed với điều khoản
        return {
          newProjectStatus: ProjectStatus.COMPLETED,
          newMilestoneStatus: MilestoneStatus.PAID,
        };

      default:
        throw new BadRequestException(`Invalid verdict: ${verdict}`);
    }
  }

  // =============================================================================
  // ESCALATE TO MEDIATION (Chuyển từ OPEN -> IN_MEDIATION)
  // =============================================================================

  async escalateToMediation(adminId: string, disputeId: string): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });

    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if (dispute.status === DisputeStatus.REJECTION_APPEALED) {
      throw new BadRequestException(
        'Dismissal appeal must be resolved by admin before mediation.',
      );
    }

    if (!DisputeStateMachine.canTransition(dispute.status, DisputeStatus.IN_MEDIATION)) {
      throw new BadRequestException(
        `Dispute is in "${dispute.status}" status and cannot be escalated`,
      );
    }

    const reviewer = await this.userRepo.findOne({
      where: { id: adminId },
      select: ['id', 'role'],
    });
    if (!reviewer) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    const previousStatus = dispute.status;
    dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.IN_MEDIATION);
    const saved = await this.disputeRepo.save(dispute);
    const now = new Date();

    const isReviewAcceptance = [
      DisputeStatus.OPEN,
      DisputeStatus.PENDING_REVIEW,
      DisputeStatus.INFO_REQUESTED,
    ].includes(previousStatus);

    if (isReviewAcceptance) {
      await this.activityRepo.save(
        this.activityRepo.create({
          disputeId,
          actorId: adminId,
          actorRole: reviewer.role,
          action: DisputeAction.REVIEW_ACCEPTED,
          description:
            previousStatus === DisputeStatus.INFO_REQUESTED
              ? 'Additional info accepted for mediation'
              : 'Preliminary review accepted',
          metadata: { fromStatus: previousStatus },
        }),
      );
    }

    // Emit event
    this.eventEmitter.emit(DISPUTE_EVENTS.ESCALATED, {
      disputeId,
      adminId,
      fromStatus: previousStatus,
      escalatedAt: now,
    });

    return saved;
  }
  // =============================================================================
  // REQUEST ADDITIONAL INFO (Preliminary Review)
  // =============================================================================

  async requestAdditionalInfo(
    adminId: string,
    disputeId: string,
    reason: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });

    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if (!DisputeStateMachine.canTransition(dispute.status, DisputeStatus.INFO_REQUESTED)) {
      throw new BadRequestException(
        `Dispute is in "${dispute.status}" status and cannot request info`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Reason for information request is required');
    }

    const reviewer = await this.userRepo.findOne({
      where: { id: adminId },
      select: ['id', 'role'],
    });
    if (!reviewer) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    const now = new Date();
    dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.INFO_REQUESTED);
    dispute.infoRequestReason = reason.trim();
    dispute.infoRequestedById = adminId;
    dispute.infoRequestedAt = now;
    dispute.infoProvidedAt = null;

    const saved = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: adminId,
        actorRole: reviewer.role,
        action: DisputeAction.INFO_REQUESTED,
        description: `Additional info requested: ${reason.trim().substring(0, 120)}`,
        metadata: { reason: reason.trim() },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.INFO_REQUESTED, {
      disputeId,
      adminId,
      reason: reason.trim(),
      requestedAt: now,
    });

    return saved;
  }

  // =============================================================================
  // REJECT DISPUTE (Từ chối Dispute không hợp lệ)
  // =============================================================================

  async rejectDispute(adminId: string, disputeId: string, reason: string): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });

    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if (!DisputeStateMachine.canTransition(dispute.status, DisputeStatus.REJECTED)) {
      throw new BadRequestException(
        `Dispute is in "${dispute.status}" status and cannot be rejected`,
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException("Reason for rejection is required");
    }

    const reviewer = await this.userRepo.findOne({ where: { id: adminId }, select: ['id', 'role'] });
    if (!reviewer) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    const now = new Date();
    const dismissalHoldUntil = new Date(
      now.getTime() + DISMISSAL_HOLD_HOURS * 60 * 60 * 1000,
    );

    // Start transaction to ensure consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.REJECTED);
      dispute.adminComment = reason;
      dispute.resolvedById = adminId;
      dispute.resolvedAt = now;
      dispute.dismissalHoldUntil = dismissalHoldUntil;

      await queryRunner.manager.save(dispute);

      // IMPORTANT: Restore project and milestone status since dispute was invalid
      // Project goes back to IN_PROGRESS (was DISPUTED)
      await queryRunner.manager.update(
        ProjectEntity,
        { id: dispute.projectId },
        {
          status: ProjectStatus.IN_PROGRESS,
        },
      );

      // Milestone goes back to COMPLETED (was LOCKED during dispute)
      await queryRunner.manager.update(
        MilestoneEntity,
        { id: dispute.milestoneId },
        {
          status: MilestoneStatus.COMPLETED,
        },
      );

      // Escrow stays DISPUTED until dismissal hold expires (anti-collusion)
      await queryRunner.manager.update(
        EscrowEntity,
        { milestoneId: dispute.milestoneId },
        {
          status: DISMISSAL_HOLD_HOURS > 0 ? EscrowStatus.DISPUTED : EscrowStatus.FUNDED,
        },
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[RejectDispute] Restored project/milestone and applied hold for Dispute ${disputeId}`,
      );

      // Log activity
      await this.activityRepo.save(
        this.activityRepo.create({
          disputeId,
          actorId: adminId,
          actorRole: reviewer.role,
          action: DisputeAction.REJECTED,
          description: `Dispute rejected: ${reason}. Dismissal hold applied.`,
          metadata: { reason, dismissalHoldUntil },
        }),
      );

      // Emit event
      this.eventEmitter.emit(DISPUTE_EVENTS.REJECTED, {
        disputeId,
        adminId,
        reason,
        rejectedAt: now,
        dismissalHoldUntil,
        statusRestored: true,
      });

      if (reviewer.role === UserRole.STAFF) {
        await this.checkDismissalRateAndFlag(adminId);
      }

      if (Math.random() < DISMISSAL_AUDIT_SAMPLE_RATE) {
        this.eventEmitter.emit(
          'dispute.dismissal_audit_requested',
          {
            disputeId,
            staffId: dispute.assignedStaffId,
            rejectedById: adminId,
            rejectedAt: now,
          },
        );
      }

      this.logger.log(`[RejectDispute] Dispute ${disputeId} rejected by ${reviewer.role} ${adminId}`);

      return dispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
// =============================================================================
  // ADMIN NOTES (Ghi chú nội bộ / công khai)
  // =============================================================================

  /**
   * Thêm ghi chú vào dispute
   * @param isInternal - TRUE: Chỉ Admin/Staff thấy, FALSE: User cũng thấy
   */
  async addNote(
    adminId: string,
    adminRole: UserRole,
    disputeId: string,
    dto: AddNoteDto,
  ): Promise<DisputeNoteEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const note = this.noteRepo.create({
      disputeId,
      authorId: adminId,
      authorRole: adminRole,
      content: dto.content,
      isInternal: dto.isInternal ?? false,
      isPinned: dto.isPinned ?? false,
      noteType: dto.noteType || 'GENERAL',
      attachments: dto.attachments,
    });

    const saved = await this.noteRepo.save(note);

    // Log activity (internal)
    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: adminId,
        actorRole: adminRole,
        action: DisputeAction.NOTE_ADDED,
        description: dto.isInternal ? 'Internal note added' : 'Public note added',
        metadata: { noteId: saved.id, noteType: dto.noteType },
        isInternal: dto.isInternal,
      }),
    );

    this.logger.log(`[AddNote] Note added to Dispute ${disputeId} by ${adminRole}`);

    return saved;
  }

  /**
   * Lấy danh sách ghi chú
   * @param includeInternal - TRUE: Lấy cả ghi chú nội bộ (chỉ Admin)
   */
  async getNotes(
    disputeId: string,
    includeInternal: boolean = false,
  ): Promise<DisputeNoteEntity[]> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const where: { disputeId: string; isInternal?: boolean } = { disputeId };
    if (!includeInternal) {
      where.isInternal = false;
    }

    return this.noteRepo.find({
      where,
      relations: ['author'],
      order: { isPinned: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Xóa ghi chú (chỉ author hoặc Admin)
   */
  async deleteNote(userId: string, noteId: string): Promise<void> {
    const note = await this.noteRepo.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException(`Note "${noteId}" not found`);
    }

    if (note.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.noteRepo.remove(note);
    this.logger.log(`[DeleteNote] Note ${noteId} deleted`);
  }

  // =============================================================================
  // DEFENDANT RESPONSE (Phản hồi của bị đơn)
  // =============================================================================

  /**
   * Bị đơn gửi phản hồi và bằng chứng phản bác
   */
  async submitDefendantResponse(
    defendantId: string,
    disputeId: string,
    dto: DefendantResponseDto,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    // Verify caller is the defendant
    if (dispute.defendantId !== defendantId) {
      throw new ForbiddenException('Only the defendant can submit a response');
    }

    // Check if dispute is still open for response
    if (!['OPEN', 'IN_MEDIATION'].includes(dispute.status)) {
      throw new BadRequestException('Dispute is no longer open for response');
    }

    // Check deadline
    if (dispute.responseDeadline && new Date() > dispute.responseDeadline) {
      throw new BadRequestException('Response deadline has passed');
    }

    // Update defendant response
    dispute.defendantResponse = dto.response;
    dispute.defendantEvidence = dto.evidence || [];
    dispute.defendantRespondedAt = new Date();

    const saved = await this.disputeRepo.save(dispute);

    // Log activity
    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: defendantId,
        actorRole: dispute.defendantRole,
        action: DisputeAction.DEFENDANT_RESPONDED,
        description: 'Defendant submitted response',
        metadata: { hasEvidence: dto.evidence && dto.evidence.length > 0 },
      }),
    );

    // Emit event for notification
    this.eventEmitter.emit(DISPUTE_EVENTS.DEFENDANT_RESPONDED, {
      disputeId,
      defendantId,
      respondedAt: dispute.defendantRespondedAt,
    });

    this.logger.log(`[DefendantResponse] Response submitted for Dispute ${disputeId}`);

    return saved;
  }

  // =============================================================================
  // DISMISSAL APPEAL (Rejection Review)
  // =============================================================================

  async appealRejection(
    userId: string,
    disputeId: string,
    reason: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const isParty = userId === dispute.raisedById || userId === dispute.defendantId;
    if (!isParty) {
      throw new ForbiddenException('Only dispute participants can appeal a dismissal');
    }

    if (dispute.status !== DisputeStatus.REJECTED) {
      throw new BadRequestException(
        `Dispute is in "${dispute.status}" status and cannot be appealed`,
      );
    }

    if (!dispute.resolvedAt) {
      throw new BadRequestException('Dismissal time is missing');
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Appeal reason is required');
    }

    const now = new Date();
    const appealDeadline = new Date(
      dispute.resolvedAt.getTime() + REJECTION_APPEAL_WINDOW_HOURS * 60 * 60 * 1000,
    );
    if (now > appealDeadline) {
      throw new BadRequestException('Dismissal appeal window has expired');
    }

    dispute.status = DisputeStateMachine.transition(
      dispute.status,
      DisputeStatus.REJECTION_APPEALED,
    );
    dispute.rejectionAppealReason = reason.trim();
    dispute.rejectionAppealedAt = now;
    dispute.currentTier = 2;
    dispute.escalatedAt = now;
    dispute.escalationReason = 'DISMISSAL_APPEAL';
    dispute.escalatedToAdminId = null;

    if (!dispute.dismissalHoldUntil || dispute.dismissalHoldUntil < appealDeadline) {
      dispute.dismissalHoldUntil = appealDeadline;
    }

    const saved = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: userId === dispute.raisedById ? dispute.raiserRole : dispute.defendantRole,
        action: DisputeAction.REJECTION_APPEALED,
        description: `Dismissal appeal submitted: ${reason.trim().substring(0, 120)}`,
        metadata: { reason: reason.trim(), appealDeadline },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.REJECTION_APPEALED, {
      disputeId,
      userId,
      appealedAt: now,
      appealDeadline,
    });

    return saved;
  }

  async resolveRejectionAppeal(
    adminId: string,
    disputeId: string,
    decision: 'UPHOLD' | 'OVERTURN',
    resolution: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if (dispute.status !== DisputeStatus.REJECTION_APPEALED) {
      throw new BadRequestException(
        `Dispute is in "${dispute.status}" status and cannot resolve dismissal appeal`,
      );
    }

    if (!resolution || resolution.trim().length === 0) {
      throw new BadRequestException('Resolution note is required');
    }

    const reviewer = await this.userRepo.findOne({
      where: { id: adminId },
      select: ['id', 'role'],
    });
    if (!reviewer) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    const now = new Date();
    const accepted = decision === 'OVERTURN';

    if (accepted) {
      dispute.status = DisputeStateMachine.transition(
        dispute.status,
        DisputeStatus.IN_MEDIATION,
      );
      dispute.currentTier = 2;
      dispute.escalatedToAdminId = adminId;
      dispute.escalatedAt = now;
      dispute.escalationReason = 'DISMISSAL_APPEAL_OVERTURNED';
      dispute.dismissalHoldUntil = null;
    } else {
      dispute.status = DisputeStateMachine.transition(
        dispute.status,
        DisputeStatus.REJECTED,
      );
    }

    dispute.rejectionAppealResolvedById = adminId;
    dispute.rejectionAppealResolution = resolution.trim();
    dispute.rejectionAppealResolvedAt = now;

    const saved = await this.disputeRepo.save(dispute);

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: adminId,
        actorRole: reviewer.role,
        action: DisputeAction.REJECTION_APPEAL_RESOLVED,
        description: accepted
          ? 'Dismissal appeal overturned; dispute reopened'
          : 'Dismissal appeal upheld',
        metadata: { accepted, decision, resolution: resolution.trim() },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.REJECTION_APPEAL_RESOLVED, {
      disputeId,
      adminId,
      accepted,
      resolvedAt: now,
    });

    if (accepted) {
      this.eventEmitter.emit(DISPUTE_EVENTS.ESCALATED, {
        disputeId,
        adminId,
        fromStatus: DisputeStatus.REJECTION_APPEALED,
        escalatedAt: now,
      });
    }

    return saved;
  }

// =============================================================================
  // APPEAL SYSTEM (Khiếu nại lại)
  // =============================================================================

  /**
   * Gửi khiếu nại lại sau khi dispute đã được resolve
   */
  async submitAppeal(userId: string, disputeId: string, dto: AppealDto): Promise<DisputeEntity> {
    const updated = await this.verdictService.appealVerdict(disputeId, userId, dto.reason);

    if (dto.additionalEvidence && dto.additionalEvidence.length > 0) {
      const existingEvidence = updated.evidence || [];
      updated.evidence = [...new Set([...existingEvidence, ...dto.additionalEvidence])];
      await this.disputeRepo.save(updated);
    }

    const hasAdditionalEvidence = (dto.additionalEvidence?.length ?? 0) > 0;
    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: userId === updated.raisedById ? updated.raiserRole : updated.defendantRole,
        action: DisputeAction.APPEAL_SUBMITTED,
        description: `Appeal submitted: ${dto.reason.substring(0, 100)}...`,
        metadata: { reason: dto.reason, hasAdditionalEvidence },
      }),
    );

    this.eventEmitter.emit(DISPUTE_EVENTS.APPEAL_SUBMITTED, {
      disputeId,
      userId,
      appealedAt: updated.appealedAt,
    });

    this.logger.log(`[SubmitAppeal] Appeal submitted for Dispute ${disputeId}`);

    return updated;
  }

  /**
   * Admin xử lý khiếu nại
   */
  async resolveAppeal(
    adminId: string,
    disputeId: string,
    dto: AppealVerdictDto,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const admin = await this.userRepo.findOne({ where: { id: adminId }, select: ['id', 'role'] });
    if (!admin) {
      throw new NotFoundException(`User "${adminId}" not found`);
    }

    dto.disputeId = disputeId;
    const previousResult = dispute.result;

    const verdictResult = await this.verdictService.issueAppealVerdict(dto, admin.id, admin.role);
    const resolvedDispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!resolvedDispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const accepted = previousResult !== dto.result;

    // Log activity
    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: adminId,
        actorRole: UserRole.ADMIN,
        action: DisputeAction.APPEAL_RESOLVED,
        description: accepted
          ? 'Appeal resolved - verdict updated'
          : 'Appeal resolved - verdict upheld',
        metadata: {
          accepted,
          resolution: dto.overrideReason,
          verdictId: verdictResult.verdict.id,
        },
      }),
    );

    // Emit event
    this.eventEmitter.emit(DISPUTE_EVENTS.APPEAL_RESOLVED, {
      disputeId,
      adminId,
      accepted,
      resolvedAt: resolvedDispute.appealResolvedAt,
    });

    this.logger.log(
      `[ResolveAppeal] Appeal ${accepted ? 'resolved (updated)' : 'resolved (upheld)'} for Dispute ${disputeId}`,
    );

    return resolvedDispute;
  }

  // =============================================================================
  // WORKFLOW ORCHESTRATION
  // =============================================================================

  /**
   * Master flow controller for dispute lifecycle
   */
  async handleDisputeWorkflow(disputeId: string): Promise<{
    dispute: DisputeEntity;
    nextStep:
      | 'NO_ACTION'
      | 'SETTLEMENT'
      | 'HEARING'
      | 'APPEAL_REVIEW'
      | 'DEFAULT_JUDGMENT'
      | 'WAITING_STAFF'
      | 'WAITING_REVIEW'
      | 'WAITING_INFO'
      | 'REJECTION_APPEAL_REVIEW';
    details?: Record<string, any>;
  }> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
      return { dispute, nextStep: 'NO_ACTION' };
    }

    if (dispute.status === DisputeStatus.APPEALED) {
      return { dispute, nextStep: 'APPEAL_REVIEW' };
    }

    if (dispute.status === DisputeStatus.REJECTION_APPEALED) {
      return { dispute, nextStep: 'REJECTION_APPEAL_REVIEW' };
    }

    if (dispute.status === DisputeStatus.PENDING_REVIEW) {
      return { dispute, nextStep: 'WAITING_REVIEW' };
    }

    if (dispute.status === DisputeStatus.INFO_REQUESTED) {
      return {
        dispute,
        nextStep: 'WAITING_INFO',
        details: {
          infoRequestReason: dispute.infoRequestReason,
          infoRequestedAt: dispute.infoRequestedAt,
        },
      };
    }

    const now = new Date();
    if (
      dispute.responseDeadline &&
      now > dispute.responseDeadline &&
      !dispute.defendantRespondedAt
    ) {
      if (dispute.status === DisputeStatus.OPEN) {
        dispute.status = DisputeStatus.IN_MEDIATION;
      }
      dispute.isAutoResolved = true;
      await this.disputeRepo.save(dispute);

      await this.activityRepo.save(
        this.activityRepo.create({
          disputeId,
          actorId: null,
          actorRole: null,
          action: DisputeAction.ESCALATED,
          description: 'Defendant did not respond in time. Default judgment flow triggered.',
          metadata: { responseDeadline: dispute.responseDeadline },
          isInternal: true,
        }),
      );

      this.eventEmitter.emit(DISPUTE_EVENTS.STATUS_CHANGED, {
        disputeId,
        status: dispute.status,
        reason: 'DEFAULT_JUDGMENT_READY',
      });

      return {
        dispute,
        nextStep: 'DEFAULT_JUDGMENT',
        details: { responseDeadline: dispute.responseDeadline },
      };
    }

    const settlement = await this.checkSettlementEligibility(disputeId, dispute.raisedById);
    if (settlement.eligible) {
      return {
        dispute,
        nextStep: 'SETTLEMENT',
        details: settlement,
      };
    }

    const moderatorId = dispute.assignedStaffId || dispute.escalatedToAdminId;
    if (!moderatorId) {
      return { dispute, nextStep: 'WAITING_STAFF' };
    }

    const hearingResult = await this.escalateToHearing(disputeId, moderatorId);

    return {
      dispute,
      nextStep: 'HEARING',
      details: hearingResult,
    };
  }

  /**
   * Decide whether settlement is allowed and the max settlement amount
   */
  async checkSettlementEligibility(
    disputeId: string,
    proposerId: string,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    remainingAttempts?: number;
    pendingSettlement?: unknown;
    maxSettlementAmount?: number;
    settlementWindowHours?: number;
  }> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if (dispute.category === DisputeCategory.FRAUD) {
      return { eligible: false, reason: 'Fraud disputes require staff adjudication' };
    }

    const eligibility = await this.settlementService.checkSettlementEligibility(
      disputeId,
      proposerId,
    );

    if (!eligibility.eligible) {
      return eligibility;
    }

    const escrow = await this.escrowRepo.findOne({
      where: { milestoneId: dispute.milestoneId },
    });
    const maxSettlementAmount = escrow?.fundedAmount || escrow?.totalAmount || 0;
    const settlementWindowHours =
      dispute.category === DisputeCategory.DEADLINE
        ? DEADLINE_SETTLEMENT_WINDOW_HOURS
        : DEFAULT_SETTLEMENT_WINDOW_HOURS;

    return {
      ...eligibility,
      maxSettlementAmount,
      settlementWindowHours,
    };
  }

  /**
   * Escalate dispute to hearing with auto slot suggestion
   */
  async escalateToHearing(
    disputeId: string,
    triggeredById: string,
  ): Promise<{
    scheduled: boolean;
    hearingId?: string;
    suggestedSlots?: Array<{ start: Date; end: Date; score: number }>;
    reason?: string;
  }> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if ([DisputeStatus.RESOLVED, DisputeStatus.REJECTED].includes(dispute.status)) {
      throw new BadRequestException(`Cannot schedule hearing for dispute status ${dispute.status}`);
    }

    let moderatorId = dispute.assignedStaffId;
    if (!moderatorId) {
      const assignment = await this.autoAssignStaff(dispute.id);
      moderatorId = assignment?.staffId || '';
    }

    if (!moderatorId) {
      return { scheduled: false, reason: 'No staff available to schedule hearing' };
    }

    const moderator = await this.userRepo.findOne({
      where: { id: moderatorId },
      select: ['id', 'role'],
    });
    if (!moderator || ![UserRole.STAFF, UserRole.ADMIN].includes(moderator.role)) {
      throw new BadRequestException('Assigned moderator is not staff/admin');
    }

    if (dispute.status === DisputeStatus.INFO_REQUESTED) {
      throw new BadRequestException('Dispute is awaiting additional info');
    }

    if (dispute.status === DisputeStatus.REJECTION_APPEALED) {
      throw new BadRequestException('Dispute is under dismissal appeal review');
    }

    if ([DisputeStatus.OPEN, DisputeStatus.PENDING_REVIEW].includes(dispute.status)) {
      await this.escalateToMediation(triggeredById, disputeId);
    }

    const tier = dispute.currentTier >= 2 ? HearingTier.TIER_2 : HearingTier.TIER_1;
    const participants = await this.hearingService.determineRequiredParticipants(
      disputeId,
      tier,
      moderatorId,
    );
    const participantIds = participants.participants.map((participant) => participant.userId);

    const complexity = await this.staffAssignmentService.estimateDisputeComplexity(disputeId);
    const durationMinutes =
      complexity?.timeEstimation?.recommendedMinutes || DEFAULT_HEARING_DURATION_MINUTES;

    const rangeStart = new Date();
    const rangeEnd = this.addDays(rangeStart, DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS);

    const availability = await this.calendarService.findAvailableSlots({
      userIds: participantIds,
      durationMinutes,
      dateRange: { start: rangeStart, end: rangeEnd },
      maxSlots: 3,
    });

    if (availability.slots.length === 0) {
      return {
        scheduled: false,
        reason: availability.noSlotsReason || 'No common availability slots found',
      };
    }

    const selectedSlot = availability.slots[0];

    const hearing = await this.hearingService.scheduleHearing(
      {
        disputeId,
        scheduledAt: selectedSlot.start.toISOString(),
        estimatedDurationMinutes: durationMinutes,
      },
      moderatorId,
    );

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: moderatorId,
        actorRole: moderator.role,
        action: DisputeAction.ESCALATED,
        description: 'Hearing scheduled after settlement failed',
        metadata: {
          hearingId: hearing.hearing.id,
          scheduledAt: selectedSlot.start,
        },
      }),
    );

    return {
      scheduled: true,
      hearingId: hearing.hearing.id,
      suggestedSlots: availability.slots.map((slot) => ({
        start: slot.start,
        end: slot.end,
        score: slot.score,
      })),
    };
  }

  // =============================================================================
  // ADMIN UPDATE DISPUTE (Cập nhật thông tin dispute)
  // =============================================================================

  /**
   * Admin cập nhật category, priority, deadlines
   */
  async adminUpdateDispute(
    adminId: string,
    disputeId: string,
    dto: AdminUpdateDisputeDto,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const changes: string[] = [];

    if (dto.category && dto.category !== dispute.category) {
      const oldCategory = dispute.category;
      dispute.category = dto.category;
      changes.push(`Category: ${oldCategory} → ${dto.category}`);
    }

    if (dto.priority && dto.priority !== dispute.priority) {
      const oldPriority = dispute.priority;
      dispute.priority = dto.priority;
      changes.push(`Priority: ${oldPriority} → ${dto.priority}`);
    }

    if (dto.disputedAmount !== undefined) {
      dispute.disputedAmount = dto.disputedAmount;
      changes.push(`Disputed amount updated to ${dto.disputedAmount}`);
    }

    if (dto.extendResponseDeadlineDays) {
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + dto.extendResponseDeadlineDays);
      dispute.responseDeadline = newDeadline;
      changes.push(`Response deadline extended by ${dto.extendResponseDeadlineDays} days`);
    }

    if (dto.extendResolutionDeadlineDays) {
      const newDeadline = new Date();
      newDeadline.setDate(newDeadline.getDate() + dto.extendResolutionDeadlineDays);
      dispute.resolutionDeadline = newDeadline;
      changes.push(`Resolution deadline extended by ${dto.extendResolutionDeadlineDays} days`);
    }

    if (changes.length === 0) {
      return dispute;
    }

    const saved = await this.disputeRepo.save(dispute);

    // Log activity
    const action =
      dto.extendResponseDeadlineDays || dto.extendResolutionDeadlineDays
        ? DisputeAction.DEADLINE_EXTENDED
        : dto.priority
          ? DisputeAction.PRIORITY_CHANGED
          : DisputeAction.CATEGORY_CHANGED;

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: adminId,
        actorRole: UserRole.ADMIN,
        action,
        description: changes.join(', '),
        metadata: dto,
        isInternal: true,
      }),
    );

    this.logger.log(`[AdminUpdate] Dispute ${disputeId} updated: ${changes.join(', ')}`);

    return saved;
  }

  // =============================================================================
  // ACTIVITY TIMELINE
  // =============================================================================

  /**
   * Lấy timeline hoạt động của dispute
   * @param includeInternal - TRUE: Lấy cả hoạt động nội bộ (chỉ Admin)
   */
  async getActivities(
    disputeId: string,
    includeInternal: boolean = false,
  ): Promise<DisputeActivityEntity[]> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    const where: { disputeId: string; isInternal?: boolean } = { disputeId };
    if (!includeInternal) {
      where.isInternal = false;
    }

    return this.activityRepo.find({
      where,
      relations: ['actor'],
      order: { timestamp: 'DESC' },
    });
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async autoAssignStaff(
    disputeId: string,
  ): Promise<{ staffId: string; success: boolean; complexity?: any } | null> {
    try {
      const assignment = await this.staffAssignmentService.autoAssignStaffToDispute(disputeId);

      if (assignment.success && assignment.staffId) {
        await this.activityRepo.save(
          this.activityRepo.create({
            disputeId,
            actorId: assignment.staffId,
            actorRole: UserRole.STAFF,
            action: DisputeAction.ASSIGNED,
            description: 'Auto-assigned staff to dispute',
            metadata: { staffId: assignment.staffId, complexity: assignment.complexity?.level },
            isInternal: true,
          }),
        );

        this.eventEmitter.emit(DISPUTE_EVENTS.ASSIGNED, {
          disputeId,
          staffId: assignment.staffId,
        });
      } else {
        await this.activityRepo.save(
          this.activityRepo.create({
            disputeId,
            actorId: null,
            actorRole: null,
            action: DisputeAction.NOTIFICATION_SENT,
            description: assignment.fallbackReason || 'Waiting for staff assignment',
            metadata: { queued: true },
            isInternal: true,
          }),
        );
      }

      return assignment;
    } catch (error) {
      this.logger.error(`[AutoAssign] Failed to assign staff for dispute ${disputeId}`, error);
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

    const participantIds = new Set<string>(
      [dispute.raisedById, dispute.defendantId, project.brokerId, staffId].filter(Boolean),
    );

    if (participantIds.size < 2) {
      return null;
    }

    const rangeStart = new Date();
    const rangeEnd = this.addDays(rangeStart, DEFAULT_AVAILABILITY_LOOKAHEAD_DAYS);
    const slotDuration = durationMinutes || DEFAULT_HEARING_DURATION_MINUTES;

    const availability = await this.calendarService.findAvailableSlots({
      userIds: Array.from(participantIds),
      durationMinutes: slotDuration,
      dateRange: { start: rangeStart, end: rangeEnd },
      maxSlots: 3,
    });

    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId: dispute.id,
        actorId: staffId,
        actorRole: UserRole.STAFF,
        action: DisputeAction.NOTIFICATION_SENT,
        description: 'Initial availability check completed',
        metadata: {
          slots: availability.slots.map((slot) => ({
            start: slot.start,
            end: slot.end,
            score: slot.score,
          })),
        },
        isInternal: true,
      }),
    );

    return availability;
  }

  /**
   * Xác định role của user trong project
   */
  private determineUserRole(userId: string, project: ProjectEntity): UserRole {
    if (userId === project.clientId) return UserRole.CLIENT;
    if (userId === project.freelancerId) return UserRole.FREELANCER;
    if (userId === project.brokerId) return UserRole.BROKER;
    throw new BadRequestException('User is not a member of this project');
  }

  /**
   * Xác định loại dispute dựa trên roles
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
   * Tính priority dựa trên số tiền và category
   */
  private calculatePriority(amount: number, category?: DisputeCategory): DisputePriority {
    // FRAUD luôn là CRITICAL
    if (category === DisputeCategory.FRAUD) {
      return DisputePriority.CRITICAL;
    }

    // Dựa trên số tiền (USD)
    if (amount < 100) return DisputePriority.LOW; // < $100
    if (amount < 1000) return DisputePriority.MEDIUM; // $100 - $1,000
    if (amount < 5000) return DisputePriority.HIGH; // $1,000 - $5,000
    return DisputePriority.CRITICAL; // > $5,000
  }

  /**
   * Log activity vào database (trong transaction)
   */
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
