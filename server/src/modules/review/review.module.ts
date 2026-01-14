import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { AuditLogEntity, ProjectEntity, ReportEntity, ReviewEntity } from 'src/database/entities';

// Import các MODULE khác, không import Service lẻ tẻ
import { TrustScoreModule } from '../trust-score/trust-score.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    // 1. Kết nối Database cho ReviewModule
    TypeOrmModule.forFeature([ReviewEntity, ProjectEntity, AuditLogEntity, ReportEntity]),

    // 2. MƯỢN súng của hàng xóm (Import Module)
    // Khi import Module này, ReviewService sẽ tự động dùng được TrustScoreService
    // mà KHÔNG CẦN khai báo lại ở providers.
    TrustScoreModule,
    AuditLogsModule,
  ],
  controllers: [ReviewController],

  // 3. Chỉ khai báo Service của CHÍNH MÌNH
  providers: [ReviewService],

  // 4. Chỉ export Service của mình (nếu người khác cần dùng ReviewService)
  exports: [ReviewService],
})
export class ReviewModule {}
