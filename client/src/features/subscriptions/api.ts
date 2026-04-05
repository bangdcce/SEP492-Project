/**
 * Subscription API client.
 *
 * Handles all communication with the subscription endpoints on the server.
 * Uses the shared axiosClient which already includes auth cookies.
 */

import axiosClient from '@/lib/axiosClient';
import type {
  SubscriptionPlan,
  MySubscriptionResponse,
  SubscriptionPayPalConfigRequest,
  SubscriptionPayPalCheckoutConfig,
  CreatePayPalSubscriptionOrderRequest,
  PayPalSubscriptionOrder,
  SubscribeRequest,
  SubscribeResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
} from './types';

const SUBSCRIPTION_BASE_URL = '/subscriptions';

/**
 * Fetch available subscription plans for the authenticated user's role.
 *
 * The server filters plans based on the user's role from the JWT token,
 * so only relevant plans are returned.
 *
 * @returns Array of subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response = await axiosClient.get(`${SUBSCRIPTION_BASE_URL}/plans`);
  return response.data?.data || [];
}

/**
 * Fetch the authenticated user's current subscription status.
 *
 * Returns premium status, current plan details, perks, and quota usage.
 * Free-tier users get their default limits and usage counts.
 *
 * @returns Full subscription status
 */
export async function getMySubscription(): Promise<MySubscriptionResponse> {
  const response = await axiosClient.get(`${SUBSCRIPTION_BASE_URL}/me`);
  return response.data?.data;
}

export async function getSubscriptionPayPalConfig(
  request: SubscriptionPayPalConfigRequest,
): Promise<SubscriptionPayPalCheckoutConfig> {
  const query = new URLSearchParams({
    planId: request.planId,
    billingCycle: request.billingCycle,
    paymentMethodId: request.paymentMethodId,
  });
  const response = await axiosClient.get(
    `${SUBSCRIPTION_BASE_URL}/paypal/config?${query.toString()}`,
  );
  return response.data?.data;
}

export async function createPayPalSubscriptionOrder(
  request: CreatePayPalSubscriptionOrderRequest,
): Promise<PayPalSubscriptionOrder> {
  const response = await axiosClient.post(
    `${SUBSCRIPTION_BASE_URL}/paypal/order`,
    request,
  );
  return response.data?.data;
}

/**
 * Subscribe to a premium plan.
 *
 * Captures an approved PayPal order and activates the subscription immediately.
 *
 * @param request - Subscribe parameters
 * @returns Subscribe response with new subscription details
 * @throws 409 if user already has an active subscription
 * @throws 400 if plan doesn't match user's role
 * @throws 404 if plan not found
 */
export async function subscribeToPlan(
  request: SubscribeRequest,
): Promise<SubscribeResponse> {
  const response = await axiosClient.post(
    `${SUBSCRIPTION_BASE_URL}/subscribe`,
    request,
  );
  return response.data;
}

/**
 * Cancel the current subscription.
 *
 * Implements soft cancel: premium perks remain active until the
 * end of the current billing period.
 *
 * @param request - Cancel parameters (optional reason)
 * @returns Cancel response with updated subscription details
 * @throws 404 if no active subscription found
 * @throws 409 if already scheduled for cancellation
 */
export async function cancelSubscription(
  request: CancelSubscriptionRequest = {},
): Promise<CancelSubscriptionResponse> {
  const response = await axiosClient.post(
    `${SUBSCRIPTION_BASE_URL}/cancel`,
    request,
  );
  return response.data;
}

/**
 * Check if a 429 error response is a quota exceeded error.
 *
 * This helper is used throughout the app to detect quota errors
 * and show upgrade modals.
 *
 * @param error - Axios error object
 * @returns Parsed quota error details or null
 */
export function parseQuotaError(error: unknown): {
  action: string;
  limit: number;
  current: number;
  message: string;
  upgradeUrl: string;
} | null {
  if (!error || typeof error !== 'object') return null;
  const axiosErr = error as { response?: { status?: number; data?: Record<string, unknown> } };

  if (axiosErr?.response?.status !== 429) return null;

  const data = axiosErr.response.data;
  if (data?.code !== 'QUOTA_EXCEEDED') return null;

  return {
    action: (data.action as string) || '',
    limit: (data.limit as number) || 0,
    current: (data.current as number) || 0,
    message: (data.message as string) || 'Free plan limit reached.',
    upgradeUrl: (data.upgradeUrl as string) || '/subscriptions/plans',
  };
}

/**
 * Check if a 403 error response is a premium-required error.
 *
 * Used by features that are completely locked behind premium
 * (no free-tier access at all).
 *
 * @param error - Axios error object
 * @returns true if the error is a premium-required error
 */
export function isPremiumRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const axiosErr = error as { response?: { status?: number; data?: Record<string, unknown> } };

  if (axiosErr?.response?.status !== 403) return false;
  return axiosErr.response.data?.code === 'PREMIUM_REQUIRED';
}
