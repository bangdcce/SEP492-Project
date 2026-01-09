# 🔍 DISPUTE RESOLUTION - EDGE CASES & BUSINESS LOGIC ANALYSIS

## 📋 DANH SÁCH EDGE CASES ĐÃ PHÁT HIỆN

### 1. ⚠️ **BROKER VS FREELANCER - Money Distribution Bug**

**Vấn đề:** Khi dispute là `BROKER_VS_FREELANCER`, việc phân chia tiền không chính xác vì:

- `calculateMoneyDistribution()` luôn dùng `project.freelancerId` để chuyển tiền cho freelancer
- Nhưng trong trường hợp `BROKER_VS_FREELANCER`, nếu `WIN_CLIENT` (broker thắng), broker nên nhận tiền

**Trường hợp:**

```
Broker kiện Freelancer → WIN_CLIENT → Broker thắng
Nhưng code chuyển tiền cho project.clientId (client thật) thay vì broker!
```

**Fix cần thiết:** Cần map verdict sang đúng người nhận dựa trên dispute type.

---

### 2. ⚠️ **THREE-WAY DISPUTE - Thiếu Support**

**Vấn đề:** Hiện tại dispute chỉ có 2 bên (raiser vs defendant).  
**Thực tế:** Có thể xảy ra tranh chấp 3 bên:

- Client kiện Freelancer, Broker cũng liên quan
- Freelancer kiện Client nhưng Broker là người môi giới

**Giải pháp:**

1. Thêm field `involvedPartyId` cho bên thứ 3
2. Hoặc tạo linked disputes với `parentDisputeId`

---

### 3. ⚠️ **PROJECT KHÔNG CÓ BROKER**

**Vấn đề:** Code assume `project.brokerId` luôn tồn tại trong `executeMoneyTransfers`:

```typescript
if (distribution.brokerAmount > 0 && project.brokerId) {
  // OK - có check
}
```

Nhưng `calculateMoneyDistribution` vẫn tính `brokerShare` từ escrow.

**Trường hợp:**

- Project không có broker (direct client-freelancer)
- `escrow.brokerShare = 0` nhưng `escrow.brokerPercentage` có thể không phải 0

**Đã handle:** ✅ Code đã check `project.brokerId` trước khi transfer

---

### 4. ⚠️ **ESCROW KHÔNG ĐỦ TIỀN**

**Vấn đề:** Không validate `escrow.totalAmount` có đủ để chuyển không.

**Trường hợp edge:**

- Escrow đã bị partial release trước đó (bug/hack)
- `totalAmount` không khớp với `developerShare + brokerShare + platformFee`

**Fix cần thiết:** Thêm validation trong `resolveDispute`:

```typescript
const expectedTotal = developerShare + brokerShare + platformFee;
if (Math.abs(totalAmount - expectedTotal) > 1) {
  throw new BadRequestException('Escrow amounts mismatch');
}
```

---

### 5. ⚠️ **WALLET KHÔNG TỒN TẠI**

**Vấn đề:** Code throw error nếu wallet không tồn tại:

```typescript
if (!wallet) {
  throw new NotFoundException(`Wallet for User "${userId}" not found`);
}
```

**Hậu quả:**

- Transaction bị rollback
- Dispute vẫn ở trạng thái IN_MEDIATION
- Admin phải tạo wallet cho user rồi resolve lại

**Fix cần thiết:** Auto-create wallet hoặc check trước khi resolve.

---

### 6. ⚠️ **CONCURRENT RESOLUTION**

**Vấn đề:** Nếu 2 admin resolve cùng 1 dispute cùng lúc?

**Đã handle:** ✅ Pessimistic lock trên dispute entity

---

### 7. ⚠️ **APPEAL TRONG THỜI GIAN CHUYỂN TIỀN**

**Vấn đề:** Nếu user appeal ngay sau khi resolve nhưng trước khi tiền vào ví?

**Đã handle:** ✅ Tất cả trong 1 transaction, không thể appeal trước khi commit.

---

### 8. ⚠️ **SPLIT RATIO VALIDATION**

**Vấn đề:** `splitRatioClient` không được validate trong business logic:

- `0%` → Client không nhận gì (hợp lệ?)
- `100%` → Giống WIN_CLIENT nhưng không penalize freelancer

**Cần clarify:**

- Min/Max ratio cho SPLIT?
- 0% và 100% có nên được phép không?

---

### 9. ⚠️ **MULTI-MILESTONE DISPUTE**

**Vấn đề:** Hiện tại dispute chỉ cho 1 milestone.

**Trường hợp thực tế:**

- Client muốn dispute nhiều milestones cùng lúc
- Freelancer làm sai toàn bộ project

**Giải pháp:** Sử dụng `groupId` để nhóm disputes, resolve hàng loạt.

---

### 10. ⚠️ **DEFENDANT KHÔNG RESPONSE**

**Vấn đề:** Nếu defendant không phản hồi trước deadline?

**Hiện tại:** Không có auto-action.

**Cần thêm:**

- Scheduled job check `responseDeadline`
- Auto-escalate hoặc auto-win cho raiser

---

## 🛠️ ĐỀ XUẤT CẢI THIỆN

### A. HEARING ROOM (Phòng xử án online)

**Mục đích:** Cho 3 bên trình bày, đặt câu hỏi, và Admin đưa ra phán quyết.

**Entities cần thêm:**

1. `DisputeHearingEntity` - Phiên điều trần
2. `HearingParticipantEntity` - Người tham gia
3. `HearingStatementEntity` - Lời khai/Bằng chứng
4. `HearingQuestionEntity` - Câu hỏi từ Admin

**Flow:**

1. Admin schedule hearing
2. Notify all parties
3. Các bên join và trình bày
4. Admin đặt câu hỏi
5. Admin conclude và resolve dispute

### B. NOTIFICATION SYSTEM

**Events cần listen:**

- `dispute.created` → Notify defendant + admin
- `dispute.escalated` → Notify all parties
- `dispute.deadline_approaching` → Remind
- `dispute.resolved` → Notify all parties + log

### C. AUTO-ESCALATION

**Cron job:**

```typescript
@Cron('0 * * * *') // Every hour
async checkDisputeDeadlines() {
  // Auto-escalate overdue OPEN disputes
  // Notify admin về urgent disputes
}
```

---

## ✅ NHỮNG GÌ ĐÃ LÀM TỐT

1. ✅ Pessimistic locking - Tránh race condition
2. ✅ Transaction atomicity - All or nothing
3. ✅ Trust score penalty - Trừ điểm người thua
4. ✅ Audit logging - Ghi lại mọi thay đổi
5. ✅ Event emission - Cho real-time notification
6. ✅ State machine - Validate transitions
7. ✅ VND rounding - Largest remainder method

---

## 📊 PRIORITY FIX

| Issue                      | Severity | Effort | Priority |
| -------------------------- | -------- | ------ | -------- |
| Broker vs Freelancer money | HIGH     | MEDIUM | 🔴 P0    |
| Wallet not exists          | HIGH     | LOW    | 🔴 P0    |
| Escrow validation          | MEDIUM   | LOW    | 🟡 P1    |
| Split ratio validation     | LOW      | LOW    | 🟢 P2    |
| Hearing Room               | MEDIUM   | HIGH   | 🟡 P1    |
| Auto-escalation            | MEDIUM   | MEDIUM | 🟡 P1    |
