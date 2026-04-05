# Subscriptions Module

## Overview

This module implements the InterDev premium subscription system for UC-39, UC-40, and UC-41.

The current version is now payment-backed through PayPal Orders:
- the client requests a PayPal SDK config and converted quote,
- the backend creates the PayPal order,
- the backend captures the approved order,
- the subscription becomes `ACTIVE` only after that capture succeeds.

This is not a recurring PayPal Billing Subscriptions integration yet. It is a one-time PayPal capture that activates one billing period on the platform.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/subscriptions/plans` | List plans for the authenticated user's role |
| `GET` | `/subscriptions/me` | View current subscription, perks, payment summary, and usage |
| `GET` | `/subscriptions/paypal/config` | Load PayPal SDK config and the converted checkout quote |
| `POST` | `/subscriptions/paypal/order` | Create the PayPal order for the selected plan and cycle |
| `POST` | `/subscriptions/subscribe` | Capture approved PayPal order and activate the subscription |
| `POST` | `/subscriptions/cancel` | Cancel the active subscription at period end |

## Current Flow

1. The client selects a plan, billing cycle, and saved `PAYPAL_ACCOUNT` payment method.
2. `SubscriptionsService.getPayPalCheckoutConfig()` validates the user, plan, and method, then returns the PayPal SDK config plus the converted settlement amount.
3. `SubscriptionsService.createPayPalSubscriptionOrder()` creates the PayPal order through `PayPalCheckoutService`.
4. The frontend approves that order in the PayPal SDK.
5. `SubscriptionsService.subscribe()` captures the approved PayPal order, validates plan binding, amount, and currency, updates the saved payment method's PayPal vault metadata, and persists the subscription as `ACTIVE`.
6. The subscription row stores:
   - platform amount in VND,
   - provider reference as the PayPal capture id,
   - provider name,
   - captured amount and currency.

## Settlement Currency

PayPal does not support VND directly for Orders in this setup, so the subscription checkout amount is converted before order creation.

Relevant environment variables:
- `PAYPAL_SUBSCRIPTION_CURRENCY` default: `USD`
- `PAYPAL_SUBSCRIPTION_VND_RATE` default: `25000`

The subscription record still keeps the platform-facing amount in VND.

## Soft Cancel Logic

Cancelling a subscription still uses soft cancel:
1. `cancelAtPeriodEnd` becomes `true`
2. status becomes `CANCELLED`
3. premium access continues until `currentPeriodEnd`
4. overdue records can later be moved to `EXPIRED`
