import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import Stripe from 'stripe';

export interface StripeCheckoutConfigView {
  enabled: boolean;
  environment: 'test';
}

export interface CreateStripeMilestoneCheckoutInput {
  milestoneId: string;
  escrowId: string;
  projectId: string;
  payerId: string;
  paymentMethodId: string;
  milestoneTitle: string;
  amount: number;
  currency: string;
  returnUrl: string;
  customerEmail?: string | null;
}

export interface StripeCheckoutSessionView {
  sessionId: string;
  checkoutUrl: string;
}

export interface StripeCheckoutSessionDetails {
  sessionId: string;
  status: string | null;
  paymentStatus: string | null;
  amount: number;
  currency: string;
  paymentIntentId: string | null;
  customerEmail: string | null;
  metadata: Record<string, string>;
}

@Injectable()
export class StripeCheckoutService {
  private readonly stripe: Stripe | null;
  private readonly allowedReturnOrigins: Set<string>;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    this.stripe = secretKey ? new Stripe(secretKey) : null;
    this.allowedReturnOrigins = this.buildAllowedReturnOrigins();
  }

  getClientConfig(): StripeCheckoutConfigView {
    return {
      enabled: Boolean(this.stripe),
      environment: 'test',
    };
  }

  async createMilestoneCheckoutSession(
    input: CreateStripeMilestoneCheckoutInput,
  ): Promise<StripeCheckoutSessionView> {
    const stripe = this.requireStripe();
    const amountInCents = new Decimal(input.amount)
      .mul(100)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();
    const metadata = {
      milestoneId: input.milestoneId,
      escrowId: input.escrowId,
      projectId: input.projectId,
      payerId: input.payerId,
      paymentMethodId: input.paymentMethodId,
      gateway: 'STRIPE',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: input.milestoneId,
      customer_email: input.customerEmail || undefined,
      success_url: this.buildReturnUrl(input.returnUrl, {
        stripeCheckout: 'success',
        stripeSessionId: '{CHECKOUT_SESSION_ID}',
        stripePaymentMethodId: input.paymentMethodId,
      }),
      cancel_url: this.buildReturnUrl(input.returnUrl, {
        stripeCheckout: 'cancel',
        stripePaymentMethodId: input.paymentMethodId,
      }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: amountInCents,
            product_data: {
              name: `Fund milestone: ${input.milestoneTitle}`,
              description: 'Escrow funding for a single project milestone.',
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
      },
      submit_type: 'pay',
    });

    if (!session.url) {
      throw new InternalServerErrorException('Stripe Checkout did not return a redirect URL');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSessionDetails> {
    const stripe = this.requireStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.amount_total == null || !session.currency) {
      throw new InternalServerErrorException(
        `Stripe Checkout session ${sessionId} is missing amount details`,
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(session.metadata ?? {})) {
      if (typeof value === 'string') {
        metadata[key] = value;
      }
    }

    return {
      sessionId: session.id,
      status: session.status ?? null,
      paymentStatus: session.payment_status ?? null,
      amount: new Decimal(session.amount_total)
        .div(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber(),
      currency: session.currency.toUpperCase(),
      paymentIntentId,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      metadata,
    };
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe test mode is not configured. Add STRIPE_SECRET_KEY to enable card checkout.',
      );
    }

    return this.stripe;
  }

  private buildReturnUrl(baseReturnUrl: string, params: Record<string, string>): string {
    const url = this.validateReturnUrl(baseReturnUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private validateReturnUrl(rawReturnUrl: string): URL {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawReturnUrl);
    } catch {
      throw new BadRequestException('Stripe returnUrl must be a valid absolute URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Stripe returnUrl must use http or https');
    }

    if (!this.allowedReturnOrigins.has(parsedUrl.origin)) {
      throw new BadRequestException('Stripe returnUrl origin is not allowed');
    }

    return parsedUrl;
  }

  private buildAllowedReturnOrigins(): Set<string> {
    const origins = new Set<string>();
    const candidates = [
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'https://127.0.0.1:5173',
    ].filter(Boolean) as string[];

    for (const value of candidates) {
      try {
        origins.add(new URL(value).origin);
      } catch {
        continue;
      }
    }

    return origins;
  }
}
