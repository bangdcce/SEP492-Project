import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { ProjectSpecEntity } from '../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { EscrowEntity } from '../../database/entities/escrow.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractEntity,
      ProjectEntity,
      ProjectSpecEntity,
      MilestoneEntity,
      EscrowEntity,
      DigitalSignatureEntity,
    ]),
    AuditLogsModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
