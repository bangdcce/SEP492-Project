# Requests Feature

## Overview

Client-facing request management — viewing, editing, and managing project requests and their lifecycle.

Implements UC-13 (View List Current Request), UC-14 (View Request Detail), UC-19 (Edit Request), UC-20 (View Applications), UC-21 (Approve/Reject Application), UC-58 (View Public Request), UC-59 (View Public Request Detail), UC-60 (Apply To Public Request).

## Structure

```
requests/
├── components/
│   ├── CandidateProfileModal.tsx    # Candidate detail modal
│   ├── CommentsSection.tsx          # Comments/chat section
│   ├── ProjectPhaseStepper.tsx      # Visual phase progress indicator
│   └── ScoreExplanationModal.tsx    # AI matching score explanation
├── MyRequestsPage.tsx               # Client's request list (UC-13)
├── RequestDetailPage.tsx            # Full request detail view (UC-14)
├── FreelancerRequestsPage.tsx       # Freelancer's request list (UC-58)
├── FreelancerRequestDetailPage.tsx  # Freelancer request detail (UC-59)
├── types.ts                         # TypeScript interfaces
└── README.md                        # This file
```

## Key Pages

### MyRequestsPage (Client)
- Lists all current requests for the authenticated client
- Filter by status (Draft, Public, Broker Assigned, etc.)
- Create new request button → Wizard flow
- Quick actions: Edit, Delete, Make Private/Public

### RequestDetailPage (Client)
- Full request information display
- Application management (view, approve, reject)
- Invitation management
- AI matching results  
- Phase progress stepper
- Real-time status updates

### FreelancerRequestsPage (Freelancer/Broker)
- Browse public requests in the marketplace
- Apply to requests with cover letter
- View application status

## Request Status Flow

```
DRAFT → PUBLIC_DRAFT → BROKER_ASSIGNED → SPEC_APPROVED → CONTRACT_PENDING → IN_PROGRESS → COMPLETED
```
