import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createStripeMilestoneCheckoutSession,
  getStripeCheckoutConfig,
} from "@/features/payments/api";
import { Button } from "@/shared/components/ui/button";

interface StripeMilestoneCheckoutProps {
  milestoneId: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
  onError?: (message: string | null) => void;
  onFallbackFund?: () => Promise<void> | void;
}

export function StripeMilestoneCheckout({
  milestoneId,
  paymentMethodId,
  amount,
  currency,
  onError,
  onFallbackFund,
}: StripeMilestoneCheckoutProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isFallbackFunding, setIsFallbackFunding] = useState(false);

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        setLoadingConfig(true);
        setLocalError(null);
        onError?.(null);
        const config = await getStripeCheckoutConfig();
        if (!active) return;
        setIsEnabled(config.enabled);
      } catch (error: unknown) {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Failed to load Stripe checkout.";
        setLocalError(message);
        onError?.(message);
      } finally {
        if (active) {
          setLoadingConfig(false);
        }
      }
    };

    void loadConfig();

    return () => {
      active = false;
    };
  }, [onError]);

  const handleStripeCheckout = async () => {
    try {
      setIsRedirecting(true);
      setLocalError(null);
      onError?.(null);
      const session = await createStripeMilestoneCheckoutSession(milestoneId, {
        paymentMethodId,
        returnUrl: window.location.href,
      });
      window.location.assign(session.checkoutUrl);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to start Stripe Checkout.";
      setLocalError(message);
      onError?.(message);
      toast.error(message);
      setIsRedirecting(false);
    }
  };

  const handleFallbackFund = async () => {
    if (!onFallbackFund) {
      return;
    }

    try {
      setIsFallbackFunding(true);
      setLocalError(null);
      onError?.(null);
      await onFallbackFund();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fund milestone in the app sandbox.";
      setLocalError(message);
      onError?.(message);
    } finally {
      setIsFallbackFunding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
        Pay this exact amount on Stripe Checkout. Card details stay on Stripe, then the app syncs
        the escrow after you return.
      </div>

      {loadingConfig ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Stripe test mode...
        </div>
      ) : null}

      {!loadingConfig && isEnabled ? (
        <Button
          onClick={handleStripeCheckout}
          disabled={isRedirecting}
          className="w-full rounded-full bg-white text-slate-950 hover:bg-slate-100"
        >
          {isRedirecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {isRedirecting
            ? "Opening Stripe Checkout..."
            : `Pay ${currency} ${amount.toFixed(2)} with card`}
        </Button>
      ) : null}

      {!loadingConfig && !isEnabled ? (
        <div className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Stripe test mode is not configured on this environment yet. You can still use the
              in-app sandbox card flow for local testing.
            </span>
          </div>
          {onFallbackFund ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleFallbackFund}
              disabled={isFallbackFunding}
              className="w-full rounded-full bg-white text-slate-950 hover:bg-slate-100"
            >
              {isFallbackFunding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Use in-app sandbox card
            </Button>
          ) : null}
        </div>
      ) : null}

      {localError ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {localError}
        </div>
      ) : null}
    </div>
  );
}
