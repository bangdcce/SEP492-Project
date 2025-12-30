
-- Seed data for Wizard Questions (B1, B2, B4)
-- Cleans up potential duplicates if rerunning (optional logic, but basic insert here)

-- 1. Product Type
INSERT INTO wizard_questions (id, code, label, help_text, input_type, sort_order) 
VALUES 
(gen_random_uuid(), 'PRODUCT_TYPE', 'Chọn loại sản phẩm', 'Sản phẩm bạn muốn xây dựng là gì?', 'SELECT', 1)
ON CONFLICT (code) DO NOTHING;

-- 2. Industry
INSERT INTO wizard_questions (id, code, label, help_text, input_type, sort_order) 
VALUES 
(gen_random_uuid(), 'INDUSTRY', 'Chọn lĩnh vực kinh doanh', 'Ngành nghề kinh doanh chính của bạn?', 'SELECT', 2)
ON CONFLICT (code) DO NOTHING;

-- 3. Features
INSERT INTO wizard_questions (id, code, label, help_text, input_type, sort_order) 
VALUES 
(gen_random_uuid(), 'FEATURES', 'Chọn chức năng mong muốn', 'Các tính năng chính cần có trong sản phẩm', 'CHECKBOX', 4)
ON CONFLICT (code) DO NOTHING;


-- ================= OPTIONS =================

-- Options for PRODUCT_TYPE
INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'LANDING_PAGE', 'Landing Page (Trang đơn giới thiệu)', 1 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'CORP_WEBSITE', 'Website Doanh nghiệp (Giới thiệu công ty)', 2 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'ECOMMERCE', 'Website Bán hàng (E-commerce)', 3 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'MOBILE_APP', 'Ứng dụng di động (Mobile App)', 4 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'WEB_APP', 'Web App / SaaS Platform', 5 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'SYSTEM', 'Hệ thống quản lý nội bộ (ERP/CRM/HRM)', 6 
FROM wizard_questions WHERE code = 'PRODUCT_TYPE';


-- Options for INDUSTRY
INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'FNB', 'F&B (Nhà hàng, Quán Cafe, Trà sữa)', 1 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'FASHION', 'Thời trang & Phụ kiện', 2 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'RETAIL', 'Bán lẻ & Siêu thị mini', 3 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'REAL_ESTATE', 'Bất động sản & Nội thất', 4 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'EDUCATION', 'Giáo dục & Đào tạo', 5 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'HEALTHCARE', 'Y tế & Sức khỏe (Spa, Clinic)', 6 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'LOGISTICS', 'Vận tải & Logistics', 7 
FROM wizard_questions WHERE code = 'INDUSTRY';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'SERVICE', 'Dịch vụ khác (Du lịch, Tư vấn...)', 99 
FROM wizard_questions WHERE code = 'INDUSTRY';


-- Options for FEATURES
INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'AUTH', 'Đăng nhập / Đăng ký (Email, Social)', 1 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'PRODUCT_CATALOG', 'Danh mục sản phẩm & Tìm kiếm', 2 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'CART_PAYMENT', 'Giỏ hàng & Thanh toán Online', 3 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'BOOKING', 'Đặt lịch hẹn / Booking', 4 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'CHAT', 'Chat trực tiếp (Live Chat)', 5 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'MAPS', 'Bản đồ & Định vị (Maps)', 6 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'BLOG_News', 'Tin tức & Blog', 7 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'ADMIN_DASHBOARD', 'Trang quản trị (Admin Dashboard)', 8 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'REPORTING', 'Báo cáo & Thống kê doanh thu', 9 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'NOTIFICATIONS', 'Thông báo (Push Notification/Email)', 10 
FROM wizard_questions WHERE code = 'FEATURES';

INSERT INTO wizard_options (id, question_id, value, label, sort_order)
SELECT gen_random_uuid(), id, 'MULTI_LANG', 'Đa ngôn ngữ (Anh/Việt...)', 11 
FROM wizard_questions WHERE code = 'FEATURES';
