import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWalletEscrowDisputeFeeConfig1767091212228 implements MigrationInterface {
  name = 'UpdateWalletEscrowDisputeFeeConfig1767091212228';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_59a083d59f0249a8af3346c07fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_5a6f52453994f5b71258623f811"`,
    );
    await queryRunner.query(
      `CREATE TABLE "payout_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "bankName" character varying(100) NOT NULL, "bankCode" character varying(20), "accountNumber" character varying(30) NOT NULL, "accountHolderName" character varying(255) NOT NULL, "branchName" character varying(100), "isDefault" boolean NOT NULL DEFAULT false, "isVerified" boolean NOT NULL DEFAULT false, "verifiedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cedb0a9e379a9a0a16ad050527e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_372920d813ceab29336fc5221e" ON "payout_methods" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."escrows_status_enum" AS ENUM('PENDING', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "escrows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "milestoneId" uuid NOT NULL, "totalAmount" numeric(15,2) NOT NULL, "fundedAmount" numeric(15,2) NOT NULL DEFAULT '0', "releasedAmount" numeric(15,2) NOT NULL DEFAULT '0', "developerShare" numeric(15,2) NOT NULL, "brokerShare" numeric(15,2) NOT NULL DEFAULT '0', "platformFee" numeric(15,2) NOT NULL DEFAULT '0', "developerPercentage" numeric(5,2) NOT NULL DEFAULT '85', "brokerPercentage" numeric(5,2) NOT NULL DEFAULT '10', "platformPercentage" numeric(5,2) NOT NULL DEFAULT '5', "currency" character varying(3) NOT NULL DEFAULT 'VND', "status" "public"."escrows_status_enum" NOT NULL DEFAULT 'PENDING', "fundedAt" TIMESTAMP, "releasedAt" TIMESTAMP, "refundedAt" TIMESTAMP, "clientApproved" boolean NOT NULL DEFAULT false, "clientApprovedAt" TIMESTAMP, "clientWalletId" uuid, "developerWalletId" uuid, "brokerWalletId" uuid, "holdTransactionId" uuid, "releaseTransactionIds" jsonb, "refundTransactionId" uuid, "disputeId" uuid, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9cd10ae5b52350c3a20d124f5d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f07f9d851481059289600bc412" ON "escrows" ("projectId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_54b1af06e01e858558a708d47c" ON "escrows" ("milestoneId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."fee_configs_feetype_enum" AS ENUM('PLATFORM_FEE', 'BROKER_COMMISSION', 'WITHDRAWAL_FEE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "fee_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "feeType" "public"."fee_configs_feetype_enum" NOT NULL, "percentage" numeric(5,2) NOT NULL, "minAmount" numeric(15,2), "maxAmount" numeric(15,2), "description" character varying(255), "isActive" boolean NOT NULL DEFAULT true, "effectiveFrom" TIMESTAMP, "effectiveTo" TIMESTAMP, "updatedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9353f3fc4bd5b35c9615f77a2ac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordOtp"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordOtpExpires"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "raisedBy"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "against"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "resolution"`);
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "pendingBalance" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "heldBalance" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "totalDeposited" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "totalWithdrawn" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "totalEarned" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "totalSpent" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallets_status_enum" AS ENUM('ACTIVE', 'FROZEN', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "status" "public"."wallets_status_enum" NOT NULL DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "fee" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ADD "netAmount" numeric(15,2)`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "currency" character varying(3) NOT NULL DEFAULT 'VND'`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ADD "paymentMethod" character varying(50)`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "externalTransactionId" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ADD "metadata" jsonb`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "failureReason" text`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "balanceAfter" numeric(15,2)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "initiatedBy" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "ipAddress" character varying(45)`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "relatedTransactionId" uuid`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "completedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "payoutMethodId" uuid NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD "fee" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "netAmount" numeric(15,2) NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD "currency" character varying(3) NOT NULL DEFAULT 'VND'`,
    );
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "approvedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "approvedBy" uuid`);
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "rejectedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "rejectedBy" character varying`);
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "rejectionReason" text`);
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD "externalReference" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "transactionId" uuid`);
    await queryRunner.query(`ALTER TABLE "payout_requests" ADD "adminNote" text`);
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ADD "raisedById" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "defendantId" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "evidence" jsonb`);
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_result_enum" AS ENUM('PENDING', 'WIN_CLIENT', 'WIN_FREELANCER', 'SPLIT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD "result" "public"."disputes_result_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ADD "adminComment" text`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "resolvedById" uuid`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "currency"`);
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "currency" character varying(3) NOT NULL DEFAULT 'VND'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" RENAME TO "transactions_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('DEPOSIT', 'WITHDRAWAL', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'REFUND', 'FEE_DEDUCTION')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "public"."transactions_type_enum" USING "type"::"text"::"public"."transactions_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_status_enum" RENAME TO "transactions_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "public"."transactions_status_enum" USING "status"::"text"::"public"."transactions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum_old"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "referenceType"`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "referenceType" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "referenceId"`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "referenceId" uuid`);
    await queryRunner.query(
      `ALTER TYPE "public"."payout_requests_status_enum" RENAME TO "payout_requests_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payout_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED')`,
    );
    await queryRunner.query(`ALTER TABLE "payout_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ALTER COLUMN "status" TYPE "public"."payout_requests_status_enum" USING "status"::"text"::"public"."payout_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."payout_requests_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" RENAME TO "disputes_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_status_enum" AS ENUM('OPEN', 'IN_MEDIATION', 'RESOLVED', 'REJECTED')`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" TYPE "public"."disputes_status_enum" USING "status"::"text"::"public"."disputes_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'OPEN'`);
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_35fc4b83a39ef23f08a4b5ac9c" ON "transactions" ("type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c9d9548cf8410e425e120b5e6" ON "transactions" ("walletId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD CONSTRAINT "FK_90c93283fb9c279f41bcde3c51f" FOREIGN KEY ("payoutMethodId") REFERENCES "payout_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD CONSTRAINT "FK_8f9cb3fd93e7a728acf64f61930" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ADD CONSTRAINT "FK_b52c23ed48d02fb1fe17449d2d6" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_methods" ADD CONSTRAINT "FK_372920d813ceab29336fc5221e6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD CONSTRAINT "FK_f07f9d851481059289600bc4128" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD CONSTRAINT "FK_54b1af06e01e858558a708d47cb" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD CONSTRAINT "FK_08723ed58ba58a217b8713f531d" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_8880a40e54bc9b4675323ca102e" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_bcfa408d5738fa2c2550bc2c073" FOREIGN KEY ("defendantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_00ac6d80806ccdd62cf9c159785" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fee_configs" ADD CONSTRAINT "FK_42214cd963e2591ef028f0ebdd9" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fee_configs" DROP CONSTRAINT "FK_42214cd963e2591ef028f0ebdd9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_00ac6d80806ccdd62cf9c159785"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_bcfa408d5738fa2c2550bc2c073"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_8880a40e54bc9b4675323ca102e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP CONSTRAINT "FK_08723ed58ba58a217b8713f531d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP CONSTRAINT "FK_54b1af06e01e858558a708d47cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP CONSTRAINT "FK_f07f9d851481059289600bc4128"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_methods" DROP CONSTRAINT "FK_372920d813ceab29336fc5221e6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" DROP CONSTRAINT "FK_b52c23ed48d02fb1fe17449d2d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" DROP CONSTRAINT "FK_8f9cb3fd93e7a728acf64f61930"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" DROP CONSTRAINT "FK_90c93283fb9c279f41bcde3c51f"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_2c9d9548cf8410e425e120b5e6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_35fc4b83a39ef23f08a4b5ac9c"`);
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_status_enum_old" AS ENUM('IN_REVIEW', 'OPEN', 'REJECTED', 'RESOLVED')`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" TYPE "public"."disputes_status_enum_old" USING "status"::"text"::"public"."disputes_status_enum_old"`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'OPEN'`);
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum_old" RENAME TO "disputes_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payout_requests_status_enum_old" AS ENUM('COMPLETED', 'PENDING', 'PROCESSING', 'REJECTED')`,
    );
    await queryRunner.query(`ALTER TABLE "payout_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ALTER COLUMN "status" TYPE "public"."payout_requests_status_enum_old" USING "status"::"text"::"public"."payout_requests_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payout_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."payout_requests_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payout_requests_status_enum_old" RENAME TO "payout_requests_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "referenceId"`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "referenceId" character varying`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "referenceType"`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "referenceType" character varying`);
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum_old" AS ENUM('CANCELED', 'FAILED', 'PENDING', 'SUCCESS')`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "public"."transactions_status_enum_old" USING "status"::"text"::"public"."transactions_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_status_enum_old" RENAME TO "transactions_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum_old" AS ENUM('DEPOSIT', 'HOLD', 'REFUND', 'RELEASE', 'WITHDRAWAL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "public"."transactions_type_enum_old" USING "type"::"text"::"public"."transactions_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum_old" RENAME TO "transactions_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "currency"`);
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "currency" character varying(10) NOT NULL DEFAULT 'VND'`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "resolvedById"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "adminComment"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "result"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_result_enum"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "evidence"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "defendantId"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "raisedById"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "adminNote"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "transactionId"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "externalReference"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "rejectionReason"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "rejectedBy"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "rejectedAt"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "approvedBy"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "approvedAt"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "netAmount"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "fee"`);
    await queryRunner.query(`ALTER TABLE "payout_requests" DROP COLUMN "payoutMethodId"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "completedAt"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "relatedTransactionId"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "ipAddress"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "initiatedBy"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "balanceAfter"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "failureReason"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "metadata"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "externalTransactionId"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "paymentMethod"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "netAmount"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "fee"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."wallets_status_enum"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "totalSpent"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "totalEarned"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "totalWithdrawn"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "totalDeposited"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "heldBalance"`);
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "pendingBalance"`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "resolution" text`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "against" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "raisedBy" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordOtpExpires" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordOtp" character varying(6)`);
    await queryRunner.query(`DROP TABLE "fee_configs"`);
    await queryRunner.query(`DROP TYPE "public"."fee_configs_feetype_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_54b1af06e01e858558a708d47c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f07f9d851481059289600bc412"`);
    await queryRunner.query(`DROP TABLE "escrows"`);
    await queryRunner.query(`DROP TYPE "public"."escrows_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_372920d813ceab29336fc5221e"`);
    await queryRunner.query(`DROP TABLE "payout_methods"`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_5a6f52453994f5b71258623f811" FOREIGN KEY ("raisedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_59a083d59f0249a8af3346c07fa" FOREIGN KEY ("against") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
