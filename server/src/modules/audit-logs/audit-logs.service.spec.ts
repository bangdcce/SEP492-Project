import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogEntity } from '../../database/entities';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let builder: {
    leftJoinAndSelect: jest.Mock;
    select: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    where: jest.Mock;
    getMany: jest.Mock;
    getManyAndCount: jest.Mock;
    getOne: jest.Mock;
  };
  let repository: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    repository = {
      createQueryBuilder: jest.fn(() => builder),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns null actor id for anonymous requests', () => {
    expect(service.extractActorId()).toBeNull();
    expect(service.extractActorId({})).toBeNull();
    expect(service.extractActorId({ user: { id: 'user-1' } })).toBe('user-1');
  });

  it('persists structured system incidents with normalized metadata', async () => {
    const saved = await service.logSystemIncident({
      component: 'TasksService',
      operation: 'upload-file',
      summary: 'Task attachment upload failed',
      severity: 'HIGH',
      category: 'STORAGE',
      error: new Error('bucket unavailable'),
      target: {
        type: 'StorageBucket',
        id: 'task-attachments',
        label: 'task-attachments',
      },
      context: {
        bucket: 'task-attachments',
        authorization: 'secret-token',
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ERROR',
        entityType: 'StorageBucket',
        eventCategory: 'ERROR',
        errorMessage: 'bucket unavailable',
        metadata: expect.objectContaining({
          module: 'TasksService',
          operation: 'upload-file',
          outcome: 'FAILURE',
          summary: 'Task attachment upload failed',
          incident: expect.objectContaining({
            scope: 'SYSTEM',
            category: 'STORAGE',
            component: 'TasksService',
          }),
          context: expect.objectContaining({
            bucket: 'task-attachments',
            authorization: '[Redacted]',
          }),
        }),
      }),
    );
    expect(saved).toEqual(
      expect.objectContaining({
        action: 'ERROR',
        entityType: 'StorageBucket',
      }),
    );
  });

  it('applies incident filters for drill-down queries', async () => {
    await service.findAll({
      incidentOnly: true,
      component: 'WorkspaceChatGateway',
      fingerprint: 'websocket:workspacechatgateway:send-project-message:error',
      page: 1,
      limit: 20,
    });

    expect(builder.andWhere).toHaveBeenCalledWith(
      `(log.event_category = :incidentCategory AND log.metadata->'incident'->>'scope' = :incidentScope)`,
      expect.objectContaining({
        incidentCategory: 'ERROR',
        incidentScope: 'SYSTEM',
      }),
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      `COALESCE(log.metadata->'incident'->>'component', '') ILIKE :component`,
      { component: '%WorkspaceChatGateway%' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      `log.metadata->'incident'->>'fingerprint' = :fingerprint`,
      { fingerprint: 'websocket:workspacechatgateway:send-project-message:error' },
    );
  });

  it('exports JSON payloads with metadata', async () => {
    builder.getMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'EXPORT',
        entityType: 'Dispute',
        entityId: 'dispute-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        beforeData: null,
        afterData: null,
        createdAt: new Date('2026-03-15T08:00:00.000Z'),
        actor: {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
        },
        metadata: {
          summary: 'Exported dispute audit payload',
        },
      },
    ]);

    const exported = await service.exportLogs({
      format: 'json',
      entityId: 'dispute-1',
    });

    expect(exported.contentType).toContain('application/json');
    expect(exported.fileName).toMatch(/audit-logs-.*\.json/);
    expect(exported.buffer.toString('utf8')).toContain('"entityId": "dispute-1"');
  });

  it('exports CSV payloads with dispute entity ids', async () => {
    builder.getMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'VIEW',
        entityType: 'Dispute',
        entityId: 'dispute-2',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        beforeData: null,
        afterData: null,
        createdAt: new Date('2026-03-15T09:00:00.000Z'),
        actor: {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
        },
      },
    ]);

    const exported = await service.exportLogs({
      format: 'csv',
      entityId: 'dispute-2',
    });

    const csv = exported.buffer.toString('utf8');
    expect(exported.contentType).toContain('text/csv');
    expect(csv).toContain('"entityId"');
    expect(csv).toContain('"dispute-2"');
  });

  it('sanitizes spreadsheet formula payloads in CSV exports', async () => {
    builder.getMany.mockResolvedValue([
      {
        id: 'log-1',
        action: '=HYPERLINK("http://malicious")',
        entityType: 'Dispute',
        entityId: 'dispute-3',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        beforeData: null,
        afterData: null,
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        actor: {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
        },
      },
    ]);

    const exported = await service.exportLogs({
      format: 'csv',
      entityId: 'dispute-3',
    });

    const csv = exported.buffer.toString('utf8');
    expect(csv).toContain('"\'=HYPERLINK(""http://malicious"")"');
  });

  it('exports XLSX workbooks for audit analytics exports', async () => {
    builder.getMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'EXPORT',
        entityType: 'AuditLog',
        entityId: 'export-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        route: '/admin/audit-logs/export',
        httpMethod: 'GET',
        statusCode: 200,
        requestId: 'req-1',
        sessionId: 'sess-1',
        source: 'SERVER',
        eventCategory: 'EXPORT',
        eventName: 'EXPORT_AUDIT_LOG',
        changedFields: [{ path: 'status', before: 'OPEN', after: 'EXPORTED' }],
        beforeData: null,
        afterData: null,
        metadata: { userAgent: 'jest', summary: 'Exported audit log workbook' },
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        actor: {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
        },
      },
    ]);

    const exported = await service.exportLogs({
      format: 'xlsx',
      requestId: 'req-1',
    });

    expect(exported.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(exported.fileName).toMatch(/audit-logs-.*\.xlsx/);
    expect(exported.buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('classifies normal login as NORMAL risk level', async () => {
    await service.logLogin(
      'user-1',
      { success: true },
      {
        ip: '203.0.113.10',
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN',
        afterData: expect.objectContaining({
          _security_analysis: expect.objectContaining({
            baseRiskLevel: 'NORMAL',
            riskLevel: 'NORMAL',
            flags: [],
          }),
        }),
      }),
    );
  });

  it('does not elevate login risk for automation user-agent in non-production environments', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    try {
      await service.logLogin(
        'user-2',
        { success: true },
        {
          ip: '203.0.113.11',
          headers: { 'user-agent': 'axios/1.7.0' },
        },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          afterData: expect.objectContaining({
            _security_analysis: expect.objectContaining({
              riskLevel: 'NORMAL',
              flags: [],
            }),
          }),
        }),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('still marks suspicious automation user-agent as HIGH in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await service.logLogin(
        'user-3',
        { success: true },
        {
          ip: '203.0.113.12',
          headers: { 'user-agent': 'curl/8.5.0' },
        },
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN',
          afterData: expect.objectContaining({
            _security_analysis: expect.objectContaining({
              baseRiskLevel: 'NORMAL',
              riskLevel: 'HIGH',
              flags: expect.arrayContaining(['SUSPICIOUS_USER_AGENT']),
            }),
          }),
        }),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
