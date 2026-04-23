# Requests Feature

## Overview

Client-facing request management for viewing, editing, and progressing project requests through the broker and freelancer workflow.

This feature covers current-request listing, request-detail viewing, broker application review, freelancer marketplace preview, and invitation-based freelancer access.

## Structure

```text
requests/
|-- components/
|   |-- CandidateProfileModal.tsx    # Candidate detail modal
|   |-- ProjectPhaseStepper.tsx      # Visual phase progress indicator
|   `-- ScoreExplanationModal.tsx    # AI matching score explanation
|-- MyRequestsPage.tsx               # Client request list
|-- RequestDetailPage.tsx            # Client request detail and workflow management
|-- FreelancerRequestsPage.tsx       # Freelancer invited-request list
|-- FreelancerRequestDetailPage.tsx  # Freelancer request detail / marketplace preview
|-- types.ts                         # TypeScript interfaces
`-- README.md                        # This file
```

## Key Pages

### MyRequestsPage (Client)

- Lists all current requests for the authenticated client
- Filters by status such as draft, public, broker assigned, and later workflow states
- Starts the create-request flow through the wizard
- Supports quick actions such as edit, delete, and make private/public

### RequestDetailPage (Client)

- Shows full request information
- Manages broker applications, including view, approve, and reject
- Manages invitations and matching results
- Shows phase progress and real-time workflow status

### Broker Marketplace Flow

- Brokers browse public requests from the broker marketplace
- Brokers can open request detail and apply with a cover letter
- Broker applications are reviewed by the client inside the client request flow

### Freelancer Marketplace Flow

- Freelancers browse phase-3 marketplace previews only
- Freelancers can open request previews and invited requests
- Freelancers do not self-apply directly in the current implementation
- Freelancer participation becomes active through broker recommendation, client approval, and invitation response

## Request Status Flow

```text
DRAFT -> PUBLIC_DRAFT -> BROKER_ASSIGNED -> SPEC_APPROVED -> CONTRACT_PENDING -> IN_PROGRESS -> COMPLETED
```
