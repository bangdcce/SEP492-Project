import { Module } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service';
import { TrustScoreController } from './trust-score.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEntity, TrustScoreHistoryEntity, UserEntity } from 'src/database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewEntity, UserEntity, TrustScoreHistoryEntity])],
  controllers: [TrustScoreController],
  providers: [TrustScoreService],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}
