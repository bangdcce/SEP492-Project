// ============================================================================
// HEARING MODULE
// ============================================================================
// Handles dispute hearings, scheduling, and live sessions
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import {
  DisputeEntity,
  ProjectEntity,
  UserEntity,
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
  CalendarEventEntity,
  EventParticipantEntity,
  UserAvailabilityEntity,
} from 'src/database/entities';

// Services
import { HearingService } from '../services/hearing.service';

// Controllers
import { HearingController } from '../controllers/hearing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeEntity,
      ProjectEntity,
      UserEntity,
      DisputeHearingEntity,
      HearingParticipantEntity,
      HearingStatementEntity,
      HearingQuestionEntity,
      CalendarEventEntity,
      EventParticipantEntity,
      UserAvailabilityEntity,
    ]),
  ],
  controllers: [HearingController],
  providers: [HearingService],
  exports: [HearingService],
})
export class HearingModule {}
