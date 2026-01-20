// ============================================================================
// SETTLEMENT MODULE
// ============================================================================
// Module for handling pre-hearing settlement negotiations between dispute parties.
// Provides isolated settlement functionality with proper dependency injection.
// ============================================================================

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { DisputeSettlementEntity } from '../../../database/entities/dispute-settlement.entity';
import { DisputeEntity } from '../../../database/entities/dispute.entity';
import { EscrowEntity } from '../../../database/entities/escrow.entity';
import { UserEntity } from '../../../database/entities/user.entity';

// Service & Controller
import { SettlementService } from '../services/settlement.service';
import { SettlementController } from '../controllers/settlement.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DisputeSettlementEntity, DisputeEntity, EscrowEntity, UserEntity]),
    EventEmitterModule.forRoot(), // For settlement events
  ],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
