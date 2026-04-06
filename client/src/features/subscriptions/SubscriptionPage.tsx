import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CreditCard,
  InfinityIcon,
  Loader2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cancelSubscription, getMySubscription } from "./api";
import {
  formatCurrency,
  getPlanDisplayAmount,
  formatPerkValue,
  getBillingCycleLabel,
  PERK_LABELS,
  QUOTA_ACTION_LABELS,
  type MySubscriptionResponse,
  type QuotaUsage,
} from "./types";
import { createPaymentMethod, getPaymentMethods } from "@/features/payments/api";
import type { PaymentMethodView } from "@/features/payments/types";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Progress } from "@/shared/components/ui/progress";
import { resolveSubscriptionCheckoutRoute } from "./subscriptionRoutes";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const axiosErr = error as { response?: { data?: { message?: string } } };
  return axiosErr?.response?.data?.message || fallback;
};

export function SubscriptionPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser<{ role?: string; email?: string }>();
  const subscriptionCheckoutRoute = resolveSubscriptionCheckoutRoute(currentUser?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<MySubscriptionResponse | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodView[]>([]);
  const [paymentMethodsLoaded, setPaymentMethodsLoaded] = useState(false);
  const [savingPayPalMethod, setSavingPayPalMethod] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [subscriptionResult, paymentMethodsResult] = await Promise.allSettled([
        getMySubscription(),
        getPaymentMethods(),
      ]);

      if (subscriptionResult.status === "fulfilled") {
        setSubscription(subscriptionResult.value);
      } else {
        setSubscription(null);
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
  const currentSubscriptionDisplayAmount =
    currentSub?.payment?.capturedAmount && currentSub.payment?.currency
      ? formatCurrency(currentSub.payment.capturedAmount, currentSub.payment.currency)
      : currentSub?.plan
        ? formatCurrency(
            getPlanDisplayAmount(currentSub.plan, currentSub.billingCycle),
            currentSub.plan.displayCurrency,
          )
        : null;

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
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Failed to prepare PayPal checkout."));
    } finally {
      setSavingPayPalMethod(false);
    }
  }, [activePayPalMethod, currentUser?.email, fetchData, payPalMethods.length]);

  const handleUpgradeClick = async () => {
    try {
      if (needsPayPalSetup || !activePayPalMethod) {
        await ensurePayPalCheckoutMethod();
      }

      navigate(subscriptionCheckoutRoute);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to prepare PayPal checkout."));
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
                      : "Upgrade to unlock higher limits and premium perks through PayPal checkout."}
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
                    <div className="mt-1 text-sm font-medium">{currentSubscriptionDisplayAmount ?? "—"}</div>
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
                <Button onClick={() => void handleUpgradeClick()} disabled={savingPayPalMethod}>
                  {savingPayPalMethod ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  {savingPayPalMethod
                    ? "Preparing PayPal..."
                    : activePayPalMethod
                      ? "Continue to Purchase"
                      : "Continue to PayPal"}
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
