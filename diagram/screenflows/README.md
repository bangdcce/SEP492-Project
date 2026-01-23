# 🎯 InterDev Platform Screenflows

> Screenflow diagrams cho 3 actors chính: **Admin**, **Client**, và **Freelancer/Broker**

---

## 📊 Tổng Quan

InterDev là platform kết nối Client - Broker - Freelancer với escrow-based payment.

### Actors

| Actor          | Vai trò       | Chức năng chính                                                    |
| -------------- | ------------- | ------------------------------------------------------------------ |
| **Admin**      | Quản trị viên | Quản lý disputes, users, payouts, system settings                  |
| **Client**     | Khách hàng    | Tạo project, fund escrow, approve milestones                       |
| **Freelancer** | Developer     | Browse projects, submit proposals, deliver work, withdraw earnings |
| **Broker**     | Môi giới      | Giống Freelancer + tạo project cho client, nhận 10% commission     |

---

## 🔄 Screenflows

### 1. Admin Screenflow

![Admin Screenflow](./admin_screenflow_1767854893068.png)

**Main Features:**

- **Audit Logs** - Xem hoạt động user
- **Manage Disputes** - Review evidence → Make decision (Approve/Reject/Refund)
- **Manage Users** - Suspend/Ban users, Add warnings
- **Manage Projects** - Monitor milestones
- **Payout Approvals** - Approve/Reject withdrawal requests
- **System Settings** - Update platform fee %

**Key Actions:**

1. Login → Admin Dashboard
2. View Audit Logs để monitor activities
3. Review Disputes → Make decisions
4. Approve/Reject payouts
5. Configure system settings

---

### 2. Client Screenflow

![Client Screenflow](./client_screenflow_1767854922325.png)

**Main Features:**

- **Wizard** - Tạo project qua 5 bước (Type → Requirements → Budget → Timeline → Review)
- **My Projects** - Quản lý các project
- **Escrow Funding** - Fund escrow cho từng milestone
- **Review & Approve** - Review deliverables và approve payment
- **Dispute Management** - Raise dispute nếu cần
- **My Requests** - Xem và accept proposals

**User Journey:**

```
Login → Dashboard
  ↓
Create Project (Wizard: 5 steps) → Project Created
  ↓
View My Projects → Project Details → Milestone List
  ↓
Fund Escrow → Payment Processing → Escrow Funded
  ↓
Developer submits work
  ↓
Review Deliverable → Approve Milestone → Funds Released (85% Dev, 10% Broker, 5% Platform)
```

**Alternative Paths:**

- Browse Freelancers → View Profile → Save to Favorites
- My Requests → View Proposals → Accept → Create Contract
- Raise Dispute → Upload Evidence → Wait Admin Decision

---

### 3. Freelancer & Broker Screenflow (Shared)

![Freelancer Broker Screenflow](./freelancer_broker_screenflow_1767854948607.png)

**Main Features:**

- **Browse Projects** - Tìm project phù hợp
- **Submit Proposals** - Gửi proposal cho client
- **My Projects** - Quản lý active projects
- **Milestone Management** - Upload deliverables, submit for review
- **Wallet** - Xem balance, transaction history
- **Withdrawal** - Rút tiền về bank account
- **Profile** - Trust score, reviews, portfolio
- **Broker Unique:** Create Project for Client

**User Journey:**

```
Login → Dashboard
  ↓
Browse Projects/Requests → View Details → Submit Proposal
  ↓
Proposal Accepted
  ↓
My Projects → Active Projects → Project Details → Milestone List
  ↓
Upload Deliverable → Submit for Review → Wait Client Approval
  ↓ (Approved)
Payment Received → Wallet Updated (+85M Dev hoặc +10M Broker)
  ↓
My Wallet → Request Withdrawal → Enter Amount & Bank Info
  ↓
Submit to Admin → Pending Approval → Money Transferred
```

**Alternative Paths:**

- Client Raises Dispute → Submit Response → Wait Admin Decision
- My Profile → Trust Score → Reviews → Portfolio
- (Broker only) Create Project for Client → Add Milestones → Invite Developer

---

## 💰 Payment Flow Integration

Các screenflows trên tích hợp với payment system:

| Màn hình              | Payment Action              | Entity liên quan                        |
| --------------------- | --------------------------- | --------------------------------------- |
| Fund Escrow           | Client wallet → Escrow      | `Wallet`, `Escrow`, `Transaction`       |
| Approve Milestone     | Escrow → Dev/Broker wallets | `Escrow`, `Transaction`, `PlatformFee`  |
| Request Withdrawal    | Wallet → Pending → Bank     | `Wallet`, `Withdrawal`, `PayoutMethod`  |
| Admin Approve Payout  | Pending → Completed         | `Withdrawal` status update              |
| Raise Dispute         | Freeze escrow               | `Dispute`, `Escrow` (status → DISPUTED) |
| Admin Resolve Dispute | Refund or Release           | `Dispute`, `Escrow`, `Transaction`      |

---

## 🎨 Shared Features (Tất cả roles)

### Common Screens:

- **Login/Register** - Authentication
- **Dashboard** - Role-specific dashboard
- **Profile** - User profile, trust score
- **Notifications** - Real-time updates
- **Settings** - Account settings

### Permission Matrix:

| Feature                 | Admin | Client | Freelancer | Broker |
| ----------------------- | ----- | ------ | ---------- | ------ |
| Create Project (Wizard) | ❌    | ✅     | ❌         | ✅     |
| Browse Projects         | ❌    | ✅     | ✅         | ✅     |
| Submit Proposal         | ❌    | ❌     | ✅         | ✅     |
| Fund Escrow             | ❌    | ✅     | ❌         | ❌     |
| Upload Deliverable      | ❌    | ❌     | ✅         | ✅     |
| Approve Milestone       | ❌    | ✅     | ❌         | ❌     |
| Request Withdrawal      | ❌    | ❌     | ✅         | ✅     |
| Approve Payout          | ✅    | ❌     | ❌         | ❌     |
| Manage Disputes         | ✅    | ❌     | ❌         | ❌     |
| Raise Dispute           | ❌    | ✅     | ✅         | ✅     |
| Audit Logs              | ✅    | ❌     | ❌         | ❌     |

---

## 🔍 Feature Details

### Client: Create Project Wizard (5 steps)

**Step 1: Project Type**

- Choose project category
- Select industry

**Step 2: Requirements**

- Describe project details
- Upload reference files
- Define scope

**Step 3: Budget**

- Enter total budget
- View fee breakdown (Dev 85%, Broker 10%, Platform 5%)

**Step 4: Timeline**

- Set project duration
- Define milestones
- Set deadlines

**Step 5: Review & Submit**

- Review all details
- Submit project request

### Freelancer/Broker: Submit Proposal

**Proposal Form:**

- Cover letter
- Proposed timeline
- Portfolio samples
- Pricing (auto-calculated with fees)

### Admin: Dispute Resolution

**Review Process:**

1. View dispute details
2. Check evidence from both parties (Client vs Freelancer)
3. Review contract terms
4. Make decision:
   - **Refund to Client** → Full refund
   - **Release to Developer** → Normal distribution (85-10-5)
   - **Split Payment** → Custom percentage
5. Add reasoning/comments
6. Notify both parties

---

## 📱 Mobile Responsiveness

Tất cả screens được thiết kế responsive:

- Desktop: Full sidebar navigation
- Tablet: Collapsible sidebar
- Mobile: Bottom navigation + hamburger menu

---

## 🚀 Next Steps

### Features chưa implement (cần thiết cho complete flow):

**Priority High:**

- [ ] Browse Projects page (Freelancer/Broker)
- [ ] Submit Proposal feature
- [ ] Upload Deliverable screen
- [ ] Wallet/Withdrawal management
- [ ] Admin Payout Approval panel
- [ ] Admin Dispute Resolution interface

**Priority Medium:**

- [ ] Freelancer Profile with Trust Score
- [ ] Contract management
- [ ] Real-time notifications
- [ ] Chat/Messaging system

**Priority Low:**

- [ ] Analytics dashboard
- [ ] Advanced search/filters
- [ ] Bulk actions (Admin)

---

## 📄 Related Documents

- [Payment Schema Documentation](../payment-schema/README.md)
- [Complete Money Flow](../payment-schema/05-complete-money-flow.md)
- [Deposit Flow](../payment-schema/01-deposit-flow.md)
- [Escrow Flow](../payment-schema/02-escrow-flow.md)
- [Withdrawal Flow](../payment-schema/03-withdrawal-flow.md)
- [Dispute Flow](../payment-schema/04-dispute-flow.md)

---

<div align="center">

**InterDev Platform Screenflows v1.0**

Tạo ngày: 2026-01-08

</div>
