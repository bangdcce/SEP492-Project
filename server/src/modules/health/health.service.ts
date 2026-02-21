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
    const report = await this.getMigrationReadinessReport();

    if (report.pending.length > 0) {
      throw new ServiceUnavailableException({
        code: 'MIGRATIONS_PENDING',
        pending: report.pending,
      });
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      pending: [],
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
}
