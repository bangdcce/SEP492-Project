# ⚖️ Dispute Resolution Flow (Tranh Chấp)

## Tổng quan Dispute Lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN: User raise dispute
    OPEN --> IN_MEDIATION: Admin start review
    IN_MEDIATION --> RESOLVED: Admin makes decision
    OPEN --> REJECTED: Invalid dispute

    RESOLVED --> [*]
    REJECTED --> [*]

    note right of OPEN
        Escrow status → DISPUTED
        Freeze escrow funds
    end note

    note right of RESOLVED
        Execute based on result:
        - WIN_CLIENT: Refund
        - WIN_FREELANCER: Release
        - SPLIT: Partial distribution
    end note
```

---

## 1. Raise Dispute (User Flow)

```mermaid
sequenceDiagram
    actor User as Client/Dev
    participant UI as Portal
    participant API as Backend API
    participant Dispute as Dispute Service
    participant Escrow as Escrow Service
    participant Notify as Notification Service
    participant DB as Database

    User->>UI: Click "Raise Dispute" on milestone
    UI->>User: Show dispute form
    User->>UI: Fill reason + Upload evidence

    UI->>API: POST /disputes/raise
    Note over API: Body: { milestoneId, reason,<br/>evidence: [urls] }

    API->>Dispute: raiseDispute(data)

    Dispute->>DB: Get Milestone + Escrow
    Dispute->>DB: Validate: Escrow.status = FUNDED

    Dispute->>DB: Identify defendant
    Note over Dispute: If raiser = Client → defendant = Dev<br/>If raiser = Dev → defendant = Client

    Dispute->>DB: BEGIN TRANSACTION

    Dispute->>DB: Insert Dispute Record
    Note over DB: status = OPEN<br/>result = PENDING<br/>evidence = [urls]

    Dispute->>DB: Update Escrow:<br/>status = DISPUTED<br/>disputeId = dispute.id

    Dispute->>DB: COMMIT

    Dispute->>Notify: Notify defendant
    Dispute->>Notify: Notify admin team

    Dispute-->>API: Dispute created
    API-->>UI: "Dispute submitted successfully"
    UI->>User: Show dispute details + tracking
```

---

## 2. Admin Resolution Flow

```mermaid
sequenceDiagram
    actor Admin
    participant AdminUI as Admin Portal
    participant API as Backend API
    participant Dispute as Dispute Service
    participant Escrow as Escrow Service
    participant Wallet as Wallet Service
    participant DB as Database

    Admin->>AdminUI: Open dispute case
    AdminUI->>API: GET /admin/disputes/{id}
    API-->>AdminUI: Dispute details + evidence

    Note over Admin: Review evidence<br/>Contact parties if needed

    Admin->>AdminUI: Make decision + Add comment
    Note over AdminUI: Select result:<br/>WIN_CLIENT / WIN_FREELANCER / SPLIT

    AdminUI->>API: POST /admin/disputes/{id}/resolve
    API->>Dispute: resolveDispute(id, result, comment)

    Dispute->>DB: Get Dispute + Escrow

    alt Result = WIN_CLIENT (Refund)
        Dispute->>Escrow: refundEscrow(escrowId)
        Escrow->>Wallet: Refund to Client
        Note over Wallet: clientWallet.balance += totalAmount<br/>clientWallet.heldBalance -= totalAmount
        Escrow->>DB: Update Escrow: status=REFUNDED

    else Result = WIN_FREELANCER (Release)
        Dispute->>Escrow: releaseEscrow(escrowId)
        Escrow->>Wallet: Distribute funds (85-10-5)
        Note over Wallet: Dev +85%, Broker +10%,<br/>Platform +5%
        Escrow->>DB: Update Escrow: status=RELEASED

    else Result = SPLIT (Partial)
        Note over Dispute: Custom logic:<br/>E.g. 60% to Dev, 40% to Client
        Dispute->>Wallet: Custom distribution
        Escrow->>DB: Update Escrow: status=RELEASED
    end

    Dispute->>DB: Update Dispute:<br/>status=RESOLVED<br/>result=decision<br/>resolvedById=adminId<br/>resolvedAt=NOW()

    Dispute-->>API: Resolution completed
    API->>AdminUI: Success
    API->>Notify: Notify both parties
```

---

## 3. Decision Matrix

```mermaid
flowchart TD
    Start[Dispute Raised] --> Review[Admin Review Evidence]

    Review --> Assess{Assessment}

    Assess -->|Client right| WinClient[WIN_CLIENT]
    Assess -->|Dev right| WinDev[WIN_FREELANCER]
    Assess -->|Both partial blame| Split[SPLIT]
    Assess -->|Frivolous claim| Reject[REJECTED]

    WinClient --> Refund[Full Refund to Client]
    WinDev --> Release[Full Release to Dev+Broker]
    Split --> Custom[Custom Distribution]
    Reject --> NoAction[No Fund Movement]

    Refund --> ClientWallet[Client Wallet +100%]
    Release --> DevWallet[Dev +85%, Broker +10%]
    Custom --> Partial[E.g. Dev +60%, Client +40%]

    ClientWallet --> CloseCase[Close Dispute]
    DevWallet --> CloseCase
    Partial --> CloseCase
    NoAction --> CloseCase

    style WinClient fill:#88f
    style WinDev fill:#8f8
    style Split fill:#ff8
    style Reject fill:#f88
```

---

## 4. Common Dispute Scenarios

### Scenario A: Milestone Not Delivered

```mermaid
graph LR
    A[Client: Work not delivered] --> B[Evidence: Empty deliverable]
    B --> C[Admin: Check submission]
    C --> D{Work exists?}
    D -->|No| E[WIN_CLIENT<br/>Refund 100%]
    D -->|Partial| F[SPLIT<br/>60% Client, 40% Dev]
    D -->|Yes but poor quality| G[Subjective: Review contract]
```

### Scenario B: Client Won't Approve

```mermaid
graph LR
    A[Dev: Client refuses to approve] --> B[Evidence: Deliverable screenshots]
    B --> C[Admin: Compare with contract]
    C --> D{Meets requirements?}
    D -->|Yes| E[WIN_FREELANCER<br/>Release funds]
    D -->|No| F[WIN_CLIENT<br/>Refund]
    D -->|Mostly yes| G[SPLIT<br/>80% Dev, 20% Client]
```

### Scenario C: Scope Creep

```mermaid
graph LR
    A[Dev: Client added features] --> B[Evidence: Chat logs]
    B --> C[Admin: Check original contract]
    C --> D{Extra work proven?}
    D -->|Yes, significant| E[Create addendum milestone]
    D -->|Minor changes| F[WIN_FREELANCER but warn Client]
    D -->|No proof| G[Release original amount]
```

---

## 5. Escrow State Changes

```mermaid
stateDiagram-v2
    FUNDED --> DISPUTED: Dispute raised
    DISPUTED --> RELEASED: Admin: WIN_FREELANCER
    DISPUTED --> REFUNDED: Admin: WIN_CLIENT
    DISPUTED --> RELEASED: Admin: SPLIT (with custom amounts)
    DISPUTED --> FUNDED: Admin: REJECTED (revert)

    note right of DISPUTED
        Funds frozen:
        - No changes allowed
        - Only admin can act
        - Both parties notified
    end note

    note left of RELEASED
        Distribution executed:
        - Dev wallet updated
        - Broker wallet updated
        - Client heldBalance reduced
    end note

    note left of REFUNDED
        Full refund:
        - Client balance restored
        - Client heldBalance reduced
        - No distribution
    end note
```

---

## Database Records

### Dispute Record

```typescript
{
  id: "dispute-uuid",
  projectId: "project-uuid",
  milestoneId: "milestone-uuid",

  raisedById: "client-uuid",
  defendantId: "dev-uuid",

  reason: "Developer did not deliver the mobile app as specified in contract. Only web version was delivered.",
  evidence: [
    "https://storage.interdev.com/disputes/screenshot1.png",
    "https://storage.interdev.com/disputes/contract.pdf"
  ],

  status: "RESOLVED",
  result: "WIN_CLIENT",

  adminComment: "Reviewed contract and deliverables. Mobile app requirement was clearly stated but not delivered. Full refund approved.",

  resolvedById: "admin-uuid",
  resolvedAt: "2026-01-08T17:00:00Z",
  createdAt: "2026-01-08T16:00:00Z"
}
```

### Linked Escrow Update

```typescript
Before Dispute:
{
  status: "FUNDED",
  disputeId: null
}

During Dispute:
{
  status: "DISPUTED",
  disputeId: "dispute-uuid"
}

After Resolution (WIN_CLIENT):
{
  status: "REFUNDED",
  disputeId: "dispute-uuid",
  refundedAt: "2026-01-08T17:00:00Z"
}
```

---

## Admin Resolution Checklist

```mermaid
flowchart TD
    Start[New Dispute] --> Step1[Review contract terms]
    Step1 --> Step2[Check deliverable quality]
    Step2 --> Step3[Review evidence from both parties]
    Step3 --> Step4[Check communication history]
    Step4 --> Step5[Consult platform policies]

    Step5 --> Decision{Make Decision}

    Decision --> Doc[Document reasoning]
    Doc --> Notify[Notify both parties]
    Notify --> Execute[Execute fund movement]
    Execute --> Close[Close case]

    Close --> Archive[Archive for future reference]
```

### Admin Tools

- 📄 Contract viewer
- 💬 Full chat history
- 📁 Deliverable comparison tool
- 📊 User trust score/history
- 🕒 Timeline visualization
- 📸 Evidence viewer

---

## Notifications

### To Defendant (when dispute raised)

> ⚠️ **Dispute Raised**  
> {Raiser} has raised a dispute on milestone "{Milestone Name}".  
> Reason: {Dispute Reason}  
> You have 48 hours to submit your response and evidence.

### To Both Parties (when resolved)

> ✅ **Dispute Resolved**  
> Admin decision: {Result}  
> Reason: {Admin Comment}  
> Funds have been {refunded/released} accordingly.
