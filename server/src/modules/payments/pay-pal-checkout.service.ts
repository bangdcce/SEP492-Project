import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  PaymentMethodEntity,
  PaymentMethodType,
} from '../../database/entities';
import {
  PayPalCheckoutConfigView,
  PayPalMilestoneOrderView,
  PayPalSubscriptionOrderView,
} from './payments.types';

interface PayPalTokenResponse {
  access_token?: string;
  id_token?: string;
}

interface PayPalOrderResponse {
  id?: string;
  status?: string;
}

interface PayPalRefundResponse {
  id?: string;
  status?: string;
  seller_payable_breakdown?: {
    total_refunded_amount?: {
      value?: string;
      currency_code?: string;
    };
  };
}

interface PayPalCaptureDetailsResponse {
  id?: string;
  status?: string;
  seller_receivable_breakdown?: {
    total_refunded_amount?: {
      value?: string;
      currency_code?: string;
    };
  };
  seller_payable_breakdown?: {
    total_refunded_amount?: {
      value?: string;
      currency_code?: string;
    };
  };
}

export interface CreatePayPalMilestoneOrderInput {
  milestoneId: string;
  payerId: string;
  paymentMethodId: string;
  milestoneTitle: string;
  amount: number;
  currency: string;
  source?: string | null;
  returnUrl?: string | null;
  cancelUrl?: string | null;
}

export interface CreatePayPalSubscriptionOrderInput {
  planId: string;
  payerId: string;
  paymentMethodId: string;
  planDisplayName: string;
  billingCycle: string;
  amount: number;
  currency: string;
  exchangeRateApplied: number;
  displayAmountVnd: number;
  source?: string | null;
  returnUrl?: string | null;
  cancelUrl?: string | null;
}

export interface RefundPayPalCaptureInput {
  captureId: string;
  currency: string;
  amount: number;
  requestId?: string | null;
}

export interface PayPalCaptureRefundView {
  refundId: string | null;
  status: string;
  captureId: string;
  alreadyRefunded: boolean;
}

@Injectable()
export class PayPalCheckoutService {
  private readonly clientId = process.env.PAYPAL_CLIENT_ID?.trim() || 'sb';

  private readonly clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() || '';

  private readonly environment = (
    process.env.PAYPAL_ENV?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox'
  ) as 'sandbox' | 'live';

  constructor(
    @InjectRepository(PaymentMethodEntity)
    private readonly paymentMethodRepository: Repository<PaymentMethodEntity>,
  ) {}

  async getSdkConfigForUser(
    userId: string,
    paymentMethodId?: string,
  ): Promise<PayPalCheckoutConfigView> {
    const method = paymentMethodId
      ? await this.findUserPayPalMethod(userId, paymentMethodId)
      : null;
    const customerId = method ? this.extractVaultCustomerId(method) : null;

    let userIdToken: string | null = null;
    if (this.isConfigured()) {
      userIdToken = await this.generateUserIdToken(customerId);
    }

    return {
      clientId: this.clientId,
      environment: this.environment,
      vaultEnabled: this.isConfigured(),
      userIdToken,
    };
  }

  async createMilestoneOrder(
    input: CreatePayPalMilestoneOrderInput,
  ): Promise<PayPalMilestoneOrderView> {
    const method = await this.findUserPayPalMethod(input.payerId, input.paymentMethodId);
    return this.createOrder(
      {
        payerId: input.payerId,
        paymentMethodId: input.paymentMethodId,
        requestIdPrefix: `milestone-${input.milestoneId}`,
        amount: input.amount,
        currency: input.currency,
        source: input.source,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      },
      {
        custom_id: input.milestoneId,
        description: `Milestone funding: ${input.milestoneTitle}`,
      },
      method,
    );
  }

  async createSubscriptionOrder(
    input: CreatePayPalSubscriptionOrderInput,
  ): Promise<PayPalSubscriptionOrderView> {
    const method = await this.findUserPayPalMethod(input.payerId, input.paymentMethodId);
    const order = await this.createOrder(
      {
        payerId: input.payerId,
        paymentMethodId: input.paymentMethodId,
        requestIdPrefix: `subscription-${input.planId}`,
        amount: input.amount,
        currency: input.currency,
        source: input.source,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      },
      {
        custom_id: input.planId,
        description: `Premium subscription: ${input.planDisplayName} (${input.billingCycle})`,
      },
      method,
    );

    return {
      ...order,
      chargeAmount: input.amount,
      chargeCurrency: input.currency,
      displayAmountVnd: input.displayAmountVnd,
      exchangeRateApplied: input.exchangeRateApplied,
    };
  }

  async captureOrder(orderId: string): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal Vault capture requires PAYPAL_CLIENT_SECRET on the backend.',
      );
    }

    const accessToken = await this.fetchAccessToken();
    const response = await fetch(`${this.getBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ServiceUnavailableException(
        `Unable to capture PayPal order ${orderId} (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async refundCapture(input: RefundPayPalCaptureInput): Promise<PayPalCaptureRefundView> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal capture refunds require PAYPAL_CLIENT_SECRET on the backend.',
      );
    }

    const accessToken = await this.fetchAccessToken();
    const amountValue = new Decimal(input.amount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2);
    const response = await fetch(
      `${this.getBaseUrl()}/v2/payments/captures/${input.captureId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Prefer: 'return=representation',
          'PayPal-Request-Id':
            input.requestId?.trim()
            || `capture-refund-${input.captureId}-${randomUUID()}`,
        },
        body: JSON.stringify({
          amount: {
            value: amountValue,
            currency_code: input.currency,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 400 && this.isDuplicateRequestIdError(errorBody)) {
        const captureDetails = await this.getCaptureDetails(input.captureId, accessToken);
        const refundedAmount = captureDetails.refundedAmount
          ? new Decimal(captureDetails.refundedAmount)
          : new Decimal(0);
        const requestedAmount = new Decimal(amountValue);
        if (
          captureDetails.status === 'REFUNDED'
          || (
            captureDetails.status === 'PARTIALLY_REFUNDED'
            && refundedAmount.greaterThanOrEqualTo(requestedAmount)
          )
        ) {
          return {
            refundId: null,
            status: captureDetails.status,
            captureId: input.captureId,
            alreadyRefunded: true,
          };
        }

        throw new BadRequestException(
          `PayPal already received a refund request for capture ${input.captureId}. Refresh the project state before retrying.`,
        );
      }

      throw new ServiceUnavailableException(
        `Unable to refund PayPal capture ${input.captureId} (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as PayPalRefundResponse;
    if (!payload.id) {
      throw new ServiceUnavailableException(
        `PayPal refund response for capture ${input.captureId} was missing id`,
      );
    }

    return {
      refundId: payload.id,
      status: payload.status ?? 'COMPLETED',
      captureId: input.captureId,
      alreadyRefunded: false,
    };
  }

  private async getCaptureDetails(
    captureId: string,
    accessToken: string,
  ): Promise<{ status: string; refundedAmount: string | null }> {
    const response = await fetch(`${this.getBaseUrl()}/v2/payments/captures/${captureId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ServiceUnavailableException(
        `Unable to inspect PayPal capture ${captureId} (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as PayPalCaptureDetailsResponse;
    const refundedAmount =
      payload.seller_receivable_breakdown?.total_refunded_amount?.value
      ?? payload.seller_payable_breakdown?.total_refunded_amount?.value
      ?? null;

    return {
      status: payload.status ?? 'UNKNOWN',
      refundedAmount,
    };
  }

  private isDuplicateRequestIdError(errorBody: string): boolean {
    try {
      const payload = JSON.parse(errorBody) as { name?: string; message?: string };
      return payload.name === 'DUPLICATE_REQUEST_ID';
    } catch {
      return errorBody.includes('DUPLICATE_REQUEST_ID');
    }
  }

  private async findUserPayPalMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodEntity> {
    const method = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, userId },
    });

    if (!method) {
      throw new NotFoundException(`Payment method ${paymentMethodId} not found`);
    }

    if (method.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
      throw new BadRequestException('Only PAYPAL_ACCOUNT methods can use PayPal checkout');
    }

    return method;
  }

  private buildMilestoneOrderPayload(
    input: {
      amount: number;
      currency: string;
      source?: string | null;
      returnUrl?: string | null;
      cancelUrl?: string | null;
    },
    purchaseUnit: Record<string, unknown>,
    method: PaymentMethodEntity,
  ): Record<string, unknown> {
    const amountValue = new Decimal(input.amount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2);

    const payload: Record<string, unknown> = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          ...purchaseUnit,
          amount: {
            currency_code: input.currency,
            value: amountValue,
          },
        },
      ],
    };

    if (this.shouldStoreInVault(input.source)) {
      const paypalSource: Record<string, unknown> = {
        attributes: {
          vault: {
            store_in_vault: 'ON_SUCCESS',
            usage_type: 'MERCHANT',
            customer_type: 'CONSUMER',
          },
        },
      };

      if (method.paypalEmail?.trim()) {
        paypalSource.email_address = method.paypalEmail.trim();
      }

      const experienceContext = this.buildExperienceContext(input);
      if (experienceContext) {
        paypalSource.experience_context = experienceContext;
      }

      payload.payment_source = {
        paypal: paypalSource,
      };
    }

    return payload;
  }

  private buildExperienceContext(
    input: {
      returnUrl?: string | null;
      cancelUrl?: string | null;
    },
  ): Record<string, unknown> | null {
    const returnUrl = input.returnUrl?.trim();
    const cancelUrl = input.cancelUrl?.trim();
    if (!returnUrl || !cancelUrl) {
      return null;
    }

    return {
      user_action: 'PAY_NOW',
      payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    };
  }

  private shouldStoreInVault(source?: string | null): boolean {
    if (!source) {
      return true;
    }

    return source.trim().toLowerCase() === 'paypal';
  }

  private extractVaultCustomerId(method: PaymentMethodEntity): string | null {
    const vault = this.extractVaultMetadata(method.metadata);
    return typeof vault.customerId === 'string' && vault.customerId.trim()
      ? vault.customerId.trim()
      : null;
  }

  private extractVaultMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const rawVault = metadata.paypalVault;
    if (rawVault && typeof rawVault === 'object') {
      return rawVault as Record<string, unknown>;
    }

    return {};
  }

  private isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private getBaseUrl(): string {
    return this.environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async fetchAccessToken(): Promise<string> {
    const payload = await this.fetchOAuthToken();
    if (!payload.access_token) {
      throw new ServiceUnavailableException('PayPal access token response was missing access_token');
    }

    return payload.access_token;
  }

  private async generateUserIdToken(customerId: string | null): Promise<string | null> {
    const payload = await this.fetchOAuthToken(customerId);
    return payload.id_token ?? null;
  }

  private async fetchOAuthToken(customerId?: string | null): Promise<PayPalTokenResponse> {
    if (!this.isConfigured()) {
      return {};
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('response_type', 'id_token');
    if (customerId?.trim()) {
      body.set('target_customer_id', customerId.trim());
    }

    const response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ServiceUnavailableException(
        `Unable to obtain PayPal OAuth token (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    return (await response.json()) as PayPalTokenResponse;
  }

  private async createOrder(
    input: {
      payerId: string;
      paymentMethodId: string;
      requestIdPrefix: string;
      amount: number;
      currency: string;
      source?: string | null;
      returnUrl?: string | null;
      cancelUrl?: string | null;
    },
    purchaseUnit: Record<string, unknown>,
    method: PaymentMethodEntity,
  ): Promise<PayPalMilestoneOrderView> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal Vault checkout requires PAYPAL_CLIENT_SECRET on the backend.',
      );
    }

    const accessToken = await this.fetchAccessToken();
    const orderPayload = this.buildMilestoneOrderPayload(input, purchaseUnit, method);
    const response = await fetch(`${this.getBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
        'PayPal-Request-Id': `${input.requestIdPrefix}-${randomUUID()}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ServiceUnavailableException(
        `Unable to create PayPal order (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as PayPalOrderResponse;
    if (!payload.id) {
      throw new ServiceUnavailableException('PayPal order response was missing id');
    }

    return {
      orderId: payload.id,
      status: payload.status ?? 'CREATED',
      vaultRequested: this.shouldStoreInVault(input.source),
    };
  }
}
