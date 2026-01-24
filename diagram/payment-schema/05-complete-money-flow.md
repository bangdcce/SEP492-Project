# 💰 Complete Money Flow (Tổng Quan Toàn Bộ Hệ Thống)

## High-Level Architecture

```mermaid
graph TB
    subgraph External["🏦 External Systems"]
        Bank[Bank/E-wallet<br/>Vietcombank, Momo, VNPay]
    end

    subgraph InterDev["🌐 InterDev Platform"]
        subgraph Users["👥 Users"]
            Client[Client<br/>Khách hàng]
            Dev[Developer<br/>Nhà phát triển]
            Broker[Broker<br/>Môi giới]
            Admin[Admin<br/>Quản trị viên]
        end

        subgraph Wallets["💳 Wallet System"]
            CW[Client Wallet]
            DW[Dev Wallet]
            BW[Broker Wallet]
            PW[Platform Wallet]
        end

        subgraph Core["⚙️ Core Services"]
            Escrow[Escrow Service<br/>Ký quỹ theo Milestone]
            Transaction[Transaction Service<br/>Quản lý giao dịch]
            Payout[Payout Service<br/>Rút tiền]
            Dispute[Dispute Service<br/>Giải quyết tranh chấp]
        end
    end

    Bank -->|Deposit| CW
    CW -->|Fund Escrow| Escrow
    Escrow -->|Release 85%| DW
    Escrow -->|Release 10%| BW
    Escrow -->|Fee 5%| PW
    Escrow -->|Refund if dispute| CW

    DW -->|Withdrawal| Bank
    BW -->|Withdrawal| Bank

    Admin -.->|Manage| Payout
    Admin -.->|Resolve| Dispute

    style Bank fill:#e1f5ff
    style Escrow fill:#fff3cd
    style Dispute fill:#f8d7da
```

---

## Complete User Journey: From Deposit to Withdrawal

```mermaid
journey
    title Developer Money Journey
    section Project Start
      Find project via Broker: 3: Dev, Broker
      Negotiate contract: 4: Dev, Broker, Client
      Sign contract: 5: Dev, Client
    section Milestone Setup
      Client deposits to wallet: 5: Client
      Client funds escrow: 5: Client
      Escrow locked (100M): 5: Client
    section Work Phase
      Developer builds feature: 4: Dev
      Submit deliverable: 5: Dev
      Client review: 4: Client
    section Release
      Client approves milestone: 5: Client
      Escrow released (85M to Dev): 5: Dev, Broker
      Broker gets commission (10M): 5: Broker
    section Withdrawal
      Developer requests withdrawal: 5: Dev
      Admin approves payout: 4: Admin
      Bank transfer completes: 5: Dev
      Money in bank account: 5: Dev
```

---

## Money Flow Timeline

```mermaid
gantt
    title Typical Project Money Flow (3-month project)
    dateFormat YYYY-MM-DD

    section Client
    Deposit 300M to wallet         :done, deposit, 2026-01-01, 1d
    Fund Milestone 1 Escrow (100M) :done, esc1, 2026-01-05, 1d
    Fund Milestone 2 Escrow (100M) :active, esc2, 2026-02-01, 1d
    Fund Milestone 3 Escrow (100M) :esc3, 2026-03-01, 1d

    section Developer
    Work on Milestone 1            :done, work1, 2026-01-06, 25d
    Submit Milestone 1             :done, sub1, 2026-01-31, 1d
    Receive 85M (M1 released)      :done, pay1, 2026-02-01, 1d
    Work on Milestone 2            :active, work2, 2026-02-02, 25d
    Withdrawal 85M to bank         :done, with1, 2026-02-05, 2d

    section Broker
    Receive 10M commission (M1)    :done, broker1, 2026-02-01, 1d

    section Platform
    Collect 5M fee (M1)            :done, fee1, 2026-02-01, 1d
```

---

## Fund Distribution Breakdown

```mermaid
pie title Milestone 100M VND Distribution
    "Developer" : 85
    "Broker" : 10
    "Platform Fee" : 5
```

---

## System Flow: All Actors

```mermaid
sequenceDiagram
    autonumber
    actor C as Client
    actor D as Developer
    actor B as Broker
    actor A as Admin
    participant SYS as InterDev System
    participant BANK as Bank/E-wallet

    Note over C,BANK: Phase 1: Project Initiation
    B->>C: Introduce Developer
    C->>D: Negotiate contract
    C->>SYS: Create project with 3 milestones

    Note over C,BANK: Phase 2: Funding
    C->>BANK: Initiate deposit 100M
    BANK->>SYS: Confirm payment
    SYS->>C: Wallet balance +100M

    C->>SYS: Fund Milestone 1 (100M)
    SYS->>SYS: Create Escrow (FUNDED)
    SYS->>C: Wallet: balance -100M, held +100M

    Note over C,BANK: Phase 3: Development
    D->>SYS: Work on milestone
    D->>SYS: Submit deliverable
    SYS->>C: Notify for approval
    C->>SYS: Approve milestone

    Note over C,BANK: Phase 4: Release
    SYS->>D: Wallet +85M
    SYS->>B: Wallet +10M
    SYS->>SYS: Platform revenue +5M
    SYS->>C: Wallet: held -100M, totalSpent +100M

    Note over C,BANK: Phase 5: Withdrawal
    D->>SYS: Request withdrawal 85M
    SYS->>A: Payout request pending
    A->>SYS: Approve payout
    SYS->>BANK: Initiate transfer
    BANK->>D: Transfer completed
    SYS->>D: Wallet -85M, totalWithdrawn +85M
```

---

## Wallet Balance States

```mermaid
flowchart TD
    Start[User joins platform] --> Zero[Wallet Balance = 0]

    Zero -->|Deposit| Bal[Available Balance]
    Bal -->|Fund Escrow| Held[Held Balance]
    Bal -->|Request Withdrawal| Pend[Pending Balance]

    Held -->|Milestone Approved| Release[Escrow Released]
    Release --> Bal

    Pend -->|Admin Approve + Bank Transfer| Gone[Money to Bank]
    Pend -->|Rejected/Failed| Bal

    Bal -->|Earn from milestone| Earned[Total Earned ↑]
    Bal -->|Spend on project| Spent[Total Spent ↑]
    Gone --> Withdrawn[Total Withdrawn ↑]

    style Bal fill:#8f8
    style Held fill:#ff8
    style Pend fill:#fc8
    style Gone fill:#ccc
```

### Real Example: Client Journey

```typescript
Initial State:
  balance: 0
  pendingBalance: 0
  heldBalance: 0

After deposit 500M:
  balance: 500,000,000 ✅
  pendingBalance: 0
  heldBalance: 0

After fund Milestone 1 (200M):
  balance: 300,000,000
  pendingBalance: 0
  heldBalance: 200,000,000 🔒

After milestone approved (funds distributed):
  balance: 300,000,000
  pendingBalance: 0
  heldBalance: 0
  totalSpent: 200,000,000
```

### Real Example: Developer Journey

```typescript
Initial State:
  balance: 0
  pendingBalance: 0
  heldBalance: 0

After Milestone 1 released (170M = 200M * 85%):
  balance: 170,000,000 💰
  pendingBalance: 0
  heldBalance: 0
  totalEarned: 170,000,000

After withdrawal request 170M:
  balance: 0
  pendingBalance: 170,000,000 ⏳
  heldBalance: 0

After withdrawal completed:
  balance: 0
  pendingBalance: 0
  heldBalance: 0
  totalWithdrawn: 170,000,000 🏦
```

---

## Error & Edge Cases

```mermaid
flowchart TD
    Start[Money Flow] --> Check1{Sufficient balance?}
    Check1 -->|No| E1[Error: Insufficient funds]
    Check1 -->|Yes| Check2{Escrow funded?}

    Check2 -->|No| E2[Error: Escrow not funded]
    Check2 -->|Yes| Check3{Milestone completed?}

    Check3 -->|No| Wait[Wait for completion]
    Check3 -->|Yes| Check4{Client approved?}

    Check4 -->|No| Pending[Pending approval]
    Check4 -->|Yes| Check5{Dispute active?}

    Check5 -->|Yes| Freeze[Funds frozen, awaiting admin]
    Check5 -->|No| Release[Release funds]

    Release --> Success[Distribution successful]

    Freeze --> AdminResolve[Admin resolves]
    AdminResolve --> Success

    style E1 fill:#f88
    style E2 fill:#f88
    style Success fill:#8f8
```

---

## Transaction Types Overview

```mermaid
graph LR
    subgraph In["⬇️ Money In"]
        DEP[DEPOSIT<br/>Nạp tiền]
        REL[ESCROW_RELEASE<br/>Nhận từ escrow]
        REF[REFUND<br/>Hoàn tiền]
    end

    subgraph Out["⬆️ Money Out"]
        WITH[WITHDRAWAL<br/>Rút tiền]
        HOLD[ESCROW_HOLD<br/>Ký quỹ]
        FEE[FEE_DEDUCTION<br/>Trừ phí]
    end

    subgraph Wallet["💳 User Wallet"]
        BAL[Balance]
    end

    DEP --> BAL
    REL --> BAL
    REF --> BAL

    BAL --> WITH
    BAL --> HOLD
    BAL --> FEE

    style DEP fill:#8f8
    style REL fill:#8f8
    style REF fill:#8f8
    style WITH fill:#f88
    style HOLD fill:#f88
    style FEE fill:#fc8
```

---

## Platform Revenue Model

```mermaid
flowchart LR
    A[All Projects] --> B[Milestone Payments]
    B --> C{5% Platform Fee}

    C --> D[Platform Wallet]

    D --> E[Operating Costs]
    D --> F[Marketing]
    D --> G[Development]
    D --> H[Profit]

    style C fill:#ff8
    style D fill:#8f8
```

### Revenue Calculation Example

```
Month: January 2026
Total Milestones Released: 50
Average Milestone Value: 100,000,000 VND

Total Project Value: 5,000,000,000 VND (5 billion)
Platform Revenue (5%): 250,000,000 VND (250 million)

Distribution:
- Developers (85%): 4,250,000,000 VND
- Brokers (10%): 500,000,000 VND
- Platform (5%): 250,000,000 VND
```

---

## Security & Compliance

```mermaid
mindmap
  root((Payment Security))
    Transaction Atomicity
      Database transactions
      Rollback on failure
      Idempotency keys
    Balance Validation
      Check before deduct
      Lock wallet during transaction
      Verify after commit
    Audit Trail
      Every transaction logged
      Immutable records
      Admin action tracking
    Compliance
      Anti-money laundering
      KYC for large withdrawals
      Transaction limits
    Fraud Prevention
      Velocity checks
      Anomaly detection
      Admin approval for large amounts
```

---

## Key Metrics to Track

| Metric                            | Description                    | Formula                             |
| --------------------------------- | ------------------------------ | ----------------------------------- |
| **GMV** (Gross Merchandise Value) | Tổng giá trị giao dịch         | Sum of all milestone values         |
| **Platform Revenue**              | Doanh thu platform             | GMV × 5%                            |
| **Avg. Project Value**            | Giá trị trung bình mỗi project | Total project value / Project count |
| **Withdrawal Rate**               | Tỷ lệ rút tiền                 | Withdrawn / Earned                  |
| **Dispute Rate**                  | Tỷ lệ tranh chấp               | Disputes / Total milestones         |
| **Escrow Locked**                 | Tổng tiền đang ký quỹ          | Sum of FUNDED escrows               |

---

## System Health Checks

```mermaid
flowchart TD
    Health[System Health Check] --> Check1[Sum all user balances]
    Check1 --> Check2[Sum all escrow fundedAmount]
    Check2 --> Check3[Sum platform revenue]
    Check3 --> Total[Total = Bank deposits - Withdrawals]

    Total --> Verify{Balance matches?}
    Verify -->|Yes| OK[✅ System healthy]
    Verify -->|No| Alert[🚨 Alert: Discrepancy detected]

    Alert --> Audit[Run full audit]

    style OK fill:#8f8
    style Alert fill:#f88
```

**Integrity Formula:**

```
User Wallets (balance + pending + held)
+ Platform Revenue
+ Total Withdrawn
= Total Deposited
```
