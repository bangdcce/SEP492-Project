import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EvidenceService } from './services/evidence.service';
import { EvidenceController } from './controllers/evidence.controller';
import { DisputeActivityEntity, DisputeEvidenceEntity, DisputeEntity, UserEntity } from 'src/database/entities';

/**
 * Evidence Module - Quản lý bằng chứng cho tranh chấp
 * - Upload file lên Supabase Storage
 * - Validate, hash, duplicate check
 * - Signed URLs với Redis cache
 * - Flag evidence (Staff/Admin)
 */
@Module({
  imports: [
    // Redis cache cho signed URLs
    CacheModule.register({
      ttl: 55 * 60 * 1000, // 55 minutes (URLs expire at 60min)
      max: 5000, // Max 5000 cached URLs
    }),
    // TypeORM entities
    TypeOrmModule.forFeature([DisputeEvidenceEntity, DisputeEntity, DisputeActivityEntity, UserEntity]),
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService], // Export để DisputesModule có thể dùng
})
export class EvidenceModule {}
