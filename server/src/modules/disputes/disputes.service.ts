import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  DisputeAction,
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
} from 'src/database/entities';
import {
  DataSource,
  In,
  Not,
  QueryRunner,
  Repository,
  Brackets,
  LessThan,
  Between,
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
import { AppealDto, ResolveAppealDto } from './dto/appeal.dto';
import { AdminUpdateDisputeDto } from './dto/admin-update-dispute.dto';
import {
  DisputeFilterDto,
  DisputeSortBy,
  SortOrder,
  PaginatedDisputesResponse,
} from './dto/dispute-filter.dto';
import { UserWarningService } from '../user-warning/user-warning.service';

// Constants for deadlines
const DEFAULT_RESPONSE_DEADLINE_DAYS = 7;
const DEFAULT_RESOLUTION_DEADLINE_DAYS = 14;
const URGENT_THRESHOLD_HOURS = 48; // Dispute được coi là urgent nếu còn < 48h

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
  ) {}

  async create(raisedBy: string, dto: CreateDisputeDto) {
    const { projectId, milestoneId, defendantId, reason, evidence, category, disputedAmount } = dto;

    // Load project with relations to get roles
    const project = await this.projectRepo.findOne({
      where: { id: projectId, status: In([ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED]) },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const milestone = await this.milestoneRepo.findOne({
      where: { id: milestoneId, status: MilestoneStatus.COMPLETED },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    // Verify milestone belongs to the project
    if (milestone.projectId !== projectId) {
      throw new BadRequestException('Milestone does not belong to this project');
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

    const escrow = await this.escrowRepo.findOne({
      where: { milestoneId: milestoneId, status: Not(In(['RELEASED', 'REFUNDED'])) },
    });

    if (!escrow) throw new NotFoundException('Escrow not found');

    const existedDispute = await this.disputeRepo.findOne({
      where: {
        milestoneId: milestoneId,
        status: In([DisputeStatus.OPEN, DisputeStatus.IN_MEDIATION]),
      },
    });
    if (existedDispute) {
      throw new BadRequestException('This milestone already has an active dispute');
    }

    // Determine roles and dispute type
    const raiserRole = this.determineUserRole(raisedBy, project);
    const defendantRole = this.determineUserRole(defendantId, project);
    const disputeType = this.determineDisputeType(raiserRole, defendantRole);

    // Calculate priority based on disputed amount
    const amount = disputedAmount || Number(escrow.totalAmount);
    const priority = this.calculatePriority(amount, category);

    // Calculate deadlines
    const now = new Date();
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
      status: DisputeStatus.OPEN,
      responseDeadline,
      resolutionDeadline,
    });

    // Use transaction to ensure data consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      escrow.status = EscrowStatus.DISPUTED;
      project.status = ProjectStatus.DISPUTED;
      milestone.status = MilestoneStatus.LOCKED;

      await queryRunner.manager.save(EscrowEntity, escrow);
      await queryRunner.manager.save(MilestoneEntity, milestone);
      await queryRunner.manager.save(ProjectEntity, project);
      const savedDispute = await queryRunner.manager.save(DisputeEntity, dispute);

      // Log activity
      await this.logActivity(
        queryRunner,
        savedDispute.id,
        raisedBy,
        raiserRole,
        DisputeAction.CREATED,
        `Dispute created: ${raiserRole} vs ${defendantRole}`,
        { reason, category, disputedAmount: amount },
      );

      await queryRunner.commitTransaction();

      // Emit event for notifications
      this.eventEmitter.emit(DISPUTE_EVENTS.CREATED, {
        disputeId: savedDispute.id,
        projectId,
        raisedById: raisedBy,
        raiserRole,
        defendantId,
        defendantRole,
        responseDeadline,
      });

      return savedDispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const savedDispute = await this.disputeRepo.save(dispute);
    return savedDispute;
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
    req?: any,
  ): Promise<ResolutionResult> {
    const { verdict, adminComment, splitRatioClient = 50 } = dto;

    DisputeStateMachine.validateVerdict(verdict);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`[ResolveDispute] Starting resolution for Dispute: ${disputeId}`);

      // =========================================================================
      // STEP 1: PESSIMISTIC LOCK - Khóa records để tránh race condition
      // =========================================================================

      // Lock Dispute first (need its data for dependent queries)
      const dispute = await queryRunner.manager.findOne(DisputeEntity, {
        where: { id: disputeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!dispute) throw new NotFoundException(`Dispute with ID: ${disputeId} not found`);

      if (!DisputeStateMachine.canResolve(dispute.status)) {
        throw new BadRequestException(
          `Dispute is in "${dispute.status}" status and cannot be resolved. ` +
            `It must be in IN_MEDIATION status first.`,
        );
      }

      // PERFORMANCE: Parallel load Escrow, Project, Milestone with pessimistic lock
      const [escrow, project, milestone] = await Promise.all([
        queryRunner.manager.findOne(EscrowEntity, {
          where: { milestoneId: dispute.milestoneId },
          lock: { mode: 'pessimistic_write' },
        }),
        queryRunner.manager.findOne(ProjectEntity, {
          where: { id: dispute.projectId },
          lock: { mode: 'pessimistic_write' },
        }),
        queryRunner.manager.findOne(MilestoneEntity, {
          where: { id: dispute.milestoneId },
          lock: { mode: 'pessimistic_write' },
        }),
      ]);

      // Validate all entities exist
      if (!escrow) {
        throw new NotFoundException(`Escrow for Milestone "${dispute.milestoneId}" not found`);
      }

      if (escrow.status !== EscrowStatus.DISPUTED) {
        throw new BadRequestException(
          `Escrow must be in DISPUTED status to resolve. Current status: "${escrow.status}"`,
        );
      }

      if (!project) {
        throw new NotFoundException(`Project "${dispute.projectId}" not found`);
      }

      if (!milestone) {
        throw new NotFoundException(`Milestone "${dispute.milestoneId}" not found`);
      }

      this.logger.log(`[ResolveDispute] All records locked successfully`);

      // =========================================================================
      // STEP 2: CẬP NHẬT TRẠNG THÁI DISPUTE
      // =========================================================================

      // Update dispute fields
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.RESOLVED);
      dispute.result = verdict;
      dispute.adminComment = adminComment;
      dispute.resolvedById = adminId;
      dispute.resolvedAt = new Date();

      await queryRunner.manager.save(DisputeEntity, dispute);

      this.logger.log(`[ResolveDispute] Dispute status updated to RESOLVED`);

      // =========================================================================
      // STEP 3: THI HÀNH ÁN - XỬ LÝ TIỀN (Money Distribution)
      // =========================================================================

      const moneyDistribution = this.calculateMoneyDistribution(verdict, escrow, splitRatioClient);

      const transfers = await this.executeMoneyTransfers(
        queryRunner,
        verdict,
        escrow,
        project,
        moneyDistribution,
        dispute, // Pass dispute để xác định đúng người nhận tiền
      );

      // Update Escrow status
      escrow.status = this.getEscrowStatusFromVerdict(verdict);
      escrow.disputeId = disputeId;
      if (verdict === DisputeResult.WIN_CLIENT) {
        escrow.refundedAt = new Date();
        escrow.refundTransactionId = transfers[0]?.transactionId ?? undefined;
      } else {
        escrow.releasedAt = new Date();
        escrow.releaseTransactionIds = transfers.map((t) => t.transactionId);
      }

      await queryRunner.manager.save(EscrowEntity, escrow);
      this.logger.log(`[ResolveDispute] Escrow status updated to ${escrow.status}`);

      // =========================================================================
      // STEP 4: THI HÀNH ÁN - CẬP NHẬT PROJECT/MILESTONE
      // =========================================================================
      const { newProjectStatus, newMilestoneStatus } = this.getProjectMilestoneStatus(verdict);

      project.status = newProjectStatus;
      milestone.status = newMilestoneStatus;

      // PERFORMANCE: Batch save all entities at once instead of individual saves
      await queryRunner.manager.save([project, milestone]);

      this.logger.log(
        `[ResolveDispute] Project -> ${newProjectStatus}, Milestone -> ${newMilestoneStatus}`,
      );

      // =========================================================================
      // STEP 5: THI HÀNH ÁN - TRỪ ĐIỂM TRUST SCORE (Penalty)
      // =========================================================================

      // Sử dụng raisedById và defendantId + disputeType để xác định đúng người thua
      const { loserId, winnerId } = determineLoser(
        verdict,
        dispute.raisedById,
        dispute.defendantId,
        dispute.disputeType,
      );

      let trustScoreUpdate: { userId: string; oldScore: number; newScore: number } | null = null;
      let penaltyApplied = false;

      if (loserId) {
        // Tăng totalDisputesLost của người thua
        await queryRunner.manager.increment(UserEntity, { id: loserId }, 'totalDisputesLost', 1);

        this.logger.log(`[ResolveDispute] Incremented totalDisputesLost for User: ${loserId}`);
        penaltyApplied = true;
      }

      // =========================================================================
      // STEP 6: COMMIT TRANSACTION
      // =========================================================================

      await queryRunner.commitTransaction();
      this.logger.log(`[ResolveDispute] Transaction COMMITTED successfully!`);

      // =========================================================================
      // STEP 7: POST-COMMIT ACTIONS (Ngoài transaction)
      // =========================================================================

      // Recalculate Trust Score cho người thua (sau khi commit)
      if (loserId) {
        try {
          const scoreResult = await this.trustScoreService.calculateTrustScore(loserId);
          trustScoreUpdate = scoreResult
            ? {
                userId: loserId,
                oldScore: scoreResult.oldScore,
                newScore: scoreResult.newScore,
              }
            : null;

          // STEP 7.1: Check và tạo warning flag nếu cần
          await this.userWarningService.checkAndFlagAfterDisputeLoss(loserId, disputeId, verdict);

          // Check thêm fraud nếu dispute category là FRAUD
          if (dispute.category === DisputeCategory.FRAUD) {
            await this.userWarningService.flagForFraud(
              loserId,
              disputeId,
              `Thua dispute với category FRAUD: ${adminComment || 'No comment'}`,
            );
          }
        } catch (error: unknown) {
          // Log error nhưng không fail vì transaction đã commit
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to recalculate trust score: ${errorMessage}`);
        }
      }

      // Ghi Audit Log
      await this.auditLogsService.logCustom(
        'RESOLVE_DISPUTE',
        'Dispute',
        disputeId,
        {
          verdict,
          adminComment,
          moneyDistribution,
          transfers: transfers.map((t) => ({
            toUserId: t.toUserId,
            amount: t.amount,
            type: t.type,
          })),
          loserId,
          winnerId,
          penaltyApplied,
          trustScoreUpdate,
        },
        req as Record<string, unknown> | undefined,
        adminId,
      );

      // Emit event cho Real-time Notification
      const resolvedEvent: DisputeResolvedEvent = {
        disputeId,
        projectId: project.id,
        verdict,
        clientId: project.clientId,
        freelancerId: project.freelancerId,
        brokerId: project.brokerId,
        loserId,
        winnerId,
        moneyDistribution,
        adminComment,
        adminId,
        resolvedAt: dispute.resolvedAt,
      };

      this.eventEmitter.emit(DISPUTE_EVENTS.RESOLVED, resolvedEvent);
      this.logger.log(`[ResolveDispute] Event emitted: ${DISPUTE_EVENTS.RESOLVED}`);

      // =========================================================================
      // STEP 8: RETURN RESULT
      // =========================================================================

      const result: ResolutionResult = {
        disputeId,
        verdict,
        moneyDistribution,
        transfers: transfers.map(
          (t): TransferDetail => ({
            toUserId: t.toUserId,
            toWalletId: t.toWalletId,
            amount: t.amount,
            type: t.type as TransferDetail['type'],
            description: t.description,
          }),
        ),
        loserId,
        winnerId,
        penaltyApplied,
        projectStatusUpdated: newProjectStatus,
        milestoneStatusUpdated: newMilestoneStatus,
        escrowStatusUpdated: escrow.status,
        trustScoreUpdated: trustScoreUpdate,
        resolvedAt: dispute.resolvedAt,
        adminId,
      };

      return result;
    } catch (error: unknown) {
      // =========================================================================
      // ROLLBACK NẾU CÓ LỖI
      // =========================================================================
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ResolveDispute] Transaction ROLLED BACK: ${errorMessage}`);
      throw error;
    } finally {
      // Luôn release QueryRunner
      await queryRunner.release();
    }
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
        // Chia theo tỷ lệ
        const clientRatio = splitRatioClient / 100;
        const freelancerRatio = 1 - clientRatio;
        // Phần Client nhận (không mất phí)
        const clientAmount = totalAmount * clientRatio;
        // Phần Freelancer nhận (chia theo tỷ lệ gốc, có trừ phí)
        const freelancerPortion = totalAmount * freelancerRatio;
        const freelancerAmount = freelancerPortion * (escrow.developerPercentage / 100);
        const brokerAmount = freelancerPortion * (escrow.brokerPercentage / 100);
        const platformFeeAmount = freelancerPortion * (escrow.platformPercentage / 100);

        // PERFORMANCE FIX: Use largest remainder method to prevent rounding loss
        // VND is an integer currency (no cents), so we round down to whole numbers
        const rawAmounts = [clientAmount, freelancerAmount, brokerAmount, platformFeeAmount];
        const roundedAmounts = rawAmounts.map((a) => Math.floor(a));
        let remainingVND = Math.round(totalAmount - roundedAmounts.reduce((a, b) => a + b, 0));

        // Distribute remainder VND to amounts with largest fractional parts
        const fractions = rawAmounts
          .map((a, i) => ({ index: i, fraction: a % 1 }))
          .sort((a, b) => b.fraction - a.fraction);

        for (const { index } of fractions) {
          if (remainingVND <= 0) break;
          roundedAmounts[index] += 1;
          remainingVND--;
        }

        return {
          clientAmount: roundedAmounts[0],
          freelancerAmount: roundedAmounts[1],
          brokerAmount: roundedAmounts[2],
          platformFee: roundedAmounts[3],
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

      // Cập nhật balance
      wallet.balance = Number(wallet.balance) + amount;

      if (type === TransactionType.REFUND) {
        // Client nhận refund
        wallet.heldBalance = Math.max(0, Number(wallet.heldBalance) - amount);
      } else if (type === TransactionType.ESCROW_RELEASE) {
        // Freelancer/Broker nhận tiền
        wallet.totalEarned = Number(wallet.totalEarned) + amount;
      }

      await queryRunner.manager.save(WalletEntity, wallet);

      // Tạo Transaction record
      const transaction = queryRunner.manager.create(TransactionEntity, {
        walletId: wallet.id,
        amount,
        fee: 0,
        netAmount: amount,
        currency: 'VND',
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
      this.logger.log(`[MoneyTransfer] Platform Fee: ${distribution.platformFee} VND`);
      // Có thể tạo transaction cho platform wallet ở đây
    }

    return transfers;
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

    if (!DisputeStateMachine.canTransition(dispute.status, DisputeStatus.IN_MEDIATION)) {
      throw new BadRequestException(
        `Dispute is in "${dispute.status}" status and cannot be escalated`,
      );
    }

    dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.IN_MEDIATION);

    const saved = await this.disputeRepo.save(dispute);

    // Emit event
    this.eventEmitter.emit(DISPUTE_EVENTS.ESCALATED, {
      disputeId,
      adminId,
      escalatedAt: new Date(),
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
      throw new BadRequestException('Reason for rejection is required');
    }

    // Start transaction to ensure consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      dispute.status = DisputeStateMachine.transition(dispute.status, DisputeStatus.REJECTED);
      dispute.adminComment = reason;
      dispute.resolvedById = adminId;
      dispute.resolvedAt = new Date();

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

      // Escrow goes back to FUNDED (was DISPUTED)
      await queryRunner.manager.update(
        EscrowEntity,
        { milestoneId: dispute.milestoneId },
        {
          status: EscrowStatus.FUNDED,
        },
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[RejectDispute] Restored project/milestone/escrow status for Dispute ${disputeId}`,
      );

      // Log activity
      await this.activityRepo.save(
        this.activityRepo.create({
          disputeId,
          actorId: adminId,
          actorRole: UserRole.ADMIN,
          action: DisputeAction.REJECTED,
          description: `Dispute rejected: ${reason}. Project/milestone status restored.`,
          metadata: { reason },
        }),
      );

      // Emit event
      this.eventEmitter.emit(DISPUTE_EVENTS.REJECTED, {
        disputeId,
        adminId,
        reason,
        rejectedAt: new Date(),
        statusRestored: true,
      });

      this.logger.log(`[RejectDispute] Dispute ${disputeId} rejected by Admin ${adminId}`);

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
  // APPEAL SYSTEM (Khiếu nại lại)
  // =============================================================================

  /**
   * Gửi khiếu nại lại sau khi dispute đã được resolve
   */
  async submitAppeal(userId: string, disputeId: string, dto: AppealDto): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    // Verify caller is involved in the dispute
    if (dispute.raisedById !== userId && dispute.defendantId !== userId) {
      throw new ForbiddenException('You are not involved in this dispute');
    }

    // Check if dispute is resolved
    if (dispute.status !== DisputeStatus.RESOLVED) {
      throw new BadRequestException('Only resolved disputes can be appealed');
    }

    // Check if already appealed
    if (dispute.isAppealed) {
      throw new BadRequestException('This dispute has already been appealed');
    }

    // Update appeal fields
    dispute.isAppealed = true;
    dispute.appealReason = dto.reason;
    dispute.appealedAt = new Date();
    dispute.status = DisputeStatus.APPEALED;

    // Add additional evidence if provided
    if (dto.additionalEvidence && dto.additionalEvidence.length > 0) {
      const existingEvidence = dispute.evidence || [];
      dispute.evidence = [...new Set([...existingEvidence, ...dto.additionalEvidence])];
    }

    const saved = await this.disputeRepo.save(dispute);

    // Log activity
    const hasAdditionalEvidence = (dto.additionalEvidence?.length ?? 0) > 0;
    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: userId,
        actorRole: userId === dispute.raisedById ? dispute.raiserRole : dispute.defendantRole,
        action: DisputeAction.APPEAL_SUBMITTED,
        description: `Appeal submitted: ${dto.reason.substring(0, 100)}...`,
        metadata: { reason: dto.reason, hasAdditionalEvidence },
      }),
    );

    // Emit event
    this.eventEmitter.emit(DISPUTE_EVENTS.APPEAL_SUBMITTED, {
      disputeId,
      userId,
      appealedAt: dispute.appealedAt,
    });

    this.logger.log(`[SubmitAppeal] Appeal submitted for Dispute ${disputeId}`);

    return saved;
  }

  /**
   * Admin xử lý khiếu nại
   */
  async resolveAppeal(
    adminId: string,
    disputeId: string,
    dto: ResolveAppealDto,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found`);
    }

    if (!dispute.isAppealed || dispute.status !== DisputeStatus.APPEALED) {
      throw new BadRequestException('This dispute does not have a pending appeal');
    }

    dispute.appealResolvedById = adminId;
    dispute.appealResolution = dto.resolution;
    dispute.appealResolvedAt = new Date();

    if (dto.accepted) {
      // Re-open the dispute for re-evaluation
      dispute.status = DisputeStatus.IN_MEDIATION;
      dispute.result = DisputeResult.PENDING;
    } else {
      // Keep original resolution
      dispute.status = DisputeStatus.RESOLVED;
    }

    const saved = await this.disputeRepo.save(dispute);

    // Log activity
    await this.activityRepo.save(
      this.activityRepo.create({
        disputeId,
        actorId: adminId,
        actorRole: UserRole.ADMIN,
        action: DisputeAction.APPEAL_RESOLVED,
        description: dto.accepted ? 'Appeal accepted - case reopened' : 'Appeal rejected',
        metadata: { accepted: dto.accepted, resolution: dto.resolution },
      }),
    );

    // Emit event
    this.eventEmitter.emit(DISPUTE_EVENTS.APPEAL_RESOLVED, {
      disputeId,
      adminId,
      accepted: dto.accepted,
      resolvedAt: dispute.appealResolvedAt,
    });

    this.logger.log(
      `[ResolveAppeal] Appeal ${dto.accepted ? 'accepted' : 'rejected'} for Dispute ${disputeId}`,
    );

    return saved;
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

    // Dựa trên số tiền (VND)
    if (amount < 1000000) return DisputePriority.LOW; // < 1 triệu
    if (amount < 10000000) return DisputePriority.MEDIUM; // 1-10 triệu
    if (amount < 50000000) return DisputePriority.HIGH; // 10-50 triệu
    return DisputePriority.CRITICAL; // > 50 triệu
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
    metadata?: Record<string, any>,
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
}
