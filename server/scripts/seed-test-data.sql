-- =============================================================================
-- SEED DATA FOR DISPUTES & CALENDAR TESTING (FINAL CHECKED v5)
-- Run in Supabase SQL Editor in ORDER (top to bottom)
-- =============================================================================

-- =============================================================================
-- 1) USERS (Base table)
-- =============================================================================
INSERT INTO users (id, email, "passwordHash", "fullName", role, "isVerified", "createdAt", "updatedAt")
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'client.test@interdev.local', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOl9d4kkLFzqJJFqSqcNALWH4k9k3RGXO', 'Test Client', 'CLIENT', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'freelancer.test@interdev.local', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOl9d4kkLFzqJJFqSqcNALWH4k9k3RGXO', 'Test Freelancer', 'FREELANCER', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'broker.test@interdev.local', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOl9d4kkLFzqJJFqSqcNALWH4k9k3RGXO', 'Test Broker', 'BROKER', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'staff.test@interdev.local', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOl9d4kkLFzqJJFqSqcNALWH4k9k3RGXO', 'Test Staff', 'STAFF', true, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', 'admin.test@interdev.local', '$2b$10$EpRnTzVlqHNP0.fUbXUwSOl9d4kkLFzqJJFqSqcNALWH4k9k3RGXO', 'Test Admin', 'ADMIN', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2) PROJECTS
-- =============================================================================
INSERT INTO projects (id, "clientId", "brokerId", "freelancerId", title, description, "totalBudget", currency, status, "createdAt", "updatedAt")
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 
   '[TEST] E-commerce Website', 'Build a full-featured e-commerce platform', 5000.00, 'USD', 'IN_PROGRESS', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 
   '[TEST] Mobile App', 'iOS and Android mobile application', 8000.00, 'USD', 'COMPLETED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3) MILESTONES
-- =============================================================================
INSERT INTO milestones (id, "projectId", title, description, amount, status, "createdAt")
VALUES 
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'UI/UX Design', 'Complete wireframes and mockups', 1000.00, 'COMPLETED', NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Frontend Development', 'Build React frontend', 2000.00, 'IN_PROGRESS', NOW()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Backend API', 'Build Node.js backend', 2000.00, 'PENDING', NOW()),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'App Development', 'Full app development', 8000.00, 'COMPLETED', NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4) ESCROWS
-- =============================================================================
INSERT INTO escrows (id, "projectId", "milestoneId", "totalAmount", "fundedAmount", "releasedAmount", "developerShare", "brokerShare", "platformFee", status, "createdAt", "updatedAt")
VALUES 
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1000.00, 1000.00, 0, 850.00, 100.00, 50.00, 'FUNDED', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 2000.00, 2000.00, 0, 1700.00, 200.00, 100.00, 'FUNDED', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 8000.00, 8000.00, 8000.00, 6800.00, 800.00, 400.00, 'RELEASED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 5) DISPUTES
-- =============================================================================
INSERT INTO disputes (
  id, "projectId", "milestoneId", "raisedById", "raiserRole", "defendantId", "defendantRole", 
  "disputeType", category, priority, "disputedAmount", reason, status, result,
  "responseDeadline", "resolutionDeadline", "assignedStaffId", "createdAt", "updatedAt",
  "evidence"
)
VALUES 
  ('d1111111-1111-1111-1111-111111111111', 
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   '11111111-1111-1111-1111-111111111111', 'CLIENT',
   '22222222-2222-2222-2222-222222222222', 'FREELANCER',
   'CLIENT_VS_FREELANCER', 'QUALITY', 'MEDIUM', 1000.00,
   '[TEST] The delivered design does not match the approved wireframes.',
   'OPEN', 'PENDING',
   NOW() + INTERVAL '7 days', NOW() + INTERVAL '14 days',
   '44444444-4444-4444-4444-444444444444',
   NOW(), NOW(),
   '["https://supa-bucket.com/disputes/d1111111-1111-1111-1111-111111111111/evidence1.png"]'::jsonb
   ),
   ('d2222222-2222-2222-2222-222222222222', 
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'dddddddd-dddd-dddd-dddd-dddddddddddd',
   '22222222-2222-2222-2222-222222222222', 'FREELANCER',
   '11111111-1111-1111-1111-111111111111', 'CLIENT',
   'FREELANCER_VS_CLIENT', 'PAYMENT', 'HIGH', 2000.00,
   '[TEST] Client refuses to approve milestone despite requirements met.',
   'IN_MEDIATION', 'PENDING',
   NOW() + INTERVAL '5 days', NOW() + INTERVAL '10 days',
   '44444444-4444-4444-4444-444444444444',
   NOW() - INTERVAL '3 days', NOW(),
   '[]'::jsonb),
   ('d3333333-3333-3333-3333-333333333333', 
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'ffffffff-ffff-ffff-ffff-ffffffffffff',
   '11111111-1111-1111-1111-111111111111', 'CLIENT',
   '22222222-2222-2222-2222-222222222222', 'FREELANCER',
   'CLIENT_VS_FREELANCER', 'DEADLINE', 'LOW', 500.00,
   '[TEST] Project was delivered late.',
   'RESOLVED', 'WIN_CLIENT',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days',
   '44444444-4444-4444-4444-444444444444',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day',
   '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6) DISPUTE EVIDENCES 
-- =============================================================================
INSERT INTO dispute_evidences (id, "disputeId", "uploaderId", "uploaderRole", "storagePath", "fileName", "fileSize", "mimeType", description, "uploadedAt")
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'CLIENT',
   'disputes/d1111111-1111-1111-1111-111111111111/screenshot-diff.png', 'screenshot-diff.png', 102400, 'image/png', 
   'Comparison between Figma design and delivered site', NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7) DISPUTE MESSAGES 
-- =============================================================================
INSERT INTO dispute_messages (id, "disputeId", "senderId", "senderRole", type, content, "createdAt")
VALUES 
  ('ac000000-0000-0000-0000-000000000001', 'd1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'CLIENT', 'TEXT', 'I have attached screenshots showing the differences.', NOW()),
  ('ac000000-0000-0000-0000-000000000002', 'd1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'FREELANCER', 'TEXT', 'The wireframes were updated after initial approval.', NOW() + INTERVAL '1 hour'),
  ('ac000000-0000-0000-0000-000000000003', 'd1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'STAFF', 'SYSTEM_LOG', 'Staff has been assigned to review this dispute.', NOW() + INTERVAL '2 hours'),
  ('ac000000-0000-0000-0000-000000000004', 'd2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'FREELANCER', 'TEXT', 'All deliverables have been submitted.', NOW() - INTERVAL '2 days'),
  ('ac000000-0000-0000-0000-000000000005', 'd2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'CLIENT', 'TEXT', 'The code quality is not up to standard.', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 8) DISPUTE SETTLEMENTS 
-- =============================================================================
INSERT INTO dispute_settlements (id, "disputeId", "proposerId", "proposerRole", "amountToFreelancer", "amountToClient", "platformFee", terms, status, "expiresAt", "createdAt", "updatedAt")
VALUES 
  ('5e000000-0000-0000-0000-000000000001', 'd2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'FREELANCER',
   1600.00, 400.00, 100.00, 
   'I propose a 80/20 split.',
   'PENDING', NOW() + INTERVAL '48 hours', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9) CALENDAR EVENTS 
-- =============================================================================
INSERT INTO calendar_events (id, "organizerId", type, title, description, priority, "startTime", "endTime", "durationMinutes", status, "createdAt", "updatedAt")
VALUES 
  ('e1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'DISPUTE_HEARING', 
   '[TEST] Hearing: Design Quality Dispute', 'Hearing for dispute d1111111', 'HIGH',
   NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '2 hours', 120,
   'SCHEDULED', NOW(), NOW()),
  ('e2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'INTERNAL_MEETING', 
   '[TEST] Weekly Staff Sync', 'Weekly team meeting', 'MEDIUM',
   NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '1 hour', 60,
   'SCHEDULED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 10) EVENT PARTICIPANTS
-- =============================================================================
INSERT INTO event_participants (id, "eventId", "userId", role, status, "createdAt")
VALUES 
  ('ba000000-0000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'MODERATOR', 'ACCEPTED', NOW()),
  ('ba000000-0000-0000-0000-000000000002', 'e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'REQUIRED', 'PENDING', NOW()),
  ('ba000000-0000-0000-0000-000000000003', 'e1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'REQUIRED', 'PENDING', NOW()),
  ('ba000000-0000-0000-0000-000000000004', 'e2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'ORGANIZER', 'ACCEPTED', NOW()),
  ('ba000000-0000-0000-0000-000000000005', 'e2222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'REQUIRED', 'ACCEPTED', NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 11) USER AVAILABILITY (Fix: user_availabilities + recurring logic)
-- =============================================================================
INSERT INTO user_availabilities (id, "userId", type, "recurringStartTime", "recurringEndTime", "isRecurring", "dayOfWeek", note, "createdAt", "updatedAt")
VALUES 
  ('aa000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'AVAILABLE', '09:00:00', '17:00:00', true, 1, 'Monday work hours', NOW(), NOW()),
  ('aa000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'AVAILABLE', '09:00:00', '17:00:00', true, 2, 'Tuesday work hours', NOW(), NOW()),
  ('aa000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'AVAILABLE', '09:00:00', '17:00:00', true, 3, 'Wednesday work hours', NOW(), NOW()),
  ('aa000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'AVAILABLE', '09:00:00', '17:00:00', true, 4, 'Thursday work hours', NOW(), NOW()),
  ('aa000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'AVAILABLE', '09:00:00', '17:00:00', true, 5, 'Friday work hours', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
