// ============================================================================
// STAFF ASSIGNMENT INTERFACES
// ============================================================================
// Types for Staff Scheduling, Workload Management, and Auto-Assignment
// ============================================================================

import { EventType } from '../../../database/entities/calendar-event.entity';

// =============================================================================
// COMPLEXITY ESTIMATION
// =============================================================================

/**
 * Complexity level for disputes
 */
export type ComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Time range estimation for dispute handling
 * Addresses "Dead Time" edge case by providing flexible ranges
 */
export interface TimeEstimation {
  /** Minimum time needed (quick resolution scenario) */
  minMinutes: number;
  /** Recommended time (standard scenario) */
  recommendedMinutes: number;
  /** Maximum time (complex scenario with extensions) */
  maxMinutes: number;
}

/**
 * Result of dispute complexity estimation
 */
export interface ComplexityEstimation {
  level: ComplexityLevel;
  timeEstimation: TimeEstimation;
  factors: ComplexityFactor[];
  confidence: number; // 0-100, how confident the estimation is
}

/**
 * Individual factor contributing to complexity score
 */
export interface ComplexityFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number; // weight * value
  description: string;
}

// =============================================================================
// STAFF SCORING
// =============================================================================

/**
 * Detailed staff score breakdown for transparency
 */
export interface StaffScoreBreakdown {
  staffId: string;
  totalScore: number; // 0-100

  // Individual factors
  workloadScore: number; // 40% weight
  performanceScore: number; // 40% weight
  fairnessScore: number; // 20% weight

  // Raw metrics
  utilizationRate: number;
  avgUserRating: number;
  overturnRate: number;
  monthlyDisputeCount: number;

  // Flags
  isAvailable: boolean;
  isOnLeave: boolean;
  canAcceptNewEvent: boolean;

  // Reason if not available
  unavailableReason?: string;
}

/**
 * Available staff with scoring for assignment
 */
export interface AvailableStaffResult {
  staff: StaffScoreBreakdown[];
  totalAvailable: number;
  totalStaff: number;
  shortageWarning: boolean;
  recommendedStaffId: string | null;
}

// =============================================================================
// SCHEDULING
// =============================================================================

/**
 * Time slot for scheduling
 */
export interface TimeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
  score: number; // Higher = better slot
  scoreReasons: string[];
}

/**
 * Scheduling constraints from AutoScheduleRule
 */
export interface SchedulingConstraints {
  workingHoursStart: string; // "08:00"
  workingHoursEnd: string; // "18:00"
  workingDays: number[]; // [1,2,3,4,5] = Mon-Fri
  bufferMinutes: number; // Gap between events
  lunchStart: string; // "11:30"
  lunchEnd: string; // "13:00"
  avoidLunchHours: boolean;
  maxEventsPerStaffPerDay: number;
}

/**
 * Result of finding available slots
 */
export interface AvailableSlotsResult {
  slots: TimeSlot[];
  searchedDateRange: { start: Date; end: Date };
  constraints: SchedulingConstraints;
  noSlotsReason?: string;
}

// =============================================================================
// BUFFER ZONE & OVERTIME HANDLING
// =============================================================================

/**
 * Buffer configuration between events
 * Addresses "Back-to-back scheduling" edge case
 */
export interface BufferConfig {
  /** Standard buffer between events (default 15 min) */
  standardBufferMinutes: number;
  /** Extended buffer for high-complexity cases */
  extendedBufferMinutes: number;
  /** Minimum rest time for staff */
  minRestMinutes: number;
}

/**
 * Session timing status
 */
export type SessionTimingStatus =
  | 'ON_TIME' // Within scheduled time
  | 'WARNING' // 10 minutes left
  | 'OVERTIME' // Past scheduled end, within buffer
  | 'CRITICAL_OVERRUN' // Past buffer, affecting next session
  | 'IDLE'; // No activity detected

/**
 * Session timing check result
 */
export interface SessionTimingResult {
  status: SessionTimingStatus;
  scheduledEndTime: Date;
  actualEndTime?: Date;
  bufferEndTime: Date;
  remainingMinutes: number;
  overtimeMinutes: number;
  nextEventAffected: boolean;
  nextEventId?: string;
  nextEventDelayMinutes?: number;
  suggestedAction: 'CONTINUE' | 'WRAP_UP' | 'ADJOURN' | 'NOTIFY_NEXT';
  warningMessage?: string;
}

// =============================================================================
// IDLE CHECK & AUTO-CLOSE
// =============================================================================

/**
 * Idle check configuration
 * Addresses "Zombie Session" edge case
 */
export interface IdleCheckConfig {
  /** Minutes of inactivity before warning */
  warningThresholdMinutes: number;
  /** Minutes after warning before auto-close */
  autoCloseDelayMinutes: number;
  /** Whether auto-close is enabled */
  autoCloseEnabled: boolean;
}

/**
 * Idle check result
 */
export interface IdleCheckResult {
  isIdle: boolean;
  lastActivityAt: Date;
  idleMinutes: number;
  shouldWarn: boolean;
  shouldAutoClose: boolean;
  warningMessage?: string;
}

// =============================================================================
// FILLER TASKS (For Fragmented Time)
// =============================================================================

/**
 * Task types that can fill short gaps
 */
export type FillerTaskType =
  | 'REVIEW_EVIDENCE'
  | 'DRAFT_VERDICT'
  | 'APPROVE_KYC'
  | 'REVIEW_SETTLEMENT'
  | 'CHECK_PENDING_DISPUTES'
  | 'DOCUMENTATION';

/**
 * Filler task suggestion
 */
export interface FillerTask {
  type: FillerTaskType;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  relatedEntityType?: string;
  relatedEntityId?: string;
  deadline?: Date;
}

/**
 * Fragmented time analysis result
 */
export interface FragmentedTimeResult {
  gapMinutes: number;
  canScheduleHearing: boolean;
  suggestedFillerTasks: FillerTask[];
  reason: string;
}

// =============================================================================
// EARLY RELEASE
// =============================================================================

/**
 * Result of early release (ending session before scheduled time)
 */
export interface EarlyReleaseResult {
  releasedMinutes: number;
  newAvailableSlot: TimeSlot | null;
  workloadUpdated: boolean;
  canAcceptNewEvent: boolean;
  nextPendingDisputes: number;
}

// =============================================================================
// RE-ASSIGNMENT
// =============================================================================

/**
 * Emergency re-assignment request
 */
export interface ReassignmentRequest {
  eventId: string;
  originalStaffId: string;
  reason: 'SICK_LEAVE' | 'EMERGENCY' | 'OVERLOAD' | 'CONFLICT' | 'MANUAL';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  preferredReplacementId?: string;
  notes?: string;
}

/**
 * Re-assignment result
 */
export interface ReassignmentResult {
  success: boolean;
  newStaffId?: string;
  rescheduleRequired: boolean;
  newTimeSlot?: TimeSlot;
  notificationsSent: string[];
  failureReason?: string;
}

// =============================================================================
// STAFF PERFORMANCE (For Scoring)
// =============================================================================

/**
 * Staff performance metrics for scoring
 */
export interface StaffPerformanceMetrics {
  staffId: string;
  periodStart: Date;
  periodEnd: Date;

  // Volume
  totalDisputesAssigned: number;
  totalDisputesResolved: number;
  totalHearingsConducted: number;

  // Quality
  avgUserRating: number; // 1-5
  totalAppeals: number;
  totalOverturned: number;
  overturnRate: number; // 0-100%

  // Efficiency
  avgResolutionTimeHours: number;
  onTimeCompletionRate: number; // % completed within deadline

  // Workload
  avgDailyUtilization: number;
  peakUtilization: number;
}

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Events emitted by staff assignment service
 */
export interface StaffAssignmentEvents {
  'staff.assigned': {
    disputeId: string;
    staffId: string;
    complexity: ComplexityLevel;
    estimatedMinutes: number;
  };
  'staff.reassigned': {
    disputeId: string;
    oldStaffId: string;
    newStaffId: string;
    reason: string;
  };
  'staff.overloaded': {
    staffId: string;
    utilizationRate: number;
    pendingDisputes: number;
  };
  'staff.shortage': {
    availableCount: number;
    requiredCount: number;
    affectedDisputes: string[];
  };
  'session.idle': {
    hearingId: string;
    staffId: string;
    idleMinutes: number;
    action: 'WARNING' | 'AUTO_CLOSE';
  };
  'session.overtime': {
    hearingId: string;
    overtimeMinutes: number;
    nextEventAffected: boolean;
    action: 'NOTIFY' | 'ADJOURN';
  };
  'session.earlyRelease': {
    hearingId: string;
    staffId: string;
    releasedMinutes: number;
  };
}
