BEGIN;

-- 1. Clean up old data
DELETE FROM milestones WHERE "projectSpecId" IN (SELECT id FROM project_specs WHERE "requestId" IN ('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003'));
DELETE FROM project_specs WHERE "requestId" IN ('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003');
DELETE FROM project_requests WHERE id IN ('d1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003');
DELETE FROM users WHERE id IN ('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001');

-- 2. Create Users
INSERT INTO users (id, email, "passwordHash", "fullName", role, "isVerified", "createdAt", "updatedAt")
VALUES 
('b1000000-0000-0000-0000-000000000001', 'an.broker@demo.com', '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW', 'An Broker (Intern)', 'BROKER', true, NOW(), NOW()),
('c1000000-0000-0000-0000-000000000001', 'client.rich@demo.com', '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW', 'Mr. Rich Client', 'CLIENT', true, NOW(), NOW());

-- 3. Create Request 1: PENDING
INSERT INTO project_requests (id, "clientId", title, description, "budgetRange", "intendedTimeline", "techPreferences", status, "createdAt")
VALUES 
('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Xây dựng sàn E-commerce bán giày', 'Cần làm website giống Shopee nhưng chuyên bán giày sneaker limited. Yêu cầu tích hợp thanh toán Momo/VNPay.', '50.000.000 - 100.000.000 VND', '3 tháng', 'ReactJS, NestJS, PostgreSQL', 'PENDING', NOW());

-- 4. Create Request 2: PENDING
INSERT INTO project_requests (id, "clientId", title, description, "budgetRange", "intendedTimeline", "techPreferences", status, "createdAt")
VALUES 
('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'App Booking lịch cắt tóc', 'Ứng dụng đặt lịch cho chuỗi Salon tóc. Có tính năng nhắc lịch qua Zalo.', '20.000.000 VND', '1 tháng', 'Flutter, Firebase', 'PENDING', NOW() - INTERVAL '1 DAY');

-- 5. Create Request 3: PROCESSING
INSERT INTO project_requests (id, "clientId", "brokerId", title, description, "budgetRange", "intendedTimeline", "techPreferences", status, "createdAt")
VALUES 
('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Hệ thống ERP quản lý kho', 'Module quản lý nhập xuất tồn cho công ty Logistics. Yêu cầu độ chính xác cao và chịu tải lớn.', '200.000.000+ VND', '6 tháng', '.NET Core, SQL Server', 'PROCESSING', NOW() - INTERVAL '5 DAY');

COMMIT;
