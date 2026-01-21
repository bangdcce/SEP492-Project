# 🔐 KYC WATERMARK & ANTI-LEAK SYSTEM

## 📋 TỔNG QUAN

Hệ thống bảo vệ dữ liệu CCCD người dùng khỏi bị leak bởi Admin/Staff thông qua:
1. **Dynamic Watermark** - Mỗi lần xem có watermark định danh riêng
2. **Audit Logging** - Ghi lại mọi truy cập
3. **Frontend Protection** - Chặn screenshot, copy, print
4. **Forensic Tracking** - Nếu leak ra ngoài → Trace được nguồn gốc

---

## 🎯 MỤC ĐÍCH

**Vấn đề:**  
Admin/Staff có thể:
- Chụp màn hình CCCD
- Download ảnh
- Share cho người khác
- Bán thông tin

**Giải pháp:**  
- Mỗi ảnh CCCD có watermark chứa thông tin người xem
- Nếu leak ra ngoài → Nhìn watermark biết ngay ai leak
- Log đầy đủ để điều tra

---

## 🔧 CẤU TRÚC HỆ THỐNG

### 1. **Backend - Watermark Service**
File: `server/src/common/utils/watermark.util.ts`

**Tính năng:**
- Add watermark lên ảnh CCCD với thông tin:
  - Email admin/staff
  - Thời gian xem
  - IP address
  - Session ID
  - KYC ID
- Watermark **không thể crop** (repeating pattern)
- Watermark **semi-transparent** (vẫn đọc được CCCD)

**Ví dụ watermark:**
```
CONFIDENTIAL - DO NOT DISTRIBUTE
Viewed by: admin@interdev.com (ADMIN)
Time: 2026-01-19T14:30:00Z
IP: 192.168.1.100
Session: a7f3c2e9
KYC ID: kyc-xyz123
© InterDev Platform - All Rights Reserved
```

---

### 2. **Backend - Access Logging**
File: `server/src/database/entities/kyc-access-log.entity.ts`

**Ghi lại:**
- Ai xem (reviewerId, reviewerEmail, reviewerRole)
- Xem gì (kycId, accessedImages)
- Khi nào (createdAt)
- Ở đâu (ipAddress, userAgent)
- Tại sao (reason, reasonDetails)
- Có watermark không (watermarkApplied, watermarkId)
- Có suspicious không (flaggedAsSuspicious)

**Mục đích:**
- Compliance audit
- Investigation nếu có leak
- Ngăn chặn abuse

---

### 3. **Backend - KYC Service với Watermark**
File: `server/src/modules/kyc/kyc.service.ts`

**Flow Admin/Staff xem KYC:**
```typescript
1. Admin click "View KYC Detail"
2. Backend:
   a. Lấy KYC từ database
   b. Download ảnh encrypted từ Supabase
   c. Decrypt ảnh
   d. Add watermark (email admin + timestamp + IP)
   e. Log access vào kyc_access_logs
   f. Return base64 image (có watermark)
3. Frontend hiển thị ảnh (đã có watermark)
4. Nếu admin screenshot → Watermark vẫn còn!
```

**Method:**
```typescript
getKycByIdWithWatermark(
  id: string,
  reviewerId: string,
  reviewerEmail: string,
  reviewerRole: 'ADMIN' | 'STAFF',
  ipAddress: string,
  sessionId: string,
  userAgent: string,
  reason?: KycAccessReason,
)
```

---

### 4. **Frontend - Protection Utilities**
File: `client/src/shared/utils/kyc-protection.ts`

**Bảo vệ:**

**a. Disable Screenshot:**
- `Print Screen` → Blocked
- `Win + Shift + S` (Snipping Tool) → Blocked
- `Cmd + Shift + 3/4/5` (Mac) → Blocked
- Alert + Log nếu user cố gắng

**b. Disable Right-Click:**
- Context menu → Disabled
- Save Image As → Blocked

**c. Disable Copy/Print:**
- `Ctrl + C` → Blocked
- `Ctrl + P` → Blocked
- `Ctrl + S` → Blocked

**d. DevTools Detection:**
- Phát hiện nếu user mở DevTools
- Alert + Log suspicious activity

**e. Visual Indicators:**
- Warning banner màu đỏ ở top
- Transparent overlay pattern
- Toast notifications

**Usage:**
```tsx
import { enableKycProtection, disableKycProtection } from '@/shared/utils/kyc-protection';

function KycReviewPage() {
  useEffect(() => {
    enableKycProtection();
    return () => disableKycProtection();
  }, []);
  
  return <div>...</div>;
}
```

---

## 📊 FLOW HOÀN CHỈNH

### **Scenario 1: Admin Review KYC (Bình thường)**

```
1. User submit KYC → AI check → PENDING_REVIEW (85% confidence)

2. Admin login → Vào /admin/kyc

3. Admin click "View KYC #123"
   ↓
4. Frontend call: GET /api/admin/kyc/123/with-watermark
   Headers: {
     Authorization: Bearer <token>,
     X-Session-Id: <session>,
     X-Forwarded-For: <ip>
   }

5. Backend:
   a. Verify admin role
   b. Download ảnh encrypted từ Supabase
   c. Decrypt ảnh
   d. Add watermark:
      - "Viewed by: admin@interdev.com"
      - "Time: 2026-01-19 14:30:00"
      - "IP: 192.168.1.100"
   e. Save access log:
      - reviewerId: admin-id
      - action: VIEW_DETAIL
      - watermarkId: uuid-xyz
   f. Return base64 images

6. Frontend:
   a. Enable kyc-protection.ts
   b. Show warning banner
   c. Disable screenshot keys
   d. Display images (có watermark)

7. Admin xem CCCD → Thấy watermark rõ ràng

8. Nếu admin screenshot:
   a. Alert "Screenshots not allowed"
   b. Log suspicious activity
   c. Watermark vẫn còn trong ảnh!
```

---

### **Scenario 2: Admin Leak CCCD (Bị phát hiện)**

```
1. Admin xem KYC → Screenshot (bypass protection)

2. Admin share ảnh cho người khác

3. Người khác report về công ty

4. Công ty nhận ảnh → Nhìn watermark:
   "Viewed by: badmin@interdev.com"
   "Time: 2026-01-19 14:30:00"

5. Công ty tra log:
   SELECT * FROM kyc_access_logs
   WHERE reviewerEmail = 'badmin@interdev.com'
   AND createdAt = '2026-01-19 14:30:00';

6. Tìm thấy:
   - Admin: John Doe
   - IP: 192.168.1.100
   - Session: abc123
   - Watermark ID: uuid-xyz (match!)

7. Công ty:
   - Kỷ luật admin
   - Báo cơ quan chức năng
   - Khóa tài khoản
```

---

## 🛡️ MỨC ĐỘ BẢO MẬT

### **Layer 1: Encryption (Storage)**
- File trên Supabase: AES-256-GCM encrypted
- Hacker vào Supabase → Chỉ thấy file rác

### **Layer 2: Watermark (Visual)**
- Mọi ảnh admin xem đều có watermark
- Không thể remove (repeating pattern)

### **Layer 3: Access Control (Logic)**
- Chỉ Admin/Staff mới xem được
- Mỗi lần xem = 1 audit log

### **Layer 4: Frontend Protection (UI)**
- Block screenshot
- Block copy/print
- Detect DevTools

### **Layer 5: Forensic Tracking (Investigation)**
- Watermark ID unique
- Trace back to exact access log
- Legal evidence

---

## 🚀 CÁCH SỬ DỤNG

### **1. Admin muốn xem KYC:**

```typescript
// Frontend
const response = await fetch('/api/admin/kyc/123/with-watermark', {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});

const data = await response.json();
// {
//   documentFrontUrl: 'data:image/jpeg;base64,...', // Có watermark!
//   watermarkInfo: {
//     reviewerEmail: 'admin@interdev.com',
//     timestamp: '2026-01-19T14:30:00Z',
//     warning: 'CONFIDENTIAL - Forensic watermark applied'
//   }
// }
```

### **2. Tra log access:**

```sql
-- Xem ai đã xem KYC này
SELECT * FROM kyc_access_logs
WHERE kycId = 'kyc-123'
ORDER BY createdAt DESC;

-- Xem admin này xem bao nhiêu KYC
SELECT COUNT(*) FROM kyc_access_logs
WHERE reviewerEmail = 'admin@interdev.com'
AND action = 'VIEW_DETAIL';

-- Tìm suspicious activity
SELECT * FROM kyc_access_logs
WHERE flaggedAsSuspicious = true;
```

---

## ⚖️ COMPLIANCE & LEGAL

### **GDPR Compliance:**
- ✅ Access logs (Who accessed what, when)
- ✅ Data minimization (Only admin with reason)
- ✅ Right to audit (Full audit trail)

### **Vietnam Law:**
- ✅ Bảo mật thông tin cá nhân (CCCD encrypted)
- ✅ Truy vết được nguồn leak
- ✅ Bằng chứng pháp lý (Watermark + logs)

---

## 🔍 TESTING

### **Test 1: Watermark hiển thị đúng**
```bash
# Submit KYC
POST /api/kyc/submit

# Admin xem
GET /api/admin/kyc/123/with-watermark

# Verify watermark text có:
- Email admin
- Timestamp
- IP
- Session ID
```

### **Test 2: Screenshot bị block**
```bash
# Open KYC review page
# Press Print Screen → See alert
# Press Win+Shift+S → See alert
# Check console: "Screenshot attempt logged"
```

### **Test 3: Access log được ghi**
```sql
SELECT * FROM kyc_access_logs
WHERE kycId = 'kyc-123'
ORDER BY createdAt DESC
LIMIT 1;

-- Should see:
-- reviewerEmail, ipAddress, watermarkId, etc.
```

---

## 📝 LƯU Ý QUAN TRỌNG

1. **Watermark không thể xóa:**  
   Sử dụng repeating pattern + multiple positions

2. **Frontend protection không 100%:**  
   User có thể dùng phone chụp màn hình  
   → Watermark vẫn là defense cuối cùng!

3. **Access logs là bằng chứng pháp lý:**  
   Lưu permanent, không được xóa

4. **Staff chỉ xem PENDING:**  
   Staff không được xem APPROVED/REJECTED  
   (Chỉ Admin mới được)

5. **Compliance audit:**  
   Định kỳ review access logs để phát hiện abuse

---

## 🎯 KẾT LUẬN

Hệ thống này đảm bảo:
- ✅ Admin/Staff **không thể leak dữ liệu** mà không bị phát hiện
- ✅ Mọi truy cập đều **có audit trail**
- ✅ Nếu leak → **Trace được nguồn gốc** ngay lập tức
- ✅ **Compliant** với GDPR và luật Việt Nam

**Mục tiêu:** Bảo vệ dữ liệu người dùng tuyệt đối! 🔐
