# 📋 Luồng Đăng Ký Tài Khoản (Registration Flow)

## 🎯 Tổng Quan

Luồng đăng ký tài khoản trong hệ thống InterDev bao gồm các bước: validation, bảo mật, tạo user, gửi email xác thực, và audit logging.

---

## 🔄 Flow Chi Tiết

### **Bước 1: Frontend Gửi Request** 
**File:** `client/src/pages/SignUpPage.tsx`

- User điền form: email, password, fullName, phoneNumber, role, domainIds, skillIds
- User chấp nhận Terms & Privacy Policy
- User hoàn thành reCAPTCHA → nhận được `recaptchaToken`
- Frontend gửi POST request đến `/auth/register` với:
  ```json
  {
    "email": "user@example.com",
    "password": "securepass123!",
    "fullName": "Nguyễn Văn A",
    "phoneNumber": "0912345678",
    "role": "FREELANCER",
    "domainIds": ["uuid-1", "uuid-2"],
    "skillIds": ["uuid-3", "uuid-4"],
    "acceptTerms": true,
    "acceptPrivacy": true,
    "recaptchaToken": "03AGdBq..."
  }
  ```

---

### **Bước 2: Controller Nhận Request**
**File:** `server/src/modules/auth/auth.controller.ts` (dòng 77-115)

**Guards & Middleware:**
1. ✅ **`@UseGuards(CaptchaGuard)`** - Kiểm tra reCAPTCHA
2. ✅ **`@Throttle({ limit: 3, ttl: 60000 })`** - Giới hạn 3 requests/phút/IP
3. ✅ **`@Body(ValidationPipe)`** - Validate DTO

**Xử lý:**
- Extract `ipAddress` từ `@Ip()` decorator
- Extract `userAgent` từ request headers
- Gọi `authService.register(registerDto, ip, userAgent)`

---

### **Bước 3: CaptchaGuard Validation**
**File:** `server/src/common/guards/captcha.guard.ts`

**Flow:**
1. Kiểm tra `RECAPTCHA_ENABLED` trong env
   - Nếu `false` → Skip validation (development mode)
   - Nếu `true` → Tiếp tục
2. Kiểm tra `recaptchaToken` có tồn tại không
   - ❌ Không có → Throw `BadRequestException('Vui lòng hoàn thành reCAPTCHA')`
3. Gọi `captchaService.verifyRecaptcha(token)`
   - ❌ Invalid → Throw `BadRequestException('reCAPTCHA verification failed')`
   - ✅ Valid → Cho phép tiếp tục

**File:** `server/src/modules/auth/captcha.service.ts`
- Gửi request đến Google reCAPTCHA API: `https://www.google.com/recaptcha/api/siteverify`
- Verify với `RECAPTCHA_SECRET_KEY`
- Return `true` nếu `success === true`

---

### **Bước 4: DTO Validation**
**File:** `server/src/modules/auth/dto/register.dto.ts`

**Validation Rules:**
- ✅ `email`: Email hợp lệ, không phải disposable email
- ✅ `password`: Min 8 ký tự, có chữ thường, số, ký tự đặc biệt
- ✅ `fullName`: 2-50 ký tự, chỉ chữ cái và khoảng trắng
- ✅ `phoneNumber`: Format Việt Nam (0[3|5|7|8|9]xxxxxxxx)
- ✅ `role`: Chỉ CLIENT, BROKER, FREELANCER
- ✅ `acceptTerms` & `acceptPrivacy`: Phải là `true`
- ✅ `recaptchaToken`: Optional string

---

### **Bước 5: AuthService.register() - Xử Lý Chính**
**File:** `server/src/modules/auth/auth.service.ts` (dòng 46-148)

#### **5.1. Kiểm Tra Email Trùng**
```typescript
const existingUser = await this.userRepository.findOne({ where: { email } });
if (existingUser) {
  throw new ConflictException('Email đã được sử dụng');
}
```

#### **5.2. Validate Legal Consent**
```typescript
if (!acceptTerms || !acceptPrivacy) {
  throw new ConflictException('Bạn phải chấp nhận Điều khoản Dịch vụ và Chính sách Bảo mật');
}
```

#### **5.3. Hash Password**
```typescript
const saltRounds = 12;
const passwordHash = await bcrypt.hash(password, saltRounds);
```

#### **5.4. Tạo User Entity**
```typescript
const now = new Date();
const newUser = this.userRepository.create({
  email,
  passwordHash,
  fullName,
  phoneNumber,
  role: role,
  isVerified: false,              // Email chưa verify
  currentTrustScore: 2.5,         // Điểm mặc định
  termsAcceptedAt: acceptTerms ? now : null,
  privacyAcceptedAt: acceptPrivacy ? now : null,
  registrationIp: ipAddress,      // Lưu IP đăng ký
  registrationUserAgent: userAgent, // Lưu User Agent
});
const savedUser = await this.userRepository.save(newUser);
```

#### **5.5. Lưu Domains & Skills (Nếu là BROKER/FREELANCER)**
```typescript
if ((role === 'BROKER' || role === 'FREELANCER') && (domainIds || skillIds)) {
  // Lưu vào user_skill_domains table
  if (domainIds && domainIds.length > 0) {
    await userSkillDomainRepo.save(domainRecords);
  }
  
  // Lưu vào user_skills table
  if (skillIds && skillIds.length > 0) {
    await userSkillRepo.save(skillRecords);
  }
}
```

#### **5.6. Gửi Email Xác Thực**
```typescript
try {
  await this.emailVerificationService.sendVerificationEmail(savedUser.id, savedUser.email);
} catch (error) {
  console.error('Failed to send verification email:', error);
  // ⚠️ KHÔNG fail registration nếu email fail - user có thể resend sau
}
```

**Chi tiết Email Verification:**
- **File:** `server/src/modules/auth/email-verification.service.ts`
- Generate token: `crypto.randomBytes(32).toString('hex')`
- Expires: 24 giờ
- Lưu vào DB: `emailVerificationToken`, `emailVerificationExpires`
- Gửi email với link: `${FRONTEND_URL}/verify-email?token=${token}`

#### **5.7. Audit Logging**
```typescript
this.auditLogsService.logRegistration(savedUser.id, {
  role: savedUser.role,
  email: savedUser.email,
  ipAddress,
  userAgent,
  domainCount: domainIds?.length || 0,
  skillCount: skillIds?.length || 0,
}).catch(err => console.error('Failed to log registration:', err));
```

**Lưu ý:** Audit log được gọi async và không block nếu fail.

#### **5.8. Return Response**
```typescript
return this.mapToAuthResponse(savedUser);
// Response KHÔNG bao gồm passwordHash
```

---

### **Bước 6: Response Trả Về Frontend**
**File:** `server/src/modules/auth/auth.controller.ts` (dòng 111-114)

```json
{
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "role": "FREELANCER",
    "isVerified": false,
    "currentTrustScore": 2.5,
    "badge": "NEW",
    "stats": { ... },
    "createdAt": "2026-01-22T...",
    ...
  }
}
```

---

## ✅ Checklist - Những Gì Đã Được Xử Lý

### **Bảo Mật:**
- ✅ reCAPTCHA verification
- ✅ Rate limiting (3 requests/phút/IP)
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ Email validation (không chấp nhận disposable email)
- ✅ Phone number validation

### **Legal Compliance:**
- ✅ Terms of Service acceptance (`termsAcceptedAt`)
- ✅ Privacy Policy acceptance (`privacyAcceptedAt`)
- ✅ Lưu timestamp khi user chấp nhận

### **Tracking & Audit:**
- ✅ Registration IP address (`registrationIp`)
- ✅ User Agent (`registrationUserAgent`)
- ✅ Audit log với metadata đầy đủ
- ✅ Domain count & Skill count tracking

### **Email Verification:**
- ✅ Generate secure token (32 bytes hex)
- ✅ Token expires sau 24 giờ
- ✅ Gửi email với verification link
- ✅ Không fail registration nếu email fail (có thể resend)

### **User Data:**
- ✅ Default trust score: 2.5
- ✅ `isVerified: false` (chờ email verification)
- ✅ Lưu domains & skills cho BROKER/FREELANCER
- ✅ Response không bao gồm sensitive data (passwordHash)

---

## ⚠️ Những Điểm Cần Lưu Ý

### **1. Email Verification Không Block Registration**
- Nếu gửi email fail, registration vẫn thành công
- User có thể resend verification email sau
- Endpoint: `POST /auth/resend-verification`

### **2. Trust Score Mặc Định**
- Tất cả user mới có `currentTrustScore: 2.5`
- Score sẽ được update dựa trên performance sau này

### **3. Badge System**
- User mới sẽ có badge `NEW` (từ virtual property trong entity)
- Badge được tính dựa trên:
  - `totalProjectsFinished === 0` + `createdAt < 30 days` → `NEW`
  - `isVerified === true` → `VERIFIED`
  - `currentTrustScore >= 4.5` + `totalProjectsFinished >= 5` → `TRUSTED`
  - `totalDisputesLost > 0` → `WARNING`

### **4. Domains & Skills**
- Chỉ lưu cho BROKER và FREELANCER
- Skills mặc định: `priority: 'SECONDARY'`, `verificationStatus: 'SELF_DECLARED'`
- User có thể upgrade sau

### **5. Error Handling**
- CAPTCHA fail → `BadRequestException`
- Email trùng → `ConflictException`
- Validation fail → `BadRequestException` (từ ValidationPipe)
- Email send fail → Log error nhưng không throw

---

## 🔗 Các Endpoint Liên Quan

1. **POST `/auth/register`** - Đăng ký (đã mô tả)
2. **GET `/auth/verify-email?token=xxx`** - Xác thực email
3. **POST `/auth/resend-verification`** - Gửi lại email xác thực
4. **POST `/auth/login`** - Đăng nhập (sau khi verify email)

---

## 📝 Ghi Chú

- Registration không tự động login user
- User cần verify email trước khi có thể sử dụng đầy đủ tính năng
- Email verification token có thể resend nếu hết hạn
- Audit log được ghi async để không block flow chính
