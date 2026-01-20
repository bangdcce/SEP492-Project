# 🔘 Danh Sách Tất Cả Buttons & Actions Trên UI

> Tổng hợp tất cả các nút và hành động mà người dùng tương tác trên InterDev Platform

---

## 📍 **Auth Pages** (Login/Register/Forgot Password)

### Login Page (`SignInPage.tsx`)

- ✅ **"Sign In"** - Submit form đăng nhập
- ✅ **"Forgot Password?"** (Link) - Navigate đến forgot password
- ✅ **"Sign Up"** (Link) - Navigate đến register
- ✅ **"Continue with Google"** - Google OAuth
- ✅ **Toggle Password Visibility** (Icon button) - Show/hide password

### Register Page (`SignUpPage.tsx`)

- ✅ **"Sign Up"** - Submit đăng ký
- ✅ **Role Selection Buttons**:
  - "Client"
  - "Freelancer"
  - "Broker"
- ✅ **"Already have an account? Sign In"** (Link)
- ✅ **Toggle Password Visibility** (2 buttons cho password + confirm password)
- ✅ **"Continue with Google"** - Google OAuth

### Forgot Password Page (`ForgotPasswordPage.tsx`)

- ✅ **"Send OTP"** - Gửi mã OTP
- ✅ **"Verify OTP"** - Xác thực OTP
- ✅ **"Resend OTP"** (Link) - Gửi lại mã
- ✅ **"Back"** - Quay lại bước trước
- ✅ **"Reset Password"** - Submit password mới
- ✅ **"Back to Sign In"** (Link)
- ✅ **Toggle Password Visibility** (2 buttons)

---

## 🏠 **Dashboard**

### Client Dashboard (`ClientDashboard.tsx`)

- ✅ **"Create New Request"** (Primary CTA) - Navigate to Wizard
- ✅ **"View"** - Xem request cần attention
- ✅ **"View All"** (Link) - Xem tất cả requests
- ✅ **Click on Request Card** - Navigate to request detail hoặc wizard (nếu draft)

---

## 🧙 **Wizard (Project Creation)**

### Wizard Page (`WizardPage.tsx`)

#### Navigation:

- ✅ **"Back"** - Quay lại step trước
- ✅ **"Next"** - Tiếp tục step kế
- ✅ **"Save Draft"** - Lưu nháp
- ✅ **"Submit"** (Green button) - Submit request cuối cùng

#### After Submit (Matching Results):

- ✅ **"Invite"** - Mời broker (cho mỗi matched broker)
- ✅ **"Go to Dashboard"** - Navigate về dashboard

#### Step Components:

**Step B4 (`StepB4.tsx`):**

- ✅ **Feature Checkboxes** - Click to toggle selection

**Step B5 (`StepB5.tsx`):**

- ✅ **"Remove File"** (Icon button) - Xóa file đã upload

---

## 📋 **My Requests**

### My Requests Page (`MyRequestsPage.tsx`)

- ✅ **"New Request"** - Navigate to Wizard
- ✅ **Filter Buttons**:
  - "ALL"
  - "DRAFT"
  - "PENDING"
  - "APPROVED"
- ✅ **"Continue Edit"** - Edit draft request (navigate to wizard)
- ✅ **"View Details"** - Xem chi tiết request
- ✅ **"Create a new request"** (Link) - Empty state action

---

## 📄 **Request Detail**

### Request Detail Page (`RequestDetailPage.tsx`)

- ✅ **"← Back"** (Ghost button) - Back to dashboard
- ✅ **"Edit Draft"** - Edit draft request
- ✅ **"Accept Specs"** - Chấp nhận specs (disabled until phase 2)
- ✅ **"View Online"** - Xem contract online
- ✅ **"Download PDF"** - Download contract PDF
- ✅ **"Profile"** - Xem profile broker
- ✅ **"Invite"** - Mời broker

### Comments Section (`CommentsSection.tsx`)

- ✅ **Send Comment** (Icon button) - Gửi comment

---

## 👤 **Trust Profile / Reviews**

### Review Item (`ReviewItem.tsx`)

- ✅ **Click Review** - Open review detail
- ✅ **"..."** (Menu button) - Open action menu
  - ✅ **"Edit Review"** (trong menu)
  - ✅ **"Report Abuse"** (trong menu)
  - ✅ **"Soft Delete"** (trong menu)

### Reviews Full Page (`ReviewsFullPage.tsx`)

- ✅ **"Back"** - Close full page view
- ✅ **Filter Tabs**: All / 5★ / 4★ / 3★ / 2★ / 1★
- ✅ **"Load More"** - Load thêm reviews
- ✅ **"Create Review"** (FAB - Floating Action Button)

### Review Modals

**Create Review Modal (`CreateReviewModal.tsx`):**

- ✅ **"Close"** (X button)
- ✅ **Star Rating** (1-5 stars clickable)
- ✅ **"Cancel"**
- ✅ **"Submit Review"**

**Edit Review Modal (`EditReviewModal.tsx`):**

- ✅ **"Close"** (X button)
- ✅ **Star Rating** (editable)
- ✅ **"Cancel"**
- ✅ **"Save Changes"**

**Report Abuse Modal (`ReportAbuseModal.tsx`):**

- ✅ **"Close"** (X button)
- ✅ **Reason Checkboxes** (multiple selection)
- ✅ **"Cancel"**
- ✅ **"Submit Report"**

**Soft Delete Confirm Modal (`SoftDeleteConfirmModal.tsx`):**

- ✅ **"Close"** (X button)
- ✅ **Reason Radio Buttons**
- ✅ **"Cancel"**
- ✅ **"Confirm Delete"**

**Restore Review Modal (`RestoreReviewModal.tsx`):**

- ✅ **"Close"** (X button)
- ✅ **"Cancel"**
- ✅ **"Restore"**

### Review Detail Page (`ReviewDetailPage.tsx`)

- ✅ **"← Back"** - Close detail view

### Review Edit History Page (`ReviewEditHistoryPage.tsx`)

- ✅ **"← Back"** - Close history view

---

## 👨‍💼 **Admin Pages**

### Admin Review Moderation Page (`AdminReviewModerationPage.tsx`)

- ✅ **"Reload"** - Refresh page
- ✅ **Tab Buttons**:
  - "Pending Reports" (mặc định)
  - "All Reviews"
  - "Deleted Reviews"
- ✅ **"View Details"** - Xem chi tiết review bị report
- ✅ **"Dismiss Report"** - Dismiss report (keep review)
- ✅ **"Actions Menu"** (dropdown):
  - "Delete Review"
  - "Suspend User"
  - "Other actions..."

### Audit Logs Page (`AuditLogsPage.tsx`)

- ✅ **"Export"** - Export audit logs

---

## 🎨 **UI Components (Shared)**

### Sidebar (`sidebar.tsx`)

- ✅ **Menu Item Buttons** - Navigate between pages
- ✅ **Collapse/Expand** - Toggle sidebar

### Carousel (`carousel.tsx`)

- ✅ **"Previous"** (Arrow button)
- ✅ **"Next"** (Arrow button)

---

## 📊 **Tổng Hợp Theo Loại Action**

### Navigation Actions

| Button               | Màn hình                 | Đích đến             |
| -------------------- | ------------------------ | -------------------- |
| "Sign In"            | Register/Forgot Password | Login page           |
| "Sign Up"            | Login                    | Register page        |
| "Forgot Password?"   | Login                    | Forgot Password page |
| "Create New Request" | Dashboard                | Wizard               |
| "New Request"        | My Requests              | Wizard               |
| "Back"               | Various                  | Previous page/step   |
| "Go to Dashboard"    | Wizard Complete          | Dashboard            |
| "View All"           | Dashboard                | My Requests          |
| "View Details"       | Request Card             | Request Detail       |
| "Continue Edit"      | Draft Card               | Wizard (edit mode)   |
| "Edit Draft"         | Request Detail           | Wizard (edit mode)   |

### Form Submissions

| Button           | Form                   | Action              |
| ---------------- | ---------------------- | ------------------- |
| "Sign In"        | Login form             | Submit login        |
| "Sign Up"        | Register form          | Submit registration |
| "Send OTP"       | Forgot password step 1 | Send OTP code       |
| "Verify OTP"     | Forgot password step 2 | Verify OTP          |
| "Reset Password" | Forgot password step 3 | Update password     |
| "Save Draft"     | Wizard step 5          | Save as draft       |
| "Submit"         | Wizard step 5          | Submit request      |
| "Submit Review"  | Create Review Modal    | Add new review      |
| "Save Changes"   | Edit Review Modal      | Update review       |
| "Submit Report"  | Report Abuse Modal     | Report review       |

### Status Change / CRUD Operations

| Button           | Entity  | Operation              |
| ---------------- | ------- | ---------------------- |
| "Invite"         | Broker  | Send invitation        |
| "Accept Specs"   | Project | Approve specifications |
| "Delete Review"  | Review  | Soft delete            |
| "Dismiss Report" | Report  | Dismiss/ignore         |
| "Suspend User"   | User    | Suspend account        |
| "Confirm Delete" | Review  | Confirm soft delete    |
| "Restore"        | Review  | Restore deleted review |

### Filter / View Toggle

| Button                             | Màn hình         | Function            |
| ---------------------------------- | ---------------- | ------------------- |
| "ALL / DRAFT / PENDING / APPROVED" | My Requests      | Filter by status    |
| "All / 5★ / 4★ / 3★ / 2★ / 1★"     | Reviews          | Filter by rating    |
| Tab buttons                        | Admin Moderation | Switch between tabs |

### Utility Actions

| Button                     | Function                    |
| -------------------------- | --------------------------- |
| Toggle Password Visibility | Show/hide password          |
| Star Rating                | Set rating (1-5)            |
| Feature Checkboxes         | Select/deselect features    |
| Reason Checkboxes/Radios   | Select report/delete reason |
| "Send Comment"             | Post comment                |
| "Load More"                | Paginate reviews            |
| "Export"                   | Export audit logs           |
| "Remove File"              | Delete uploaded file        |
| "Reload"                   | Refresh page data           |

---

## 🎯 Missing Features (Cần Implement)

Dựa vào screenflow đã vẽ, các buttons/features sau **chưa được implement** nhưng cần thiết:

### 💰 Payment/Wallet

- [ ] "Deposit Money" - Nạp tiền vào wallet
- [ ] "Fund Escrow" - Ký quỹ cho milestone
- [ ] "Approve Milestone" - Client approve deliverable
- [ ] "Request Withdrawal" - Freelancer/Broker rút tiền
- [ ] "Approve Payout" (Admin) - Admin duyệt withdrawal

### 📦 Project/Milestone Management

- [ ] "Browse Projects" - Freelancer tìm project
- [ ] "Submit Proposal" - Gửi proposal
- [ ] "Upload Deliverable" - Submit công việc
- [ ] "Raise Dispute" - Tạo tranh chấp
- [ ] "Submit Response" (Dispute) - Trả lời tranh chấp

### 👥 User/Profile

- [ ] "Browse Freelancers" - Client tìm freelancer
- [ ] "Save to Favorites" - Save freelancer
- [ ] "View Profile" - Xem profile chi tiết
- [ ] "View Trust Score" - Xem điểm tin cậy
- [ ] "View Portfolio" - Xem portfolio

### 🔧 Admin

- [ ] "Manage Users" - Quản lý users
- [ ] "Manage Projects" - Quản lý projects
- [ ] "Manage Disputes" - Quản lý disputes
  - [ ] "Review Evidence"
  - [ ] "Make Decision" (Refund/Release/Split)
- [ ] "Update Platform Fee %" - Cấu hình phí
- [ ] "View User Activities" - Audit logs chi tiết

---

## 📝 Notes

- **Auth flows** hoàn chỉnh (Login, Register, Forgot Password, Google OAuth)
- **Wizard flow** hoàn chỉnh với 5 steps + draft saving
- **Review system** hoàn chỉnh với CRUD + report + soft delete
- **Admin review moderation** đã có
- **Payment/Wallet/Project management** chưa implement frontend
- **Dispute handling** chưa có UI

---

<div align="center">

**Total Documented Buttons: 80+**

UI Actions Extraction Date: 2026-01-08

</div>
