import { Injectable, Logger } from '@nestjs/common';
import { AuditLogEntity } from 'src/database/entities';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async log(payload: {
    actorId: number;
    action: string;
    entityType: string;
    entityId: number;
    oldData?: any;
    newData?: any;
    req?: any; // Request object để lấy IP/UA
  }) {
    try {
      const ip = this.extractIp(payload.req);
      const userAgent = payload.req?.headers['user-agent'] || 'unknown';

      const securityFlags: string[] = [];

      if (this.isSuspiciousUserAgent(userAgent)) {
        securityFlags.push('Suspicious User Agent');
      }

      const sensitiveActions = ['LOGIN', 'CHANGE_PASSWORD', 'WITHDRAW_MONEY'];
      if (sensitiveActions.includes(payload.action)) {
        const isNewIp = await this.checkIfIpIsNewForUser(payload.actorId, ip);
        if (isNewIp) {
          securityFlags.push('UNUSUAL_LOCATION_ACTIVITY');
        }
      }

      const enrichedAfterData = {
        ...(payload.newData || {}),
        _security_analysis: {
          flags: securityFlags,
          riskLevel: securityFlags.length > 0 ? 'HIGH' : 'LOW',
          timestamp: new Date().toISOString(),
        },
      };

      const logEntry = this.auditLogRepository.create({
        actorId: payload.actorId,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        ipAddress: ip,
        userAgent: userAgent,
        beforeData: payload.oldData,
        afterData: enrichedAfterData,
      });

      await this.auditLogRepository.save(logEntry);
      if (securityFlags.length > 0) {
        this.logger.warn(
          `SECURITY ALERT: User ${payload.actorId} | IP: ${ip} | Flags: ${securityFlags.join(',')}`,
        );
      }
    } catch (error) {
      this.logger.error(`[AuditLog] Error: ${error.message}`, error.stack);
    }
  }
  private extractIp(req: any): string {
    if (!req) return 'system';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.id || req.connection?.remoteAddress || 'unknown';
  }

  private isSuspiciousUserAgent(ua: string): boolean {
    if (!ua || ua === 'unknown') return true;
    const lowerUa = ua.toLowerCase();
    const blacklist = ['postman', 'curl', 'wget', 'python', 'insomnia', 'axios', 'bot'];
    return blacklist.some((tool) => lowerUa.includes(tool));
  }

  private async checkIfIpIsNewForUser(userId: number, currentIp: string): Promise<boolean> {
    if (currentIp === 'system' || currentIp === 'unknown') return false;
    const recentLogs = await this.auditLogRepository.find({
      where: {
        actorId: userId,
      },
      select: ['ipAddress'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (recentLogs.length === 0) return false;

    const userIps = recentLogs.map((log) => log.ipAddress).filter(Boolean);

    return !userIps.includes(currentIp);
  }

  async findAll(queryDto: GetAuditLogsDto) {
    const { page = 1, limit = 20, userId, entityType, action } = queryDto;
    const skip = (page - 1) * limit;

    const query = this.auditLogRepository.createQueryBuilder('log');

    query.leftJoinAndSelect('log.actor', 'actor');

    query.select(['log', 'actor.id', 'actor.email', 'actor.fullName', 'actor.role']);

    if (userId) {
      query.andWhere('log.actorId = :userId', { userId });
    }
    if (entityType) {
      query.andWhere('log.entityType =:entityType', { entityType });
    }
    if (action) {
      query.andWhere('log.action LIKE :action', { action: `%${action}%` });
    }

    query.orderBy('log.createdAt', 'DESC');

    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

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
}
