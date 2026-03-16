/**
 * Subscription feature barrel export.
 */

// Pages
export { SubscriptionPage } from './SubscriptionPage';

// Components
export { UpgradeModal } from './components/UpgradeModal';
export type { UpgradeModalProps } from './components/UpgradeModal';

// API
export {
  getSubscriptionPlans,
  getMySubscription,
  subscribeToPlan,
  cancelSubscription,
  parseQuotaError,
  isPremiumRequiredError,
} from './api';

// Types
export type {
  SubscriptionPlan,
  UserSubscription,
  MySubscriptionResponse,
  SubscribeRequest,
  CancelSubscriptionRequest,
  QuotaUsage,
  PlanPerks,
} from './types';

export {
  BillingCycle,
  SubscriptionStatus,
  QuotaAction,
  QUOTA_ACTION_LABELS,
  PERK_LABELS,
  formatVND,
  formatPerkValue,
  getBillingCycleLabel,
  getMonthlyEquivalent,
  calculateSavings,
} from './types';
