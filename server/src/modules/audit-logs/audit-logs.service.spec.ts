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
    getMany: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: {
            createQueryBuilder: jest.fn(() => builder),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
        riskLevel: 'LOW',
        beforeData: null,
        afterData: null,
        createdAt: new Date('2026-03-15T08:00:00.000Z'),
        actor: {
          id: 'admin-1',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
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
        riskLevel: 'NORMAL',
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
        riskLevel: 'HIGH',
        requestId: 'req-1',
        sessionId: 'sess-1',
        source: 'SERVER',
        eventCategory: 'EXPORT',
        eventName: 'EXPORT_AUDIT_LOG',
        changedFields: [{ field: 'status', before: 'OPEN', after: 'EXPORTED' }],
        beforeData: null,
        afterData: null,
        metadata: { userAgent: 'jest' },
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
});
