import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportEntity, ReviewEntity } from 'src/database/entities';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportEntity, ReviewEntity]),
    ReviewModule, // Import để dùng ReviewService.softDelete
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
