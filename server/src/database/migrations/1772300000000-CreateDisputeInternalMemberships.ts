import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDisputeInternalMemberships1772300000000 implements MigrationInterface {
  name = 'CreateDisputeInternalMemberships1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_internal_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "grantedBy" uuid NULL,
        "source" character varying(64) NOT NULL DEFAULT 'manual',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_internal_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dispute_internal_memberships_dispute_user" UNIQUE ("disputeId", "userId")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_internal_memberships_dispute"
      ON "dispute_internal_memberships" ("disputeId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_internal_memberships_user"
      ON "dispute_internal_memberships" ("userId");
    `);

    await queryRunner.query(`
      ALTER TABLE "dispute_internal_memberships"
      ADD CONSTRAINT "FK_dispute_internal_memberships_dispute"
      FOREIGN KEY ("disputeId") REFERENCES "disputes"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
    `).catch(() => null);

    await queryRunner.query(`
      ALTER TABLE "dispute_internal_memberships"
      ADD CONSTRAINT "FK_dispute_internal_memberships_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
    `).catch(() => null);

    await queryRunner.query(`
      ALTER TABLE "dispute_internal_memberships"
      ADD CONSTRAINT "FK_dispute_internal_memberships_granted_by"
      FOREIGN KEY ("grantedBy") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `).catch(() => null);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dispute_internal_memberships"
      DROP CONSTRAINT IF EXISTS "FK_dispute_internal_memberships_granted_by";
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_internal_memberships"
      DROP CONSTRAINT IF EXISTS "FK_dispute_internal_memberships_user";
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_internal_memberships"
      DROP CONSTRAINT IF EXISTS "FK_dispute_internal_memberships_dispute";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_dispute_internal_memberships_user";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_dispute_internal_memberships_dispute";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "dispute_internal_memberships";
    `);
  }
}
