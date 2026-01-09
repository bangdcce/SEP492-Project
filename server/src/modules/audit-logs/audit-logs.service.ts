import { Injectable, Logger } from '@nestjs/common';
import { AuditLogEntity } from '../../database/entities';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

/**
 * Risk Level definitions:
 * - LOW: Read-only actions (VIEW, EXPORT, LIST)
 * - NORMAL: Standard CRUD operations (CREATE, UPDATE)
 * - HIGH: Sensitive/destructive actions (DELETE, LOGIN, CHANGE_PASSWORD, security flags)
 */
export type RiskLevel = 'LOW' | 'NORMAL' | 'HIGH';

/**
 * Action categories for automatic risk level assignment
 */
const ACTION_RISK_MAP: Record<string, RiskLevel> = {
  // Low risk - read-only
  VIEW: 'LOW',
  EXPORT: 'LOW',
  LIST: 'LOW',
  GET: 'LOW',
  SEARCH: 'LOW',
  DOWNLOAD: 'LOW',

  // Normal risk - standard operations
  CREATE: 'NORMAL',
  UPDATE: 'NORMAL',
  EDIT: 'NORMAL',
  UPLOAD: 'NORMAL',
  APPROVE: 'NORMAL',
  REJECT: 'NORMAL',

  // High risk - sensitive/destructive
  DELETE: 'HIGH',
  REMOVE: 'HIGH',
  LOGIN: 'HIGH',
  LOGOUT: 'HIGH',
  CHANGE_PASSWORD: 'HIGH',
  RESET_PASSWORD: 'HIGH',
  WITHDRAW_MONEY: 'HIGH',
  TRANSFER: 'HIGH',
  BAN_USER: 'HIGH',
  UNBAN_USER: 'HIGH',
  CHANGE_ROLE: 'HIGH',
  GRANT_PERMISSION: 'HIGH',
  REVOKE_PERMISSION: 'HIGH',
};

/**
 * Sensitive actions that trigger IP checking
 */
const SENSITIVE_ACTIONS = [
  'LOGIN',
  'CHANGE_PASSWORD',
  'WITHDRAW_MONEY',
  'TRANSFER',
  'DELETE',
  'CHANGE_ROLE',
];

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  // ==============================================================================
  // HELPER METHODS - Easy to use for other developers
  // ==============================================================================

  /**
   * Log a CREATE action
   * @example await this.auditLogsService.logCreate('Project', project.id, project, req);
   */
  async logCreate(entityType: string, entityId: string, newData: any, req?: any, actorId?: string) {
    return this.log({
      actorId: actorId || this.extractActorId(req),
      action: 'CREATE',
      entityType,
      entityId,
      newData,
      req,
    });
  }

  /**
   * Log an UPDATE action
   * @example await this.auditLogsService.logUpdate('User', user.id, oldUser, newUser, req);
   */
  async logUpdate(
    entityType: string,
    entityId: string,
    oldData: any,
    newData: any,
    req?: any,
    actorId?: string,
  ) {
    return this.log({
      actorId: actorId || this.extractActorId(req),
      action: 'UPDATE',
      entityType,
      entityId,
      oldData,
      newData,
      req,
    });
  }

  /**
   * Log a DELETE action
   * @example await this.auditLogsService.logDelete('File', fileId, deletedData, req);
   */
  async logDelete(
    entityType: string,
    entityId: string,
    deletedData: any,
    req?: any,
    actorId?: string,
  ) {
    return this.log({
      actorId: actorId || this.extractActorId(req),
      action: 'DELETE',
      entityType,
      entityId,
      oldData: deletedData,
      req,
    });
  }

  /**
   * Log a VIEW/READ action
   * @example await this.auditLogsService.logView('Document', docId, req);
   */
  async logView(entityType: string, entityId: string, req?: any, actorId?: string) {
    return this.log({
      actorId: actorId || this.extractActorId(req),
      action: 'VIEW',
      entityType,
      entityId,
      req,
    });
  }

  /**
   * Log a LOGIN action
   * @example await this.auditLogsService.logLogin(user.id, { success: true }, req);
   */
  async logLogin(actorId: string, metadata: any, req?: any) {
    return this.log({
      actorId,
      action: 'LOGIN',
      entityType: 'Session',
      entityId: actorId,
      newData: metadata,
      req,
    });
  }

  /**
   * Log a LOGOUT action
   * @example await this.auditLogsService.logLogout(user.id, req);
   */
  async logLogout(actorId: string, req?: any) {
    return this.log({
      actorId,
      action: 'LOGOUT',
      entityType: 'Session',
      entityId: actorId,
      req,
    });
  }

  /**
   * Log a custom action
   * @example await this.auditLogsService.logCustom('APPROVE', 'Project', projectId, { status: 'approved' }, req);
   */
  async logCustom(
    action: string,
    entityType: string,
    entityId: string,
    data?: any,
    req?: any,
    actorId?: string,
  ) {
    return this.log({
      actorId: actorId || this.extractActorId(req),
      action: action.toUpperCase(),
      entityType,
      entityId,
      newData: data,
      req,
    });
  }

  // ==============================================================================
  // CORE LOG METHOD
  // ==============================================================================

  /**
   * Core logging method - can also be called directly for full control
   * @example
   * await this.auditLogsService.log({
   *   actorId: userId,
   *   action: 'CUSTOM_ACTION',
   *   entityType: 'Project',
   *   entityId: projectId,
   *   oldData: previousState,
   *   newData: currentState,
   *   req: request,
   * });
   */
  async log(payload: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldData?: any;
    newData?: any;
    req?: any;
  }) {
    try {
      const ip = this.extractIp(payload.req);
      const userAgent = payload.req?.headers?.['user-agent'] || 'unknown';

      // Security Analysis
      const securityFlags: string[] = [];

      // Check for suspicious user agent
      if (this.isSuspiciousUserAgent(userAgent)) {
        securityFlags.push('SUSPICIOUS_USER_AGENT');
      }

      // Check for unusual IP on sensitive actions
      if (SENSITIVE_ACTIONS.includes(payload.action.toUpperCase()) && payload.actorId) {
        const isNewIp = await this.checkIfIpIsNewForUser(payload.actorId, ip);
        if (isNewIp) {
          securityFlags.push('UNUSUAL_LOCATION');
        }
      }

      // Determine risk level
      const baseRiskLevel = this.determineRiskLevel(payload.action);
      const finalRiskLevel = securityFlags.length > 0 ? 'HIGH' : baseRiskLevel;

      // Build enriched data with security analysis
      const enrichedAfterData = {
        ...(payload.newData || {}),
        _security_analysis: {
          flags: securityFlags,
          riskLevel: finalRiskLevel,
          baseRiskLevel: baseRiskLevel,
          timestamp: new Date().toISOString(),
        },
      };

      // Create and save log entry
      const logEntry = this.auditLogRepository.create({
        actorId: payload.actorId,
        action: payload.action.toUpperCase(),
        entityType: payload.entityType,
        entityId: payload.entityId,
        ipAddress: ip,
        userAgent: userAgent,
        beforeData: payload.oldData,
        afterData: enrichedAfterData,
      });

      await this.auditLogRepository.save(logEntry);

      // Alert on high risk activities
      if (finalRiskLevel === 'HIGH' || securityFlags.length > 0) {
        this.logger.warn(
          `[AUDIT] HIGH RISK: User=${payload.actorId} Action=${payload.action} Entity=${payload.entityType}#${payload.entityId} IP=${ip} Flags=${securityFlags.join(',')}`,
        );
      }

      return logEntry;
    } catch (error) {
      this.logger.error(`[AuditLog] Error: ${error.message}`, error.stack);
      // Don't throw - audit logging should never break the main flow
      return null;
    }
  }

  // ==============================================================================
  // QUERY METHODS
  // ==============================================================================

  async findAll(queryDto: GetAuditLogsDto) {
    const {
      page = 1,
      limit = 20,
      userId,
      entityType,
      action,
      dateFrom,
      dateTo,
      riskLevel,
    } = queryDto;
    const skip = (page - 1) * limit;

    const query = this.auditLogRepository.createQueryBuilder('log');

    query.leftJoinAndSelect('log.actor', 'actor');

    query.select(['log', 'actor.id', 'actor.email', 'actor.fullName', 'actor.role']);

    if (userId) {
      query.andWhere('log.actorId = :userId', { userId });
    }
    if (entityType) {
      query.andWhere('log.entityType = :entityType', { entityType });
    }
    if (action) {
      // Search across multiple fields with case-insensitive ILIKE
      query.andWhere(
        `(log.action ILIKE :search OR log.entity_type ILIKE :search OR log.entity_id ILIKE :search OR actor.fullName ILIKE :search)`,
        { search: `%${action}%` },
      );
    }

    // Filter by date range
    if (dateFrom) {
      query.andWhere('log.createdAt >= :dateFrom', {
        dateFrom: new Date(dateFrom),
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      query.andWhere('log.createdAt <= :dateTo', { dateTo: toDate });
    }

    // Filter by risk level (PostgreSQL JSONB syntax)
    // Note: Use actual DB column name 'after_data' (snake_case) in raw SQL
    if (riskLevel) {
      query.andWhere(
        `(log.after_data IS NOT NULL AND log.after_data->'_security_analysis'->>'riskLevel' = :riskLevel)`,
        { riskLevel },
      );
    }

    query.orderBy('log.createdAt', 'DESC');
    query.skip(skip).take(limit);

    const [entities, total] = await query.getManyAndCount();

    const data = entities.map((entity) => this.transformToResponseDto(entity));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==============================================================================
  // PRIVATE HELPER METHODS
  // ==============================================================================

  /**
   * Determine risk level based on action type
   */
  private determineRiskLevel(action: string): RiskLevel {
    const upperAction = action.toUpperCase();
    return ACTION_RISK_MAP[upperAction] || 'NORMAL';
  }

  /**
   * Extract actor ID from request (from JWT payload)
   */
  private extractActorId(req: any): string {
    if (!req) return 'system';
    // From JWT auth guard - req.user should contain the decoded token
    return req.user?.id || req.user?.sub || req.user?.userId || 'anonymous';
  }

  /**
   * Extract IP address from request
   */
  private extractIp(req: any): string {
    if (!req) return 'system';
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Check if user agent is suspicious (automated tools, bots)
   */
  private isSuspiciousUserAgent(ua: string): boolean {
    if (!ua || ua === 'unknown') return true;
    const lowerUa = ua.toLowerCase();
    const blacklist = [
      'postman',
      'curl',
      'wget',
      'python',
      'insomnia',
      'axios',
      'bot',
      'spider',
      'crawler',
    ];
    return blacklist.some((tool) => lowerUa.includes(tool));
  }

  /**
   * Check if current IP is new for user (potential account compromise)
   */
  private async checkIfIpIsNewForUser(userId: string, currentIp: string): Promise<boolean> {
    if (currentIp === 'system' || currentIp === 'unknown') return false;
    const recentLogs = await this.auditLogRepository.find({
      where: { actorId: userId },
      select: ['ipAddress'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (recentLogs.length === 0) return false;

    const userIps = recentLogs.map((log) => log.ipAddress).filter(Boolean);
    return !userIps.includes(currentIp);
  }

  /**
   * Transform entity to client-compatible response format
   */
  private transformToResponseDto(entity: AuditLogEntity) {
    const riskLevel = entity.afterData?._security_analysis?.riskLevel || 'NORMAL';

    return {
      id: entity.id,
      actor: {
        name: entity.actor?.fullName || 'Unknown User',
        email: entity.actor?.email || 'unknown@example.com',
        avatar: undefined,
      },
      action: entity.action,
      entity: `${entity.entityType}#${entity.entityId}`,
      ipAddress: entity.ipAddress || 'unknown',
      timestamp: entity.createdAt.toISOString(),
      riskLevel: riskLevel as RiskLevel,
      beforeData: entity.beforeData,
      afterData: entity.afterData,
      metadata: {
        userAgent: entity.userAgent,
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
    };
  }
}
