# 💸 Withdrawal Flow (Rút Tiền)

## Luồng rút tiền từ Wallet về Bank Account

```mermaid
sequenceDiagram
    actor User as Dev/Broker
    participant UI as User Portal
    participant API as Backend API
    participant Payout as Payout Service
    participant Wallet as Wallet Service
    participant Admin as Admin Portal
    participant Bank as Bank Transfer API
    participant DB as Database

    User->>UI: Click "Rút tiền"
    UI->>User: Show available balance
    User->>UI: Enter amount + Select bank account

    UI->>API: POST /payout/request
    API->>Payout: createPayoutRequest()

    Payout->>Wallet: checkBalance(userId, amount)
    Wallet-->>Payout: Balance sufficient

    Payout->>DB: Get PayoutMethod (bank info)
    Payout->>DB: Check min/max withdrawal limits

    Payout->>DB: BEGIN TRANSACTION
    Payout->>DB: Insert PayoutRequest(PENDING)
    Payout->>DB: Insert Transaction(WITHDRAWAL, PENDING)
    Payout->>DB: wallet.balance -= amount<br/>wallet.pendingBalance += amount
    Payout->>DB: COMMIT

    Payout-->>API: Payout request created
    API-->>UI: "Request submitted, awaiting approval"

    Note over Admin: Admin reviews payout request

    Admin->>API: POST /admin/payout/{id}/approve
    API->>Payout: approvePayoutRequest(id, adminId)

    Payout->>DB: Update PayoutRequest(APPROVED)
    Payout->>DB: Update Transaction(PROCESSING)

    Payout->>Bank: transferFunds(bankInfo, amount)
    Bank-->>Payout: Transfer initiated (bankTxnId)

    Note over Bank: Bank processes transfer<br/>(1-24 hours)

    Bank->>API: Webhook: Transfer completed
    API->>Payout: completePayoutRequest()

    Payout->>DB: BEGIN TRANSACTION
    Payout->>DB: Update PayoutRequest(COMPLETED)
    Payout->>DB: Update Transaction(COMPLETED, completedAt)
    Payout->>DB: wallet.pendingBalance -= amount<br/>wallet.totalWithdrawn += amount
    Payout->>DB: COMMIT

    Payout-->>API: Payout completed
    API->>User: Notify "Withdrawal successful"
```

---

## State Diagram: PayoutRequest

```mermaid
stateDiagram-v2
    [*] --> PENDING: User request withdrawal
    PENDING --> APPROVED: Admin approve
    PENDING --> REJECTED: Admin reject

    APPROVED --> PROCESSING: Bank transfer initiated
    PROCESSING --> COMPLETED: Bank confirms
    PROCESSING --> FAILED: Bank error

    REJECTED --> [*]: Refund to balance
    FAILED --> [*]: Refund to balance
    COMPLETED --> [*]

    note right of PENDING
        Wallet:
        - balance -= amount
        - pendingBalance += amount
    end note

    note right of COMPLETED
        Wallet:
        - pendingBalance -= amount
        - totalWithdrawn += amount
    end note

    note left of REJECTED
        Wallet:
        - balance += amount
        - pendingBalance -= amount
    end note
```

---

## Admin Review Flow

```mermaid
flowchart TD
    Start[New Payout Request] --> Queue[Admin Review Queue]

    Queue --> AdminCheck{Admin Decision}

    AdminCheck -->|Approve| Verify[Verify Bank Info]
    AdminCheck -->|Reject| Reject[Reject Request]

    Verify --> Valid{Info Valid?}
    Valid -->|Yes| InitBank[Initiate Bank Transfer]
    Valid -->|No| ContactUser[Contact User]

    InitBank --> BankAPI[Call Bank Transfer API]
    BankAPI --> Track[Track Transfer Status]

    Track --> BankDone{Bank Status}
    BankDone -->|Success| Complete[Mark COMPLETED]
    BankDone -->|Failed| BankFail[Mark FAILED, Refund]

    Reject --> RefundRej[Refund to Wallet]
    ContactUser --> Queue

    style Complete fill:#8f8
    style BankFail fill:#f88
    style Reject fill:#f88
```

---

## Wallet Balance States

```mermaid
flowchart LR
    A[Total Balance] --> B[Available Balance]
    A --> C[Pending Balance]
    A --> D[Held Balance]

    B -->|Withdraw Request| C
    C -->|Admin Approve + Bank Transfer| E[Bank Account]
    C -->|Rejected/Failed| B

    D -->|Escrow Release| B
    B -->|New Withdrawal| C

    style B fill:#8f8
    style C fill:#ff8
    style D fill:#f88
```

### Example Calculation

```typescript
Before Withdrawal Request:
  balance: 50,000,000 (available to withdraw)
  pendingBalance: 0
  heldBalance: 20,000,000 (in active escrows)
  totalBalance: 70,000,000

User requests withdraw 30M:
  balance: 20,000,000 (-30M)
  pendingBalance: 30,000,000 (+30M)
  heldBalance: 20,000,000
  totalBalance: 70,000,000 (unchanged)

After withdrawal completed:
  balance: 20,000,000
  pendingBalance: 0 (-30M)
  heldBalance: 20,000,000
  totalBalance: 40,000,000 (-30M)
  totalWithdrawn: 30,000,000
```

---

## Database Models

### PayoutRequest

```typescript
{
  id: "payout-uuid",
  userId: "user-uuid",
  payoutMethodId: "bank-uuid",
  amount: 30000000,
  fee: 0,
  netAmount: 30000000,
  status: "COMPLETED",

  // Bank info snapshot
  bankName: "Vietcombank",
  accountNumber: "1234567890",
  accountHolderName: "NGUYEN VAN A",

  // Admin tracking
  approvedBy: "admin-uuid",
  approvedAt: "2026-01-08T15:00:00Z",

  // Bank tracking
  externalTransactionId: "BANK_TXN_999",
  completedAt: "2026-01-08T16:30:00Z",

  notes: "Monthly withdrawal",
  createdAt: "2026-01-08T14:00:00Z"
}
```

### PayoutMethod (Bank Account)

```typescript
{
  id: "bank-uuid",
  userId: "user-uuid",
  bankName: "Vietcombank",
  bankCode: "VCB",
  accountNumber: "1234567890",
  accountHolderName: "NGUYEN VAN A",
  branchName: "VCB Ha Noi",
  isDefault: true,
  isVerified: true,
  verifiedAt: "2025-12-01T10:00:00Z"
}
```

---

## Error Handling

### Common Rejection Reasons

- ❌ Insufficient balance
- ❌ Bank info mismatch (name vs ID)
- ❌ Suspicious activity pattern
- ❌ Account not verified
- ❌ Amount below minimum (100,000 VND)
- ❌ Amount above daily limit

### Failed Transfer Recovery

```mermaid
flowchart TD
    Failed[Bank Transfer Failed] --> Check{Root Cause?}

    Check -->|Invalid Bank Info| UpdateInfo[Ask user update bank info]
    Check -->|Bank System Error| Retry[Retry after 1 hour]
    Check -->|Insufficient Funds| Alert[Alert Admin]
    Check -->|Unknown| Manual[Manual Investigation]

    UpdateInfo --> Resubmit[User resubmit]
    Retry --> Success{Retry Success?}
    Success -->|Yes| Complete[Mark COMPLETED]
    Success -->|No| Manual

    Manual --> AdminDecide{Admin Decision}
    AdminDecide -->|Retry| Retry
    AdminDecide -->|Refund| Refund[Refund to Wallet]
```
