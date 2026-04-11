import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AuditTrailExceptionFilter } from './audit-trail-exception.filter';

describe('AuditTrailExceptionFilter', () => {
  const createHost = (request: Record<string, unknown>, response: Record<string, unknown>) =>
    ({
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
        getResponse: () => response,
      }),
    }) as unknown as ArgumentsHost;

  it('logs 5xx errors as system incidents', async () => {
    const auditLogsService = {
      log: jest.fn(),
      logSystemIncident: jest.fn().mockResolvedValue(undefined),
      extractActorId: jest.fn().mockReturnValue('admin-1'),
    };

    const filter = new AuditTrailExceptionFilter(auditLogsService as never);
    const request = {
      method: 'GET',
      originalUrl: '/admin/dashboard/overview',
      headers: {
        'x-request-id': 'req-500',
      },
    };
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await filter.catch(
      new HttpException('Database offline', HttpStatus.INTERNAL_SERVER_ERROR),
      createHost(request, response),
    );

    expect(auditLogsService.logSystemIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'HttpExceptionFilter',
        category: 'HTTP_5XX',
        severity: 'CRITICAL',
        requestId: 'req-500',
      }),
    );
    expect(auditLogsService.log).not.toHaveBeenCalled();
  });

  it('keeps 4xx errors on the regular audit path', async () => {
    const auditLogsService = {
      log: jest.fn().mockResolvedValue(undefined),
      logSystemIncident: jest.fn(),
      extractActorId: jest.fn().mockReturnValue('admin-1'),
    };

    const filter = new AuditTrailExceptionFilter(auditLogsService as never);
    const request = {
      method: 'POST',
      originalUrl: '/admin/reviews',
      headers: {},
    };
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await filter.catch(
      new HttpException('Validation failed', HttpStatus.BAD_REQUEST),
      createHost(request, response),
    );

    expect(auditLogsService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'ERROR',
        statusCode: HttpStatus.BAD_REQUEST,
      }),
    );
    expect(auditLogsService.logSystemIncident).not.toHaveBeenCalled();
  });
});
