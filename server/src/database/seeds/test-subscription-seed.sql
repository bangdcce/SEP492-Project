-- ================================================
-- Test Subscription Data Seed
-- ================================================
-- Seeds test subscription data for development and QA environments.
-- Creates sample subscriptions for test accounts to verify
-- subscription features and quota enforcement.
--
-- Prerequisites:
--   - subscription-plans-seed.sql must be run first
--   - Test user accounts must exist in the users table
--
-- Usage: psql -d interdev -f test-subscription-seed.sql
-- ================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Sample Active Subscriptions
-- ================================================
-- These create active premium subscriptions for test accounts.
-- Adjust user IDs to match your local test accounts.
--
-- Note: In production, subscriptions are created via the API.
-- This seed data is ONLY for development/testing purposes.
-- ================================================

-- Helper: Get plan IDs by name
DO $$
DECLARE
  v_client_plan_id UUID;
  v_broker_plan_id UUID;
  v_freelancer_plan_id UUID;
  v_test_client_id UUID;
  v_test_broker_id UUID;
  v_test_freelancer_id UUID;
BEGIN
  -- Get plan IDs
  SELECT id INTO v_client_plan_id FROM subscription_plans WHERE name = 'CLIENT_PREMIUM' LIMIT 1;
  SELECT id INTO v_broker_plan_id FROM subscription_plans WHERE name = 'BROKER_PREMIUM' LIMIT 1;
  SELECT id INTO v_freelancer_plan_id FROM subscription_plans WHERE name = 'FREELANCER_PREMIUM' LIMIT 1;

  -- Get first test user of each role
  -- Adjust these queries to match your test account setup
  SELECT id INTO v_test_client_id FROM users WHERE role = 'CLIENT' AND status = 'ACTIVE' LIMIT 1;
  SELECT id INTO v_test_broker_id FROM users WHERE role = 'BROKER' AND status = 'ACTIVE' LIMIT 1;
  SELECT id INTO v_test_freelancer_id FROM users WHERE role = 'FREELANCER' AND status = 'ACTIVE' LIMIT 1;

  -- Insert test subscriptions only if users and plans exist
  IF v_client_plan_id IS NOT NULL AND v_test_client_id IS NOT NULL THEN
    INSERT INTO user_subscriptions (
      id, user_id, plan_id, status, billing_cycle,
      current_period_start, current_period_end,
      cancel_at_period_end, amount_paid,
      created_at, updated_at
    ) VALUES (
      uuid_generate_v4(),
      v_test_client_id,
      v_client_plan_id,
      'ACTIVE',
      'MONTHLY',
      NOW(),
      NOW() + INTERVAL '30 days',
      false,
      99000,
      NOW(),
      NOW()
    ) ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Created test subscription for client: %', v_test_client_id;
  END IF;

  IF v_broker_plan_id IS NOT NULL AND v_test_broker_id IS NOT NULL THEN
    INSERT INTO user_subscriptions (
      id, user_id, plan_id, status, billing_cycle,
      current_period_start, current_period_end,
      cancel_at_period_end, amount_paid,
      created_at, updated_at
    ) VALUES (
      uuid_generate_v4(),
      v_test_broker_id,
      v_broker_plan_id,
      'ACTIVE',
      'QUARTERLY',
      NOW(),
      NOW() + INTERVAL '90 days',
      false,
      252000,
      NOW(),
      NOW()
    ) ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Created test subscription for broker: %', v_test_broker_id;
  END IF;

  IF v_freelancer_plan_id IS NOT NULL AND v_test_freelancer_id IS NOT NULL THEN
    INSERT INTO user_subscriptions (
      id, user_id, plan_id, status, billing_cycle,
      current_period_start, current_period_end,
      cancel_at_period_end, amount_paid,
      created_at, updated_at
    ) VALUES (
      uuid_generate_v4(),
      v_test_freelancer_id,
      v_freelancer_plan_id,
      'ACTIVE',
      'YEARLY',
      NOW(),
      NOW() + INTERVAL '365 days',
      false,
      832000,
      NOW(),
      NOW()
    ) ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Created test subscription for freelancer: %', v_test_freelancer_id;
  END IF;

  -- Create sample quota usage logs for testing quota limits
  IF v_test_client_id IS NOT NULL THEN
    INSERT INTO quota_usage_logs (
      id, user_id, action, date, count, metadata, created_at
    ) VALUES
      (uuid_generate_v4(), v_test_client_id, 'CREATE_REQUEST', CURRENT_DATE, 1, '{"requestId": "test-req-1"}'::jsonb, NOW()),
      (uuid_generate_v4(), v_test_client_id, 'AI_MATCH_SEARCH', CURRENT_DATE, 1, '{"requestId": "test-req-1"}'::jsonb, NOW()),
      (uuid_generate_v4(), v_test_client_id, 'INVITE_BROKER', CURRENT_DATE, 2, '{"requestId": "test-req-1", "brokerIds": ["b1", "b2"]}'::jsonb, NOW())
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created sample quota usage logs for client: %', v_test_client_id;
  END IF;

END $$;

-- ================================================
-- Verification Queries
-- ================================================
-- SELECT
--   us.id,
--   u.email,
--   u.role,
--   sp.name AS plan_name,
--   us.status,
--   us.billing_cycle,
--   us.current_period_start,
--   us.current_period_end,
--   us.amount_paid
-- FROM user_subscriptions us
-- JOIN users u ON u.id = us.user_id
-- JOIN subscription_plans sp ON sp.id = us.plan_id
-- ORDER BY us.created_at DESC;
--
-- SELECT
--   qul.user_id,
--   u.email,
--   qul.action,
--   qul.date,
--   qul.count,
--   qul.metadata
-- FROM quota_usage_logs qul
-- JOIN users u ON u.id = qul.user_id
-- ORDER BY qul.created_at DESC;
