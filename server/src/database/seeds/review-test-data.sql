-- ================================================================
-- SEED DATA FOR TESTING REVIEW MODERATION
-- Run this SQL after your tables are created
-- ================================================================

-- 1. INSERT TEST USERS (Admin, Client, Freelancer, Broker)
-- Note: Adjust password hash if needed (this is a bcrypt hash of 'password123')
INSERT INTO users (id, email, "passwordHash", "fullName", role, "isVerified", "currentTrustScore", "totalProjectsFinished")
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin@interdev.test', '$2b$10$JQZfSdDqlj9RQjDvhQ8q6e7Zl8x2y1v0u2t3r4q5p6o7n8m9k0j1l2i', 'Admin User', 'ADMIN', true, 5.0, 10),
  ('22222222-2222-2222-2222-222222222222', 'client@interdev.test', '$2b$10$JQZfSdDqlj9RQjDvhQ8q6e7Zl8x2y1v0u2t3r4q5p6o7n8m9k0j1l2i', 'Nguyễn Văn Client', 'CLIENT', true, 4.5, 5),
  ('33333333-3333-3333-3333-333333333333', 'freelancer@interdev.test', '$2b$10$JQZfSdDqlj9RQjDvhQ8q6e7Zl8x2y1v0u2t3r4q5p6o7n8m9k0j1l2i', 'Trần Thị Freelancer', 'FREELANCER', true, 4.8, 15),
  ('44444444-4444-4444-4444-444444444444', 'broker@interdev.test', '$2b$10$JQZfSdDqlj9RQjDvhQ8q6e7Zl8x2y1v0u2t3r4q5p6o7n8m9k0j1l2i', 'Lê Văn Broker', 'BROKER', true, 4.2, 8)
ON CONFLICT (id) DO NOTHING;

-- 2. INSERT PROFILES FOR USERS
INSERT INTO profiles (id, "userId", "avatarUrl", bio, location)
VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'https://api.dicebear.com/7.x/avataaars/svg?seed=client', 'Business Owner looking for developers', 'Ho Chi Minh City'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'https://api.dicebear.com/7.x/avataaars/svg?seed=freelancer', 'Full-stack Developer with 5 years experience', 'Ha Noi'),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'https://api.dicebear.com/7.x/avataaars/svg?seed=broker', 'Project Manager connecting businesses with talent', 'Da Nang')
ON CONFLICT DO NOTHING;

-- 3. INSERT TEST PROJECTS (Status = COMPLETED để có thể review)
INSERT INTO projects (id, "clientId", "brokerId", "freelancerId", title, description, "totalBudget", status, "createdAt")
VALUES 
  ('aaaa1111-aaaa-1111-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 
   'Website E-commerce Bán Hàng', 'Xây dựng website bán hàng online với đầy đủ tính năng giỏ hàng, thanh toán', 50000000, 'COMPLETED', NOW() - INTERVAL '30 days'),
  
  ('aaaa2222-aaaa-2222-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 
   'Landing Page Marketing Campaign', 'Thiết kế landing page cho chiến dịch quảng cáo sản phẩm mới', 15000000, 'COMPLETED', NOW() - INTERVAL '15 days'),
  
  ('aaaa3333-aaaa-3333-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 
   'Mobile App MVP', 'Phát triển MVP cho ứng dụng di động đặt đồ ăn', 80000000, 'COMPLETED', NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;

-- 4. INSERT TEST REVIEWS (Active, chưa bị xóa)
INSERT INTO reviews (id, "projectId", "reviewerId", "targetUserId", rating, comment, weight, "createdAt", "updatedAt")
VALUES 
  -- Client review Freelancer (Positive)
  ('rrrr1111-rrrr-1111-rrrr-rrrrrrrrrrrr', 'aaaa1111-aaaa-1111-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 
   5, 'Freelancer rất giỏi, hoàn thành dự án đúng deadline và chất lượng cao. Highly recommended!', 2.0, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  
  -- Client review Broker (Positive)
  ('rrrr2222-rrrr-2222-rrrr-rrrrrrrrrrrr', 'aaaa1111-aaaa-1111-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 
   4, 'Broker hỗ trợ tốt, giúp kết nối với freelancer phù hợp. Tuy nhiên communication đôi khi chậm.', 2.0, NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
  
  -- Freelancer review Client (Positive)
  ('rrrr3333-rrrr-3333-rrrr-rrrrrrrrrrrr', 'aaaa1111-aaaa-1111-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 
   5, 'Client rõ ràng về requirements, thanh toán đúng hạn. Rất vui khi được làm việc cùng!', 2.0, NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),
  
  -- Freelancer review Broker (Mixed)
  ('rrrr4444-rrrr-4444-rrrr-rrrrrrrrrrrr', 'aaaa2222-aaaa-2222-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 
   3, 'Broker okay, nhưng scope dự án thay đổi nhiều lần gây khó khăn trong việc estimate thời gian.', 1.5, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  
  -- Client review Freelancer (Negative - potential report target)
  ('rrrr5555-rrrr-5555-rrrr-rrrrrrrrrrrr', 'aaaa3333-aaaa-3333-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 
   2, 'Dự án này giao trễ 2 tuần so với deadline ban đầu, code quality không đạt yêu cầu. Phải rework nhiều lần.', 2.0, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  
  -- Broker review Client (Neutral)
  ('rrrr6666-rrrr-6666-rrrr-rrrrrrrrrrrr', 'aaaa3333-aaaa-3333-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 
   4, 'Client hợp tác tốt, requirements rõ ràng. Budget hợp lý cho scope công việc.', 2.0, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- 5. INSERT A SOFT-DELETED REVIEW (để test restore function)
INSERT INTO reviews (id, "projectId", "reviewerId", "targetUserId", rating, comment, weight, "createdAt", "updatedAt", "deleted_at", "deleted_by", "delete_reason")
VALUES 
  ('rrrr7777-rrrr-7777-rrrr-rrrrrrrrrrrr', 'aaaa2222-aaaa-2222-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 
   1, 'Review này bị xóa do vi phạm quy định - chứa ngôn từ không phù hợp (đã được admin xử lý)', 1.5, 
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days', '11111111-1111-1111-1111-111111111111', 'Vi phạm quy định cộng đồng - Ngôn từ không phù hợp')
ON CONFLICT (id) DO NOTHING;

-- 6. INSERT REPORTS (để test flagged reviews)
INSERT INTO reports (id, "reporter_id", "review_id", reason, description, status, "created_at")
VALUES 
  -- Report cho review rrrr5555 (pending - để test dismiss function)
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'rrrr5555-rrrr-5555-rrrr-rrrrrrrrrrrr', 
   'FAKE_REVIEW', 'Review này không chính xác, dự án hoàn thành đúng hạn theo thỏa thuận sửa đổi', 'PENDING', NOW() - INTERVAL '3 days'),
  
  -- Another report for same review (multiple reports)
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'rrrr5555-rrrr-5555-rrrr-rrrrrrrrrrrr', 
   'HARASSMENT', 'Review có tính chất bôi nhọ cá nhân', 'PENDING', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ================================================================
-- VERIFY DATA
-- ================================================================
SELECT 'Users created:' as info, COUNT(*) as count FROM users WHERE email LIKE '%@interdev.test';
SELECT 'Projects created:' as info, COUNT(*) as count FROM projects WHERE id LIKE 'aaaa%';
SELECT 'Reviews created:' as info, COUNT(*) as count FROM reviews WHERE id LIKE 'rrrr%';
SELECT 'Soft-deleted reviews:' as info, COUNT(*) as count FROM reviews WHERE "deleted_at" IS NOT NULL;
SELECT 'Pending reports:' as info, COUNT(*) as count FROM reports WHERE status = 'PENDING';
