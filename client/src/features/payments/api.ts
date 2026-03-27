import { apiClient } from "@/shared/api/client";
import type {
  CashoutQuote,
  CreatePaymentMethodInput,
  CreatePayoutMethodInput,
  CreatePayoutRequestInput,
  DeletePaymentMethodResult,
  PayPalCheckoutConfig,
  PayPalMilestoneOrder,
  PlatformWalletSnapshotResult,
  PlatformWalletTransactionsResult,
  PayoutMethodView,
  PayoutRequestMutationResult,
  PayoutRequestsResult,
  StripeCheckoutConfig,
  StripeCheckoutSession,
  MilestoneFundingResult,
  PaymentMethodView,
  WalletSnapshot,
  WalletTransactionsResult,
  FundingGateway,
} from "./types";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

const unwrap = <T>(response: ApiEnvelope<T>): T => response.data;

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `fund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export async function getWalletSnapshot(): Promise<WalletSnapshot> {
  return unwrap(await apiClient.get<ApiEnvelope<WalletSnapshot>>("/wallet/me"));
}

export async function getWalletTransactions(
  page = 1,
  limit = 12,
): Promise<WalletTransactionsResult> {
  return unwrap(
    await apiClient.get<ApiEnvelope<WalletTransactionsResult>>(
      `/wallet/me/transactions?page=${page}&limit=${limit}`,
    ),
  );
}

export async function getPlatformWalletSnapshot(): Promise<PlatformWalletSnapshotResult> {
  return unwrap(
    await apiClient.get<ApiEnvelope<PlatformWalletSnapshotResult>>("/wallet/platform"),
  );
}

export async function getPlatformWalletTransactions(
  page = 1,
  limit = 12,
  range?: "7d" | "30d" | "90d",
): Promise<PlatformWalletTransactionsResult> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (range) {
    query.set("range", range);
  }

  return unwrap(
    await apiClient.get<ApiEnvelope<PlatformWalletTransactionsResult>>(
      `/wallet/platform/transactions?${query.toString()}`,
    ),
  );
}

export async function getPaymentMethods(): Promise<PaymentMethodView[]> {
  return unwrap(await apiClient.get<ApiEnvelope<PaymentMethodView[]>>("/payment-methods"));
}

export async function getPayoutMethods(): Promise<PayoutMethodView[]> {
  return unwrap(await apiClient.get<ApiEnvelope<PayoutMethodView[]>>("/payout-methods"));
}

export async function getPayoutRequests(
  page = 1,
  limit = 10,
): Promise<PayoutRequestsResult> {
  return unwrap(
    await apiClient.get<ApiEnvelope<PayoutRequestsResult>>(
      `/cashout/requests?page=${page}&limit=${limit}`,
    ),
  );
}

export async function getPayPalCheckoutConfig(
  paymentMethodId?: string,
): Promise<PayPalCheckoutConfig> {
  return unwrap(
    await apiClient.get<ApiEnvelope<PayPalCheckoutConfig>>(
      paymentMethodId
        ? `/payments/paypal/config?paymentMethodId=${encodeURIComponent(paymentMethodId)}`
        : "/payments/paypal/config",
    ),
  );
}

export async function getStripeCheckoutConfig(): Promise<StripeCheckoutConfig> {
  return unwrap(
    await apiClient.get<ApiEnvelope<StripeCheckoutConfig>>("/payments/stripe/config"),
  );
}

export async function createPaymentMethod(
  payload: CreatePaymentMethodInput,
): Promise<PaymentMethodView> {
  return unwrap(
    await apiClient.post<ApiEnvelope<PaymentMethodView>>("/payment-methods", payload),
  );
}

export async function createPayoutMethod(
  payload: CreatePayoutMethodInput,
): Promise<PayoutMethodView> {
  return unwrap(
    await apiClient.post<ApiEnvelope<PayoutMethodView>>("/payout-methods", payload),
  );
}

export async function setDefaultPaymentMethod(id: string): Promise<PaymentMethodView> {
  return unwrap(
    await apiClient.patch<ApiEnvelope<PaymentMethodView>>(`/payment-methods/${id}/default`),
  );
}

export async function setDefaultPayoutMethod(id: string): Promise<PayoutMethodView> {
  return unwrap(
    await apiClient.patch<ApiEnvelope<PayoutMethodView>>(`/payout-methods/${id}/default`),
  );
}

export async function updatePaymentMethod(
  id: string,
  payload: CreatePaymentMethodInput,
): Promise<PaymentMethodView> {
  return unwrap(
    await apiClient.patch<ApiEnvelope<PaymentMethodView>>(`/payment-methods/${id}`, payload),
  );
}

export async function updatePayoutMethod(
  id: string,
  payload: CreatePayoutMethodInput,
): Promise<PayoutMethodView> {
  return unwrap(
    await apiClient.patch<ApiEnvelope<PayoutMethodView>>(`/payout-methods/${id}`, payload),
  );
}

export async function deletePaymentMethod(id: string): Promise<DeletePaymentMethodResult> {
  return unwrap(
    await apiClient.delete<ApiEnvelope<DeletePaymentMethodResult>>(`/payment-methods/${id}`),
  );
}

export async function resetPayPalCheckout(id: string): Promise<PaymentMethodView> {
  return unwrap(
    await apiClient.patch<ApiEnvelope<PaymentMethodView>>(`/payment-methods/${id}/reset-checkout`),
  );
}

export async function deletePayoutMethod(id: string): Promise<DeletePaymentMethodResult> {
  return unwrap(
    await apiClient.delete<ApiEnvelope<DeletePaymentMethodResult>>(`/payout-methods/${id}`),
  );
}

export async function getCashoutQuote(payload: {
  payoutMethodId: string;
  amount: number;
}): Promise<CashoutQuote> {
  return unwrap(
    await apiClient.post<ApiEnvelope<CashoutQuote>>("/cashout/requests/quote", payload),
  );
}

export async function requestCashout(
  payload: CreatePayoutRequestInput,
): Promise<PayoutRequestMutationResult> {
  return unwrap(
    await apiClient.post<ApiEnvelope<PayoutRequestMutationResult>>("/cashout/requests", payload),
  );
}

export async function fundMilestone(
  milestoneId: string,
  payload: {
    paymentMethodId: string;
    gateway?: FundingGateway;
  },
  idempotencyKey = createIdempotencyKey(),
): Promise<MilestoneFundingResult> {
  return unwrap(
    await apiClient.post<ApiEnvelope<MilestoneFundingResult>>(
      `/payments/milestones/${milestoneId}/fund`,
      {
        paymentMethodId: payload.paymentMethodId,
        gateway: payload.gateway ?? "INTERNAL_SANDBOX",
      },
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      },
    ),
  );
}

export async function completePayPalMilestoneFunding(
  milestoneId: string,
  payload: {
    paymentMethodId: string;
    orderId?: string;
    order?: Record<string, unknown>;
  },
): Promise<MilestoneFundingResult> {
  return unwrap(
    await apiClient.post<ApiEnvelope<MilestoneFundingResult>>(
      `/payments/milestones/${milestoneId}/paypal/capture`,
      payload,
    ),
  );
}

export async function createPayPalMilestoneOrder(
  milestoneId: string,
  payload: {
    paymentMethodId: string;
    source?: string;
    returnUrl?: string;
    cancelUrl?: string;
  },
): Promise<PayPalMilestoneOrder> {
  return unwrap(
    await apiClient.post<ApiEnvelope<PayPalMilestoneOrder>>(
      `/payments/milestones/${milestoneId}/paypal/order`,
      payload,
    ),
  );
}

export async function createStripeMilestoneCheckoutSession(
  milestoneId: string,
  payload: {
    paymentMethodId: string;
    returnUrl: string;
  },
): Promise<StripeCheckoutSession> {
  return unwrap(
    await apiClient.post<ApiEnvelope<StripeCheckoutSession>>(
      `/payments/milestones/${milestoneId}/stripe/checkout-session`,
      payload,
    ),
  );
}

export async function completeStripeMilestoneFunding(
  milestoneId: string,
  payload: {
    paymentMethodId: string;
    sessionId: string;
  },
): Promise<MilestoneFundingResult> {
  return unwrap(
    await apiClient.post<ApiEnvelope<MilestoneFundingResult>>(
      `/payments/milestones/${milestoneId}/stripe/complete`,
      payload,
    ),
  );
}
