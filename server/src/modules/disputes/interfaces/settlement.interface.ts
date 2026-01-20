// ============================================================================
// SETTLEMENT INTERFACES
// ============================================================================
// Shared types for settlement system
// ============================================================================

/**
 * Fee breakdown for settlement money distribution
 */
export interface FeeBreakdown {
  amountToFreelancer: number;
  amountToClient: number;
  freelancerFee: number;
  clientFee: number;
  totalPlatformFee: number;
  freelancerNetAmount: number;
  clientNetAmount: number;
}

/**
 * Result of money validation
 */
export interface MoneyValidationResult {
  valid: boolean;
  error?: string;
  breakdown?: FeeBreakdown;
}

/**
 * Settlement eligibility check result
 */
export interface SettlementEligibilityResult {
  eligible: boolean;
  reason?: string;
  remainingAttempts?: number;
  pendingSettlement?: unknown; // DisputeSettlementEntity
}

// =============================================================================
// EDGE CASE TYPES
// =============================================================================

/**
 * Non-compliance record for tracking "silent treatment" violations
 * Used to flag users who repeatedly ignore settlement offers
 */
export interface NonComplianceRecord {
  disputeId: string;
  userId: string;
  settlementId: string;
  type: 'IGNORED_OFFER' | 'NO_REASON_REJECT';
  timestamp: Date;
  description: string;
}

/**
 * Chat lock status for a user in a dispute
 * When a pending settlement exists, the responder cannot chat until they respond
 *
 * Edge Case: "Im lặng là vàng" (Silent Treatment)
 */
export interface ChatLockStatus {
  isLocked: boolean;
  lockedUntil?: Date;
  pendingSettlementId?: string;
  reason?: string;
}

/**
 * Staff suggestion (not a formal offer, just guidance)
 *
 * Edge Case: "Staff vô hình" (Invisible Staff)
 * - Staff can provide suggestions without creating formal settlement offers
 * - Not counted towards party's settlement attempts
 * - Both parties notified but not required to act
 */
export interface StaffSuggestion {
  id: string;
  disputeId: string;
  staffId: string;
  suggestedAmountToFreelancer: number;
  suggestedAmountToClient: number;
  reasoning: string;
  similarCaseReferences?: string;
  createdAt: Date;
}

/**
 * Non-compliance summary for verdict decisions
 */
export interface NonComplianceSummary {
  raiserIgnoredOffers: number;
  defendantIgnoredOffers: number;
  raiserIsNonCooperative: boolean;
  defendantIsNonCooperative: boolean;
  recommendation: string | null;
}
