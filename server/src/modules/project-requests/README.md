# Project Requests Module

## Overview

Manages the full lifecycle of project requests — from creation through the wizard to broker assignment and conversion to a project.

Implements UC-11 through UC-16, UC-19 through UC-21, UC-25 through UC-27.

## Architecture

```
project-requests/
├── dto/
│   ├── create-project-request.dto.ts   # Request creation DTO
│   ├── respond-invitation.dto.ts       # Accept/Deny invitation DTO
│   └── update-project-request.dto.ts   # Request update DTO
├── project-requests.module.ts          # NestJS module
├── project-requests.controller.ts      # REST endpoints
├── project-requests.service.ts         # Core business logic
├── project-requests.service.spec.ts    # Unit tests
└── README.md                           # This file
```

## Request Lifecycle

```
DRAFT → PUBLIC_DRAFT → BROKER_ASSIGNED → SPEC_APPROVED → CONTRACT_PENDING → IN_PROGRESS → COMPLETED
  ↓         ↓                                                                                  ↓
  └─ CANCELLED ←──────────────────────────────────────────────────────────────── CANCELED ──────┘
```

## Key Features

- **Wizard Integration**: Requests are created through a step-by-step wizard (via WizardModule)
- **Privacy Toggle**: UC-15 — Toggle between Public/Private, auto-reject pending applications
- **Application Management**: UC-20, UC-21 — View and approve/reject broker applications
- **Invitation System**: UC-51, UC-52, UC-53 — Invite brokers/freelancers to requests
- **AI Matching**: UC-25 — Find suitable partners via the MatchingModule pipeline

## API Endpoints

| Method | Path | UC | Description |
|--------|------|-----|-------------|
| `POST` | `/project-requests` | UC-11 | Create new request |
| `GET` | `/project-requests` | UC-13 | List current requests |
| `GET` | `/project-requests/:id` | UC-14 | View request detail |
| `PATCH` | `/project-requests/:id` | UC-19 | Edit request |
| `DELETE` | `/project-requests/:id` | UC-16 | Delete request |
| `POST` | `/project-requests/:id/publish` | UC-12 | Post to marketplace |
| `POST` | `/project-requests/:id/make-private` | UC-15 | Make private |
| `GET` | `/project-requests/:id/applications` | UC-20 | View applications |
| `POST` | `/project-requests/:id/applications/:appId/respond` | UC-21 | Approve/Reject |
| `POST` | `/project-requests/:id/invite` | UC-27 | Invite partner |

## Quota Integration

The following actions are subject to free-tier limits:
- **Create Request**: Max 2 active requests for free users
- **Invite Broker**: Max 3 invites per request for free users
