# Feedback Review Demo Guide

## Goal
This seed prepares a realistic demo pack for:

- `View Others Feedback`
- `Report Feedback`
- `Rate Other User`

The dataset is centered on the three main demo accounts you use manually, but it now also includes a small supporting cast so trust profiles, project history, and historical feedback look more like a real product environment.

## Run
From [server](/D:/Đồ%20án/InterDev/server):

```bash
yarn seed:feedback-review-guide
```

The command is idempotent. Re-running it will reset the demo baseline for the three main accounts and rebuild the curated feedback/history package.

## Main Accounts

| Actor | Email | Password | Purpose |
| --- | --- | --- | --- |
| Client | `client.test.new@example.com` | `password123` | Main client actor for demo flows |
| Broker | `broker.test.new@example.com` | `password123` | Main broker actor for demo flows |
| Freelancer | `freelancer.test.new@example.com` | `password123` | Main freelancer actor for demo flows |

## Core Northstar Projects

These are the main cross-actor projects for the three primary accounts:

1. `Northstar Wellness Booking Website Refresh`
2. `Northstar Wellness Member Portal MVP`
3. `Northstar Wellness Operations Dashboard`
4. `Northstar Wellness Loyalty Campaign Microsite`

`Northstar Wellness Loyalty Campaign Microsite` remains the newest shared anchor project for live rating.

The visible Northstar client projects are also seeded with:

- released escrow records on each milestone
- activated contract snapshots
- completed task rows with proof links and submission notes

This keeps the project workspace ready for screenshots around funding, approval, completion, and rating flows.

## Additional Historical Projects

To make broker history and prior delivery context richer, the seed also adds:

1. `Cedar & Salt Studio Multi-Location Booking Migration`
2. `Meridian Physiotherapy Intake Automation`
3. `Harbor Pilates Referral Analytics Sprint`
4. `Northstar Wellness Staff Enablement Hub`

These projects add deeper project history and extra review coverage without removing the live rating path between the three main demo accounts.

## Historical Review Matrix

Seeded reviews now include:

1. `client.test.new@example.com` -> `broker.test.new@example.com`
   Project: `Northstar Wellness Booking Website Refresh`
2. `quynh.vo.demo@example.com` -> `broker.test.new@example.com`
   Project: `Northstar Wellness Booking Website Refresh`
3. `maya.nguyen.demo@example.com` -> `broker.test.new@example.com`
   Project: `Cedar & Salt Studio Multi-Location Booking Migration`
4. `duc.ho.demo@example.com` -> `broker.test.new@example.com`
   Project: `Harbor Pilates Referral Analytics Sprint`
5. `broker.test.new@example.com` -> `freelancer.test.new@example.com`
   Project: `Northstar Wellness Member Portal MVP`
6. `freelancer.test.new@example.com` -> `client.test.new@example.com`
   Project: `Northstar Wellness Operations Dashboard`

No reports are pre-seeded. `Report Feedback` is still meant to be exercised live.

## Why The Booking Project Uses A Supporting Freelancer

The current UI locks `Leave a Review` by `viewer -> target` across the whole profile, not per project.

Because of that, if `freelancer.test.new@example.com` had already reviewed `broker.test.new@example.com`, the live demo path `Freelancer -> Broker` would disappear.

To keep both requirements at once:

- broker profile shows a freelancer review on `Northstar Wellness Booking Website Refresh`
- the main freelancer account still keeps the live `Rate Other User` path to the broker

the booking project uses a supporting freelancer in the seeded historical record.

## Live Demo Paths That Still Remain

1. Client logs in and can still rate Freelancer on `Northstar Wellness Loyalty Campaign Microsite`
2. Broker logs in and can still rate Client on `Northstar Wellness Loyalty Campaign Microsite`
3. Freelancer logs in and can still rate Broker on `Northstar Wellness Loyalty Campaign Microsite`

## Suggested Demo Flow

### Broker profile (`broker.test.new@example.com`)

- Open Minh Dao's trust profile
- You should now see multiple historical reviews, including multiple reviews tied to older projects
- `Northstar Wellness Booking Website Refresh` should show more than one broker review context, including a freelancer review
- Project history should be broader than the original four-project baseline

### View Others Feedback

- Log in as Client and open Freelancer profile
- Log in as Broker and open Client profile
- Log in as Freelancer and open Broker profile

Each main actor should see at least one review written by someone else.

### Report Feedback

- Open any non-own review from the profile pages above
- Use `Report Review`

Reports are intentionally not pre-seeded.

### Rate Other User

- Use the main three accounts only
- The newest shared live anchor remains `Northstar Wellness Loyalty Campaign Microsite`

If you need to reset after testing, run:

```bash
yarn seed:feedback-review-guide
```
