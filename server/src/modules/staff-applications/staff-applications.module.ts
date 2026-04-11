import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffApplicationEntity } from '../../database/entities/staff-application.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { StaffApplicationsController } from './staff-applications.controller';
import { StaffApplicationsGateway } from './staff-applications.gateway';
import { StaffApplicationsService } from './staff-applications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffApplicationEntity, UserEntity]),
    AuditLogsModule,
    AuthModule,
  ],
  controllers: [StaffApplicationsController],
  providers: [StaffApplicationsService, StaffApplicationsGateway],
  exports: [StaffApplicationsService],
})
export class StaffApplicationsModule {}
