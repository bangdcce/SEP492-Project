import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import {
  UserFlagEntity,
  UserEntity,
  DisputeEntity,
  DisputeStatus,
  DisputeResult,
  DisputeType,
} from 'src/database/entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserFlagType, FlagSeverity, FlagStatus, FLAG_THRESHOLDS, FLAG_CONFIG } from './types';
import { CreateUserFlagDto, UpdateUserFlagDto, AppealFlagDto } from './dto';

// Events
export const USER_WARNING_EVENTS = {
  FLAG_CREATED: 'user_warning.flag_created',
  FLAG_RESOLVED: 'user_warning.flag_resolved',
  FLAG_APPEALED: 'user_warning.flag_appealed',
  SEVERE_WARNING: 'user_warning.severe', // For immediate admin attention
};

// Type for flagged user query result
export interface FlaggedUserRaw {
  userId: string;
  maxSeverity: number;
  flagCount: string;
  fullName: string;
  email: string;
  trustScore: number;
  disputesLost: number;
}

@Injectable()
export class UserWarningService {
  private readonly logger = new Logger(UserWarningService.name);

  constructor(
    @InjectRepository(UserFlagEntity)
    private flagRepo: Repository<UserFlagEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(DisputeEntity)
    private disputeRepo: Repository<DisputeEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =============================================================================
  // AUTO FLAG: Kiểm tra và tạo flag tự động sau khi resolve dispute
  // =============================================================================

  /**
   * Kiểm tra user sau khi thua dispute và tạo flag nếu cần
   * Được gọi từ DisputesService sau khi resolve
   */
  async checkAndFlagAfterDisputeLoss(
    userId: string,
    disputeId: string,
    disputeResult: DisputeResult,
  ): Promise<UserFlagEntity | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found for flag check`);
      return null;
    }

    this.logger.log(`Checking flags for User ${userId} after dispute ${disputeId}`);

    // Lấy lịch sử dispute của user
    const userDisputes = await this.disputeRepo.find({
      where: [
        { raisedById: userId, status: DisputeStatus.RESOLVED },
        { defendantId: userId, status: DisputeStatus.RESOLVED },
      ],
    });

    // Đếm số lần thua - sử dụng logic tương tự determineLoser
    // User thua khi: họ ở "client side" và verdict = WIN_FREELANCER, hoặc ngược lại
    const disputesLost = userDisputes.filter((d) => {
      const isRaiser = d.raisedById === userId;

      // Xác định user đang ở "side" nào dựa trên disputeType
      let isClientSide: boolean;

      switch (d.disputeType) {
        case DisputeType.CLIENT_VS_FREELANCER:
        case DisputeType.CLIENT_VS_BROKER:
          isClientSide = isRaiser; // Raiser là client
          break;
        case DisputeType.FREELANCER_VS_CLIENT:
        case DisputeType.FREELANCER_VS_BROKER:
          isClientSide = !isRaiser; // Defendant là client
          break;
        case DisputeType.BROKER_VS_CLIENT:
          isClientSide = !isRaiser; // Defendant là client
          break;
        case DisputeType.BROKER_VS_FREELANCER:
          isClientSide = isRaiser; // Broker đóng vai client side
          break;
        default:
          // Backward compatible: raiser = client
          isClientSide = isRaiser;
      }

      // User thua khi:
      // - Ở client side và verdict = WIN_FREELANCER
      // - Ở freelancer side và verdict = WIN_CLIENT
      if (isClientSide) {
        return d.result === DisputeResult.WIN_FREELANCER;
      } else {
        return d.result === DisputeResult.WIN_CLIENT;
      }
    });

    const totalDisputes = userDisputes.length;
    const disputesLostCount = disputesLost.length;

    this.logger.log(
      `User ${userId}: ${disputesLostCount}/${totalDisputes} disputes lost (threshold: ${FLAG_THRESHOLDS.DISPUTES_LOST_WARNING})`,
    );

    // Check thresholds
    if (disputesLostCount >= FLAG_THRESHOLDS.DISPUTES_LOST_SEVERE) {
      // Severe: Nhiều lần thua
      return this.createAutoFlag(
        userId,
        UserFlagType.REPEAT_OFFENDER,
        FlagSeverity.CRITICAL,
        `User thua ${disputesLostCount} disputes. Cần review nghiêm túc.`,
        {
          disputeId,
          disputesLostCount,
          totalDisputes,
          lastDisputeResult: disputeResult,
        },
      );
    } else if (disputesLostCount >= FLAG_THRESHOLDS.DISPUTES_LOST_WARNING) {
      // Warning: Thua nhiều lần
      return this.createAutoFlag(
        userId,
        UserFlagType.MULTIPLE_DISPUTES_LOST,
        FlagSeverity.MEDIUM,
        `User đã thua ${disputesLostCount} disputes. Cần theo dõi.`,
        {
          disputeId,
          disputesLostCount,
          totalDisputes,
          lastDisputeResult: disputeResult,
        },
      );
    }

    // Check tỷ lệ thua (nếu có ít nhất 2 disputes)
    if (
      totalDisputes >= 2 &&
      disputesLostCount / totalDisputes >= FLAG_THRESHOLDS.DISPUTE_LOSS_RATE_WARNING
    ) {
      return this.createAutoFlag(
        userId,
        UserFlagType.HIGH_DISPUTE_RATE,
        FlagSeverity.HIGH,
        `User có tỷ lệ thua dispute cao: ${Math.round((disputesLostCount / totalDisputes) * 100)}%`,
        {
          disputeId,
          disputesLostCount,
          totalDisputes,
          lossRate: disputesLostCount / totalDisputes,
        },
      );
    }

    return null;
  }

  /**
   * Kiểm tra fraud từ dispute category
   */
  async flagForFraud(userId: string, disputeId: string, reason: string): Promise<UserFlagEntity> {
    return this.createAutoFlag(
      userId,
      UserFlagType.DISPUTE_FRAUD,
      FlagSeverity.SEVERE,
      `Dispute resolved với kết luận FRAUD: ${reason}`,
      { disputeId, reason },
    );
  }

  // =============================================================================
  // AUTO FLAG: Performance-based flags
  // =============================================================================

  /**
   * Kiểm tra và tạo flag dựa trên performance của user
   * Có thể được gọi định kỳ hoặc sau mỗi project
   */
  async checkPerformanceFlags(userId: string): Promise<UserFlagEntity[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return [];

    const flags: UserFlagEntity[] = [];
    const totalProjects = user.totalProjectsFinished + user.totalProjectsCancelled;

    // Check cancellation rate
    if (user.totalProjectsCancelled >= FLAG_THRESHOLDS.CANCELLATION_WARNING) {
      const cancellationRate = totalProjects > 0 ? user.totalProjectsCancelled / totalProjects : 0;

      if (cancellationRate >= FLAG_THRESHOLDS.CANCELLATION_RATE_WARNING) {
        const existingFlag = await this.findActiveFlag(userId, UserFlagType.HIGH_CANCELLATION_RATE);
        if (!existingFlag) {
          const flag = await this.createAutoFlag(
            userId,
            UserFlagType.HIGH_CANCELLATION_RATE,
            FlagSeverity.MEDIUM,
            `Tỷ lệ hủy dự án cao: ${Math.round(cancellationRate * 100)}% (${user.totalProjectsCancelled}/${totalProjects})`,
            { cancellationRate, cancelled: user.totalProjectsCancelled, total: totalProjects },
          );
          flags.push(flag);
        }
      }
    }

    // Check late delivery
    if (user.totalLateProjects >= FLAG_THRESHOLDS.LATE_DELIVERY_WARNING) {
      const existingFlag = await this.findActiveFlag(userId, UserFlagType.CHRONIC_LATE_DELIVERY);
      if (!existingFlag) {
        const flag = await this.createAutoFlag(
          userId,
          UserFlagType.CHRONIC_LATE_DELIVERY,
          FlagSeverity.LOW,
          `Thường xuyên trễ deadline: ${user.totalLateProjects} lần`,
          { lateCount: user.totalLateProjects },
        );
        flags.push(flag);
      }
    }

    return flags;
  }

  // =============================================================================
  // CRUD Operations
  // =============================================================================

  /**
   * Tạo flag tự động (từ system)
   */
  private async createAutoFlag(
    userId: string,
    type: UserFlagType,
    severity: FlagSeverity,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<UserFlagEntity> {
    // Kiểm tra xem đã có flag active cùng loại chưa
    const existingFlag = await this.findActiveFlag(userId, type);
    if (existingFlag) {
      // Update severity nếu mới cao hơn
      if ((severity as number) > existingFlag.severity) {
        existingFlag.severity = severity as number;
        existingFlag.description = description;
        if (metadata) {
          existingFlag.metadata = { ...existingFlag.metadata, ...metadata };
        }
        const updated = await this.flagRepo.save(existingFlag);
        this.logger.log(`Updated flag ${existingFlag.id} severity to ${severity}`);
        return updated;
      }
      return existingFlag;
    }

    // Tạo flag mới
    const flag = this.flagRepo.create({
      userId,
      type,
      severity,
      description,
      status: FlagStatus.ACTIVE,
      metadata,
      isAutoGenerated: true,
    });

    const saved = await this.flagRepo.save(flag);

    this.logger.log(`Created auto flag: ${type} for User ${userId} (severity: ${severity})`);

    // Emit event - includes data for trust score recalculation
    this.eventEmitter.emit(USER_WARNING_EVENTS.FLAG_CREATED, {
      flagId: saved.id,
      userId,
      type,
      severity,
      isAutoGenerated: true,
      requiresTrustScoreUpdate: true, // Signal to TrustScoreModule to recalculate
    });

    // Emit severe warning for immediate attention
    if (severity >= FlagSeverity.CRITICAL) {
      this.eventEmitter.emit(USER_WARNING_EVENTS.SEVERE_WARNING, {
        flagId: saved.id,
        userId,
        type,
        severity,
        description,
      });
    }

    return saved;
  }

  /**
   * Admin tạo flag thủ công
   */
  async createManualFlag(
    adminId: string,
    userId: string,
    dto: CreateUserFlagDto,
  ): Promise<UserFlagEntity> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const config = FLAG_CONFIG[dto.type];
    const severity = dto.severity || config.defaultSeverity;

    // Calculate expiry date
    let expiresAt: Date | undefined;
    if (config.autoExpireDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.autoExpireDays);
    }

    const flag = this.flagRepo.create({
      userId,
      type: dto.type,
      severity,
      description: dto.description,
      status: FlagStatus.ACTIVE,
      metadata: dto.metadata,
      createdById: adminId,
      expiresAt,
      isAutoGenerated: false,
    });

    const saved = await this.flagRepo.save(flag);

    // Audit log
    await this.auditLogsService.logCustom(
      'CREATE_USER_FLAG',
      'UserFlag',
      saved.id,
      { userId, type: dto.type, severity, description: dto.description },
      undefined,
      adminId,
    );

    this.logger.log(`Admin ${adminId} created flag: ${dto.type} for User ${userId}`);

    // Emit event
    this.eventEmitter.emit(USER_WARNING_EVENTS.FLAG_CREATED, {
      flagId: saved.id,
      userId,
      type: dto.type,
      severity,
      createdBy: adminId,
    });

    return saved;
  }

  /**
   * Update flag (admin only)
   */
  async updateFlag(
    adminId: string,
    flagId: string,
    dto: UpdateUserFlagDto,
  ): Promise<UserFlagEntity> {
    const flag = await this.flagRepo.findOne({ where: { id: flagId } });
    if (!flag) {
      throw new NotFoundException(`Flag ${flagId} not found`);
    }

    const oldData = { ...flag };

    if (dto.status) flag.status = dto.status;
    if (dto.severity) flag.severity = dto.severity;
    if (dto.adminNote) flag.adminNote = dto.adminNote;
    if (dto.resolution) {
      flag.resolution = dto.resolution;
      flag.resolvedAt = new Date();
      flag.resolvedById = adminId;
    }

    const updated = await this.flagRepo.save(flag);

    // Audit log
    await this.auditLogsService.logCustom(
      'UPDATE_USER_FLAG',
      'UserFlag',
      flagId,
      { oldData, newData: dto },
      undefined,
      adminId,
    );

    if (dto.status === FlagStatus.RESOLVED) {
      this.eventEmitter.emit(USER_WARNING_EVENTS.FLAG_RESOLVED, {
        flagId,
        userId: flag.userId,
        resolvedBy: adminId,
      });
    }

    return updated;
  }

  /**
   * User appeal flag
   */
  async appealFlag(userId: string, flagId: string, dto: AppealFlagDto): Promise<UserFlagEntity> {
    const flag = await this.flagRepo.findOne({ where: { id: flagId, userId } });
    if (!flag) {
      throw new NotFoundException(`Flag ${flagId} not found for this user`);
    }

    const config = FLAG_CONFIG[flag.type as UserFlagType];
    if (!config.canAppeal) {
      throw new BadRequestException(`This flag type cannot be appealed`);
    }

    if (flag.status !== FlagStatus.ACTIVE) {
      throw new BadRequestException(`Only active flags can be appealed`);
    }

    flag.status = FlagStatus.APPEALED;
    flag.appealReason = dto.reason;
    flag.appealEvidence = dto.evidence || [];
    flag.appealedAt = new Date();

    const updated = await this.flagRepo.save(flag);

    this.eventEmitter.emit(USER_WARNING_EVENTS.FLAG_APPEALED, {
      flagId,
      userId,
      reason: dto.reason,
    });

    this.logger.log(`User ${userId} appealed flag ${flagId}`);

    return updated;
  }

  // =============================================================================
  // Query Operations
  // =============================================================================

  /**
   * Lấy tất cả flags của user
   */
  async getUserFlags(userId: string, includeResolved: boolean = false): Promise<UserFlagEntity[]> {
    const whereCondition: { userId: string; status?: FlagStatus | ReturnType<typeof In> } = {
      userId,
    };
    if (!includeResolved) {
      whereCondition.status = In([FlagStatus.ACTIVE, FlagStatus.APPEALED]);
    }

    return this.flagRepo.find({
      where: whereCondition,
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Lấy flag active theo type
   */
  async findActiveFlag(userId: string, type: UserFlagType): Promise<UserFlagEntity | null> {
    return this.flagRepo.findOne({
      where: {
        userId,
        type,
        status: In([FlagStatus.ACTIVE, FlagStatus.APPEALED]),
      },
    });
  }

  /**
   * Check xem user có warning không (cho hiển thị badge)
   */
  async hasActiveWarning(userId: string): Promise<boolean> {
    const count = await this.flagRepo.count({
      where: {
        userId,
        status: In([FlagStatus.ACTIVE, FlagStatus.APPEALED]),
        severity: MoreThanOrEqual(FlagSeverity.MEDIUM),
      },
    });
    return count > 0;
  }

  /**
   * Lấy severity cao nhất của user (cho hiển thị)
   */
  async getHighestSeverity(userId: string): Promise<number> {
    const flag = await this.flagRepo.findOne({
      where: {
        userId,
        status: In([FlagStatus.ACTIVE, FlagStatus.APPEALED]),
      },
      order: { severity: 'DESC' },
    });
    return flag?.severity || 0;
  }

  /**
   * Lấy tất cả users có flags (cho admin dashboard)
   */
  async getFlaggedUsers(
    status?: FlagStatus,
    minSeverity?: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ users: FlaggedUserRaw[]; total: number }> {
    const queryBuilder = this.flagRepo
      .createQueryBuilder('flag')
      .select('flag.userId', 'userId')
      .addSelect('MAX(flag.severity)', 'maxSeverity')
      .addSelect('COUNT(*)', 'flagCount')
      .leftJoin('flag.user', 'user')
      .addSelect('user.fullName', 'fullName')
      .addSelect('user.email', 'email')
      .addSelect('user.currentTrustScore', 'trustScore')
      .addSelect('user.totalDisputesLost', 'disputesLost');

    if (status) {
      queryBuilder.where('flag.status = :status', { status });
    } else {
      queryBuilder.where('flag.status IN (:...statuses)', {
        statuses: [FlagStatus.ACTIVE, FlagStatus.APPEALED],
      });
    }

    if (minSeverity) {
      queryBuilder.andWhere('flag.severity >= :minSeverity', { minSeverity });
    }

    queryBuilder.groupBy('flag.userId');
    queryBuilder.addGroupBy('user.fullName');
    queryBuilder.addGroupBy('user.email');
    queryBuilder.addGroupBy('user.currentTrustScore');
    queryBuilder.addGroupBy('user.totalDisputesLost');
    queryBuilder.orderBy('maxSeverity', 'DESC');

    const total = await queryBuilder.getCount();
    const users = await queryBuilder
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<FlaggedUserRaw>();

    return { users, total };
  }

  /**
   * Lấy danh sách appeals cần review
   */
  async getPendingAppeals(page: number = 1, limit: number = 20): Promise<UserFlagEntity[]> {
    return this.flagRepo.find({
      where: { status: FlagStatus.APPEALED },
      relations: ['user'],
      order: { appealedAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Resolve appeal (admin)
   */
  async resolveAppeal(
    adminId: string,
    flagId: string,
    accepted: boolean,
    resolution: string,
  ): Promise<UserFlagEntity> {
    const flag = await this.flagRepo.findOne({ where: { id: flagId } });
    if (!flag) {
      throw new NotFoundException(`Flag ${flagId} not found`);
    }

    if (flag.status !== FlagStatus.APPEALED) {
      throw new BadRequestException(`Flag is not in appealed status`);
    }

    flag.appealResolution = resolution;
    flag.appealResolvedAt = new Date();
    flag.appealResolvedById = adminId;

    if (accepted) {
      flag.status = FlagStatus.DISMISSED;
      flag.resolution = `Appeal accepted: ${resolution}`;
    } else {
      flag.status = FlagStatus.ACTIVE;
      flag.adminNote = `Appeal rejected: ${resolution}`;
    }

    const updated = await this.flagRepo.save(flag);

    // Audit log
    await this.auditLogsService.logCustom(
      'RESOLVE_FLAG_APPEAL',
      'UserFlag',
      flagId,
      { accepted, resolution, userId: flag.userId },
      undefined,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} ${accepted ? 'accepted' : 'rejected'} appeal for flag ${flagId}`,
    );

    return updated;
  }

  // =============================================================================
  // Cleanup Operations
  // =============================================================================

  /**
   * Expire old flags (chạy qua cron job)
   */
  async expireOldFlags(): Promise<number> {
    const now = new Date();

    const result = await this.flagRepo
      .createQueryBuilder()
      .update(UserFlagEntity)
      .set({ status: FlagStatus.EXPIRED })
      .where('status = :status', { status: FlagStatus.ACTIVE })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} old flags`);
    }

    return result.affected || 0;
  }

  /**
   * Get summary statistics for admin dashboard
   */
  async getFlagStatistics(): Promise<{
    totalActive: number;
    totalAppealed: number;
    bySeverity: Record<number, number>;
    byType: Record<string, number>;
  }> {
    const activeCount = await this.flagRepo.count({
      where: { status: FlagStatus.ACTIVE },
    });

    const appealedCount = await this.flagRepo.count({
      where: { status: FlagStatus.APPEALED },
    });

    // Count by severity
    const bySeverity = await this.flagRepo
      .createQueryBuilder('flag')
      .select('flag.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('flag.status IN (:...statuses)', {
        statuses: [FlagStatus.ACTIVE, FlagStatus.APPEALED],
      })
      .groupBy('flag.severity')
      .getRawMany<{ severity: number; count: string }>();

    // Count by type
    const byType = await this.flagRepo
      .createQueryBuilder('flag')
      .select('flag.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('flag.status IN (:...statuses)', {
        statuses: [FlagStatus.ACTIVE, FlagStatus.APPEALED],
      })
      .groupBy('flag.type')
      .getRawMany<{ type: string; count: string }>();

    return {
      totalActive: activeCount,
      totalAppealed: appealedCount,
      bySeverity: bySeverity.reduce<Record<number, number>>((acc, curr) => {
        acc[curr.severity] = parseInt(curr.count, 10);
        return acc;
      }, {}),
      byType: byType.reduce<Record<string, number>>((acc, curr) => {
        acc[curr.type] = parseInt(curr.count, 10);
        return acc;
      }, {}),
    };
  }
}
