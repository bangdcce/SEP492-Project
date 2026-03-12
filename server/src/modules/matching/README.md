# Matching Module

## Overview

AI-powered candidate matching system for connecting project requests with suitable freelancers and brokers.

Implements UC-25 (View List Available Partner), UC-26 (View Partner Detail), UC-27 (Invite Partner).

## Architecture

```
matching/
├── dto/
│   └── match-query.dto.ts          # Query parameters for matching
├── interfaces/
│   └── match.interfaces.ts         # TypeScript interfaces
├── matching.module.ts              # NestJS module
├── matching.controller.ts          # REST endpoints
├── matching.service.ts             # Orchestrator service
├── hard-filter.service.ts          # Stage 1: Binary eligibility filter
├── tag-scorer.service.ts           # Stage 2: Skill/tag scoring
├── classifier.service.ts           # Stage 3: Score classification
├── ai-ranker.service.ts            # Stage 4: LLM-based ranking
├── llm-client.service.ts           # FPT.AI LLM client
├── matching.service.spec.ts        # Unit tests
├── classifier.service.spec.ts      # Unit tests
├── tag-scorer.service.spec.ts      # Unit tests
└── README.md                       # This file
```

## Matching Pipeline

The matching system uses a 4-stage pipeline:

```
Candidates → [Hard Filter] → [Tag Scorer] → [Classifier] → [AI Ranker] → Results
```

1. **Hard Filter** — Removes ineligible candidates (banned, wrong role, etc.)
2. **Tag Scorer** — Scores candidates based on skill/tag overlap with request
3. **Classifier** — Classifies scores into tiers (Excellent, Good, Fair, etc.)
4. **AI Ranker** — Uses FPT.AI LLM to generate detailed candidate analysis

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/matching/:requestId` | Find matching candidates for a request |

## Quota Integration

AI matching is subject to quota limits:
- **Free users**: 1 search per day, top 3 candidates shown
- **Premium users**: Unlimited searches, top 10 candidates shown

## Configuration

FPT.AI LLM configuration in `.env`:
```
FPT_AI_API_KEY=your-api-key
FPT_AI_API_URL=https://api.fpt.ai/...
```
