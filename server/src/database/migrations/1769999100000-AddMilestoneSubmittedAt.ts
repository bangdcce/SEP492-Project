import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMilestoneSubmittedAt1769999100000 implements MigrationInterface {
  name = 'AddMilestoneSubmittedAt1769999100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "milestones" ADD "submittedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "submittedAt"`);
  }
}
