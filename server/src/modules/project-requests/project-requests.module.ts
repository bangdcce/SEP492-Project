
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectRequestsController } from './project-requests.controller';
import { ProjectRequestsService } from './project-requests.service';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectRequestEntity, ProjectRequestAnswerEntity]),
    AuditLogsModule,
  ],
  controllers: [ProjectRequestsController],
  providers: [ProjectRequestsService],
  exports: [ProjectRequestsService],
})
export class ProjectRequestsModule {}
