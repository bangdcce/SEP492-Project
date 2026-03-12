/**
 * UpgradeModal — Reusable upgrade prompt for quota-exceeded errors.
 *
 * This modal is designed to be shown anywhere in the app when a user
 * hits a free-tier quota limit (429 error) or tries to access a
 * premium-only feature (403 error).
 *
 * Usage:
 * ```tsx
 * import { UpgradeModal } from '@/features/subscriptions/components/UpgradeModal';
 *
 * // In your component:
 * const [showUpgrade, setShowUpgrade] = useState(false);
 * const [quotaInfo, setQuotaInfo] = useState(null);
 *
 * // When catching a 429 error:
 * const quotaError = parseQuotaError(error);
 * if (quotaError) {
 *   setQuotaInfo(quotaError);
 *   setShowUpgrade(true);
 * }
 *
 * // In JSX:
 * <UpgradeModal
 *   isOpen={showUpgrade}
 *   onClose={() => setShowUpgrade(false)}
 *   quotaInfo={quotaInfo}
 * />
 * ```
 */

import { useNavigate } from 'react-router-dom';
import { formatVND, QUOTA_ACTION_LABELS } from '../types';

export interface UpgradeModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Quota error details (from parseQuotaError) */
  quotaInfo?: {
    action: string;
    limit: number;
    current: number;
    message: string;
  } | null;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Whether this is a premium-only feature (vs quota limit) */
  isPremiumOnly?: boolean;
}

/**
 * Modal component that prompts users to upgrade to Premium.
 *
 * Two modes:
 * 1. Quota exceeded (429) — Shows usage/limit info with upgrade CTA
 * 2. Premium only (403) — Shows feature lock message with upgrade CTA
 */
export function UpgradeModal({
  isOpen,
  onClose,
  quotaInfo,
  title,
  description,
  isPremiumOnly = false,
}: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();

    // Navigate to the correct subscription page based on user role
    // The route is determined by the sidebar config
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const rolePrefix = user.role?.toLowerCase() || 'client';
        navigate(`/${rolePrefix}/subscription`);
      } catch {
        navigate('/client/subscription');
      }
    } else {
      navigate('/client/subscription');
    }
  };

  const actionLabel = quotaInfo?.action
    ? QUOTA_ACTION_LABELS[quotaInfo.action] || quotaInfo.action
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="upgrade-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {/* Icon */}
        <div className="upgrade-icon">
          {isPremiumOnly ? '🔒' : '⚡'}
        </div>

        {/* Title */}
        <h2 className="upgrade-title">
          {title ||
            (isPremiumOnly
              ? 'Premium Feature'
              : 'Free Plan Limit Reached')}
        </h2>

        {/* Description */}
        <p className="upgrade-description">
          {description ||
            (isPremiumOnly
              ? 'This feature is available exclusively for Premium subscribers.'
              : quotaInfo?.message || 'You\'ve reached your free plan limit.')}
        </p>

        {/* Quota info (for 429 errors) */}
        {quotaInfo && !isPremiumOnly && (
          <div className="quota-info-box">
            <div className="quota-info-row">
              <span className="quota-info-label">{actionLabel}</span>
              <span className="quota-info-value">
                {quotaInfo.current} / {quotaInfo.limit} used
              </span>
            </div>
            <div className="quota-progress-bar">
              <div
                className="quota-progress-fill"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}

        {/* Premium benefits preview */}
        <div className="premium-benefits">
          <h3>✨ Premium Benefits</h3>
          <ul>
            <li>♾️ Unlimited access to all features</li>
            <li>🎯 AI matching with more candidates</li>
            <li>⭐ Featured profile in search results</li>
            <li>📊 Advanced insights and analytics</li>
          </ul>
          <div className="premium-price-tag">
            Starting at {formatVND(99000)}/month
          </div>
        </div>

        {/* Action buttons */}
        <div className="upgrade-actions">
          <button
            className="btn-upgrade-now"
            onClick={handleUpgrade}
          >
            Upgrade Now
          </button>
          <button
            className="btn-maybe-later"
            onClick={onClose}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
