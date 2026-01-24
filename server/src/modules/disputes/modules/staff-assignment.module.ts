// ============================================================================
// STAFF ASSIGNMENT MODULE
// ============================================================================
// Provides auto-assignment, workload management, and scheduling services
// Integrates with Tagging System for skill-based staff matching
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { DisputeEntity } from '../../../database/entities/dispute.entity';
import { UserEntity } from '../../../database/entities/user.entity';
import { StaffWorkloadEntity } from '../../../database/entities/staff-workload.entity';
import { CalendarEventEntity } from '../../../database/entities/calendar-event.entity';
import { UserAvailabilityEntity } from '../../../database/entities/user-availability.entity';
import { AutoScheduleRuleEntity } from '../../../database/entities/auto-schedule-rule.entity';
import { DisputeEvidenceEntity } from '../../../database/entities/dispute-evidence.entity';

// Tagging System Entities
import { StaffExpertiseEntity } from '../../../database/entities/user-skill.entity';
import {
  DisputeSkillRequirementEntity,
  SkillMappingRuleEntity,
} from '../../../database/entities/dispute-skill.entity';
import { SkillEntity } from '../../../database/entities/skill.entity';
import { StaffPerformanceEntity } from '../../../database/entities/staff-performance.entity';

// Services
import { StaffAssignmentService } from '../services/staff-assignment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Core Entities
      DisputeEntity,
      UserEntity,
      StaffWorkloadEntity,
      CalendarEventEntity,
      UserAvailabilityEntity,
      AutoScheduleRuleEntity,
      DisputeEvidenceEntity,
      // Tagging System Entities
      StaffExpertiseEntity,
      DisputeSkillRequirementEntity,
      SkillMappingRuleEntity,
      SkillEntity,
      // Performance Tracking
      StaffPerformanceEntity,
    ]),
  ],
  providers: [StaffAssignmentService],
  exports: [StaffAssignmentService],
})
export class StaffAssignmentModule {}
