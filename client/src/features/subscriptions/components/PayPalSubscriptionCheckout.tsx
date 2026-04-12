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
  const onSubscribedRef = useRef(onSubscribed);
  const onErrorRef = useRef(onError);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<SubscriptionPayPalCheckoutConfig | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasRenderedButtons, setHasRenderedButtons] = useState(false);

  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
  }, [onSubscribed]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;

    const boot = async () => {
      try {
        setLoading(true);
        setRenderError(null);
        setHasRenderedButtons(false);
        setQuote(null);
        onErrorRef.current?.(null);

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
              onErrorRef.current?.(message);
              toast.error(message);
              return;
            }

            try {
              setIsCapturing(true);
              onErrorRef.current?.(null);
              const result = await subscribeToPlan({
                planId,
                billingCycle,
                paymentMethodId,
                orderId,
              });
              toast.success(result.message);
              await onSubscribedRef.current?.(result);
            } catch (error: unknown) {
              const message = getErrorMessage(
                error,
                "PayPal approved the order, but the subscription could not be activated.",
              );
              setRenderError(message);
              onErrorRef.current?.(message);
              toast.error(message);
            } finally {
              setIsCapturing(false);
            }
          },
          onCancel: () => {
            const message = "PayPal checkout was cancelled before activation.";
            setRenderError(message);
            onErrorRef.current?.(message);
          },
          onError: () => {
            const message = "PayPal checkout failed. Please try again.";
            setRenderError(message);
            onErrorRef.current?.(message);
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
          onErrorRef.current?.(message);
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
  }, [billingCycle, paymentMethodId, planId]);

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/85 p-4 shadow-inner shadow-slate-200/50">
      {quote ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.25rem] border border-white bg-white/90 px-4 py-3 text-sm shadow-sm">
          <div>
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              Secure PayPal approval
            </div>
            <p className="mt-1 text-slate-600">
              {planDisplayName} will capture{" "}
              <span className="font-semibold text-slate-950">
                {formatCurrency(quote.chargeAmount, quote.chargeCurrency)}
              </span>{" "}
              after you approve the popup.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Popup checkout
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-[1.25rem] border border-dashed border-slate-300 bg-white/75 px-4 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Securing PayPal checkout...
        </div>
      ) : null}

      <div className={loading || isCapturing ? "pointer-events-none opacity-70" : ""}>
        <div
          ref={containerRef}
          className="min-h-[58px] rounded-[1.25rem] border border-slate-200 bg-white px-3 py-2 shadow-sm"
        />
      </div>

      {!loading && !renderError && !hasRenderedButtons ? (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          PayPal is still warming up in this browser session. If the button does not appear after a moment, refresh once and try again.
        </div>
      ) : null}

      {isCapturing ? (
        <div className="flex items-center gap-2 rounded-[1.25rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finalizing payment capture and activating your subscription...
        </div>
      ) : null}

      {renderError ? (
        <div className="flex items-start gap-2 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{renderError}</span>
        </div>
      ) : null}
    </div>
  );
}

export default PayPalSubscriptionCheckout;
