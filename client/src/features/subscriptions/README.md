# Subscriptions Feature

## Overview

Client-side subscription management for InterDev premium plans.

The current implementation supports:
- viewing the current subscription and quota usage,
- saving a PayPal funding method for subscription checkout,
- creating and approving a PayPal order for the selected plan,
- activating the subscription only after the backend captures the PayPal order,
- cancelling the subscription with soft-cancel behavior.

## Structure

```text
subscriptions/
|-- components/
|   |-- PayPalSubscriptionCheckout.tsx
|   `-- UpgradeModal.tsx
|-- api.ts
|-- types.ts
|-- SubscriptionPage.tsx
|-- subscription.css
|-- index.ts
`-- README.md
```

## Current Flow

1. `SubscriptionPage` loads plans, the current subscription snapshot, and saved payment methods.
2. If the user does not have a saved `PAYPAL_ACCOUNT` method yet, the page offers inline setup or a link to the billing page.
3. `PayPalSubscriptionCheckout` calls `GET /subscriptions/paypal/config` to fetch the PayPal SDK config and the converted settlement quote.
4. The PayPal button calls `POST /subscriptions/paypal/order` to create a server-side PayPal order for the chosen plan and billing cycle.
5. After buyer approval, the page calls `POST /subscriptions/subscribe` with `planId`, `billingCycle`, `paymentMethodId`, and `orderId`.
6. The backend captures the PayPal order and activates the subscription only after amount/currency validation passes.

This is a PayPal Orders capture flow, not a recurring PayPal Billing Subscriptions integration yet.

## API Functions

| Function | Endpoint | Description |
|----------|----------|-------------|
| `getSubscriptionPlans()` | `GET /subscriptions/plans` | Fetch plans for the authenticated user's role |
| `getMySubscription()` | `GET /subscriptions/me` | Get current subscription and usage snapshot |
| `getSubscriptionPayPalConfig()` | `GET /subscriptions/paypal/config` | Load PayPal SDK config and checkout quote |
| `createPayPalSubscriptionOrder()` | `POST /subscriptions/paypal/order` | Create the PayPal order for checkout |
| `subscribeToPlan()` | `POST /subscriptions/subscribe` | Capture approved PayPal order and activate the plan |
| `cancelSubscription()` | `POST /subscriptions/cancel` | Cancel the active subscription at period end |
