import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { AuditLogsService } from '../audit-logs.service';

@Catch()
export class AuditTrailExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuditTrailExceptionFilter.name);

  constructor(private readonly auditLogsService: AuditLogsService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status = this.resolveStatus(exception);
    const payload = this.resolveErrorPayload(exception);

    await this.auditLogsService.log({
      actorId: this.auditLogsService.extractActorId(request),
      action: 'ERROR',
      entityType: 'HttpRequest',
      entityId:
        ((request.headers['x-request-id'] as string | undefined) || (request as any).requestId || '') ||
        `${request.method}:${request.originalUrl || request.url}`,
      req: request,
      source: 'SERVER',
      eventCategory: 'ERROR',
      eventName: 'request-failed',
      statusCode: status,
      errorCode: payload.code,
      errorMessage: payload.message,
      metadata: {
        exceptionName: exception instanceof Error ? exception.name : 'UnknownError',
        path: request.originalUrl || request.url,
      },
    });

    if (response.headersSent) {
      return;
    }

    this.logger.error(
      `HTTP ${status} ${request.method} ${request.originalUrl || request.url}: ${payload.message}`,
    );

    response.status(status).json(payload.body);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (exception instanceof QueryFailedError) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveErrorPayload(exception: unknown): {
    code: string;
    message: string;
    body: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          code: exception.name,
          message: response,
          body: {
            statusCode: exception.getStatus(),
            message: response,
            error: exception.name,
          },
        };
      }

      const body = response as Record<string, unknown>;
      const message = Array.isArray(body.message) ? body.message.join(', ') : String(body.message);

      return {
        code: typeof body.error === 'string' ? body.error : exception.name,
        message,
        body,
      };
    }

    if (exception instanceof Error) {
      return {
        code: exception.name,
        message: exception.message,
        body: {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: exception.message || 'Internal server error',
          error: exception.name || 'InternalServerError',
        },
      };
    }

    return {
      code: 'InternalServerError',
      message: 'Internal server error',
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'InternalServerError',
      },
    };
  }
}
