/**
 * Subscription feature barrel export.
 */

// Pages
export { SubscriptionPage } from './SubscriptionPage';

// Components
export { UpgradeModal } from './components/UpgradeModal';
export type { UpgradeModalProps } from './components/UpgradeModal';
export { PayPalSubscriptionCheckout } from './components/PayPalSubscriptionCheckout';

// API
export {
  getSubscriptionPlans,
  getMySubscription,
  getSubscriptionPayPalConfig,
  createPayPalSubscriptionOrder,
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
  SubscriptionPayPalConfigRequest,
  SubscriptionPayPalCheckoutConfig,
  CreatePayPalSubscriptionOrderRequest,
  PayPalSubscriptionOrder,
  SubscribeRequest,
  CancelSubscriptionRequest,
  QuotaUsage,
  PlanPerks,
  SubscriptionPayment,
} from './types';

export {
  BillingCycle,
  SubscriptionStatus,
  QuotaAction,
  QUOTA_ACTION_LABELS,
  PERK_LABELS,
  formatVND,
  formatCurrency,
  formatPerkValue,
  getBillingCycleLabel,
  getMonthlyEquivalent,
  calculateSavings,
} from './types';
