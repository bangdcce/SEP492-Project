# Discovery Feature

## Overview

Partner discovery and invitation system — browse, evaluate, and invite freelancers/brokers to project requests.

Implements UC-25 (View List Available Partner), UC-26 (View Partner Detail), UC-27 (Invite Partner).

## Structure

```
discovery/
├── DiscoveryPage.tsx          # AI-matched partner list (UC-25)
├── PartnerProfilePage.tsx     # Partner detail view (UC-26)
├── InviteModal.tsx            # Invite partner modal (UC-27)
├── api.ts                     # API client functions
└── README.md                  # This file
```

## Key Pages

### DiscoveryPage
- Displays AI-matched partners from the Matching Module
- Partners are scored and classified (Excellent, Good, Fair, etc.)
- Shows skill overlap, trust score, and project history
- Filter by role (Broker/Freelancer)
- Pagination and search

### PartnerProfilePage
- Detailed partner profile view
- Skills, portfolio, past projects
- Trust score and badge display
- Reviews and ratings from other users
- Invite button

### InviteModal
- Send invitation to join a project request
- Select which request to invite for
- Optional message to the partner
- Confirmation before sending

## Integration

- **Matching Module**: Backend AI pipeline provides ranked candidates
- **Premium Perks**: Free users see top 3 candidates, premium sees top 10
