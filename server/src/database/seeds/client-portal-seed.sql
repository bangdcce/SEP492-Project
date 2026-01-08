-- =========================================================
-- SEED DATA FOR CLIENT PORTAL TESTING
-- Dependencies: Requires users from existing database (matched by ID)
-- FIXED: 
-- 1. Using Quoted "camelCase" column names
-- 2. Using Valid UUIDs
-- 3. REMOVED enum fix (Run fix-enum.sql first!)
-- =========================================================

-- IDs:
-- Client: d4e5f6a7-b8c9-0123-defa-234567890123
-- Broker: c3d4e5f6-a7b8-9012-cdef-123456789012
-- Freelancer 1: e5f6a7b8-c9d0-1234-efab-345678901234
-- Freelancer 2: f6a7b8c9-d0e1-2345-fabc-456789012345

-- 1. Project Requests

-- 1.1 DRAFT: "Kids Clothing E-commerce"
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "createdAt"
) VALUES (
    '10100000-0000-0000-0000-000000000101', 
    'd4e5f6a7-b8c9-0123-defa-234567890123', -- Client
    'Kids Clothing E-commerce Website',
    'We need a colorful and easy-to-use online store for children clothing. Must have cart, payment gateway, and size guide.',
    '30M_50M',
    '2026-03-01',
    'React, Node.js',
    'DRAFT',
    NOW() - INTERVAL '1 day'
);

-- 1.2 PENDING: "Real Estate CRM" (Waiting for Broker)
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "createdAt"
) VALUES (
    '10200000-0000-0000-0000-000000000102',
    'd4e5f6a7-b8c9-0123-defa-234567890123',
    'Real Estate CRM System',
    'Internal CRM for a real estate agency. Need to manage leads, properties, and agent commissions. Dashboard with charts is essential.',
    '50M_100M',
    '2026-06-01',
    'NestJS, PostgreSQL, React Admin',
    'PENDING',
    NOW() - INTERVAL '2 days'
);

-- 1.3 PROCESSING (Spec Review): "Food Delivery App" (Broker assigned)
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "brokerId", "createdAt"
) VALUES (
    '10300000-0000-0000-0000-000000000103',
    'd4e5f6a7-b8c9-0123-defa-234567890123',
    'Fast Food Delivery App',
    'An UberEats-like app for a local fast food chain. Driver app, Customer app, and Restaurant portal.',
    'ABOVE_100M',
    '2026-08-01',
    'Flutter, Firebase, Node.js',
    'PROCESSING', 
    'c3d4e5f6-a7b8-9012-cdef-123456789012', -- Broker
    NOW() - INTERVAL '5 days'
);

-- 1.4 APPROVED (Hiring): "Travel Booking System" (Ready for freelancers)
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "brokerId", "createdAt"
) VALUES (
    '10400000-0000-0000-0000-000000000104',
    'd4e5f6a7-b8c9-0123-defa-234567890123',
    'Luxury Travel Booking Platform',
    'High-end travel booking site for exclusive tours. Integration with Amadeus API required.',
    'ABOVE_100M',
    '2026-12-01',
    'Next.js, Python/Django',
    'APPROVED', 
    'c3d4e5f6-a7b8-9012-cdef-123456789012', -- Broker
    NOW() - INTERVAL '10 days'
);


-- 2. Proposals / Matches (For Request 104 - Hiring)

-- Match for Freelancer 1
INSERT INTO "project_request_proposals" (
    "id", "requestId", "freelancerId", "brokerId", "proposedBudget", "estimatedDuration", "coverLetter", "status", "createdAt"
) VALUES (
    '20100000-0000-0000-0000-000000000201',
    '10400000-0000-0000-0000-000000000104', 
    'e5f6a7b8-c9d0-1234-efab-345678901234', -- Freelancer 1
    'c3d4e5f6-a7b8-9012-cdef-123456789012', 
    120000000,
    '4 months',
    'I have experience with Booking.com clone and Amadeus API integration. Check my portfolio.',
    'PENDING',
    NOW()
);

-- Match for Freelancer 2
INSERT INTO "project_request_proposals" (
    "id", "requestId", "freelancerId", "brokerId", "proposedBudget", "estimatedDuration", "coverLetter", "status", "createdAt"
) VALUES (
    '20200000-0000-0000-0000-000000000202',
    '10400000-0000-0000-0000-000000000104', 
    'f6a7b8c9-d0e1-2345-fabc-456789012345', -- Freelancer 2
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    80000000, 
    '3 months',
    'Great UI designs for travel apps are my specialty. I can handle the frontend.',
    'PENDING',
    NOW()
);

-- 3. Answers for Wizard
-- Using matching UUIDs

INSERT INTO "project_request_answers" ("requestId", "questionId", "valueText")
SELECT '10100000-0000-0000-0000-000000000101', id, 'ECOMMERCE' FROM "wizard_questions" WHERE code = 'PRODUCT_TYPE';

INSERT INTO "project_request_answers" ("requestId", "questionId", "valueText")
SELECT '10100000-0000-0000-0000-000000000101', id, 'FASHION' FROM "wizard_questions" WHERE code = 'INDUSTRY';

INSERT INTO "project_request_answers" ("requestId", "questionId", "valueText")
SELECT '10200000-0000-0000-0000-000000000102', id, 'SYSTEM' FROM "wizard_questions" WHERE code = 'PRODUCT_TYPE';
