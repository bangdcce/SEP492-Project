import AppDataSource from '../data-source';

const readPendingMigrations = async (): Promise<string[]> => {
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    const configuredMigrations = AppDataSource.migrations.map(
      (migration) => migration.name || migration.constructor?.name || 'unknown_migration',
    );

    const hasMigrationsTable = await queryRunner.hasTable('migrations');
    if (!hasMigrationsTable) {
      return configuredMigrations;
    }

    const executedRows = await queryRunner.query('SELECT "name" FROM "migrations"');
    const executed = new Set<string>(
      (executedRows as Array<{ name?: string }>)
        .map((row) => row?.name)
        .filter((name): name is string => Boolean(name)),
    );

    return configuredMigrations.filter((name) => !executed.has(name));
  } finally {
    await queryRunner.release();
  }
};

const main = async (): Promise<void> => {
  await AppDataSource.initialize();

  try {
    const pending = await readPendingMigrations();
    if (pending.length > 0) {
      console.error(
        JSON.stringify(
          {
            code: 'MIGRATIONS_PENDING',
            pending,
          },
          null,
          2,
        ),
      );
      process.exit(1);
      return;
    }

    console.log('MIGRATIONS_OK');
  } finally {
    await AppDataSource.destroy();
  }
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
