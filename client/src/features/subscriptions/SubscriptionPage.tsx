import { useCallback, useEffect, useMemo, useState } from "react";
import paypalLogo from "@/assets/brands/paypal-logo.svg";
import { cancelSubscription, getMySubscription, getSubscriptionPlans } from "./api";
import { PayPalSubscriptionCheckout } from "./components/PayPalSubscriptionCheckout";
import {
  BillingCycle,
  formatCurrency,
  formatPerkValue,
  formatVND,
  getBillingCycleLabel,
  getMonthlyEquivalent,
  PERK_LABELS,
  QUOTA_ACTION_LABELS,
  type MySubscriptionResponse,
  type QuotaUsage,
  type SubscriptionPlan,
} from "./types";
import { createPaymentMethod, getPaymentMethods } from "@/features/payments/api";
import type { PaymentMethodView } from "@/features/payments/types";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CreditCard,
  InfinityIcon,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const axiosErr = error as { response?: { data?: { message?: string } } };
  return axiosErr?.response?.data?.message || fallback;
};

export function SubscriptionPage() {
  const currentUser = useCurrentUser<{ role?: string; email?: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<MySubscriptionResponse | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodView[]>([]);
  const [paymentMethodsLoaded, setPaymentMethodsLoaded] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(BillingCycle.MONTHLY);
  const [payPalEmailInput, setPayPalEmailInput] = useState("");
  const [savingPayPalMethod, setSavingPayPalMethod] = useState(false);
  const [showPayPalSetupModal, setShowPayPalSetupModal] = useState(false);
  const [dismissedPayPalSetupPrompt, setDismissedPayPalSetupPrompt] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

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
      setError(getErrorMessage(err, "Failed to load subscription data."));
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
  const usage = subscription?.usage || {};
  const perks = subscription?.perks || {};
  const needsPayPalSetup = !isPremium && paymentMethodsLoaded && !activePayPalMethod;

  useEffect(() => {
    if (payPalEmailInput.trim() || !currentUser?.email) {
      return;
    }

    setPayPalEmailInput(currentUser.email);
  }, [currentUser?.email, payPalEmailInput]);

  useEffect(() => {
    if (!needsPayPalSetup || dismissedPayPalSetupPrompt) {
      return;
    }

    setShowPayPalSetupModal(true);
  }, [dismissedPayPalSetupPrompt, needsPayPalSetup]);

  const openPayPalSetupModal = () => {
    setShowPayPalSetupModal(true);
  };

  const handlePayPalSetupModalChange = (open: boolean) => {
    setShowPayPalSetupModal(open);
    if (!open) {
      setDismissedPayPalSetupPrompt(true);
    }
  };

  const handleCreatePayPalMethod = async () => {
    const trimmedEmail = payPalEmailInput.trim();
    if (!trimmedEmail) {
      setError("Enter the PayPal email you want to save first.");
      return;
    }

    try {
      setSavingPayPalMethod(true);
      setError(null);
      await createPaymentMethod({
        type: "PAYPAL_ACCOUNT",
        paypalEmail: trimmedEmail,
        displayName: trimmedEmail,
        isDefault: payPalMethods.length === 0,
      });
      setSuccessMessage("PayPal funding method saved for subscription checkout.");
      setPayPalEmailInput("");
      setShowPayPalSetupModal(false);
      setDismissedPayPalSetupPrompt(true);
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save the PayPal method."));
    } finally {
      setSavingPayPalMethod(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);
      const response = await cancelSubscription({ reason: cancelReason || undefined });
      setSuccessMessage(response.message);
      setShowCancelModal(false);
      setCancelReason("");
      await fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to cancel subscription."));
    } finally {
      setCancelling(false);
    }
  };

  const handleUpgradeClick = () => {
    if (needsPayPalSetup) {
      openPayPalSetupModal();
      return;
    }

    document.getElementById("plans-section")?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p>Loading subscription information...</p>
        </div>
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="container mx-auto max-w-4xl py-12">
        <Alert variant="destructive">
          <AlertTitle>Unable to load subscription</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-4">
            <p>{error}</p>
            <Button onClick={() => void fetchData()} variant="outline" className="w-fit">
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-8">
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
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="mt-2 text-muted-foreground">
          Premium activation now completes only after a successful PayPal capture.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          <Card className={isPremium ? "border-primary/40 shadow-md shadow-primary/10" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    {isPremium ? <Sparkles className="h-6 w-6 text-primary" /> : null}
                    {isPremium ? currentSub?.plan?.displayName || "Premium Plan" : "Free Plan"}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isPremium
                      ? "Your premium subscription is active."
                      : "Upgrade to unlock higher limits and premium perks."}
                  </CardDescription>
                </div>
                <Badge variant={isPremium ? "default" : "secondary"}>
                  {isPremium ? "Active Premium" : "Free Tier"}
                </Badge>
              </div>
            </CardHeader>
            {currentSub ? (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Billing</div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      {getBillingCycleLabel(currentSub.billingCycle)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Amount</div>
                    <div className="mt-1 text-sm font-medium">{formatVND(currentSub.amountPaid)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Current Period Ends</div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      {new Date(currentSub.currentPeriodEnd).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </div>
                {currentSub.payment ? (
                  <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
                    Last payment: {currentSub.payment.provider}
                    {currentSub.payment.capturedAmount && currentSub.payment.currency
                      ? ` ${formatCurrency(currentSub.payment.capturedAmount, currentSub.payment.currency)}`
                      : ""}
                    {currentSub.payment.reference ? ` (${currentSub.payment.reference})` : ""}.
                  </div>
                ) : null}
              </CardContent>
            ) : null}
            <CardFooter>
              {isPremium ? (
                <Button variant="destructive" onClick={() => setShowCancelModal(true)}>
                  Cancel Subscription
                </Button>
              ) : (
                <Button onClick={handleUpgradeClick}>
                  <Zap className="mr-2 h-4 w-4" />
                  {needsPayPalSetup ? "Set Up PayPal First" : "Upgrade to Premium"}
                </Button>
              )}
            </CardFooter>
          </Card>

          {Object.keys(usage).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Quota Usage</CardTitle>
                <CardDescription>Your current usage against the active plan.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                {Object.entries(usage).map(([action, data]: [string, QuotaUsage]) => {
                  const isUnlimited = data.limit === "Unlimited" || data.limit === -1;
                  const progress = isUnlimited ? 0 : Math.min(100, (data.used / Number(data.limit)) * 100);
                  return (
                    <div key={action} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{QUOTA_ACTION_LABELS[action] || action}</span>
                        <span className="font-mono text-muted-foreground">
                          {data.used} / {isUnlimited ? <InfinityIcon className="inline h-3 w-3" /> : data.limit}
                        </span>
                      </div>
                      {!isUnlimited ? <Progress value={progress} className="h-2" /> : <div className="h-2 rounded-full bg-primary/10" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="border-none bg-muted/30 shadow-none">
          <CardHeader>
            <CardTitle>Current Access</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Object.entries(perks).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{PERK_LABELS[key] || key}</span>
                  <span className="font-medium">{formatPerkValue(key, value)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {!isPremium ? (
        <div id="plans-section" className="space-y-8 pt-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Upgrade to Premium</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Save a PayPal funding method, review the live settlement quote, then approve the checkout button for your plan.
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

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                PayPal Setup
              </CardTitle>
              <CardDescription>
                Subscription checkout now uses PayPal end to end. Save a PayPal account first if you do not already have one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activePayPalMethod ? (
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <img src={paypalLogo} alt="PayPal" className="h-5 w-auto" />
                      </div>
                      <div>
                        <p className="font-medium">{activePayPalMethod.paypalEmail || activePayPalMethod.displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {activePayPalMethod.fastCheckoutReady
                            ? "Vault is already ready for faster PayPal checkout."
                            : "The first successful approval will verify and vault this PayPal account."}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {activePayPalMethod.fastCheckoutReady ? "Vault ready" : "First approval pending"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-background p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <img src={paypalLogo} alt="PayPal" className="h-5 w-auto" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">No PayPal funding method saved yet</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Subscription checkout needs a saved PayPal buyer account first. This is separate from your payout wallet email, but you can use the same PayPal address if you want.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step 1</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">Save buyer email</p>
                      <p className="mt-1 text-sm text-slate-600">Store the PayPal account you want to approve subscription purchases with.</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step 2</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">Approve checkout</p>
                      <p className="mt-1 text-sm text-slate-600">Pick a plan and finish the PayPal approval button for the first subscription purchase.</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step 3</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">Come back faster next time</p>
                      <p className="mt-1 text-sm text-slate-600">The first approved payment verifies the buyer and prepares faster future PayPal checkout.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={openPayPalSetupModal}>Set up PayPal now</Button>
                    <Button variant="outline" onClick={handleUpgradeClick}>
                      Review premium plans
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className={`mx-auto grid gap-6 ${plans.length === 1 ? "max-w-3xl" : "md:grid-cols-2 lg:grid-cols-3"}`}>
            {plans.map((plan) => {
              const monthlyEquiv = getMonthlyEquivalent(plan, selectedCycle);
              const totalPrice =
                selectedCycle === BillingCycle.QUARTERLY
                  ? plan.priceQuarterly
                  : selectedCycle === BillingCycle.YEARLY
                    ? plan.priceYearly
                    : plan.priceMonthly;
              return (
                <Card key={plan.id} className="border-primary/20 shadow-lg">
                  <CardHeader className="pt-8 text-center">
                    <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">{formatVND(monthlyEquiv)}</span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                    </div>
                    {selectedCycle !== BillingCycle.MONTHLY ? (
                      <p className="text-xs text-muted-foreground">
                        Billed {formatVND(totalPrice)} {getBillingCycleLabel(selectedCycle).toLowerCase()}
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
                      <Button className="w-full" onClick={openPayPalSetupModal}>
                        Set up PayPal to continue
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog open={showPayPalSetupModal} onOpenChange={handlePayPalSetupModalChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Set up PayPal for subscription checkout</DialogTitle>
            <DialogDescription>
              Save the PayPal buyer account you want to use for premium purchases before starting checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <img src={paypalLogo} alt="PayPal" className="h-5 w-auto" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Saved PayPal funding method</p>
                  <p className="text-sm leading-6 text-slate-600">
                    This buyer account is used to approve subscription payments. It is separate from your payout wallet setup, although the same PayPal email can be used for both.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">PayPal buyer email</p>
                <p className="text-sm text-slate-500">
                  Save the PayPal account that should appear during subscription approval.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="subscription-paypal-email" className="text-sm font-medium text-slate-800">
                  PayPal email
                </label>
                <Input
                  id="subscription-paypal-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="buyer@example.com"
                  value={payPalEmailInput}
                  onChange={(event) => setPayPalEmailInput(event.target.value)}
                />
                <p className="text-xs leading-5 text-slate-500">
                  The first successful PayPal approval will verify and vault this buyer for faster future subscription checkout.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handlePayPalSetupModalChange(false)}
              disabled={savingPayPalMethod}
            >
              Not now
            </Button>
            <Button onClick={() => void handleCreatePayPalMethod()} disabled={savingPayPalMethod}>
              {savingPayPalMethod ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {savingPayPalMethod ? "Saving..." : "Save PayPal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Your premium perks remain active until the current billing period ends.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason for cancelling (optional)
            </label>
            <textarea
              id="reason"
              className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Tell us why you're leaving..."
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={cancelling}>
              Keep Premium
            </Button>
            <Button variant="destructive" onClick={() => void handleCancel()} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubscriptionPage;
