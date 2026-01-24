# 👨‍💻 Freelancer & Broker Screen Specifications

> Chi tiết các màn hình UI cần thiết cho Freelancer và Broker dựa trên backlog

---

## 📊 Tổng Quan

| Role           | Số Screens | Full Pages | Modals | Inline Components |
| -------------- | ---------- | ---------- | ------ | ----------------- |
| **Freelancer** | 18+        | 12         | 4      | 2+                |
| **Broker**     | 22+        | 15         | 5      | 2+                |
| **Shared**     | 8          | 5          | 2      | 1                 |

---

## 🎯 **FREELANCER SCREENS**

### 1️⃣ **Onboarding & Profile**

#### A10: Become Freelancer Registration Page

**Type:** Full Page  
**Route:** `/freelancer/register` or `/profile/become-freelancer`  
**Backlog:** A10 - User đăng ký trở thành Freelancer  
**Layout:** Multi-step form với progress indicator

**Features:**

- **Step 1: Skills & Expertise**
  - Multi-select skill tags (React, Node.js, Python, etc.)
  - Proficiency level slider (Beginner → Expert)
  - Years of experience input
- **Step 2: Portfolio**
  - Add portfolio items (Title, Description, Link, Screenshots)
  - Featured project selector
  - GitHub/GitLab integration (optional)
- **Step 3: Professional Info**
  - Bio/Introduction (rich text editor)
  - Hourly rate range
  - Availability status
  - Languages spoken
- **Step 4: Review & Submit**
  - Preview of profile
  - Submit button → Auto-enable Freelancer role

**Mockup:**

```
┌─────────────────────────────────────────────────────┐
│  Become a Freelancer        [Progress: ●●○○ 50%]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 2: Showcase Your Portfolio                   │
│                                                     │
│  [+ Add Portfolio Item]                            │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📱 E-commerce Mobile App                     │  │
│  │ Tech: React Native, Firebase                 │  │
│  │ 🔗 View Demo  📸 3 Screenshots              │  │
│  │                              [Edit] [Delete] │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│           [← Back]              [Next: Bio →]      │
└─────────────────────────────────────────────────────┘
```

---

#### Enhanced Profile Page (Freelancer View)

**Type:** Full Page  
**Route:** `/profile/me` or `/freelancer/profile`  
**Backlog:** A05 + A10 extended  
**Related:** E03, E04, E05, E06 (Trust Score, Badges, Stats)

**Sections:**

1. **Header Card**

   - Avatar, Name, Title (e.g., "Senior Full-Stack Developer")
   - Trust Score badge (New/Verified/Trusted)
   - Star rating + number of reviews
   - Availability status toggle

2. **Stats Overview**

   - Total projects completed
   - Success rate %
   - Total earnings (if allowed)
   - Response time average
   - Number of disputes (with link)

3. **Skills & Expertise**

   - Skill tags with proficiency bars
   - Edit button (opens modal or inline edit)

4. **Portfolio Gallery**

   - Grid of portfolio items
   - Click to expand details modal
   - Filter by category

5. **Reviews & Ratings**

   - Recent reviews from clients
   - "View All Reviews" → Opens ReviewsFullPage overlay

6. **Trust Score Details** (E04, E06)
   - Visual breakdown of Trust Score components
   - Dispute history
   - Verification badges

---

### 2️⃣ **Project Discovery & Invitations**

#### Browse Available Projects Page

**Type:** Full Page  
**Route:** `/freelancer/projects` or `/browse-projects`  
**Backlog:** Implied by C14 (Freelancer xem lời mời)  
**Priority:** P1 (Critical for Freelancer workflow)

**Features:**

- **Filters Sidebar**
  - Budget range slider
  - Project type (Web, Mobile, API, etc.)
  - Tech stack tags
  - Timeline (1 week, 1 month, 3+ months)
  - Status: Open / Invitation Only
- **Project Cards Grid**

  - Project title
  - Budget range
  - Timeline estimate
  - Tech stack badges
  - Client info (name, trust score)
  - "Invited" badge if applicable
  - CTA: "View Details" or "Respond to Invitation"

- **Sorting**
  - Most Recent
  - Best Match (based on skills)
  - Highest Budget

**Mockup:**

```
┌──────────────────────────────────────────────────────────────┐
│  Browse Projects                              🔍 [Search...]  │
├──────┬───────────────────────────────────────────────────────┤
│Filter│  💼 Web App for Restaurant Management      ⭐ Invited│
│      │  Budget: $5,000 - $8,000  |  Timeline: 2-3 months    │
│Tech  │  🏷️ React • Node.js • PostgreSQL • AWS              │
│Stack │  Client: John Doe ⭐⭐⭐⭐⭐ (Verified)              │
│☑️React│  Posted 2 days ago              [View Details →]    │
│☑️Node │  ─────────────────────────────────────────────────  │
│☐Python│  📱 Mobile App for Fitness Tracking               │
│      │  Budget: $3,000 - $5,000  |  Timeline: 1 month      │
│Budget│  🏷️ React Native • Firebase                        │
│      │  Client: Jane Smith ⭐⭐⭐⭐ (New)                  │
│$0    │  Posted 5 days ago              [View Details →]    │
│├─────┤│                                                      │
│$20k  │                                                      │
└──────┴───────────────────────────────────────────────────────┘
```

---

#### C14: Project Invitation Detail Page

**Type:** Full Page  
**Route:** `/freelancer/invitations/:invitationId`  
**Backlog:** C14 - Freelancer xem lời mời dự án

**Sections:**

1. **Invitation Header**

   - "You're Invited!" banner
   - Project title
   - Client info + Trust Score
   - Broker info (who sent invitation)

2. **Project Specification**

   - Full spec document (read-only)
   - Scope of work
   - In-scope / Out-of-scope lists
   - Tech stack requirements

3. **Milestones Table**

   - Milestone name
   - Deliverables
   - Duration estimate
   - Your share (85% of milestone cost)

4. **Timeline & Budget**

   - Total project duration
   - Your total earnings estimate
   - Payment schedule

5. **Action Buttons**
   - "Accept Invitation" (Primary CTA)
   - "Decline" (Secondary)
   - "Ask Questions" (Opens chat/comment thread)

**Mockup:**

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Invitations                                  │
│                                                          │
│  🎉 You're Invited to Join This Project!                │
│                                                          │
│  E-commerce Platform for Fashion Boutique               │
│  Client: Sarah Johnson ⭐⭐⭐⭐⭐ (Verified)            │
│  Broker: Michael Chen (Trusted Broker)                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 📋 Project Specification                           │ │
│  │                                                    │ │
│  │ Overview: Build a modern e-commerce platform...   │ │
│  │ [View Full Spec Document]                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  💰 Milestones & Earnings                               │
│  ┌──────────────────────────┬─────────┬──────────────┐  │
│  │ Milestone                │ Duration│ Your Earning │  │
│  ├──────────────────────────┼─────────┼──────────────┤  │
│  │ 1. UI/UX Design          │ 2 weeks │ $1,700       │  │
│  │ 2. Core Features Dev     │ 4 weeks │ $3,400       │  │
│  │ 3. Testing & Deploy      │ 1 week  │ $850         │  │
│  └──────────────────────────┴─────────┴──────────────┘  │
│  Total Earnings: $5,950  |  Timeline: 7 weeks          │
│                                                          │
│  💬 Questions or Concerns?                              │
│  [Ask the Broker]                                       │
│                                                          │
│       [Decline]           [✓ Accept Invitation]         │
└─────────────────────────────────────────────────────────┘
```

---

### 3️⃣ **Contract & Agreement**

#### C17: Contract Signing Page (Freelancer Side)

**Type:** Full Page (can also be modal)  
**Route:** `/contracts/:contractId/sign`  
**Backlog:** C17 - Flow Freelancer ký hợp đồng

**Features:**

- Full contract document display (PDF-like view or formatted HTML)
- Key terms highlighted:
  - Total budget
  - Your earnings breakdown
  - Timeline
  - Milestones
  - Dispute resolution clause
- Checkbox: "I have read and agree to the terms"
- Digital signature input (name or canvas signature)
- "Sign Contract" button

**Mockup:**

```
┌──────────────────────────────────────────────────────┐
│  Contract Agreement - Sign Required                  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Contract #CTR-2024-0042                             │
│  Between: Sarah Johnson (Client)                     │
│        &  Alex Developer (You, Freelancer)           │
│  Facilitated by: Michael Chen (Broker)               │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 📄 Contract Terms (Scroll to read)              │ │
│  │                                                 │ │
│  │ 1. SCOPE OF WORK                                │ │
│  │ The Freelancer agrees to develop...            │ │
│  │                                                 │ │
│  │ 2. PAYMENT TERMS                                │ │
│  │ Total Contract Value: $7,000                    │ │
│  │ Developer Share (85%): $5,950                   │ │
│  │ ...                                             │ │
│  │                                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ☑️ I have read and agree to all terms above         │
│                                                       │
│  Digital Signature:                                  │
│  [Alex Developer              ] (Type your name)     │
│                                                       │
│         [Cancel]           [✍️ Sign Contract]        │
└──────────────────────────────────────────────────────┘
```

---

### 4️⃣ **Project Workspace**

#### D02: My Projects List (Freelancer)

**Type:** Full Page  
**Route:** `/freelancer/projects` or `/my-projects`  
**Backlog:** D02 - Danh sách Project cho từng role

**Features:**

- Tabs: Active (default) / Completed / Archived
- Project cards showing:
  - Project name + client
  - Current milestone progress bar
  - Next task due date
  - Overall status badge
  - "Open Workspace" button
- Quick stats at top:
  - Active projects count
  - Total earnings this month
  - Tasks due this week

---

#### D03: Project Workspace Dashboard

**Type:** Full Page  
**Route:** `/projects/:projectId/workspace`  
**Backlog:** D03, D04 - Dashboard Project + Quản lý thành viên

**Layout:** Tabbed interface

**Tab 1: Overview**

- Project header (name, client, timeline)
- Progress indicators
  - Overall progress %
  - Current milestone progress
  - Escrow funded/released status
- Team members avatars
- Recent activity timeline

**Tab 2: Milestones**

- Accordion list of milestones
- Each milestone shows:
  - Name, status badge
  - Progress % (based on tasks)
  - Deliverables checklist
  - Your earnings for this milestone
  - "Request Review" button (when 100% complete)

**Tab 3: Tasks** (See Task Board below)

**Tab 4: Files & Deliverables**

- Upload area
- File list with versions

**Tab 5: Team**

- List of members (Client, Broker, Staff if any, You)
- Contact buttons

---

#### D07-D09: Task Board (Kanban)

**Type:** Full Page Component (tab within Workspace)  
**Route:** `/projects/:projectId/tasks`  
**Backlog:** D07, D08, D09 - Task Board Kanban, Tạo Task, Cập nhật trạng thái

**Features:**

- 3 columns: TODO | IN PROGRESS | DONE
- Drag-and-drop task cards
- Each task card shows:
  - Task title
  - Assignee avatar
  - Milestone tag
  - Due date (if any)
  - Attachment count
- Filter by milestone, assignee
- "Create Task" FAB button

**Mockup:**

```
┌────────────────────────────────────────────────────────────┐
│  Tasks    [Filter: All Milestones ▼]     [+ Create Task]  │
├──────────────────┬──────────────────┬─────────────────────┤
│ 📝 TODO (5)      │ 🔄 IN PROGRESS(3)│ ✅ DONE (12)        │
├──────────────────┼──────────────────┼─────────────────────┤
│ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐   │
│ │Setup Database│ │ │Design Login  │ │ │Init Project  │   │
│ │👤 You        │ │ │UI Components │ │ │Setup         │   │
│ │🏷️M1          │ │ │👤 You        │ │ │👤 You        │   │
│ │📎 2 files    │ │ │🏷️M1          │ │ │🏷️M1          │   │
│ └──────────────┘ │ │⏰ Due: 2 days│ │ └──────────────┘   │
│                  │ └──────────────┘ │                     │
│ ┌──────────────┐ │                  │                     │
│ │Write API Docs│ │                  │                     │
│ │👤 You        │ │                  │                     │
│ └──────────────┘ │                  │                     │
└──────────────────┴──────────────────┴─────────────────────┘
```

---

#### D08: Create Task Modal

**Type:** Modal Dialog  
**Trigger:** "+ Create Task" button on Task Board  
**Backlog:** D08 - Tạo Task

**Fields:**

- Task title (required)
- Description (rich text editor)
- Milestone dropdown (required)
- Assignee selector (you or other team members)
- Due date (optional)
- Priority (Low/Medium/High)
- Estimated hours

**Buttons:**

- Cancel
- Create Task

---

#### D10: Task Detail Page / Modal

**Type:** Slide-in panel or Modal  
**Trigger:** Click on task card  
**Backlog:** D10 - Đính kèm minh chứng cho Task

**Sections:**

- Task header (title, status dropdown)
- Description (editable by creator)
- **Attachments section** (D10)
  - Upload files button
  - List of files with download/delete
  - Link to demo/staging URL
  - Screenshots preview
- Comments thread
- Activity log (status changes, assignments)
- Action buttons:
  - Move to IN_PROGRESS / DONE
  - Edit / Delete task

---

#### D12: Request Milestone Review Page

**Type:** Full Page or Modal  
**Route:** `/projects/:projectId/milestones/:milestoneId/request-review`  
**Backlog:** D12 - Freelancer yêu cầu nghiệm thu Milestone

**Features:**

- Milestone summary
  - Name, deliverables checklist
  - All tasks must be DONE (validation)
- **Summary of work completed**
  - Text area to describe what was delivered
  - Link to demo/staging environment
- **Attachments/Evidence**
  - Upload final deliverables
  - Screenshots, videos, documentation
- Checkbox: "I confirm all deliverables are complete"
- "Submit for Review" button
  - Triggers notification to Staff and Client
  - Changes milestone status to PENDING_REVIEW

---

### 5️⃣ **Ratings & Disputes**

#### E02: Rate Client Modal

**Type:** Modal Dialog  
**Trigger:** After project completion  
**Backlog:** E02 - Freelancer đánh giá Client

**Similar to existing CreateReviewModal but for rating Client:**

- Star rating (1-5)
- Review text area
- Tags: "Good Communication", "Timely Payments", "Clear Requirements", etc.
- Submit button

---

#### E08: Create Dispute Page/Modal

**Type:** Full Page or Modal  
**Route:** `/projects/:projectId/milestones/:milestoneId/dispute`  
**Backlog:** E08 - Flow tạo Dispute

**Features:**

- **Dispute Reason** (dropdown)

  - Deliverables not accepted unfairly
  - Scope creep / additional work not paid
  - Client unresponsive
  - Payment issue
  - Other

- **Description** (required)

  - Detailed explanation of the issue
  - What was agreed vs what happened

- **Evidence Upload**

  - Chat logs, emails
  - Original spec documents
  - Screenshots of deliverables
  - Any supporting files

- **Requested Resolution**

  - Checkbox options:
    - Release escrow payment
    - Partial payment
    - Contract termination
  - Additional notes

- Warning message: "Disputes may affect your Trust Score if found invalid"

- Buttons:
  - Cancel
  - Submit Dispute (requires confirmation)

---

#### E09: Dispute Detail Page (Freelancer View)

**Type:** Full Page  
**Route:** `/disputes/:disputeId`  
**Backlog:** E09 - Chi tiết Dispute cho các bên

**Sections:**

1. **Dispute Header**

   - Dispute ID, status badge
   - Project name, milestone
   - Date filed
   - Current status: OPEN / IN_MEDIATION / RESOLVED

2. **Your Submission**

   - Reason, description
   - Evidence files (downloadable)

3. **Client's Response** (if any)

   - Their counter-argument
   - Their evidence

4. **Admin Comments** (if in mediation)

   - Admin notes/questions
   - Requested additional info

5. **Timeline**

   - Visual timeline of all actions

6. **Action Buttons** (based on status)
   - "Submit Additional Evidence" (if OPEN)
   - "View Resolution" (if RESOLVED)

---

### 6️⃣ **Notifications & Communications**

#### Notification Center (Freelancer)

**Type:** Slide-in panel or dedicated page  
**Route:** `/notifications`  
**Implied by:** Various backlog items (D13, B18 similar pattern)

**Notification types:**

- New project invitation
- Invitation accepted/declined
- Contract ready to sign
- Milestone approved (payment released)
- Client requested changes
- New comment/message
- Dispute status update
- Review received

**Features:**

- Mark as read/unread
- Filter by type
- "Mark all as read"

---

## 🤝 **BROKER SCREENS**

### 1️⃣ **Onboarding**

#### A11: Apply for Broker Role Page

**Type:** Full Page  
**Route:** `/broker/apply`  
**Backlog:** A11 - User ứng tuyển vai trò Broker

**Form Fields:**

- **Professional Background**
  - Years of experience as BA/PM
  - Industries worked in (multi-select)
  - Company/Organization history
- **Why do you want to be a Broker?** (text area)

- **Relevant Experience**

  - Number of projects managed
  - Average project budget
  - Team size typically managed

- **CV/Portfolio**

  - Upload CV (PDF)
  - LinkedIn profile URL
  - Portfolio website URL

- **References** (optional)

  - Reference contact info

- Submit button → Admin review (A12)

---

### 2️⃣ **Request Management**

#### C01: Broker Dashboard

**Type:** Full Page  
**Route:** `/broker/dashboard`  
**Backlog:** C01 - Dashboard Broker

**Sections:**

1. **Quick Stats Cards**

   - Pending requests (need to assign)
   - Active projects
   - Requests in spec phase
   - Total earnings this month

2. **Pending Requests Table**

   - Request ID, Client name
   - Product type, Industry
   - Budget range
   - Date submitted
   - "Take Request" button

3. **My Active Requests**

   - Requests you're handling
   - Current phase (Spec Draft / Waiting Client Approval / Matching Freelancers / etc.)
   - Quick actions

4. **Notifications**
   - Client feedback on specs
   - Freelancer responses
   - New requests matching your expertise

---

#### C02-C03: Request Detail Page (Broker View)

**Type:** Full Page  
**Route:** `/broker/requests/:requestId`  
**Backlog:** C02, C03 - Broker nhận xử lý Request, Chi tiết Request

**Header:**

- Request status badge
- Client info (name, Trust Score, contact)
- "Assign to Me" button (if not assigned yet)

**Wizard Answers Display** (Read-only)

- All 5 steps from client's wizard:
  - Product type selected
  - Industry
  - Budget & Timeline
  - Features selected
  - Description & attachments

**Action Section:**

- "Start Drafting Spec" → Navigate to C05
- "Request More Info" → Opens comment thread (C04)

---

#### C04: Request Comments Thread

**Type:** Inline component in Request Detail  
**Backlog:** C04 - Comment Broker–Client trong Request

**Features:**

- Chat-like interface
- Broker can ask clarifying questions
- Client can respond
- File attachments support
- Real-time updates (or refresh button)

---

### 3️⃣ **spec & Milestone Creation**

#### C05-C06: Project Spec Editor

**Type:** Full Page  
**Route:** `/broker/requests/:requestId/spec`  
**Backlog:** C05, C06 - Soạn Project Spec, Quản lý Milestone

**Layout:** Split view or tabbed

**Spec Document Section (C05):**

- **Project Overview**
  - Rich text editor
  - Project name
  - Background/Context
- **System Roles** (if applicable)
  - User types (Admin, Customer, Staff, etc.)
- **Features List**
  - Grouped by category
  - Each feature: Name, Description, Priority
- **In-Scope / Out-of-Scope**
  - Clear delineation of what's included/excluded
- **Tech Stack**
  - Select from preset tags or add custom
- **Assumptions & Dependencies**

**Milestones Section (C06):**

- Add/Edit/Delete milestone table
- Each milestone:
  - Name (e.g., "UI Design & Mockups")
  - Description
  - Deliverables checklist
  - Duration estimate (weeks)
  - Cost breakdown:
    - Developer share (85%)
    - Broker commission (10%)
    - Platform fee (5%)
  - Reorder milestones (drag-drop)

**Action Buttons:**

- Save as Draft (C07)
- Preview Spec
- Send to Client for Approval (C08)

**Mockup:**

```
┌───────────────────────────────────────────────────────────┐
│  Create Project Specification - E-commerce Platform       │
│  Client: Sarah Johnson          Request ID: #REQ-042      │
├───────────────────────────────────────────────────────────┤
│ [Document] [Milestones] [Preview]                         │
├───────────────────────────────────────────────────────────┤
│ PROJECT OVERVIEW                                          │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Project Name: [E-commerce Fashion Boutique Platform] │ │
│ │                                                       │ │
│ │ Description:                                          │ │
│ │ [Rich text editor for project overview...]           │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ FEATURES                          [+ Add Feature Group]  │
│ ┌─ User Management ────────────────────────────────────┐ │
│ │ ✓ User Registration & Login                   (P1)  │ │
│ │ ✓ Social Media Login (Google, Facebook)      (P2)  │ │
│ │ ✓ Profile Management                          (P1)  │ │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ┌─ Product Catalog ────────────────────────────────────┐ │
│ │ ✓ Product Listing with Filters                (P1)  │ │
│ │ ...                                                  │ │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ [Save Draft] [Preview] [Send to Client for Approval →]  │
└───────────────────────────────────────────────────────────┘

MILESTONES TAB:
┌───────────────────────────────────────────────────────────┐
│ MILESTONES                              [+ Add Milestone] │
├───────────────────────────────────────────────────────────┤
│ Milestone 1: UI/UX Design                        [Edit]   │
│ Duration: 2 weeks  │  Cost: $2,000                        │
│ Deliverables: ☑ Wireframes ☑ Mockups ☑ UI Components     │
│ Dev: $1,700 | Broker: $200 | Platform: $100              │
│ ───────────────────────────────────────────────────────   │
│ Milestone 2: Backend API Development            [Edit]   │
│ Duration: 4 weeks  │  Cost: $4,000                        │
│ ...                                                       │
└───────────────────────────────────────────────────────────┘
```

---

#### C07: Spec Version History

**Type:** Modal or sidebar panel  
**Trigger:** "View Versions" button on Spec Editor  
**Backlog:** C07 - Lưu version Spec

**Features:**

- List of versions (v1.0, v1.1, v2.0, etc.)
- Date created, by whom
- Status: Draft / Sent to Client / Approved
- "View" button → Shows read-only diff
- "Restore" button for drafts
- "Create New Version" if client requested changes

---

#### C08: Send Spec to Client Modal

**Type:** Modal Dialog  
**Trigger:** "Send to Client for Approval" button  
**Backlog:** C08 - Gửi Spec cho Client duyệt

**Features:**

- Preview of spec (read-only)
- Message to client (optional text area)
- Checkbox: "Notify client via email"
- Version number display (auto-increment)
- "Send" button
  - Changes spec status to PENDING_CLIENT_APPROVAL
  - Sends notification to client

---

### 4️⃣ **Freelancer Matching**

#### C09: Project Skill Configuration

**Type:** Section within Spec Editor or separate tab  
**Route:** `/broker/requests/:requestId/matching-config`  
**Backlog:** C09 - Cấu hình skill/tag kỹ thuật của project

**Features:**

- **Required Skills** (Multi-select tags)

  - Frontend: React, Vue, Angular
  - Backend: Node.js, Python, Java
  - Database: PostgreSQL, MongoDB
  - Other: AWS, Docker, etc.

- **Experience Level Required**

  - Junior (0-2 years)
  - Mid (2-5 years)
  - Senior (5+ years)

- **Minimum Trust Score** (slider)

  - Filter freelancers below certain trust score

- **KYC Verification Required** (checkbox)

- **Availability**
  - Part-time / Full-time / Contract

Save → Used by matching algorithm (C11)

---

#### C10: Browse & Filter Freelancers

**Type:** Full Page  
**Route:** `/broker/freelancers`  
**Backlog:** C10 - Duyệt & filter Freelancers

**Similar to Freelancer's "Browse Projects" but reverse:**

**Filters Sidebar:**

- Skills (multi-select tags)
- Experience level
- Hourly rate range
- Trust Score range
- KYC verified only
- Availability status
- Languages

**Freelancer Cards Grid:**

- Avatar, name, title
- Trust Score badge
- Star rating
- Key skills (top 5 tags)
- Hourly rate
- "View Profile" button
- "Add to Shortlist" button (for current project)

---

#### C11-C12: Matching Algorithm Results

**Type:** Full Page or Modal  
**Route:** `/broker/requests/:requestId/matching`  
**Backlog:** C11, C12 - Thuật toán matching, Suggested Freelancers

**Features:**

- **Auto-matched Freelancers** (based on C09 config)

  - Sorted by match score (high → low)
  - Each card shows:
    - Match score % (e.g., 95%)
    - Matching skills highlighted
    - Trust Score
    - Previous project count
    - "Add to Shortlist" button

- **Manual Search**

  - Search bar to find specific freelancers
  - Add to shortlist manually

- **Your Shortlist** (right sidebar or bottom section)
  - List of selected freelancers (1-5 recommended)
  - Reorder by drag-drop
  - Remove button
  - "Send Shortlist to Client" button (C13)

**Mockup:**

```
┌────────────────────────────────────────────────────────────┐
│  Find Freelancers - E-commerce Platform       [Shortlist:3]│
├────────────────────────────────────────────────────────────┤
│  🎯 Top Matches (Based on: React, Node.js, PostgreSQL)     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 👤 Alex Developer                    Match: 95% ⭐⭐  │  │
│  │ Senior Full-Stack Developer                          │  │
│  │ 🏷️ React • Node.js • PostgreSQL • AWS (4 matches)   │  │
│  │ Trust Score: ⭐⭐⭐⭐⭐ Trusted  |  15 projects done │  │
│  │ $80/hr  |  Available: Full-time                      │  │
│  │            [View Profile]  [➕ Add to Shortlist]     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 👤 Maria Garcia                      Match: 88% ⭐   │  │
│  │ ...                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Load More]                                                │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  YOUR SHORTLIST                     [Send to Client →]     │
│  1. Alex Developer (95%)              [×]                  │
│  2. Maria Garcia (88%)                [×]                  │
│  3. John Smith (82%)                  [×]                  │
└────────────────────────────────────────────────────────────┘
```

---

#### C13: Send Shortlist to Client

**Type:** Modal or page section  
**Trigger:** "Send Shortlist to Client" button  
**Backlog:** C13 - Gửi shortlist cho Client

**Features:**

- Preview of shortlist (freelancer cards)
- Message to client (optional)
  - "Based on your requirements, I recommend these freelancers..."
- "Send" button
  - Notifies client
  - Client can view shortlist and send invitations (B15, B16)

---

### 5️⃣ **Contract Management**

#### C15: Create Contract from Spec

**Type:** System Action (may have confirmation dialog)  
**Route:** Auto-triggered after Client accepts spec and invites freelancer  
**Backlog:** C15 - Khởi tạo Contract từ Spec

**Process:**

1. System auto-generates contract when:

   - Client accepts spec (B14)
   - Client selects freelancer(s) and sends invitation (B16)
   - Freelancer accepts invitation (C14)

2. Contract includes:

   - All parties (Client, Freelancer, Broker)
   - Spec version locked (v1.0)
   - Milestones with cost breakdown
   - Terms & conditions

3. Broker gets notification: "Contract #CTR-XXX created and ready for review"

---

#### C16-C17: Contract Detail Page (Broker View)

**Type:** Full Page  
**Route:** `/broker/contracts/:contractId`  
**Backlog:** C16, C17 - Chi tiết Contract, Flow ký hợp đồng

**Sections:**

1. **Contract Header**

   - Contract ID, status
   - Parties: Client, Freelancer, You (Broker)
   - Date created
   - Signing status for each party

2. **Contract Document**

   - Full contract text (read-only)
   - Download PDF button

3. **Milestones Table**

   - All milestones from spec
   - Escrow status column (C18, C19)
   - Payment status

4. **Signing Section** (C17)

   - If contract is PENDING_SIGNATURES:
     - Show who has signed
     - "Review & Sign" button for Broker
   - Once all signed → Contract status = ACTIVE

5. **Actions**
   - "Download Contract PDF"
   - "View Project Workspace" (once active)

---

#### C18-C19: Escrow Management View

**Type:** Full Page or section within Contract page  
**Route:** `/broker/contracts/:contractId/escrow`  
**Backlog:** C18, C19 - Mô phỏng nạp Escrow ảo, Tổng quan Contract & Escrow

**Features:**

- **Escrow Summary Card**

  - Total contract value
  - Total funded (by client)
  - Total released (to freelancer + you)
  - Pending amount

- **Milestones Escrow Table**

  - Milestone name
  - Total cost
  - Escrow status:
    - NOT_FUNDED (Client needs to fund)
    - FUNDED (Money in escrow)
    - RELEASED (Paid out)
    - DISPUTED
  - Your commission (10% of milestone cost)
  - Release date (if released)

- **Fund Flow Visualization** (optional)

  - Diagram showing: Client → Escrow → (Dev 85% / Broker 10% / Platform 5%)

- Note: Since this is "mô phỏng" (simulated), there's no actual payment gateway integration. Client just clicks "Fund Escrow" and system updates status.

---

### 6️⃣ **Project Monitoring**

#### Broker Project Workspace Access

**Type:** Same as Freelancer's D03 workspace but with Broker permissions  
**Route:** `/projects/:projectId/workspace`  
**Backlog:** D02, D03, D07-D11 (Broker can also access)

**Broker-specific features:**

- Can view all tasks
- Can create tasks for Freelancer
- Can see milestone progress
- Can monitor communications
- **Cannot** submit final deliverables (only Freelancer can)

---

### 7️⃣ **Earnings & Reports**

#### Broker Earnings Dashboard

**Type:** Full Page  
**Route:** `/broker/earnings`  
**Backlog:** Implied by C19, general workflow

**Features:**

- **Total Earnings** (lifetime)
- **This Month Earnings**
- **Pending Commissions** (from milestones not yet released)

- **Earnings Breakdown Table**

  - Project name
  - Client
  - Milestone
  - Commission amount (10%)
  - Status (Pending / Released)
  - Date released

- Filter by:

  - Date range
  - Project
  - Status

- Export to CSV

---

## 🔗 **SHARED SCREENS** (Both Freelancer & Broker)

### 1. Profile Settings

**Type:** Full Page  
**Route:** `/settings`  
**Features:**

- Account info
- Email/password change
- Notification preferences
- Privacy settings
- Linked accounts

### 2. Wallet & Transactions (if implemented)

**Type:** Full Page  
**Route:** `/wallet`  
**Features:**

- Current balance
- Transaction history (deposits, withdrawals, earnings)
- Request withdrawal (with bank account setup)

### 3. Trust Profile & Reviews

**Type:** Already documented in existing UI-SCREEN-CLASSIFICATION.md  
**Applies to:** All user types

### 4. My Disputes

**Type:** Full Page  
**Route:** `/disputes`  
**Backlog:** E09  
**Features:**

- List of all disputes (as claimant or respondent)
- Filter by status
- Recent disputes on top

### 5. Notification Center

**Type:** Slide-in panel  
**Trigger:** Bell icon in header  
**Features:**

- Real-time notifications
- Mark as read/unread
- Filter by category

---

## 📊 **COMPLETE SCREEN INVENTORY**

### Freelancer Screens Summary

| #   | Screen Name                    | Type            | Priority | Backlog      |
| --- | ------------------------------ | --------------- | -------- | ------------ |
| 1   | Become Freelancer Registration | Full Page       | P1       | A10          |
| 2   | Enhanced Profile (Freelancer)  | Full Page       | P1       | A05, E03-E06 |
| 3   | Browse Available Projects      | Full Page       | P1       | Implied      |
| 4   | Project Invitation Detail      | Full Page       | P1       | C14          |
| 5   | Contract Signing               | Full Page/Modal | P1       | C17          |
| 6   | My Projects List               | Full Page       | P1       | D02          |
| 7   | Project Workspace Dashboard    | Full Page       | P1       | D03          |
| 8   | Task Board (Kanban)            | Page Component  | P1       | D07-D09      |
| 9   | Create Task Modal              | Modal           | P1       | D08          |
| 10  | Task Detail Panel              | Slide-in        | P1       | D10          |
| 11  | Request Milestone Review       | Page/Modal      | P1       | D12          |
| 12  | Rate Client Modal              | Modal           | P2       | E02          |
| 13  | Create Dispute                 | Page/Modal      | P1       | E08          |
| 14  | Dispute Detail                 | Full Page       | P1       | E09          |
| 15  | Notifications Center           | Panel           | P2       | Implied      |
| 16  | Wallet & Earnings              | Full Page       | P2       | Implied      |
| 17  | Settings                       | Full Page       | P2       | A05          |
| 18  | Messages/Chat (if separate)    | Full Page       | P3       | D19          |

---

### Broker Screens Summary

| #   | Screen Name                   | Type         | Priority | Backlog      |
| --- | ----------------------------- | ------------ | -------- | ------------ |
| 1   | Apply for Broker              | Full Page    | P1       | A11          |
| 2   | Broker Dashboard              | Full Page    | P1       | C01          |
| 3   | Request Detail (Broker view)  | Full Page    | P1       | C02-C03      |
| 4   | Request Comments Thread       | Inline       | P2       | C04          |
| 5   | Project Spec Editor           | Full Page    | P1       | C05-C06      |
| 6   | Spec Version History          | Modal        | P1       | C07          |
| 7   | Send Spec Modal               | Modal        | P1       | C08          |
| 8   | Project Skill Config          | Page Section | P1       | C09          |
| 9   | Browse Freelancers            | Full Page    | P1       | C10          |
| 10  | Matching Results & Shortlist  | Full Page    | P1       | C11-C12      |
| 11  | Send Shortlist Modal          | Modal        | P1       | C13          |
| 12  | Contract Detail (Broker view) | Full Page    | P1       | C16          |
| 13  | Contract Signing (Broker)     | Modal        | P1       | C17          |
| 14  | Escrow Management             | Page/Section | P1       | C18-C19      |
| 15  | Broker Project Workspace      | Full Page    | P1       | D03 (shared) |
| 16  | Broker Earnings Dashboard     | Full Page    | P2       | Implied      |
| 17  | Create Dispute (Broker side)  | Page/Modal   | P1       | E08          |
| 18  | Notifications                 | Panel        | P2       | Implied      |
| 19  | Settings                      | Full Page    | P2       | Shared       |
| 20  | My Disputes                   | Full Page    | P1       | E09          |
| 21  | Task Board (Broker view)      | Page         | P1       | D07 (shared) |
| 22  | Messages/Chat                 | Full Page    | P3       | C04, D19     |

---

## 🎯 **HIGH PRIORITY IMPLEMENTATION ORDER**

### Phase 1: Core Freelancer Journey (P1)

1. Become Freelancer Registration (A10)
2. Enhanced Profile
3. Project Invitation Detail (C14)
4. Contract Signing (C17)
5. Project Workspace + Task Board (D03, D07-D10)
6. Request Milestone Review (D12)

### Phase 2: Core Broker Journey (P1)

1. Broker Dashboard (C01)
2. Request Detail (C03)
3. Spec Editor (C05-C06)
4. Send Spec (C08)
5. Browse & Match Freelancers (C10-C12)
6. Contract Management (C16, C18-C19)

### Phase 3: Discovery & Invitations (P1-P2)

1. Browse Projects (Freelancer)
2. Browse Freelancers (Broker)
3. Matching algorithm integration
4. Invitation flows

### Phase 4: Disputes & Trust (P1-P2)

1. Create Dispute (E08)
2. Dispute Detail (E09)
3. Trust Score display (E04-E06)
4. Rating modals (E01, E02)

### Phase 5: Communication & Polish (P2-P3)

1. Notification center
2. Comments/Chat (C04, D19)
3. Wallet/Earnings pages
4. Settings & Security

---

## 📐 **UI/UX Guidelines**

### Design Patterns to Reuse:

- ✅ Wizard flow (already exists for Client) → Adapt for Freelancer/Broker onboarding
- ✅ Modal system → Create/Edit forms
- ✅ Slide-in panels → Task details, Notifications
- ✅ Kanban board → Implement with drag-drop library (react-beautiful-dnd)
- ✅ Card grids → Projects, Freelancers, Requests lists

### Role-Based UI Variations:

- Use **color coding** for different roles:

  - Client: Blue accent
  - Freelancer: Green accent
  - Broker: Purple accent
  - Admin: Red/Orange accent

- **Sidebar navigation** should show different menu items per role
- **Dashboard widgets** customized per role

### Responsive Considerations:

- Task Board: On mobile, switch to list view instead of 3-column Kanban
- Spec Editor: Provide "Mobile-friendly preview" mode
- Modals: Full-screen on mobile for complex forms

---

## 🔄 **Integration Points**

### Freelancer ↔ Broker Interactions:

- Broker sends invitation → Freelancer receives (C14)
- Freelancer accepts → Broker notified
- Broker creates tasks → Freelancer sees on Task Board
- Freelancer requests review → Broker (and Staff/Client) notified

### Freelancer ↔ Client Interactions:

- Client accepts milestone → Freelancer gets payment
- Client raises dispute → Freelancer responds (E09)
- Client rates freelancer → Shows on Freelancer profile (E01)

### Broker ↔ Client Interactions:

- Broker sends spec → Client reviews (C08 → B12)
- Client requests changes → Broker updates spec (B13 → C05)
- Broker sends shortlist → Client invites freelancers (C13 → B16)

---

## 📝 **Development Notes**

### API Endpoints Needed (Examples):

```
Freelancer:
- POST /api/users/become-freelancer (A10)
- GET /api/projects/invitations (C14 list)
- POST /api/projects/:id/invitations/:invitationId/accept (C14)
- GET /api/projects/:id/tasks (D07)
- POST /api/projects/:id/tasks (D08)
- PUT /api/tasks/:id/status (D09)
- POST /api/milestones/:id/request-review (D12)

Broker:
- POST /api/users/apply-broker (A11)
- GET /api/broker/dashboard (C01)
- GET /api/requests/:id (C03)
- POST /api/specs (C05)
- PUT /api/specs/:id (C06)
- GET /api/freelancers?skills=...&trustScore=... (C10)
- POST /api/matching/compute (C11)
- POST /api/contracts/:id/sign (C17)
```

### Database Entities Implied:

- FreelancerProfile (extends User)
- BrokerProfile (extends User)
- ProjectInvitation
- ProjectSpec (with versioning)
- Milestone
- Task
- Contract
- EscrowTransaction
- Dispute

---

<div align="center">

**Total Screens for Freelancer: 18+**  
**Total Screens for Broker: 22+**  
**Shared Screens: 8**

**Grand Total: ~40+ UI Screens**

Last Updated: 2026-01-08

</div>
