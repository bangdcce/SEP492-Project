import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycVerificationEntity } from '../../database/entities/kyc-verification.entity';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { FptAiService } from '../../common/services/fpt-ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KycVerificationEntity,
      AuditLogEntity,
      UserEntity,
    ]),
  ],
  controllers: [KycController],
  providers: [KycService, FptAiService],
  exports: [KycService],
})
export class KycModule {}
