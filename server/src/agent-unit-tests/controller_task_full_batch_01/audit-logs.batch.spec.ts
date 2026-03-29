import { BadRequestException, NotFoundException } from '@nestjs/common';

import { UserRole } from 'src/database/entities';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { AuditLogsController } from 'src/modules/audit-logs/audit-logs.controller';
import { GetAuditLogsDto } from 'src/modules/audit-logs/dto/get-audit-logs.dto';

import { assertCurrentTestHasCaseLog } from './test-log-helpers';
import {
  createResponseMock,
  findRouteDescriptor,
  getRouteGuards,
  validateDto,
} from './test-helpers';

const buildAuditLogsQuery = (overrides: Partial<GetAuditLogsDto> = {}) =>
  Object.assign(new GetAuditLogsDto(), overrides);

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

  afterEach(() => {
    assertCurrentTestHasCaseLog();
  });

  describe('EP-004 findAll', () => {
    it('EP-004 UTC01 happy path passes transformed query values to findAll', async () => {
      const query = buildAuditLogsQuery({
        page: 2,
        limit: 5,
        action: 'EXPORT',
        errorOnly: true,
      });
      const payload = {
        data: [{ id: 'audit-1' }],
        meta: { page: 2, limit: 5, total: 1, totalPages: 1 },
        summary: { totalLogs: 1 },
        series: [],
      };
      service.findAll.mockResolvedValue(payload);

      await expect(controller.findAll(query as never)).resolves.toEqual(payload);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 5,
          action: 'EXPORT',
          errorOnly: true,
        }),
      );
    });

    it('EP-004 UTC02 edge case keeps DTO default page and limit values when filters are omitted', async () => {
      const query = buildAuditLogsQuery();
      const payload = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        summary: {},
        series: [],
      };
      service.findAll.mockResolvedValue(payload);

      await expect(controller.findAll(query as never)).resolves.toEqual(payload);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
        }),
      );
    });

    it('EP-004 UTC03 edge case preserves valid low-bound limit and statusCode inputs', async () => {
      const query = buildAuditLogsQuery({
        limit: 1,
        statusCode: 500,
        eventCategory: 'ERROR',
      });
      service.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 1, total: 0, totalPages: 0 },
        summary: {},
        series: [],
      });

      await controller.findAll(query as never);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 1,
          statusCode: 500,
          eventCategory: 'ERROR',
        }),
      );
    });

    it('EP-004 UTC04 validation rejects page values below 1 in GetAuditLogsDto', () => {
      const errors = validateDto(GetAuditLogsDto, { page: 0 });

      expect(errors.some((error) => error.property === 'page')).toBe(true);
    });

    it('EP-004 UTC05 validation rejects unsupported riskLevel values in GetAuditLogsDto', () => {
      const errors = validateDto(GetAuditLogsDto, { riskLevel: 'CRITICAL' });

      expect(errors.some((error) => error.property === 'riskLevel')).toBe(true);
    });

    it('EP-004 UTC06 validation rejects unsupported source values in GetAuditLogsDto', () => {
      const errors = validateDto(GetAuditLogsDto, { source: 'MOBILE' });

      expect(errors.some((error) => error.property === 'source')).toBe(true);
    });

    it('EP-004 UTC07 security declares JwtAuthGuard on findAll', () => {
      expect(getRouteGuards(AuditLogsController, 'findAll')).toContain(JwtAuthGuard);
    });

    it('EP-004 UTC08 security restricts findAll to ADMIN role metadata', () => {
      const route = findRouteDescriptor(AuditLogsController, 'GET', '/audit-logs');

      expect(getRouteGuards(AuditLogsController, 'findAll')).toContain(RolesGuard);
      expect(route?.roles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('EP-005 export', () => {
    it('EP-005 UTC01 happy path exports JSON by default and writes the export audit log', async () => {
      const query = buildAuditLogsQuery();
      const req = { user: { id: 'admin-100' } };
      const res = createResponseMock();

      service.exportLogs.mockResolvedValue({
        buffer: Buffer.from('{"ok":true}'),
        fileName: 'audit-logs.json',
        contentType: 'application/json; charset=utf-8',
      });
      service.log.mockResolvedValue(undefined);

      await controller.export(query as never, req as never, 'admin-100', res as never);

      expect(service.exportLogs).toHaveBeenCalledWith(query);
      expect(service.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-100',
          action: 'EXPORT',
          eventName: 'audit-log-export',
          metadata: expect.objectContaining({ format: 'json' }),
        }),
      );
      expect(res.setHeader).toHaveBeenNthCalledWith(
        1,
        'Content-Type',
        'application/json; charset=utf-8',
      );
      expect(res.setHeader).toHaveBeenNthCalledWith(
        2,
        'Content-Disposition',
        'attachment; filename="audit-logs.json"',
      );
      expect(res.send).toHaveBeenCalledWith(Buffer.from('{"ok":true}'));
    });

    it('EP-005 UTC02 edge case exports CSV with the expected attachment headers', async () => {
      const query = buildAuditLogsQuery({ format: 'csv' });
      const req = { user: { id: 'admin-100' } };
      const res = createResponseMock();

      service.exportLogs.mockResolvedValue({
        buffer: Buffer.from('id\n1'),
        fileName: 'audit-logs.csv',
        contentType: 'text/csv; charset=utf-8',
      });
      service.log.mockResolvedValue(undefined);

      await controller.export(query as never, req as never, 'admin-100', res as never);

      expect(service.exportLogs).toHaveBeenCalledWith(query);
      expect(res.setHeader).toHaveBeenNthCalledWith(1, 'Content-Type', 'text/csv; charset=utf-8');
      expect(res.setHeader).toHaveBeenNthCalledWith(
        2,
        'Content-Disposition',
        'attachment; filename="audit-logs.csv"',
      );
    });

    it('EP-005 UTC03 edge case exports XLSX with the expected attachment headers', async () => {
      const query = buildAuditLogsQuery({ format: 'xlsx' });
      const req = { user: { id: 'admin-100' } };
      const res = createResponseMock();

      service.exportLogs.mockResolvedValue({
        buffer: Buffer.from('xlsx-bytes'),
        fileName: 'audit-logs.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      service.log.mockResolvedValue(undefined);

      await controller.export(query as never, req as never, 'admin-100', res as never);

      expect(service.exportLogs).toHaveBeenCalledWith(query);
      expect(res.setHeader).toHaveBeenNthCalledWith(
        1,
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('EP-005 UTC04 validation rejects unsupported export format values in GetAuditLogsDto', () => {
      const errors = validateDto(GetAuditLogsDto, { format: 'pdf' });

      expect(errors.some((error) => error.property === 'format')).toBe(true);
    });

    it('EP-005 UTC05 validation rejects pagination limit values below 1 in GetAuditLogsDto', () => {
      const errors = validateDto(GetAuditLogsDto, { limit: 0 });

      expect(errors.some((error) => error.property === 'limit')).toBe(true);
    });

    it('EP-005 UTC06 validation bubbles up export service failures without sending a partial response', async () => {
      const query = buildAuditLogsQuery();
      const req = { user: { id: 'admin-9' } };
      const res = createResponseMock();
      const error = new Error('export serialization failed');
      service.exportLogs.mockRejectedValue(error);

      await expect(
        controller.export(query as never, req as never, 'admin-9', res as never),
      ).rejects.toThrow('export serialization failed');
      expect(service.log).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('EP-005 UTC07 security declares JwtAuthGuard on export', () => {
      expect(getRouteGuards(AuditLogsController, 'export')).toContain(JwtAuthGuard);
    });

    it('EP-005 UTC08 security restricts export to ADMIN role metadata', () => {
      const route = findRouteDescriptor(AuditLogsController, 'GET', '/audit-logs/export');

      expect(getRouteGuards(AuditLogsController, 'export')).toContain(RolesGuard);
      expect(route?.roles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('EP-007 getTimeline', () => {
    it('EP-007 UTC01 happy path returns the correlated timeline for an audit log id', async () => {
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

    it('EP-007 UTC04 validation propagates the audit-log not-found business exception', async () => {
      const error = new NotFoundException('Audit log not found');
      service.getTimeline.mockRejectedValue(error);

      await expect(controller.getTimeline('missing-log')).rejects.toThrow(error);
    });

    it('EP-007 UTC05 validation propagates malformed timeline identifier errors', async () => {
      const error = new BadRequestException('Malformed audit correlation id');
      service.getTimeline.mockRejectedValue(error);

      await expect(controller.getTimeline('bad-id')).rejects.toThrow(error);
    });

    it('EP-007 UTC06 validation bubbles up unexpected timeline repository failures', async () => {
      service.getTimeline.mockRejectedValue(new Error('timeline query failed'));

      await expect(controller.getTimeline('audit-500')).rejects.toThrow('timeline query failed');
    });

    it('EP-007 UTC07 security declares JwtAuthGuard on getTimeline', () => {
      expect(getRouteGuards(AuditLogsController, 'getTimeline')).toContain(JwtAuthGuard);
    });

    it('EP-007 UTC08 security restricts getTimeline to ADMIN role metadata', () => {
      const route = findRouteDescriptor(AuditLogsController, 'GET', '/audit-logs/:id/timeline');

      expect(getRouteGuards(AuditLogsController, 'getTimeline')).toContain(RolesGuard);
      expect(route?.roles).toEqual([UserRole.ADMIN]);
    });
  });

  describe('EP-008 findOne', () => {
    it('EP-008 UTC01 happy path returns a detailed audit log view for the input id', async () => {
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

    it('EP-008 UTC04 validation propagates the missing-detail business exception', async () => {
      const error = new NotFoundException('Audit log not found');
      service.findOne.mockRejectedValue(error);

      await expect(controller.findOne('missing-log')).rejects.toThrow(error);
    });

    it('EP-008 UTC05 validation propagates malformed detail identifier errors', async () => {
      const error = new BadRequestException('Malformed audit log id');
      service.findOne.mockRejectedValue(error);

      await expect(controller.findOne('bad-id')).rejects.toThrow(error);
    });

    it('EP-008 UTC06 validation bubbles up unexpected detail query failures', async () => {
      service.findOne.mockRejectedValue(new Error('detail query failed'));

      await expect(controller.findOne('audit-500')).rejects.toThrow('detail query failed');
    });

    it('EP-008 UTC07 security declares JwtAuthGuard on findOne', () => {
      expect(getRouteGuards(AuditLogsController, 'findOne')).toContain(JwtAuthGuard);
    });

    it('EP-008 UTC08 security restricts findOne to ADMIN role metadata', () => {
      const route = findRouteDescriptor(AuditLogsController, 'GET', '/audit-logs/:id');

      expect(getRouteGuards(AuditLogsController, 'findOne')).toContain(RolesGuard);
      expect(route?.roles).toEqual([UserRole.ADMIN]);
    });
  });
});
