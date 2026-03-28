import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  AuditLogEntity,
  DisputeEntity,
  DisputeHearingEntity,
  EscrowEntity,
  NotificationEntity,
  ProjectEntity,
  StaffPerformanceEntity,
  StaffWorkloadEntity,
  UserEntity,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ProjectEntity,
      EscrowEntity,
      AuditLogEntity,
      DisputeEntity,
      DisputeHearingEntity,
      NotificationEntity,
      StaffPerformanceEntity,
      StaffWorkloadEntity,
    ]),
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
