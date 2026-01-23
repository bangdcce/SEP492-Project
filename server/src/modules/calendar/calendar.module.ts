import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  AutoScheduleRuleEntity,
  CalendarEventEntity,
  EventParticipantEntity,
  EventRescheduleRequestEntity,
  StaffWorkloadEntity,
  UserAvailabilityEntity,
  UserEntity,
} from 'src/database/entities';
import { AutoScheduleService } from './auto-schedule.service';
import { CalendarService } from './calendar.service';
import { AvailabilityService } from './availability.service';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AutoScheduleRuleEntity,
      CalendarEventEntity,
      EventParticipantEntity,
      EventRescheduleRequestEntity,
      StaffWorkloadEntity,
      UserAvailabilityEntity,
      UserEntity,
    ]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService, AutoScheduleService, AvailabilityService],
  exports: [CalendarService, AutoScheduleService, AvailabilityService],
})
export class CalendarModule {}
