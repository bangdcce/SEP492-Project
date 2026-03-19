// ============================================================================
// HEARING MODULE
// ============================================================================
// Handles dispute hearings, scheduling, and live sessions
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { CalendarModule } from '../../calendar/calendar.module';
import { EvidenceModule } from '../evidence.module';

// Entities
import {
  DisputeEntity,
  DisputePartyEntity,
  ProjectEntity,
  ProjectSpecEntity,
  MilestoneEntity,
  ContractEntity,
  DisputeMessageEntity,
  DisputeInternalMembershipEntity,
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
import { HearingPresenceService } from '../services/hearing-presence.service';
import { HearingLifecycleScheduler } from '../services/hearing-lifecycle.scheduler';

// Controllers
import { HearingController } from '../controllers/hearing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeEntity,
      DisputePartyEntity,
      ProjectEntity,
      ProjectSpecEntity,
      MilestoneEntity,
      ContractEntity,
      DisputeMessageEntity,
      DisputeInternalMembershipEntity,
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
    CalendarModule,
    EvidenceModule,
  ],
  controllers: [HearingController],
  providers: [
    HearingService,
    HearingReminderScheduler,
    HearingLifecycleScheduler,
    HearingPresenceService,
  ],
  exports: [HearingService],
})
export class HearingModule {}
