import { useState, useEffect, useCallback } from 'react';
import {
  getMySubscription,
  getSubscriptionPlans,
  subscribeToPlan,
  cancelSubscription,
} from './api';
import {
  BillingCycle,
  formatVND,
  formatPerkValue,
  getBillingCycleLabel,
  getMonthlyEquivalent,
  PERK_LABELS,
  QUOTA_ACTION_LABELS,
} from './types';
import type {
  MySubscriptionResponse,
  SubscriptionPlan,
  QuotaUsage,
} from './types';

/**
 * SubscriptionPage — View and manage current subscription (UC-39).
 *
 * Shows:
 * - Current plan status (Free or Premium)
 * - Plan details and billing info (if premium)
 * - Current perks and their values
 * - Quota usage summary
 * - Upgrade / Cancel actions
 */
export function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<MySubscriptionResponse | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch subscription data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [subData, plansData] = await Promise.all([
        getMySubscription(),
        getSubscriptionPlans(),
      ]);
      setSubscription(subData);
      setPlans(plansData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load subscription data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle subscribe
  const handleSubscribe = async (planId: string) => {
    try {
      setSubscribing(true);
      setError(null);
      const response = await subscribeToPlan({
        planId,
        billingCycle: selectedCycle,
      });
      setSuccessMessage(response.message);
      await fetchData(); // Refresh data
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);
      const response = await cancelSubscription({
        reason: cancelReason || undefined,
      });
      setSuccessMessage(response.message);
      setShowCancelModal(false);
      setCancelReason('');
      await fetchData(); // Refresh data
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="subscription-page">
        <div className="subscription-loading">
          <div className="loading-spinner" />
          <p>Loading subscription information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !subscription) {
    return (
      <div className="subscription-page">
        <div className="subscription-error">
          <h2>⚠️ Unable to load subscription</h2>
          <p>{error}</p>
          <button onClick={fetchData} className="btn-retry">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isPremium = subscription?.isPremium || false;
  const currentSub = subscription?.subscription;
  const perks = subscription?.perks || {};
  const usage = subscription?.usage || {};

  return (
    <div className="subscription-page">
      {/* Success Banner */}
      {successMessage && (
        <div className="subscription-success-banner">
          <span>✅ {successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>✕</button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="subscription-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="subscription-header">
        <h1>Subscription</h1>
        <p className="subscription-subtitle">
          Manage your plan and view your usage limits
        </p>
      </div>

      {/* Current Plan Card */}
      <div className={`current-plan-card ${isPremium ? 'premium' : 'free'}`}>
        <div className="plan-badge">
          {isPremium ? '⭐ Premium' : '🆓 Free Plan'}
        </div>
        <div className="plan-details">
          {isPremium && currentSub ? (
            <>
              <h2>{currentSub.plan?.displayName || 'Premium'}</h2>
              <div className="plan-meta">
                <span className="billing-cycle">
                  📅 {getBillingCycleLabel(currentSub.billingCycle)}
                </span>
                <span className="amount-paid">
                  💰 {formatVND(currentSub.amountPaid)}
                </span>
                <span className="period">
                  📆 Until{' '}
                  {new Date(currentSub.currentPeriodEnd).toLocaleDateString('vi-VN')}
                </span>
              </div>
              {currentSub.cancelAtPeriodEnd && (
                <div className="cancel-notice">
                  ⚠️ Your subscription will not renew at the end of this period.
                  Premium perks remain active until{' '}
                  {new Date(currentSub.currentPeriodEnd).toLocaleDateString('vi-VN')}.
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Free Plan</h2>
              <p>You are on the free plan with limited features. Upgrade to Premium for unlimited access.</p>
            </>
          )}
        </div>
        <div className="plan-actions">
          {isPremium && !currentSub?.cancelAtPeriodEnd ? (
            <button
              className="btn-cancel"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Subscription
            </button>
          ) : !isPremium ? (
            <a href="#plans" className="btn-upgrade">
              ⬆️ Upgrade to Premium
            </a>
          ) : null}
        </div>
      </div>

      {/* Perks Section */}
      <div className="subscription-section">
        <h2>Your Current Perks</h2>
        <div className="perks-grid">
          {Object.entries(perks).map(([key, value]) => (
            <div key={key} className="perk-item">
              <span className="perk-label">{PERK_LABELS[key] || key}</span>
              <span className={`perk-value ${value === -1 || value === true ? 'premium-value' : ''}`}>
                {formatPerkValue(key, value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Section */}
      {Object.keys(usage).length > 0 && (
        <div className="subscription-section">
          <h2>Quota Usage</h2>
          <div className="usage-grid">
            {Object.entries(usage).map(([action, data]: [string, QuotaUsage]) => {
              const limitStr = typeof data.limit === 'string' ? data.limit : String(data.limit);
              const isUnlimited = limitStr === 'Unlimited' || data.limit === -1;
              const progressPercent = isUnlimited
                ? 0
                : Math.min(100, (data.used / (data.limit as number)) * 100);
              const isNearLimit = !isUnlimited && progressPercent >= 80;
              const isAtLimit = !isUnlimited && progressPercent >= 100;

              return (
                <div key={action} className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">
                      {QUOTA_ACTION_LABELS[action] || action}
                    </span>
                    <span className={`usage-count ${isAtLimit ? 'at-limit' : isNearLimit ? 'near-limit' : ''}`}>
                      {data.used} / {isUnlimited ? '∞' : data.limit}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="usage-bar">
                      <div
                        className={`usage-bar-fill ${isAtLimit ? 'full' : isNearLimit ? 'warning' : ''}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plans Section (shown when not premium) */}
      {!isPremium && plans.length > 0 && (
        <div id="plans" className="subscription-section">
          <h2>Available Plans</h2>

          {/* Billing Cycle Selector */}
          <div className="billing-cycle-selector">
            {Object.values(BillingCycle).map((cycle) => (
              <button
                key={cycle}
                className={`cycle-btn ${selectedCycle === cycle ? 'active' : ''}`}
                onClick={() => setSelectedCycle(cycle)}
              >
                {getBillingCycleLabel(cycle)}
                {cycle === BillingCycle.QUARTERLY && (
                  <span className="discount-badge">-15%</span>
                )}
                {cycle === BillingCycle.YEARLY && (
                  <span className="discount-badge">-30%</span>
                )}
              </button>
            ))}
          </div>

          {/* Plan Cards */}
          <div className="plans-grid">
            {plans.map((plan) => {
              const monthlyEquiv = getMonthlyEquivalent(plan, selectedCycle);
              let totalPrice: number;
              switch (selectedCycle) {
                case BillingCycle.QUARTERLY:
                  totalPrice = plan.priceQuarterly;
                  break;
                case BillingCycle.YEARLY:
                  totalPrice = plan.priceYearly;
                  break;
                default:
                  totalPrice = plan.priceMonthly;
              }

              return (
                <div key={plan.id} className="plan-card">
                  <div className="plan-card-header">
                    <h3>{plan.displayName}</h3>
                    <div className="plan-price">
                      <span className="price-amount">
                        {formatVND(monthlyEquiv)}
                      </span>
                      <span className="price-period">/month</span>
                    </div>
                    {selectedCycle !== BillingCycle.MONTHLY && (
                      <div className="price-total">
                        Billed {formatVND(totalPrice)}{' '}
                        {getBillingCycleLabel(selectedCycle).toLowerCase()}
                      </div>
                    )}
                  </div>

                  <p className="plan-description">{plan.description}</p>

                  <div className="plan-perks-list">
                    {Object.entries(plan.perks).map(([key, value]) => (
                      <div key={key} className="plan-perk">
                        <span className="perk-icon">
                          {typeof value === 'boolean'
                            ? value
                              ? '✅'
                              : '❌'
                            : value === -1
                              ? '♾️'
                              : '📊'}
                        </span>
                        <span>
                          {PERK_LABELS[key] || key}:{' '}
                          <strong>{formatPerkValue(key, value)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn-subscribe"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={subscribing}
                  >
                    {subscribing ? 'Processing...' : `Subscribe — ${formatVND(totalPrice)}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel Subscription</h2>
            <p>
              Are you sure you want to cancel your premium subscription?
            </p>
            <p className="cancel-info">
              Your premium perks will remain active until the end of your current
              billing period (
              {currentSub
                ? new Date(currentSub.currentPeriodEnd).toLocaleDateString('vi-VN')
                : ''}
              ). After that, you'll be switched to the free plan.
            </p>

            <div className="cancel-reason-field">
              <label htmlFor="cancel-reason">
                Reason for cancelling (optional):
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Tell us why you're leaving..."
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel-confirm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
              </button>
              <button
                className="btn-keep"
                onClick={() => setShowCancelModal(false)}
              >
                Keep Premium
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionPage;
