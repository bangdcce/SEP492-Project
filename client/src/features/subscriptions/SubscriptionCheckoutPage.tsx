import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { createPaymentMethod, getPaymentMethods } from "@/features/payments/api";
import type { PaymentMethodView } from "@/features/payments/types";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PayPalSubscriptionCheckout } from "./components/PayPalSubscriptionCheckout";
import { getMySubscription, getSubscriptionPlans } from "./api";
import {
  BillingCycle,
  PERK_LABELS,
  formatPerkValue,
  formatCurrency,
  getBillingCycleLabel,
  getPlanDisplayAmount,
  getMonthlyEquivalent,
  type MySubscriptionResponse,
  type SubscriptionPlan,
  type SubscribeResponse,
} from "./types";
import { resolveSubscriptionRoute } from "./subscriptionRoutes";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const axiosErr = error as { response?: { data?: { message?: string } } };
  return axiosErr?.response?.data?.message || fallback;
};

export function SubscriptionCheckoutPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser<{ role?: string; email?: string }>();
  const subscriptionRoute = resolveSubscriptionRoute(currentUser?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<MySubscriptionResponse | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodView[]>([]);
  const [paymentMethodsLoaded, setPaymentMethodsLoaded] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(BillingCycle.MONTHLY);
  const [savingPayPalMethod, setSavingPayPalMethod] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [subscriptionResult, plansResult, paymentMethodsResult] = await Promise.allSettled([
        getMySubscription(),
        getSubscriptionPlans(),
        getPaymentMethods(),
      ]);

      if (subscriptionResult.status === "fulfilled") {
        setSubscription(subscriptionResult.value);
      } else {
        setSubscription(null);
      }

      if (plansResult.status === "fulfilled") {
        setPlans(plansResult.value);
      } else {
        setPlans([]);
      }

      if (paymentMethodsResult.status === "fulfilled") {
        setPaymentMethods(paymentMethodsResult.value);
        setPaymentMethodsLoaded(true);
      } else {
        setPaymentMethods([]);
        setPaymentMethodsLoaded(false);
      }

      const loadErrors: string[] = [];
      if (subscriptionResult.status === "rejected") {
        loadErrors.push(getErrorMessage(subscriptionResult.reason, "Failed to load subscription data."));
      }
      if (plansResult.status === "rejected") {
        loadErrors.push(getErrorMessage(plansResult.reason, "Failed to load subscription plans."));
      }
      if (paymentMethodsResult.status === "rejected") {
        loadErrors.push(
          `Saved payment methods are temporarily unavailable. ${getErrorMessage(paymentMethodsResult.reason, "Failed to load payment methods.")}`,
        );
      }

      if (loadErrors.length > 0) {
        setError(loadErrors.join(" "));
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load subscription checkout."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const payPalMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "PAYPAL_ACCOUNT"),
    [paymentMethods],
  );
  const activePayPalMethod = useMemo(
    () => payPalMethods.find((method) => method.isDefault) ?? payPalMethods[0] ?? null,
    [payPalMethods],
  );
  const isPremium = subscription?.isPremium || false;
  const currentSub = subscription?.subscription;
  const needsPayPalSetup = !isPremium && paymentMethodsLoaded && !activePayPalMethod;
  const previewPlan = plans[0] ?? null;
  const previewMonthlyAmount = previewPlan
    ? getMonthlyEquivalent(previewPlan, selectedCycle)
    : null;
  const previewCycleAmount = previewPlan
    ? getPlanDisplayAmount(previewPlan, selectedCycle)
    : null;
  const checkoutTheme: CSSProperties = {
    ["--checkout-spot-a" as string]: "rgba(14, 165, 233, 0.15)",
    ["--checkout-spot-b" as string]: "rgba(245, 158, 11, 0.16)",
    ["--checkout-spot-c" as string]: "rgba(15, 23, 42, 0.08)",
  };

  const ensurePayPalCheckoutMethod = useCallback(async () => {
    if (activePayPalMethod) {
      return activePayPalMethod;
    }

    try {
      setSavingPayPalMethod(true);
      setError(null);
      await createPaymentMethod({
        type: "PAYPAL_ACCOUNT",
        paypalEmail: currentUser?.email?.trim() || "paypal-checkout@interdev.local",
        displayName: "PayPal checkout",
        isDefault: payPalMethods.length === 0,
      });
      await fetchData();
      setSuccessMessage("PayPal checkout is ready. The buyer account will be stored after the first approval.");
      return null;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to prepare PayPal checkout."));
    } finally {
      setSavingPayPalMethod(false);
    }
  }, [activePayPalMethod, currentUser?.email, fetchData, payPalMethods.length]);

  useEffect(() => {
    if (!needsPayPalSetup || savingPayPalMethod) {
      return;
    }

    void ensurePayPalCheckoutMethod().catch((err: unknown) => {
      setError(getErrorMessage(err, "Failed to prepare PayPal checkout."));
    });
  }, [ensurePayPalCheckoutMethod, needsPayPalSetup, savingPayPalMethod]);

  const handleSubscriptionSuccess = useCallback(
    async (result: SubscribeResponse) => {
      setSuccessMessage(result.message);
      setError(null);
      await fetchData();
    },
    [fetchData],
  );

  const handleCheckoutError = useCallback((message: string | null) => {
    setError(message);
  }, []);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p>Loading subscription checkout...</p>
        </div>
      </div>
    );
  }

  if (error && !subscription && plans.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl py-12">
        <Alert variant="destructive">
          <AlertTitle>Unable to load checkout</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-4">
            <p>{error}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void fetchData()} variant="outline" className="w-fit">
                Try Again
              </Button>
              <Button asChild>
                <Link to={subscriptionRoute}>Back to subscription</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-0">
      {successMessage ? (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6" onClick={() => setSuccessMessage(null)}>
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section
        className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur"
        style={checkoutTheme}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top left, var(--checkout-spot-a), transparent 34%), radial-gradient(circle at bottom right, var(--checkout-spot-b), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92))",
          }}
        />
        <div className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="space-y-6">
            <Button variant="ghost" className="-ml-4 w-fit text-slate-600 hover:text-slate-900" onClick={() => navigate(subscriptionRoute)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to subscription
            </Button>

            <div className="space-y-4">
              <Badge variant="secondary" className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                Premium Checkout
              </Badge>
              <div className="max-w-3xl space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                  Choose a billing cycle and finish checkout in one secure PayPal approval.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                  Premium turns on immediately after the approved capture, and the first successful payment also prepares faster PayPal checkout for future purchases.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Activation
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Premium access unlocks right after PayPal approves and captures the payment.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-sky-600" />
                  Secure Flow
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Checkout opens in a PayPal popup so approval stays inside PayPal’s secure flow.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <CreditCard className="h-4 w-4 text-teal-600" />
                  Faster Next Time
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The first successful approval also prepares PayPal for a faster follow-up checkout experience.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
              Billing Cycle
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-[1.25rem] bg-white/5 p-1">
              {Object.values(BillingCycle).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setSelectedCycle(cycle)}
                  className={`rounded-[1rem] px-3 py-3 text-sm font-medium transition-all ${
                    selectedCycle === cycle
                      ? "bg-white text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.18)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {getBillingCycleLabel(cycle)}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                At a glance
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-white/70">Preview plan</p>
                  <p className="mt-1 text-xl font-semibold">
                    {previewPlan?.displayName || "Premium subscription"}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <p className="text-sm text-white/70">Equivalent monthly rate</p>
                    <p className="mt-1 text-3xl font-semibold">
                      {previewPlan && previewMonthlyAmount !== null
                        ? formatCurrency(previewMonthlyAmount, previewPlan.displayCurrency)
                        : "--"}
                      <span className="ml-1 text-sm font-medium text-white/55">/mo</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Charged this cycle</p>
                    <p className="mt-1 text-lg font-medium">
                      {previewPlan && previewCycleAmount !== null
                        ? formatCurrency(previewCycleAmount, previewPlan.displayCurrency)
                        : "--"}
                    </p>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-white/75">
                  {activePayPalMethod?.fastCheckoutReady
                    ? "Your PayPal vault is already ready, so approval should feel faster."
                    : "A secure PayPal popup opens when you subscribe. The first successful approval also finishes vault setup."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isPremium ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Premium already active
            </CardTitle>
            <CardDescription>
              This account already has an active premium plan. Manage it from the subscription overview page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentSub?.plan ? (
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">{currentSub.plan.displayName}</p>
                <p className="mt-1 text-muted-foreground">
                  Current cycle: {getBillingCycleLabel(currentSub.billingCycle)} until{" "}
                  {new Date(currentSub.currentPeriodEnd).toLocaleDateString("vi-VN")}.
                </p>
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to={subscriptionRoute}>Return to subscription</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              Pick your premium plan and confirm the PayPal popup
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              The checkout card below now focuses on the plan itself, with the payment step folded into a calmer PayPal panel.
            </p>
          </div>

          <div className={`mx-auto grid gap-6 ${plans.length === 1 ? "max-w-4xl" : "xl:grid-cols-2"}`}>
            {plans.map((plan, index) => {
              const monthlyEquiv = getMonthlyEquivalent(plan, selectedCycle);
              const totalPrice = getPlanDisplayAmount(plan, selectedCycle);

              return (
                <Card
                  key={plan.id}
                  className="group relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-teal-400 to-amber-400" />
                  <CardHeader className="space-y-6 p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-4">
                        <Badge
                          variant="secondary"
                          className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600"
                        >
                          {plans.length === 1 ? "Premium access" : index === 0 ? "Recommended" : "Plan option"}
                        </Badge>
                        <div>
                          <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
                            {plan.displayName}
                          </CardTitle>
                          <CardDescription className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                            {plan.description}
                          </CardDescription>
                        </div>
                      </div>

                      {selectedCycle !== BillingCycle.MONTHLY ? (
                        <div className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                          {getBillingCycleLabel(selectedCycle)}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-4 rounded-[1.75rem] bg-slate-950 px-5 py-6 text-white md:grid-cols-[minmax(0,1fr)_220px]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
                          Equivalent monthly rate
                        </p>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="text-5xl font-semibold tracking-tight">
                            {formatCurrency(monthlyEquiv, plan.displayCurrency)}
                          </span>
                          <span className="pb-2 text-sm text-white/60">/mo</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/70">
                          {selectedCycle === BillingCycle.MONTHLY
                            ? "Charged once per month after you approve the PayPal popup."
                            : `Billed ${formatCurrency(totalPrice, plan.displayCurrency)} per ${getBillingCycleLabel(selectedCycle).toLowerCase()}.`}
                        </p>
                      </div>

                      <div className="rounded-[1.25rem] border border-white/10 bg-white/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                          Checkout flow
                        </p>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-white/80">
                          <p>PayPal popup approval</p>
                          <p>Instant premium activation</p>
                          <p>Vault setup after first success</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-3 px-6 pb-6 md:grid-cols-2 md:px-8">
                    {Object.entries(plan.perks).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4"
                      >
                        <div className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-700">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {PERK_LABELS[key] || key}
                          </p>
                          <p className="text-sm leading-6 text-slate-600">
                            {formatPerkValue(key, value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>

                  <CardFooter className="px-6 pb-6 pt-0 md:px-8">
                    <div className="w-full">
                      {activePayPalMethod ? (
                        <PayPalSubscriptionCheckout
                          planId={plan.id}
                          planDisplayName={plan.displayName}
                          billingCycle={selectedCycle}
                          paymentMethodId={activePayPalMethod.id}
                          onSubscribed={handleSubscriptionSuccess}
                          onError={handleCheckoutError}
                        />
                      ) : (
                        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/70 p-4">
                          <Button
                            className="w-full"
                            onClick={() => void ensurePayPalCheckoutMethod()}
                            disabled={savingPayPalMethod}
                          >
                            {savingPayPalMethod ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {savingPayPalMethod ? "Preparing secure checkout..." : "Prepare PayPal to continue"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default SubscriptionCheckoutPage;
