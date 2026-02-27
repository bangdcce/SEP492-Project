import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillDisputeInternalMembershipsFromHearingSupport1772310000000
  implements MigrationInterface
{
  name = 'BackfillDisputeInternalMembershipsFromHearingSupport1772310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "dispute_internal_memberships" (
        "id",
        "disputeId",
        "userId",
        "grantedBy",
        "source",
        "createdAt",
        "updatedAt"
      )
      SELECT
        uuid_generate_v4(),
        hearing."disputeId",
        participant."userId",
        hearing."moderatorId",
        'hearing_support_backfill',
        COALESCE(participant."createdAt", NOW()),
        NOW()
      FROM "hearing_participants" participant
      INNER JOIN "dispute_hearings" hearing
        ON hearing."id" = participant."hearingId"
      INNER JOIN "users" u
        ON u."id" = participant."userId"
      WHERE u."role" IN ('STAFF', 'ADMIN')
        AND participant."role" IN ('WITNESS', 'OBSERVER')
        AND participant."userId" <> hearing."moderatorId"
      ON CONFLICT ("disputeId", "userId") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "dispute_internal_memberships"
      WHERE "source" = 'hearing_support_backfill';
    `);
  }
}
