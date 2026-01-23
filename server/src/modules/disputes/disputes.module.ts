import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { EvidenceModule } from './evidence.module';
import { SettlementModule } from './modules/settlement.module';
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UserWarningModule } from '../user-warning/user-warning.module';
import {
  DisputeActivityEntity,
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeNoteEntity,
  DisputeHearingEntity,
  DisputeSettlementEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
  EscrowEntity,
  MilestoneEntity,
  ProjectEntity,
  TransactionEntity,
  UserEntity,
  WalletEntity,
} from 'src/database/entities';
import { StaffAssignmentModule } from './modules/staff-assignment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeEntity,
      DisputeNoteEntity, // Ghi chú dispute
      DisputeActivityEntity, // Timeline hoạt động
      DisputeSettlementEntity, // Settlement offers
      // Hearing Room entities
      DisputeHearingEntity,
      HearingParticipantEntity,
      HearingStatementEntity,
      HearingQuestionEntity,
      // Payment entities
      EscrowEntity,
      MilestoneEntity,
      ProjectEntity,
      UserEntity,
      WalletEntity,
      TransactionEntity,
    ]),
    EventEmitterModule.forRoot(), // Enable EventEmitter
    EvidenceModule, // ← Evidence có module riêng
    SettlementModule, // ← Settlement có module riêng
    TrustScoreModule,
    AuditLogsModule,
    UserWarningModule, // User warning/flag system
    StaffAssignmentModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
