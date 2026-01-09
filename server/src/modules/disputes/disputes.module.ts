import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { HearingsService } from './hearings.service';
import { HearingsController, MyHearingsController } from './hearings.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DisputeActivityEntity,
  DisputeEntity,
  DisputeNoteEntity,
  DisputeHearingEntity,
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
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UserWarningModule } from '../user-warning/user-warning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeEntity,
      DisputeNoteEntity, // Ghi chú dispute
      DisputeActivityEntity, // Timeline hoạt động
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
    TrustScoreModule,
    AuditLogsModule,
    UserWarningModule, // User warning/flag system
  ],
  controllers: [DisputesController, HearingsController, MyHearingsController],
  providers: [DisputesService, HearingsService],
  exports: [DisputesService, HearingsService],
})
export class DisputesModule {}
