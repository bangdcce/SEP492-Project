
-- Seed data for Wizard Questions (B1, B2, B4)
-- Cleans up potential duplicates if rerunning (optional logic, but basic insert here)

-- 1. Product Type
INSERT INTO wizard_questions (id, code, label, help_text, input_type, sort_order) 
VALUES 
(gen_random_uuid(), 'PRODUCT_TYPE', 'Select Product Type', 'What type of product do you want to build?', 'SELECT', 1)
ON CONFLICT (code) DO UPDATE SET 
label = EXCLUDED.label, 
help_text = EXCLUDED.help_text,
input_type = EXCLUDED.input_type;

-- 2. Industry
INSERT INTO wizard_questions (id, code, label, help_text, input_type, sort_order) 
VALUES 
(gen_random_uuid(), 'INDUSTRY', 'Select Industry', 'What is your primary business industry?', 'SELECT', 2)
ON CONFLICT (code) DO UPDATE SET 
label = EXCLUDED.label, 
help_text = EXCLUDED.help_text,
input_type = EXCLUDED.input_type;

-- 3. Features
INSERT INTO wizard_questions (id, code, label, help_text, input_type, sort_order) 
VALUES 
(gen_random_uuid(), 'FEATURES', 'Select Desired Features', 'Key features needed in your product', 'CHECKBOX', 4)
ON CONFLICT (code) DO UPDATE SET 
label = EXCLUDED.label, 
help_text = EXCLUDED.help_text,
input_type = EXCLUDED.input_type;


-- ================= OPTIONS =================
-- For updates, we delete old options for these questions and re-insert to ensure clean state and correct labels
DELETE FROM wizard_options WHERE question_id IN (SELECT id FROM wizard_questions WHERE code IN ('PRODUCT_TYPE', 'INDUSTRY', 'FEATURES'));


-- Options for PRODUCT_TYPE
INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'LANDING_PAGE', 'Landing Page (One-page Intro)', 1 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'CORP_WEBSITE', 'Corporate Website', 2 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'ECOMMERCE', 'E-commerce Website', 3 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'MOBILE_APP', 'Mobile App (iOS/Android)', 4 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'WEB_APP', 'Web App / SaaS Platform', 5 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'SYSTEM', 'Internal Management System (ERP/CRM/HRM)', 6 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';


-- Options for INDUSTRY
INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'FNB', 'F&B (Restaurant, Cafe, Tea)', 1 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'FASHION', 'Fashion & Accessories', 2 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'RETAIL', 'Retail & Mini Mart', 3 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'REAL_ESTATE', 'Real Estate & Interior', 4 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'EDUCATION', 'Education & Training', 5 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'HEALTHCARE', 'Healthcare & Beauty (Spa, Clinic)', 6 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'LOGISTICS', 'Logistics & Transportation', 7 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'SERVICE', 'Other Services (Tourism, Consulting...)', 99 
FROM wizard_questions WHERE code = 'INDUSTRY';


-- Options for FEATURES
INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'AUTH', 'Auth (Login/Register/Social)', 1 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'PRODUCT_CATALOG', 'Product Catalog & Search', 2 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'CART_PAYMENT', 'Cart & Online Payment', 3 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'BOOKING', 'Booking / Scheduling', 4 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'CHAT', 'Live Chat', 5 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'MAPS', 'Maps & Location', 6 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'BLOG_News', 'Blog & News', 7 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'ADMIN_DASHBOARD', 'Admin Dashboard', 8 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'REPORTING', 'Reporting & Analytics', 9 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'NOTIFICATIONS', 'Notifications (Push/Email)', 10 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'MULTI_LANG', 'Multi-language', 11 
FROM wizard_questions WHERE code = 'FEATURES';
