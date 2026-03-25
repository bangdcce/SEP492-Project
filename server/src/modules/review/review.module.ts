import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { AuditLogEntity, ProjectEntity, ReportEntity, ReviewEntity, UserEntity } from 'src/database/entities';
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewEntity, ProjectEntity, AuditLogEntity, ReportEntity, UserEntity]),
    // Import TrustScoreModule so its review-mutation event listener is registered.
    TrustScoreModule,
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
