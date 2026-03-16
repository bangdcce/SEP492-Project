import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

type MigrationReadinessReport = {
  pending: string[];
};

type DisputePhaseEnumReport = {
  existing: string[];
  missing: string[];
};

type DisputeSchemaReadinessReport = {
  hasInternalMembershipTable: boolean;
  hasHearingNoShowNoteColumn: boolean;
  hasHearingStatementsTable: boolean;
  hasStructuredHearingStatementColumns: boolean;
  hasHearingQuestionsTable: boolean;
  hasHearingQuestionWorkspaceColumns: boolean;
  hasHearingParticipantWorkspaceColumns: boolean;
  hasDisputeMessageEvidenceColumn: boolean;
  hasStaffPerformanceUpsertConstraint: boolean;
  hasStaffWorkloadUpsertConstraint: boolean;
};

const REQUIRED_DISPUTE_PHASE_ENUM_VALUES = [
  'PRESENTATION',
  'EVIDENCE_SUBMISSION',
  'CROSS_EXAMINATION',
  'INTERROGATION',
  'DELIBERATION',
] as const;

@Injectable()
export class HealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const report = await this.getMigrationReadinessReport();
      if (report.pending.length > 0) {
        this.logger.warn(
          `Pending migrations detected at startup (${report.pending.length}): ${report.pending.join(
            ', ',
          )}`,
        );
      } else {
        this.logger.log('Migration readiness check passed (no pending migrations).');
      }

      const enumReport = await this.getDisputePhaseEnumReport();
      if (enumReport.missing.length > 0) {
        this.logger.warn(
          `disputes_phase_enum is missing values: ${enumReport.missing.join(', ')}. ` +
            'Run migrations and verify schema consistency before enabling verdict flow.',
        );
      } else {
        this.logger.log('disputes_phase_enum readiness check passed.');
      }

      const schemaReport = await this.getDisputeSchemaReadinessReport();
      if (!schemaReport.hasInternalMembershipTable) {
        this.logger.warn(
          'dispute_internal_memberships table is missing. Run migrations before serving dispute internal workspace.',
        );
      } else {
        this.logger.log('dispute_internal_memberships schema check passed.');
      }

      if (!schemaReport.hasHearingNoShowNoteColumn) {
        this.logger.warn(
          'dispute_hearings.noShowNote column is missing. Run migrations before serving hearing list endpoints.',
        );
      } else {
        this.logger.log('dispute_hearings.noShowNote schema check passed.');
      }

      if (
        !schemaReport.hasHearingStatementsTable ||
        !schemaReport.hasStructuredHearingStatementColumns
      ) {
        this.logger.warn(
          'hearing_statements workspace columns are missing. Run migrations before serving hearing workspace statements.',
        );
      } else {
        this.logger.log('hearing_statements structured schema check passed.');
      }

      if (!schemaReport.hasHearingQuestionsTable) {
        this.logger.warn(
          'hearing_questions table is missing. Run migrations before serving hearing workspace Q&A flows.',
        );
      } else {
        this.logger.log('hearing_questions schema check passed.');
      }

      if (!schemaReport.hasHearingQuestionWorkspaceColumns) {
        this.logger.warn(
          'hearing_questions workspace columns are missing. Run migrations or align entity mappings before serving hearing workspace Q&A flows.',
        );
      } else {
        this.logger.log('hearing_questions workspace column check passed.');
      }

      if (!schemaReport.hasHearingParticipantWorkspaceColumns) {
        this.logger.warn(
          'hearing_participants workspace columns are missing. Run migrations or align entity mappings before serving hearing workspace statements.',
        );
      } else {
        this.logger.log('hearing_participants workspace column check passed.');
      }

      if (!schemaReport.hasDisputeMessageEvidenceColumn) {
        this.logger.warn(
          'dispute_messages.attached_evidence_ids column is missing. Run migrations or align entity mappings before serving dispute workspace messages.',
        );
      } else {
        this.logger.log('dispute_messages.attached_evidence_ids schema check passed.');
      }

      if (!schemaReport.hasStaffPerformanceUpsertConstraint) {
        this.logger.warn(
          'Unique conflict target for staff_performances(staffId, period) is missing. Run migrations before serving verdict/performance upsert flows.',
        );
      } else {
        this.logger.log('staff_performances upsert constraint schema check passed.');
      }

      if (!schemaReport.hasStaffWorkloadUpsertConstraint) {
        this.logger.warn(
          'Unique conflict target for staff_workloads(staffId, date) is missing. Run migrations before serving workload/calendar upsert flows.',
        );
      } else {
        this.logger.log('staff_workloads upsert constraint schema check passed.');
      }
    } catch (error) {
      this.logger.warn(
        `Migration readiness startup check failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  getLiveStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadinessStatus() {
    await this.assertDatabaseReachable();
    const schemaReport = await this.getDisputeSchemaReadinessReport();
    if (!schemaReport.hasInternalMembershipTable) {
      throw new ServiceUnavailableException({
        code: 'DISPUTE_INTERNAL_MEMBERSHIP_TABLE_MISSING',
        message:
          'Required table dispute_internal_memberships is missing. Apply migrations before serving dispute internal workspace.',
        remediation:
          'Run migration scripts (e.g. npm run migration:run in server) and verify CreateDisputeInternalMemberships1772300000000 is applied.',
      });
    }

    if (!schemaReport.hasHearingNoShowNoteColumn) {
      throw new ServiceUnavailableException({
        code: 'DISPUTE_HEARING_NOSHOWNOTE_COLUMN_MISSING',
        message:
          'Required column dispute_hearings.noShowNote is missing. Apply migrations before serving hearing endpoints.',
        remediation:
          'Run migration scripts (e.g. npm run migration:run in server) and verify AddNoShowNoteToDisputeHearings1772305000000 is applied.',
      });
    }

    if (
      !schemaReport.hasHearingStatementsTable ||
      !schemaReport.hasStructuredHearingStatementColumns
    ) {
      throw new ServiceUnavailableException({
        code: 'HEARING_STATEMENT_SCHEMA_MISSING',
        message:
          'Required hearing statement workspace columns are missing. Apply migrations before serving hearing workspace statements.',
        remediation:
          'Run migration scripts (e.g. npm run migration:run in server) and verify hearing statement column migrations are applied.',
        missingDependencies: this.getWorkspaceSchemaMissingDependencies(schemaReport),
      });
    }

    if (!schemaReport.hasHearingQuestionsTable) {
      throw new ServiceUnavailableException({
        code: 'HEARING_QUESTIONS_TABLE_MISSING',
        message:
          'Required table hearing_questions is missing. Apply migrations before serving hearing workspace Q&A flows.',
        remediation:
          'Run migration scripts (e.g. npm run migration:run in server) and verify hearing question migrations are applied.',
      });
    }

    if (!schemaReport.hasHearingQuestionWorkspaceColumns) {
      throw new ServiceUnavailableException({
        code: 'HEARING_QUESTIONS_COLUMNS_MISSING',
        message:
          'Required hearing question workspace columns are missing or entity mappings are stale.',
        remediation:
          'Run migration scripts and verify hearing question entity-column mappings align before serving hearing workspace.',
        missingDependencies: this.getWorkspaceSchemaMissingDependencies(schemaReport),
      });
    }

    if (!schemaReport.hasHearingParticipantWorkspaceColumns) {
      throw new ServiceUnavailableException({
        code: 'HEARING_PARTICIPANT_COLUMNS_MISSING',
        message:
          'Required hearing participant workspace columns are missing or entity mappings are stale.',
        remediation:
          'Run migration scripts and verify hearing participant entity-column mappings align before serving hearing workspace.',
        missingDependencies: this.getWorkspaceSchemaMissingDependencies(schemaReport),
      });
    }

    if (!schemaReport.hasDisputeMessageEvidenceColumn) {
      throw new ServiceUnavailableException({
        code: 'DISPUTE_MESSAGE_EVIDENCE_COLUMN_MISSING',
        message:
          'Required column dispute_messages.attached_evidence_ids is missing or entity mappings are stale.',
        remediation:
          'Run migrations and confirm entity-column mappings align before serving dispute workspace messages.',
      });
    }

    if (!schemaReport.hasStaffPerformanceUpsertConstraint) {
      throw new ServiceUnavailableException({
        code: 'STAFF_PERFORMANCE_UPSERT_CONSTRAINT_MISSING',
        message:
          'Required unique conflict target for staff_performances(staffId, period) is missing. Apply migrations before serving verdict/performance updates.',
        remediation:
          'Run migration scripts (e.g. npm run migration:run in server) and verify EnsureStaffPerformanceUpsertConstraint1772315000000 is applied.',
      });
    }

    if (!schemaReport.hasStaffWorkloadUpsertConstraint) {
      throw new ServiceUnavailableException({
        code: 'STAFF_WORKLOAD_UPSERT_CONSTRAINT_MISSING',
        message:
          'Required unique conflict target for staff_workloads(staffId, date) is missing. Apply migrations before serving workload/calendar updates.',
        remediation:
          'Run migration scripts (e.g. npm run migration:run in server) and verify EnsureStaffWorkloadUpsertConstraint1772316000000 is applied.',
      });
    }

    const report = await this.getMigrationReadinessReport();

    if (report.pending.length > 0) {
      throw new ServiceUnavailableException({
        code: 'MIGRATIONS_PENDING',
        pending: report.pending,
      });
    }

    const enumReport = await this.getDisputePhaseEnumReport();
    if (enumReport.missing.length > 0) {
      throw new ServiceUnavailableException({
        code: 'DISPUTE_PHASE_ENUM_MISMATCH',
        message:
          'disputes_phase_enum is missing required values. Apply pending migrations before serving traffic.',
        requiredValues: REQUIRED_DISPUTE_PHASE_ENUM_VALUES,
        existingValues: enumReport.existing,
        missingValues: enumReport.missing,
        remediation:
          'Run server migration scripts (e.g. yarn migration:run) and confirm AddEvidenceSubmissionPhase migration is applied.',
      });
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      pending: [],
      disputePhaseEnum: 'ok',
      disputeInternalMembershipTable: 'ok',
      hearingNoShowNoteColumn: 'ok',
      hearingStatementsStructuredColumns: 'ok',
      hearingQuestionsTable: 'ok',
      hearingQuestionWorkspaceColumns: 'ok',
      hearingParticipantWorkspaceColumns: 'ok',
      disputeMessageEvidenceColumn: 'ok',
      staffPerformanceUpsertConstraint: 'ok',
      staffWorkloadUpsertConstraint: 'ok',
    };
  }

  async getDisputeWorkspaceReadinessStatus() {
    await this.assertDatabaseReachable();
    const report = await this.getDisputeSchemaReadinessReport();
    const missingDependencies = this.getWorkspaceSchemaMissingDependencies(report);
    return {
      status: missingDependencies.length === 0 ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      missingDependencies,
      report,
    };
  }

  private async assertDatabaseReachable(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'DB_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Database check failed',
      });
    } finally {
      try {
        await queryRunner.release();
      } catch {
        // Ignore release error in health check path.
      }
    }
  }

  private async getMigrationReadinessReport(): Promise<MigrationReadinessReport> {
    const availableMigrations = this.dataSource.migrations.map(
      (migration) => migration.name || migration.constructor?.name || 'unknown_migration',
    );
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const hasMigrationsTable = await queryRunner.hasTable('migrations');
      if (!hasMigrationsTable) {
        return { pending: availableMigrations };
      }

      const executedRows = await queryRunner.query(
        'SELECT "name" FROM "migrations" ORDER BY "id" ASC',
      );
      const executed = new Set<string>(
        (executedRows as Array<{ name?: string }>)
          .map((row) => row?.name)
          .filter((name): name is string => Boolean(name)),
      );

      const pending = availableMigrations.filter((name) => !executed.has(name));
      return { pending };
    } finally {
      try {
        await queryRunner.release();
      } catch {
        // Ignore release error in health check path.
      }
    }
  }

  private async getDisputePhaseEnumReport(): Promise<DisputePhaseEnumReport> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const rows = await queryRunner.query(
        `
          SELECT e.enumlabel
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'disputes_phase_enum'
          ORDER BY e.enumsortorder ASC
        `,
      );
      const existing = (rows as Array<{ enumlabel?: string }>)
        .map((row) => row?.enumlabel)
        .filter((value): value is string => Boolean(value));
      const missing = REQUIRED_DISPUTE_PHASE_ENUM_VALUES.filter(
        (required) => !existing.includes(required),
      );
      return { existing, missing };
    } catch {
      return {
        existing: [],
        missing: [...REQUIRED_DISPUTE_PHASE_ENUM_VALUES],
      };
    } finally {
      try {
        await queryRunner.release();
      } catch {
        // Ignore release error in health check path.
      }
    }
  }

  private parseExistsResult(rows: unknown): boolean {
    const value = (rows as Array<{ exists?: unknown }>)?.[0]?.exists;
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      return ['true', 't', '1', 'yes', 'y'].includes(value.toLowerCase());
    }
    return false;
  }

  private async runSchemaExistsQuery(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    sql: string,
    label: string,
  ): Promise<boolean> {
    try {
      const rows = await queryRunner.query(sql);
      return this.parseExistsResult(rows);
    } catch (error) {
      this.logger.warn(
        `Schema readiness query failed for ${label}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  private async getDisputeSchemaReadinessReport(): Promise<DisputeSchemaReadinessReport> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const hasInternalMembershipTable = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'dispute_internal_memberships'
          ) AS "exists"
        `,
        'dispute_internal_memberships table',
      );
      const hasHearingNoShowNoteColumn = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'dispute_hearings'
              AND column_name = 'noShowNote'
          ) AS "exists"
        `,
        'dispute_hearings.noShowNote column',
      );
      const hasHearingStatementsTable = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'hearing_statements'
          ) AS "exists"
        `,
        'hearing_statements table',
      );
      const hasStructuredHearingStatementColumns = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT COUNT(*) = 9 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'hearing_statements'
            AND column_name IN (
              'objection_status',
              'deadline',
              'structuredContent',
              'citedEvidenceIds',
              'platformDeclarationAccepted',
              'platformDeclarationAcceptedAt',
              'versionNumber',
              'versionHistory',
              'updatedAt'
            )
        `,
        'hearing_statements workspace columns',
      );
      const hasHearingQuestionsTable = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'hearing_questions'
          ) AS "exists"
        `,
        'hearing_questions table',
      );
      const hasHearingQuestionWorkspaceColumns = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT COUNT(*) = 3 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'hearing_questions'
            AND column_name IN (
              'status',
              'cancelledAt',
              'cancelledById'
            )
        `,
        'hearing_questions workspace columns',
      );
      const hasHearingParticipantWorkspaceColumns = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT COUNT(*) = 5 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'hearing_participants'
            AND column_name IN (
              'isRequired',
              'responseDeadline',
              'declineReason',
              'lastOnlineAt',
              'totalOnlineMinutes'
            )
        `,
        'hearing_participants workspace columns',
      );
      const hasDisputeMessageEvidenceColumn = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'dispute_messages'
              AND column_name = 'attached_evidence_ids'
          ) AS "exists"
        `,
        'dispute_messages.attached_evidence_ids column',
      );
      const hasStaffPerformanceUpsertConstraint = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class tbl ON tbl.oid = i.indrelid
            JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
            JOIN LATERAL (
              SELECT array_agg(att.attname::text ORDER BY k.ord) AS columns
              FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute att
                ON att.attrelid = tbl.oid
               AND att.attnum = k.attnum
            ) keycols ON TRUE
            WHERE ns.nspname = 'public'
              AND tbl.relname = 'staff_performances'
              AND i.indisunique = TRUE
              AND i.indpred IS NULL
              AND i.indexprs IS NULL
              AND keycols.columns = ARRAY['staffId', 'period']::text[]
          ) AS "exists"
        `,
        'staff_performances(staffId, period) unique index',
      );
      const hasStaffWorkloadUpsertConstraint = await this.runSchemaExistsQuery(
        queryRunner,
        `
          SELECT EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class tbl ON tbl.oid = i.indrelid
            JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
            JOIN LATERAL (
              SELECT array_agg(att.attname::text ORDER BY k.ord) AS columns
              FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute att
                ON att.attrelid = tbl.oid
               AND att.attnum = k.attnum
            ) keycols ON TRUE
            WHERE ns.nspname = 'public'
              AND tbl.relname = 'staff_workloads'
              AND i.indisunique = TRUE
              AND i.indpred IS NULL
              AND i.indexprs IS NULL
              AND keycols.columns = ARRAY['staffId', 'date']::text[]
          ) AS "exists"
        `,
        'staff_workloads(staffId, date) unique index',
      );

      return {
        hasInternalMembershipTable,
        hasHearingNoShowNoteColumn,
        hasHearingStatementsTable,
        hasStructuredHearingStatementColumns,
        hasHearingQuestionsTable,
        hasHearingQuestionWorkspaceColumns,
        hasHearingParticipantWorkspaceColumns,
        hasDisputeMessageEvidenceColumn,
        hasStaffPerformanceUpsertConstraint,
        hasStaffWorkloadUpsertConstraint,
      };
    } finally {
      try {
        await queryRunner.release();
      } catch {
        // Ignore release error in health check path.
      }
    }
  }

  private getWorkspaceSchemaMissingDependencies(report: DisputeSchemaReadinessReport): string[] {
    const missing: string[] = [];
    if (!report.hasInternalMembershipTable) missing.push('dispute_internal_memberships');
    if (!report.hasHearingNoShowNoteColumn) missing.push('dispute_hearings.noShowNote');
    if (!report.hasHearingStatementsTable) missing.push('hearing_statements');
    if (!report.hasStructuredHearingStatementColumns) {
      missing.push(
        'hearing_statements.[objection_status,deadline,structuredContent,citedEvidenceIds,platformDeclarationAccepted,platformDeclarationAcceptedAt,versionNumber,versionHistory,updatedAt]',
      );
    }
    if (!report.hasHearingQuestionsTable) missing.push('hearing_questions');
    if (!report.hasHearingQuestionWorkspaceColumns) {
      missing.push('hearing_questions.[status,cancelledAt,cancelledById]');
    }
    if (!report.hasHearingParticipantWorkspaceColumns) {
      missing.push(
        'hearing_participants.[isRequired,responseDeadline,declineReason,lastOnlineAt,totalOnlineMinutes]',
      );
    }
    if (!report.hasDisputeMessageEvidenceColumn) {
      missing.push('dispute_messages.attached_evidence_ids');
    }
    return missing;
  }
}
