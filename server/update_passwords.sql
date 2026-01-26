-- ==================================================================================
-- SCRIPT: update_passwords.sql
-- MỤC ĐÍCH: Sửa lại mật khẩu cho các account test đã tạo bị lỗi login.
-- MẬT KHẨU MỚI: password123
-- ==================================================================================

UPDATE "users"
SET "passwordHash" = '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW'
WHERE "email" IN (
    'staff.test.new@example.com',
    'client.test.new@example.com',
    'freelancer.test.new@example.com',
    'broker.test.new@example.com'
);

-- Kiểm tra lại kết quả
SELECT "email", "role", "passwordHash" 
FROM "users" 
WHERE "email" IN (
    'staff.test.new@example.com',
    'client.test.new@example.com',
    'freelancer.test.new@example.com',
    'broker.test.new@example.com'
);
