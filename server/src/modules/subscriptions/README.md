# Subscriptions Module

## Overview

This module implements the premium subscription system for InterDev (UC-39, UC-40, UC-41).

It provides a **freemium model** with one PREMIUM tier per role (Client, Broker, Freelancer) at **99K VND/month**.

## Architecture

```
subscriptions/
├── dto/
│   └── subscription.dto.ts        # Request/Response DTOs
├── subscriptions.module.ts        # NestJS module definition
├── subscriptions.service.ts       # Core subscription logic
├── subscriptions.controller.ts    # REST API endpoints
├── quota.service.ts               # Free-tier limit enforcement
├── subscription.guard.ts          # PremiumGuard (boolean gate)
└── README.md                      # This file
```

## API Endpoints

| Method | Path | UC | Description |
|--------|------|-----|-------------|
| `GET` | `/subscriptions/plans` | — | List plans for user's role |
| `GET` | `/subscriptions/me` | UC-39 | View current subscription |
| `POST` | `/subscriptions/subscribe` | UC-40 | Subscribe to a plan |
| `POST` | `/subscriptions/cancel` | UC-41 | Cancel subscription |

## Database Tables

- `subscription_plans` — Available plans with perks per role
- `user_subscriptions` — User subscription records
- `quota_usage_logs` — Daily/weekly quota tracking

## Quota Enforcement

Two patterns are used:

### PremiumGuard (boolean gate)
For features completely locked behind premium:
```typescript
@UseGuards(JwtAuthGuard, PremiumGuard)
@Get('client-budget')
async viewClientBudget() { ... }
```

### QuotaService (count-based limits)
For features with free limits:
```typescript
await this.quotaService.checkQuota(userId, QuotaAction.CREATE_REQUEST);
```

## Free-Tier Limits

### Client
| Action | Free | Premium |
|--------|------|---------|
| Active requests | 2 | Unlimited |
| Active projects | 1 | Unlimited |
| AI matches/day | 1 | Unlimited |
| Candidates shown | 3 | 10 |
| Invites/request | 3 | 15 |

### Broker
| Action | Free | Premium |
|--------|------|---------|
| Apply to requests | 3/week | Unlimited |
| Active proposals | 3 | 15 |
| Commission rate | 15% | 10% |
| View client budget | ❌ | ✅ |
| Featured profile | ❌ | ✅ |

### Freelancer
| Action | Free | Premium |
|--------|------|---------|
| Apply to projects | 5/week | Unlimited |
| Portfolio slots | 3 | 10 |
| CV highlighted | ❌ | ✅ |
| Featured profile | ❌ | ✅ |

## Pricing

| Cycle | Price | Discount |
|-------|-------|----------|
| Monthly | 99,000 VND | — |
| Quarterly | 252,000 VND | 15% off |
| Yearly | 832,000 VND | 30% off |

## Soft Cancel Logic

When a user cancels (UC-41):
1. `cancelAtPeriodEnd` is set to `true`
2. Status changes to `CANCELLED`
3. Premium perks remain active until `currentPeriodEnd`
4. A cron job expires subscriptions after the period ends

## Integration with Other Modules

Import `SubscriptionsModule` in any module that needs quota enforcement:

```typescript
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
})
export class ProjectRequestsModule {}
```
