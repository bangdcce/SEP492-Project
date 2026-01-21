import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSkillEnity1768894934970 implements MigrationInterface {
    name = 'UpdateSkillEnity1768894934970'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_skills_priority_enum" AS ENUM('PRIMARY', 'SECONDARY')`);
        await queryRunner.query(`CREATE TYPE "public"."user_skills_verificationstatus_enum" AS ENUM('SELF_DECLARED', 'PORTFOLIO_LINKED', 'PROJECT_VERIFIED', 'ADMIN_VERIFIED')`);
        await queryRunner.query(`CREATE TABLE "user_skills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "skillId" uuid NOT NULL, "priority" "public"."user_skills_priority_enum" NOT NULL DEFAULT 'SECONDARY', "verificationStatus" "public"."user_skills_verificationstatus_enum" NOT NULL DEFAULT 'SELF_DECLARED', "portfolioUrl" text, "completedProjectsCount" integer NOT NULL DEFAULT '0', "lastUsedAt" TIMESTAMP, "proficiencyLevel" integer, "yearsOfExperience" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_060bea7fd45868588324719de3c" UNIQUE ("userId", "skillId"), CONSTRAINT "PK_4d0a72117fbf387752dbc8506af" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_skills"."priority" IS 'PRIMARY = main strength, SECONDARY = additional skill'; COMMENT ON COLUMN "user_skills"."verificationStatus" IS 'How was this skill verified?'; COMMENT ON COLUMN "user_skills"."portfolioUrl" IS 'Link to portfolio or proof'; COMMENT ON COLUMN "user_skills"."completedProjectsCount" IS 'Number of completed projects using this skill'; COMMENT ON COLUMN "user_skills"."lastUsedAt" IS 'When last used in a completed project'; COMMENT ON COLUMN "user_skills"."proficiencyLevel" IS 'Self-rated proficiency 1-10 (optional, for future)'; COMMENT ON COLUMN "user_skills"."yearsOfExperience" IS 'Years of experience with this skill'`);
        await queryRunner.query(`CREATE INDEX "IDX_f643baf957249229e5be5651e6" ON "user_skills" ("skillId", "verificationStatus") `);
        await queryRunner.query(`CREATE INDEX "IDX_c248539f79b9a09139010aa646" ON "user_skills" ("userId", "priority") `);
        await queryRunner.query(`CREATE TABLE "staff_expertise" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "staffId" uuid NOT NULL, "skillId" uuid NOT NULL, "expertiseLevel" integer NOT NULL DEFAULT '1', "certificationName" character varying(255), "certificationExpiry" date, "disputesHandled" integer NOT NULL DEFAULT '0', "successRate" numeric(5,2) NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_118b1153e34e56649744630850f" UNIQUE ("staffId", "skillId"), CONSTRAINT "PK_8e6e8189687c4ca6332c16cd28a" PRIMARY KEY ("id")); COMMENT ON COLUMN "staff_expertise"."staffId" IS 'Staff user ID'; COMMENT ON COLUMN "staff_expertise"."skillId" IS 'Skill (should have forStaff=true)'; COMMENT ON COLUMN "staff_expertise"."expertiseLevel" IS 'Expertise level 1-5 (affects assignment priority)'; COMMENT ON COLUMN "staff_expertise"."certificationName" IS 'Certification name if any'; COMMENT ON COLUMN "staff_expertise"."certificationExpiry" IS 'Certification expiry date'; COMMENT ON COLUMN "staff_expertise"."disputesHandled" IS 'Disputes handled with this expertise'; COMMENT ON COLUMN "staff_expertise"."successRate" IS 'Success rate % for disputes in this area'; COMMENT ON COLUMN "staff_expertise"."isActive" IS 'Is this expertise active?'`);
        await queryRunner.query(`CREATE INDEX "IDX_98e7bfa27a5dc3f1ea6854491f" ON "staff_expertise" ("skillId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fd18fc4e1930d961ced296f6e4" ON "staff_expertise" ("staffId") `);
        await queryRunner.query(`CREATE TABLE "skill_domains" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "description" text, "icon" character varying(50), "wizardMapping" jsonb, "matchingWeight" integer NOT NULL DEFAULT '30', "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_374b86eb42609c0b1839a0d19b2" UNIQUE ("slug"), CONSTRAINT "PK_145bdc4c995f214718b9e93fac0" PRIMARY KEY ("id")); COMMENT ON COLUMN "skill_domains"."name" IS 'Display name (e.g., "E-commerce")'; COMMENT ON COLUMN "skill_domains"."slug" IS 'URL-friendly slug (e.g., "e-commerce")'; COMMENT ON COLUMN "skill_domains"."description" IS 'Description of the domain'; COMMENT ON COLUMN "skill_domains"."icon" IS 'Icon name (e.g., "shopping-cart")'; COMMENT ON COLUMN "skill_domains"."wizardMapping" IS 'Mapping from wizard answers to auto-tag. E.g., {"Q1": ["A", "B"]} → client answers these → auto-tag'; COMMENT ON COLUMN "skill_domains"."matchingWeight" IS 'Weight for matching algorithm (default 30% for domain matching)'; COMMENT ON COLUMN "skill_domains"."isActive" IS 'Is this domain active for selection?'; COMMENT ON COLUMN "skill_domains"."sortOrder" IS 'Display order in UI'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_374b86eb42609c0b1839a0d19b" ON "skill_domains" ("slug") `);
        await queryRunner.query(`CREATE TYPE "public"."skills_category_enum" AS ENUM('FRONTEND', 'BACKEND', 'MOBILE', 'DATABASE', 'DEVOPS', 'DESIGN', 'TESTING', 'DATA', 'AI_ML', 'BUSINESS_ANALYSIS', 'PROJECT_MANAGEMENT', 'CONSULTING', 'DOMAIN_EXPERTISE', 'AUDIT_SECURITY', 'AUDIT_CODE_QUALITY', 'AUDIT_FINANCE', 'AUDIT_LEGAL', 'AUDIT_TECHNICAL', 'OTHER')`);
        await queryRunner.query(`CREATE TABLE "skills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "domainId" uuid, "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "description" text, "icon" character varying(50), "category" "public"."skills_category_enum" NOT NULL DEFAULT 'OTHER', "aliases" text, "forFreelancer" boolean NOT NULL DEFAULT true, "forBroker" boolean NOT NULL DEFAULT false, "forStaff" boolean NOT NULL DEFAULT false, "matchingWeight" integer NOT NULL DEFAULT '70', "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_55b7acbf80551e7fa2b5a33ed6c" UNIQUE ("slug"), CONSTRAINT "PK_0d3212120f4ecedf90864d7e298" PRIMARY KEY ("id")); COMMENT ON COLUMN "skills"."domainId" IS 'Parent domain (Layer 1)'; COMMENT ON COLUMN "skills"."name" IS 'Display name (e.g., "ReactJS")'; COMMENT ON COLUMN "skills"."slug" IS 'URL-friendly slug (e.g., "reactjs")'; COMMENT ON COLUMN "skills"."description" IS 'Description of the skill'; COMMENT ON COLUMN "skills"."icon" IS 'Icon name or URL'; COMMENT ON COLUMN "skills"."category" IS 'Skill category for filtering'; COMMENT ON COLUMN "skills"."aliases" IS 'Alternative names/aliases for search. E.g., ["React", "React.js"]'; COMMENT ON COLUMN "skills"."forFreelancer" IS 'Can Freelancers select this skill?'; COMMENT ON COLUMN "skills"."forBroker" IS 'Can Brokers select this skill?'; COMMENT ON COLUMN "skills"."forStaff" IS 'Is this an audit skill for Staff?'; COMMENT ON COLUMN "skills"."matchingWeight" IS 'Weight for matching algorithm (default 70% for skill matching)'; COMMENT ON COLUMN "skills"."isActive" IS 'Is this skill active for selection?'; COMMENT ON COLUMN "skills"."sortOrder" IS 'Display order in UI'`);
        await queryRunner.query(`CREATE INDEX "IDX_cbd5e2246a825b3c4a5d36a80f" ON "skills" ("domainId", "category") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_55b7acbf80551e7fa2b5a33ed6" ON "skills" ("slug") `);
        await queryRunner.query(`CREATE TYPE "public"."dispute_skill_requirements_source_enum" AS ENUM('AUTO_DETECTED', 'MANUAL_TAGGED', 'ESCALATION')`);
        await queryRunner.query(`CREATE TABLE "dispute_skill_requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "disputeId" uuid NOT NULL, "skillId" uuid NOT NULL, "source" "public"."dispute_skill_requirements_source_enum" NOT NULL DEFAULT 'AUTO_DETECTED', "requiredLevel" integer NOT NULL DEFAULT '1', "isMandatory" boolean NOT NULL DEFAULT true, "addedById" uuid, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b1e77eec0db27c6fb7309c8c8b3" UNIQUE ("disputeId", "skillId"), CONSTRAINT "PK_c01f5cdf09a1842b3d47ab3d3a0" PRIMARY KEY ("id")); COMMENT ON COLUMN "dispute_skill_requirements"."skillId" IS 'Required audit skill'; COMMENT ON COLUMN "dispute_skill_requirements"."source" IS 'How was this skill requirement added?'; COMMENT ON COLUMN "dispute_skill_requirements"."requiredLevel" IS 'Required expertise level (1-5). Higher = need more expert staff'; COMMENT ON COLUMN "dispute_skill_requirements"."isMandatory" IS 'Is this a mandatory requirement? false = nice-to-have'; COMMENT ON COLUMN "dispute_skill_requirements"."addedById" IS 'Who added this requirement (if manual)'; COMMENT ON COLUMN "dispute_skill_requirements"."notes" IS 'Notes about why this skill is needed'`);
        await queryRunner.query(`CREATE INDEX "IDX_724c0d98a342b4c1b800987b6d" ON "dispute_skill_requirements" ("skillId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7f932413b0fcf2a2113c60fdb7" ON "dispute_skill_requirements" ("disputeId") `);
        await queryRunner.query(`CREATE TABLE "skill_mapping_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entityType" character varying(50) NOT NULL, "entityValue" character varying(100) NOT NULL, "skillId" uuid NOT NULL, "requiredLevel" integer NOT NULL DEFAULT '1', "isMandatory" boolean NOT NULL DEFAULT true, "isActive" boolean NOT NULL DEFAULT true, "priority" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_14d0fc9b9752e08203639f905db" PRIMARY KEY ("id")); COMMENT ON COLUMN "skill_mapping_rules"."entityType" IS 'Entity type to map from. E.g., "DISPUTE_CATEGORY", "WIZARD_ANSWER"'; COMMENT ON COLUMN "skill_mapping_rules"."entityValue" IS 'Entity value to match. E.g., "FRAUD", "PAYMENT"'; COMMENT ON COLUMN "skill_mapping_rules"."skillId" IS 'Skill to auto-assign when matched'; COMMENT ON COLUMN "skill_mapping_rules"."requiredLevel" IS 'Minimum required expertise level for auto-assignment'; COMMENT ON COLUMN "skill_mapping_rules"."isMandatory" IS 'Is this a mandatory skill when rule matches?'; COMMENT ON COLUMN "skill_mapping_rules"."priority" IS 'Priority when multiple rules match'`);
        await queryRunner.query(`CREATE INDEX "IDX_f75a9520717592042c60fbc3f7" ON "skill_mapping_rules" ("entityType", "entityValue") `);
        await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
        await queryRunner.query(`ALTER TABLE "escrows" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
        await queryRunner.query(`ALTER TABLE "dispute_verdicts" DROP COLUMN "reasoning"`);
        await queryRunner.query(`ALTER TABLE "dispute_verdicts" ADD "reasoning" jsonb NOT NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "dispute_verdicts"."reasoning" IS 'Lý do phán quyết có cấu trúc (violatedPolicies, supportingEvidenceIds, factualFindings, legalAnalysis, conclusion)'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "user_skills" ADD CONSTRAINT "FK_60177dd93dcdc055e4eaa93bade" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_skills" ADD CONSTRAINT "FK_b19f190afaada3852e0f56566bc" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_expertise" ADD CONSTRAINT "FK_fd18fc4e1930d961ced296f6e40" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_expertise" ADD CONSTRAINT "FK_98e7bfa27a5dc3f1ea6854491f0" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skills" ADD CONSTRAINT "FK_9efef6747eca479da5e43ef38d1" FOREIGN KEY ("domainId") REFERENCES "skill_domains"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispute_skill_requirements" ADD CONSTRAINT "FK_7f932413b0fcf2a2113c60fdb7b" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispute_skill_requirements" ADD CONSTRAINT "FK_724c0d98a342b4c1b800987b6da" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispute_skill_requirements" ADD CONSTRAINT "FK_07db9a3bc01a0ae9fb9a74aa54e" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill_mapping_rules" ADD CONSTRAINT "FK_be9c9478a57973b539501713319" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "skill_mapping_rules" DROP CONSTRAINT "FK_be9c9478a57973b539501713319"`);
        await queryRunner.query(`ALTER TABLE "dispute_skill_requirements" DROP CONSTRAINT "FK_07db9a3bc01a0ae9fb9a74aa54e"`);
        await queryRunner.query(`ALTER TABLE "dispute_skill_requirements" DROP CONSTRAINT "FK_724c0d98a342b4c1b800987b6da"`);
        await queryRunner.query(`ALTER TABLE "dispute_skill_requirements" DROP CONSTRAINT "FK_7f932413b0fcf2a2113c60fdb7b"`);
        await queryRunner.query(`ALTER TABLE "skills" DROP CONSTRAINT "FK_9efef6747eca479da5e43ef38d1"`);
        await queryRunner.query(`ALTER TABLE "staff_expertise" DROP CONSTRAINT "FK_98e7bfa27a5dc3f1ea6854491f0"`);
        await queryRunner.query(`ALTER TABLE "staff_expertise" DROP CONSTRAINT "FK_fd18fc4e1930d961ced296f6e40"`);
        await queryRunner.query(`ALTER TABLE "user_skills" DROP CONSTRAINT "FK_b19f190afaada3852e0f56566bc"`);
        await queryRunner.query(`ALTER TABLE "user_skills" DROP CONSTRAINT "FK_60177dd93dcdc055e4eaa93bade"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`COMMENT ON COLUMN "dispute_verdicts"."reasoning" IS 'Lý do phán quyết có cấu trúc (violatedPolicies, supportingEvidenceIds, factualFindings, legalAnalysis, conclusion)'`);
        await queryRunner.query(`ALTER TABLE "dispute_verdicts" DROP COLUMN "reasoning"`);
        await queryRunner.query(`ALTER TABLE "dispute_verdicts" ADD "reasoning" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "escrows" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
        await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f75a9520717592042c60fbc3f7"`);
        await queryRunner.query(`DROP TABLE "skill_mapping_rules"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f932413b0fcf2a2113c60fdb7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_724c0d98a342b4c1b800987b6d"`);
        await queryRunner.query(`DROP TABLE "dispute_skill_requirements"`);
        await queryRunner.query(`DROP TYPE "public"."dispute_skill_requirements_source_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_55b7acbf80551e7fa2b5a33ed6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cbd5e2246a825b3c4a5d36a80f"`);
        await queryRunner.query(`DROP TABLE "skills"`);
        await queryRunner.query(`DROP TYPE "public"."skills_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_374b86eb42609c0b1839a0d19b"`);
        await queryRunner.query(`DROP TABLE "skill_domains"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd18fc4e1930d961ced296f6e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98e7bfa27a5dc3f1ea6854491f"`);
        await queryRunner.query(`DROP TABLE "staff_expertise"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c248539f79b9a09139010aa646"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f643baf957249229e5be5651e6"`);
        await queryRunner.query(`DROP TABLE "user_skills"`);
        await queryRunner.query(`DROP TYPE "public"."user_skills_verificationstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_skills_priority_enum"`);
    }

}
