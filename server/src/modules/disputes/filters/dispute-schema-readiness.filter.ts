import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';

type SchemaMismatchPayload = {
  statusCode: number;
  code:
    | 'DISPUTE_INTERNAL_MEMBERSHIP_TABLE_MISSING'
    | 'DISPUTE_HEARING_NOSHOWNOTE_COLUMN_MISSING'
    | 'STAFF_PERFORMANCE_UPSERT_CONSTRAINT_MISSING'
    | 'STAFF_WORKLOAD_UPSERT_CONSTRAINT_MISSING'
    | 'DISPUTE_SCHEMA_NOT_READY';
  message: string;
  remediation: string;
  details: {
    path: string;
    dbCode?: string;
  };
};

@Catch(QueryFailedError)
export class DisputeSchemaReadinessFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DisputeSchemaReadinessFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const path = request?.originalUrl || request?.url || '';
    const dbCode = this.resolveDatabaseErrorCode(exception);

    if (!this.shouldHandle(path, dbCode)) {
      super.catch(exception, host);
      return;
    }

    const payload = this.buildPayload(exception, path, dbCode);
    this.logger.error(
      `Mapped schema mismatch to 503 for ${path} (dbCode=${dbCode || 'unknown'}, code=${payload.code})`,
    );

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json(payload);
  }

  private shouldHandle(path: string, dbCode?: string): boolean {
    if (!path.startsWith('/disputes')) {
      return false;
    }
    return dbCode === '42P01' || dbCode === '42703' || dbCode === '42P10';
  }

  private resolveDatabaseErrorCode(exception: QueryFailedError): string | undefined {
    const driverError = exception as QueryFailedError & {
      code?: string;
      driverError?: { code?: string };
    };
    return driverError.driverError?.code ?? driverError.code;
  }

  private buildPayload(
    exception: QueryFailedError,
    path: string,
    dbCode?: string,
  ): SchemaMismatchPayload {
    const message = `${exception.message || ''}`.toLowerCase();

    if (message.includes('dispute_internal_memberships')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DISPUTE_INTERNAL_MEMBERSHIP_TABLE_MISSING',
        message:
          'Internal case membership schema is not ready. This workspace is temporarily unavailable.',
        remediation:
          'Run server migrations and ensure CreateDisputeInternalMemberships1772300000000 is applied.',
        details: { path, dbCode },
      };
    }

    if (message.includes('noshownote')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DISPUTE_HEARING_NOSHOWNOTE_COLUMN_MISSING',
        message:
          'Hearing schema is not ready. Hearing listing endpoints are temporarily unavailable.',
        remediation:
          'Run server migrations and ensure AddNoShowNoteToDisputeHearings1772305000000 is applied.',
        details: { path, dbCode },
      };
    }

    if (message.includes('staff_performances')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'STAFF_PERFORMANCE_UPSERT_CONSTRAINT_MISSING',
        message:
          'Staff performance schema is not ready for upsert. Verdict issuance is temporarily unavailable.',
        remediation:
          'Run server migrations and ensure EnsureStaffPerformanceUpsertConstraint1772315000000 is applied.',
        details: { path, dbCode },
      };
    }

    if (message.includes('staff_workloads')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'STAFF_WORKLOAD_UPSERT_CONSTRAINT_MISSING',
        message:
          'Staff workload schema is not ready for upsert. Workload/calendar updates are temporarily unavailable.',
        remediation:
          'Run server migrations and ensure EnsureStaffWorkloadUpsertConstraint1772316000000 is applied.',
        details: { path, dbCode },
      };
    }

    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'DISPUTE_SCHEMA_NOT_READY',
      message: 'Dispute/Hearing schema is not ready. Please retry after schema migration.',
      remediation:
        'Run server migrations and confirm readiness endpoint reports status=ready before serving traffic.',
      details: { path, dbCode },
    };
  }
}
