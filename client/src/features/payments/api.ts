import { apiClient } from "@/shared/api/client";
import type {
  CreatePaymentMethodInput,
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

export async function getPaymentMethods(): Promise<PaymentMethodView[]> {
  return unwrap(await apiClient.get<ApiEnvelope<PaymentMethodView[]>>("/payment-methods"));
}

export async function createPaymentMethod(
  payload: CreatePaymentMethodInput,
): Promise<PaymentMethodView> {
  return unwrap(
    await apiClient.post<ApiEnvelope<PaymentMethodView>>("/payment-methods", payload),
  );
}

export async function setDefaultPaymentMethod(id: string): Promise<PaymentMethodView> {
  return unwrap(
    await apiClient.patch<ApiEnvelope<PaymentMethodView>>(`/payment-methods/${id}/default`),
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
