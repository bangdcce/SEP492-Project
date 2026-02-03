-- =========================================================
-- COMPREHENSIVE SEED DATA FOR TEST ACCOUNTS
-- Test accounts: Staff, Client, Freelancer, Broker
-- Creates: Profiles, Wallets, ProjectRequests, Projects, Milestones, Tasks
-- =========================================================

-- User IDs Reference:
-- Staff:      d8ec8fbf-a407-4799-8618-60f02c085fc1
-- Client:     af0fd4f6-e9b9-4744-9f8f-b40d264b92c5
-- Freelancer: 12ebc462-d122-4a3a-914a-1a7f08064090
-- Broker:     261430db-300b-4481-b0c4-dc032c656057

-- ==========================================
-- 1. PROFILES
-- ==========================================
INSERT INTO "profiles" ("id", "userId", "bio", "skills", "companyName", "portfolioLinks", "bankInfo") VALUES
-- Client Profile
(
    'de1e3d80-0f24-4453-ac52-db6e852a0f7e',
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    'Business owner looking for reliable tech solutions',
    ARRAY['Business Analysis', 'Product Management'],
    'TechVision Solutions Co., Ltd.',
    NULL,
    '{"bank": "Vietcombank", "account": "1234567890123"}'
),
-- Freelancer Profile
(
    'd0216bdc-e688-47f3-a004-94dd13ec3047',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    'Full-stack developer with 5+ years experience in React, Node.js, and cloud technologies. Specialized in building scalable web applications.',
    ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'Docker'],
    NULL,
    '[{"title": "GitHub", "url": "https://github.com/freelancer-test"}, {"title": "Portfolio", "url": "https://portfolio.example.com"}]',
    '{"bank": "Techcombank", "account": "9876543210987"}'
),
-- Broker Profile
(
    'c7328c06-1221-4da4-addf-63d9f148a640',
    '261430db-300b-4481-b0c4-dc032c656057',
    'Tech project broker with extensive network of developers and clients. 3+ years experience matching the right talent with projects.',
    ARRAY['Project Management', 'Negotiation', 'Technical Consulting'],
    NULL,
    NULL,
    NULL
)
ON CONFLICT ("userId") DO NOTHING;

-- ==========================================
-- 2. WALLETS
-- ==========================================
INSERT INTO "wallets" ("id", "userId", "balance", "currency", "createdAt") VALUES
-- Client Wallet
(
    '07ede4b8-980f-4e26-bcc6-9d14f7ad34cf',
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    100000000, -- 100 million VND
    'USD',
    NOW() - INTERVAL '30 days'
),
-- Freelancer Wallet
(
    '61a7244f-7f80-4f91-a839-e3711b2400c5',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    50000000, -- 50 million VND
    'USD',
    NOW() - INTERVAL '25 days'
)
ON CONFLICT ("userId") DO NOTHING;

-- ==========================================
-- 3. PROJECT REQUESTS (4 requests with various statuses)
-- ==========================================

-- 3.1 DRAFT: E-commerce Platform Upgrade
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "createdAt"
) VALUES (
    '26b6c134-5c6f-4652-a39d-0611865c624c',
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    'E-commerce Platform Upgrade',
    'We need to upgrade our existing e-commerce platform with new features including: Advanced search with filters, AI-powered product recommendations, Mobile-responsive checkout flow, Integration with multiple payment gateways (VNPay, Momo, ZaloPay).',
    '50M_100M',
    '2026-05-01',
    'React, Node.js, PostgreSQL, Redis',
    'DRAFT',
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;

-- 3.2 PENDING: CRM System Development
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "createdAt"
) VALUES (
    'c997a0d9-1437-42ba-be09-daf8d03f6217',
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    'CRM System Development',
    'Build a comprehensive CRM system for our sales team. Features needed: Customer database with search, Sales pipeline management, Email integration, Reporting dashboard, Mobile app for field sales.',
    'ABOVE_100M',
    '2026-07-01',
    'NestJS, React, PostgreSQL, React Native',
    'PENDING',
    NOW() - INTERVAL '5 days'
)
ON CONFLICT (id) DO NOTHING;

-- 3.3 PROCESSING: Mobile App Development (Broker assigned)
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "brokerId", "createdAt"
) VALUES (
    '2fe6ff41-b866-4e83-9163-d5698d66c977',
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    'Food Delivery Mobile App',
    'Develop a food delivery app similar to GrabFood. Includes: Customer app (iOS/Android), Restaurant partner portal, Driver app, Admin dashboard, Real-time order tracking.',
    'ABOVE_100M',
    '2026-09-01',
    'Flutter, Firebase, Node.js, MongoDB',
    'PROCESSING',
    '261430db-300b-4481-b0c4-dc032c656057',
    NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO NOTHING;

-- 3.4 APPROVED: API Integration Project (Ready for project)
INSERT INTO "project_requests" (
    "id", "clientId", "title", "description", "budgetRange", "intendedTimeline", "techPreferences", "status", "brokerId", "createdAt"
) VALUES (
    '1e8af65f-84e4-4bec-b32e-1cb70024db6f',
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    'Third-party API Integration Suite',
    'Integrate multiple third-party APIs into our existing system: Payment gateways, Shipping providers (GHN, GHTK, J&T), SMS/Email services, Social login (Google, Facebook), Analytics tracking.',
    '30M_50M',
    '2026-04-01',
    'Node.js, TypeScript, REST APIs',
    'APPROVED',
    '261430db-300b-4481-b0c4-dc032c656057',
    NOW() - INTERVAL '15 days'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 4. PROJECTS (3 projects with various statuses)
-- ==========================================

-- 4.1 IN_PROGRESS: Company Website Redesign
INSERT INTO "projects" (
    "id", "requestId", "clientId", "brokerId", "freelancerId", "title", "description",
    "totalBudget", "currency", "pricingModel", "startDate", "endDate", "status", "createdAt", "updatedAt"
) VALUES (
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    NULL,
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    '261430db-300b-4481-b0c4-dc032c656057',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    'Company Website Redesign',
    'Complete redesign of company website with modern UI/UX, responsive design, SEO optimization, and CMS integration.',
    45000000,
    'USD',
    'FIXED_PRICE',
    NOW() - INTERVAL '20 days',
    NOW() + INTERVAL '40 days',
    'IN_PROGRESS',
    NOW() - INTERVAL '20 days',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 4.2 PLANNING: Inventory Management System
INSERT INTO "projects" (
    "id", "requestId", "clientId", "brokerId", "freelancerId", "title", "description",
    "totalBudget", "currency", "pricingModel", "startDate", "endDate", "status", "createdAt", "updatedAt"
) VALUES (
    'e4a05226-c11a-4033-9a75-64da74c88764',
    NULL,
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    '261430db-300b-4481-b0c4-dc032c656057',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    'Inventory Management System',
    'Build an inventory management system with barcode scanning, stock alerts, supplier management, and reporting features.',
    75000000,
    'USD',
    'FIXED_PRICE',
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '90 days',
    'PLANNING',
    NOW() - INTERVAL '5 days',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 4.3 COMPLETED: Mobile App Phase 1
INSERT INTO "projects" (
    "id", "requestId", "clientId", "brokerId", "freelancerId", "title", "description",
    "totalBudget", "currency", "pricingModel", "startDate", "endDate", "status", "createdAt", "updatedAt"
) VALUES (
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    NULL,
    'af0fd4f6-e9b9-4744-9f8f-b40d264b92c5',
    '261430db-300b-4481-b0c4-dc032c656057',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    'Mobile App Phase 1 (Authentication Module)',
    'Develop the authentication module for mobile app including login, registration, social login, password reset, and 2FA.',
    25000000,
    'USD',
    'FIXED_PRICE',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '10 days',
    'COMPLETED',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 5. MILESTONES FOR PROJECT 1 (Company Website Redesign - IN_PROGRESS)
-- ==========================================

-- Milestone 1.1: Design Phase (COMPLETED)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate", 
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    '3aae8de1-efb1-48d9-9c00-6d0e370933bd',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'UI/UX Design & Wireframes',
    'Create complete UI/UX design including wireframes, mockups, and design system.',
    10000000,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '10 days',
    'COMPLETED',
    'DESIGN_PROTOTYPE',
    1,
    NOW() - INTERVAL '20 days',
    '{"criteria": ["All pages wireframed", "High-fidelity mockups approved", "Design system documented", "Mobile responsive designs included"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 1.2: Frontend Development (IN_PROGRESS)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Frontend Development',
    'Develop responsive frontend with React, including all pages and components.',
    15000000,
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '10 days',
    'IN_PROGRESS',
    'SOURCE_CODE',
    2,
    NOW() - INTERVAL '10 days',
    '{"criteria": ["All pages implemented", "Responsive design working", "Cross-browser tested", "Performance optimized"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 1.3: Backend & CMS Integration (PENDING)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    '506c78ad-85db-4a91-aaa4-11ef9072731b',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Backend & CMS Integration',
    'Set up backend APIs and integrate with headless CMS for content management.',
    12000000,
    NOW() + INTERVAL '10 days',
    NOW() + INTERVAL '30 days',
    'PENDING',
    'SOURCE_CODE',
    3,
    NOW() - INTERVAL '20 days',
    '{"criteria": ["API endpoints documented", "CMS integrated", "Content editable by client", "Admin panel functional"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 1.4: Deployment & Documentation (PENDING)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    '6a413c15-7460-4329-95c8-1e75b9867a0c',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Deployment & Documentation',
    'Deploy to production server with CI/CD pipeline and complete project documentation.',
    8000000,
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '40 days',
    'PENDING',
    'DEPLOYMENT',
    4,
    NOW() - INTERVAL '20 days',
    '{"criteria": ["Production deployment complete", "SSL configured", "CI/CD pipeline working", "Documentation delivered"]}'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 6. MILESTONES FOR PROJECT 2 (Inventory Management - PLANNING)
-- ==========================================

-- Milestone 2.1: Requirements & Design
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    '68e519ef-fbb7-4171-ad1c-d5ee02bf2f0d',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Requirements Analysis & System Design',
    'Complete requirements gathering, database design, and system architecture.',
    15000000,
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '20 days',
    'PENDING',
    'API_DOCS',
    1,
    NOW() - INTERVAL '5 days',
    '{"criteria": ["Requirements document approved", "ER diagram complete", "API specification done", "Tech stack confirmed"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 2.2: Core Module Development
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    'ff9b85b2-41c9-4733-ab36-bae4a7642ea1',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Core Module Development',
    'Develop core inventory features: product management, stock tracking, barcode scanning.',
    35000000,
    NOW() + INTERVAL '20 days',
    NOW() + INTERVAL '60 days',
    'PENDING',
    'SOURCE_CODE',
    2,
    NOW() - INTERVAL '5 days',
    '{"criteria": ["Product CRUD working", "Stock tracking functional", "Barcode scanner integrated", "Low stock alerts working"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 2.3: Reports & Deployment
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria"
) VALUES (
    '4dfd1fcc-604e-40a4-898d-6154c27c5891',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Reporting & Final Deployment',
    'Implement reporting dashboard, final testing, and production deployment.',
    25000000,
    NOW() + INTERVAL '60 days',
    NOW() + INTERVAL '90 days',
    'PENDING',
    'DEPLOYMENT',
    3,
    NOW() - INTERVAL '5 days',
    '{"criteria": ["All reports working", "Export to Excel/PDF", "Performance tested", "Production deployed"]}'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 7. MILESTONES FOR PROJECT 3 (Mobile App Phase 1 - COMPLETED)
-- ==========================================

-- Milestone 3.1: Login & Registration (COMPLETED)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria", "proofOfWork", "feedback"
) VALUES (
    '9e48ce4b-9f45-4195-a2d6-2983f2bca05b',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Login & Registration Module',
    'Implement email/password login, registration with email verification.',
    8000000,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '45 days',
    'COMPLETED',
    'SOURCE_CODE',
    1,
    NOW() - INTERVAL '60 days',
    '{"criteria": ["Login working", "Registration with validation", "Email verification sent", "Password strength check"]}',
    'https://github.com/project/auth-module',
    'Excellent work! All requirements met.'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 3.2: Social Login & 2FA (COMPLETED)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria", "proofOfWork", "feedback"
) VALUES (
    '6c8889fb-8420-4cf2-89e5-1d319ba50215',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Social Login & 2FA',
    'Implement Google/Facebook login and two-factor authentication.',
    10000000,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '25 days',
    'COMPLETED',
    'SOURCE_CODE',
    2,
    NOW() - INTERVAL '45 days',
    '{"criteria": ["Google OAuth working", "Facebook OAuth working", "2FA with TOTP", "Backup codes generated"]}',
    'https://github.com/project/social-2fa',
    'Great implementation of social login!'
)
ON CONFLICT (id) DO NOTHING;

-- Milestone 3.3: Password Reset & Documentation (COMPLETED)
INSERT INTO "milestones" (
    "id", "projectId", "title", "description", "amount", "startDate", "dueDate",
    "status", "deliverableType", "sortOrder", "createdAt", "acceptanceCriteria", "proofOfWork", "feedback"
) VALUES (
    'f36a7ac7-550f-4eba-a1ae-f2a0339bbd4c',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Password Reset & API Documentation',
    'Implement forgot password flow and complete API documentation.',
    7000000,
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '10 days',
    'COMPLETED',
    'API_DOCS',
    3,
    NOW() - INTERVAL '25 days',
    '{"criteria": ["Forgot password working", "Password reset email sent", "API docs complete", "Postman collection provided"]}',
    'https://github.com/project/docs',
    'Documentation is very thorough. Well done!'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 8. TASKS FOR PROJECT 1, MILESTONE 1 (Design Phase - COMPLETED)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo", 
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels"
) VALUES
-- Task 1.1.1
(
    '2e818a5e-d11a-4201-bb58-76ce0ef64a61',
    '3aae8de1-efb1-48d9-9c00-6d0e370933bd',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Create wireframes for all pages',
    'Design low-fidelity wireframes for homepage, about, services, contact, and blog pages.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '15 days',
    1,
    NOW() - INTERVAL '20 days',
    'HIGH',
    5,
    'design,wireframe'
),
-- Task 1.1.2
(
    '2063661d-5b18-4a49-8124-3ea5eaf8df7a',
    '3aae8de1-efb1-48d9-9c00-6d0e370933bd',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Create high-fidelity mockups',
    'Design detailed mockups with colors, typography, and images.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '12 days',
    2,
    NOW() - INTERVAL '18 days',
    'HIGH',
    8,
    'design,mockup'
),
-- Task 1.1.3
(
    '84af70e5-c3df-4528-a79e-50719aff3303',
    '3aae8de1-efb1-48d9-9c00-6d0e370933bd',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Create design system documentation',
    'Document colors, typography, spacing, and component library.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '10 days',
    3,
    NOW() - INTERVAL '15 days',
    'MEDIUM',
    3,
    'design,documentation'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 9. TASKS FOR PROJECT 1, MILESTONE 2 (Frontend - IN_PROGRESS)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels"
) VALUES
-- Task 1.2.1
(
    '394b1a87-7f7f-4a0d-a82f-872c9653e6c5',
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Setup React project structure',
    'Initialize React project with Vite, configure ESLint, Prettier, and folder structure.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '8 days',
    1,
    NOW() - INTERVAL '10 days',
    'HIGH',
    2,
    'frontend,setup'
),
-- Task 1.2.2
(
    'be837401-07da-4244-8213-22e05cc84b7c',
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Implement homepage',
    'Build homepage with hero section, features, testimonials, and CTA.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '5 days',
    2,
    NOW() - INTERVAL '9 days',
    'HIGH',
    5,
    'frontend,homepage'
),
-- Task 1.2.3
(
    '7a7e3400-d891-4d5e-8e49-7e6e48ff90f2',
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Implement about and services pages',
    'Create about us page with team section and services page with pricing.',
    'IN_PROGRESS',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '2 days',
    3,
    NOW() - INTERVAL '7 days',
    'MEDIUM',
    5,
    'frontend,pages'
),
-- Task 1.2.4
(
    '50c6c078-3118-4ff6-b71c-c9d78b48e8c8',
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Implement contact form with validation',
    'Build contact page with form validation and submission.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '5 days',
    4,
    NOW() - INTERVAL '7 days',
    'MEDIUM',
    3,
    'frontend,form'
),
-- Task 1.2.5
(
    'aadeda73-fb7b-4d5d-9ccd-6e0de5679c30',
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Implement blog listing and detail pages',
    'Create blog archive page and individual blog post page with comments.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '8 days',
    5,
    NOW() - INTERVAL '7 days',
    'MEDIUM',
    5,
    'frontend,blog'
),
-- Task 1.2.6
(
    '0512b4c3-e7b5-40d7-93ff-f1c1352d634a',
    '0151d02d-7ddd-4827-89b0-620e3af05cb8',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Responsive design testing and fixes',
    'Test all pages on mobile, tablet, and desktop. Fix any responsive issues.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '10 days',
    6,
    NOW() - INTERVAL '7 days',
    'HIGH',
    3,
    'frontend,responsive,testing'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 10. TASKS FOR PROJECT 1, MILESTONE 3 (Backend - PENDING)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels"
) VALUES
-- Task 1.3.1
(
    'c43b713d-38b9-4749-bb76-77bde08e951d',
    '506c78ad-85db-4a91-aaa4-11ef9072731b',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Setup Node.js API project',
    'Initialize NestJS project with database connection and basic structure.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '15 days',
    1,
    NOW() - INTERVAL '20 days',
    'HIGH',
    3,
    'backend,setup'
),
-- Task 1.3.2
(
    'e8b09140-470b-45bc-ad69-ad34fd812802',
    '506c78ad-85db-4a91-aaa4-11ef9072731b',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Implement CMS content APIs',
    'Create endpoints for blog posts, pages, and media management.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '22 days',
    2,
    NOW() - INTERVAL '20 days',
    'HIGH',
    8,
    'backend,api,cms'
),
-- Task 1.3.3
(
    'bb976b12-3f20-40a6-8947-9904f90f520c',
    '506c78ad-85db-4a91-aaa4-11ef9072731b',
    '8d7e2222-6fcc-4073-8562-73f9485b05eb',
    'Integrate with frontend and test',
    'Connect frontend to APIs and perform integration testing.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '28 days',
    3,
    NOW() - INTERVAL '20 days',
    'HIGH',
    5,
    'backend,integration,testing'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 11. TASKS FOR PROJECT 2, MILESTONE 1 (Requirements - PENDING)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels"
) VALUES
-- Task 2.1.1
(
    '5cc887be-e38c-405c-84a3-403ff3f17fe8',
    '68e519ef-fbb7-4171-ad1c-d5ee02bf2f0d',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Gather requirements from client',
    'Conduct requirement gathering sessions and document functional requirements.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '10 days',
    1,
    NOW() - INTERVAL '5 days',
    'URGENT',
    3,
    'requirements,documentation'
),
-- Task 2.1.2
(
    '1e00c932-7fb3-4f13-a101-bc1afa09e578',
    '68e519ef-fbb7-4171-ad1c-d5ee02bf2f0d',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Design database schema',
    'Create ER diagram and define all database tables and relationships.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '15 days',
    2,
    NOW() - INTERVAL '5 days',
    'HIGH',
    5,
    'database,design'
),
-- Task 2.1.3
(
    'd422f442-441b-4c22-a381-3dc94e5d634e',
    '68e519ef-fbb7-4171-ad1c-d5ee02bf2f0d',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Write API specification',
    'Document all API endpoints with OpenAPI/Swagger specification.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '18 days',
    3,
    NOW() - INTERVAL '5 days',
    'MEDIUM',
    5,
    'api,documentation'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 12. TASKS FOR PROJECT 2, MILESTONE 2 (Core Development - PENDING)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels"
) VALUES
-- Task 2.2.1
(
    '39490ef0-9a5f-4233-9aae-7f76810e12bc',
    'ff9b85b2-41c9-4733-ab36-bae4a7642ea1',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Implement product management module',
    'CRUD operations for products with categories and attributes.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '35 days',
    1,
    NOW() - INTERVAL '5 days',
    'HIGH',
    8,
    'backend,product'
),
-- Task 2.2.2
(
    '31484b04-e189-42fc-9974-1018b96d5463',
    'ff9b85b2-41c9-4733-ab36-bae4a7642ea1',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Implement stock tracking system',
    'Track inventory levels, stock movements, and history.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '45 days',
    2,
    NOW() - INTERVAL '5 days',
    'HIGH',
    8,
    'backend,inventory'
),
-- Task 2.2.3
(
    '7fc68443-52f9-4d6e-803e-444234b3e627',
    'ff9b85b2-41c9-4733-ab36-bae4a7642ea1',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Integrate barcode scanner',
    'Implement barcode scanning for mobile devices.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '50 days',
    3,
    NOW() - INTERVAL '5 days',
    'MEDIUM',
    5,
    'mobile,barcode'
),
-- Task 2.2.4
(
    '76429c6a-1cbe-4101-af3a-7e8c2446e5e4',
    'ff9b85b2-41c9-4733-ab36-bae4a7642ea1',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Implement low stock alerts',
    'Create notification system for low stock thresholds.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '55 days',
    4,
    NOW() - INTERVAL '5 days',
    'MEDIUM',
    3,
    'backend,alerts'
),
-- Task 2.2.5
(
    '9fe2e17e-48d5-4e93-be8b-6b419a2a686e',
    'ff9b85b2-41c9-4733-ab36-bae4a7642ea1',
    'e4a05226-c11a-4033-9a75-64da74c88764',
    'Build admin dashboard UI',
    'Create admin interface for managing inventory.',
    'TODO',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() + INTERVAL '58 days',
    5,
    NOW() - INTERVAL '5 days',
    'MEDIUM',
    8,
    'frontend,admin'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 13. TASKS FOR PROJECT 3, MILESTONE 1 (Login - COMPLETED)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels", "submitted_at"
) VALUES
-- Task 3.1.1
(
    'a5153153-e5a6-441e-bcb5-89272f22cff9',
    '9e48ce4b-9f45-4195-a2d6-2983f2bca05b',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Create login UI',
    'Design and implement login screen with form validation.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '50 days',
    1,
    NOW() - INTERVAL '60 days',
    'HIGH',
    3,
    'mobile,ui,auth',
    NOW() - INTERVAL '52 days'
),
-- Task 3.1.2
(
    'd55f65d1-f0a5-4f76-b595-c18e971343d1',
    '9e48ce4b-9f45-4195-a2d6-2983f2bca05b',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Implement login API integration',
    'Connect login form to authentication API.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '48 days',
    2,
    NOW() - INTERVAL '55 days',
    'HIGH',
    5,
    'mobile,api,auth',
    NOW() - INTERVAL '49 days'
),
-- Task 3.1.3
(
    'b5cab86d-c761-42ad-bbd6-671b9efbd6e9',
    '9e48ce4b-9f45-4195-a2d6-2983f2bca05b',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Create registration flow',
    'Registration form with email verification.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '45 days',
    3,
    NOW() - INTERVAL '52 days',
    'HIGH',
    5,
    'mobile,auth,registration',
    NOW() - INTERVAL '46 days'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 14. TASKS FOR PROJECT 3, MILESTONE 2 (Social Login - COMPLETED)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels", "submitted_at"
) VALUES
-- Task 3.2.1
(
    '2e707d04-59f0-48c9-afa1-1deafdd1e881',
    '6c8889fb-8420-4cf2-89e5-1d319ba50215',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Implement Google OAuth',
    'Add Google sign-in button and OAuth flow.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '35 days',
    1,
    NOW() - INTERVAL '45 days',
    'HIGH',
    5,
    'mobile,oauth,google',
    NOW() - INTERVAL '37 days'
),
-- Task 3.2.2
(
    'c3722d39-c3c2-4616-bd6b-ef5366c519db',
    '6c8889fb-8420-4cf2-89e5-1d319ba50215',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Implement Facebook OAuth',
    'Add Facebook login integration.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '30 days',
    2,
    NOW() - INTERVAL '40 days',
    'HIGH',
    5,
    'mobile,oauth,facebook',
    NOW() - INTERVAL '32 days'
),
-- Task 3.2.3
(
    '3b9a24bc-bfbf-4a89-a039-de0b02f91ea7',
    '6c8889fb-8420-4cf2-89e5-1d319ba50215',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Implement 2FA with TOTP',
    'Add two-factor authentication using TOTP (Google Authenticator).',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '25 days',
    3,
    NOW() - INTERVAL '35 days',
    'MEDIUM',
    8,
    'mobile,security,2fa',
    NOW() - INTERVAL '27 days'
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 15. TASKS FOR PROJECT 3, MILESTONE 3 (Password Reset - COMPLETED)
-- ==========================================

INSERT INTO "tasks" (
    "id", "milestoneId", "projectId", "title", "description", "status", "assignedTo",
    "dueDate", "sortOrder", "createdAt", "priority", "storyPoints", "labels", "submitted_at"
) VALUES
-- Task 3.3.1
(
    'bc8f238f-e12e-4a44-9a78-ae32fb3c0116',
    'f36a7ac7-550f-4eba-a1ae-f2a0339bbd4c',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Implement forgot password flow',
    'Create forgot password screen with email submission.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '18 days',
    1,
    NOW() - INTERVAL '25 days',
    'HIGH',
    3,
    'mobile,auth,password',
    NOW() - INTERVAL '20 days'
),
-- Task 3.3.2
(
    'fcc184ec-445b-4df5-9e40-1bb84d24d21a',
    'f36a7ac7-550f-4eba-a1ae-f2a0339bbd4c',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Implement password reset screen',
    'Create reset password screen with token validation.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '15 days',
    2,
    NOW() - INTERVAL '22 days',
    'HIGH',
    3,
    'mobile,auth,password',
    NOW() - INTERVAL '16 days'
),
-- Task 3.3.3
(
    '53a1bc30-81ce-49a4-9a8f-6369391b76cc',
    'f36a7ac7-550f-4eba-a1ae-f2a0339bbd4c',
    '940889f9-7402-4c68-90c6-d36f3c2dcc33',
    'Write API documentation',
    'Complete Swagger/OpenAPI documentation for all auth endpoints.',
    'DONE',
    '12ebc462-d122-4a3a-914a-1a7f08064090',
    NOW() - INTERVAL '10 days',
    3,
    NOW() - INTERVAL '18 days',
    'MEDIUM',
    5,
    'documentation,api',
    NOW() - INTERVAL '11 days'
)
ON CONFLICT (id) DO NOTHING;
