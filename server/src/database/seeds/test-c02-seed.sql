-- CLEANUP: Delete old test data first (to avoid duplicate email errors)
-- Delete request if exists
DELETE FROM project_requests WHERE title = 'Website Ban Hang';
-- Delete users by email
DELETE FROM users WHERE email IN ('client@test.com', 'broker@test.com');

-- Test Data with Valid v4 UUIDs
-- Client ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- Broker ID: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22
-- Request ID: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33

-- 1. Insert Client
INSERT INTO users (id, email, "fullName", role, "isVerified")
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'client@test.com', 'Test Client', 'CLIENT', true);

-- 2. Insert Broker
INSERT INTO users (id, email, "fullName", role, "isVerified")
VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'broker@test.com', 'Test Broker', 'BROKER', true);

-- 3. Insert Admin (for Audit)
INSERT INTO users (id, email, "fullName", role, "isVerified")
VALUES ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'admin@test.com', 'Test Admin', 'ADMIN', true);

-- 4. Insert Project Request
INSERT INTO project_requests (id, "clientId", title, description, status)
VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Website Ban Hang', 'Can lam website ban quan ao', 'PENDING');
