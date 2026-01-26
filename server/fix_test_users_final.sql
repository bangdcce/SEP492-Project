-- ==================================================================================
-- SCRIPT: fix_test_users_final.sql
-- MỤC ĐÍCH: 
-- 1. Sửa mật khẩu
-- 2. Force Verify bằng CẢ HAI cột: 'isVerified' và 'emailVerifiedAt'
-- ==================================================================================

UPDATE "users"
SET 
    "passwordHash" = '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW',
    "isVerified" = true,
    "emailVerifiedAt" = NOW() -- Quan trọng: Cần set thời gian verify
WHERE "email" IN (
    'staff.test.new@example.com',
    'client.test.new@example.com',
    'freelancer.test.new@example.com',
    'broker.test.new@example.com'
);

-- Kiểm tra kết quả
SELECT "email", "isVerified", "emailVerifiedAt"
FROM "users" 
WHERE "email" IN (
    'staff.test.new@example.com',
    'client.test.new@example.com',
    'freelancer.test.new@example.com',
    'broker.test.new@example.com'
);
