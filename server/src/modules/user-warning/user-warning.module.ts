import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFlagEntity, UserEntity, DisputeEntity } from 'src/database/entities';
import { UserWarningService } from './user-warning.service';
import { UserWarningController } from './user-warning.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserFlagEntity, UserEntity, DisputeEntity]), AuditLogsModule],
  controllers: [UserWarningController],
  providers: [UserWarningService],
  exports: [UserWarningService],
})
export class UserWarningModule {}
