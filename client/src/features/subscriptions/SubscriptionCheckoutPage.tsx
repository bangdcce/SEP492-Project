import { useCallback, useEffect, useMemo, useState } from "react";
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
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
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

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button variant="ghost" className="-ml-4 mb-2 w-fit" onClick={() => navigate(subscriptionRoute)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to subscription
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Premium Checkout</h1>
          <p className="mt-2 text-muted-foreground">
            Choose your billing cycle, then finish the PayPal popup approval to activate premium.
          </p>
        </div>
        {activePayPalMethod ? (
          <Badge variant="secondary" className="w-fit">
            {activePayPalMethod.fastCheckoutReady ? "PayPal ready" : "PayPal saved"}
          </Badge>
        ) : null}
      </div>

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
        <>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                PayPal checkout
              </CardTitle>
              <CardDescription>
                Subscription purchase uses the same PayPal Vault lane as milestone funding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activePayPalMethod ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{activePayPalMethod.paypalEmail || "PayPal buyer will be confirmed in checkout"}</p>
                    <p className="text-sm text-muted-foreground">
                      {activePayPalMethod.fastCheckoutReady
                        ? "PayPal vault is ready for faster future approval."
                        : "The first successful premium payment will verify and vault the buyer automatically."}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {activePayPalMethod.fastCheckoutReady ? "Fast checkout ready" : "First approval pending"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A PayPal popup will open when you choose a plan below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-background p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-foreground">Preparing PayPal checkout</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      The app is setting up the same PayPal Vault lane used by wallet funding. You will approve the buyer directly in the PayPal popup.
                    </p>
                  </div>
                  <Button onClick={() => void ensurePayPalCheckoutMethod()} disabled={savingPayPalMethod}>
                    {savingPayPalMethod ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {savingPayPalMethod ? "Preparing..." : "Prepare PayPal"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">Choose your premium plan</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Review the billing cycle below and finish checkout on PayPal to activate premium perks.
              </p>
              <div className="mt-6 inline-flex rounded-xl bg-muted p-1">
                {Object.values(BillingCycle).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setSelectedCycle(cycle)}
                    className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                      selectedCycle === cycle ? "bg-background shadow-sm ring-1 ring-border" : "text-muted-foreground"
                    }`}
                  >
                    {getBillingCycleLabel(cycle)}
                  </button>
                ))}
              </div>
            </div>

            <div className={`mx-auto grid gap-6 ${plans.length === 1 ? "max-w-3xl" : "md:grid-cols-2 lg:grid-cols-3"}`}>
              {plans.map((plan) => {
                const monthlyEquiv = getMonthlyEquivalent(plan, selectedCycle);
                const totalPrice = getPlanDisplayAmount(plan, selectedCycle);

                return (
                  <Card key={plan.id} className="border-primary/20 shadow-lg">
                    <CardHeader className="pt-8 text-center">
                      <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                      <div className="mt-4 flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-extrabold tracking-tight">
                          {formatCurrency(monthlyEquiv, plan.displayCurrency)}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
                      {selectedCycle !== BillingCycle.MONTHLY ? (
                        <p className="text-xs text-muted-foreground">
                          Billed {formatCurrency(totalPrice, plan.displayCurrency)}{" "}
                          {getBillingCycleLabel(selectedCycle).toLowerCase()}
                        </p>
                      ) : null}
                      <CardDescription className="mt-2">{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {Object.entries(plan.perks).map(([key, value]) => (
                          <li key={key} className="flex items-start justify-between gap-4 text-sm">
                            <span className="font-medium">{PERK_LABELS[key] || key}</span>
                            <span className="text-muted-foreground">{formatPerkValue(key, value)}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      {activePayPalMethod ? (
                        <PayPalSubscriptionCheckout
                          planId={plan.id}
                          planDisplayName={plan.displayName}
                          billingCycle={selectedCycle}
                          paymentMethodId={activePayPalMethod.id}
                          onSubscribed={async (result) => {
                            setSuccessMessage(result.message);
                            setError(null);
                            await fetchData();
                          }}
                          onError={setError}
                        />
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => void ensurePayPalCheckoutMethod()}
                          disabled={savingPayPalMethod}
                        >
                          {savingPayPalMethod ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {savingPayPalMethod ? "Preparing PayPal..." : "Prepare PayPal to continue"}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export default SubscriptionCheckoutPage;
