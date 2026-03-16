import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: Add Subscription System Tables
 *
 * Creates three tables for the subscription/quota system:
 * 1. subscription_plans - Available premium plans per role
 * 2. user_subscriptions - User's active subscription
 * 3. quota_usage_logs  - Daily/weekly quota tracking
 *
 * Also seeds the initial premium plans for each role.
 */
export class AddSubscriptionSystem1770000000000 implements MigrationInterface {
  name = 'AddSubscriptionSystem1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================
    // 1. subscription_plans
    // =====================
    await queryRunner.createTable(
      new Table({
        name: 'subscription_plans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['ADMIN', 'STAFF', 'BROKER', 'CLIENT', 'FREELANCER'],
            enumName: 'users_role_enum',
          },
          {
            name: 'price_monthly',
            type: 'decimal',
            precision: 12,
            scale: 0,
            default: 99000,
          },
          {
            name: 'price_quarterly',
            type: 'decimal',
            precision: 12,
            scale: 0,
            default: 252000,
          },
          {
            name: 'price_yearly',
            type: 'decimal',
            precision: 12,
            scale: 0,
            default: 832000,
          },
          {
            name: 'perks',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'display_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // =====================
    // 2. user_subscriptions
    // =====================
    await queryRunner.query(`
      CREATE TYPE "subscription_status_enum" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED')
    `);

    await queryRunner.query(`
      CREATE TYPE "billing_cycle_enum" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'user_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'plan_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'subscription_status_enum',
            default: "'ACTIVE'",
          },
          {
            name: 'billing_cycle',
            type: 'billing_cycle_enum',
            default: "'MONTHLY'",
          },
          {
            name: 'current_period_start',
            type: 'timestamp',
          },
          {
            name: 'current_period_end',
            type: 'timestamp',
          },
          {
            name: 'cancel_at_period_end',
            type: 'boolean',
            default: false,
          },
          {
            name: 'cancel_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'amount_paid',
            type: 'decimal',
            precision: 12,
            scale: 0,
            default: 0,
          },
          {
            name: 'payment_reference',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign keys for user_subscriptions
    await queryRunner.createForeignKey(
      'user_subscriptions',
      new TableForeignKey({
        name: 'FK_user_subscriptions_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_subscriptions',
      new TableForeignKey({
        name: 'FK_user_subscriptions_plan_id',
        columnNames: ['plan_id'],
        referencedTableName: 'subscription_plans',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // ====================
    // 3. quota_usage_logs
    // ====================
    await queryRunner.query(`
      CREATE TYPE "quota_action_enum" AS ENUM (
        'CREATE_REQUEST',
        'CONVERT_TO_PROJECT',
        'AI_MATCH_SEARCH',
        'INVITE_BROKER',
        'APPLY_TO_REQUEST',
        'CREATE_PROPOSAL',
        'APPLY_TO_PROJECT',
        'ADD_PORTFOLIO'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'quota_usage_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'action',
            type: 'quota_action_enum',
          },
          {
            name: 'date',
            type: 'date',
          },
          {
            name: 'count',
            type: 'int',
            default: 1,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign key for quota_usage_logs
    await queryRunner.createForeignKey(
      'quota_usage_logs',
      new TableForeignKey({
        name: 'FK_quota_usage_logs_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Indexes for efficient quota lookups
    await queryRunner.createIndex(
      'quota_usage_logs',
      new TableIndex({
        name: 'IDX_quota_usage_user_action_date',
        columnNames: ['user_id', 'action', 'date'],
      }),
    );

    await queryRunner.createIndex(
      'quota_usage_logs',
      new TableIndex({
        name: 'IDX_quota_usage_user_action_created',
        columnNames: ['user_id', 'action', 'created_at'],
      }),
    );

    // Index for subscription expiration cron job
    await queryRunner.createIndex(
      'user_subscriptions',
      new TableIndex({
        name: 'IDX_user_subscriptions_status_period_end',
        columnNames: ['status', 'current_period_end'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('user_subscriptions', 'IDX_user_subscriptions_status_period_end');
    await queryRunner.dropIndex('quota_usage_logs', 'IDX_quota_usage_user_action_created');
    await queryRunner.dropIndex('quota_usage_logs', 'IDX_quota_usage_user_action_date');

    // Drop foreign keys
    await queryRunner.dropForeignKey('quota_usage_logs', 'FK_quota_usage_logs_user_id');
    await queryRunner.dropForeignKey('user_subscriptions', 'FK_user_subscriptions_plan_id');
    await queryRunner.dropForeignKey('user_subscriptions', 'FK_user_subscriptions_user_id');

    // Drop tables
    await queryRunner.dropTable('quota_usage_logs', true);
    await queryRunner.dropTable('user_subscriptions', true);
    await queryRunner.dropTable('subscription_plans', true);

    // Drop enums
    await queryRunner.query('DROP TYPE IF EXISTS "quota_action_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "billing_cycle_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "subscription_status_enum"');
  }
}
