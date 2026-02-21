import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeWorkflowForeignKeys1770622000000 implements MigrationInterface {
  name = 'AddDisputeWorkflowForeignKeys1770622000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // Data repair: dispute_parties
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      UPDATE "dispute_parties" dp
      SET "groupId" = COALESCE(
        CASE
          WHEN d."groupId" IS NOT NULL
            AND d."groupId"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN d."groupId"::uuid
          ELSE NULL
        END,
        d."id",
        dp."groupId"
      )
      FROM "disputes" d
      WHERE dp."disputeId" = d."id"
    `);

    await queryRunner.query(`
      UPDATE "dispute_parties" dp
      SET "groupId" = dp."disputeId"
      WHERE dp."disputeId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "disputes" d WHERE d."id" = dp."disputeId")
        AND NOT EXISTS (SELECT 1 FROM "disputes" gd WHERE gd."id" = dp."groupId")
    `);

    await queryRunner.query(`
      UPDATE "dispute_parties" dp
      SET "disputeId" = NULL
      WHERE dp."disputeId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "disputes" d WHERE d."id" = dp."disputeId")
    `);

    // Keep one row per (groupId, userId) deterministically after remap.
    await queryRunner.query(`
      DELETE FROM "dispute_parties" a
      USING "dispute_parties" b
      WHERE a."groupId" = b."groupId"
        AND a."userId" = b."userId"
        AND a."id" > b."id"
    `);

    await queryRunner.query(`
      DELETE FROM "dispute_parties" dp
      WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = dp."userId")
         OR NOT EXISTS (SELECT 1 FROM "disputes" d WHERE d."id" = dp."groupId")
    `);

    // -------------------------------------------------------------------------
    // Data repair: dispute_ledgers
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      DELETE FROM "dispute_ledgers" dl
      WHERE NOT EXISTS (SELECT 1 FROM "disputes" d WHERE d."id" = dl."disputeId")
    `);

    // -------------------------------------------------------------------------
    // Data repair: hearing_reminder_deliveries
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      UPDATE "hearing_reminder_deliveries" hrd
      SET "notificationId" = NULL
      WHERE hrd."notificationId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "notifications" n WHERE n."id" = hrd."notificationId")
    `);

    await queryRunner.query(`
      DELETE FROM "hearing_reminder_deliveries" hrd
      WHERE NOT EXISTS (SELECT 1 FROM "dispute_hearings" h WHERE h."id" = hrd."hearingId")
         OR NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = hrd."userId")
    `);

    // -------------------------------------------------------------------------
    // FK constraints
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispute_parties_dispute'
        ) THEN
          ALTER TABLE "dispute_parties"
          ADD CONSTRAINT "FK_dispute_parties_dispute"
          FOREIGN KEY ("disputeId") REFERENCES "disputes"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispute_parties_user'
        ) THEN
          ALTER TABLE "dispute_parties"
          ADD CONSTRAINT "FK_dispute_parties_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispute_parties_group'
        ) THEN
          ALTER TABLE "dispute_parties"
          ADD CONSTRAINT "FK_dispute_parties_group"
          FOREIGN KEY ("groupId") REFERENCES "disputes"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispute_ledgers_dispute'
        ) THEN
          ALTER TABLE "dispute_ledgers"
          ADD CONSTRAINT "FK_dispute_ledgers_dispute"
          FOREIGN KEY ("disputeId") REFERENCES "disputes"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hearing_reminder_deliveries_hearing'
        ) THEN
          ALTER TABLE "hearing_reminder_deliveries"
          ADD CONSTRAINT "FK_hearing_reminder_deliveries_hearing"
          FOREIGN KEY ("hearingId") REFERENCES "dispute_hearings"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hearing_reminder_deliveries_user'
        ) THEN
          ALTER TABLE "hearing_reminder_deliveries"
          ADD CONSTRAINT "FK_hearing_reminder_deliveries_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_hearing_reminder_deliveries_notification'
        ) THEN
          ALTER TABLE "hearing_reminder_deliveries"
          ADD CONSTRAINT "FK_hearing_reminder_deliveries_notification"
          FOREIGN KEY ("notificationId") REFERENCES "notifications"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hearing_reminder_deliveries" DROP CONSTRAINT IF EXISTS "FK_hearing_reminder_deliveries_notification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_reminder_deliveries" DROP CONSTRAINT IF EXISTS "FK_hearing_reminder_deliveries_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_reminder_deliveries" DROP CONSTRAINT IF EXISTS "FK_hearing_reminder_deliveries_hearing"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispute_ledgers" DROP CONSTRAINT IF EXISTS "FK_dispute_ledgers_dispute"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispute_parties" DROP CONSTRAINT IF EXISTS "FK_dispute_parties_group"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispute_parties" DROP CONSTRAINT IF EXISTS "FK_dispute_parties_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispute_parties" DROP CONSTRAINT IF EXISTS "FK_dispute_parties_dispute"`,
    );
  }
}
