import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class EnforceDisputeProjectForeignKey1774500000000 implements MigrationInterface {
  name = 'EnforceDisputeProjectForeignKey1774500000000';

  private readonly enforcedForeignKeyName = 'FK_disputes_projectId_projects_id';

  private isProjectReference(foreignKey: TableForeignKey): boolean {
    const referencedTable = foreignKey.referencedTableName?.split('.').pop();
    return referencedTable === 'projects';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const disputesTable = await queryRunner.getTable('disputes');
    if (!disputesTable) {
      return;
    }

    await queryRunner.query(`
      DELETE FROM "disputes" d
      WHERE d."projectId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "projects" p
          WHERE p."id" = d."projectId"
        )
    `);

    const refreshedDisputesTable = await queryRunner.getTable('disputes');
    if (!refreshedDisputesTable) {
      return;
    }

    const projectForeignKeys = refreshedDisputesTable.foreignKeys.filter(
      (foreignKey) =>
        foreignKey.columnNames.length === 1 && foreignKey.columnNames[0] === 'projectId',
    );

    let hasValidForeignKey = false;

    for (const foreignKey of projectForeignKeys) {
      const isValidForeignKey =
        this.isProjectReference(foreignKey) &&
        (foreignKey.onDelete || '').toUpperCase() === 'CASCADE';

      if (isValidForeignKey) {
        hasValidForeignKey = true;
        continue;
      }

      await queryRunner.dropForeignKey('disputes', foreignKey);
    }

    if (!hasValidForeignKey) {
      await queryRunner.createForeignKey(
        'disputes',
        new TableForeignKey({
          name: this.enforcedForeignKeyName,
          columnNames: ['projectId'],
          referencedTableName: 'projects',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const disputesTable = await queryRunner.getTable('disputes');
    if (!disputesTable) {
      return;
    }

    const createdForeignKey = disputesTable.foreignKeys.find(
      (foreignKey) => foreignKey.name === this.enforcedForeignKeyName,
    );

    if (createdForeignKey) {
      await queryRunner.dropForeignKey('disputes', createdForeignKey);
    }
  }
}
