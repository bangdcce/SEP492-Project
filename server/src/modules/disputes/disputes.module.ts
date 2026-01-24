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
import { CalendarModule } from '../calendar/calendar.module';
import { AuthModule } from '../auth/auth.module';
import {
  DisputeActivityEntity,
  DisputeEntity,
  DisputeEvidenceEntity,
  DisputeMessageEntity,
  DisputeNoteEntity,
  DisputeHearingEntity,
  DisputeSettlementEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
  DisputeVerdictEntity,
  LegalSignatureEntity,
  EscrowEntity,
  MilestoneEntity,
  ProjectEntity,
  TransactionEntity,
  UserEntity,
  WalletEntity,
  NotificationEntity,
} from 'src/database/entities';
import { StaffAssignmentModule } from './modules/staff-assignment.module';
import { HearingModule } from './modules/hearing.module';
import { VerdictService } from './services/verdict.service';
import { DisputeGateway } from './gateways/dispute.gateway';
import { DisputeEventListener } from './events/dispute-event.listener';
import { DisputeNotificationListener } from './events/dispute-notification.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeEntity,
      DisputeNoteEntity, // Ghi chú dispute
      DisputeActivityEntity, // Timeline hoạt động
      DisputeSettlementEntity, // Settlement offers
      DisputeEvidenceEntity,
      DisputeMessageEntity,
      // Hearing Room entities
      DisputeHearingEntity,
      HearingParticipantEntity,
      HearingStatementEntity,
      HearingQuestionEntity,
      DisputeVerdictEntity,
      LegalSignatureEntity,
      // Payment entities
      EscrowEntity,
      MilestoneEntity,
      ProjectEntity,
      UserEntity,
      WalletEntity,
      TransactionEntity,
      NotificationEntity,
    ]),
    EventEmitterModule.forRoot(), // Enable EventEmitter
    EvidenceModule, // ← Evidence có module riêng
    SettlementModule, // ← Settlement có module riêng
    TrustScoreModule,
    AuditLogsModule,
    UserWarningModule, // User warning/flag system
    StaffAssignmentModule,
    HearingModule,
    CalendarModule,
    AuthModule,
  ],
  controllers: [DisputesController],
  providers: [
    DisputesService,
    VerdictService,
    DisputeGateway,
    DisputeEventListener,
    DisputeNotificationListener,
  ],
  exports: [DisputesService, VerdictService],
})
export class DisputesModule {}
