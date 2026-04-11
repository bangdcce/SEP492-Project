import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditLogEntity } from '../../database/entities';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { buildXlsxWorkbook, type XlsxSheetDefinition } from './xlsx-export.util';

export interface RequestContext {
  user?: {
    id?: string;
    sub?: string;
    userId?: string;
    role?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  originalUrl?: string;
  url?: string;
  method?: string;
  requestId?: string;
  sessionId?: string;
  connection?: {
    remoteAddress?: string;
  };
}

export type RiskLevel = 'LOW' | 'NORMAL' | 'HIGH';
export type AuditSource = 'SERVER' | 'CLIENT';
export type AuditEventCategory =
  | 'HTTP'
  | 'UI_BREADCRUMB'
  | 'DB_CHANGE'
  | 'ERROR'
  | 'AUTH'
  | 'EXPORT';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';
export type AuditIncidentSeverity = 'HIGH' | 'CRITICAL' | 'SEVERE';
export type AuditIncidentCategory =
  | 'HTTP_5XX'
  | 'SCHEDULER'
  | 'INTEGRATION'
  | 'WEBSOCKET'
  | 'STORAGE'
  | 'PAYMENT'
  | 'EMAIL';

export interface AuditTargetContext {
  type: string;
  id: string;
  label?: string;
}

export interface AuditIncidentContext {
  scope: 'SYSTEM';
  severity: AuditIncidentSeverity;
  category: AuditIncidentCategory;
  component: string;
  operation: string;
  fingerprint: string;
}

export interface AuditMetadataEnvelope {
  actorType?: string;
  module?: string;
  operation?: string;
  outcome?: AuditOutcome;
  summary?: string;
  target?: AuditTargetContext;
  context?: Record<string, unknown>;
  incident?: AuditIncidentContext;
  securityAnalysis?: SecurityAnalysis;
  [key: string]: unknown;
}

export interface ChangedField {
  path: string;
  before: unknown;
  after: unknown;
}

interface AuditLogPayload {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  req?: RequestContext;
  source?: AuditSource;
  eventCategory?: AuditEventCategory;
  eventName?: string;
  journeyStep?: string;
  statusCode?: number;
  route?: string;
  httpMethod?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface SecurityAnalysis {
  flags: string[];
  riskLevel: RiskLevel;
  baseRiskLevel: RiskLevel;
  timestamp: string;
}

interface LogSystemIncidentInput {
  actorId?: string | null;
  req?: RequestContext;
  entityType?: string;
  entityId?: string;
  component: string;
  operation: string;
  summary: string;
  severity: AuditIncidentSeverity;
  category: AuditIncidentCategory;
  statusCode?: number;
  error?: unknown;
  errorCode?: string;
  errorMessage?: string;
  route?: string;
  httpMethod?: string;
  requestId?: string;
  sessionId?: string;
  target?: AuditTargetContext;
  context?: Record<string, unknown>;
  eventName?: string;
  fingerprint?: string;
}

const SENSITIVE_AUDIT_KEYS = [
  'password',
  'passwordhash',
  'otp',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
] as const;

const ACTION_RISK_MAP: Record<string, RiskLevel> = {
  VIEW: 'LOW',
  EXPORT: 'LOW',
  LIST: 'LOW',
  GET: 'LOW',
  SEARCH: 'LOW',
  DOWNLOAD: 'LOW',
  CREATE: 'NORMAL',
  UPDATE: 'NORMAL',
  EDIT: 'NORMAL',
  UPLOAD: 'NORMAL',
  APPROVE: 'NORMAL',
  REJECT: 'NORMAL',
  REGISTRATION: 'NORMAL',
  BREADCRUMB: 'LOW',
  LOGIN: 'NORMAL',
  LOGOUT: 'LOW',
  DELETE: 'HIGH',
  REMOVE: 'HIGH',
  CHANGE_PASSWORD: 'HIGH',
  RESET_PASSWORD: 'HIGH',
  WITHDRAW_MONEY: 'HIGH',
  TRANSFER: 'HIGH',
  BAN_USER: 'HIGH',
  UNBAN_USER: 'HIGH',
  CHANGE_ROLE: 'HIGH',
  GRANT_PERMISSION: 'HIGH',
  REVOKE_PERMISSION: 'HIGH',
  ERROR: 'HIGH',
};

const SENSITIVE_ACTIONS = [
  'LOGIN',
  'CHANGE_PASSWORD',
  'WITHDRAW_MONEY',
  'TRANSFER',
  'DELETE',
  'CHANGE_ROLE',
  'BAN_USER',
  'UNBAN_USER',
] as const;

type AuditLogResponse = ReturnType<AuditLogsService['transformToResponseDto']>;

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async logCreate(
    entityType: string,
    entityId: string,
    newData: Record<string, unknown>,
    req?: RequestContext,
    actorId?: string | null,
  ) {
    return this.log({
      actorId: actorId ?? this.extractActorId(req),
      action: 'CREATE',
      entityType,
      entityId,
      newData,
      req,
      source: 'SERVER',
      eventCategory: 'DB_CHANGE',
      eventName: `${entityType.toLowerCase()}-created`,
    });
  }

  async logUpdate(
    entityType: string,
    entityId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    req?: RequestContext,
    actorId?: string | null,
  ) {
    return this.log({
      actorId: actorId ?? this.extractActorId(req),
      action: 'UPDATE',
      entityType,
      entityId,
      oldData,
      newData,
      req,
      source: 'SERVER',
      eventCategory: 'DB_CHANGE',
      eventName: `${entityType.toLowerCase()}-updated`,
    });
  }

  async logDelete(
    entityType: string,
    entityId: string,
    deletedData: Record<string, unknown>,
    req?: RequestContext,
    actorId?: string | null,
  ) {
    return this.log({
      actorId: actorId ?? this.extractActorId(req),
      action: 'DELETE',
      entityType,
      entityId,
      oldData: deletedData,
      req,
      source: 'SERVER',
      eventCategory: 'DB_CHANGE',
      eventName: `${entityType.toLowerCase()}-deleted`,
    });
  }

  async logView(
    entityType: string,
    entityId: string,
    req?: RequestContext,
    actorId?: string | null,
  ) {
    return this.log({
      actorId: actorId ?? this.extractActorId(req),
      action: 'VIEW',
      entityType,
      entityId,
      req,
      source: 'SERVER',
      eventCategory: 'HTTP',
      eventName: `${entityType.toLowerCase()}-viewed`,
    });
  }

  async logLogin(actorId: string, metadata: Record<string, unknown>, req?: RequestContext) {
    return this.log({
      actorId,
      action: 'LOGIN',
      entityType: 'Session',
      entityId: actorId,
      newData: metadata,
      req,
      source: 'SERVER',
      eventCategory: 'AUTH',
      eventName: 'login',
      statusCode: 200,
    });
  }

  async logRegistration(actorId: string, metadata: Record<string, unknown>, req?: RequestContext) {
    return this.log({
      actorId,
      action: 'REGISTRATION',
      entityType: 'User',
      entityId: actorId,
      newData: metadata,
      req,
      source: 'SERVER',
      eventCategory: 'AUTH',
      eventName: 'registration',
      statusCode: 201,
    });
  }

  async logLogout(actorId: string, req?: RequestContext) {
    return this.log({
      actorId,
      action: 'LOGOUT',
      entityType: 'Session',
      entityId: actorId,
      req,
      source: 'SERVER',
      eventCategory: 'AUTH',
      eventName: 'logout',
      statusCode: 200,
    });
  }

  async logSystemIncident(input: LogSystemIncidentInput) {
    const fingerprint =
      input.fingerprint ||
      this.buildIncidentFingerprint(
        input.category,
        input.component,
        input.operation,
        input.errorCode,
        input.errorMessage || this.resolveErrorMessage(input.error) || input.summary,
      );

    return this.log({
      actorId: input.actorId ?? this.extractActorId(input.req),
      action: 'ERROR',
      entityType: input.entityType || input.target?.type || 'SystemIncident',
      entityId: input.entityId || input.target?.id || fingerprint,
      req: input.req,
      source: 'SERVER',
      eventCategory: 'ERROR',
      eventName: input.eventName || `${input.component}-${input.operation}-failed`,
      statusCode: input.statusCode,
      route: input.route,
      httpMethod: input.httpMethod,
      requestId: input.requestId,
      sessionId: input.sessionId,
      errorCode: input.errorCode || this.resolveErrorCode(input.error),
      errorMessage: input.errorMessage || this.resolveErrorMessage(input.error) || input.summary,
      metadata: {
        module: input.component,
        operation: input.operation,
        outcome: 'FAILURE',
        summary: input.summary,
        target:
          input.target ||
          ({
            type: input.entityType || 'SystemIncident',
            id: input.entityId || fingerprint,
          } satisfies AuditTargetContext),
        context: this.sanitizeMetadataContext(input.context),
        incident: {
          scope: 'SYSTEM',
          severity: input.severity,
          category: input.category,
          component: input.component,
          operation: input.operation,
          fingerprint,
        },
      } satisfies AuditMetadataEnvelope,
    });
  }

  async logCustom(
    action: string,
    entityType: string,
    entityId: string,
    data?: Record<string, unknown>,
    req?: RequestContext,
    actorId?: string | null,
  ) {
    return this.log({
      actorId: actorId ?? this.extractActorId(req),
      action: action.toUpperCase(),
      entityType,
      entityId,
      newData: data,
      req,
      source: 'SERVER',
      eventCategory: this.resolveEventCategory(action),
      eventName: `${entityType.toLowerCase()}-${action.toLowerCase()}`,
    });
  }

  async ingestClientEvents(
    actorId: string,
    events: Array<{
      eventName: string;
      journeyStep?: string;
      route?: string;
      metadata?: Record<string, unknown>;
    }>,
    req?: RequestContext,
  ) {
    if (!events.length) {
      return { success: true, logged: 0 };
    }

    await Promise.all(
      events.map((event) =>
        this.log({
          actorId: actorId ?? this.extractActorId(req),
          action: 'BREADCRUMB',
          entityType: 'UI',
          entityId: event.route || this.extractRoute(req) || 'unknown-route',
          req,
          source: 'CLIENT',
          eventCategory: 'UI_BREADCRUMB',
          eventName: event.eventName,
          journeyStep: event.journeyStep,
          route: event.route,
          metadata: event.metadata,
        }),
      ),
    );

    return {
      success: true,
      logged: events.length,
    };
  }

  async log(payload: AuditLogPayload, repository?: Repository<AuditLogEntity>) {
    return this.persistLog(payload, repository, false);
  }

  async logOrThrow(payload: AuditLogPayload, repository?: Repository<AuditLogEntity>) {
    const entry = await this.persistLog(payload, repository, true);
    if (!entry) {
      throw new Error('Audit log persistence failed');
    }
    return entry;
  }

  private async persistLog(
    payload: AuditLogPayload,
    repository: Repository<AuditLogEntity> = this.auditLogRepository,
    throwOnError: boolean = false,
  ) {
    try {
      const action = payload.action.toUpperCase();
      const ip = this.extractIp(payload.req);
      const userAgent = this.extractUserAgent(payload.req);
      const securityFlags: string[] = [];

      if (this.isSuspiciousUserAgent(userAgent)) {
        securityFlags.push('SUSPICIOUS_USER_AGENT');
      }

      if (
        SENSITIVE_ACTIONS.includes(action as (typeof SENSITIVE_ACTIONS)[number]) &&
        payload.actorId
      ) {
        const isNewIp = await this.checkIfIpIsNewForUser(payload.actorId, ip);
        if (isNewIp) {
          securityFlags.push('UNUSUAL_LOCATION');
        }
      }

      const baseRiskLevel = this.determineRiskLevel(action);
      const finalRiskLevel: RiskLevel = securityFlags.length > 0 ? 'HIGH' : baseRiskLevel;
      const securityAnalysis: SecurityAnalysis = {
        flags: securityFlags,
        riskLevel: finalRiskLevel,
        baseRiskLevel,
        timestamp: new Date().toISOString(),
      };
      const changedFields = this.buildChangedFields(payload.oldData, payload.newData);
      const afterData = this.buildAfterData(payload.newData, securityAnalysis);
      const metadataActorType = payload.metadata?.['actorType'];
      const actorType =
        typeof metadataActorType === 'string'
          ? metadataActorType
          : payload.actorId
            ? 'USER'
            : payload.req
              ? 'ANONYMOUS'
              : 'SYSTEM';
      const metadata = this.normalizeMetadata(payload, actorType, securityAnalysis);

      const logEntry = repository.create({
        actorId: payload.actorId,
        action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        requestId: payload.requestId || this.extractRequestId(payload.req),
        sessionId: payload.sessionId || this.extractSessionId(payload.req),
        route: payload.route || this.extractRoute(payload.req),
        httpMethod: (payload.httpMethod || this.extractMethod(payload.req))?.toUpperCase() || null,
        statusCode: payload.statusCode ?? null,
        source: payload.source || 'SERVER',
        eventCategory: payload.eventCategory || this.resolveEventCategory(action),
        eventName:
          payload.eventName || `${payload.entityType.toLowerCase()}-${action.toLowerCase()}`,
        journeyStep: payload.journeyStep || null,
        errorCode: payload.errorCode || null,
        errorMessage: payload.errorMessage || null,
        ipAddress: ip,
        userAgent,
        beforeData: (payload.oldData as Record<string, unknown> | undefined) || null,
        afterData: afterData as Record<string, unknown>,
        changedFields: changedFields.length ? changedFields : null,
        metadata,
      });

      await repository.save(logEntry);

      if (finalRiskLevel === 'HIGH' || securityFlags.length > 0) {
        this.logger.warn(
          `[AUDIT] HIGH RISK actor=${this.describeActor(payload.actorId, payload.req)} action=${action} entity=${payload.entityType}#${payload.entityId} requestId=${logEntry.requestId || 'n/a'} flags=${securityFlags.join(',')}`,
        );
      }

      return logEntry;
    } catch (error: unknown) {
      if (throwOnError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[AuditLog] Error: ${errorMessage}`, errorStack);
      return null;
    }
  }

  async findAll(queryDto: GetAuditLogsDto) {
    const { page = 1, limit = 20 } = queryDto;
    const skip = (page - 1) * limit;

    const query = this.buildFilteredQuery(queryDto).orderBy('log.createdAt', 'DESC');
    query.skip(skip).take(limit);

    const [entities, total] = await query.getManyAndCount();
    const data = entities.map((entity) => this.transformToResponseDto(entity));

    const insightEntities = await this.buildFilteredQuery(queryDto)
      .orderBy('log.createdAt', 'ASC')
      .getMany();
    const insightEntries = insightEntities.map((entity) => this.transformToResponseDto(entity));
    const insights = this.buildInsights(insightEntries, queryDto);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: insights.summary,
      series: insights.series,
    };
  }

  async findOne(id: string) {
    const entity = await this.buildFilteredQuery({}).andWhere('log.id = :id', { id }).getOne();

    if (!entity) {
      throw new NotFoundException('Audit log not found');
    }

    return this.transformToResponseDto(entity);
  }

  async getTimeline(id: string) {
    const anchorEntity = await this.buildFilteredQuery({})
      .andWhere('log.id = :id', { id })
      .getOne();

    if (!anchorEntity) {
      throw new NotFoundException('Audit log not found');
    }

    const anchor = this.transformToResponseDto(anchorEntity);
    const query = this.buildFilteredQuery({});
    let correlationType: 'requestId' | 'sessionId' | 'actorId' = 'actorId';

    if (anchor.requestId) {
      correlationType = 'requestId';
      query.andWhere('log.request_id = :requestId', { requestId: anchor.requestId });
    } else if (anchor.sessionId) {
      correlationType = 'sessionId';
      const windowStart = new Date(new Date(anchor.timestamp).getTime() - 45 * 60 * 1000);
      const windowEnd = new Date(new Date(anchor.timestamp).getTime() + 5 * 60 * 1000);
      query
        .andWhere('log.session_id = :sessionId', { sessionId: anchor.sessionId })
        .andWhere('log.createdAt BETWEEN :windowStart AND :windowEnd', { windowStart, windowEnd });
    } else {
      const windowStart = new Date(new Date(anchor.timestamp).getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(new Date(anchor.timestamp).getTime() + 5 * 60 * 1000);
      query
        .andWhere('log.actorId = :actorId', { actorId: anchorEntity.actorId })
        .andWhere('log.createdAt BETWEEN :windowStart AND :windowEnd', { windowStart, windowEnd });
    }

    const entries = await query.orderBy('log.createdAt', 'ASC').take(200).getMany();

    return {
      anchor,
      correlationType,
      total: entries.length,
      data: entries.map((entry) => this.transformToResponseDto(entry)),
    };
  }

  async exportLogs(queryDto: GetAuditLogsDto): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
  }> {
    const format =
      queryDto.format === 'csv' || queryDto.format === 'xlsx' ? queryDto.format : 'json';
    const entities = await this.buildFilteredQuery(queryDto)
      .orderBy('log.createdAt', 'DESC')
      .getMany();
    const data = entities.map((entity) => this.transformToResponseDto(entity));
    const insights = this.buildInsights(data, queryDto);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'csv') {
      const rows = [
        [
          'id',
          'timestamp',
          'source',
          'eventCategory',
          'eventName',
          'action',
          'actorName',
          'actorEmail',
          'actorRole',
          'entityType',
          'entityId',
          'route',
          'httpMethod',
          'statusCode',
          'riskLevel',
          'requestId',
          'sessionId',
          'journeyStep',
          'errorCode',
          'errorMessage',
          'changedFields',
          'ipAddress',
          'userAgent',
        ],
        ...data.map((entry) => [
          entry.id,
          entry.timestamp,
          entry.source,
          entry.eventCategory,
          entry.eventName,
          entry.action,
          entry.actor.name,
          entry.actor.email,
          entry.actor.role || '',
          entry.entityType,
          entry.entityId,
          entry.route || '',
          entry.httpMethod || '',
          entry.statusCode ?? '',
          entry.riskLevel,
          entry.requestId || '',
          entry.sessionId || '',
          entry.journeyStep || '',
          entry.errorCode || '',
          entry.errorMessage || '',
          entry.changedFields.length ? JSON.stringify(entry.changedFields) : '',
          entry.ipAddress,
          String(entry.metadata?.userAgent || ''),
        ]),
      ];

      const csv = rows.map((row) => row.map((cell) => this.escapeCsv(cell)).join(',')).join('\n');

      return {
        buffer: Buffer.from(csv, 'utf8'),
        fileName: `audit-logs-${timestamp}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    if (format === 'xlsx') {
      const workbook = await buildXlsxWorkbook(this.buildXlsxSheets(data, insights, queryDto));
      return {
        buffer: workbook,
        fileName: `audit-logs-${timestamp}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      filters: this.buildExportFilterSnapshot(queryDto),
      total: data.length,
      summary: insights.summary,
      data,
    };

    return {
      buffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      fileName: `audit-logs-${timestamp}.json`,
      contentType: 'application/json; charset=utf-8',
    };
  }

  extractActorId(req?: RequestContext): string | null {
    if (!req) return null;
    return req.user?.id || req.user?.sub || req.user?.userId || null;
  }

  private buildFilteredQuery(
    queryDto: Partial<GetAuditLogsDto>,
  ): SelectQueryBuilder<AuditLogEntity> {
    const {
      userId,
      requestId,
      sessionId,
      entityType,
      entityId,
      action,
      dateFrom,
      dateTo,
      riskLevel,
      source,
      eventCategory,
      statusCode,
      errorOnly,
      incidentOnly,
      component,
      fingerprint,
    } = queryDto;
    const query = this.auditLogRepository.createQueryBuilder('log');

    query.leftJoinAndSelect('log.actor', 'actor');
    query.select(['log', 'actor.id', 'actor.email', 'actor.fullName', 'actor.role']);

    if (userId) {
      query.andWhere('log.actorId = :userId', { userId });
    }

    if (requestId) {
      query.andWhere('log.request_id = :requestId', { requestId });
    }

    if (sessionId) {
      query.andWhere('log.session_id = :sessionId', { sessionId });
    }

    if (entityType) {
      query.andWhere('log.entityType = :entityType', { entityType });
    }

    if (entityId) {
      query.andWhere('log.entityId = :entityId', { entityId });
    }

    if (action) {
      query.andWhere(
        `(log.action ILIKE :search OR log.entity_type ILIKE :search OR log.entity_id ILIKE :search OR COALESCE(log.route, '') ILIKE :search OR COALESCE(log.event_name, '') ILIKE :search OR COALESCE(log.request_id, '') ILIKE :search OR COALESCE(log.session_id, '') ILIKE :search OR actor.fullName ILIKE :search OR actor.email ILIKE :search)`,
        { search: `%${action}%` },
      );
    }

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

    if (riskLevel) {
      query.andWhere(
        `(log.after_data IS NOT NULL AND log.after_data->'_security_analysis'->>'riskLevel' = :riskLevel)`,
        { riskLevel },
      );
    }

    if (source) {
      query.andWhere('log.source = :source', { source });
    }

    if (eventCategory) {
      query.andWhere('log.event_category = :eventCategory', { eventCategory });
    }

    if (statusCode) {
      query.andWhere('log.status_code = :statusCode', { statusCode });
    }

    if (errorOnly) {
      query.andWhere(
        `(COALESCE(log.status_code, 0) >= 400 OR log.event_category = :errorCategory OR log.error_message IS NOT NULL)`,
        { errorCategory: 'ERROR' },
      );
    }

    if (incidentOnly) {
      query.andWhere(
        `(log.event_category = :incidentCategory AND log.metadata->'incident'->>'scope' = :incidentScope)`,
        {
          incidentCategory: 'ERROR',
          incidentScope: 'SYSTEM',
        },
      );
    }

    if (component) {
      query.andWhere(`COALESCE(log.metadata->'incident'->>'component', '') ILIKE :component`, {
        component: `%${component}%`,
      });
    }

    if (fingerprint) {
      query.andWhere(`log.metadata->'incident'->>'fingerprint' = :fingerprint`, {
        fingerprint,
      });
    }

    return query;
  }

  private determineRiskLevel(action: string): RiskLevel {
    return ACTION_RISK_MAP[action.toUpperCase()] || 'NORMAL';
  }

  private resolveEventCategory(action: string): AuditEventCategory {
    const upperAction = action.toUpperCase();

    if (['CREATE', 'UPDATE', 'DELETE', 'REMOVE'].includes(upperAction)) {
      return 'DB_CHANGE';
    }

    if (
      ['LOGIN', 'LOGOUT', 'REGISTRATION', 'CHANGE_PASSWORD', 'RESET_PASSWORD'].includes(upperAction)
    ) {
      return 'AUTH';
    }

    if (upperAction === 'EXPORT') {
      return 'EXPORT';
    }

    if (upperAction === 'ERROR') {
      return 'ERROR';
    }

    if (upperAction === 'BREADCRUMB') {
      return 'UI_BREADCRUMB';
    }

    return 'HTTP';
  }

  private extractIp(req?: RequestContext): string {
    if (!req) return 'system';
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      if (Array.isArray(forwarded)) {
        return forwarded[0] || 'unknown';
      }
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  private extractUserAgent(req?: RequestContext): string {
    const userAgentHeader = req?.headers?.['user-agent'];
    if (typeof userAgentHeader === 'string') {
      return userAgentHeader;
    }
    if (Array.isArray(userAgentHeader)) {
      return userAgentHeader[0] || 'unknown';
    }
    return 'unknown';
  }

  private extractRequestId(req?: RequestContext): string | null {
    const headerValue = req?.headers?.['x-request-id'];
    if (typeof headerValue === 'string') {
      return headerValue;
    }
    if (Array.isArray(headerValue)) {
      return headerValue[0] || null;
    }
    return req?.requestId || null;
  }

  private extractSessionId(req?: RequestContext): string | null {
    const headerValue = req?.headers?.['x-session-id'];
    if (typeof headerValue === 'string') {
      return headerValue;
    }
    if (Array.isArray(headerValue)) {
      return headerValue[0] || null;
    }
    return req?.sessionId || null;
  }

  private extractRoute(req?: RequestContext): string | null {
    return req?.originalUrl || req?.url || null;
  }

  private extractMethod(req?: RequestContext): string | null {
    return req?.method || null;
  }

  private isSuspiciousUserAgent(ua: string): boolean {
    if (!ua || ua === 'unknown') return false;
    const lowerUa = ua.toLowerCase();

    const automationTools = ['postman', 'curl', 'wget', 'python', 'insomnia', 'axios'];
    const hostileAgents = ['bot', 'spider', 'sqlmap', 'nikto', 'nmap'];

    if (hostileAgents.some((agent) => lowerUa.includes(agent))) {
      return true;
    }

    if (this.isNonProductionEnvironment()) {
      return false;
    }

    return automationTools.some((tool) => lowerUa.includes(tool));
  }

  private async checkIfIpIsNewForUser(userId: string, currentIp: string): Promise<boolean> {
    if (currentIp === 'system' || currentIp === 'unknown') return false;
    if (this.isPrivateOrLocalIp(currentIp)) return false;

    const recentLogs = await this.auditLogRepository.find({
      where: { actorId: userId },
      select: ['ipAddress'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (!recentLogs.length) {
      return false;
    }

    return !recentLogs
      .map((log) => log.ipAddress)
      .filter(Boolean)
      .includes(currentIp);
  }

  private isNonProductionEnvironment(): boolean {
    return (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  }

  private isPrivateOrLocalIp(ip: string): boolean {
    const normalized = ip.trim().toLowerCase();

    if (!normalized) {
      return true;
    }

    if (normalized.startsWith('::ffff:')) {
      return this.isPrivateOrLocalIp(normalized.slice('::ffff:'.length));
    }

    if (normalized === 'localhost' || normalized === '::1' || normalized === '127.0.0.1') {
      return true;
    }

    if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) {
      return true;
    }

    const private172 = normalized.match(/^172\.(\d{1,3})\./);
    if (private172) {
      const secondOctet = Number(private172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    return false;
  }

  private buildChangedFields(
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    prefix = '',
  ): ChangedField[] {
    const safeBefore = before || {};
    const safeAfter = after || {};
    const keys = Array.from(new Set([...Object.keys(safeBefore), ...Object.keys(safeAfter)]));
    const changes: ChangedField[] = [];

    keys.forEach((key) => {
      if (key === '_security_analysis') {
        return;
      }

      const beforeValue = safeBefore[key];
      const afterValue = safeAfter[key];
      const path = prefix ? `${prefix}.${key}` : key;

      if (this.isPlainObject(beforeValue) && this.isPlainObject(afterValue)) {
        changes.push(
          ...this.buildChangedFields(
            beforeValue as Record<string, unknown>,
            afterValue as Record<string, unknown>,
            path,
          ),
        );
        return;
      }

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changes.push({
          path,
          before: beforeValue ?? null,
          after: afterValue ?? null,
        });
      }
    });

    return changes;
  }

  private buildAfterData(
    newData: Record<string, unknown> | undefined,
    securityAnalysis: SecurityAnalysis,
  ): Record<string, unknown> | null {
    if (!newData && !securityAnalysis.flags.length) {
      return { _security_analysis: securityAnalysis };
    }

    return {
      ...(newData || {}),
      _security_analysis: securityAnalysis,
    };
  }

  private buildInsights(entries: AuditLogResponse[], queryDto: Partial<GetAuditLogsDto>) {
    const summary = {
      totalLogs: entries.length,
      highRisk: entries.filter((entry) => entry.riskLevel === 'HIGH').length,
      errorCount: entries.filter(
        (entry) =>
          (entry.statusCode ?? 0) >= 400 ||
          entry.eventCategory === 'ERROR' ||
          Boolean(entry.errorMessage),
      ).length,
      clientBreadcrumbs: entries.filter((entry) => entry.source === 'CLIENT').length,
      uniqueActors: new Set(entries.map((entry) => entry.actor.email)).size,
      correlatedRequests: new Set(entries.map((entry) => entry.requestId).filter(Boolean)).size,
    };

    return {
      summary,
      series: this.buildSeries(entries, queryDto),
    };
  }

  private buildSeries(entries: AuditLogResponse[], queryDto: Partial<GetAuditLogsDto>) {
    if (!entries.length) {
      return [];
    }

    const sortedEntries = [...entries].sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );
    const explicitStart = queryDto.dateFrom ? new Date(queryDto.dateFrom) : null;
    const explicitEnd = queryDto.dateTo ? new Date(queryDto.dateTo) : null;
    const start = explicitStart || new Date(sortedEntries[0].timestamp);
    const end = explicitEnd || new Date(sortedEntries[sortedEntries.length - 1].timestamp);
    const durationDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );
    const useWeekly = durationDays > 31;
    const bucketMap = new Map<
      string,
      {
        label: string;
        total: number;
        errors: number;
        highRisk: number;
        breadcrumbs: number;
      }
    >();

    sortedEntries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const bucketDate = useWeekly ? this.startOfWeek(date) : this.startOfDay(date);
      const key = bucketDate.toISOString();
      const label = useWeekly
        ? `Wk ${bucketDate.getMonth() + 1}/${bucketDate.getDate()}`
        : `${bucketDate.getMonth() + 1}/${bucketDate.getDate()}`;
      const bucket = bucketMap.get(key) || {
        label,
        total: 0,
        errors: 0,
        highRisk: 0,
        breadcrumbs: 0,
      };

      bucket.total += 1;
      if ((entry.statusCode ?? 0) >= 400 || entry.eventCategory === 'ERROR' || entry.errorMessage) {
        bucket.errors += 1;
      }
      if (entry.riskLevel === 'HIGH') {
        bucket.highRisk += 1;
      }
      if (entry.source === 'CLIENT') {
        bucket.breadcrumbs += 1;
      }
      bucketMap.set(key, bucket);
    });

    return Array.from(bucketMap.values());
  }

  private buildXlsxSheets(
    data: AuditLogResponse[],
    insights: {
      summary: {
        totalLogs: number;
        highRisk: number;
        errorCount: number;
        clientBreadcrumbs: number;
        uniqueActors: number;
        correlatedRequests: number;
      };
      series: Array<{
        label: string;
        total: number;
        errors: number;
        highRisk: number;
        breadcrumbs: number;
      }>;
    },
    queryDto: GetAuditLogsDto,
  ): XlsxSheetDefinition[] {
    const summaryRows = [
      { section: 'Summary', metric: 'Generated At', value: new Date().toISOString() },
      { section: 'Summary', metric: 'Total Logs', value: insights.summary.totalLogs },
      { section: 'Summary', metric: 'High Risk', value: insights.summary.highRisk },
      { section: 'Summary', metric: 'Errors', value: insights.summary.errorCount },
      {
        section: 'Summary',
        metric: 'Client Breadcrumbs',
        value: insights.summary.clientBreadcrumbs,
      },
      { section: 'Summary', metric: 'Unique Actors', value: insights.summary.uniqueActors },
      {
        section: 'Summary',
        metric: 'Correlated Requests',
        value: insights.summary.correlatedRequests,
      },
      ...Object.entries(this.buildExportFilterSnapshot(queryDto)).map(([metric, value]) => ({
        section: 'Filters',
        metric,
        value: value ?? 'ALL',
      })),
    ];

    const logRows = data.map((entry) => ({
      timestamp: entry.timestamp,
      source: entry.source,
      eventCategory: entry.eventCategory,
      eventName: entry.eventName,
      action: entry.action,
      actorName: entry.actor.name,
      actorEmail: entry.actor.email,
      actorRole: entry.actor.role || '',
      entityType: entry.entityType,
      entityId: entry.entityId,
      route: entry.route || '',
      httpMethod: entry.httpMethod || '',
      statusCode: entry.statusCode ?? '',
      riskLevel: entry.riskLevel,
      requestId: entry.requestId || '',
      sessionId: entry.sessionId || '',
      journeyStep: entry.journeyStep || '',
      errorCode: entry.errorCode || '',
      errorMessage: entry.errorMessage || '',
      changedFields: entry.changedFields.length ? JSON.stringify(entry.changedFields) : '',
      metadata: JSON.stringify(entry.metadata || {}),
    }));

    const timelineRows = [...data]
      .sort(
        (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
      )
      .map((entry) => ({
        timestamp: entry.timestamp,
        requestId: entry.requestId || '',
        sessionId: entry.sessionId || '',
        source: entry.source,
        eventCategory: entry.eventCategory,
        eventName: entry.eventName,
        journeyStep: entry.journeyStep || '',
        action: entry.action,
        route: entry.route || '',
        statusCode: entry.statusCode ?? '',
        riskLevel: entry.riskLevel,
        errorCode: entry.errorCode || '',
        errorMessage: entry.errorMessage || '',
      }));

    return [
      {
        name: 'Summary',
        columns: [
          { key: 'section', title: 'Section', width: 18 },
          { key: 'metric', title: 'Metric', width: 24 },
          { key: 'value', title: 'Value', width: 42, wrap: true },
        ],
        rows: summaryRows,
      },
      {
        name: 'Logs',
        columns: [
          { key: 'timestamp', title: 'Timestamp', width: 24 },
          { key: 'source', title: 'Source', width: 12 },
          { key: 'eventCategory', title: 'Category', width: 18 },
          { key: 'eventName', title: 'Event', width: 28, wrap: true },
          { key: 'action', title: 'Action', width: 16 },
          { key: 'actorName', title: 'Actor Name', width: 22 },
          { key: 'actorEmail', title: 'Actor Email', width: 28 },
          { key: 'actorRole', title: 'Actor Role', width: 14 },
          { key: 'entityType', title: 'Entity Type', width: 18 },
          { key: 'entityId', title: 'Entity ID', width: 28 },
          { key: 'route', title: 'Route', width: 30, wrap: true },
          { key: 'httpMethod', title: 'Method', width: 12 },
          { key: 'statusCode', title: 'Status', width: 12 },
          { key: 'riskLevel', title: 'Risk', width: 12 },
          { key: 'requestId', title: 'Request ID', width: 28 },
          { key: 'sessionId', title: 'Session ID', width: 28 },
          { key: 'journeyStep', title: 'Journey Step', width: 24 },
          { key: 'errorCode', title: 'Error Code', width: 22 },
          { key: 'errorMessage', title: 'Error Message', width: 42, wrap: true },
          { key: 'changedFields', title: 'Changed Fields', width: 46, wrap: true },
          { key: 'metadata', title: 'Metadata', width: 46, wrap: true },
        ],
        rows: logRows,
      },
      {
        name: 'Timeline',
        columns: [
          { key: 'timestamp', title: 'Timestamp', width: 24 },
          { key: 'requestId', title: 'Request ID', width: 28 },
          { key: 'sessionId', title: 'Session ID', width: 28 },
          { key: 'source', title: 'Source', width: 12 },
          { key: 'eventCategory', title: 'Category', width: 18 },
          { key: 'eventName', title: 'Event', width: 28, wrap: true },
          { key: 'journeyStep', title: 'Journey Step', width: 22 },
          { key: 'action', title: 'Action', width: 16 },
          { key: 'route', title: 'Route', width: 30, wrap: true },
          { key: 'statusCode', title: 'Status', width: 12 },
          { key: 'riskLevel', title: 'Risk', width: 12 },
          { key: 'errorCode', title: 'Error Code', width: 22 },
          { key: 'errorMessage', title: 'Error Message', width: 42, wrap: true },
        ],
        rows: timelineRows,
      },
    ];
  }

  private buildExportFilterSnapshot(queryDto: Partial<GetAuditLogsDto>) {
    return {
      userId: queryDto.userId ?? null,
      requestId: queryDto.requestId ?? null,
      sessionId: queryDto.sessionId ?? null,
      entityType: queryDto.entityType ?? null,
      entityId: queryDto.entityId ?? null,
      action: queryDto.action ?? null,
      dateFrom: queryDto.dateFrom ?? null,
      dateTo: queryDto.dateTo ?? null,
      riskLevel: queryDto.riskLevel ?? null,
      source: queryDto.source ?? null,
      eventCategory: queryDto.eventCategory ?? null,
      statusCode: queryDto.statusCode ?? null,
      errorOnly: queryDto.errorOnly ?? false,
      incidentOnly: queryDto.incidentOnly ?? false,
      component: queryDto.component ?? null,
      fingerprint: queryDto.fingerprint ?? null,
    };
  }

  private escapeCsv(value: unknown): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfWeek(date: Date) {
    const normalized = this.startOfDay(date);
    const day = normalized.getDay();
    const diff = normalized.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(normalized.setDate(diff));
  }

  private isPlainObject(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private transformToResponseDto(entity: AuditLogEntity) {
    const afterData = entity.afterData as Record<string, unknown> | undefined;
    const securityAnalysis = afterData?._security_analysis as SecurityAnalysis | undefined;
    const riskLevel: RiskLevel = securityAnalysis?.riskLevel || 'NORMAL';
    const responseMetadata = this.buildResponseMetadata(entity, securityAnalysis);
    const actorType = String(responseMetadata.actorType || '').toUpperCase();
    const fallbackActor =
      actorType === 'SYSTEM'
        ? { name: 'System', email: 'system@local' }
        : { name: 'Anonymous', email: 'anonymous@local' };

    return {
      id: entity.id,
      actor: {
        id: entity.actor?.id,
        name: entity.actor?.fullName || fallbackActor.name,
        email: entity.actor?.email || fallbackActor.email,
        role: entity.actor?.role,
        avatar: undefined,
      },
      action: entity.action,
      entity: entity.entityId ? `${entity.entityType}#${entity.entityId}` : entity.entityType,
      entityType: entity.entityType,
      entityId: entity.entityId,
      ipAddress: entity.ipAddress || 'unknown',
      timestamp: entity.createdAt.toISOString(),
      riskLevel,
      source: (entity.source as AuditSource | null) || 'SERVER',
      eventCategory:
        (entity.eventCategory as AuditEventCategory | null) ||
        this.resolveEventCategory(entity.action),
      eventName:
        entity.eventName || `${entity.entityType.toLowerCase()}-${entity.action.toLowerCase()}`,
      route: entity.route,
      httpMethod: entity.httpMethod,
      statusCode: entity.statusCode,
      requestId: entity.requestId,
      sessionId: entity.sessionId,
      journeyStep: entity.journeyStep,
      errorCode: entity.errorCode,
      errorMessage: entity.errorMessage,
      changedFields: (entity.changedFields as ChangedField[] | null) || [],
      beforeData: entity.beforeData,
      afterData: entity.afterData,
      metadata: responseMetadata,
    };
  }

  private normalizeMetadata(
    payload: AuditLogPayload,
    actorType: string,
    securityAnalysis: SecurityAnalysis,
  ): AuditMetadataEnvelope {
    const input = (payload.metadata || {}) as AuditMetadataEnvelope;
    const target = this.normalizeTarget(payload, input.target);
    const outcome = this.normalizeOutcome(payload, input.outcome);
    const moduleName = this.normalizeModuleName(payload, input.module);
    const operation = this.normalizeOperation(payload, input.operation);
    const incident = input.incident
      ? {
          ...input.incident,
          fingerprint:
            input.incident.fingerprint ||
            this.buildIncidentFingerprint(
              input.incident.category,
              input.incident.component,
              input.incident.operation,
              payload.errorCode,
              payload.errorMessage || input.summary || payload.eventName || payload.action,
            ),
        }
      : undefined;

    return {
      ...input,
      actorType,
      module: moduleName,
      operation,
      outcome,
      target,
      summary: this.normalizeSummary(payload, input.summary, target, outcome),
      context: this.sanitizeMetadataContext(input.context),
      incident,
      securityAnalysis,
    };
  }

  private buildResponseMetadata(
    entity: AuditLogEntity,
    securityAnalysis?: SecurityAnalysis,
  ): AuditMetadataEnvelope {
    const raw = (entity.metadata || {}) as AuditMetadataEnvelope;
    const incident = raw.incident
      ? {
          ...raw.incident,
          fingerprint:
            raw.incident.fingerprint ||
            this.buildIncidentFingerprint(
              raw.incident.category,
              raw.incident.component,
              raw.incident.operation,
              entity.errorCode || undefined,
              entity.errorMessage || raw.summary || entity.eventName || entity.action,
            ),
        }
      : undefined;

    const target =
      raw.target ||
      ({
        type: entity.entityType,
        id: entity.entityId,
        label: this.resolveTargetLabel(entity.entityType, entity.afterData || entity.beforeData),
      } satisfies AuditTargetContext);

    const outcome = this.normalizeOutcome(
      {
        actorId: entity.actorId,
        action: entity.action,
        entityType: entity.entityType,
        entityId: entity.entityId,
        statusCode: entity.statusCode ?? undefined,
        eventCategory: (entity.eventCategory as AuditEventCategory | null) || undefined,
        eventName: entity.eventName || undefined,
        errorCode: entity.errorCode || undefined,
        errorMessage: entity.errorMessage || undefined,
        metadata: raw,
      },
      raw.outcome,
    );

    return {
      ...raw,
      actorType: raw.actorType || (entity.actorId ? 'USER' : 'SYSTEM'),
      module: raw.module || entity.entityType,
      operation: raw.operation || entity.eventName || entity.action.toLowerCase(),
      outcome,
      summary:
        raw.summary ||
        this.buildDefaultSummary(
          entity.action,
          entity.entityType,
          target,
          outcome,
          entity.eventName || undefined,
        ),
      target,
      context: this.sanitizeMetadataContext(raw.context),
      incident,
      securityAnalysis:
        raw.securityAnalysis ||
        securityAnalysis ||
        ((entity.afterData as Record<string, unknown> | undefined)?._security_analysis as
          | SecurityAnalysis
          | undefined),
      userAgent: entity.userAgent,
      entityType: entity.entityType,
      entityId: entity.entityId,
    };
  }

  private normalizeTarget(
    payload: AuditLogPayload,
    target?: AuditTargetContext,
  ): AuditTargetContext {
    return {
      type: target?.type || payload.entityType,
      id: target?.id || payload.entityId,
      label:
        target?.label ||
        this.resolveTargetLabel(payload.entityType, payload.newData || payload.oldData),
    };
  }

  private normalizeOutcome(
    payload: Partial<AuditLogPayload>,
    outcome?: AuditOutcome,
  ): AuditOutcome {
    if (outcome) {
      return outcome;
    }

    if (
      payload.eventCategory === 'ERROR' ||
      Boolean(payload.errorMessage) ||
      Boolean(payload.errorCode) ||
      (payload.statusCode ?? 0) >= 400
    ) {
      return 'FAILURE';
    }

    return 'SUCCESS';
  }

  private normalizeModuleName(payload: AuditLogPayload, existing?: string): string {
    if (existing) {
      return existing;
    }

    if (payload.eventCategory === 'ERROR') {
      return payload.entityType || 'System';
    }

    return payload.entityType;
  }

  private normalizeOperation(payload: AuditLogPayload, existing?: string): string {
    if (existing) {
      return existing;
    }

    return payload.eventName || payload.action.toLowerCase();
  }

  private normalizeSummary(
    payload: AuditLogPayload,
    existingSummary: string | undefined,
    target: AuditTargetContext,
    outcome: AuditOutcome,
  ): string {
    if (existingSummary) {
      return existingSummary;
    }

    return this.buildDefaultSummary(
      payload.action,
      payload.entityType,
      target,
      outcome,
      payload.eventName,
    );
  }

  private buildDefaultSummary(
    action: string,
    entityType: string,
    target: AuditTargetContext,
    outcome: AuditOutcome,
    eventName?: string,
  ): string {
    const normalizedAction = action.replace(/_/g, ' ').toLowerCase();
    const normalizedEntity = entityType.replace(/([a-z])([A-Z])/g, '$1 $2');
    const targetLabel = target.label || `${target.type} ${target.id}`;
    const targetDescriptor =
      targetLabel === `${target.type} ${target.id}` ? targetLabel : `${targetLabel}`;

    return `${outcome === 'FAILURE' ? 'Failed to' : 'Completed'} ${normalizedAction} on ${normalizedEntity} ${targetDescriptor}`.replace(
      /\s+/g,
      ' ',
    );
  }

  private resolveTargetLabel(
    entityType: string,
    source?: Record<string, unknown> | null,
  ): string | undefined {
    if (!source) {
      return undefined;
    }

    const prioritizedKeys = ['title', 'name', 'fullName', 'email', 'subject', 'label'] as const;
    for (const key of prioritizedKeys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    if (entityType === 'Session') {
      const email = source['email'];
      if (typeof email === 'string' && email.trim()) {
        return email.trim();
      }
    }

    return undefined;
  }

  private sanitizeMetadataContext(
    value: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }

    return this.sanitizeAuditValue(value) as Record<string, unknown>;
  }

  private sanitizeAuditValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (depth > 6) {
      return '[Truncated]';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeAuditValue(item, depth + 1, seen));
    }

    if (this.isPlainObject(value)) {
      if (seen.has(value as object)) {
        return '[Circular]';
      }

      seen.add(value as object);
      const output: Record<string, unknown> = {};

      Object.entries(value as Record<string, unknown>).forEach(([key, currentValue]) => {
        const normalizedKey = key.replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (SENSITIVE_AUDIT_KEYS.some((sensitiveKey) => normalizedKey.includes(sensitiveKey))) {
          output[key] = '[Redacted]';
          return;
        }

        output[key] = this.sanitizeAuditValue(currentValue, depth + 1, seen);
      });

      return output;
    }

    return value;
  }

  private resolveErrorCode(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.name || 'Error';
    }

    return undefined;
  }

  private resolveErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return undefined;
  }

  private buildIncidentFingerprint(
    category: AuditIncidentCategory,
    component: string,
    operation: string,
    errorCode?: string,
    message?: string,
  ): string {
    const normalizedMessage = (message || '')
      .toLowerCase()
      .replace(/[0-9a-f]{8,}/g, ':id')
      .replace(/\d+/g, ':n')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    return [
      category,
      component,
      operation,
      errorCode || 'unknown',
      normalizedMessage || 'no-message',
    ]
      .map((part) =>
        part
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      )
      .join(':');
  }

  private describeActor(actorId: string | null, req?: RequestContext): string {
    if (actorId) {
      return actorId;
    }
    return req ? 'anonymous' : 'system';
  }
}
