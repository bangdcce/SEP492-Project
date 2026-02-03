import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  StaffLeavePolicyEntity,
  StaffLeaveRequestEntity,
  StaffPerformanceEntity,
  UserAvailabilityEntity,
  UserEntity,
} from 'src/database/entities';
import { CalendarModule } from '../calendar/calendar.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffLeavePolicyEntity,
      StaffLeaveRequestEntity,
      StaffPerformanceEntity,
      UserAvailabilityEntity,
      UserEntity,
    ]),
    CalendarModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
