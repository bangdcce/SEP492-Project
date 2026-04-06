import request from 'supertest';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';

import { UserRole } from 'src/database/entities';
import { AuditLogsController } from 'src/modules/audit-logs/audit-logs.controller';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';

import { createResponseMock, createRouteTestApp } from './test-helpers';

describe('Audit Logs module cluster', () => {
  let controller: AuditLogsController;
  let service: {
    findAll: jest.Mock;
    exportLogs: jest.Mock;
    log: jest.Mock;
    ingestClientEvents: jest.Mock;
    getTimeline: jest.Mock;
    findOne: jest.Mock;
  };
  let routeService: {
    findAll: jest.Mock;
    exportLogs: jest.Mock;
    log: jest.Mock;
    ingestClientEvents: jest.Mock;
    getTimeline: jest.Mock;
    findOne: jest.Mock;
  };
  let app: INestApplication;

  beforeAll(async () => {
    routeService = {
      findAll: jest.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        summary: {},
        series: [],
      }),
      exportLogs: jest.fn().mockResolvedValue({
        buffer: Buffer.from('[]'),
        fileName: 'audit-logs.json',
        contentType: 'application/json; charset=utf-8',
      }),
      log: jest.fn().mockResolvedValue(undefined),
      ingestClientEvents: jest.fn(),
      getTimeline: jest.fn().mockResolvedValue({ anchor: {}, total: 0, data: [] }),
      findOne: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    app = await createRouteTestApp({
      controllers: [AuditLogsController],
      providers: [{ provide: AuditLogsService, useValue: routeService }],
    });
  });

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      exportLogs: jest.fn(),
      log: jest.fn(),
      ingestClientEvents: jest.fn(),
      getTimeline: jest.fn(),
      findOne: jest.fn(),
    };
    controller = new AuditLogsController(service as never);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('EP-004 GET /audit-logs', () => {
    it('EP-004 UTC01 happy path transforms query params and returns a paginated audit list', async () => {
      routeService.findAll.mockResolvedValueOnce({
        data: [{ id: 'audit-1' }],
        meta: { page: 2, limit: 5, total: 1, totalPages: 1 },
        summary: { totalLogs: 1 },
        series: [],
      });

      const response = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ page: '2', limit: '5', action: 'EXPORT', errorOnly: 'true' })
        .expect(200);

      expect(response.body.meta).toEqual(
        expect.objectContaining({ page: 2, limit: 5, total: 1, totalPages: 1 }),
      );
      expect(routeService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 5,
          action: 'EXPORT',
          errorOnly: true,
        }),
      );
    });

    it('EP-004 UTC02 edge case keeps DTO defaults when filters are omitted', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .expect(200);

      expect(routeService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
        }),
      );
    });

    it('EP-004 UTC03 edge case preserves valid low-bound limit and statusCode filters', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ limit: '1', statusCode: '500', eventCategory: 'ERROR' })
        .expect(200);

      expect(routeService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 1,
          statusCode: 500,
          eventCategory: 'ERROR',
        }),
      );
    });

    it('EP-004 UTC04 validation returns 400 when page is below 1', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ page: '0' })
        .expect(400);
    });

    it('EP-004 UTC05 validation returns 400 for an unsupported riskLevel', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ riskLevel: 'CRITICAL' })
        .expect(400);
    });

    it('EP-004 UTC06 validation returns 400 for an unsupported source filter', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ source: 'MOBILE' })
        .expect(400);
    });

    it('EP-004 UTC07 security returns 401 when the caller is unauthenticated', async () => {
      await request(app.getHttpServer()).get('/audit-logs').expect(401);
    });

    it('EP-004 UTC08 security returns 403 when the caller is not an admin', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.STAFF)
        .expect(403);
    });
  });

  describe('EP-005 GET /audit-logs/export', () => {
    it('EP-005 UTC01 happy path exports JSON by default and records the export event', async () => {
      routeService.exportLogs.mockResolvedValueOnce({
        buffer: Buffer.from('{"ok":true}'),
        fileName: 'audit-logs.json',
        contentType: 'application/json; charset=utf-8',
      });

      await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .set('x-test-user-id', 'admin-100')
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .expect('Content-Disposition', 'attachment; filename="audit-logs.json"');

      expect(routeService.exportLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
      expect(routeService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-100',
          action: 'EXPORT',
          eventName: 'audit-log-export',
          metadata: expect.objectContaining({ format: 'json' }),
        }),
      );
    });

    it('EP-005 UTC02 edge case exports CSV with the expected attachment headers', async () => {
      routeService.exportLogs.mockResolvedValueOnce({
        buffer: Buffer.from('id\n1'),
        fileName: 'audit-logs.csv',
        contentType: 'text/csv; charset=utf-8',
      });

      await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ format: 'csv' })
        .expect(200)
        .expect('Content-Type', /text\/csv/)
        .expect('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    });

    it('EP-005 UTC03 edge case exports XLSX with the expected attachment headers', async () => {
      routeService.exportLogs.mockResolvedValueOnce({
        buffer: Buffer.from('xlsx-bytes'),
        fileName: 'audit-logs.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ format: 'xlsx' })
        .expect(200)
        .expect('Content-Type', /application\/vnd\.openxmlformats-officedocument/);
    });

    it('EP-005 UTC04 validation returns 400 for an unsupported export format', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ format: 'pdf' })
        .expect(400);
    });

    it('EP-005 UTC05 validation returns 400 for an invalid pagination limit', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.ADMIN)
        .query({ limit: '0' })
        .expect(400);
    });

    it('EP-005 UTC06 validation bubbles up export service failures without sending a partial response', async () => {
      const req = { user: { id: 'admin-9' } };
      const res = createResponseMock();
      const error = new Error('export serialization failed');
      service.exportLogs.mockRejectedValue(error);

      await expect(
        controller.export({} as never, req as never, 'admin-9', res as never),
      ).rejects.toThrow('export serialization failed');
      expect(service.log).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('EP-005 UTC07 security returns 401 when the caller is unauthenticated', async () => {
      await request(app.getHttpServer()).get('/audit-logs/export').expect(401);
    });

    it('EP-005 UTC08 security returns 403 when the caller is not an admin', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs/export')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.STAFF)
        .expect(403);
    });
  });

  describe('EP-007 GET /audit-logs/:id/timeline', () => {
    it('EP-007 UTC01 happy path returns the correlated timeline for an audit log', async () => {
      const payload = { anchor: { id: 'audit-1' }, total: 3, data: [{ id: 'audit-1' }] };
      service.getTimeline.mockResolvedValue(payload);

      await expect(controller.getTimeline('audit-1')).resolves.toEqual(payload);
      expect(service.getTimeline).toHaveBeenCalledWith('audit-1');
    });

    it('EP-007 UTC02 edge case returns a single-entry request correlation timeline', async () => {
      const payload = {
        anchor: { id: 'audit-1', requestId: 'req-1' },
        correlationType: 'requestId',
        total: 1,
        data: [{ id: 'audit-1' }],
      };
      service.getTimeline.mockResolvedValue(payload);

      await expect(controller.getTimeline('audit-request')).resolves.toEqual(payload);
    });

    it('EP-007 UTC03 edge case returns an actor-scoped timeline when requestId is absent', async () => {
      const payload = {
        anchor: { id: 'audit-2', actor: { email: 'admin@example.com' } },
        correlationType: 'actorId',
        total: 2,
        data: [{ id: 'audit-2' }, { id: 'audit-3' }],
      };
      service.getTimeline.mockResolvedValue(payload);

      await expect(controller.getTimeline('audit-actor')).resolves.toEqual(payload);
    });

    it('EP-007 UTC04 validation propagates a 404 when the audit log does not exist', async () => {
      const error = new NotFoundException('Audit log not found');
      service.getTimeline.mockRejectedValue(error);

      await expect(controller.getTimeline('missing-log')).rejects.toThrow(error);
    });

    it('EP-007 UTC05 validation propagates a bad request for malformed timeline identifiers', async () => {
      const error = new BadRequestException('Malformed audit correlation id');
      service.getTimeline.mockRejectedValue(error);

      await expect(controller.getTimeline('bad-id')).rejects.toThrow(error);
    });

    it('EP-007 UTC06 validation bubbles up unexpected timeline repository failures', async () => {
      service.getTimeline.mockRejectedValue(new Error('timeline query failed'));

      await expect(controller.getTimeline('audit-500')).rejects.toThrow('timeline query failed');
    });

    it('EP-007 UTC07 security returns 401 when the caller is unauthenticated', async () => {
      await request(app.getHttpServer()).get('/audit-logs/audit-1/timeline').expect(401);
    });

    it('EP-007 UTC08 security returns 403 when the caller is not an admin', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs/audit-1/timeline')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.STAFF)
        .expect(403);
    });
  });

  describe('EP-008 GET /audit-logs/:id', () => {
    it('EP-008 UTC01 happy path returns a detailed audit log view', async () => {
      const payload = { id: 'audit-1', action: 'EXPORT', entityType: 'AuditLog' };
      service.findOne.mockResolvedValue(payload);

      await expect(controller.findOne('audit-1')).resolves.toEqual(payload);
      expect(service.findOne).toHaveBeenCalledWith('audit-1');
    });

    it('EP-008 UTC02 edge case returns a detail payload with high-risk metadata', async () => {
      const payload = {
        id: 'audit-high',
        riskLevel: 'HIGH',
        metadata: { actorType: 'USER', securityAnalysis: { riskLevel: 'HIGH' } },
      };
      service.findOne.mockResolvedValue(payload);

      await expect(controller.findOne('audit-high')).resolves.toEqual(payload);
    });

    it('EP-008 UTC03 edge case returns a detail payload for anonymous actors', async () => {
      const payload = {
        id: 'audit-anon',
        actor: { name: 'Anonymous', email: 'anonymous@local' },
      };
      service.findOne.mockResolvedValue(payload);

      await expect(controller.findOne('audit-anon')).resolves.toEqual(payload);
    });

    it('EP-008 UTC04 validation propagates a 404 when the detail record is missing', async () => {
      const error = new NotFoundException('Audit log not found');
      service.findOne.mockRejectedValue(error);

      await expect(controller.findOne('missing-log')).rejects.toThrow(error);
    });

    it('EP-008 UTC05 validation propagates a bad request for malformed detail identifiers', async () => {
      const error = new BadRequestException('Malformed audit log id');
      service.findOne.mockRejectedValue(error);

      await expect(controller.findOne('bad-id')).rejects.toThrow(error);
    });

    it('EP-008 UTC06 validation bubbles up unexpected detail query failures', async () => {
      service.findOne.mockRejectedValue(new Error('detail query failed'));

      await expect(controller.findOne('audit-500')).rejects.toThrow('detail query failed');
    });

    it('EP-008 UTC07 security returns 401 when the caller is unauthenticated', async () => {
      await request(app.getHttpServer()).get('/audit-logs/audit-1').expect(401);
    });

    it('EP-008 UTC08 security returns 403 when the caller is not an admin', async () => {
      await request(app.getHttpServer())
        .get('/audit-logs/audit-1')
        .set('x-test-auth', 'ok')
        .set('x-test-role', UserRole.STAFF)
        .expect(403);
    });
  });
});
