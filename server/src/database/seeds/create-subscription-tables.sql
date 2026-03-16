-- ================================================
-- Create Subscription System Tables + Seed Data
-- ================================================
-- Run this once to set up the subscription system.
-- ================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  "displayName" VARCHAR(100) NOT NULL,
  description TEXT,
  role users_role_enum NOT NULL,
  price_monthly DECIMAL(12,0) DEFAULT 99000,
  price_quarterly DECIMAL(12,0) DEFAULT 252000,
  price_yearly DECIMAL(12,0) DEFAULT 832000,
  perks JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create enums
DO $$ BEGIN
  CREATE TYPE subscription_status_enum AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle_enum AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status subscription_status_enum DEFAULT 'ACTIVE',
  billing_cycle billing_cycle_enum DEFAULT 'MONTHLY',
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancel_reason TEXT,
  cancelled_at TIMESTAMP,
  amount_paid DECIMAL(12,0) DEFAULT 0,
  payment_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create quota action enum
DO $$ BEGIN
  CREATE TYPE quota_action_enum AS ENUM (
    'CREATE_REQUEST', 'CONVERT_TO_PROJECT', 'AI_MATCH_SEARCH', 'INVITE_BROKER',
    'APPLY_TO_REQUEST', 'CREATE_PROPOSAL', 'APPLY_TO_PROJECT', 'ADD_PORTFOLIO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create quota_usage_logs table
CREATE TABLE IF NOT EXISTS quota_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action quota_action_enum NOT NULL,
  date DATE NOT NULL,
  count INT DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_action_date ON quota_usage_logs(user_id, action, date);
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_action_created ON quota_usage_logs(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_period_end ON user_subscriptions(status, current_period_end);

-- ================================================
-- Seed subscription plans
-- ================================================

INSERT INTO subscription_plans (id, name, "displayName", description, role, price_monthly, price_quarterly, price_yearly, perks, is_active, display_order)
VALUES
  (uuid_generate_v4(), 'CLIENT_PREMIUM', 'Premium Client',
   'Unlock unlimited project requests, AI-powered matching with more candidates, and expanded partner invitations.',
   'CLIENT', 99000, 252000, 832000,
   '{"maxActiveRequests": -1, "maxActiveProjects": -1, "aiMatchesPerDay": -1, "aiCandidatesShown": 10, "invitesPerRequest": 15, "featuredProfile": false}'::jsonb,
   true, 1),

  (uuid_generate_v4(), 'BROKER_PREMIUM', 'Premium Broker',
   'Apply to unlimited requests weekly, get featured in search results, view client budgets, and enjoy a reduced 10% commission rate.',
   'BROKER', 99000, 252000, 832000,
   '{"appliesPerWeek": -1, "maxActiveProposals": 15, "commissionRate": 10, "viewClientBudget": true, "featuredProfile": true}'::jsonb,
   true, 2),

  (uuid_generate_v4(), 'FREELANCER_PREMIUM', 'Premium Freelancer',
   'Get unlimited applications, showcase up to 10 portfolio items, highlight your CV in AI matching results, and appear featured in search.',
   'FREELANCER', 99000, 252000, 832000,
   '{"appliesPerWeek": -1, "portfolioSlots": 10, "cvHighlighted": true, "featuredProfile": true}'::jsonb,
   true, 3)
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT name, "displayName", role, price_monthly FROM subscription_plans ORDER BY display_order;
