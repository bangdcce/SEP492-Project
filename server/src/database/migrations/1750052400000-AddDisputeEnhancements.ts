import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddDisputeEnhancements1750052400000 implements MigrationInterface {
  name = 'AddDisputeEnhancements1750052400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===========================================================================
    // 1. Add new columns to disputes table
    // ===========================================================================

    // Role columns
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'raiserRole',
        type: 'enum',
        enum: ['CLIENT', 'FREELANCER', 'BROKER', 'ADMIN', 'STAFF'],
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'defendantRole',
        type: 'enum',
        enum: ['CLIENT', 'FREELANCER', 'BROKER', 'ADMIN', 'STAFF'],
        isNullable: true,
      }),
    );

    // Dispute type
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'disputeType',
        type: 'enum',
        enum: [
          'CLIENT_VS_FREELANCER',
          'CLIENT_VS_BROKER',
          'FREELANCER_VS_CLIENT',
          'FREELANCER_VS_BROKER',
          'BROKER_VS_CLIENT',
          'BROKER_VS_FREELANCER',
        ],
        isNullable: true,
      }),
    );

    // Category
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'category',
        type: 'enum',
        enum: [
          'QUALITY',
          'DEADLINE',
          'PAYMENT',
          'COMMUNICATION',
          'SCOPE_CHANGE',
          'FRAUD',
          'CONTRACT',
          'OTHER',
        ],
        default: "'OTHER'",
      }),
    );

    // Priority
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'priority',
        type: 'enum',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: "'MEDIUM'",
      }),
    );

    // Disputed amount
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'disputedAmount',
        type: 'decimal',
        precision: 18,
        scale: 2,
        isNullable: true,
      }),
    );

    // Defendant response columns
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'defendantResponse',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'defendantEvidence',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'defendantRespondedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    // Deadline columns
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'responseDeadline',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'resolutionDeadline',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'isOverdue',
        type: 'boolean',
        default: false,
      }),
    );

    // Dispute grouping columns
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'parentDisputeId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'groupId',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    // Appeal columns
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'isAppealed',
        type: 'boolean',
        default: false,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'appealReason',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'appealedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'appealResolvedById',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'appealResolution',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'appealResolvedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    // Add APPEALED status to enum if not exists
    await queryRunner.query(`
      ALTER TYPE "disputes_status_enum" ADD VALUE IF NOT EXISTS 'APPEALED';
    `);

    // ===========================================================================
    // 2. Create dispute_notes table
    // ===========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'dispute_notes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'disputeId',
            type: 'uuid',
          },
          {
            name: 'authorId',
            type: 'uuid',
          },
          {
            name: 'authorRole',
            type: 'enum',
            enum: ['CLIENT', 'FREELANCER', 'BROKER', 'ADMIN', 'STAFF'],
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'isInternal',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isPinned',
            type: 'boolean',
            default: false,
          },
          {
            name: 'noteType',
            type: 'varchar',
            length: '50',
            default: "'GENERAL'",
          },
          {
            name: 'attachments',
            type: 'jsonb',
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
          },
        ],
      }),
      true,
    );

    // ===========================================================================
    // 3. Create dispute_activities table
    // ===========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'dispute_activities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'disputeId',
            type: 'uuid',
          },
          {
            name: 'actorId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'actorRole',
            type: 'enum',
            enum: ['CLIENT', 'FREELANCER', 'BROKER', 'ADMIN', 'STAFF'],
            isNullable: true,
          },
          {
            name: 'action',
            type: 'enum',
            enum: [
              'CREATED',
              'ESCALATED',
              'RESOLVED',
              'REJECTED',
              'REOPENED',
              'EVIDENCE_ADDED',
              'EVIDENCE_REMOVED',
              'DEFENDANT_RESPONDED',
              'DEFENDANT_EVIDENCE_ADDED',
              'NOTE_ADDED',
              'PRIORITY_CHANGED',
              'CATEGORY_CHANGED',
              'ASSIGNED',
              'DEADLINE_EXTENDED',
              'APPEAL_SUBMITTED',
              'APPEAL_RESOLVED',
              'MESSAGE_SENT',
              'NOTIFICATION_SENT',
            ],
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isInternal',
            type: 'boolean',
            default: false,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // ===========================================================================
    // 4. Add foreign keys
    // ===========================================================================

    // dispute_notes -> disputes
    await queryRunner.createForeignKey(
      'dispute_notes',
      new TableForeignKey({
        columnNames: ['disputeId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'disputes',
        onDelete: 'CASCADE',
      }),
    );

    // dispute_notes -> users
    await queryRunner.createForeignKey(
      'dispute_notes',
      new TableForeignKey({
        columnNames: ['authorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // dispute_activities -> disputes
    await queryRunner.createForeignKey(
      'dispute_activities',
      new TableForeignKey({
        columnNames: ['disputeId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'disputes',
        onDelete: 'CASCADE',
      }),
    );

    // dispute_activities -> users
    await queryRunner.createForeignKey(
      'dispute_activities',
      new TableForeignKey({
        columnNames: ['actorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // disputes.parentDisputeId -> disputes.id
    await queryRunner.createForeignKey(
      'disputes',
      new TableForeignKey({
        columnNames: ['parentDisputeId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'disputes',
        onDelete: 'SET NULL',
      }),
    );

    // disputes.appealResolvedById -> users.id
    await queryRunner.createForeignKey(
      'disputes',
      new TableForeignKey({
        columnNames: ['appealResolvedById'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // ===========================================================================
    // 5. Add indexes for performance
    // ===========================================================================

    // dispute_notes indexes
    await queryRunner.createIndex(
      'dispute_notes',
      new TableIndex({
        name: 'IDX_dispute_notes_disputeId',
        columnNames: ['disputeId'],
      }),
    );

    await queryRunner.createIndex(
      'dispute_notes',
      new TableIndex({
        name: 'IDX_dispute_notes_authorId',
        columnNames: ['authorId'],
      }),
    );

    await queryRunner.createIndex(
      'dispute_notes',
      new TableIndex({
        name: 'IDX_dispute_notes_isInternal',
        columnNames: ['isInternal'],
      }),
    );

    // dispute_activities indexes
    await queryRunner.createIndex(
      'dispute_activities',
      new TableIndex({
        name: 'IDX_dispute_activities_disputeId',
        columnNames: ['disputeId'],
      }),
    );

    await queryRunner.createIndex(
      'dispute_activities',
      new TableIndex({
        name: 'IDX_dispute_activities_actorId',
        columnNames: ['actorId'],
      }),
    );

    await queryRunner.createIndex(
      'dispute_activities',
      new TableIndex({
        name: 'IDX_dispute_activities_action',
        columnNames: ['action'],
      }),
    );

    await queryRunner.createIndex(
      'dispute_activities',
      new TableIndex({
        name: 'IDX_dispute_activities_timestamp',
        columnNames: ['timestamp'],
      }),
    );

    // disputes table indexes
    await queryRunner.createIndex(
      'disputes',
      new TableIndex({
        name: 'IDX_disputes_category',
        columnNames: ['category'],
      }),
    );

    await queryRunner.createIndex(
      'disputes',
      new TableIndex({
        name: 'IDX_disputes_priority',
        columnNames: ['priority'],
      }),
    );

    await queryRunner.createIndex(
      'disputes',
      new TableIndex({
        name: 'IDX_disputes_isAppealed',
        columnNames: ['isAppealed'],
      }),
    );

    await queryRunner.createIndex(
      'disputes',
      new TableIndex({
        name: 'IDX_disputes_responseDeadline',
        columnNames: ['responseDeadline'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('disputes', 'IDX_disputes_responseDeadline');
    await queryRunner.dropIndex('disputes', 'IDX_disputes_isAppealed');
    await queryRunner.dropIndex('disputes', 'IDX_disputes_priority');
    await queryRunner.dropIndex('disputes', 'IDX_disputes_category');
    await queryRunner.dropIndex('dispute_activities', 'IDX_dispute_activities_timestamp');
    await queryRunner.dropIndex('dispute_activities', 'IDX_dispute_activities_action');
    await queryRunner.dropIndex('dispute_activities', 'IDX_dispute_activities_actorId');
    await queryRunner.dropIndex('dispute_activities', 'IDX_dispute_activities_disputeId');
    await queryRunner.dropIndex('dispute_notes', 'IDX_dispute_notes_isInternal');
    await queryRunner.dropIndex('dispute_notes', 'IDX_dispute_notes_authorId');
    await queryRunner.dropIndex('dispute_notes', 'IDX_dispute_notes_disputeId');

    // Drop foreign keys
    const disputesTable = await queryRunner.getTable('disputes');
    const disputeNotesTable = await queryRunner.getTable('dispute_notes');
    const disputeActivitiesTable = await queryRunner.getTable('dispute_activities');

    if (disputesTable) {
      const appealResolvedByFk = disputesTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('appealResolvedById') !== -1,
      );
      if (appealResolvedByFk) await queryRunner.dropForeignKey('disputes', appealResolvedByFk);

      const parentDisputeFk = disputesTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('parentDisputeId') !== -1,
      );
      if (parentDisputeFk) await queryRunner.dropForeignKey('disputes', parentDisputeFk);
    }

    if (disputeNotesTable) {
      for (const fk of disputeNotesTable.foreignKeys) {
        await queryRunner.dropForeignKey('dispute_notes', fk);
      }
    }

    if (disputeActivitiesTable) {
      for (const fk of disputeActivitiesTable.foreignKeys) {
        await queryRunner.dropForeignKey('dispute_activities', fk);
      }
    }

    // Drop tables
    await queryRunner.dropTable('dispute_activities');
    await queryRunner.dropTable('dispute_notes');

    // Drop columns from disputes
    const columnsToRemove = [
      'appealResolvedAt',
      'appealResolution',
      'appealResolvedById',
      'appealedAt',
      'appealReason',
      'isAppealed',
      'groupId',
      'parentDisputeId',
      'isOverdue',
      'resolutionDeadline',
      'responseDeadline',
      'defendantRespondedAt',
      'defendantEvidence',
      'defendantResponse',
      'disputedAmount',
      'priority',
      'category',
      'disputeType',
      'defendantRole',
      'raiserRole',
    ];

    for (const column of columnsToRemove) {
      await queryRunner.dropColumn('disputes', column);
    }
  }
}
