// ============================================================================
// STAFF ASSIGNMENT SERVICE - Auto-Assignment & Workload Management
// ============================================================================
// Pattern: Unit Functions → Compose Functions
// Addresses Edge Cases:
// - Dead Time & Phantom Overload (Time Range estimation)
// - Zombie Session (Idle Check)
// - Fragmented Time (Filler Tasks)
// - Buffer Zone (15min gaps)
// - Critical Overrun (Overtime handling)
// - Emergency Re-assignment (Sick leave)
// ============================================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThan, MoreThan, In, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Entities
import {
  DisputeEntity,
  DisputeStatus,
  DisputeCategory,
} from '../../../database/entities/dispute.entity';
import { UserEntity, UserRole } from '../../../database/entities/user.entity';
import { StaffWorkloadEntity } from '../../../database/entities/staff-workload.entity';
import {
  CalendarEventEntity,
  EventType,
  EventStatus,
} from '../../../database/entities/calendar-event.entity';
import {
  UserAvailabilityEntity,
  AvailabilityType,
} from '../../../database/entities/user-availability.entity';
import {
  AutoScheduleRuleEntity,
  SchedulingStrategy,
} from '../../../database/entities/auto-schedule-rule.entity';
import { DisputeEvidenceEntity } from '../../../database/entities/dispute-evidence.entity';

// Tagging System Entities
import { StaffExpertiseEntity } from '../../../database/entities/user-skill.entity';
import {
  DisputeSkillRequirementEntity,
  DisputeSkillSource,
  SkillMappingRuleEntity,
} from '../../../database/entities/dispute-skill.entity';
import { SkillEntity } from '../../../database/entities/skill.entity';

// Interfaces
import type {
  ComplexityLevel,
  ComplexityEstimation,
  ComplexityFactor,
  TimeEstimation,
  StaffScoreBreakdown,
  AvailableStaffResult,
  TimeSlot,
  SchedulingConstraints,
  AvailableSlotsResult,
  BufferConfig,
  SessionTimingStatus,
  SessionTimingResult,
  IdleCheckConfig,
  IdleCheckResult,
  FillerTask,
  FillerTaskType,
  FragmentedTimeResult,
  EarlyReleaseResult,
  ReassignmentRequest,
  ReassignmentResult,
  StaffPerformanceMetrics,
} from '../interfaces/staff-assignment.interface';

// Re-export interfaces for external use
export type {
  ComplexityLevel,
  ComplexityEstimation,
  TimeEstimation,
  StaffScoreBreakdown,
  AvailableStaffResult,
  TimeSlot,
  SessionTimingResult,
  IdleCheckResult,
  FillerTask,
  FragmentedTimeResult,
  EarlyReleaseResult,
  ReassignmentResult,
};

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const ASSIGNMENT_CONFIG = {
  // Scoring weights (must sum to 100)
  WORKLOAD_WEIGHT: 40,
  PERFORMANCE_WEIGHT: 40,
  FAIRNESS_WEIGHT: 20,

  // Thresholds
  MAX_UTILIZATION_RATE: 80, // Staff won't receive new work above this
  OVERLOADED_THRESHOLD: 90,
  SHORTAGE_THRESHOLD: 2, // Alert if < 2 staff available

  // Complexity base times (minutes)
  COMPLEXITY_BASE: {
    LOW: { minMinutes: 30, recommendedMinutes: 45, maxMinutes: 60 },
    MEDIUM: { minMinutes: 45, recommendedMinutes: 60, maxMinutes: 90 },
    HIGH: { minMinutes: 60, recommendedMinutes: 90, maxMinutes: 120 },
    CRITICAL: { minMinutes: 90, recommendedMinutes: 120, maxMinutes: 180 },
  } as Record<ComplexityLevel, TimeEstimation>,

  // Category weights for complexity (using DisputeCategory)
  CATEGORY_WEIGHTS: {
    [DisputeCategory.CONTRACT]: 30,
    [DisputeCategory.PAYMENT]: 25,
    [DisputeCategory.QUALITY]: 20,
    [DisputeCategory.DEADLINE]: 15,
    [DisputeCategory.COMMUNICATION]: 10,
    [DisputeCategory.SCOPE_CHANGE]: 20,
    [DisputeCategory.FRAUD]: 40,
    [DisputeCategory.OTHER]: 15,
  } as Record<string, number>,

  // Buffer configuration
  BUFFER: {
    standardBufferMinutes: 15,
    extendedBufferMinutes: 30,
    minRestMinutes: 10,
  } as BufferConfig,

  // Idle check configuration
  IDLE_CHECK: {
    warningThresholdMinutes: 15,
    autoCloseDelayMinutes: 5,
    autoCloseEnabled: true,
  } as IdleCheckConfig,

  // Filler task minimum gap
  MIN_GAP_FOR_HEARING: 60, // Don't schedule hearing if gap < 60 min
  MIN_GAP_FOR_FILLER: 15, // Can assign filler task if gap >= 15 min

  // Time slot scoring
  SLOT_SCORES: {
    PREFERRED: 50,
    MORNING_FRESH: 20, // 9-11am
    AFTER_LUNCH: 10, // 2-4pm
    LATE_AFTERNOON: 0, // 4-6pm
    OUTSIDE_HOURS: -100,
  },
} as const;

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class StaffAssignmentService {
  private readonly logger = new Logger(StaffAssignmentService.name);

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepository: Repository<DisputeEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(StaffWorkloadEntity)
    private readonly workloadRepository: Repository<StaffWorkloadEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarRepository: Repository<CalendarEventEntity>,
    @InjectRepository(UserAvailabilityEntity)
    private readonly availabilityRepository: Repository<UserAvailabilityEntity>,
    @InjectRepository(AutoScheduleRuleEntity)
    private readonly ruleRepository: Repository<AutoScheduleRuleEntity>,
    @InjectRepository(DisputeEvidenceEntity)
    private readonly evidenceRepository: Repository<DisputeEvidenceEntity>,
    // Tagging System Repositories
    @InjectRepository(StaffExpertiseEntity)
    private readonly staffExpertiseRepository: Repository<StaffExpertiseEntity>,
    @InjectRepository(DisputeSkillRequirementEntity)
    private readonly disputeSkillRepository: Repository<DisputeSkillRequirementEntity>,
    @InjectRepository(SkillMappingRuleEntity)
    private readonly skillMappingRepository: Repository<SkillMappingRuleEntity>,
    @InjectRepository(SkillEntity)
    private readonly skillRepository: Repository<SkillEntity>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ===========================================================================
  // UNIT FUNCTIONS: COMPLEXITY ESTIMATION
  // ===========================================================================

  /**
   * UNIT FUNCTION: Calculate base complexity from dispute category
   */
  private getCategoryComplexityWeight(category: DisputeCategory): number {
    return ASSIGNMENT_CONFIG.CATEGORY_WEIGHTS[category] || 15;
  }

  /**
   * UNIT FUNCTION: Calculate complexity from evidence count
   * More evidence = more time needed to review
   */
  private getEvidenceComplexityWeight(evidenceCount: number): number {
    // +10 minutes per evidence, max +60
    const weight = Math.min(evidenceCount * 10, 60);
    return weight;
  }

  /**
   * UNIT FUNCTION: Calculate complexity from description length
   * Longer descriptions often indicate more complex issues
   */
  private getDescriptionComplexityWeight(descriptionLength: number): number {
    if (descriptionLength > 2000) return 30;
    if (descriptionLength > 1000) return 15;
    return 0;
  }

  /**
   * UNIT FUNCTION: Determine complexity level from total score
   */
  private determineComplexityLevel(totalScore: number): ComplexityLevel {
    if (totalScore >= 100) return 'CRITICAL';
    if (totalScore >= 70) return 'HIGH';
    if (totalScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * UNIT FUNCTION: Get time estimation range for complexity level
   * Returns min/recommended/max to handle "Dead Time" edge case
   */
  private getTimeEstimationForLevel(level: ComplexityLevel): TimeEstimation {
    return { ...ASSIGNMENT_CONFIG.COMPLEXITY_BASE[level] };
  }

  /**
   * COMPOSE FUNCTION: Estimate dispute complexity with time range
   *
   * EDGE CASE ADDRESSED: "Dead Time & Phantom Overload"
   * - Returns a RANGE instead of single value
   * - UI can show recommended but allow Staff to adjust
   * - min ensures no spam scheduling (5-min hearings)
   */
  async estimateDisputeComplexity(disputeId: string): Promise<ComplexityEstimation> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Count evidence
    const evidenceCount = await this.evidenceRepository.count({
      where: { disputeId },
    });

    // Calculate individual factors
    const factors: ComplexityFactor[] = [];

    // Factor 1: Dispute Category
    const categoryWeight = this.getCategoryComplexityWeight(dispute.category);
    factors.push({
      name: 'Dispute Category',
      weight: 0.4,
      value: categoryWeight,
      contribution: categoryWeight * 0.4,
      description: `${dispute.category} disputes typically require ${categoryWeight > 20 ? 'more' : 'less'} time`,
    });

    // Factor 2: Evidence Count
    const evidenceWeight = this.getEvidenceComplexityWeight(evidenceCount);
    factors.push({
      name: 'Evidence Volume',
      weight: 0.3,
      value: evidenceWeight,
      contribution: evidenceWeight * 0.3,
      description: `${evidenceCount} evidence items to review`,
    });

    // Factor 3: Reason Length (longer reasons often indicate more complex issues)
    const reasonLength = dispute.reason?.length || 0;
    const descWeight = this.getDescriptionComplexityWeight(reasonLength);
    factors.push({
      name: 'Issue Complexity',
      weight: 0.2,
      value: descWeight,
      contribution: descWeight * 0.2,
      description:
        reasonLength > 1000 ? 'Detailed issue description' : 'Standard issue description',
    });

    // Factor 4: Dispute Amount (higher amounts = more scrutiny)
    const amount = dispute.disputedAmount || 0;
    const amountWeight = amount > 5000 ? 30 : amount > 1000 ? 20 : 10;
    factors.push({
      name: 'Dispute Value',
      weight: 0.1,
      value: amountWeight,
      contribution: amountWeight * 0.1,
      description: `$${amount} at stake`,
    });

    // Calculate total score
    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

    // Determine level and time estimation
    const level = this.determineComplexityLevel(totalScore);
    const timeEstimation = this.getTimeEstimationForLevel(level);

    // Adjust time based on specific factors
    if (evidenceCount > 10) {
      timeEstimation.recommendedMinutes += 15;
      timeEstimation.maxMinutes += 30;
    }

    // Calculate confidence (lower if we have less data)
    const confidence = Math.min(
      100,
      50 + evidenceCount * 5 + (reasonLength > 500 ? 20 : 0) + (amount > 0 ? 10 : 0),
    );

    this.logger.log(
      `Complexity for dispute ${disputeId}: ${level} ` +
        `(${timeEstimation.minMinutes}-${timeEstimation.maxMinutes} min, confidence: ${confidence}%)`,
    );

    return {
      level,
      timeEstimation,
      factors,
      confidence,
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: SKILL/TAGGING SYSTEM
  // ===========================================================================

  /**
   * UNIT FUNCTION: Auto-detect required skills from dispute category
   * Uses skill_mapping_rules table to determine which audit skills are needed
   */
  async autoDetectRequiredSkills(disputeId: string, category: DisputeCategory): Promise<void> {
    // Find mapping rules for this dispute category
    const mappingRules = await this.skillMappingRepository.find({
      where: {
        entityType: 'DISPUTE_CATEGORY',
        entityValue: category,
        isActive: true,
      },
      order: { priority: 'ASC' },
    });

    if (mappingRules.length === 0) {
      this.logger.log(`No skill mapping rules found for category: ${category}`);
      return;
    }

    // Create dispute skill requirements
    for (const rule of mappingRules) {
      const existing = await this.disputeSkillRepository.findOne({
        where: { disputeId, skillId: rule.skillId },
      });

      if (!existing) {
        await this.disputeSkillRepository.save({
          disputeId,
          skillId: rule.skillId,
          source: DisputeSkillSource.AUTO_DETECTED,
          requiredLevel: rule.requiredLevel,
          isMandatory: rule.isMandatory,
        });

        this.logger.log(`Auto-tagged dispute ${disputeId} with skill ${rule.skillId}`);
      }
    }
  }

  /**
   * UNIT FUNCTION: Get required skills for a dispute
   */
  async getDisputeRequiredSkills(disputeId: string): Promise<DisputeSkillRequirementEntity[]> {
    return this.disputeSkillRepository.find({
      where: { disputeId },
      relations: ['skill'],
    });
  }

  /**
   * UNIT FUNCTION: Calculate skill match score between staff expertise and dispute requirements
   * Returns 0-100 based on how well staff's expertise matches dispute needs
   */
  async calculateSkillMatchScore(staffId: string, disputeId: string): Promise<number> {
    // Get dispute required skills
    const requirements = await this.disputeSkillRepository.find({
      where: { disputeId },
    });

    if (requirements.length === 0) {
      // No specific skills required, return neutral score
      return 50;
    }

    // Get staff expertise
    const expertise = await this.staffExpertiseRepository.find({
      where: { staffId, isActive: true },
    });

    if (expertise.length === 0) {
      // Staff has no documented expertise, return low score
      return 20;
    }

    // Calculate match
    let totalScore = 0;
    let maxScore = 0;
    let mandatoryMet = true;

    for (const req of requirements) {
      const weight = req.isMandatory ? 2 : 1; // Mandatory skills worth more
      maxScore += 100 * weight;

      const staffSkill = expertise.find((e) => e.skillId === req.skillId);

      if (staffSkill) {
        // Staff has this skill - calculate level match
        const levelRatio = Math.min(staffSkill.expertiseLevel / req.requiredLevel, 1);
        const skillScore = levelRatio * 100;

        // Bonus for exceeding required level
        const bonus = staffSkill.expertiseLevel > req.requiredLevel ? 10 : 0;

        totalScore += (skillScore + bonus) * weight;
      } else if (req.isMandatory) {
        mandatoryMet = false;
      }
    }

    // If mandatory skill not met, heavily penalize
    if (!mandatoryMet) {
      return Math.max(0, (totalScore / maxScore) * 100 * 0.3);
    }

    return Math.round((totalScore / maxScore) * 100);
  }

  /**
   * UNIT FUNCTION: Get staff with matching expertise for dispute
   * Returns staff sorted by skill match score
   */
  async getStaffBySkillMatch(
    disputeId: string,
    staffIds: string[],
  ): Promise<{ staffId: string; skillMatchScore: number }[]> {
    const results: { staffId: string; skillMatchScore: number }[] = [];

    for (const staffId of staffIds) {
      const score = await this.calculateSkillMatchScore(staffId, disputeId);
      results.push({ staffId, skillMatchScore: score });
    }

    return results.sort((a, b) => b.skillMatchScore - a.skillMatchScore);
  }

  /**
   * UNIT FUNCTION: Manually tag dispute with additional skill requirement
   */
  async tagDisputeWithSkill(
    disputeId: string,
    skillId: string,
    addedById: string,
    requiredLevel: number = 1,
    notes?: string,
  ): Promise<DisputeSkillRequirementEntity> {
    // Verify skill exists and is for staff
    const skill = await this.skillRepository.findOne({
      where: { id: skillId, forStaff: true },
    });

    if (!skill) {
      throw new BadRequestException('Invalid skill or skill is not an audit skill');
    }

    // Check if already tagged
    const existing = await this.disputeSkillRepository.findOne({
      where: { disputeId, skillId },
    });

    if (existing) {
      // Update existing
      existing.requiredLevel = requiredLevel;
      existing.notes = notes || existing.notes;
      return this.disputeSkillRepository.save(existing);
    }

    // Create new
    return this.disputeSkillRepository.save({
      disputeId,
      skillId,
      source: DisputeSkillSource.MANUAL_TAGGED,
      requiredLevel,
      isMandatory: false,
      addedById,
      notes,
    });
  }

  /**
   * UNIT FUNCTION: Update staff expertise stats after dispute resolution
   */
  async updateStaffExpertiseStats(
    staffId: string,
    disputeId: string,
    wasSuccessful: boolean,
  ): Promise<void> {
    // Get skills used in this dispute
    const requirements = await this.disputeSkillRepository.find({
      where: { disputeId },
    });

    for (const req of requirements) {
      const expertise = await this.staffExpertiseRepository.findOne({
        where: { staffId, skillId: req.skillId },
      });

      if (expertise) {
        expertise.disputesHandled += 1;

        // Recalculate success rate
        if (wasSuccessful) {
          const successCount = (expertise.successRate * (expertise.disputesHandled - 1)) / 100 + 1;
          expertise.successRate = (successCount / expertise.disputesHandled) * 100;
        } else {
          const successCount = (expertise.successRate * (expertise.disputesHandled - 1)) / 100;
          expertise.successRate = (successCount / expertise.disputesHandled) * 100;
        }

        await this.staffExpertiseRepository.save(expertise);
      }
    }
  }

  // ===========================================================================
  // UNIT FUNCTIONS: STAFF SCORING
  // ===========================================================================

  /**
   * UNIT FUNCTION: Calculate workload score (40% weight)
   * Lower utilization = higher score
   */
  private calculateWorkloadScore(utilizationRate: number): number {
    // 0% utilization = 100 points, 80% = 20 points, 100% = 0 points
    return Math.max(0, 100 - utilizationRate);
  }

  /**
   * UNIT FUNCTION: Calculate performance score (40% weight)
   * Based on user rating and overturn rate
   */
  private calculatePerformanceScore(avgRating: number, overturnRate: number): number {
    // Rating: 1-5 stars → 0-100 points (5 stars = 100)
    const ratingScore = (avgRating / 5) * 100;

    // Overturn penalty: Each % of overturn reduces score
    const overturnPenalty = overturnRate * 0.5;

    return Math.max(0, ratingScore - overturnPenalty);
  }

  /**
   * UNIT FUNCTION: Calculate fairness score (20% weight)
   * Staff with fewer disputes this month get higher score (round-robin effect)
   */
  private calculateFairnessScore(monthlyDisputeCount: number, avgMonthlyDisputes: number): number {
    if (avgMonthlyDisputes === 0) return 50;

    // If below average, bonus points. If above, penalty.
    const ratio = monthlyDisputeCount / avgMonthlyDisputes;
    if (ratio < 0.5) return 100; // Way below average
    if (ratio < 0.8) return 80;
    if (ratio < 1.0) return 60;
    if (ratio < 1.2) return 40;
    return 20; // Overworked this month
  }

  /**
   * UNIT FUNCTION: Calculate total staff score
   */
  private calculateTotalStaffScore(
    workloadScore: number,
    performanceScore: number,
    fairnessScore: number,
  ): number {
    const weighted =
      workloadScore * (ASSIGNMENT_CONFIG.WORKLOAD_WEIGHT / 100) +
      performanceScore * (ASSIGNMENT_CONFIG.PERFORMANCE_WEIGHT / 100) +
      fairnessScore * (ASSIGNMENT_CONFIG.FAIRNESS_WEIGHT / 100);

    return Math.round(weighted * 100) / 100;
  }

  /**
   * COMPOSE FUNCTION: Get available staff with scoring
   *
   * EDGE CASE ADDRESSED: "Cherry Picking"
   * - Returns scored list for AUTO-ASSIGN (mandatory)
   * - Staff cannot reject assignments
   */
  async getAvailableStaff(date?: Date): Promise<AvailableStaffResult> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // 1. Get all active staff (not banned)
    const allStaff = await this.userRepository.find({
      where: { role: UserRole.STAFF, isBanned: false },
    });

    if (allStaff.length === 0) {
      return {
        staff: [],
        totalAvailable: 0,
        totalStaff: 0,
        shortageWarning: true,
        recommendedStaffId: null,
      };
    }

    // 2. Get workload for all staff on target date
    const workloads = await this.workloadRepository.find({
      where: {
        staffId: In(allStaff.map((s) => s.id)),
        date: dateStr as any,
      },
    });

    const workloadMap = new Map(workloads.map((w) => [w.staffId, w]));

    // 3. Calculate average monthly disputes for fairness
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthlyStats = await this.disputeRepository
      .createQueryBuilder('d')
      .select('d.assignedStaffId', 'staffId')
      .addSelect('COUNT(*)', 'count')
      .where('d.assignedStaffId IS NOT NULL')
      .andWhere('d.createdAt >= :monthStart', { monthStart })
      .groupBy('d.assignedStaffId')
      .getRawMany();

    const monthlyMap = new Map(monthlyStats.map((s) => [s.staffId, parseInt(s.count)]));
    const avgMonthly =
      monthlyStats.length > 0
        ? monthlyStats.reduce((sum, s) => sum + parseInt(s.count), 0) / monthlyStats.length
        : 0;

    // 4. Score each staff
    const scoredStaff: StaffScoreBreakdown[] = [];

    for (const staff of allStaff) {
      const workload = workloadMap.get(staff.id);
      const monthlyCount = monthlyMap.get(staff.id) || 0;

      // Default workload if not exists
      const utilizationRate = workload?.utilizationRate || 0;
      const isOnLeave = workload?.isOnLeave || false;
      const canAccept = workload?.canAcceptNewEvent ?? true;

      // TODO: Get actual performance metrics from staff_performance table
      const avgUserRating = 4.0; // Placeholder
      const overturnRate = 5; // Placeholder

      // Calculate scores
      const workloadScore = this.calculateWorkloadScore(utilizationRate);
      const performanceScore = this.calculatePerformanceScore(avgUserRating, overturnRate);
      const fairnessScore = this.calculateFairnessScore(monthlyCount, avgMonthly);
      const totalScore = this.calculateTotalStaffScore(
        workloadScore,
        performanceScore,
        fairnessScore,
      );

      // Determine availability
      let isAvailable = true;
      let unavailableReason: string | undefined;

      if (isOnLeave) {
        isAvailable = false;
        unavailableReason = 'On leave';
      } else if (utilizationRate >= ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE) {
        isAvailable = false;
        unavailableReason = `Utilization at ${utilizationRate}% (max ${ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE}%)`;
      } else if (!canAccept) {
        isAvailable = false;
        unavailableReason = 'Cannot accept new events';
      }

      scoredStaff.push({
        staffId: staff.id,
        totalScore: isAvailable ? totalScore : 0,
        workloadScore,
        performanceScore,
        fairnessScore,
        utilizationRate,
        avgUserRating,
        overturnRate,
        monthlyDisputeCount: monthlyCount,
        isAvailable,
        isOnLeave,
        canAcceptNewEvent: canAccept,
        unavailableReason,
      });
    }

    // 5. Sort by score (available staff first, then by score)
    scoredStaff.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return b.totalScore - a.totalScore;
    });

    const availableStaff = scoredStaff.filter((s) => s.isAvailable);
    const shortageWarning = availableStaff.length < ASSIGNMENT_CONFIG.SHORTAGE_THRESHOLD;

    if (shortageWarning) {
      this.eventEmitter.emit('staff.shortage', {
        availableCount: availableStaff.length,
        requiredCount: ASSIGNMENT_CONFIG.SHORTAGE_THRESHOLD,
        affectedDisputes: [],
      });
    }

    return {
      staff: scoredStaff,
      totalAvailable: availableStaff.length,
      totalStaff: allStaff.length,
      shortageWarning,
      recommendedStaffId: availableStaff[0]?.staffId || null,
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: BUFFER ZONE & TIMING
  // ===========================================================================

  /**
   * UNIT FUNCTION: Get buffer config for event type
   */
  private getBufferConfig(eventType: EventType, complexity?: ComplexityLevel): BufferConfig {
    const base = { ...ASSIGNMENT_CONFIG.BUFFER };

    // High/Critical complexity gets extended buffer
    if (complexity === 'HIGH' || complexity === 'CRITICAL') {
      base.standardBufferMinutes = base.extendedBufferMinutes;
    }

    return base;
  }

  /**
   * UNIT FUNCTION: Calculate remaining time in session
   */
  private calculateRemainingTime(scheduledEndTime: Date, currentTime: Date = new Date()): number {
    const diff = scheduledEndTime.getTime() - currentTime.getTime();
    return Math.floor(diff / (1000 * 60));
  }

  /**
   * UNIT FUNCTION: Calculate overtime
   */
  private calculateOvertime(
    scheduledEndTime: Date,
    bufferEndTime: Date,
    currentTime: Date = new Date(),
  ): { overtimeMinutes: number; inBuffer: boolean; pastBuffer: boolean } {
    const scheduledDiff = currentTime.getTime() - scheduledEndTime.getTime();
    const bufferDiff = currentTime.getTime() - bufferEndTime.getTime();

    return {
      overtimeMinutes: Math.max(0, Math.floor(scheduledDiff / (1000 * 60))),
      inBuffer: scheduledDiff > 0 && bufferDiff <= 0,
      pastBuffer: bufferDiff > 0,
    };
  }

  /**
   * COMPOSE FUNCTION: Check session timing status
   *
   * EDGE CASES ADDRESSED:
   * - "10-Minute Warning" before end
   * - "Overtime" handling within buffer
   * - "Critical Overrun" when buffer exceeded
   */
  async checkSessionTiming(eventId: string): Promise<SessionTimingResult> {
    const event = await this.calendarRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const now = new Date();
    const scheduledEnd = new Date(event.endTime);
    const buffer = this.getBufferConfig(event.type);
    const bufferEnd = new Date(scheduledEnd.getTime() + buffer.standardBufferMinutes * 60 * 1000);

    const remaining = this.calculateRemainingTime(scheduledEnd, now);
    const overtime = this.calculateOvertime(scheduledEnd, bufferEnd, now);

    // Check if next event is affected
    const nextEvent = await this.calendarRepository.findOne({
      where: {
        organizerId: event.organizerId,
        startTime: MoreThan(event.endTime),
        status: In([EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION]),
      },
      order: { startTime: 'ASC' },
    });

    let nextEventAffected = false;
    let nextEventDelayMinutes = 0;
    if (nextEvent && overtime.pastBuffer) {
      nextEventAffected = true;
      nextEventDelayMinutes = overtime.overtimeMinutes - buffer.standardBufferMinutes;
    }

    // Determine status and suggested action
    let status: SessionTimingStatus;
    let suggestedAction: 'CONTINUE' | 'WRAP_UP' | 'ADJOURN' | 'NOTIFY_NEXT';
    let warningMessage: string | undefined;

    if (remaining > 10) {
      status = 'ON_TIME';
      suggestedAction = 'CONTINUE';
    } else if (remaining > 0) {
      status = 'WARNING';
      suggestedAction = 'WRAP_UP';
      warningMessage = `⚠️ ${remaining} minutes remaining. Please wrap up the discussion.`;
    } else if (overtime.inBuffer) {
      status = 'OVERTIME';
      suggestedAction = nextEventAffected ? 'NOTIFY_NEXT' : 'WRAP_UP';
      warningMessage = `🔴 Session has exceeded scheduled time by ${overtime.overtimeMinutes} minutes. Using buffer time.`;
    } else {
      status = 'CRITICAL_OVERRUN';
      suggestedAction = 'ADJOURN';
      warningMessage =
        `🚨 CRITICAL: Buffer time exhausted. ` +
        `Session must be adjourned to avoid affecting next appointment.`;
    }

    // Emit event if critical
    if (status === 'CRITICAL_OVERRUN' || nextEventAffected) {
      this.eventEmitter.emit('session.overtime', {
        hearingId: eventId,
        overtimeMinutes: overtime.overtimeMinutes,
        nextEventAffected,
        action: status === 'CRITICAL_OVERRUN' ? 'ADJOURN' : 'NOTIFY',
      });
    }

    return {
      status,
      scheduledEndTime: scheduledEnd,
      bufferEndTime: bufferEnd,
      remainingMinutes: Math.max(0, remaining),
      overtimeMinutes: overtime.overtimeMinutes,
      nextEventAffected,
      nextEventId: nextEvent?.id,
      nextEventDelayMinutes,
      suggestedAction,
      warningMessage,
    };
  }

  // ===========================================================================
  // UNIT FUNCTIONS: IDLE CHECK
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Check if session is idle (no activity)
   *
   * EDGE CASE ADDRESSED: "Zombie Session"
   * - Staff forgets to end session
   * - System auto-warns then auto-closes
   */
  async checkSessionIdle(eventId: string, lastActivityAt: Date): Promise<IdleCheckResult> {
    const config = ASSIGNMENT_CONFIG.IDLE_CHECK;
    const now = new Date();
    const idleMs = now.getTime() - lastActivityAt.getTime();
    const idleMinutes = Math.floor(idleMs / (1000 * 60));

    const shouldWarn = idleMinutes >= config.warningThresholdMinutes;
    const shouldAutoClose =
      config.autoCloseEnabled &&
      idleMinutes >= config.warningThresholdMinutes + config.autoCloseDelayMinutes;

    let warningMessage: string | undefined;
    if (shouldAutoClose) {
      warningMessage =
        `🔔 Session inactive for ${idleMinutes} minutes. ` +
        `Session will be auto-closed. Click "Keep Active" to continue.`;
    } else if (shouldWarn) {
      warningMessage =
        `🔔 No activity for ${idleMinutes} minutes. ` +
        `Is the session still ongoing? Click "End Session" if finished.`;
    }

    if (shouldWarn) {
      this.eventEmitter.emit('session.idle', {
        hearingId: eventId,
        staffId: '', // Will be filled by caller
        idleMinutes,
        action: shouldAutoClose ? 'AUTO_CLOSE' : 'WARNING',
      });
    }

    return {
      isIdle: shouldWarn,
      lastActivityAt,
      idleMinutes,
      shouldWarn,
      shouldAutoClose,
      warningMessage,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: EARLY RELEASE
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Release staff early when session ends before scheduled time
   *
   * EDGE CASE ADDRESSED: "Dead Time"
   * - When session ends early, immediately free up staff
   * - Update workload to allow new assignments
   */
  async earlyReleaseStaff(
    eventId: string,
    actualEndTime: Date = new Date(),
  ): Promise<EarlyReleaseResult> {
    const event = await this.calendarRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const scheduledEnd = new Date(event.endTime);
    const releasedMinutes = Math.max(
      0,
      Math.floor((scheduledEnd.getTime() - actualEndTime.getTime()) / (1000 * 60)),
    );

    if (releasedMinutes === 0) {
      return {
        releasedMinutes: 0,
        newAvailableSlot: null,
        workloadUpdated: false,
        canAcceptNewEvent: false,
        nextPendingDisputes: 0,
      };
    }

    // Update event end time
    await this.calendarRepository.update(eventId, {
      endTime: actualEndTime,
      durationMinutes: event.durationMinutes - releasedMinutes,
    });

    // Update staff workload
    const dateStr = actualEndTime.toISOString().split('T')[0];
    const workload = await this.workloadRepository.findOne({
      where: { staffId: event.organizerId, date: dateStr as any },
    });

    let canAcceptNewEvent = false;
    if (workload) {
      const newScheduledMinutes = Math.max(0, workload.scheduledMinutes - releasedMinutes);
      const newUtilization = (newScheduledMinutes / workload.dailyCapacityMinutes) * 100;
      canAcceptNewEvent = newUtilization < ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE;

      await this.workloadRepository.update(workload.id, {
        scheduledMinutes: newScheduledMinutes,
        utilizationRate: newUtilization,
        canAcceptNewEvent,
        isOverloaded: newUtilization >= ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD,
      });
    }

    // Find next event to calculate available slot
    const nextEvent = await this.calendarRepository.findOne({
      where: {
        organizerId: event.organizerId,
        startTime: MoreThan(actualEndTime),
        status: In([EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION]),
      },
      order: { startTime: 'ASC' },
    });

    const buffer = this.getBufferConfig(event.type);
    const slotStart = new Date(actualEndTime.getTime() + buffer.minRestMinutes * 60 * 1000);
    const slotEnd = nextEvent
      ? new Date(nextEvent.startTime)
      : new Date(actualEndTime.getTime() + releasedMinutes * 60 * 1000);

    const slotDuration = Math.floor((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60));

    // Count pending disputes that could be assigned
    const pendingDisputes = await this.disputeRepository.count({
      where: { assignedStaffId: IsNull(), status: DisputeStatus.OPEN },
    });

    this.logger.log(
      `Early release: Staff ${event.organizerId} freed ${releasedMinutes} minutes. ` +
        `New slot: ${slotDuration} min available.`,
    );

    this.eventEmitter.emit('session.earlyRelease', {
      hearingId: eventId,
      staffId: event.organizerId,
      releasedMinutes,
    });

    return {
      releasedMinutes,
      newAvailableSlot:
        slotDuration >= ASSIGNMENT_CONFIG.MIN_GAP_FOR_FILLER
          ? {
              start: slotStart,
              end: slotEnd,
              durationMinutes: slotDuration,
              score: 50,
              scoreReasons: ['Released from early completion'],
            }
          : null,
      workloadUpdated: true,
      canAcceptNewEvent,
      nextPendingDisputes: pendingDisputes,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: FRAGMENTED TIME & FILLER TASKS
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Analyze fragmented time and suggest filler tasks
   *
   * EDGE CASE ADDRESSED: "Fragmented Time"
   * - Short gaps (<60min) shouldn't be used for hearings
   * - Instead, assign async tasks (review evidence, draft verdict, etc.)
   */
  async analyzeFragmentedTime(
    staffId: string,
    gapStart: Date,
    gapEnd: Date,
  ): Promise<FragmentedTimeResult> {
    const gapMinutes = Math.floor((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60));

    // Can we schedule a hearing?
    const canScheduleHearing = gapMinutes >= ASSIGNMENT_CONFIG.MIN_GAP_FOR_HEARING;

    if (canScheduleHearing) {
      return {
        gapMinutes,
        canScheduleHearing: true,
        suggestedFillerTasks: [],
        reason: `Gap of ${gapMinutes} minutes is sufficient for a hearing`,
      };
    }

    if (gapMinutes < ASSIGNMENT_CONFIG.MIN_GAP_FOR_FILLER) {
      return {
        gapMinutes,
        canScheduleHearing: false,
        suggestedFillerTasks: [],
        reason: `Gap of ${gapMinutes} minutes is too short for any task`,
      };
    }

    // Find filler tasks based on available time
    const suggestedTasks: FillerTask[] = [];

    // Priority 1: Review evidence for upcoming hearings (15-30 min)
    const upcomingHearings = await this.calendarRepository.find({
      where: {
        organizerId: staffId,
        type: EventType.DISPUTE_HEARING,
        startTime: MoreThan(gapEnd),
        status: EventStatus.SCHEDULED,
      },
      take: 3,
      order: { startTime: 'ASC' },
    });

    for (const hearing of upcomingHearings) {
      if (hearing.referenceId) {
        const evidenceCount = await this.evidenceRepository.count({
          where: { disputeId: hearing.referenceId },
        });

        if (evidenceCount > 0) {
          const estimatedTime = Math.min(30, evidenceCount * 5);
          if (estimatedTime <= gapMinutes) {
            suggestedTasks.push({
              type: 'REVIEW_EVIDENCE',
              title: `Review evidence for hearing at ${hearing.startTime.toLocaleTimeString()}`,
              description: `${evidenceCount} evidence items to review before the hearing`,
              estimatedMinutes: estimatedTime,
              priority: 'HIGH',
              relatedEntityType: 'Dispute',
              relatedEntityId: hearing.referenceId,
            });
          }
        }
      }
    }

    // Priority 2: Draft pending verdicts (30-45 min)
    if (gapMinutes >= 30) {
      const pendingVerdicts = await this.disputeRepository.count({
        where: {
          assignedStaffId: staffId,
          status: DisputeStatus.IN_MEDIATION, // Disputes waiting for final verdict
        },
      });

      if (pendingVerdicts > 0) {
        suggestedTasks.push({
          type: 'DRAFT_VERDICT',
          title: `Draft verdict (${pendingVerdicts} pending)`,
          description: 'Complete verdict documentation for disputes awaiting decision',
          estimatedMinutes: Math.min(45, gapMinutes),
          priority: 'HIGH',
        });
      }
    }

    // Priority 3: Check pending disputes (15-20 min)
    if (gapMinutes >= 15) {
      const pendingReview = await this.disputeRepository.count({
        where: {
          assignedStaffId: staffId,
          status: DisputeStatus.OPEN, // Disputes that need review
        },
      });

      if (pendingReview > 0) {
        suggestedTasks.push({
          type: 'CHECK_PENDING_DISPUTES',
          title: `Check pending disputes (${pendingReview})`,
          description: 'Review status and progress of assigned disputes',
          estimatedMinutes: 15,
          priority: 'MEDIUM',
        });
      }
    }

    // Priority 4: Documentation (any remaining time)
    if (suggestedTasks.length === 0 && gapMinutes >= 15) {
      suggestedTasks.push({
        type: 'DOCUMENTATION',
        title: 'Update documentation',
        description: 'Review and update case notes, prepare for upcoming sessions',
        estimatedMinutes: gapMinutes,
        priority: 'LOW',
      });
    }

    return {
      gapMinutes,
      canScheduleHearing: false,
      suggestedFillerTasks: suggestedTasks.slice(0, 3), // Max 3 suggestions
      reason: `Gap of ${gapMinutes} minutes - suggesting async tasks instead of hearing`,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: AUTO-ASSIGNMENT
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Auto-assign staff to dispute
   *
   * EDGE CASE ADDRESSED: "Cherry Picking"
   * - Assignment is MANDATORY
   * - Staff cannot reject (except sick leave)
   */
  async autoAssignStaffToDispute(disputeId: string): Promise<{
    staffId: string;
    complexity: ComplexityEstimation;
    success: boolean;
    fallbackReason?: string;
  }> {
    // 1. Estimate complexity
    const complexity = await this.estimateDisputeComplexity(disputeId);

    // 2. Get available staff
    const availableResult = await this.getAvailableStaff();

    if (!availableResult.recommendedStaffId) {
      this.logger.warn(`No staff available for dispute ${disputeId}`);
      return {
        staffId: '',
        complexity,
        success: false,
        fallbackReason: 'No staff available. Dispute added to manual assignment queue.',
      };
    }

    // 3. Assign to top-scored staff
    const staffId = availableResult.recommendedStaffId;

    await this.disputeRepository.update(disputeId, {
      assignedStaffId: staffId,
      assignedAt: new Date(),
    });

    // 4. Update workload
    const dateStr = new Date().toISOString().split('T')[0];
    await this.workloadRepository.upsert(
      {
        staffId,
        date: dateStr as any,
        totalDisputesPending: () => 'total_disputes_pending + 1',
      },
      ['staffId', 'date'],
    );

    // 5. Emit event
    this.eventEmitter.emit('staff.assigned', {
      disputeId,
      staffId,
      complexity: complexity.level,
      estimatedMinutes: complexity.timeEstimation.recommendedMinutes,
    });

    this.logger.log(
      `Auto-assigned dispute ${disputeId} to staff ${staffId} ` +
        `(complexity: ${complexity.level}, ~${complexity.timeEstimation.recommendedMinutes} min)`,
    );

    return {
      staffId,
      complexity,
      success: true,
    };
  }

  // ===========================================================================
  // COMPOSE FUNCTIONS: EMERGENCY RE-ASSIGNMENT
  // ===========================================================================

  /**
   * COMPOSE FUNCTION: Emergency re-assignment
   *
   * EDGE CASE ADDRESSED: "Sick Leave"
   * - Staff reports sick, events need reassignment
   * - Find replacement or reschedule
   */
  async emergencyReassign(request: ReassignmentRequest): Promise<ReassignmentResult> {
    const event = await this.calendarRepository.findOne({
      where: { id: request.eventId },
      relations: ['organizer'],
    });

    if (!event) {
      return {
        success: false,
        rescheduleRequired: false,
        notificationsSent: [],
        failureReason: 'Event not found',
      };
    }

    // 1. Find replacement staff
    const availableResult = await this.getAvailableStaff(new Date(event.startTime));
    const eligibleStaff = availableResult.staff.filter(
      (s) => s.isAvailable && s.staffId !== request.originalStaffId,
    );

    // Prefer specified replacement if available
    let newStaffId: string | undefined;
    if (request.preferredReplacementId) {
      const preferred = eligibleStaff.find((s) => s.staffId === request.preferredReplacementId);
      if (preferred) {
        newStaffId = preferred.staffId;
      }
    }

    // Otherwise take top scorer
    if (!newStaffId && eligibleStaff.length > 0) {
      newStaffId = eligibleStaff[0].staffId;
    }

    const notificationsSent: string[] = [];

    if (newStaffId) {
      // Reassign to new staff
      await this.calendarRepository.update(event.id, {
        organizerId: newStaffId,
      });

      // Update dispute if linked
      if (event.referenceType === 'Dispute' && event.referenceId) {
        await this.disputeRepository.update(event.referenceId, {
          assignedStaffId: newStaffId,
        });
      }

      // Update workloads
      const dateStr = event.startTime.toISOString().split('T')[0];
      await this.workloadRepository.decrement(
        { staffId: request.originalStaffId, date: dateStr as any },
        'totalEventsScheduled',
        1,
      );
      await this.workloadRepository.increment(
        { staffId: newStaffId, date: dateStr as any },
        'totalEventsScheduled',
        1,
      );

      // Emit event
      this.eventEmitter.emit('staff.reassigned', {
        disputeId: event.referenceId,
        oldStaffId: request.originalStaffId,
        newStaffId,
        reason: request.reason,
      });

      notificationsSent.push(`New staff ${newStaffId} notified`);
      notificationsSent.push('Participants notified of staff change');

      this.logger.log(
        `Emergency reassigned event ${event.id} from ${request.originalStaffId} to ${newStaffId}`,
      );

      return {
        success: true,
        newStaffId,
        rescheduleRequired: false,
        notificationsSent,
      };
    } else {
      // No replacement available - need to reschedule
      this.logger.warn(`No replacement staff for event ${event.id}. Reschedule required.`);

      notificationsSent.push('Participants notified: session will be rescheduled');

      return {
        success: false,
        rescheduleRequired: true,
        notificationsSent,
        failureReason: 'No replacement staff available. Event needs rescheduling.',
      };
    }
  }

  // ===========================================================================
  // SCHEDULED TASKS (Call these via external scheduler or TaskScheduler)
  // ===========================================================================

  /**
   * SCHEDULED TASK: Update daily workload at midnight
   * NOTE: Call this from an external scheduler (e.g., cron job, TaskSchedulerModule)
   */
  async updateDailyWorkloads(): Promise<void> {
    this.logger.log('Running daily workload update...');

    const allStaff = await this.userRepository.find({
      where: { role: UserRole.STAFF, isBanned: false },
    });

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    for (const staff of allStaff) {
      // Count events scheduled for today
      const events = await this.calendarRepository.find({
        where: {
          organizerId: staff.id,
          startTime: Between(new Date(dateStr + 'T00:00:00'), new Date(dateStr + 'T23:59:59')),
          status: In([EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION]),
        },
      });

      const scheduledMinutes = events.reduce((sum, e) => sum + e.durationMinutes, 0);
      const dailyCapacity = 480; // 8 hours default
      const utilizationRate = (scheduledMinutes / dailyCapacity) * 100;

      await this.workloadRepository.upsert(
        {
          staffId: staff.id,
          date: dateStr as any,
          totalEventsScheduled: events.length,
          scheduledMinutes,
          dailyCapacityMinutes: dailyCapacity,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
          isOverloaded: utilizationRate >= ASSIGNMENT_CONFIG.OVERLOADED_THRESHOLD,
          canAcceptNewEvent: utilizationRate < ASSIGNMENT_CONFIG.MAX_UTILIZATION_RATE,
        },
        ['staffId', 'date'],
      );
    }

    this.logger.log(`Updated workload for ${allStaff.length} staff members`);
  }

  /**
   * SCHEDULED TASK: Check for idle sessions every 5 minutes
   * NOTE: Call this from an external scheduler (e.g., cron job, TaskSchedulerModule)
   */
  async checkIdleSessions(): Promise<void> {
    const activeSessions = await this.calendarRepository.find({
      where: {
        status: EventStatus.IN_PROGRESS,
        type: EventType.DISPUTE_HEARING,
      },
    });

    for (const session of activeSessions) {
      // In real implementation, get last activity from message table
      // For now, use a placeholder
      const lastActivity = session.updatedAt || session.startTime;
      const idleResult = await this.checkSessionIdle(session.id, lastActivity);

      if (idleResult.shouldAutoClose) {
        this.logger.warn(`Auto-closing idle session ${session.id}`);
        // Trigger session end
        this.eventEmitter.emit('hearing.autoClose', {
          hearingId: session.id,
          reason: 'Inactivity timeout',
        });
      }
    }
  }
}
