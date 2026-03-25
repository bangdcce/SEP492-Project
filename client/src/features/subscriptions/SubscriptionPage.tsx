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

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Check, X, Zap, CreditCard, Sparkles, InfinityIcon, AlertTriangle, CalendarDays, Key, Activity } from 'lucide-react';

/**
 * SubscriptionPage — View and manage current subscription (UC-39).
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

  const handleSubscribe = async (planId: string) => {
    try {
      setSubscribing(true);
      setError(null);
      const response = await subscribeToPlan({
        planId,
        billingCycle: selectedCycle,
      });
      setSuccessMessage(response.message);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

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
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
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
            <Button onClick={fetchData} variant="outline" className="w-fit">Try Again</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPremium = subscription?.isPremium || false;
  const currentSub = subscription?.subscription;
  const perks = subscription?.perks || {};
  const usage = subscription?.usage || {};

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-8 animate-in fade-in duration-500">
      {successMessage && (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6" onClick={() => setSuccessMessage(null)}>
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-destructive" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your plan, view usage limits, and explore premium benefits.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Left Column: Plan & Usage */}
        <div className="space-y-8 md:col-span-2">
          {/* Current Plan Card */}
          <Card className={isPremium ? "border-primary/50 shadow-md shadow-primary/10 overflow-hidden relative" : ""}>
            {isPremium && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            )}
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    {isPremium ? (
                      <>
                        <Sparkles className="h-6 w-6 text-primary" />
                        {currentSub?.plan?.displayName || 'Premium Plan'}
                      </>
                    ) : (
                      'Free Plan'
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {isPremium 
                      ? "You have full access to premium features." 
                      : "You are on the free plan with limited features."}
                  </CardDescription>
                </div>
                <Badge variant={isPremium ? "default" : "secondary"} className="text-sm px-3 py-1">
                  {isPremium ? 'Active Premium' : 'Free Tier'}
                </Badge>
              </div>
            </CardHeader>
            
            {isPremium && currentSub && (
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/50 rounded-lg p-4 mb-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Billing</span>
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      {getBillingCycleLabel(currentSub.billingCycle)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Amount</span>
                    <span className="text-sm font-medium">{formatVND(currentSub.amountPaid)}</span>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Next Cycle</span>
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      {new Date(currentSub.currentPeriodEnd).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                {currentSub.cancelAtPeriodEnd && (
                  <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20 mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-semibold">Cancellation Pending</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                      Your subscription will not renew. Premium perks remain active until{' '}
                      <span className="font-semibold">{new Date(currentSub.currentPeriodEnd).toLocaleDateString('vi-VN')}</span>.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            )}
            
            <CardFooter className="pt-2">
              {isPremium && !currentSub?.cancelAtPeriodEnd ? (
                <Button variant="destructive" onClick={() => setShowCancelModal(true)}>
                  Cancel Subscription
                </Button>
              ) : !isPremium ? (
                <Button onClick={() => {
                  document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  <Zap className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                </Button>
              ) : null}
            </CardFooter>
          </Card>

          {/* Quota Usage */}
          {Object.keys(usage).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Quota Usage
                </CardTitle>
                <CardDescription>Track your monthly and lifetime limits.</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-6">
                {Object.entries(usage).map(([action, data]: [string, QuotaUsage]) => {
                  const limitStr = typeof data.limit === 'string' ? data.limit : String(data.limit);
                  const isUnlimited = limitStr === 'Unlimited' || data.limit === -1;
                  const progressPercent = isUnlimited ? 0 : Math.min(100, (data.used / (data.limit as number)) * 100);
                  const isAtLimit = !isUnlimited && progressPercent >= 100;
                  const isNearLimit = !isUnlimited && progressPercent >= 80;

                  return (
                    <div key={action} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-foreground">{QUOTA_ACTION_LABELS[action] || action}</span>
                        <span className={`font-mono ${isAtLimit ? 'text-destructive font-bold' : isNearLimit ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                          {data.used} / {isUnlimited ? <InfinityIcon className="inline h-3 w-3" /> : data.limit}
                        </span>
                      </div>
                      {!isUnlimited ? (
                        <Progress 
                          value={progressPercent} 
                          className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
                        />
                      ) : (
                        <div className="h-2 w-full rounded-full bg-primary/10 overflow-hidden relative">
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent w-[200%] animate-[shimmer_2s_infinite]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Perks summary */}
        <div className="space-y-6">
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Current Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {Object.entries(perks).map(([key, value]) => {
                  const isPremiumValue = value === -1 || value === true;
                  return (
                    <li key={key} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-muted-foreground">{PERK_LABELS[key] || key}</span>
                      <span className={`font-medium ${isPremiumValue ? 'text-primary flex items-center gap-1' : 'text-foreground'}`}>
                        {isPremiumValue && <Sparkles className="h-3 w-3" />}
                        {formatPerkValue(key, value)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Plans Section */}
      {!isPremium && plans.length > 0 && (
        <div id="plans-section" className="pt-12 pb-8 scroll-mt-20">
          <div className="text-center mb-10 space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Upgrade to Premium</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Unlock unlimited potential, match with exactly who you need, and remove all restrictions.
            </p>
            
            <div className="inline-flex items-center justify-center p-1 mt-6 bg-muted rounded-xl">
              {Object.values(BillingCycle).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setSelectedCycle(cycle)}
                  className={`
                    flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${selectedCycle === cycle 
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/5'}
                  `}
                >
                  {getBillingCycleLabel(cycle)}
                  {cycle === BillingCycle.QUARTERLY && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 hover:bg-green-500/20">Save 15%</Badge>
                  )}
                  {cycle === BillingCycle.YEARLY && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 hover:bg-green-500/20">Save 30%</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className={`grid gap-6 justify-center mx-auto ${plans.length === 1 ? 'max-w-3xl w-full' : 'md:grid-cols-2 lg:grid-cols-3 max-w-5xl'}`}>
            {plans.map((plan) => {
              const monthlyEquiv = getMonthlyEquivalent(plan, selectedCycle);
              let totalPrice: number;
              switch (selectedCycle) {
                case BillingCycle.QUARTERLY: totalPrice = plan.priceQuarterly; break;
                case BillingCycle.YEARLY: totalPrice = plan.priceYearly; break;
                default: totalPrice = plan.priceMonthly;
              }

              return (
                <Card key={plan.id} className={`relative border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 ${plans.length === 1 ? 'w-full' : 'flex flex-col hover:-translate-y-1'}`}>
                  <div className="absolute -top-3 left-0 right-0 flex justify-center">
                    <Badge className="bg-primary text-primary-foreground uppercase tracking-widest text-[10px] px-3 font-bold">Recommended</Badge>
                  </div>
                  
                  <div className={plans.length === 1 ? "md:grid md:grid-cols-5 md:gap-6 p-6" : ""}>
                    <div className={plans.length === 1 ? "md:col-span-2 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-6" : ""}>
                      <CardHeader className={`text-center ${plans.length === 1 ? 'p-0' : 'pt-8 pb-4'}`}>
                        <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">{formatVND(monthlyEquiv)}</span>
                      <span className="text-sm font-medium text-muted-foreground">/mo</span>
                    </div>
                    {selectedCycle !== BillingCycle.MONTHLY && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Billed {formatVND(totalPrice)} {getBillingCycleLabel(selectedCycle).toLowerCase()}
                      </p>
                    )}
                        <CardDescription className="mt-4 text-sm max-w-xs mx-auto">{plan.description}</CardDescription>
                      </CardHeader>
                      
                      {plans.length === 1 && (
                        <div className="mt-6">
                          <Button 
                            className="w-full text-md h-12" 
                            onClick={() => handleSubscribe(plan.id)}
                            disabled={subscribing}
                          >
                            {subscribing ? (
                              <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" /> Processing</>
                            ) : (
                              `Subscribe Now`
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className={plans.length === 1 ? "md:col-span-3 pt-6 md:pt-0 pl-0 md:pl-2 flex flex-col justify-center" : "flex-1 pb-6"}>
                      <CardContent className={plans.length === 1 ? "p-0" : ""}>
                        <ul className={plans.length === 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6" : "space-y-3.5"}>
                          {Object.entries(plan.perks).map(([key, value]) => (
                            <li key={key} className="flex gap-3 text-sm items-start">
                              <div className="mt-0.5 rounded-full bg-primary/10 p-1 shrink-0">
                                {typeof value === 'boolean' ? (
                                  value ? <Check className="h-3.5 w-3.5 text-primary" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : value === -1 ? (
                                  <InfinityIcon className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-primary" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">{PERK_LABELS[key] || key}</span>
                                <span className="text-xs text-muted-foreground">{formatPerkValue(key, value)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      
                      {plans.length > 1 && (
                        <CardFooter>
                          <Button 
                            className="w-full text-md h-12" 
                            onClick={() => handleSubscribe(plan.id)}
                            disabled={subscribing}
                          >
                            {subscribing ? (
                              <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" /> Processing</>
                            ) : (
                              `Subscribe Now`
                            )}
                          </Button>
                        </CardFooter>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your premium subscription?
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Alert className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">Information</AlertTitle>
              <AlertDescription className="text-xs">
                Your premium perks remain active until the end of your billing period 
                ({currentSub ? new Date(currentSub.currentPeriodEnd).toLocaleDateString('vi-VN') : ''}).
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <label htmlFor="reason" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Reason for cancelling (optional)
              </label>
              <textarea
                id="reason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Tell us why you're leaving..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={cancelling}>
              Keep Premium
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubscriptionPage;
