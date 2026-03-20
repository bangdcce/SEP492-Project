-- Seed data for Wizard Questions (PRODUCT_TYPE, INDUSTRY, FEATURES)
-- These use ON CONFLICT (code) DO UPDATE to handle reruns safely

-- 1. Product Type
INSERT INTO wizard_questions (code, label, help_text, input_type, sort_order) 
VALUES ('PRODUCT_TYPE', 'Select Product Type', 'What type of product do you want to build?', 'SELECT', 1)
ON CONFLICT (code) DO UPDATE SET 
label = EXCLUDED.label, 
help_text = EXCLUDED.help_text,
input_type = EXCLUDED.input_type;

-- 2. Industry
INSERT INTO wizard_questions (code, label, help_text, input_type, sort_order) 
VALUES ('INDUSTRY', 'Select Industry', 'What is your primary business industry?', 'SELECT', 2)
ON CONFLICT (code) DO UPDATE SET 
label = EXCLUDED.label, 
help_text = EXCLUDED.help_text,
input_type = EXCLUDED.input_type;

-- 3. Features
INSERT INTO wizard_questions (code, label, help_text, input_type, sort_order) 
VALUES ('FEATURES', 'Select Desired Features', 'Key features needed in your product', 'CHECKBOX', 4)
ON CONFLICT (code) DO UPDATE SET 
label = EXCLUDED.label, 
help_text = EXCLUDED.help_text,
input_type = EXCLUDED.input_type;


-- ================= OPTIONS =================
-- Clear old options to ensure clean state with correct labels/sort order
DELETE FROM wizard_options WHERE question_id IN (SELECT id FROM wizard_questions WHERE code IN ('PRODUCT_TYPE', 'INDUSTRY', 'FEATURES'));


-- Options for PRODUCT_TYPE
INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'LANDING_PAGE', 'Landing Page (One-page Intro)', 1 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'CORP_WEBSITE', 'Corporate Website', 2 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'ECOMMERCE', 'E-commerce Website', 3 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'MOBILE_APP', 'Mobile App (iOS/Android)', 4 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'WEB_APP', 'Web App / SaaS Platform', 5 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'SYSTEM', 'Internal Management System (ERP/CRM/HRM)', 6 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'SAAS', 'SaaS Platform (Subscription-based)', 7 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'MARKETPLACE', 'Online Marketplace (Multi-vendor)', 8 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'DESKTOP_APP', 'Desktop Application (Windows/Mac)', 9 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'IOT_DASHBOARD', 'IoT Dashboard / Hardware Integration', 10 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'BROWSER_EXT', 'Browser Extension / Plugin', 11 FROM wizard_questions WHERE code = 'PRODUCT_TYPE';


-- Options for INDUSTRY
INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'FNB', 'F&B (Restaurant, Cafe, Tea)', 1 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'FASHION', 'Fashion & Accessories', 2 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'RETAIL', 'Retail & Mini Mart', 3 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'REAL_ESTATE', 'Real Estate & Interior', 4 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'EDUCATION', 'Education & Training', 5 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'HEALTHCARE', 'Healthcare & Beauty (Spa, Clinic)', 6 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'LOGISTICS', 'Logistics & Transportation', 7 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'FINTECH', 'Finance & Fintech', 8 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'LEGAL', 'Legal & Compliance', 9 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'MANUFACTURING', 'Manufacturing & Engineering', 10 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'TRAVEL', 'Travel & Hospitality', 11 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'AGRICULTURE', 'Agriculture & AgTech', 12 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'ENERGY', 'Energy & Utilities', 13 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'GAMING', 'Gaming & Entertainment', 14 FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'SERVICE', 'Other Services (Tourism, Consulting...)', 99 FROM wizard_questions WHERE code = 'INDUSTRY';


-- Options for FEATURES
INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'AUTH', 'Auth (Login/Register/Social)', 1 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'PRODUCT_CATALOG', 'Product Catalog & Search', 2 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'CART_PAYMENT', 'Cart & Online Payment', 3 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'BOOKING', 'Booking / Scheduling', 4 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'CHAT', 'Live Chat', 5 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'MAPS', 'Maps & Location', 6 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'BLOG_News', 'Blog & News', 7 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'ADMIN_DASHBOARD', 'Admin Dashboard', 8 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'REPORTING', 'Reporting & Analytics', 9 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'NOTIFICATIONS', 'Notifications (Push/Email)', 10 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'MULTI_LANG', 'Multi-language', 11 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'AI_CHATBOT', 'AI Chatbot / LLM Integration', 12 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'BLOCKCHAIN', 'Blockchain / Smart Contracts', 13 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'BIOMETRICS', 'Biometric Auth (FaceID/Fingerprint)', 14 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'SEARCH_ENGINE', 'Advanced Search / ElasticSearch', 15 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'CMS', 'Content Management System (CMS)', 16 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'AV_CALLING', 'Voice / Video Calling', 17 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'RECOMMENDATION', 'AI-driven Recommendation Engine', 18 FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (question_id, value, label, sort_order)
SELECT id, 'STRIPE_SUBSCRIPTION', 'Subscription Management (Stripe/Recurly)', 19 FROM wizard_questions WHERE code = 'FEATURES';
