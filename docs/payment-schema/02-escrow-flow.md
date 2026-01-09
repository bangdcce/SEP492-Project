# 🔒 Escrow Flow (Ký Quỹ & Giải Ngân)

## Tổng quan Escrow Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Milestone created
    PENDING --> FUNDED: Client fund escrow
    FUNDED --> RELEASED: Client approve + Milestone complete
    FUNDED --> DISPUTED: Raise dispute
    FUNDED --> REFUNDED: Cancel milestone

    DISPUTED --> RELEASED: Admin resolve (WIN_FREELANCER)
    DISPUTED --> REFUNDED: Admin resolve (WIN_CLIENT)

    RELEASED --> [*]
    REFUNDED --> [*]

    note left of FUNDED
        Client wallet:
        - balance -= amount
        - heldBalance += amount
    end note

    note right of RELEASED
        Distribution:
        - Dev: 85%
        - Broker: 10%
        - Platform: 5%
    end note
```

---

## 1. Escrow HOLD (Client Fund Milestone)

```mermaid
sequenceDiagram
    actor Client
    participant UI as Client Portal
    participant API as Backend API
    participant Escrow as Escrow Service
    participant Wallet as Wallet Service
    participant DB as Database

    Client->>UI: Click "Fund Milestone"
    UI->>Client: Show milestone details & amount
    Client->>UI: Confirm funding

    UI->>API: POST /escrow/fund/{milestoneId}
    API->>Escrow: fundEscrow(milestoneId, clientId)

    Escrow->>DB: Get Milestone (amount, project, dev, broker)
    Escrow->>DB: Get FeeConfig (platform %, broker %)

    Escrow->>Escrow: Calculate distribution:<br/>- devShare = 85%<br/>- brokerShare = 10%<br/>- platformFee = 5%

    Escrow->>Wallet: checkBalance(clientWallet, totalAmount)
    Wallet-->>Escrow: Balance OK

    Escrow->>DB: BEGIN TRANSACTION

    Escrow->>DB: Insert Escrow Record
    Note over DB: totalAmount, devShare,<br/>brokerShare, platformFee,<br/>status=PENDING

    Escrow->>DB: Insert Transaction(ESCROW_HOLD)

    Escrow->>DB: Update Client Wallet:<br/>balance -= amount<br/>heldBalance += amount

    Escrow->>DB: Update Escrow:<br/>status=FUNDED<br/>fundedAt=NOW()

    Escrow->>DB: COMMIT

    Escrow-->>API: Escrow funded successfully
    API-->>UI: Success response
    UI->>Client: Show "Milestone funded"
```

---

## 2. Escrow RELEASE (Giải Ngân)

```mermaid
sequenceDiagram
    actor Dev as Developer
    actor Client
    participant API as Backend API
    participant Escrow as Escrow Service
    participant Wallet as Wallet Service
    participant DB as Database

    Dev->>API: Mark milestone as COMPLETED
    API->>Client: Notify for approval

    Client->>API: POST /milestone/{id}/approve
    API->>Escrow: releaseEscrow(milestoneId)

    Escrow->>DB: Get Escrow (FUNDED, clientApproved=false)
    Escrow->>DB: Check milestone status = COMPLETED

    Escrow->>DB: BEGIN TRANSACTION

    Note over Escrow: Example: 100M VND<br/>Dev: 85M, Broker: 10M, Platform: 5M

    Escrow->>DB: Insert Transaction(ESCROW_RELEASE, Dev Wallet, 85M)
    Escrow->>DB: devWallet.balance += 85M<br/>devWallet.totalEarned += 85M

    Escrow->>DB: Insert Transaction(ESCROW_RELEASE, Broker Wallet, 10M)
    Escrow->>DB: brokerWallet.balance += 10M<br/>brokerWallet.totalEarned += 10M

    Escrow->>DB: Insert Transaction(FEE_DEDUCTION, Platform, 5M)
    Note over DB: Track platform revenue

    Escrow->>DB: Update Client Wallet:<br/>heldBalance -= 100M<br/>totalSpent += 100M

    Escrow->>DB: Update Escrow:<br/>status=RELEASED<br/>releasedAmount=100M<br/>releasedAt=NOW()

    Escrow->>DB: Update Milestone: status=PAID

    Escrow->>DB: COMMIT

    Escrow-->>API: Release completed
    API->>Dev: Notify "Payment received"
    API->>Client: Notify "Payment released"
```

---

## 3. Money Distribution Flowchart

```mermaid
flowchart LR
    A[Escrow: 100M VND] --> B{Release Decision}

    B -->|Client Approve| C[Distribution]
    B -->|Dispute| D[Admin Review]

    C --> E[Dev Wallet<br/>+85M VND<br/>85%]
    C --> F[Broker Wallet<br/>+10M VND<br/>10%]
    C --> G[Platform Revenue<br/>+5M VND<br/>5%]

    D --> H{Admin Decision}
    H -->|WIN_FREELANCER| C
    H -->|WIN_CLIENT| I[Refund to Client]
    H -->|SPLIT| J[Partial Release]

    I --> K[Client Wallet<br/>+100M VND]

    style E fill:#8f8
    style F fill:#8f8
    style G fill:#ff8
    style K fill:#88f
```

---

## Database Records Example

### Escrow Record

```typescript
{
  id: "escrow-uuid",
  projectId: "project-uuid",
  milestoneId: "milestone-uuid",
  totalAmount: 100000000,
  fundedAmount: 100000000,
  releasedAmount: 100000000,

  // Snapshot (immutable)
  developerShare: 85000000,
  brokerShare: 10000000,
  platformFee: 5000000,
  developerPercentage: 85,
  brokerPercentage: 10,
  platformPercentage: 5,

  status: "RELEASED",
  clientApproved: true,
  clientApprovedAt: "2026-01-08T14:00:00Z",
  fundedAt: "2026-01-08T10:00:00Z",
  releasedAt: "2026-01-08T14:00:00Z"
}
```

### Generated Transactions

```typescript
// 1. Hold transaction
{
  type: "ESCROW_HOLD",
  walletId: "client-wallet",
  amount: -100000000,
  referenceType: "Escrow",
  referenceId: "escrow-uuid"
}

// 2. Release to Dev
{
  type: "ESCROW_RELEASE",
  walletId: "dev-wallet",
  amount: 85000000,
  referenceType: "Escrow",
  referenceId: "escrow-uuid"
}

// 3. Release to Broker
{
  type: "ESCROW_RELEASE",
  walletId: "broker-wallet",
  amount: 10000000,
  referenceType: "Escrow",
  referenceId: "escrow-uuid"
}

// 4. Platform fee
{
  type: "FEE_DEDUCTION",
  walletId: "platform-wallet",
  amount: 5000000,
  referenceType: "Escrow",
  referenceId: "escrow-uuid"
}
```
