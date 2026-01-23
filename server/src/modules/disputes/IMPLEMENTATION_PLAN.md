# 📋 DISPUTE RESOLUTION SYSTEM - IMPLEMENTATION PLAN

## 🎯 PHẠM VI & MỤC TIÊU

**Hiện trạng:**

- Có DisputesService cơ bản: create, resolve, appeal, notes
- **Phase 1 PARTIAL:** Evidence System (upload/flag done, thieu git evidence)
- **Phase 2 DONE:** Settlement System (create, respond, cancel, expire)
- **Phase 3 DONE:** Staff Assignment System (workload, skill matching, edge cases)
- **Tagging System DONE:** Master Taxonomy for Skills & Domains
- Hearing: PARTIAL (helpers only); Verdict: TODO; Calendar/Scheduling: TODO
- Live chat: TODO; Performance tracking: PARTIAL (logic only, chua co service/controller/cron)

**Mục tiêu:**
Xây dựng hệ thống giải quyết tranh chấp chuyên nghiệp với:

1. Live chat-based hearings (không phụ thuộc video call)
2. Auto-assignment staff dựa trên workload ✅ DONE
3. Settlement workflow (trước khi escalate) ✅ DONE
4. Structured verdict (chuẩn hóa phán quyết)
5. Staff performance tracking
6. Calendar/scheduling system
7. **Skill-based staff matching** ✅ DONE (Tagging System)

---

## 💰 CRITICAL DESIGN DECISIONS (Platform-wide)

### Currency: USD Only

- **Toàn bộ platform dùng USD**
- Entities đã được migrate: escrow, transaction, wallet
- Tránh floating point errors với số lớn VND

### Money Calculation: Decimal.js

```typescript
// ❌ KHÔNG BAO GIỜ: Float arithmetic
const total = amount1 + amount2; // 0.1 + 0.2 !== 0.3

// ✅ LUÔN LUÔN: Decimal.js
import Decimal from 'decimal.js';
const total = new Decimal(amount1).plus(amount2).toNumber();
```

### Platform Fee Logic

- Freelancer fee: 5% trên số tiền nhận
- Client fee: 0% (không tính phí refund)
- Fee tính trên số tiền thực nhận, không phải tổng escrow

---

## 📐 KIẾN TRÚC TỔNG QUAN

### Module Structure

```
disputes/
├── services/
│   ├── disputes.service.ts (existing - sẽ refactor)
│   ├── evidence.service.ts (NEW) ✅ DONE
│   ├── settlement.service.ts (NEW) ✅ DONE
│   ├── hearing.service.ts (NEW) PARTIAL (helpers only)
│   ├── verdict.service.ts (NEW) TODO (missing)
│   ├── feedback.service.ts (NEW) TODO (missing)
│   └── staff-assignment.service.ts (NEW) ✅ DONE
├── controllers/
│   ├── disputes.controller.ts (existing - sẽ mở rộng)
│   ├── evidence.controller.ts (NEW) ✅ DONE
│   ├── settlement.controller.ts (NEW) ✅ DONE
│   ├── hearing.controller.ts (NEW) PARTIAL (placeholder)
│   ├── verdict.controller.ts (NEW) TODO (missing)
│   └── staff-assignment.controller.ts (NEW) ✅ DONE
├── modules/
│   ├── evidence.module.ts ✅ DONE
│   ├── settlement.module.ts ✅ DONE
│   ├── hearing.module.ts PARTIAL (helpers only)
│   └── staff-assignment.module.ts ✅ DONE
└── dto/ (đã có đầy đủ) ✅ DONE

calendar/ (NEW MODULE) TODO (moi co dto + entities)
├── services/
│   ├── calendar-event.service.ts
│   ├── availability.service.ts
│   ├── reschedule.service.ts
│   └── auto-schedule.service.ts
└── controllers/
    └── calendar.controller.ts
```

### Database: Tagging System (Skill Master Taxonomy) ✅ DONE

```
database/entities/
├── skill-domain.entity.ts ✅ DONE   # Layer 1: Domains (E-commerce, FinTech, etc.)
├── skill.entity.ts ✅ DONE          # Layer 2: Skills (ReactJS, NestJS, etc.)
├── user-skill.entity.ts ✅ DONE     # User-Skill junction (Primary/Secondary)
│   └── StaffExpertiseEntity         # Staff audit skills
└── dispute-skill.entity.ts ✅ DONE  # Dispute skill requirements
    └── SkillMappingRuleEntity       # Auto-tagging rules

database/migrations/
└── tagging-system.sql ✅ DONE       # Full schema + seed data
```

---

## 🚀 PHASE-BY-PHASE IMPLEMENTATION PLAN

---

## **PHASE 1: FOUNDATION - Evidence & Storage System** (PARTIAL - missing git evidence)

**Backend status:**

- DONE: validateFileUpload, generateStoragePath, calculateFileHash, checkDuplicateEvidence, checkRateLimit, uploadEvidence, flagEvidence, getEvidenceList
- TODO: validateGitEvidence + uploadGitEvidence + `POST /disputes/:disputeId/evidence/git`

_Ước tính: 1-2 ngày_

### 1.1. Evidence Service - Unit Functions ✅

**File:** `services/evidence.service.ts`

#### **Unit Function 1.1.1: `validateFileUpload()`** ✅

```typescript
Purpose: Kiểm tra file hợp lệ (type, size, format)
Input: fileName, fileSize, mimeType
Output: { valid: boolean, error?: string }
Algorithm: Whitelist approach
- Allowed types: ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4']
- Max size: 50MB (images/pdfs), 500MB (videos)
Why: Security first - chỉ cho phép format an toàn, tránh malicious files
```

#### **Unit Function 1.1.1b: `validateGitEvidence()` (NEW)** TODO

```typescript
Purpose: Validate Git repository/commit evidence cho code-based disputes
Input: { repoUrl, commitHash?, branch?, filePaths? }
Output: { valid: boolean, error?: string, metadata?: GitMetadata }

Supported Formats:
- GitHub: https://github.com/{owner}/{repo}/commit/{sha}
- GitLab: https://gitlab.com/{owner}/{repo}/-/commit/{sha}
- Bitbucket: https://bitbucket.org/{owner}/{repo}/commits/{sha}

Algorithm:
1. Parse URL để extract owner, repo, commitHash
2. Validate URL format (regex match)
3. Optionally verify commit exists (GitHub API call với rate limit)
4. Return metadata: { provider, owner, repo, commitHash, timestamp }

Why Git Evidence:
- Code-based disputes cần proof of deliverables
- Commit history cho thấy who did what when
- File paths show exactly what was delivered

Security:
- Only allow public repos (private repo cần OAuth - Future)
- Rate limit GitHub API calls (60/hour unauthenticated)
```

#### **Unit Function 1.1.2: `generateStoragePath()`** ✅

```typescript
Purpose: Tạo đường dẫn lưu trữ chuẩn hóa
Input: disputeId, uploaderId, fileName
Output: 'disputes/{disputeId}/{timestamp}_{hash}_{filename}'
Algorithm: Prefix + timestamp + hash (collision-free)
Why:
- Namespace theo dispute (dễ xóa/archive)
- Timestamp giúp sắp xếp chronologically
- Hash tránh trùng lặp khi upload cùng tên file
```

#### **Unit Function 1.1.3: `calculateFileHash()`** ✅

```typescript
Purpose: Tính SHA-256 hash để verify integrity
Input: file buffer
Output: hex string
Algorithm: SHA-256 (Node crypto)
Why: SHA-256 là industry standard, đủ mạnh cho legal compliance
```

#### **Unit Function 1.1.4: `checkDuplicateEvidence()`** ✅

```typescript
Purpose: Phát hiện evidence trùng lặp (cùng file hash)
Input: disputeId, fileHash
Output: existing evidence or null
Algorithm: Query by disputeId + fileHash index
Why: Tránh spam upload cùng 1 file nhiều lần
```

#### **Unit Function 1.1.5: `checkRateLimit()`** ✅

```typescript
Purpose: Kiểm tra rate limit upload cho user
Policy: Mỗi user chỉ được upload tối đa 20 files/dispute
Why: Ngăn spam - nếu user spam 20 ảnh rác, họ tự hết quota
```

### 1.2. Evidence Service - Compose Functions

#### **Compose Function 1.2.1: `uploadEvidence()`**

```typescript
Flow:
1. validateFileUpload()
2. calculateFileHash()
3. checkDuplicateEvidence() → nếu có thì return existing
4. checkRateLimit() → nếu vượt quota thì reject
5. generateStoragePath()
6. Upload to Supabase Storage
7. Save EvidenceEntity (storagePath, hash, metadata)
8. Log activity (audit trail)
Transaction: Wrapped in DB transaction
Why transaction: Nếu upload Supabase thành công nhưng save DB fail → orphan file
Rollback strategy: Delete uploaded file nếu DB save failed
```

#### **Compose Function 1.2.2: `flagEvidence()`**

```typescript
Flow:
1. Load evidence by ID
2. Check permissions (only staff/admin can flag)
3. Update isFlagged, flagReason, flaggedById
4. Emit EVIDENCE_FLAGGED event (để notify moderators)
5. Log activity
Why separate function: Flagging là critical moderation action, cần audit riêng
```

#### **Compose Function 1.2.3: `getEvidenceList()`**

```typescript
Flow:
1. Load dispute to check access permissions
2. Query evidences with relations (uploader info)
3. Filter flagged items (staff/admin thấy tất cả, user chỉ thấy non-flagged)
4. Generate temporary signed URLs for storagePath (TTL 1h)
Algorithm: Batch generate signed URLs (1 Supabase API call)
Why signed URLs: Bảo mật - không expose permanent URLs
```

#### **Compose Function 1.2.4: `uploadGitEvidence()` (NEW)** TODO

```typescript
Purpose: Upload Git repository/commit as evidence for code-based disputes
Flow:
1. validateGitEvidence() → Parse and validate URL TODO
2. checkRateLimit() → Same limit as file uploads
3. Optionally fetch commit metadata from GitHub API
4. Create EvidenceEntity:
   - type = 'GIT_COMMIT' or 'GIT_REPOSITORY'
   - storagePath = null (no file upload needed)
   - metadata = { provider, owner, repo, commitHash, branch, filePaths }
5. Log activity

Why separate function:
- Git evidence không cần Supabase upload
- Metadata structure khác file evidence
- API rate limiting considerations

Evidence Types (UPDATED):
- FILE: Traditional file upload (image, pdf, video)
- GIT_COMMIT: Specific commit SHA
- GIT_REPOSITORY: Link to repo (overview)
- EXTERNAL_LINK: Other URLs (documentation, designs, etc.)
```

### 1.3. Evidence Controller

```typescript
POST /disputes/:disputeId/evidence (upload file)
POST /disputes/:disputeId/evidence/git (upload git evidence) // NEW TODO
POST /disputes/:disputeId/evidence/:evidenceId/flag (flag)
GET /disputes/:disputeId/evidence (list)
```

**Guards:** JWT + RoleGuard (raiser/defendant/staff/admin)

### 1.4. Feature Coverage - Phase 1

| Edge Case                      | Covered? | Implementation                              |
| ------------------------------ | -------- | ------------------------------------------- |
| Invalid file type              | ✅       | Whitelist MIME types                        |
| File too large                 | ✅       | Size limits (50MB/500MB)                    |
| Duplicate upload               | ✅       | SHA-256 hash check                          |
| Upload spam                    | ✅       | 20 files/dispute limit                      |
| Orphan files                   | ✅       | DB-first approach with rollback             |
| Signed URL expiry              | ✅       | 1 hour TTL with refresh                     |
| Flagged evidence visibility    | ✅       | Role-based filtering                        |
| Git evidence for code disputes | TODO     | validateGitEvidence() + uploadGitEvidence() |
| Private Git repos              | ⏳       | Future: OAuth integration                   |
| Evidence tampering             | ✅       | SHA-256 hash verification                   |

---

## **PHASE 2: SETTLEMENT SYSTEM - Pre-Hearing Negotiation** (DONE)

**Backend status:**

- DONE: createSettlementOffer, respondToSettlement, cancelSettlement, expiry handling, staff suggestion, chat-lock checks

_Ước tính: 1-2 ngày_

### ⚠️ CRITICAL DESIGN DECISIONS (Already Implemented)

#### **Currency: USD Only** ✅

- Toàn bộ platform dùng USD để tránh floating point errors với số lớn VND
- Files đã update: `escrow.entity.ts`, `transaction.entity.ts`, `wallet.entity.ts`

#### **Decimal Precision (QUAN TRỌNG!)** ✅

```typescript
// ❌ TUYỆT ĐỐI KHÔNG: Dùng float arithmetic
const total = amount1 + amount2; // 0.1 + 0.2 !== 0.3

// ✅ ĐÚNG: Dùng Decimal.js (đã implement trong settlement.service.ts)
import Decimal from 'decimal.js';
const total = new Decimal(amount1).plus(amount2).toNumber();
```

#### **Platform Fee Logic**

```
Settlement là chia lại tiền trong Escrow. Phí sàn tính như sau:

1. Escrow đã hold tiền với snapshot %:
   - developerShare (85%), brokerShare (10%), platformFee (5%)

2. Khi Settlement:
   - amountToFreelancer + amountToClient = escrow.fundedAmount
   - platformFee = calculateFeeOnSettlement(amountToFreelancer, amountToClient)
   - Mỗi bên chịu phí theo % của số tiền thực nhận

3. Additional Fees (configurable by Admin):
   - disputeFee: Phí mở dispute (optional)
   - appealFee: Phí kháng cáo (optional)
   - latePenaltyFee: Phí phạt trễ deadline

4. Fee Config Table:
   - Các % phí có thể config bởi Admin qua UI
   - FeeConfigEntity đã có sẵn
```

#### **Milestone Minimum Amount**

```typescript
// Ràng buộc: Mỗi milestone phải >= $50 USD
const MINIMUM_MILESTONE_AMOUNT = 50; // USD

// Why:
// - Settlement amount quá nhỏ không có ý nghĩa
// - Tránh spam micro-milestones
// - Đảm bảo platform fee có ý nghĩa (5% của $50 = $2.50)
```

### 2.1. Settlement Service - Unit Functions

#### **Unit Function 2.1.1: `validateMoneyLogic()`**

```typescript
Purpose: Verify amount split hợp lý (DÙNG DECIMAL.JS!)
Input: amountToFreelancer, amountToClient, escrowFundedAmount
Output: { valid: boolean, error?: string, breakdown?: FeeBreakdown }
Algorithm:
1. Convert all amounts to Decimal.js
2. Sum = amountToFreelancer + amountToClient (KHÔNG cộng platformFee ở đây)
3. Validate: Sum === escrowFundedAmount (exact match, không phải <=)
4. Validate: amountToFreelancer >= 0 AND amountToClient >= 0
5. Calculate fees:
   - freelancerFee = amountToFreelancer * freelancerFeePercentage
   - clientFee = amountToClient * clientFeePercentage (usually 0)
   - totalPlatformFee = freelancerFee + clientFee
6. Return breakdown cho transparency

Edge Cases:
- ❌ Sum > fundedAmount → "Cannot distribute more than escrow balance"
- ❌ Sum < fundedAmount → "Must distribute entire escrow balance"
- ❌ Negative amounts → "Amount cannot be negative"
- ❌ fundedAmount < MINIMUM_SETTLEMENT ($10) → "Settlement amount too small"
```

#### **Unit Function 2.1.2: `calculateExpiryTime()`**

```typescript
Purpose: Tính deadline cho settlement offer
Input: config (expiryHours, excludeWeekends)
Output: Date

Algorithm:
1. Base: now + expiryHours (default 48h)
2. If excludeWeekends = true:
   a. Check if deadline falls on weekend (Sat/Sun)
   b. If yes, extend to Monday 9:00 AM (user's timezone)
3. Return final deadline

Config Options (Admin configurable):
- expiryHours: 24, 48, 72 (default 48)
- excludeWeekends: true/false (default false cho freelance platform 24/7)
- minNoticeHours: 24 (không cho expire trước 24h từ lúc tạo)

Edge Cases:
- Holiday handling: Không implement (too complex for MVP)
- Timezone: Store as UTC, display in user's timezone
```

#### **Unit Function 2.1.3: `checkSettlementEligibility()`**

```typescript
Purpose: Kiểm tra dispute có thể settlement không
Input: disputeId, proposerId
Output: { eligible: boolean, reason?: string, remainingAttempts?: number }

Algorithm:
1. Load dispute with current status
2. Status check (IMPORTANT ORDER):
   - ❌ RESOLVED, CLOSED, CANCELLED → "Dispute already closed"
   - ❌ IN_VERDICT_PROCESS → "Cannot settle during verdict process"
   - ❌ AWAITING_VERDICT → "Hearing completed, awaiting verdict"
   - ✅ OPEN, UNDER_REVIEW, IN_MEDIATION → Allowed

3. Pending settlement check:
   - Query settlements WHERE disputeId = X AND status = PENDING
   - ❌ If exists → "A pending settlement offer already exists"

4. Per-user attempt check (QUAN TRỌNG: tính theo MỖI NGƯỜI, không phải tổng):
   - Query settlements WHERE disputeId = X AND proposerId = currentUser
   - Count attempts (bao gồm REJECTED, EXPIRED, CANCELLED)
   - ❌ If count >= 3 → "You have reached maximum settlement attempts"
   - Return remainingAttempts = 3 - count

5. Lock check (pessimistic locking):
   - SELECT ... FOR UPDATE để tránh race condition
   - 2 users cùng tạo settlement cùng lúc → 1 người fail

Race Condition Mitigation:
- Use database transaction with FOR UPDATE lock
- First-come-first-served: User nào commit trước thắng
```

### 2.2. Settlement Service - Compose Functions

#### **Compose Function 2.2.1: `createSettlementOffer()`**

```typescript
Flow:
1. BEGIN TRANSACTION
2. Load dispute WITH LOCK (SELECT FOR UPDATE)
3. checkSettlementEligibility(disputeId, proposerId)
4. Load escrow để lấy fundedAmount
5. validateMoneyLogic(amountToFreelancer, amountToClient, fundedAmount)
6. calculateExpiryTime()
7. Calculate fee breakdown
8. Create SettlementEntity:
   - status = PENDING
   - proposerId, proposerRole
   - amountToFreelancer, amountToClient
   - platformFee (calculated)
   - expiresAt
9. Emit SETTLEMENT_OFFERED event
10. COMMIT
11. Notify đối phương (email + push)

Transaction: SERIALIZABLE isolation level
Why: Prevent race condition khi 2 người cùng tạo offer
```

#### **Compose Function 2.2.2: `respondToSettlement()`**

```typescript
Flow:
1. Load settlement + check permissions (chỉ responder được respond)
2. Check settlement chưa expire và status = PENDING
3. If ACCEPT:
   a. Update settlement.status = ACCEPTED
   b. Update dispute.status = RESOLVED
   c. Update dispute.acceptedSettlementId
   d. Execute money transfer (Decimal.js arithmetic!):
      - Transfer amountToFreelancer - freelancerFee → Freelancer wallet
      - Transfer amountToClient - clientFee → Client wallet
      - Transfer totalPlatformFee → Platform wallet
   e. Create legal signatures (ACCEPT_SETTLEMENT)
   f. Emit SETTLEMENT_ACCEPTED event
4. If REJECT:
   a. Update settlement.status = REJECTED
   b. Store rejectReason (required!)
   c. Check remaining attempts for BOTH sides:
      - If both sides have used 3 attempts each → Auto-escalate to hearing
      - Else: Cho phép tiếp tục negotiate
   d. Emit SETTLEMENT_REJECTED event

Transaction: Critical (money movement involved)
Rollback: Nếu money transfer fail → rollback settlement status
Audit: Log ALL money movements to audit_logs table
```

#### **Compose Function 2.2.3: `cancelSettlement()`**

```typescript
Flow:
1. Load settlement + check proposer (chỉ proposer được cancel)
2. Check status = PENDING
3. Update status = CANCELLED
4. Emit SETTLEMENT_CANCELLED event
Why separate: User phải có quyền rút lại offer trước khi đối phương respond

Time limit: Chỉ cancel trong 1 giờ đầu (tránh lạm dụng)
```

#### **Compose Function 2.2.4: `expireOldSettlements()`**

```typescript
Purpose: Cron job tự động expire settlements quá hạn
Flow:
1. Query settlements WHERE status = PENDING AND expiresAt < NOW()
2. For each expired settlement:
   a. Update status = EXPIRED
   b. Log to audit
   c. Emit SETTLEMENT_EXPIRED event
3. Check if both sides have no remaining attempts → Auto-escalate
Algorithm: Batch query + individual emit (để trigger proper events)
Scheduling: Chạy mỗi 15 phút (không phải 1 giờ - cần responsive hơn)
```

### 2.3. Settlement Controller

```typescript
POST /disputes/:disputeId/settlements (create offer)
POST /settlements/:id/respond (accept/reject)
DELETE /settlements/:id (cancel - soft delete by status)
GET /disputes/:disputeId/settlements (list history)
GET /settlements/:id (get single với fee breakdown)
```

**Guards:** JWT + RoleGuard (raiser/defendant only - staff không tham gia settlement)

### 2.4. Feature Coverage - Phase 2

| Edge Case                          | Covered? | Implementation                                   |
| ---------------------------------- | -------- | ------------------------------------------------ |
| Floating point errors              | ✅       | Decimal.js for all money calculations            |
| Race condition (concurrent offers) | ✅       | SELECT FOR UPDATE pessimistic lock               |
| Per-user attempt tracking          | ✅       | Query by proposerId, not total count             |
| Settlement spam                    | ✅       | Max 3 attempts per user                          |
| Expired offer response             | ✅       | Check expiresAt before processing                |
| Cancel own offer                   | ✅       | Within 1 hour time limit                         |
| Money transfer rollback            | ✅       | DB transaction with rollback on failure          |
| Audit trail                        | ✅       | All money movements logged                       |
| Weekend/holiday handling           | ⏳       | MVP: No (24/7 platform), Future: Optional config |
| Currency conversion                | ❌       | Out of scope (USD only)                          |

### 2.5. Settlement Edge Cases - Abuse Prevention ✅ COMPLETED

**Mục tiêu:** Ngăn chặn các hành vi lạm dụng/trì hoãn trong quá trình settlement

---

#### **Edge Case 1: "Im lặng là vàng" (Silent Treatment)** ✅

**Vấn đề:** Responder cố tình lờ đi settlement offer, để nó tự expire, kéo dài dispute

**Giải pháp:**

| Component           | Implementation                                                   |
| ------------------- | ---------------------------------------------------------------- |
| **Chat Lock**       | Responder không thể chat cho đến khi respond settlement          |
| **Non-compliance**  | Mỗi offer bị ignore = 1 "Bad Mark" được ghi nhận                 |
| **Threshold**       | MAX_IGNORED_OFFERS = 2. Vượt ngưỡng → flagged non-cooperative    |
| **Proposer Option** | Sau khi offer expire, proposer được gợi ý yêu cầu Staff decision |

**Service Functions:**

```typescript
// Unit Functions (settlement.service.ts)
checkChatLockStatus(disputeId, userId); // ✅ Implemented
countIgnoredOffers(disputeId, userId); // ✅ Implemented
isUserNonCooperative(disputeId, userId); // ✅ Implemented

// Compose Functions (updated)
expireOldSettlements(); // ✅ Updated: tracks NonComplianceRecord[], emits proposerNotification
```

**Events Emitted:**

- `settlement.expired` → includes `nonCompliance: { userId, offerId, totalIgnored }`
- `settlement.proposerNotification` → `canRequestStaffDecision: true` if responder non-cooperative
- `settlement.chatUnlocked` → unlocks chat after response/expiry

**Config Constants:**

```typescript
SETTLEMENT_CONFIG = {
  ...
  MANDATORY_RESPONSE_HOURS: 24,  // Deadline cảnh báo
  CHAT_LOCK_ENABLED: true,       // Có bật chat lock không
  MAX_IGNORED_OFFERS: 2,         // Ngưỡng non-cooperative
  NON_COMPLIANCE_PENALTY_WEIGHT: 1.5  // Hệ số penalty khi verdict
}
```

---

#### **Edge Case 2: "Từ chối cộc lốc" (No-Reason Rejection)** ✅

**Vấn đề:** User reject mà không giải thích, gây lãng phí settlement attempts

**Giải pháp:**

| Component          | Implementation                                               |
| ------------------ | ------------------------------------------------------------ |
| **Min Length**     | `rejectedReason` bắt buộc tối thiểu 50 ký tự                 |
| **Spam Detection** | Validate không phải spam pattern (repeated chars, gibberish) |
| **Counter-Offer**  | Sau reject, gợi ý responder tạo counter-offer                |

**DTO Validation:**

```typescript
// respond-to-settlement.dto.ts
@IsString()
@MinLength(50, {
  message: 'Please provide a detailed rejection reason (minimum 50 characters)...'
})
@IsOptional()
rejectedReason?: string;
```

**Service Functions:**

```typescript
// Unit Function (settlement.service.ts)
validateRejectionReason(reason); // ✅ Implemented: checks length + spam patterns

// Compose Function (updated)
processRejectSettlement(); // ✅ Updated: validates reason, emits counterOfferPrompt
```

**Events Emitted:**

- `settlement.rejected` → includes `counterOfferPrompt: { canCreateOffer, remainingAttempts }`

---

#### **Edge Case 3: "Staff vô hình" (Invisible Staff)** ✅

**Vấn đề:** Staff muốn gợi ý nhưng không có cơ chế formal. Hoặc parties stuck, cần guidance.

**Giải pháp:**

| Component            | Implementation                                       |
| -------------------- | ---------------------------------------------------- |
| **Staff Suggestion** | Staff có thể tạo gợi ý settlement (non-binding)      |
| **Similar Cases**    | Có thể reference cases tương tự                      |
| **Reasoning**        | Bắt buộc giải thích logic                            |
| **NOT Settlement**   | Không count vào settlement attempts, chỉ là advisory |

**DTO:**

```typescript
// create-staff-suggestion.dto.ts ✅ Created
CreateStaffSuggestionDto {
  suggestedAmountToFreelancer: number;  // @Min(0)
  suggestedAmountToClient: number;      // @Min(0)
  reasoning: string;                    // @MinLength(20)
  similarCaseReferences?: string;       // Optional
}
```

**Service Functions:**

```typescript
// Compose Function (settlement.service.ts)
createStaffSuggestion(disputeId, staffId, dto); // ✅ Implemented

// Helper for verdict
getNonComplianceSummary(disputeId); // ✅ Implemented: used in verdict decisions
```

**Controller Endpoints:**

```typescript
// settlement.controller.ts ✅ Updated
POST /disputes/:disputeId/settlements/suggestion   // Staff only
GET  /disputes/:disputeId/chat-lock-status         // Check if chat locked
GET  /disputes/:disputeId/settlements/non-compliance  // Non-compliance summary
```

**Events Emitted:**

- `settlement.staffSuggestion` → includes suggestion details + feeBreakdown
- `notification.settlement` → notifies both parties

---

#### **Edge Cases Feature Matrix**

| Edge Case           | Chat Lock | Min 50 Chars | Staff Suggest | Non-Compliance Track |
| ------------------- | --------- | ------------ | ------------- | -------------------- |
| Silent Treatment    | ✅        | —            | —             | ✅                   |
| No-Reason Rejection | —         | ✅           | —             | —                    |
| Invisible Staff     | —         | —            | ✅            | ✅ (view only)       |

---

## **PHASE 3: STAFF ASSIGNMENT SYSTEM - Auto-Assignment** (DONE)

**Backend status:**

- DONE: auto-assign staff, workload scoring, skill matching, emergency reassign, performance metrics (calc only)

_Ước tính: 2-3 ngày_

### 3.1. Staff Assignment Service - Unit Functions

#### **Unit Function 3.1.1: `getAvailableStaff()`**

```typescript
Purpose: Lấy danh sách staff có thể nhận dispute
Input: date (optional)
Output: Staff[] with workload info
Algorithm:
- Query users WHERE role = STAFF AND isActive = true
- Left join staff_workload (date = today)
- Filter canAcceptNewEvent = true (utilizationRate < 80%)
- Exclude staff isOnLeave = true
Why: Chỉ assign cho staff không quá tải
Index needed: (role, isActive, date) composite
```

#### **Unit Function 3.1.2: `calculateStaffScore()`**

```typescript
Purpose: Tính điểm ưu tiên cho staff (dùng trong auto-assign)
Input: staff, workload, performance
Output: number (0-100)
Algorithm: Weighted scoring
- Workload factor (40%): 100 - utilizationRate
  (Staff ít việc hơn = điểm cao hơn)
- Performance factor (40%):
  * avgUserRating * 20 (1-5 stars → 0-100)
  * overturnRate penalty: -overturnRate * 50
- Fairness factor (20%):
  * Ưu tiên staff ít disputes nhất trong tháng (round-robin)
Why multi-factor:
- Workload: Tránh burnout
- Performance: Staff giỏi được ưu tiên
- Fairness: Không để staff yếu bị bỏ quên (cần train)
```

#### **Unit Function 3.1.3: `estimateDisputeComplexity()`**

```typescript
Purpose: Đánh giá độ phức tạp dispute để estimate workload
Input: dispute (type, description length, evidence count)
Output: { complexityLevel: 'LOW'|'MEDIUM'|'HIGH', estimatedMinutes: number }
Algorithm: Rule-based scoring
- Base: 60 minutes
- Type weight: CONTRACT_DISPUTE (+30), QUALITY_ISSUE (+20), PAYMENT (+15)
- Evidence count: +10 minutes per evidence (max +60)
- Description length: >1000 chars (+15), >2000 chars (+30)
Why: Để auto-schedule có thể block đủ thời gian
```

### 3.2. Staff Assignment Service - Compose Functions

#### **Compose Function 3.2.1: `autoAssignStaffToDispute()`**

```typescript
Flow:
1. getAvailableStaff()
2. Load performance data cho từng staff (batch query)
3. calculateStaffScore() cho từng candidate
4. Sort by score DESC
5. Pick top staff
6. estimateDisputeComplexity()
7. Update dispute (assignedStaffId, assignedAt)
8. Create/update staff_workload (increment totalDisputesPending)
9. Emit DISPUTE_ASSIGNED event (notify staff)
10. Log activity
Transaction: Yes
Fallback strategy:
- Nếu không có staff available → assign to queue (manual assign later)
- Notify admin về staff shortage
Algorithm choice: Greedy + scoring (not ML)
Why not ML:
- Ít data lúc đầu (cold start problem)
- Rule-based explainable (staff hiểu tại sao được assign)
- Có thể refine rules dễ dàng
```

#### **Compose Function 3.2.2: `reassignDispute()`**

```typescript
Purpose: Admin thủ công reassign dispute cho staff khác
Flow:
1. Load dispute + old staff workload
2. Validate new staff exists và isActive
3. Update dispute.assignedStaffId
4. Decrement old staff workload.totalDisputesPending
5. Increment new staff workload.totalDisputesPending
6. Log reassignment reason
7. Emit DISPUTE_REASSIGNED event
Why separate: Manual override cần audit trail riêng
```

#### **Compose Function 3.2.3: `updateDailyWorkload()`**

```typescript
Purpose: Cron job update workload mỗi ngày
Flow:
1. Get all staff
2. For each staff:
   a. Query calendar_events (date = today, organizer = staff)
   b. Sum scheduledMinutes from events
   c. Count disputes (status = PENDING, assignedStaff = staff)
   d. Calculate utilizationRate
   e. Update staff_workload record (upsert)
Algorithm: Bulk upsert (PostgreSQL ON CONFLICT DO UPDATE)
Scheduling: Chạy lúc 00:00 mỗi ngày + realtime update sau mỗi event change
Why daily: Workload metrics cần fresh để auto-assign chính xác
```

### 3.3. Staff Performance Tracking

#### **Compose Function 3.3.1: `updateStaffPerformance()`**

```typescript
Purpose: Aggregate performance metrics (monthly/quarterly)
Trigger:
- After verdict issued
- After feedback submitted
- End of month (cron)
Flow:
1. Query disputes (assignedStaff, resolutionDate in period)
2. Aggregate metrics:
   - totalDisputesResolved = COUNT(*)
   - totalAppealed = COUNT(WHERE dispute.status = APPEALED)
   - avgResolutionTimeHours = AVG(resolutionDate - createdAt)
3. Query verdicts (WHERE overridesVerdictId = staff's verdict) → overturnRate
4. Query feedbacks (WHERE staffId = staff, period) → avgUserRating
5. Upsert staff_performance
Algorithm: Incremental update (không recalculate full history mỗi lần)
Why incremental: Performance - chỉ update delta
```

---

## **PHASE 4: HEARING SYSTEM - Live Chat Control** (PARTIAL - schedule/start/statement/question/end)

**Backend status:**

- PARTIAL: validateHearingSchedule, determineRequiredParticipants, canControlSpeaker, scheduleHearing, startHearing, submitHearingStatement (draft/submit), askHearingQuestion, endHearing, updateSpeakerControl, moderator disconnect/reconnect
- TODO: reschedule, live chat persistence, WebSocket

_Ước tính: 3-4 ngày_

### 4.1. Hearing Service - Unit Functions

#### **Unit Function 4.1.1: `validateHearingSchedule()`**

```typescript
Purpose: Kiểm tra lịch hearing hợp lệ
Input: scheduledAt, participantIds[]
Output: { valid: boolean, conflicts?: string[] }
Algorithm:
- Check scheduledAt >= now + 24h (notice period)
- Query user_availability cho participants → phát hiện conflicts
- Query existing calendar_events (participants overlap) → double-booking check
Why 24h notice: Legal requirement - cho phép participants prepare
```

#### **Unit Function 4.1.2: `determineRequiredParticipants()`**

```typescript
Purpose: Xác định ai bắt buộc phải tham dự
Input: dispute (raiser, defendant, staff)
Output: { userId: string, role: ParticipantRole, isRequired: boolean }[]
Algorithm: Business rules
- Tier 1 (Staff): raiser (REQUIRED), defendant (REQUIRED), staff (MODERATOR)
- Tier 2 (Admin): raiser (REQUIRED), defendant (REQUIRED), admin (MODERATOR), original staff (OBSERVER - optional)
Why explicit: Tránh confusion về ai phải có mặt
```

#### **Unit Function 4.1.3: `canControlSpeaker()`**

```typescript
Purpose: Check permissions thay đổi speaker role (mute/unmute)
Input: userId, hearingId
Output: boolean
Algorithm: Only moderator (staff/admin) can control
Why: Prevent participants tự mute người khác
```

### 4.2. Hearing Service - Compose Functions

#### **Compose Function 4.2.1: `scheduleHearing()`** Check

```typescript
Flow:
1. Load dispute + check status (phải UNDER_REVIEW sau khi settlement failed)
2. validateHearingSchedule()
3. determineRequiredParticipants()
4. estimateDisputeComplexity() → estimatedDurationMinutes
5. Create HearingEntity (status = SCHEDULED, tier = 1 or 2)
6. Create CalendarEventEntity (type = DISPUTE_HEARING, reference = hearing)
7. Create EventParticipantEntity cho từng participant
8. Send invitations (email + notification) với responseDeadline (7 days)
9. Emit HEARING_SCHEDULED event
Transaction: Yes (hearing + calendar + participants)
Rollback: Nếu send invitation fail → vẫn keep DB records, retry later
```

#### **Compose Function 4.2.2: `startHearing()`** Check

```typescript
Purpose: Bắt đầu hearing session (activate live chat)
Flow:
1. Load hearing + check status = SCHEDULED
2. Check scheduledAt <= now + 15min buffer (không start quá sớm)
3. Update hearing.status = IN_PROGRESS
4. Update hearing.isChatRoomActive = true
5. Set currentSpeakerRole = ALL (default - everyone can chat)
6. Update calendar_event.status = IN_PROGRESS
7. Track participant attendance (joinedAt timestamps)
8. Emit HEARING_STARTED event (open WebSocket room)
Transaction: Yes
Why WebSocket: Real-time chat cần bidirectional communication
```

#### **Compose Function 4.2.3: `updateSpeakerControl()`** Check

```typescript
Purpose: Moderator điều khiển ai được phát ngôn
Flow:
1. Load hearing + canControlSpeaker(userId)
2. Update hearing.currentSpeakerRole
3. Emit SPEAKER_CONTROL_CHANGED event (WebSocket broadcast)
Modes:
- ALL: Mọi người chat tự do
- MODERATOR_ONLY: Chỉ moderator chat (đọc quy định)
- RAISER_ONLY: Chỉ raiser trả lời câu hỏi
- DEFENDANT_ONLY: Chỉ defendant trả lời
- MUTED_ALL: Pause để moderator suy nghĩ
Why granular control: Tránh chaos, đảm bảo due process
```

#### **Compose Function 4.2.4: `submitHearingStatement()`**check

```typescript
Purpose: Participant nộp statement văn bản (trước/trong hearing)
Flow:
1. Load hearing + check participant permissions
2. Create HearingStatementEntity
3. Attach evidence references (evidenceIds[])
4. Emit STATEMENT_SUBMITTED event
5. If during hearing → notify moderator realtime
Why separate from messages: Statements là official testimony, messages là chat
```

#### **Compose Function 4.2.5: `askHearingQuestion()`**check

```typescript
Purpose: Moderator đặt câu hỏi chính thức
Flow:
1. canControlSpeaker(userId)
2. Create HearingQuestionEntity (targetUserId, questionText)
3. Set currentSpeakerRole = RAISER_ONLY hoặc DEFENDANT_ONLY (auto)
4. Emit QUESTION_ASKED event
5. Start timer (questionDeadline = +10 minutes)
Why structured: Questions/Answers phải trackable cho verdict reasoning
```

#### **Compose Function 4.2.6: `endHearing()`**check

```typescript
Flow:
1. Load hearing + check status = IN_PROGRESS
2. Update status = COMPLETED
3. Update isChatRoomActive = false (close chat)
4. Update calendar_event.status = COMPLETED
5. Track participant leftAt timestamps
6. Generate hearing transcript (aggregate messages/statements/questions)
7. Emit HEARING_ENDED event (close WebSocket room)
8. Update dispute.status = AWAITING_VERDICT
Why transcript: Staff cần review lại toàn bộ hearing để viết verdict
```

#### **Compose Function 4.2.7: `rescheduleHearing()`**check

```typescript
Flow:
1. Load hearing + check status = SCHEDULED
2. Check rescheduleCount < 3 (max)
3. Validate new time (validateHearingSchedule)
4. Create new HearingEntity (previousHearingId = old hearing)
5. Cancel old hearing (status = RESCHEDULED)
6. Update calendar event
7. Increment rescheduleCount
8. Notify participants
Why limit 3: Tránh vô tận reschedule, force proceed sau 3 lần
```

### 4.3. Message Service (Live Chat)

#### **Compose Function 4.3.1: `sendDisputeMessage()`**check

```typescript
Flow:
1. Load dispute/hearing context
2. If hearing active:
   a. Check currentSpeakerRole → validate sender có quyền chat không
   b. If not allowed → return error
3. Create MessageEntity
4. If type = EVIDENCE_LINK → link to relatedEvidenceId
5. If replyToMessageId → validate message tồn tại
6. Emit MESSAGE_SENT event (WebSocket realtime)
7. Save to DB (WORM - không có update/delete)
Transaction: No (high-frequency writes)
Why WORM: Legal compliance - chat history immutable
```

#### **Compose Function 4.3.2: `hideMessage()`**check

```typescript
Purpose: Admin/Staff soft-hide inappropriate messages
Flow:
1. canControlSpeaker(userId)
2. Update message.isHidden = true, hiddenReason
3. Emit MESSAGE_HIDDEN event
Why soft-hide: Vẫn keep evidence cho appeal case
```

### 4.4. Hearing Controller

```typescript
POST /disputes/:id/hearings (schedule)
POST /hearings/:id/start (start session)
POST /hearings/:id/end (end session)
PATCH /hearings/:id/speaker-control (moderator control)
POST /hearings/:id/statements (submit statement)
POST /hearings/:id/questions (ask question)
POST /hearings/:id/reschedule (reschedule request)

WebSocket: /ws/hearings/:id (real-time chat)
```

---

## **PHASE 5: VERDICT SYSTEM - Structured Judgment** (TODO)

**Backend status:**

- TODO: verdict.service + verdict.controller + structured reasoning + appeal verdict flow
- NOTE: DisputesService.resolveDispute exists (basic verdict + money transfer), not wired to DisputeVerdictEntity

_Ước tính: 2 ngày_

### 5.1. Verdict Service - Unit Functions

#### **Unit Function 5.1.1: `validateVerdictReasoning()`**check

```typescript
Purpose: Validate structured reasoning đầy đủ
Input: VerdictReasoningDto
Output: { valid: boolean, errors: string[] }
Algorithm: Business rules
- violatedPolicies: min 1 item, format "CODE-X.Y: Description"
- supportingEvidenceIds: validate UUIDs exist
- factualFindings: min 100 chars
- legalAnalysis: min 100 chars
- conclusion: min 50 chars
Why strict: Đảm bảo verdict có chất lượng, không mơ hồ , có tính minh bạch và pháp lý nếu staff hay nền tảng vi phạm
```

#### **Unit Function 5.1.2: `validateMoneyDistribution()`**check

```typescript
Purpose: Verify money split logic
Input: amountToFreelancer, amountToClient, escrowFundedAmount
Output: { valid: boolean, error?: string }
Algorithm: Same as settlement validation
- Sum <= fundedAmount
- platformFee tự động = fundedAmount - sum (remaining)
Why: Tránh arithmetic errors
```

#### **Unit Function 5.1.3: `calculateTrustScorePenalty()`**check

```typescript
Purpose: Suggest penalty dựa trên faultType
Input: faultType, severity (optional)
Output: number (0-100)
Algorithm: Penalty matrix
- FRAUD: 100 (max)
- GHOSTING: 50
- NON_DELIVERY: 30-50 (depending on severity)
- QUALITY_MISMATCH: 20-40
- DEADLINE_MISSED: 10-30
- MUTUAL_FAULT: 10 (both parties)
- NO_FAULT: 0
Why matrix: Consistency - staff có guideline, không arbitrary
Note: Staff có thể override suggestion
```

### 5.2. Verdict Service - Compose Functions

#### **Compose Function 5.2.1: `issueVerdict()`**check

```typescript
Flow:
1. Load dispute + hearing transcript
2. validateVerdictReasoning()
3. validateMoneyDistribution()
4. Suggest penalty (calculateTrustScorePenalty) - staff có thể adjust
5. Create VerdictEntity (tier = 1 if staff, 2 if admin)
6. Update dispute:
   a. status = RESOLVED
   b. result = verdict.result
   c. resolvedAt = now
   d. appealDeadline = now + 3 days
7. Trigger money transfer (amountToFreelancer, amountToClient, platformFee)
8. Apply penalties:
   a. Update user.trustScore -= penalty
   b. If banUser = true → user.bannedUntil = now + banDurationDays
9. Create legal signatures (ACCEPT_VERDICT for both parties)
10. Send verdict notifications (email + SMS)
11. Update staff performance (increment totalDisputesResolved)
12. Emit VERDICT_ISSUED event
Transaction: Critical (money + trust score + ban)
Rollback: Nếu money transfer fail → rollback toàn bộ verdict
Why strict transaction: Financial integrity tối thượng
```

#### **Compose Function 5.2.2: `appealVerdict()`**check

```typescript
Purpose: User appeal lên Admin (Tier 2)
Flow:
1. Load dispute + verdict (tier 1)
2. Check appealDeadline chưa quá hạn (3 days)
3. Validate appealReason (min 200 chars)
4. Update dispute:
   a. status = APPEALED
   b. currentTier = 2
   c. escalatedAt = now
   d. escalationReason = appealReason
5. Auto-assign admin (autoAssignStaffToDispute with role filter = ADMIN)
6. Create legal signature (APPEAL_SUBMISSION)
7. Schedule Tier 2 hearing (required)
8. Emit VERDICT_APPEALED event
9. Notify original staff (performance impact warning)
Why auto-assign admin: Tránh delay, admin phải xử lý nhanh
```

#### **Compose Function 5.2.3: `issueAppealVerdict()`**check

```typescript
Purpose: Admin ra verdict Tier 2 (final)
Flow:
1. Same as issueVerdict() với additions:
   a. overridesVerdictId = Tier 1 verdict
   b. overrideReason (required)
2. If verdict khác Tier 1:
   a. Reverse Tier 1 money transfer
   b. Apply new money distribution
   c. Reverse Tier 1 penalties
   d. Apply new penalties
   e. Update original staff performance:
      - Increment totalOverturnedByAdmin
      - Recalculate overturnRate
3. Update dispute.status = RESOLVED_FINAL (không appeal thêm được)
Transaction: Super critical (reverse transactions)
Rollback strategy:
- Log all reversal steps
- If fail → manual intervention required (alert dev team)
Why complex: Reversal is risky, cần handle cẩn thận
```

### 5.3. Verdict Controller

```typescript
POST /disputes/:id/verdict (issue verdict - staff/admin)
POST /verdicts/:id/appeal (user appeal)
GET /disputes/:id/verdict (view verdict)
GET /disputes/:id/verdict/transcript (hearing + verdict full document)
```

---

## **PHASE 6: CALENDAR & AUTO-SCHEDULING** (TODO)

**Backend status:**

- TODO: calendar module services/controllers + auto-scheduling (entities + dto only)

_Ước tính: 3-4 ngày_

### 6.1. Calendar Service - Unit Functions

#### **Unit Function 6.1.1: `findAvailableSlots()`**check

```typescript
Purpose: Tìm khung giờ trống cho participants
Input: userIds[], duration, dateRange, preferences
Output: TimeSlot[] sorted by score
Algorithm: Constraint satisfaction
1. Load user_availability cho tất cả users
2. Filter AVAILABLE slots, exclude BUSY/OUT_OF_OFFICE
3. Find intersection (slots tất cả users đều rảnh)
4. Check calendar_events → remove occupied slots
5. Apply auto_schedule_rules (working hours, lunch break avoidance)
6. Score slots:
   - Preferred slots: +50 points
   - Morning (9-11am): +20 (fresh mind)
   - After lunch (2-4pm): +10
   - Late afternoon (4-6pm): 0 (tired)
   - Outside working hours: -100 (penalize)
7. Sort by score DESC
Algorithm choice: Greedy + scoring (not CP-SAT solver)
Why not CP-SAT:
- Overkill cho simple scheduling
- Greedy đủ nhanh (<100ms cho 10 participants)
- Dễ debug và explain kết quả
Optimization: Cache availability per user (1 hour TTL)
```

#### **Unit Function 6.1.2: `estimateEventDuration()`**check

```typescript
Purpose: Estimate thời gian cần cho event type
Input: eventType, complexity (optional)
Output: minutes
Algorithm: Lookup table
- DISPUTE_HEARING: 60-180 min (based on complexity)
- PROJECT_MEETING: 30-60 min
- INTERNAL_MEETING: 30 min
- REVIEW_SESSION: 45 min
Why estimates: Để block đủ calendar space
```

### 6.2. Auto-Schedule Service - Compose Functions

#### **Compose Function 6.2.1: `autoScheduleEvent()`**check

```typescript
Flow:
1. Load auto_schedule_rules (active = true)
2. determineRequiredParticipants()
3. estimateEventDuration()
4. findAvailableSlots(participants, duration, rules)
5. If slots found:
   a. Pick best slot (highest score)
   b. Create CalendarEventEntity (isAutoScheduled = true)
   c. Create EventParticipantEntity for each user
   d. Block time in user_availability (auto-generate BUSY slots)
   e. Update staff_workload (increment scheduledMinutes)
   f. Send invitations with PENDING status (participants phải confirm)
6. If no slots:
   a. Return manual scheduling required
   b. Suggest alternative dates (widen date range)
   c. Notify admin
Transaction: Yes
Why participant confirmation: Tránh force calendar không hợp lý
```

#### **Compose Function 6.2.2: `handleRescheduleRequest()`**check

```typescript
Flow:
1. Load event + reschedule request
2. If user proposed slots:
   a. Validate each proposed slot against participants availability
   b. Score slots
   c. If valid slot found → update event
   d. If no valid slot → suggest alternatives
3. If user requested auto-schedule:
   a. Call autoScheduleEvent() with new date range
4. Update reschedule_request.status
5. Notify all participants
6. Increment event.rescheduleCount
7. If rescheduleCount > maxRescheduleCount:
   a. Lock event (no more reschedule)
   b. Force proceed or cancel
Algorithm: Try user proposals first (respect user preference)
Why proposal system: Balance automation với user control
```

#### **Compose Function 6.2.3: `processEventInvitations()`**check

```typescript
Purpose: Handle participant responses (ACCEPT/DECLINE/TENTATIVE)
Flow:
1. Update event_participant.participantStatus
2. If DECLINE by REQUIRED participant:
   a. Check if reschedule needed
   b. If yes → trigger handleRescheduleRequest()
   c. If no alternatives → escalate to manual
3. If all REQUIRED accepted:
   a. Update event.status = SCHEDULED (confirmed)
   b. Send final confirmations
4. Track response rate (responseDeadline)
Why separate: Invitation workflow phức tạp, cần state machine riêng
```

### 6.3. Availability Service

#### **Compose Function 6.3.1: `setUserAvailability()`**check

```typescript
Flow:
1. Validate time slots (no overlaps)
2. Create/Update AvailabilityEntity
3. If recurring:
   a. Generate instances cho date range
   b. Exclude holidays/weekends (if configured)
4. Emit AVAILABILITY_UPDATED event
5. Trigger re-schedule conflicts (if any existing events conflict)
Why recurring: Staff set "Thứ 2-6, 9am-5pm" 1 lần, auto-apply
```

#### **Compose Function 6.3.2: `syncCalendarEvents()`**check

```typescript
Purpose: Auto-generate BUSY slots from scheduled events
Flow:
1. Query calendar_events (status = SCHEDULED, date range)
2. For each event:
   a. Create AvailabilityEntity (type = BUSY, isAutoGenerated = true)
   b. Link linkedEventId
3. Delete old auto-generated slots (cleanup)
Trigger: After event created/updated/cancelled
Why: Keep availability fresh, prevent double-booking
```

### 6.4. Calendar Controller

```typescript
POST /calendar/events (create event)
GET /calendar/events (list with filters)
PATCH /calendar/events/:id (update)
POST /calendar/events/:id/reschedule (request reschedule)
POST /calendar/events/:id/respond (accept/decline invitation)

POST /calendar/availability (set availability)
GET /calendar/availability/common (find common slots for users)
GET /calendar/availability/staff (staff availability grid view)
```

---

## **PHASE 7: INTEGRATION & REFACTORING** (TODO)

_Ước tính: 2-3 ngày_

### 7.1. Refactor DisputesService (Existing)

#### **Changes:**

```typescript
Current createDispute():
+ Add auto-assign staff (call staff-assignment.service)
+ Create initial calendar availability check
+ Generate legal signature (CREATE_DISPUTE)

Current resolveDispute():
- DEPRECATE → replace with verdict.service.issueVerdict()
- Migrate existing data

Current appealDispute():
- DEPRECATE → replace with verdict.service.appealVerdict()

New orchestration methods:
+ handleDisputeWorkflow() - master flow controller
+ checkSettlementEligibility() - decide next step
+ escalateToHearing() - trigger hearing after settlement fails
```

### 7.2. Event System Integration

#### **Events to implement:**

```typescript
DISPUTE_CREATED → Auto-assign staff
SETTLEMENT_FAILED → Schedule hearing
HEARING_ENDED → Prompt staff to issue verdict
VERDICT_ISSUED → Start appeal countdown
APPEAL_DEADLINE_PASSED → Finalize dispute
STAFF_OVERLOADED → Alert admin to hire more
```

**Why event-driven:** Decouple services, easier to add features later

### 7.3. WebSocket Gateway (Real-time)

#### **Rooms:**

```typescript
/ws/disputes/:id - Dispute updates
/ws/hearings/:id - Live chat room
/ws/staff/dashboard - Staff notification center
```

**Events:**

```typescript
MESSAGE_SENT - New chat message
SPEAKER_CONTROL_CHANGED - Mute/unmute
EVIDENCE_UPLOADED - New evidence notification
SETTLEMENT_OFFERED - Real-time settlement alert
```

---

## **PHASE 8: TESTING & OPTIMIZATION** (TODO)

_Ước tính: 3-4 ngày_

### 8.1. Unit Tests

**Target coverage: 80%+**

Priority test cases:

- Money logic (settlement, verdict distribution)
- Penalty calculations
- Auto-assignment scoring
- Scheduling conflicts detection
- Structured reasoning validation

### 8.2. Integration Tests

**Scenarios:**

1. Full dispute flow: Create → Settlement fail → Hearing → Verdict → Appeal
2. Auto-assignment under high load (100 disputes/day)
3. Calendar scheduling với 20 participants
4. Concurrent message sending (race conditions)

### 8.3. Performance Optimization

#### **Database indices:**

```sql
CREATE INDEX idx_disputes_assigned_staff ON disputes(assigned_staff_id, status);
CREATE INDEX idx_calendar_events_date ON calendar_events(start_time, status);
CREATE INDEX idx_staff_workload_date ON staff_workload(staff_id, date);
CREATE INDEX idx_messages_hearing ON dispute_messages(hearing_id, sent_at);
```

#### **Query optimization:**

- Eager loading relations (avoid N+1)
- Batch queries for list endpoints
- Implement pagination (limit 20/page default)

#### **Caching strategy:**

- Staff availability: Redis (1 hour TTL)
- Auto-schedule rules: Redis (24 hours TTL)
- User performance metrics: Redis (1 hour TTL)

---

## 📊 IMPLEMENTATION TIMELINE

| Phase               | Duration | Dependencies   | Risk Level | Status  |
| ------------------- | -------- | -------------- | ---------- | ------- |
| 1. Evidence         | 1-2 days | Supabase setup | LOW        | PARTIAL |
| 2. Settlement       | 1 day    | Phase 1        | LOW        | DONE    |
| 3. Staff Assignment | 2-3 days | None           | MEDIUM     | DONE    |
| 4. Hearing          | 3-4 days | Phase 1, 3     | HIGH       | PARTIAL |
| 5. Verdict          | 2 days   | Phase 4        | MEDIUM     | TODO    |
| 6. Calendar         | 3-4 days | Phase 3        | HIGH       | TODO    |
| 7. Integration      | 2-3 days | All above      | MEDIUM     | TODO    |
| 8. Testing          | 3-4 days | All above      | LOW        | TODO    |

**Total: 17-25 days (3-5 weeks)**

---

## 🚨 RISKS & MITIGATION

### Risk 1: Auto-scheduling không tìm được slot

**Mitigation:** Fallback to manual scheduling + suggest widen date range

### Risk 2: Money transfer reversal failed (trong appeal)

**Mitigation:**

- Idempotency keys
- Transaction logs
- Manual intervention workflow

### Risk 3: WebSocket scalability (nhiều concurrent hearings)

**Mitigation:**

- Redis pub/sub for multi-instance
- Rate limiting per room
- Message queue for persistence

### Risk 4: Staff scoring algorithm unfair

**Mitigation:**

- A/B test different weights
- Admin dashboard để monitor distribution
- Manual override capability

---

## ✅ SUCCESS CRITERIA

**Functional:**

- ✅ Dispute resolution rate > 80% (settlement hoặc verdict)
- ✅ Staff workload balanced (std deviation < 20%)
- ✅ Auto-scheduling success rate > 70%
- ✅ Appeal overturn rate < 15% (staff quality)

**Technical:**

- ✅ API response time < 200ms (p95)
- ✅ WebSocket message latency < 100ms
- ✅ Test coverage > 80%
- ✅ Zero money loss incidents

---

## 🏷️ TAGGING SYSTEM (Master Taxonomy) ✅ COMPLETED

### Cấu trúc 2 tầng (Two-Layer Taxonomy)

**Layer 1 - Domains (Lĩnh vực):** `skill_domains` table

- E-commerce, FinTech, EdTech, Healthcare, Mobile App, Web System
- Matching weight: 30% (khi user khớp domain)

**Layer 2 - Skills (Kỹ năng):** `skills` table

- Frontend: ReactJS, Vue.js, Angular, Next.js, TypeScript
- Backend: Node.js, NestJS, Python/Django, Java/Spring
- Mobile: Flutter, React Native, Swift, Kotlin
- DevOps: AWS, Docker, Kubernetes, CI/CD
- Matching weight: 70% (khi user khớp skill)

### Role-based Tagging

| Actor      | Tag Type         | Mechanism                         | Table                        |
| ---------- | ---------------- | --------------------------------- | ---------------------------- |
| Freelancer | Tech Stack       | Multiselect from master list      | `user_skills`                |
| Broker     | Domain Expertise | BA, PM, Consulting skills         | `user_skills`                |
| Staff      | Audit Skills     | Security, Code Quality, Financial | `staff_expertise`            |
| Client     | Business Needs   | Auto-mapped from Wizard answers   | (via `wizard_mapping`)       |
| Dispute    | Required Skills  | Auto-detected from category       | `dispute_skill_requirements` |

### Database Schema

```sql
skill_domains          → Layer 1: Domains (E-commerce, FinTech, etc.)
skills                 → Layer 2: Skills (ReactJS, NestJS, etc.)
user_skills            → User-Skill junction (Primary/Secondary, Verified)
staff_expertise        → Staff audit skills with expertise level
dispute_skill_requirements → Dispute required skills
skill_mapping_rules    → Auto-tagging rules (DisputeCategory → Skills)
```

### Staff Assignment Integration

```typescript
// In staff-assignment.service.ts
autoDetectRequiredSkills(disputeId, category)  // Auto-tag dispute
calculateSkillMatchScore(staffId, disputeId)   // 0-100 skill match
getStaffBySkillMatch(disputeId, staffIds)      // Sort by skill match
tagDisputeWithSkill(disputeId, skillId, ...)   // Manual tagging
updateStaffExpertiseStats(staffId, disputeId)  // Update stats post-resolution
```

### Matching Algorithm (Binary Matching)

```typescript
// Simple: Has skill or not (không có điểm level 1-10)
if (staffHasRequiredSkill && expertiseLevel >= requiredLevel) {
  score += skill.isMandatory ? 100 : 50;
}
```

### Files Created

- `database/entities/skill-domain.entity.ts`
- `database/entities/skill.entity.ts`
- `database/entities/user-skill.entity.ts` (UserSkillEntity + StaffExpertiseEntity)
- `database/entities/dispute-skill.entity.ts` (DisputeSkillRequirementEntity + SkillMappingRuleEntity)
- `database/migrations/tagging-system.sql` (Schema + Seed data)

---

## 📝 NOTES

**Completed:**

- Phase 1: Evidence Service PARTIAL (missing git evidence)
- Phase 2: Settlement Service with edge cases DONE
- Phase 3: Staff Assignment Service with edge cases DONE
- Tagging System: Master Taxonomy for skill-based matching DONE
- ✅ Supabase bucket policies configured
- ✅ All DTOs created for disputes and calendar modules
- ✅ All entities created with proper relationships

**Next Steps:**

- Phase 4: Hearing Service implementation (remaining scheduling + live chat)
- Phase 5: Verdict Service implementation (service + controller)
- Phase 6: Calendar/Scheduling Service (module + services + controller)

**Contact:** Kiến trúc sư trưởng để review và approve plan này trước khi tiếp tục code.
