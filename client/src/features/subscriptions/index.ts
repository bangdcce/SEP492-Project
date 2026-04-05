/**
 * Subscription feature barrel export.
 */

// Pages
export { SubscriptionPage } from './SubscriptionPage';
export { SubscriptionCheckoutPage } from './SubscriptionCheckoutPage';

// Components
export { UpgradeModal } from './components/UpgradeModal';
export type { UpgradeModalProps } from './components/UpgradeModal';
export { PayPalSubscriptionCheckout } from './components/PayPalSubscriptionCheckout';
export { SubscriptionPayPalSetupDialog } from './components/SubscriptionPayPalSetupDialog';

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
  formatCurrency,
  formatPerkValue,
  getBillingCycleLabel,
  getPlanDisplayAmount,
  getMonthlyEquivalent,
  calculateSavings,
} from './types';

export {
  normalizeSupportedSubscriptionRole,
  resolveSubscriptionCheckoutRoute,
  resolveSubscriptionRoute,
} from './subscriptionRoutes';
