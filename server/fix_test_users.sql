-- ==================================================================================
-- SCRIPT: fix_test_users.sql
-- MỤC ĐÍCH: 
-- 1. Sửa mật khẩu thành 'password123'
-- 2. Kích hoạt trạng thái Verified (isVerified = true) cho các account test.
-- ==================================================================================

UPDATE "users"
SET 
    "passwordHash" = '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW',
    "isVerified" = true
WHERE "email" IN (
    'staff.test.new@example.com',
    'client.test.new@example.com',
    'freelancer.test.new@example.com',
    'broker.test.new@example.com'
);

-- Kiểm tra lại kết quả sau khi update
SELECT "email", "role", "isVerified", "updatedAt"
FROM "users" 
WHERE "email" IN (
    'staff.test.new@example.com',
    'client.test.new@example.com',
    'freelancer.test.new@example.com',
    'broker.test.new@example.com'
);
