import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { ProjectRequestsController } from './project-requests.controller';
import { ProjectRequestsService } from './project-requests.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectRequestEntity, ProjectRequestAnswerEntity]),
    AuditLogsModule,
    AuthModule,
  ],
  controllers: [ProjectRequestsController],
  providers: [ProjectRequestsService],
  exports: [ProjectRequestsService],
})
export class ProjectRequestsModule {}
