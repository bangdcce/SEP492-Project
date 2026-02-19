// ============================================================================
// HEARING MODULE
// ============================================================================
// Handles dispute hearings, scheduling, and live sessions
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';

// Entities
import {
  DisputeEntity,
  DisputePartyEntity,
  ProjectEntity,
  UserEntity,
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
  NotificationEntity,
  HearingReminderDeliveryEntity,
  CalendarEventEntity,
  EventParticipantEntity,
  UserAvailabilityEntity,
} from 'src/database/entities';

// Services
import { HearingService } from '../services/hearing.service';
import { HearingReminderScheduler } from '../services/hearing-reminder.scheduler';

// Controllers
import { HearingController } from '../controllers/hearing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeEntity,
      DisputePartyEntity,
      ProjectEntity,
      UserEntity,
      DisputeHearingEntity,
      HearingParticipantEntity,
      HearingStatementEntity,
      HearingQuestionEntity,
      NotificationEntity,
      HearingReminderDeliveryEntity,
      CalendarEventEntity,
      EventParticipantEntity,
      UserAvailabilityEntity,
    ]),
    AuthModule,
  ],
  controllers: [HearingController],
  providers: [HearingService, HearingReminderScheduler],
  exports: [HearingService],
})
export class HearingModule {}
