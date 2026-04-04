/**
 * Subscription feature type definitions.
 *
 * These types mirror the server-side DTOs and entities
 * for type-safe API communication.
 */

// ========================================
// Enums (mirrored from server)
// ========================================

/**
 * Billing cycle options for subscriptions.
 */
export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

/**
 * Subscription lifecycle status.
 */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Quota action types (for display purposes).
 */
export enum QuotaAction {
  CREATE_REQUEST = 'CREATE_REQUEST',
  CONVERT_TO_PROJECT = 'CONVERT_TO_PROJECT',
  AI_MATCH_SEARCH = 'AI_MATCH_SEARCH',
  INVITE_BROKER = 'INVITE_BROKER',
  APPLY_TO_REQUEST = 'APPLY_TO_REQUEST',
  CREATE_PROPOSAL = 'CREATE_PROPOSAL',
  APPLY_TO_PROJECT = 'APPLY_TO_PROJECT',
  ADD_PORTFOLIO = 'ADD_PORTFOLIO',
}

// ========================================
// API Response Types
// ========================================

/**
 * Subscription plan as returned by the API.
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  role: string;
  priceMonthly: number;
  priceQuarterly: number;
  priceYearly: number;
  perks: PlanPerks;
}

/**
 * Role-specific perks.
 * Keys depend on the user's role.
 */
export interface PlanPerks {
  // Client perks
  maxActiveRequests?: number;
  maxActiveProjects?: number;
  aiMatchesPerDay?: number;
  aiCandidatesShown?: number;
  invitesPerRequest?: number;

  // Broker perks
  appliesPerWeek?: number;
  maxActiveProposals?: number;
  commissionRate?: number;
  viewClientBudget?: boolean;

  // Freelancer perks
  portfolioSlots?: number;
  cvHighlighted?: boolean;

  // Shared perks
  featuredProfile?: boolean;

  // Allow additional dynamic perks
  [key: string]: number | boolean | undefined;
}

/**
 * User subscription details.
 */
export interface UserSubscription {
  id: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  amountPaid: number;
  payment?: SubscriptionPayment | null;
  plan: SubscriptionPlan;
}

export interface SubscriptionPayment {
  provider: string;
  reference?: string | null;
  capturedAmount?: number | null;
  currency?: string | null;
  displayAmountVnd: number;
  exchangeRateApplied?: number | null;
}

/**
 * Quota usage for a single action.
 */
export interface QuotaUsage {
  used: number;
  limit: number | string; // 'Unlimited' for premium
}

/**
 * Full subscription status response from GET /subscriptions/me.
 */
export interface MySubscriptionResponse {
  isPremium: boolean;
  subscription: UserSubscription | null;
  perks: PlanPerks;
  usage: Record<string, QuotaUsage>;
}

export interface SubscriptionPayPalConfigRequest {
  planId: string;
  billingCycle: BillingCycle;
  paymentMethodId: string;
}

export interface SubscriptionPayPalCheckoutConfig {
  clientId: string;
  environment: "sandbox" | "live";
  vaultEnabled: boolean;
  userIdToken: string | null;
  chargeAmount: number;
  chargeCurrency: string;
  displayAmountVnd: number;
  exchangeRateApplied: number;
}

export interface CreatePayPalSubscriptionOrderRequest
  extends SubscriptionPayPalConfigRequest {
  source?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PayPalSubscriptionOrder extends SubscriptionPayPalCheckoutConfig {
  orderId: string;
  status: string;
  vaultRequested: boolean;
}

/**
 * Subscribe request body for POST /subscriptions/subscribe.
 */
export interface SubscribeRequest {
  planId: string;
  billingCycle: BillingCycle;
  paymentMethodId: string;
  orderId: string;
}

/**
 * Cancel request body for POST /subscriptions/cancel.
 */
export interface CancelSubscriptionRequest {
  reason?: string;
}

/**
 * Subscribe response from POST /subscriptions/subscribe.
 */
export interface SubscribeResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    amountPaid: number;
    payment?: {
      provider: string;
      reference?: string | null;
      capturedAmount?: number | null;
      currency?: string | null;
    } | null;
  };
}

/**
 * Cancel response from POST /subscriptions/cancel.
 */
export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
    cancelledAt: string;
  };
}

// ========================================
// Display Helpers
// ========================================

/**
 * Human-readable labels for quota actions.
 */
export const QUOTA_ACTION_LABELS: Record<string, string> = {
  [QuotaAction.CREATE_REQUEST]: 'Project Requests',
  [QuotaAction.CONVERT_TO_PROJECT]: 'Active Projects',
  [QuotaAction.AI_MATCH_SEARCH]: 'AI Match Searches (Daily)',
  [QuotaAction.INVITE_BROKER]: 'Partner Invitations',
  [QuotaAction.APPLY_TO_REQUEST]: 'Applications (Weekly)',
  [QuotaAction.CREATE_PROPOSAL]: 'Active Proposals',
  [QuotaAction.APPLY_TO_PROJECT]: 'Project Applications (Weekly)',
  [QuotaAction.ADD_PORTFOLIO]: 'Portfolio Slots',
};

/**
 * Human-readable labels for perk keys.
 */
export const PERK_LABELS: Record<string, string> = {
  maxActiveRequests: 'Active Requests',
  maxActiveProjects: 'Active Projects',
  aiMatchesPerDay: 'AI Matches / Day',
  aiCandidatesShown: 'AI Candidates Shown',
  invitesPerRequest: 'Invites / Request',
  appliesPerWeek: 'Applications / Week',
  maxActiveProposals: 'Active Proposals',
  commissionRate: 'Commission Rate',
  viewClientBudget: 'View Client Budget',
  portfolioSlots: 'Portfolio Slots',
  cvHighlighted: 'CV Highlighted',
  featuredProfile: 'Featured Profile',
};

/**
 * Format a perk value for display.
 * -1 means unlimited, booleans become Yes/No, percentages get % suffix.
 */
export function formatPerkValue(key: string, value: number | boolean | undefined): string {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✅ Yes' : '❌ No';
  if (value === -1) return '♾️ Unlimited';
  if (key === 'commissionRate') return `${value}%`;
  return String(value);
}

/**
 * Format VND currency.
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(amount);
}

/**
 * Calculate savings percentage between two prices.
 */
export function calculateSavings(fullPrice: number, discountedPrice: number): number {
  if (fullPrice === 0) return 0;
  return Math.round(((fullPrice - discountedPrice) / fullPrice) * 100);
}

/**
 * Get the billing cycle label.
 */
export function getBillingCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case BillingCycle.MONTHLY:
      return 'Monthly';
    case BillingCycle.QUARTERLY:
      return 'Quarterly';
    case BillingCycle.YEARLY:
      return 'Yearly';
    default:
      return cycle;
  }
}

/**
 * Get the equivalent monthly price for a billing cycle.
 */
export function getMonthlyEquivalent(
  plan: SubscriptionPlan,
  cycle: BillingCycle,
): number {
  switch (cycle) {
    case BillingCycle.MONTHLY:
      return plan.priceMonthly;
    case BillingCycle.QUARTERLY:
      return Math.round(plan.priceQuarterly / 3);
    case BillingCycle.YEARLY:
      return Math.round(plan.priceYearly / 12);
    default:
      return plan.priceMonthly;
  }
}
