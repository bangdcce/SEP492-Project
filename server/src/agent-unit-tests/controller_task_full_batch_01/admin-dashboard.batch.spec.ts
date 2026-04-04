import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

import { UserRole } from 'src/database/entities';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { AdminDashboardController } from 'src/modules/admin-dashboard/admin-dashboard.controller';

import { assertCurrentTestHasCaseLog } from './test-log-helpers';
import { findRouteDescriptor, getRouteGuards } from './test-helpers';

describe('Admin Dashboard module cluster', () => {
  let controller: AdminDashboardController;
  let service: { getOverview: jest.Mock };

  beforeEach(() => {
    service = {
      getOverview: jest.fn(),
    };
    controller = new AdminDashboardController(service as never);
    jest.clearAllMocks();
  });

  afterEach(() => {
    assertCurrentTestHasCaseLog();
  });

  it('EP-003 UTC01 happy path returns overview for a valid range input', async () => {
    const payload = { generatedAt: '2026-03-29T08:00:00.000Z', range: '7d' };
    service.getOverview.mockResolvedValue(payload);

    await expect(controller.getOverview('7d')).resolves.toEqual(payload);
    expect(service.getOverview).toHaveBeenCalledWith('7d');
  });

  it('EP-003 UTC02 edge case defaults the range input to 30d when it is omitted', async () => {
    service.getOverview.mockResolvedValue({ range: '30d' });

    await expect(controller.getOverview(undefined)).resolves.toEqual({ range: '30d' });
    expect(service.getOverview).toHaveBeenCalledWith('30d');
  });

  it('EP-003 UTC03 edge case normalizes an unsupported range input to 30d', async () => {
    service.getOverview.mockResolvedValue({ range: '30d' });

    await expect(controller.getOverview('365d' as never)).resolves.toEqual({ range: '30d' });
    expect(service.getOverview).toHaveBeenCalledWith('30d');
  });

  it('EP-003 UTC04 validation propagates the business exception for an unsupported range', async () => {
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

  it('EP-003 UTC07 security declares JwtAuthGuard on the overview method', () => {
    expect(getRouteGuards(AdminDashboardController, 'getOverview')).toContain(JwtAuthGuard);
  });

  it('EP-003 UTC08 security restricts the overview method to ADMIN role metadata', () => {
    const route = findRouteDescriptor(
      AdminDashboardController,
      'GET',
      '/admin/dashboard/overview',
    );

    expect(getRouteGuards(AdminDashboardController, 'getOverview')).toContain(RolesGuard);
    expect(route?.roles).toEqual([UserRole.ADMIN]);
  });
});
