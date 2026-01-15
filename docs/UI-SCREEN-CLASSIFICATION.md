# 🖥️ UI Screen Classification (Pages, Modals, Popups)

> Phân loại tất cả màn hình UI theo loại: Full Page, Modal, Popup/Overlay

---

## 📊 Tổng Quan

| Loại                  | Số lượng | Mô tả                           |
| --------------------- | -------- | ------------------------------- |
| **Full Pages**        | 14       | Màn hình đầy đủ, có route riêng |
| **Modals/Dialogs**    | 5        | Overlay dialog với backdrop     |
| **Slide-in Panels**   | 2        | Full-page slide from side       |
| **Inline Components** | 3        | Components nhúng trong page     |

---

## 📄 **FULL PAGES** (Flat Pages with Routes)

### 1. Auth Pages

#### `SignInPage.tsx`

- **Type:** Full Page
- **Route:** `/login`
- **Layout:** Centered form, no sidebar
- **Features:** Login form, Google OAuth, forgot password link

#### `SignUpPage.tsx`

- **Type:** Full Page
- **Route:** `/register`
- **Layout:** Centered form with role selection
- **Features:** Registration form, role buttons (Client/Freelancer/Broker), Google OAuth

#### `ForgotPasswordPage.tsx`

- **Type:** Full Page
- **Route:** `/forgot-password`
- **Layout:** Multi-step centered form (3 steps)
- **Features:** OTP send → Verify → Reset password

#### `GoogleCompletePage.tsx`

- **Type:** Full Page
- **Route:** `/auth/google-complete`
- **Layout:** Centered form
- **Features:** Complete Google OAuth signup with additional info

#### `GoogleSuccessPage.tsx`

- **Type:** Full Page
- **Route:** `/auth/google-success`
- **Layout:** Success message centered
- **Features:** Redirect after successful OAuth

---

### 2. Main Application Pages

#### `ClientDashboard.tsx`

- **Type:** Full Page (with MainLayout)
- **Route:** `/admin/dashboard` (or `/dashboard`)
- **Layout:** Full page with sidebar
- **Features:** Hero section, attention items, recent requests, stats

#### `WizardPage.tsx`

- **Type:** Full Page (with MainLayout)
- **Route:** `/wizard`
- **Layout:** Centered card with progress bar
- **Features:** 5-step wizard, draft saving, broker matching results

#### `MyRequestsPage.tsx`

- **Type:** Full Page (with MainLayout)
- **Route:** `/requests`
- **Layout:** Grid layout with filter buttons
- **Features:** Request cards, status filters, create new button

#### `RequestDetailPage.tsx`

- **Type:** Full Page (with MainLayout)
- **Route:** `/requests/:id`
- **Layout:** Detailed view with timeline
- **Features:** Project phases, comments, deliverables, broker matches

#### `AuditLogsPage.tsx`

- **Type:** Full Page (with MainLayout)
- **Route:** `/admin/audit-logs`
- **Layout:** Table/list view
- **Features:** Audit log entries, export button

#### `AdminReviewModerationPage.tsx`

- **Type:** Full Page (with MainLayout)
- **Route:** `/admin/review-moderation`
- **Layout:** Tabbed interface
- **Features:** Pending reports, all reviews, deleted reviews tabs

---

### 3. Trust Profile Pages (Slide-in Full Page Overlays)

#### `ReviewsFullPage.tsx`

- **Type:** **Slide-in Full Page Overlay**
- **Route:** N/A (opened via state)
- **Layout:** `fixed inset-0 z-50 bg-background` - Full screen overlay
- **Features:** Full review list, filters by stars, load more
- **Behavior:** Slides in from right, covers entire screen with back button

#### `ReviewDetailPage.tsx`

- **Type:** **Slide-in Full Page Overlay**
- **Route:** N/A (opened via state)
- **Layout:** `fixed inset-0 z-50` - Full screen overlay
- **Features:** Detailed review view, edit history, report options
- **Behavior:** Slides in from right over ReviewsFullPage

#### `ReviewEditHistoryPage.tsx`

- **Type:** **Slide-in Full Page Overlay**
- **Route:** N/A (opened via state)
- **Layout:** `fixed inset-0 z-50` - Full screen overlay
- **Features:** Timeline of review edits
- **Behavior:** Slides in from right

---

## 🎭 **MODALS** (Dialog Overlays with Backdrop)

### Trust Profile Modals (all in `features/trust-profile/modals/`)

#### 1. `CreateReviewModal.tsx`

- **Type:** Modal Dialog
- **Trigger:** FAB (Floating Action Button) on ReviewsFullPage
- **Layout:** `fixed inset-0 z-50 bg-black/50` backdrop + centered dialog
- **Size:** Medium (max-w-2xl)
- **Features:**
  - Star rating input
  - Text area for review
  - Cancel / Submit buttons
- **Behavior:** Click outside to close, X button to close

#### 2. `EditReviewModal.tsx`

- **Type:** Modal Dialog
- **Trigger:** "Edit Review" from review menu
- **Layout:** Centered dialog with backdrop
- **Size:** Medium (max-w-2xl)
- **Features:**
  - Editable star rating
  - Editable review text
  - Cancel / Save Changes buttons
- **Behavior:** Modal overlay, click outside or X to close

#### 3. `ReportAbuseModal.tsx`

- **Type:** Modal Dialog
- **Trigger:** "Report Abuse" from review menu
- **Layout:** Centered dialog with backdrop
- **Size:** Medium (max-w-lg)
- **Features:**
  - Checkboxes for report reasons (spam, offensive, fake, etc.)
  - Text area for additional details
  - Cancel / Submit Report buttons
- **Behavior:** Modal overlay with backdrop

#### 4. `SoftDeleteConfirmModal.tsx`

- **Type:** Modal Dialog (Confirmation)
- **Trigger:** "Soft Delete" from review menu
- **Layout:** Centered dialog with backdrop
- **Size:** Medium (max-w-lg)
- **Features:**
  - Radio buttons for deletion reasons
  - Text area for additional notes
  - Warning message
  - Cancel / Confirm Delete buttons
- **Behavior:** Confirmation modal, serious action

#### 5. `RestoreReviewModal.tsx`

- **Type:** Modal Dialog (Confirmation)
- **Trigger:** "Restore" button on deleted review
- **Layout:** Centered dialog with backdrop
- **Size:** Small (max-w-md)
- **Features:**
  - Confirmation message
  - Cancel / Restore buttons
- **Behavior:** Simple confirmation modal

---

## 💬 **INLINE COMPONENTS** (Embedded in Pages)

#### `CommentsSection.tsx`

- **Type:** Inline Component
- **Location:** Embedded in RequestDetailPage
- **Layout:** Section within page
- **Features:** Comment list + input field with send button
- **Behavior:** No overlay, part of page flow

#### `ProjectPhaseStepper.tsx`

- **Type:** Inline Component
- **Location:** Embedded in RequestDetailPage
- **Layout:** Horizontal stepper
- **Features:** Phase visualization (1-5)
- **Behavior:** Static display component

#### `TrustProfileSection.tsx`

- **Type:** Inline Component
- **Location:** Embedded in profile pages
- **Layout:** Section with stats and review preview
- **Features:** Trust score, reviews summary, "View All" button
- **Behavior:** Click "View All" → Opens ReviewsFullPage overlay

---

## 🔍 **Detailed Classification**

### By Display Pattern

```
┌─────────────────────────────────────────────────────────┐
│ FULL PAGES (with Routes)                                │
├─────────────────────────────────────────────────────────┤
│ ✓ SignInPage                                            │
│ ✓ SignUpPage                                            │
│ ✓ ForgotPasswordPage                                    │
│ ✓ GoogleCompletePage                                    │
│ ✓ GoogleSuccessPage                                     │
│ ✓ ClientDashboard                                       │
│ ✓ WizardPage                                            │
│ ✓ MyRequestsPage                                        │
│ ✓ RequestDetailPage                                     │
│ ✓ AuditLogsPage                                         │
│ ✓ AdminReviewModerationPage                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SLIDE-IN FULL PAGE OVERLAYS (z-50, fixed inset-0)      │
├─────────────────────────────────────────────────────────┤
│ ✓ ReviewsFullPage (slide from right)                    │
│ ✓ ReviewDetailPage (slide from right)                   │
│ ✓ ReviewEditHistoryPage (slide from right)              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ MODALS (Dialog with Backdrop)                           │
├─────────────────────────────────────────────────────────┤
│ ✓ CreateReviewModal                                     │
│ ✓ EditReviewModal                                       │
│ ✓ ReportAbuseModal                                      │
│ ✓ SoftDeleteConfirmModal                                │
│ ✓ RestoreReviewModal                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ INLINE COMPONENTS (No overlay)                          │
├─────────────────────────────────────────────────────────┤
│ ✓ CommentsSection                                       │
│ ✓ ProjectPhaseStepper                                   │
│ ✓ TrustProfileSection                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 **UI Patterns by Use Case**

### Navigation Flow

```
Full Page → Modal → (Action) → Close Modal → Full Page
```

Example:

- ClientDashboard → (Click Create Review) → CreateReviewModal → Submit → Modal closes

```
Full Page → Slide-in Full Page → Slide-in Full Page → Back → Back → Full Page
```

Example:

- Profile Page → ReviewsFullPage → ReviewDetailPage → ReviewEditHistoryPage → (Back x3) → Profile Page

---

## 📐 **Technical Implementation Details**

### Full Pages

```tsx
// Has Route in App.tsx
<Route
  path="/dashboard"
  element={
    <MainLayout>
      <ClientDashboard />
    </MainLayout>
  }
/>
```

### Modals (Dialog Pattern)

```tsx
// State-controlled visibility
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
    {isOpen && (
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose}>
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Modal Content */}
        </div>
      </div>
    )}
  </>
);
```

### Slide-in Full Page Overlays

```tsx
// State-controlled, full screen overlay
const [isFullPageOpen, setIsFullPageOpen] = useState(false);

return (
  <>
    <Button onClick={() => setIsFullPageOpen(true)}>View All</Button>
    {isFullPageOpen && (
      <div className="fixed inset-0 z-50 bg-background">
        {/* Full page content with back button */}
        <button onClick={onBack}>← Back</button>
      </div>
    )}
  </>
);
```

---

## 🔄 **User Flow Examples**

### Example 1: Review Management

```
Profile Page (Full Page)
  └─> Click "View All Reviews"
      └─> ReviewsFullPage (Slide-in Overlay)
          └─> Click specific review
              └─> ReviewDetailPage (Slide-in Overlay)
                  └─> Click "..." menu
                      └─> Click "Edit"
                          └─> EditReviewModal (Modal Dialog)
                              └─> Submit → Modal closes
                              └─> Cancel → Modal closes
```

### Example 2: Project Creation

```
Dashboard (Full Page)
  └─> Click "Create New Request"
      └─> WizardPage (Full Page with Card UI)
          └─> Step through wizard
          └─> Submit
          └─> Shows matching results (Same page, different state)
```

### Example 3: Authentication

```
Landing
  └─> SignInPage (Full Page)
      └─> Click "Forgot Password?"
          └─> ForgotPasswordPage (Full Page)
              └─> Multi-step form (Same page, state changes)
```

---

## 📱 **Responsive Behavior**

### Desktop (≥1024px)

- **Full Pages:** Sidebar + content area
- **Modals:** Centered, max-width constrained
- **Slide-ins:** Full height, slide from right

### Tablet (768-1023px)

- **Full Pages:** Collapsible sidebar
- **Modals:** Slightly smaller max-width
- **Slide-ins:** Full width

### Mobile (<768px)

- **Full Pages:** Bottom navigation
- **Modals:** Full screen on mobile (often)
- **Slide-ins:** Full screen

---

## 🎯 **Missing UI Patterns Needed**

Based on screenflows, these UI screens are needed but not yet implemented:

### Full Pages

- [ ] Browse Projects Page (Freelancer)
- [ ] Browse Freelancers Page (Client)
- [ ] Project Detail Page
- [ ] Milestone Management Page
- [ ] Wallet/Transaction History Page
- [ ] Profile Page (View/Edit)

### Modals

- [ ] Fund Escrow Modal (Confirmation + Payment)
- [ ] Approve Milestone Modal (Confirmation)
- [ ] Raise Dispute Modal (Form)
- [ ] Submit Proposal Modal (Form)
- [ ] Request Withdrawal Modal (Form)
- [ ] Upload Deliverable Modal (File upload + description)

### Admin-specific

- [ ] Dispute Resolution Page (Full Page)
- [ ] User Management Page (Full Page)
- [ ] Payout Approval Panel (Could be modal or page)

---

## 📊 **Summary Table**

| Screen Name               | Type             | Layout            | Trigger      | Size   |
| ------------------------- | ---------------- | ----------------- | ------------ | ------ |
| SignInPage                | Full Page        | Centered          | Route        | -      |
| SignUpPage                | Full Page        | Centered          | Route        | -      |
| ForgotPasswordPage        | Full Page        | Centered          | Route        | -      |
| ClientDashboard           | Full Page        | Sidebar + Content | Route        | -      |
| WizardPage                | Full Page        | Centered Card     | Route        | -      |
| MyRequestsPage            | Full Page        | Grid              | Route        | -      |
| RequestDetailPage         | Full Page        | Detail View       | Route        | -      |
| AuditLogsPage             | Full Page        | Table             | Route        | -      |
| AdminReviewModerationPage | Full Page        | Tabs              | Route        | -      |
| ReviewsFullPage           | Slide-in Overlay | Full Screen       | Button       | Full   |
| ReviewDetailPage          | Slide-in Overlay | Full Screen       | Click Review | Full   |
| ReviewEditHistoryPage     | Slide-in Overlay | Full Screen       | Button       | Full   |
| CreateReviewModal         | Modal Dialog     | Centered          | FAB          | Medium |
| EditReviewModal           | Modal Dialog     | Centered          | Menu         | Medium |
| ReportAbuseModal          | Modal Dialog     | Centered          | Menu         | Medium |
| SoftDeleteConfirmModal    | Modal Dialog     | Centered          | Menu         | Medium |
| RestoreReviewModal        | Modal Dialog     | Centered          | Button       | Small  |
| CommentsSection           | Inline           | Section           | N/A          | -      |
| ProjectPhaseStepper       | Inline           | Horizontal        | N/A          | -      |
| TrustProfileSection       | Inline           | Section           | N/A          | -      |

**Total:** 11 Full Pages + 3 Slide-in Overlays + 5 Modals + 3 Inline Components = **22 UI Screens**

---

<div align="center">

**UI Classification Complete**

Last Updated: 2026-01-08

</div>
