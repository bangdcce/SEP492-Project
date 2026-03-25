-- ================================================
-- Subscription Plans Seed Data
-- ================================================
-- Seeds the initial premium subscription plans for each user role.
-- Each role gets one PREMIUM plan with role-specific perks.
--
-- Pricing (VND):
--   Monthly:   99,000
--   Quarterly: 252,000 (15% discount)
--   Yearly:    832,000 (30% discount)
--
-- Run this SQL after the subscription migration has been applied.
-- Usage: psql -d interdev -f subscription-plans-seed.sql
-- ================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- CLIENT_PREMIUM Plan
-- ================================================
-- Perks:
--   Active requests: Unlimited (-1)
--   Active projects: Unlimited (-1)
--   AI matches/day: Unlimited (-1)
--   AI candidates shown: Top 10
--   Invites per request: 15
-- ================================================
INSERT INTO subscription_plans (
  id,
  name,
  "displayName",
  description,
  role,
  price_monthly,
  price_quarterly,
  price_yearly,
  perks,
  is_active,
  display_order,
  created_at,
  updated_at
) VALUES (
  uuid_generate_v4(),
  'CLIENT_PREMIUM',
  'Premium Client',
  'Unlock unlimited project requests, AI-powered matching with more candidates, and expanded partner invitations. Perfect for clients managing multiple projects.',
  'CLIENT',
  99000,
  252000,
  832000,
  '{
    "maxActiveRequests": -1,
    "maxActiveProjects": -1,
    "aiMatchesPerDay": -1,
    "aiCandidatesShown": 10,
    "invitesPerRequest": 15,
    "featuredProfile": false
  }'::jsonb,
  true,
  1,
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ================================================
-- BROKER_PREMIUM Plan
-- ================================================
-- Perks:
--   Applies per week: Unlimited (-1)
--   Active proposals: 15
--   Commission rate: 10% (reduced from 15%)
--   View client budget: Yes
--   Featured profile: Yes (appears first in search)
-- ================================================
INSERT INTO subscription_plans (
  id,
  name,
  "displayName",
  description,
  role,
  price_monthly,
  price_quarterly,
  price_yearly,
  perks,
  is_active,
  display_order,
  created_at,
  updated_at
) VALUES (
  uuid_generate_v4(),
  'BROKER_PREMIUM',
  'Premium Broker',
  'Apply to unlimited requests weekly, get featured in search results, view client budgets, and enjoy a reduced 10% commission rate. Ideal for active brokers growing their business.',
  'BROKER',
  99000,
  252000,
  832000,
  '{
    "appliesPerWeek": -1,
    "maxActiveProposals": 15,
    "commissionRate": 10,
    "viewClientBudget": true,
    "featuredProfile": true
  }'::jsonb,
  true,
  2,
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ================================================
-- FREELANCER_PREMIUM Plan
-- ================================================
-- Perks:
--   Applies per week: Unlimited (-1)
--   Portfolio slots: 10
--   CV highlighted in matching: Yes
--   Featured profile: Yes (appears first in search)
-- ================================================
INSERT INTO subscription_plans (
  id,
  name,
  "displayName",
  description,
  role,
  price_monthly,
  price_quarterly,
  price_yearly,
  perks,
  is_active,
  display_order,
  created_at,
  updated_at
) VALUES (
  uuid_generate_v4(),
  'FREELANCER_PREMIUM',
  'Premium Freelancer',
  'Get unlimited applications, showcase up to 10 portfolio items, highlight your CV in AI matching results, and appear featured in search results. Essential for freelancers looking to stand out.',
  'FREELANCER',
  99000,
  252000,
  832000,
  '{
    "appliesPerWeek": -1,
    "portfolioSlots": 10,
    "cvHighlighted": true,
    "featuredProfile": true
  }'::jsonb,
  true,
  3,
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ================================================
-- Verification Query
-- ================================================
-- Run after seeding to verify all plans were inserted correctly.
-- Expected: 3 rows (CLIENT_PREMIUM, BROKER_PREMIUM, FREELANCER_PREMIUM)
-- ================================================
-- SELECT
--   name,
--   "displayName",
--   role,
--   price_monthly,
--   price_quarterly,
--   price_yearly,
--   perks,
--   is_active
-- FROM subscription_plans
-- ORDER BY display_order;
