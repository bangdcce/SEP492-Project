# Subscriptions Feature

## Overview

Client-side subscription management for InterDev premium plans. Implements UC-39 (View Subscription), UC-40 (Subscribe), and UC-41 (Cancel Subscription).

## Structure

```
subscriptions/
├── components/
│   └── UpgradeModal.tsx         # Reusable upgrade prompt for quota errors
├── api.ts                       # API client for subscription endpoints
├── types.ts                     # TypeScript types, enums, and display helpers
├── SubscriptionPage.tsx         # Main subscription management page
├── subscription.css             # Styles for all subscription components
├── index.ts                     # Barrel exports
└── README.md                    # This file
```

## Pages

### SubscriptionPage
- View current plan status (Free vs Premium)
- See active perks and their values
- View quota usage with progress bars
- Browse available plans with billing cycle selector
- Subscribe to a plan
- Cancel subscription with soft-cancel modal

## Reusable Components

### UpgradeModal
A modal component that can be shown anywhere in the app when:
- A user hits a free-tier quota limit (429 error)
- A user tries to access a premium-only feature (403 error)

Usage:
```tsx
import { UpgradeModal, parseQuotaError } from '@/features/subscriptions';

const quotaError = parseQuotaError(error);
if (quotaError) {
  setShowUpgrade(true);
}
```

## API Functions

| Function | Endpoint | Description |
|----------|----------|-------------|
| `getSubscriptionPlans()` | `GET /subscriptions/plans` | Fetch plans for user's role |
| `getMySubscription()` | `GET /subscriptions/me` | Get current subscription status |
| `subscribeToPlan()` | `POST /subscriptions/subscribe` | Subscribe to a plan |
| `cancelSubscription()` | `POST /subscriptions/cancel` | Cancel current subscription |

## Helper Functions

| Function | Description |
|----------|-------------|
| `parseQuotaError(error)` | Parse a 429 response into quota details |
| `isPremiumRequiredError(error)` | Check if a 403 is a premium-only error |
| `formatVND(amount)` | Format currency in VND |
| `formatPerkValue(key, value)` | Format a perk for display (-1→Unlimited, etc.) |

## Routes

| Route | Layout | Role |
|-------|--------|------|
| `/client/subscription` | ClientDashboardLayout | CLIENT |
| `/broker/subscription` | BrokerDashboardLayout | BROKER |
| `/freelancer/subscription` | FreelancerDashboardLayout | FREELANCER |
