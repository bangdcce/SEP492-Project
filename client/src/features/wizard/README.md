# Wizard Feature

## Overview

Step-by-step wizard for creating project requests (UC-11). Guides clients through defining their project requirements in a structured way.

## Structure

```
wizard/
├── components/
│   ├── StepB1.tsx              # Step 1: Select project category/domain
│   ├── StepB2.tsx              # Step 2: Describe project requirements
│   ├── StepB3.tsx              # Step 3: Technology preferences
│   ├── StepB4.tsx              # Step 4: Budget and timeline
│   └── StepB5.tsx              # Step 5: Review and submit
├── services/
│   └── wizardService.ts        # API calls and wizard state management
├── WizardPage.tsx              # Main wizard container with step navigation
└── README.md                   # This file
```

## Wizard Flow

```
Step 1 (Domain) → Step 2 (Description) → Step 3 (Tech) → Step 4 (Budget) → Step 5 (Review) → Submit
```

### Step 1: Project Category
- Select project domain/category from predefined list
- Categories are loaded from the backend (WizardModule)

### Step 2: Project Description
- Detailed project description
- Key requirements and deliverables
- Any special constraints

### Step 3: Technology Preferences
- Select preferred technologies/frameworks
- Platform preferences (Web, Mobile, Desktop)
- Any technology constraints

### Step 4: Budget & Timeline
- Set budget range (VND)
- Expected timeline
- Milestone preferences

### Step 5: Review & Submit
- Review all entered information
- Edit any step before submission
- Submit creates the project request in DRAFT status

## Backend Integration

- `POST /wizard/questions` — Fetch wizard questions
- `POST /project-requests` — Submit completed wizard data
- `GET /project-requests/:id` — Load draft for editing
