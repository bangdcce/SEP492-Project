import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateKycAccessLog1737292900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create kyc_access_logs table
    await queryRunner.createTable(
      new Table({
        name: 'kyc_access_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'kycId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reviewerId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reviewerEmail',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'reviewerRole',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'enum',
            enum: ['VIEW_LIST', 'VIEW_DETAIL', 'DOWNLOAD_IMAGE', 'APPROVE', 'REJECT', 'REQUEST_ACCESS'],
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: ['ROUTINE_REVIEW', 'DISPUTE_INVESTIGATION', 'FRAUD_REPORT', 'LEGAL_REQUEST', 'COMPLIANCE_AUDIT', 'USER_SUPPORT'],
            isNullable: true,
          },
          {
            name: 'reasonDetails',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: false,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'accessedImages',
            type: 'text',
            isNullable: true,
            comment: 'Comma-separated list of accessed images',
          },
          {
            name: 'watermarkApplied',
            type: 'boolean',
            default: true,
          },
          {
            name: 'watermarkId',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'viewDurationSeconds',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'flaggedAsSuspicious',
            type: 'boolean',
            default: false,
          },
          {
            name: 'suspiciousReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'legalHold',
            type: 'boolean',
            default: false,
            comment: 'If true, this log cannot be deleted',
          },
          {
            name: 'accessExpiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'kyc_access_logs',
      new TableForeignKey({
        columnNames: ['kycId'],
        referencedTableName: 'kyc_verifications',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_kyc_access_logs_kyc',
      }),
    );

    await queryRunner.createForeignKey(
      'kyc_access_logs',
      new TableForeignKey({
        columnNames: ['reviewerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_kyc_access_logs_reviewer',
      }),
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'kyc_access_logs',
      new TableIndex({
        name: 'IDX_kyc_access_logs_reviewer_created',
        columnNames: ['reviewerId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'kyc_access_logs',
      new TableIndex({
        name: 'IDX_kyc_access_logs_kyc_action',
        columnNames: ['kycId', 'action'],
      }),
    );

    await queryRunner.createIndex(
      'kyc_access_logs',
      new TableIndex({
        name: 'IDX_kyc_access_logs_ip',
        columnNames: ['ipAddress'],
      }),
    );

    await queryRunner.createIndex(
      'kyc_access_logs',
      new TableIndex({
        name: 'IDX_kyc_access_logs_flagged',
        columnNames: ['flaggedAsSuspicious'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('kyc_access_logs', 'IDX_kyc_access_logs_flagged');
    await queryRunner.dropIndex('kyc_access_logs', 'IDX_kyc_access_logs_ip');
    await queryRunner.dropIndex('kyc_access_logs', 'IDX_kyc_access_logs_kyc_action');
    await queryRunner.dropIndex('kyc_access_logs', 'IDX_kyc_access_logs_reviewer_created');

    // Drop foreign keys
    await queryRunner.dropForeignKey('kyc_access_logs', 'FK_kyc_access_logs_reviewer');
    await queryRunner.dropForeignKey('kyc_access_logs', 'FK_kyc_access_logs_kyc');

    // Drop table
    await queryRunner.dropTable('kyc_access_logs');
  }
}
