import request from 'supertest';
import { BadRequestException, INestApplication, ServiceUnavailableException } from '@nestjs/common';

import { UserRole } from 'src/database/entities';
import { AdminDashboardController } from 'src/modules/admin-dashboard/admin-dashboard.controller';
import { AdminDashboardService } from 'src/modules/admin-dashboard/admin-dashboard.service';

import { createRouteTestApp } from './test-helpers';

describe('Admin Dashboard module cluster', () => {
  let controller: AdminDashboardController;
  let service: { getOverview: jest.Mock };
  let routeService: { getOverview: jest.Mock };
  let app: INestApplication;

  beforeAll(async () => {
    routeService = {
      getOverview: jest.fn().mockResolvedValue({
        generatedAt: '2026-03-29T08:00:00.000Z',
        range: '30d',
        summary: {},
      }),
    };

    app = await createRouteTestApp({
      controllers: [AdminDashboardController],
      providers: [{ provide: AdminDashboardService, useValue: routeService }],
    });
  });

  beforeEach(() => {
    service = {
      getOverview: jest.fn(),
    };
    controller = new AdminDashboardController(service as never);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('EP-003 UTC01 happy path returns overview for a valid range', async () => {
    const payload = { generatedAt: '2026-03-29T08:00:00.000Z', range: '7d' };
    service.getOverview.mockResolvedValue(payload);

    await expect(controller.getOverview('7d')).resolves.toEqual(payload);
    expect(service.getOverview).toHaveBeenCalledWith('7d');
  });

  it('EP-003 UTC02 edge case defaults to 30d when range is omitted', async () => {
    service.getOverview.mockResolvedValue({ range: '30d' });

    await expect(controller.getOverview(undefined)).resolves.toEqual({ range: '30d' });
    expect(service.getOverview).toHaveBeenCalledWith('30d');
  });

  it('EP-003 UTC03 edge case falls back to 30d for an unsupported range token', async () => {
    service.getOverview.mockResolvedValue({ range: '30d' });

    await expect(controller.getOverview('365d' as never)).resolves.toEqual({ range: '30d' });
    expect(service.getOverview).toHaveBeenCalledWith('30d');
  });

  it('EP-003 UTC04 validation propagates a bad request from the analytics service', async () => {
    const error = new BadRequestException('Unsupported dashboard range');
    service.getOverview.mockRejectedValue(error);

    await expect(controller.getOverview('90d')).rejects.toThrow(error);
  });

  it('EP-003 UTC05 validation propagates a temporary analytics outage', async () => {
    const error = new ServiceUnavailableException('Analytics cache unavailable');
    service.getOverview.mockRejectedValue(error);

    await expect(controller.getOverview('30d')).rejects.toThrow(error);
  });

  it('EP-003 UTC06 validation bubbles up unexpected repository failures', async () => {
    const error = new Error('dashboard query failed');
    service.getOverview.mockRejectedValue(error);

    await expect(controller.getOverview('7d')).rejects.toThrow('dashboard query failed');
  });

  it('EP-003 UTC07 security returns 401 for an unauthenticated overview request', async () => {
    await request(app.getHttpServer()).get('/admin/dashboard/overview').expect(401);
  });

  it('EP-003 UTC08 security returns 403 for a non-admin overview request', async () => {
    await request(app.getHttpServer())
      .get('/admin/dashboard/overview')
      .set('x-test-auth', 'ok')
      .set('x-test-role', UserRole.STAFF)
      .expect(403);
  });
});
