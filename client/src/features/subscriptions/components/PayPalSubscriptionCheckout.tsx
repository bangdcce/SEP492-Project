import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  createPayPalSubscriptionOrder,
  getSubscriptionPayPalConfig,
  subscribeToPlan,
} from "../api";
import {
  BillingCycle,
  formatCurrency,
  type SubscribeResponse,
  type SubscriptionPayPalCheckoutConfig,
} from "../types";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        isEligible?: () => boolean;
        render: (selectorOrElement: HTMLElement | string) => Promise<void>;
        close?: () => void;
      };
    };
  }
}

const sdkLoads = new Map<string, Promise<void>>();

const loadPayPalSdk = (
  clientId: string,
  currency: string,
  userIdToken?: string | null,
) => {
  const key = `${clientId}:${currency}:${userIdToken ?? "guest"}`;
  if (sdkLoads.has(key)) {
    return sdkLoads.get(key)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-paypal-sdk-key="${key}"]`,
    );
    if (existing && window.paypal) {
      resolve();
      return;
    }

    const staleScripts = document.querySelectorAll<HTMLScriptElement>(
      "script[data-paypal-sdk-key]",
    );
    staleScripts.forEach((script) => {
      if (script.dataset.paypalSdkKey !== key) {
        script.remove();
      }
    });

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.async = true;
    script.dataset.paypalSdkKey = key;
    if (userIdToken) {
      script.setAttribute("data-user-id-token", userIdToken);
    }
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the PayPal SDK."));
    document.body.appendChild(script);
  });

  sdkLoads.set(key, promise);
  return promise;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const axiosLike = error as {
    response?: { data?: { message?: string } };
  };
  return axiosLike?.response?.data?.message || fallback;
};

interface PayPalSubscriptionCheckoutProps {
  planId: string;
  planDisplayName: string;
  billingCycle: BillingCycle;
  paymentMethodId: string;
  onSubscribed?: (result: SubscribeResponse) => void | Promise<void>;
  onError?: (message: string | null) => void;
}

export function PayPalSubscriptionCheckout({
  planId,
  planDisplayName,
  billingCycle,
  paymentMethodId,
  onSubscribed,
  onError,
}: PayPalSubscriptionCheckoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<SubscriptionPayPalCheckoutConfig | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasRenderedButtons, setHasRenderedButtons] = useState(false);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;

    const boot = async () => {
      try {
        setLoading(true);
        setRenderError(null);
        setHasRenderedButtons(false);
        setQuote(null);
        onError?.(null);

        const config = await getSubscriptionPayPalConfig({
          planId,
          billingCycle,
          paymentMethodId,
        });
        if (!active) {
          return;
        }
        setQuote(config);

        await loadPayPalSdk(
          config.clientId,
          config.chargeCurrency,
          config.userIdToken,
        );

        if (!active || !container || !window.paypal?.Buttons) {
          return;
        }

        container.innerHTML = "";

        const buttons = window.paypal.Buttons({
          style: {
            layout: "vertical",
            label: "paypal",
            shape: "pill",
            height: 42,
            tagline: false,
          },
          createOrder: async (data: Record<string, unknown>) => {
            const source =
              typeof data.paymentSource === "string"
                ? data.paymentSource
                : typeof data.fundingSource === "string"
                  ? data.fundingSource
                  : undefined;

            const order = await createPayPalSubscriptionOrder({
              planId,
              billingCycle,
              paymentMethodId,
              source,
              returnUrl: window.location.href,
              cancelUrl: window.location.href,
            });

            return order.orderId;
          },
          onApprove: async (data: Record<string, unknown>) => {
            const orderId = typeof data.orderID === "string" ? data.orderID : null;
            if (!orderId) {
              const message = "PayPal did not return an order id to finish checkout.";
              setRenderError(message);
              onError?.(message);
              toast.error(message);
              return;
            }

            try {
              setIsCapturing(true);
              onError?.(null);
              const result = await subscribeToPlan({
                planId,
                billingCycle,
                paymentMethodId,
                orderId,
              });
              toast.success(result.message);
              await onSubscribed?.(result);
            } catch (error: unknown) {
              const message = getErrorMessage(
                error,
                "PayPal approved the order, but the subscription could not be activated.",
              );
              setRenderError(message);
              onError?.(message);
              toast.error(message);
            } finally {
              setIsCapturing(false);
            }
          },
          onCancel: () => {
            const message = "PayPal checkout was cancelled before activation.";
            setRenderError(message);
            onError?.(message);
          },
          onError: () => {
            const message = "PayPal checkout failed. Please try again.";
            setRenderError(message);
            onError?.(message);
          },
        });

        if (buttons.isEligible && buttons.isEligible() === false) {
          throw new Error("PayPal is not eligible in this browser session.");
        }

        await buttons.render(container);
        if (active) {
          setHasRenderedButtons(true);
        }
      } catch (error: unknown) {
        const message = getErrorMessage(
          error,
          "Failed to start PayPal subscription checkout.",
        );
        if (active) {
          setRenderError(message);
          onError?.(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      active = false;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [billingCycle, onError, onSubscribed, paymentMethodId, planId]);

  return (
    <div className="space-y-3">
      {quote ? (
        <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            PayPal checkout quote
          </div>
          <p className="mt-1 text-muted-foreground">
            {planDisplayName} will capture{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(quote.chargeAmount, quote.chargeCurrency)}
            </span>{" "}
            through PayPal for this billing cycle.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading PayPal checkout...
        </div>
      ) : null}

      <div className={loading || isCapturing ? "pointer-events-none opacity-70" : ""}>
        <div
          ref={containerRef}
          className="min-h-[56px] rounded-2xl border border-border bg-white px-3 py-2"
        />
      </div>

      {!loading && !renderError && !hasRenderedButtons ? (
        <div className="rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          PayPal is still loading in this browser session. If the button does not appear, refresh once and try again.
        </div>
      ) : null}

      {isCapturing ? (
        <div className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finalizing payment capture and activating your subscription...
        </div>
      ) : null}

      {renderError ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{renderError}</span>
        </div>
      ) : null}
    </div>
  );
}

export default PayPalSubscriptionCheckout;
