import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PayoutMethodType, PayoutRequestEntity } from '../../database/entities';
import {
  PayoutGateway,
  PayoutGatewayContext,
  PayoutGatewayResult,
} from './interfaces/payout-gateway.interface';
import {
  PayPalMerchantBalanceEntryView,
  PayPalMerchantBalanceView,
} from './payments.types';

interface PayPalTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

interface PayPalPayoutBatchResponse {
  batch_header?: {
    payout_batch_id?: string;
    batch_status?: string;
  };
}

interface PayPalReportingBalancesResponse {
  balances?: Array<Record<string, unknown>>;
}

interface PayPalErrorResponse {
  message?: string;
  name?: string;
}

@Injectable()
export class PayPalPayoutsGateway implements PayoutGateway {
  private readonly clientId = process.env.PAYPAL_PAYOUTS_CLIENT_ID?.trim()
    || process.env.PAYPAL_CLIENT_ID?.trim()
    || '';

  private readonly clientSecret = process.env.PAYPAL_PAYOUTS_CLIENT_SECRET?.trim()
    || process.env.PAYPAL_CLIENT_SECRET?.trim()
    || '';

  private readonly environment = (
    process.env.PAYPAL_PAYOUTS_ENV?.trim().toLowerCase() === 'live' ? 'live' : 'sandbox'
  ) as 'sandbox' | 'live';

  async payout(
    payoutRequest: PayoutRequestEntity,
    payoutMethod: { type: PayoutMethodType; paypalEmail: string | null; bankName: string | null },
    context: PayoutGatewayContext,
  ): Promise<PayoutGatewayResult> {
    if (payoutMethod.type !== PayoutMethodType.PAYPAL_EMAIL) {
      return this.buildSandboxResult(payoutRequest, payoutMethod.type, context);
    }

    if (!this.isConfigured()) {
      return this.buildSandboxResult(payoutRequest, payoutMethod.type, context);
    }

    const token = await this.fetchAccessToken();
    const response = await fetch(`${this.getBaseUrl()}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `payout-${payoutRequest.id}`,
          email_subject: 'Your cashout request has been initiated',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: {
              value: context.netAmount.toFixed(2),
              currency: context.currency,
            },
            note: context.note || 'Cashout request processed by InterDev',
            sender_item_id: payoutRequest.id,
            receiver: payoutMethod.paypalEmail,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ServiceUnavailableException(
        `PayPal Payouts request failed (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as PayPalPayoutBatchResponse;
    const batchId =
      payload.batch_header?.payout_batch_id
      || `paypal:${payoutRequest.id}`;
    const batchStatus = String(payload.batch_header?.batch_status || 'SUCCESS').toUpperCase();

    return {
      providerReference: batchId,
      nextAction: {
        type: 'PAYPAL_PAYOUT_CREATED',
        batchId,
        batchStatus,
        gateway: 'PAYPAL_PAYOUTS',
      },
      sandboxFallback: false,
    };
  }

  async getMerchantBalance(): Promise<PayPalMerchantBalanceView> {
    const checkedAt = new Date();

    if (!this.isConfigured()) {
      return {
        provider: 'PAYPAL',
        environment: this.environment,
        status: 'UNAVAILABLE',
        checkedAt,
        message:
          'PayPal merchant balance is unavailable because the current runtime is missing PayPal client credentials.',
        errorCode: 'MISSING_CREDENTIALS',
        balances: [],
      };
    }

    try {
      const token = await this.fetchAccessToken();
      const url = `${this.getBaseUrl()}/v1/reporting/balances?as_of_time=${encodeURIComponent(checkedAt.toISOString())}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const parsedError = this.parsePayPalError(errorBody);
        return {
          provider: 'PAYPAL',
          environment: this.environment,
          status: 'UNAVAILABLE',
          checkedAt,
          message: `PayPal merchant balance could not be loaded (${response.status}). ${parsedError}`,
          errorCode: `HTTP_${response.status}`,
          balances: [],
        };
      }

      const payload = (await response.json()) as PayPalReportingBalancesResponse;
      return {
        provider: 'PAYPAL',
        environment: this.environment,
        status: 'AVAILABLE',
        checkedAt,
        message: null,
        errorCode: null,
        balances: this.normalizeMerchantBalances(payload),
      };
    } catch (error) {
      return {
        provider: 'PAYPAL',
        environment: this.environment,
        status: 'UNAVAILABLE',
        checkedAt,
        message: error instanceof Error ? error.message : 'PayPal merchant balance is unavailable.',
        errorCode: 'BALANCE_LOOKUP_FAILED',
        balances: [],
      };
    }
  }

  describeProcessingMode(
    payoutMethodType: PayoutMethodType,
  ): { processingMode: 'PAYPAL_PAYOUTS' | 'SANDBOX_FALLBACK'; processingDescription: string } {
    if (payoutMethodType !== PayoutMethodType.PAYPAL_EMAIL) {
      return {
        processingMode: 'SANDBOX_FALLBACK',
        processingDescription:
          'Only PayPal cashout is live right now. Non-PayPal payout methods stay on file for a later rail.',
      };
    }

    if (!this.isConfigured()) {
      return {
        processingMode: 'SANDBOX_FALLBACK',
        processingDescription:
          'This sandbox is completing cashouts inside InterDev because PayPal Payouts credentials are not configured for the current runtime.',
      };
    }

    return {
      processingMode: 'PAYPAL_PAYOUTS',
      processingDescription:
        'This request will be sent to PayPal Payouts with the saved PayPal destination.',
    };
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
    const response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ServiceUnavailableException(
        `Unable to obtain PayPal access token (${response.status}): ${errorBody.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as PayPalTokenResponse;
    if (!payload.access_token) {
      throw new ServiceUnavailableException('PayPal access token response was missing access_token');
    }

    return payload.access_token;
  }

  private normalizeMerchantBalances(
    payload: PayPalReportingBalancesResponse,
  ): PayPalMerchantBalanceEntryView[] {
    const rows = Array.isArray(payload.balances) ? payload.balances : [];

    return rows.map((entry) => {
      const totalBalance = this.readMoneyValue(
        entry.total_balance,
        entry.totalBalance,
        entry.total,
      );
      const availableBalance = this.readMoneyValue(
        entry.available_balance,
        entry.availableBalance,
        entry.available,
      );
      const pendingBalance = this.readMoneyValue(
        entry.pending_balance,
        entry.withheld_balance,
        entry.hold_balance,
      );

      return {
        currency:
          this.readCurrency(
            entry.currency_code,
            entry.currency,
            entry.total_balance,
            entry.available_balance,
            entry.pending_balance,
          ) || 'USD',
        totalBalance,
        availableBalance,
        pendingBalance,
      };
    });
  }

  private readMoneyValue(...candidates: unknown[]): number | null {
    for (const candidate of candidates) {
      if (candidate == null) {
        continue;
      }
      if (typeof candidate === 'number') {
        return Number.isFinite(candidate) ? candidate : null;
      }
      if (typeof candidate === 'string') {
        const parsed = Number(candidate);
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (typeof candidate === 'object') {
        const value = (candidate as { value?: unknown }).value;
        if (typeof value === 'number') {
          return Number.isFinite(value) ? value : null;
        }
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
      }
    }

    return null;
  }

  private readCurrency(...candidates: unknown[]): string | null {
    for (const candidate of candidates) {
      if (candidate == null) {
        continue;
      }
      if (typeof candidate === 'string') {
        return candidate;
      }
      if (typeof candidate === 'object') {
        const value = (candidate as { currency_code?: unknown; currency?: unknown }).currency_code
          ?? (candidate as { currency?: unknown }).currency;
        if (typeof value === 'string') {
          return value;
        }
      }
    }

    return null;
  }

  private parsePayPalError(body: string): string {
    try {
      const payload = JSON.parse(body) as PayPalErrorResponse;
      return payload.message || payload.name || body.slice(0, 200);
    } catch {
      return body.slice(0, 200);
    }
  }

  private buildSandboxResult(
    payoutRequest: PayoutRequestEntity,
    methodType: PayoutMethodType,
    context: PayoutGatewayContext,
  ): PayoutGatewayResult {
    return {
      providerReference: `sandbox:payout:${payoutRequest.id}`,
      nextAction: {
        type: 'SANDBOX_PAYOUT_COMPLETED',
        gateway: 'INTERNAL_SANDBOX',
        methodType,
        amount: context.amount,
        currency: context.currency,
        note: context.note || null,
        message: 'Sandbox fallback used because PayPal Payouts credentials are missing or the lane is not PayPal.',
      },
      sandboxFallback: true,
    };
  }
}
