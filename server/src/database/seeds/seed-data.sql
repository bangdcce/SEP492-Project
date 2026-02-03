-- ============================================
-- SEED DATA FOR INTERDEV PROJECT
-- Run this in Supabase SQL Editor
-- ============================================
-- NOTE: Column names use snake_case (as defined in database)
-- ============================================

-- ==========================================
-- 1. USERS (Sample users for testing)
-- ==========================================
INSERT INTO "users" ("id", "email", "passwordHash", "fullName", "role", "phoneNumber", "isVerified", "currentTrustScore", "createdAt", "updatedAt") VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@interdev.com', '$2b$10$xJwL5vWQQKZQKQKZQKQKZuKZQKQKZQKZQKQKZQKQKZQKQKZQKQKZQ', 'Admin User', 'ADMIN', '0901234567', true, 5.00, NOW() - INTERVAL '30 days', NOW()),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'staff@interdev.com', '$2b$10$xJwL5vWQQKZQKQKZQKQKZuKZQKQKZQKZQKQKZQKQKZQKQKZQKQKZQ', 'Staff Member', 'STAFF', '0902345678', true, 4.50, NOW() - INTERVAL '25 days', NOW()),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 'broker1@interdev.com', '$2b$10$xJwL5vWQQKZQKQKZQKQKZuKZQKQKZQKZQKQKZQKQKZQKQKZQKQKZQ', 'Nguyen Van Broker', 'BROKER', '0903456789', true, 4.80, NOW() - INTERVAL '20 days', NOW()),
('d4e5f6a7-b8c9-0123-defa-234567890123', 'client1@gmail.com', '$2b$10$xJwL5vWQQKZQKQKZQKQKZuKZQKQKZQKZQKQKZQKQKZQKQKZQKQKZQ', 'Tran Thi Client', 'CLIENT', '0904567890', true, 4.20, NOW() - INTERVAL '15 days', NOW()),
('e5f6a7b8-c9d0-1234-efab-345678901234', 'freelancer1@gmail.com', '$2b$10$xJwL5vWQQKZQKQKZQKQKZuKZQKQKZQKZQKQKZQKQKZQKQKZQKQKZQ', 'Le Van Freelancer', 'FREELANCER', '0905678901', true, 4.90, NOW() - INTERVAL '10 days', NOW()),
('f6a7b8c9-d0e1-2345-fabc-456789012345', 'freelancer2@gmail.com', '$2b$10$xJwL5vWQQKZQKQKZQKQKZuKZQKQKZQKZQKQKZQKQKZQKQKZQKQKZQ', 'Pham Thi Dev', 'FREELANCER', '0906789012', false, 3.50, NOW() - INTERVAL '5 days', NOW());

-- ==========================================
-- 2. PROFILES (User profiles)
-- ==========================================
INSERT INTO "profiles" ("id", "userId", "bio", "skills", "companyName", "portfolioLinks", "bankInfo") VALUES
(uuid_generate_v4(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'System Administrator', ARRAY['Administration', 'Security'], 'InterDev Corp', NULL, NULL),
(uuid_generate_v4(), 'e5f6a7b8-c9d0-1234-efab-345678901234', 'Full-stack developer with 5 years experience', ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL'], NULL, '[{"title": "GitHub", "url": "https://github.com/levan"}]', '{"bank": "Vietcombank", "account": "1234567890"}'),
(uuid_generate_v4(), 'f6a7b8c9-d0e1-2345-fabc-456789012345', 'Frontend specialist, UI/UX enthusiast', ARRAY['React', 'Vue.js', 'Figma', 'TailwindCSS'], NULL, '[{"title": "Dribbble", "url": "https://dribbble.com/phamdev"}]', '{"bank": "Techcombank", "account": "0987654321"}');

-- ==========================================
-- 3. PROJECT CATEGORIES
-- ==========================================
INSERT INTO "project_categories" ("id", "name", "slug", "createdAt") VALUES
(uuid_generate_v4(), 'Web Development', 'web-development', NOW()),
(uuid_generate_v4(), 'Mobile App', 'mobile-app', NOW()),
(uuid_generate_v4(), 'UI/UX Design', 'ui-ux-design', NOW()),
(uuid_generate_v4(), 'Data Science', 'data-science', NOW()),
(uuid_generate_v4(), 'DevOps', 'devops', NOW());

-- ==========================================
-- 4. WALLETS (User wallets)
-- ==========================================
INSERT INTO "wallets" ("id", "userId", "balance", "currency", "createdAt") VALUES
(uuid_generate_v4(), 'd4e5f6a7-b8c9-0123-defa-234567890123', 50000000, 'USD', NOW() - INTERVAL '15 days'),
(uuid_generate_v4(), 'e5f6a7b8-c9d0-1234-efab-345678901234', 25000000, 'USD', NOW() - INTERVAL '10 days'),
(uuid_generate_v4(), 'f6a7b8c9-d0e1-2345-fabc-456789012345', 10000000, 'USD', NOW() - INTERVAL '5 days');

-- ==========================================
-- DONE! (Audit logs removed due to FK constraints)
-- ==========================================
-- You now have:
-- ✓ 6 sample users (Admin, Staff, Broker, Client, 2 Freelancers)
-- ✓ 3 user profiles
-- ✓ 5 project categories
-- ✓ 3 wallets
--
-- NOTE: Audit logs will be created automatically when users
-- perform actions in the system (login, create, update, etc.)
-- ==========================================
