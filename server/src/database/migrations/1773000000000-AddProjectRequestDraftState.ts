import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProjectRequestDraftState1773000000000 implements MigrationInterface {
  name = 'AddProjectRequestDraftState1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'project_requests';

    if (!(await queryRunner.hasColumn(tableName, 'attachments'))) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'attachments',
          type: 'jsonb',
          isNullable: true,
          default: "'[]'",
        }),
      );
    }

    if (!(await queryRunner.hasColumn(tableName, 'wizardProgressStep'))) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'wizardProgressStep',
          type: 'int',
          isNullable: true,
          default: 1,
        }),
      );
    }

    if (!(await queryRunner.hasColumn(tableName, 'updatedAt'))) {
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'updatedAt',
          type: 'timestamptz',
          isNullable: false,
          default: 'now()',
        }),
      );
    }

    await queryRunner.query(
      `UPDATE "project_requests"
       SET "attachments" = COALESCE("attachments", '[]'::jsonb),
           "wizardProgressStep" = COALESCE("wizardProgressStep", 1),
           "updatedAt" = COALESCE("updatedAt", NOW())`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_requests"
       ALTER COLUMN "attachments" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_requests"
       ALTER COLUMN "wizardProgressStep" SET DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'project_requests';

    if (await queryRunner.hasColumn(tableName, 'updatedAt')) {
      await queryRunner.dropColumn(tableName, 'updatedAt');
    }

    if (await queryRunner.hasColumn(tableName, 'wizardProgressStep')) {
      await queryRunner.dropColumn(tableName, 'wizardProgressStep');
    }

    if (await queryRunner.hasColumn(tableName, 'attachments')) {
      await queryRunner.dropColumn(tableName, 'attachments');
    }
  }
}
