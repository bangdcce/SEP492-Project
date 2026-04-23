import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  completePayPalMilestoneFunding,
  createPayPalMilestoneOrder,
  getPayPalCheckoutConfig,
} from "@/features/payments/api";
import type { MilestoneFundingResult } from "@/features/payments/types";

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

const PAYPAL_DESTROYED_COMPONENTS_PATTERN = /zoid destroyed all components/i;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    if (PAYPAL_DESTROYED_COMPONENTS_PATTERN.test(error.message)) {
      return "PayPal checkout was reloaded unexpectedly. Please wait a second and try funding again.";
    }

    return error.message;
  }

  return fallback;
};

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

interface PayPalMilestoneCheckoutProps {
  milestoneId: string;
  milestoneTitle: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
  onFunded?: (result: MilestoneFundingResult) => void;
  onError?: (message: string | null) => void;
}

export function PayPalMilestoneCheckout({
  milestoneId,
  milestoneTitle,
  paymentMethodId,
  amount,
  currency,
  onFunded,
  onError,
}: PayPalMilestoneCheckoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<{
    close?: () => void;
  } | null>(null);
  const onErrorRef = useRef(onError);
  const onFundedRef = useRef(onFunded);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onFundedRef.current = onFunded;
  }, [onFunded]);

  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasRenderedButtons, setHasRenderedButtons] = useState(false);
  const amountValue = useMemo(() => amount.toFixed(2), [amount]);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;

    const destroyButtons = () => {
      try {
        buttonsRef.current?.close?.();
      } catch {
        // Ignore cleanup errors from stale Zoid instances.
      } finally {
        buttonsRef.current = null;
      }
    };

    const boot = async () => {
      try {
        setLoading(true);
        setRenderError(null);
        setHasRenderedButtons(false);
        onErrorRef.current?.(null);

        const fallbackClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb";
        const config = await getPayPalCheckoutConfig(paymentMethodId).catch(() => ({
          clientId: fallbackClientId,
          environment: "sandbox" as const,
          vaultEnabled: false,
          userIdToken: null,
        }));

        await loadPayPalSdk(
          config.clientId || fallbackClientId,
          currency,
          config.userIdToken,
        );

        if (!active || !container || !window.paypal?.Buttons) {
          return;
        }

        destroyButtons();
        container.innerHTML = "";

        const buttons = window.paypal.Buttons({
          style: {
            layout: "vertical",
            label: "paypal",
            shape: "pill",
            height: 42,
            tagline: false,
          },
          createOrder: async (
            data: Record<string, unknown>,
            actions: { order: { create: (payload: Record<string, unknown>) => Promise<string> } },
          ) => {
            if (config.vaultEnabled) {
              const source =
                typeof data.paymentSource === "string"
                  ? data.paymentSource
                  : typeof data.fundingSource === "string"
                    ? data.fundingSource
                    : undefined;

              const order = await createPayPalMilestoneOrder(milestoneId, {
                paymentMethodId,
                source,
                returnUrl: window.location.href,
                cancelUrl: window.location.href,
              });
              return order.orderId;
            }

            return actions.order.create({
              intent: "CAPTURE",
              purchase_units: [
                {
                  custom_id: milestoneId,
                  description: `Milestone funding: ${milestoneTitle}`,
                  amount: {
                    currency_code: currency,
                    value: amountValue,
                  },
                },
              ],
            });
          },
          onApprove: async (
            data: Record<string, unknown>,
            actions: { order: { capture: () => Promise<Record<string, unknown>> } },
          ) => {
            try {
              setIsCapturing(true);
              onErrorRef.current?.(null);
              const result = await (async () => {
                if (config.vaultEnabled) {
                  const orderId =
                    typeof data.orderID === "string" ? data.orderID : null;
                  if (!orderId) {
                    throw new Error("PayPal did not return an order id to finalize capture.");
                  }

                  return completePayPalMilestoneFunding(milestoneId, {
                    paymentMethodId,
                    orderId,
                  });
                }

                const order = await actions.order.capture();
                return completePayPalMilestoneFunding(milestoneId, {
                  paymentMethodId,
                  order,
                });
              })();
              toast.success("PayPal payment captured and escrow funded");
              onFundedRef.current?.(result);
            } catch (error: unknown) {
              const message = getErrorMessage(
                error,
                "PayPal payment was captured, but the app could not sync the escrow state.",
              );
              setRenderError(message);
              onErrorRef.current?.(message);
              toast.error(message);
            } finally {
              setIsCapturing(false);
            }
          },
          onCancel: () => {
            const message = "PayPal checkout was cancelled before capture.";
            setRenderError(message);
            onErrorRef.current?.(message);
          },
          onError: () => {
            const message = "PayPal checkout failed. Try again.";
            setRenderError(message);
            onErrorRef.current?.(message);
          },
        });

        buttonsRef.current = buttons;

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
          "Failed to start PayPal checkout.",
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
      destroyButtons();
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [amountValue, currency, milestoneId, milestoneTitle, paymentMethodId]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
        Use PayPal to approve this exact escrow deposit. Once Vault is active for this buyer, PayPal can reuse the saved checkout here faster next time.
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading PayPal checkout...
        </div>
      ) : null}

      <div className={loading ? "pointer-events-none opacity-60" : ""}>
        <div
          ref={containerRef}
          className="min-h-14 rounded-2xl border border-white/10 bg-white px-3 py-2"
        />
      </div>

      {!loading && !renderError && !hasRenderedButtons ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          PayPal is still loading in this browser session. If the button does not appear, refresh the page once and try again.
        </div>
      ) : null}

      {isCapturing ? (
        <div className="flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finalizing capture and syncing escrow...
        </div>
      ) : null}

      {renderError ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{renderError}</span>
        </div>
      ) : null}
    </div>
  );
}
