import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveClientSmeRole1770500000000 implements MigrationInterface {
  name = 'RemoveClientSmeRole1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Update any existing CLIENT_SME users to CLIENT
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'CLIENT'
      WHERE "role" = 'CLIENT_SME'
    `);

    // Step 2: Create new enum without CLIENT_SME
    await queryRunner.query(`
      CREATE TYPE "users_role_enum_new" AS ENUM(
        'ADMIN',
        'STAFF',
        'BROKER',
        'CLIENT',
        'FREELANCER'
      )
    `);

    // Step 3: Alter column to use new enum (with type casting)
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "users_role_enum_new"
      USING "role"::text::"users_role_enum_new"
    `);

    // Step 4: Drop old enum
    await queryRunner.query(`
      DROP TYPE "users_role_enum"
    `);

    // Step 5: Rename new enum to original name
    await queryRunner.query(`
      ALTER TYPE "users_role_enum_new" RENAME TO "users_role_enum"
    `);

    // Step 6: Update dispute-related enums if they exist
    // Note: These might not exist in all environments, so we use IF EXISTS
    
    // Update dispute_notes_authorrole_enum
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_notes_authorrole_enum') THEN
          CREATE TYPE "dispute_notes_authorrole_enum_new" AS ENUM(
            'ADMIN',
            'STAFF',
            'BROKER',
            'CLIENT',
            'FREELANCER'
          );
          
          ALTER TABLE "dispute_notes"
          ALTER COLUMN "authorRole" TYPE "dispute_notes_authorrole_enum_new"
          USING "authorRole"::text::"dispute_notes_authorrole_enum_new";
          
          DROP TYPE "dispute_notes_authorrole_enum";
          
          ALTER TYPE "dispute_notes_authorrole_enum_new" RENAME TO "dispute_notes_authorrole_enum";
        END IF;
      END $$;
    `);

    // Update disputes_raiserrole_enum
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disputes_raiserrole_enum') THEN
          CREATE TYPE "disputes_raiserrole_enum_new" AS ENUM(
            'ADMIN',
            'STAFF',
            'BROKER',
            'CLIENT',
            'FREELANCER'
          );
          
          ALTER TABLE "disputes"
          ALTER COLUMN "raiserRole" TYPE "disputes_raiserrole_enum_new"
          USING "raiserRole"::text::"disputes_raiserrole_enum_new";
          
          DROP TYPE "disputes_raiserrole_enum";
          
          ALTER TYPE "disputes_raiserrole_enum_new" RENAME TO "disputes_raiserrole_enum";
        END IF;
      END $$;
    `);

    // Update disputes_defendantrole_enum
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disputes_defendantrole_enum') THEN
          CREATE TYPE "disputes_defendantrole_enum_new" AS ENUM(
            'ADMIN',
            'STAFF',
            'BROKER',
            'CLIENT',
            'FREELANCER'
          );
          
          ALTER TABLE "disputes"
          ALTER COLUMN "defendantRole" TYPE "disputes_defendantrole_enum_new"
          USING "defendantRole"::text::"disputes_defendantrole_enum_new";
          
          DROP TYPE "disputes_defendantrole_enum";
          
          ALTER TYPE "disputes_defendantrole_enum_new" RENAME TO "disputes_defendantrole_enum";
        END IF;
      END $$;
    `);

    // Update dispute_activities_actorrole_enum
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_activities_actorrole_enum') THEN
          CREATE TYPE "dispute_activities_actorrole_enum_new" AS ENUM(
            'ADMIN',
            'STAFF',
            'BROKER',
            'CLIENT',
            'FREELANCER'
          );
          
          ALTER TABLE "dispute_activities"
          ALTER COLUMN "actorRole" TYPE "dispute_activities_actorrole_enum_new"
          USING "actorRole"::text::"dispute_activities_actorrole_enum_new";
          
          DROP TYPE "dispute_activities_actorrole_enum";
          
          ALTER TYPE "dispute_activities_actorrole_enum_new" RENAME TO "dispute_activities_actorrole_enum";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Add CLIENT_SME back to all enums
    
    // Main users enum
    await queryRunner.query(`
      CREATE TYPE "users_role_enum_new" AS ENUM(
        'ADMIN',
        'STAFF',
        'BROKER',
        'CLIENT',
        'CLIENT_SME',
        'FREELANCER'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "users_role_enum_new"
      USING "role"::text::"users_role_enum_new"
    `);

    await queryRunner.query(`DROP TYPE "users_role_enum"`);
    await queryRunner.query(`ALTER TYPE "users_role_enum_new" RENAME TO "users_role_enum"`);

    // Dispute enums - rollback
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_notes_authorrole_enum') THEN
          CREATE TYPE "dispute_notes_authorrole_enum_new" AS ENUM(
            'ADMIN', 'STAFF', 'BROKER', 'CLIENT', 'CLIENT_SME', 'FREELANCER'
          );
          ALTER TABLE "dispute_notes"
          ALTER COLUMN "authorRole" TYPE "dispute_notes_authorrole_enum_new"
          USING "authorRole"::text::"dispute_notes_authorrole_enum_new";
          DROP TYPE "dispute_notes_authorrole_enum";
          ALTER TYPE "dispute_notes_authorrole_enum_new" RENAME TO "dispute_notes_authorrole_enum";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disputes_raiserrole_enum') THEN
          CREATE TYPE "disputes_raiserrole_enum_new" AS ENUM(
            'ADMIN', 'STAFF', 'BROKER', 'CLIENT', 'CLIENT_SME', 'FREELANCER'
          );
          ALTER TABLE "disputes"
          ALTER COLUMN "raiserRole" TYPE "disputes_raiserrole_enum_new"
          USING "raiserRole"::text::"disputes_raiserrole_enum_new";
          DROP TYPE "disputes_raiserrole_enum";
          ALTER TYPE "disputes_raiserrole_enum_new" RENAME TO "disputes_raiserrole_enum";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disputes_defendantrole_enum') THEN
          CREATE TYPE "disputes_defendantrole_enum_new" AS ENUM(
            'ADMIN', 'STAFF', 'BROKER', 'CLIENT', 'CLIENT_SME', 'FREELANCER'
          );
          ALTER TABLE "disputes"
          ALTER COLUMN "defendantRole" TYPE "disputes_defendantrole_enum_new"
          USING "defendantRole"::text::"disputes_defendantrole_enum_new";
          DROP TYPE "disputes_defendantrole_enum";
          ALTER TYPE "disputes_defendantrole_enum_new" RENAME TO "disputes_defendantrole_enum";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_activities_actorrole_enum') THEN
          CREATE TYPE "dispute_activities_actorrole_enum_new" AS ENUM(
            'ADMIN', 'STAFF', 'BROKER', 'CLIENT', 'CLIENT_SME', 'FREELANCER'
          );
          ALTER TABLE "dispute_activities"
          ALTER COLUMN "actorRole" TYPE "dispute_activities_actorrole_enum_new"
          USING "actorRole"::text::"dispute_activities_actorrole_enum_new";
          DROP TYPE "dispute_activities_actorrole_enum";
          ALTER TYPE "dispute_activities_actorrole_enum_new" RENAME TO "dispute_activities_actorrole_enum";
        END IF;
      END $$;
    `);
  }
}
