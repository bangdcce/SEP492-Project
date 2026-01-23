# InterDev Payment/Wallet Database Schema

> **Phiên bản:** v1.0 - Optimized for Capstone Project  
> **Mô hình:** 1 Dev - 1 Broker - 1 Client  
> **Phân bổ tiền:** Dev (85%) + Broker (10%) + Platform (5%)

---

## 1. Tổng Quan Kiến Trúc

📊 Tổng quan Flow Dòng Tiền
┌─────────────────────────────────────────────────────────────────────────────┐
│ INTERDEV MONEY FLOW │
│ (1 Dev - 1 Broker - 1 Client) │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐ Deposit ┌──────────┐ Fund Escrow ┌──────────┐
│ BANK/ │ ───────────────► │ CLIENT │ ─────────────────► │ ESCROW │
│ E-WALLET│ │ WALLET │ │ ACCOUNT │
└──────────┘ └──────────┘ └──────────┘
│
│ Milestone Complete
│ + Client Approve
▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ FUND DISTRIBUTION │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Total Escrow: 100,000,000 VND │ │
│ │ ├── Developer Share: 85,000,000 VND (85%) │ │
│ │ ├── Broker Commission: 10,000,000 VND (10%) │ │
│ │ └── Platform Fee: 5,000,000 VND (5%) │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
│ │ │
▼ ▼ ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ DEV │ │ BROKER │ │ PLATFORM │
│ WALLET │ │ WALLET │ │ WALLET │
└──────────┘ └──────────┘ └──────────┘
│ │
▼ ▼
┌──────────┐ ┌──────────┐
│ Withdraw │ │ Withdraw │
│ to Bank │ │ to Bank │
└──────────┘ └──────────┘

### Quyết định thiết kế (Hybrid Approach)

| Thành phần             | Quyết định               | Lý do                                            |
| ---------------------- | ------------------------ | ------------------------------------------------ |
| **Deposit/Withdrawal** | Gộp vào `Transaction`    | Giảm số table, dùng `type` enum để phân biệt     |
| **Escrow**             | Liên kết với `Milestone` | Mỗi milestone có escrow riêng, dễ track progress |
| **Fee Snapshot**       | Lưu số tiền cố định      | Admin thay đổi % không ảnh hưởng escrow cũ       |
| **PaymentMethod**      | Simplified BankAccount   | Không cần encrypt cho scope capstone             |

### Entities cần tạo

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT MODULE ENTITIES                   │
├─────────────────────────────────────────────────────────────┤
│  WalletEntity          (Ví tiền user)                       │
│  TransactionEntity     (Mọi giao dịch: nạp/rút/hold/release)│
│  EscrowEntity          (Ký quỹ theo milestone)              │
│  PayoutMethodEntity    (Tài khoản ngân hàng rút tiền)       │
│  FeeConfigEntity       (Cấu hình phí %, Admin quản lý)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Money Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTERDEV MONEY FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐     DEPOSIT      ┌──────────┐     ESCROW_HOLD    ┌──────────┐
    │  BANK/   │ ───────────────► │  CLIENT  │ ─────────────────► │  ESCROW  │
    │  MOMO    │                  │  WALLET  │                    │(Milestone)│
    └──────────┘                  │          │                    └──────────┘
                                  │ balance  │                          │
                                  │ -------- │                          │
                                  │ pending  │                          │
                                  │ held     │                          │
                                  └──────────┘                          │
                                                                        │
                          Milestone Complete + Client Approve           │
                                                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     ESCROW_RELEASE DISTRIBUTION                          │
    │  ┌─────────────────────────────────────────────────────────────────────┐│
    │  │  Milestone Amount: 100,000,000 VND                                  ││
    │  │  ├── developerShare: 85,000,000 VND (85%) → DEV WALLET              ││
    │  │  ├── brokerShare:    10,000,000 VND (10%) → BROKER WALLET           ││
    │  │  └── platformFee:     5,000,000 VND (5%)  → PLATFORM REVENUE        ││
    │  └─────────────────────────────────────────────────────────────────────┘│
    └─────────────────────────────────────────────────────────────────────────┘
                │                    │
                ▼                    ▼
         ┌──────────┐         ┌──────────┐
         │   DEV    │         │  BROKER  │
         │  WALLET  │         │  WALLET  │
         │ balance++│         │ balance++│
         └──────────┘         └──────────┘
                │                    │
                ▼                    ▼
         ┌──────────┐         ┌──────────┐
         │WITHDRAWAL│         │WITHDRAWAL│
         │ → Bank   │         │ → Bank   │
         └──────────┘         └──────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  DISPUTE SCENARIO                                                        │
    │  EscrowStatus = DISPUTED → Admin resolve → REFUND to Client              │
    │  or → RELEASE to Developer (based on DisputeResult)                      │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Enums

```typescript
// ============ WALLET ENUMS ============
export enum WalletStatus {
  ACTIVE = "ACTIVE",
  FROZEN = "FROZEN", // Bị đóng băng (Admin action)
  SUSPENDED = "SUSPENDED", // Tạm ngưng (Có dispute)
}

// ============ TRANSACTION ENUMS ============
export enum TransactionType {
  DEPOSIT = "DEPOSIT", // Nạp tiền từ bank/e-wallet
  WITHDRAWAL = "WITHDRAWAL", // Rút tiền về bank
  ESCROW_HOLD = "ESCROW_HOLD", // Chuyển vào escrow
  ESCROW_RELEASE = "ESCROW_RELEASE", // Giải ngân từ escrow
  REFUND = "REFUND", // Hoàn tiền khi dispute
  FEE_DEDUCTION = "FEE_DEDUCTION", // Trừ phí platform
}

export enum TransactionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

// ============ ESCROW ENUMS ============
export enum EscrowStatus {
  PENDING = "PENDING", // Chờ client fund
  FUNDED = "FUNDED", // Đã có tiền, đang work
  RELEASED = "RELEASED", // Đã giải ngân xong
  REFUNDED = "REFUNDED", // Đã hoàn tiền
  DISPUTED = "DISPUTED", // Đang tranh chấp
}

// ============ PAYOUT ENUMS ============
export enum PayoutStatus {
  PENDING = "PENDING", // Chờ Admin duyệt
  APPROVED = "APPROVED", // Đã duyệt, chờ chuyển
  PROCESSING = "PROCESSING", // Đang chuyển tiền
  COMPLETED = "COMPLETED", // Đã chuyển xong
  REJECTED = "REJECTED", // Bị từ chối
}

// ============ FEE ENUMS ============
export enum FeeType {
  PLATFORM_FEE = "PLATFORM_FEE",
  BROKER_COMMISSION = "BROKER_COMMISSION",
  WITHDRAWAL_FEE = "WITHDRAWAL_FEE",
}
```

---

## 4. Utility: ColumnNumericTransformer

> **Vấn đề:** PostgreSQL trả về `decimal` dưới dạng `string`, gây lỗi tính toán.

```typescript
// src/database/transformers/column-numeric.transformer.ts

import { ValueTransformer } from "typeorm";

export class ColumnNumericTransformer implements ValueTransformer {
  to(data?: number | null): number | null {
    return data;
  }

  from(data?: string | null): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    return parseFloat(data);
  }
}
```

---

## 5. Entities

### 5.1 WalletEntity

```typescript
// src/database/entities/wallet.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { ColumnNumericTransformer } from "../transformers/column-numeric.transformer";

export enum WalletStatus {
  ACTIVE = "ACTIVE",
  FROZEN = "FROZEN",
  SUSPENDED = "SUSPENDED",
}

@Entity("wallets")
@Index(["userId"], { unique: true }) // Mỗi user 1 wallet
export class WalletEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  // === SỐ DƯ CHÍNH ===
  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  balance: number; // Số dư khả dụng

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  pendingBalance: number; // Tiền chờ xử lý (deposit pending)

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  heldBalance: number; // Tiền bị hold (trong escrow)

  // === THỐNG KÊ ===
  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalDeposited: number;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalWithdrawn: number;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalEarned: number; // Cho Freelancer/Broker

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalSpent: number; // Cho Client

  @Column({ type: "varchar", length: 3, default: "VND" })
  currency: string;

  @Column({
    type: "enum",
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne("UserEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: any;

  @OneToMany("TransactionEntity", "wallet")
  transactions: any[];
}
```

---

### 5.2 TransactionEntity (Unified)

```typescript
// src/database/entities/transaction.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ColumnNumericTransformer } from "../transformers/column-numeric.transformer";

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  ESCROW_HOLD = "ESCROW_HOLD",
  ESCROW_RELEASE = "ESCROW_RELEASE",
  REFUND = "REFUND",
  FEE_DEDUCTION = "FEE_DEDUCTION",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

@Entity("transactions")
@Index(["walletId", "createdAt"])
@Index(["type", "status"])
export class TransactionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  walletId: string;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  fee: number; // Phí giao dịch (nếu có)

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  netAmount: number; // amount - fee (số tiền thực nhận)

  @Column({ type: "varchar", length: 3, default: "VND" })
  currency: string;

  @Column({ type: "enum", enum: TransactionType })
  type: TransactionType;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  // === REFERENCE (Polymorphic) ===
  @Column({ type: "varchar", length: 50, nullable: true })
  referenceType: string; // 'Escrow', 'PayoutRequest', 'Milestone'

  @Column({ type: "uuid", nullable: true })
  referenceId: string;

  // === EXTERNAL PAYMENT INFO ===
  @Column({ type: "varchar", length: 50, nullable: true })
  paymentMethod: string; // 'BANK_TRANSFER', 'MOMO', 'VNPAY'

  @Column({ type: "varchar", nullable: true })
  externalTransactionId: string; // ID từ payment gateway

  // === METADATA (Flexible storage) ===
  @Column({ type: "jsonb", nullable: true })
  metadata: {
    bankName?: string;
    accountNumber?: string;
    transferContent?: string;
    paymentUrl?: string;
    gatewayResponse?: any;
    adminNote?: string;
    [key: string]: any;
  };

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", nullable: true })
  failureReason: string;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne("WalletEntity", "transactions", { onDelete: "CASCADE" })
  @JoinColumn({ name: "walletId" })
  wallet: any;
}
```

---

### 5.3 EscrowEntity

```typescript
// src/database/entities/escrow.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { ColumnNumericTransformer } from "../transformers/column-numeric.transformer";

export enum EscrowStatus {
  PENDING = "PENDING",
  FUNDED = "FUNDED",
  RELEASED = "RELEASED",
  REFUNDED = "REFUNDED",
  DISPUTED = "DISPUTED",
}

@Entity("escrows")
@Index(["milestoneId"], { unique: true }) // 1 Milestone = 1 Escrow
@Index(["projectId"])
export class EscrowEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  projectId: string;

  @Column()
  milestoneId: string; // Quan trọng: Link với Milestone, không phải Project

  // === TIỀN ===
  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  totalAmount: number; // Tổng tiền cần hold

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  fundedAmount: number; // Tiền đã nạp

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  releasedAmount: number; // Tiền đã giải ngân

  // === SNAPSHOT PHÍ (Immutable - quan trọng!) ===
  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  developerShare: number; // Số tiền Developer nhận (85%)

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  brokerShare: number; // Số tiền Broker nhận (10%)

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  platformFee: number; // Phí Platform (5%)

  // Lưu % tại thời điểm tạo (để trace)
  @Column({ type: "decimal", precision: 5, scale: 2, default: 85 })
  developerPercentage: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 10 })
  brokerPercentage: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 5 })
  platformPercentage: number;

  @Column({ type: "varchar", length: 3, default: "VND" })
  currency: string;

  @Column({
    type: "enum",
    enum: EscrowStatus,
    default: EscrowStatus.PENDING,
  })
  status: EscrowStatus;

  // === TIMESTAMPS ===
  @Column({ type: "timestamp", nullable: true })
  fundedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  releasedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  refundedAt: Date;

  // === CLIENT APPROVAL ===
  @Column({ default: false })
  clientApproved: boolean;

  @Column({ type: "timestamp", nullable: true })
  clientApprovedAt: Date;

  // === DISPUTE LINK ===
  @Column({ type: "uuid", nullable: true })
  disputeId: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne("ProjectEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "projectId" })
  project: any;

  @ManyToOne("MilestoneEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "milestoneId" })
  milestone: any;

  @ManyToOne("DisputeEntity", { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "disputeId" })
  dispute: any;
}
```

---

### 5.4 PayoutMethodEntity (Simplified BankAccount)

```typescript
// src/database/entities/payout-method.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

@Entity("payout_methods")
@Index(["userId"])
export class PayoutMethodEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({ type: "varchar", length: 100 })
  bankName: string; // Vietcombank, Techcombank

  @Column({ type: "varchar", length: 20, nullable: true })
  bankCode: string; // VCB, TCB (cho BIN lookup)

  @Column({ type: "varchar", length: 30 })
  accountNumber: string;

  @Column({ type: "varchar", length: 255 })
  accountHolderName: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  branchName: string;

  @Column({ default: false })
  isDefault: boolean; // Tài khoản mặc định để rút

  @Column({ default: false })
  isVerified: boolean; // Đã xác minh (test transfer 1000đ)

  @Column({ type: "timestamp", nullable: true })
  verifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne("UserEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: any;
}
```

---

### 5.5 FeeConfigEntity

```typescript
// src/database/entities/fee-config.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ColumnNumericTransformer } from "../transformers/column-numeric.transformer";

export enum FeeType {
  PLATFORM_FEE = "PLATFORM_FEE",
  BROKER_COMMISSION = "BROKER_COMMISSION",
  WITHDRAWAL_FEE = "WITHDRAWAL_FEE",
}

@Entity("fee_configs")
export class FeeConfigEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: FeeType })
  feeType: FeeType;

  @Column({
    type: "decimal",
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  percentage: number; // 5.00 = 5%

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  minAmount: number; // Phí tối thiểu

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  maxAmount: number; // Phí tối đa (cap)

  @Column({ type: "varchar", length: 255, nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "timestamp", nullable: true })
  effectiveFrom: Date;

  @Column({ type: "timestamp", nullable: true })
  effectiveTo: Date;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne("UserEntity", { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "updatedBy" })
  updater: any;
}
```

---

## 6. DisputeEntity (Enhanced)

> **Bổ sung:** Thêm `evidence`, `result`, `resolvedById` như đề xuất

```typescript
// src/database/entities/dispute.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

export enum DisputeStatus {
  OPEN = "OPEN",
  IN_MEDIATION = "IN_MEDIATION",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}

export enum DisputeResult {
  PENDING = "PENDING",
  WIN_CLIENT = "WIN_CLIENT",
  WIN_FREELANCER = "WIN_FREELANCER",
  SPLIT = "SPLIT",
}

@Entity("disputes")
export class DisputeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  projectId: string;

  @Column()
  raisedById: string; // Nguyên đơn

  @Column()
  defendantId: string; // Bị đơn

  @Column({ type: "text" })
  reason: string;

  // === BỔ SUNG QUAN TRỌNG ===
  @Column({ type: "jsonb", nullable: true })
  evidence: string[]; // Mảng URLs: ảnh/file bằng chứng

  @Column({
    type: "enum",
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({
    type: "enum",
    enum: DisputeResult,
    default: DisputeResult.PENDING,
  })
  result: DisputeResult; // Kết quả để code tự động xử lý

  @Column({ type: "text", nullable: true })
  adminComment: string; // Lý do phán quyết

  @Column({ nullable: true })
  resolvedById: string; // Admin xử lý

  @Column({ type: "timestamp", nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne("ProjectEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "projectId" })
  project: any;

  @ManyToOne("UserEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "raisedById" })
  raiser: any;

  @ManyToOne("UserEntity", { onDelete: "CASCADE" })
  @JoinColumn({ name: "defendantId" })
  defendant: any;

  @ManyToOne("UserEntity", { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "resolvedById" })
  resolvedBy: any;
}
```

---

## 7. Tổng kết

### Entities được tạo/cập nhật

| Entity               | Trạng thái   | Mô tả                                                             |
| -------------------- | ------------ | ----------------------------------------------------------------- |
| `WalletEntity`       | **Cập nhật** | Thêm `pendingBalance`, `heldBalance`, `totalEarned`, `totalSpent` |
| `TransactionEntity`  | **Cập nhật** | Unified (gộp Deposit + Withdrawal), thêm `metadata`               |
| `EscrowEntity`       | **Mới**      | Link với Milestone, có snapshot phí                               |
| `PayoutMethodEntity` | **Mới**      | Thay thế BankAccount đơn giản                                     |
| `FeeConfigEntity`    | **Mới**      | Admin quản lý % phí động                                          |
| `DisputeEntity`      | **Cập nhật** | Thêm `evidence`, `result`, `resolvedById`                         |

### So sánh với Proposal cũ

| Quyết định         | Proposal A (Complex) | Proposal B (Simple) | **Hybrid (Adopted)**   |
| ------------------ | -------------------- | ------------------- | ---------------------- |
| Deposit/Withdrawal | Bảng riêng           | Gộp Transaction     | ✅ Gộp vào Transaction |
| Escrow Link        | Project              | Milestone           | ✅ Milestone           |
| Fee Storage        | % only               | Snapshot amount     | ✅ Cả 2 (% + amount)   |
| BankAccount        | Encrypted            | Plain text          | ✅ Plain (capstone)    |
| PaymentMethod      | Full e-wallet        | Bank only           | ✅ Bank + metadata     |

---

## 8. Migration SQL

```sql
-- Tạo bảng wallets (cập nhật)
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS pending_balance DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS held_balance DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent DECIMAL(15,2) DEFAULT 0;

-- Tạo bảng escrows
CREATE TABLE IF NOT EXISTS escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL UNIQUE REFERENCES milestones(id) ON DELETE CASCADE,
  total_amount DECIMAL(15,2) NOT NULL,
  funded_amount DECIMAL(15,2) DEFAULT 0,
  released_amount DECIMAL(15,2) DEFAULT 0,
  developer_share DECIMAL(15,2) NOT NULL,
  broker_share DECIMAL(15,2) DEFAULT 0,
  platform_fee DECIMAL(15,2) DEFAULT 0,
  developer_percentage DECIMAL(5,2) DEFAULT 85,
  broker_percentage DECIMAL(5,2) DEFAULT 10,
  platform_percentage DECIMAL(5,2) DEFAULT 5,
  currency VARCHAR(3) DEFAULT 'VND',
  status VARCHAR(20) DEFAULT 'PENDING',
  client_approved BOOLEAN DEFAULT FALSE,
  client_approved_at TIMESTAMP,
  funded_at TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tạo bảng fee_configs
CREATE TABLE IF NOT EXISTS fee_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type VARCHAR(50) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  min_amount DECIMAL(15,2),
  max_amount DECIMAL(15,2),
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  effective_from TIMESTAMP,
  effective_to TIMESTAMP,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tạo bảng payout_methods
CREATE TABLE IF NOT EXISTS payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20),
  account_number VARCHAR(30) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  branch_name VARCHAR(100),
  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cập nhật bảng disputes
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS result VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS admin_comment TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Cập nhật bảng transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fee DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS external_transaction_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Seed default fee configs
INSERT INTO fee_configs (fee_type, percentage, description, is_active) VALUES
  ('PLATFORM_FEE', 5.00, 'Phí nền tảng InterDev', TRUE),
  ('BROKER_COMMISSION', 10.00, 'Hoa hồng Broker mặc định', TRUE),
  ('WITHDRAWAL_FEE', 0.00, 'Phí rút tiền (miễn phí)', TRUE)
ON CONFLICT DO NOTHING;
```

---

**Tài liệu này phù hợp cho scope đồ án tốt nghiệp, đủ professional nhưng không over-engineered.**
