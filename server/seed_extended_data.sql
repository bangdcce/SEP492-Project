-- ==================================================================================
-- SCRIPT: seed_extended_data.sql
-- VMỤC ĐÍCH: Tạo thêm dữ liệu mẫu phong phú (Projects, Disputes, Evidence)
--          Dùng lại 4 user test đã có: Staff, Client, Freelancer, Broker
-- ==================================================================================

DO $$
DECLARE
    -- Lấy ID của các user đã có (dựa vào email)
    v_staff_id uuid;
    v_client_id uuid;
    v_freelancer_id uuid;
    v_broker_id uuid;
    
    -- UUIDs cho dữ liệu mới
    -- Projects có Dispute
    v_proj_1 uuid := gen_random_uuid();
    v_proj_2 uuid := gen_random_uuid();
    v_proj_3 uuid := gen_random_uuid();
    v_proj_4 uuid := gen_random_uuid();
    v_proj_5 uuid := gen_random_uuid();
    
    -- Projects KHÔNG CÓ Dispute (Mới thêm)
    v_proj_6 uuid := gen_random_uuid();
    v_proj_7 uuid := gen_random_uuid();
    v_proj_8 uuid := gen_random_uuid();
    
    -- Milestones
    v_ms_1 uuid := gen_random_uuid();
    v_ms_2 uuid := gen_random_uuid();
    v_ms_3 uuid := gen_random_uuid();
    v_ms_6 uuid := gen_random_uuid();
    v_ms_7 uuid := gen_random_uuid();
    v_ms_8 uuid := gen_random_uuid();
    
    -- Disputes
    v_disp_1 uuid := gen_random_uuid();
    v_disp_2 uuid := gen_random_uuid();
    v_disp_3 uuid := gen_random_uuid();
    
    v_now timestamp := NOW();

BEGIN
    -- 1. GET EXISTING USER IDs
    SELECT id INTO v_staff_id FROM users WHERE email = 'staff.test.new@example.com';
    SELECT id INTO v_client_id FROM users WHERE email = 'client.test.new@example.com';
    SELECT id INTO v_freelancer_id FROM users WHERE email = 'freelancer.test.new@example.com';
    SELECT id INTO v_broker_id FROM users WHERE email = 'broker.test.new@example.com';

    -- Kiểm tra nếu user chưa tồn tại thì báo lỗi
    IF v_staff_id IS NULL OR v_client_id IS NULL THEN
        RAISE EXCEPTION 'Users not found! Please run seed_staff_test.sql first.';
    END IF;

    RAISE NOTICE 'Found Users - Staff: %, Client: %, Freelancer: %', v_staff_id, v_client_id, v_freelancer_id;

    -- ================================================================
    -- 2. CREATE PROJECTS (8 Projects diverse)
    -- ================================================================
    
    -- Project 1: E-commerce Website (DISPUTED)
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_1, v_client_id, v_freelancer_id, v_broker_id, 'Xây dựng website bán giày Sneaker', 'Cần làm website giống StockX với tính năng đấu giá realtime.', 'DISPUTED', 50000000, 'USD', v_now - INTERVAL '2 months', v_now + INTERVAL '1 month', v_now, v_now);

    -- Project 2: Mobile App Booking (Active - NO DISPUTE)
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_2, v_client_id, v_freelancer_id, v_broker_id, 'App Booking Lịch Cắt Tóc', 'Ứng dụng đặt lịch cho chuỗi sai salon, tích hợp SMS gateway.', 'IN_PROGRESS', 25000000, 'USD', v_now - INTERVAL '10 days', v_now + INTERVAL '20 days', v_now, v_now);

    -- Project 3: AI Model Training (DISPUTED)
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_3, v_client_id, v_freelancer_id, v_broker_id, 'Huấn luyện Model AI nhận diện khuôn mặt', 'Yêu cầu độ chính xác 99% trên tập dữ liệu LFW.', 'DISPUTED', 120000000, 'USD', v_now - INTERVAL '3 months', v_now, v_now, v_now);

    -- Project 4: Blockchain Wallet (Completed - NO DISPUTE)
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_4, v_client_id, v_freelancer_id, v_broker_id, 'Ví điện tử Crypto', 'Ví đa chuỗi hỗ trợ ERC20 và BEP20.', 'COMPLETED', 80000000, 'USD', v_now - INTERVAL '5 months', v_now - INTERVAL '1 month', v_now, v_now);

    -- Project 5: Logistic ERP (DISPUTED)
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_5, v_client_id, v_freelancer_id, v_broker_id, 'Hệ thống ERP quản lý kho vận', 'Module quản lý nhập xuất tồn, tracking đơn hàng.', 'DISPUTED', 200000000, 'USD', v_now - INTERVAL '1 month', v_now + INTERVAL '5 months', v_now, v_now);

    -- Project 6: Marketing Campaign (Active - NO DISPUTE) - MỚI
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_6, v_client_id, v_freelancer_id, v_broker_id, 'Chiến dịch Quảng cáo Facebook Ads', 'Setup và tối ưu ads cho shop thời trang trong 3 tháng.', 'IN_PROGRESS', 45000000, 'USD', v_now - INTERVAL '2 weeks', v_now + INTERVAL '2 months', v_now, v_now);

    -- Project 7: IoT Smart Home (Planning - NO DISPUTE) - MỚI
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_7, v_client_id, v_freelancer_id, v_broker_id, 'Hệ thống IoT Smart Home Basic', 'Thiết kế mạch điều khiển đèn và rèm cửa qua WiFi.', 'PLANNING', 15000000, 'USD', v_now + INTERVAL '5 days', v_now + INTERVAL '1 month', v_now, v_now);

    -- Project 8: CRM SaaS (Testing - NO DISPUTE) - MỚI
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_proj_8, v_client_id, v_freelancer_id, v_broker_id, 'CRM SaaS cho Bất động sản', 'Modul quản lý khách hàng tiềm năng và lịch hẹn.', 'TESTING', 90000000, 'USD', v_now - INTERVAL '2 months', v_now + INTERVAL '1 week', v_now, v_now);


    -- ================================================================
    -- 3. CREATE MILESTONES (Required for Disputes, and for Normal Projects)
    -- ================================================================
    
    -- MS for Project 1
    INSERT INTO "milestones" ("id", "projectId", "title", "amount", "status", "dueDate", "createdAt")
    VALUES (v_ms_1, v_proj_1, 'Milestone 2 - Integration Payment', 15000000, 'IN_PROGRESS', v_now, v_now);

    -- MS for Project 3
    INSERT INTO "milestones" ("id", "projectId", "title", "amount", "status", "dueDate", "createdAt")
    VALUES (v_ms_2, v_proj_3, 'Milestone Final - Model Accuracy Test', 40000000, 'PENDING', v_now, v_now);

    -- MS for Project 5
    INSERT INTO "milestones" ("id", "projectId", "title", "amount", "status", "dueDate", "createdAt")
    VALUES (v_ms_3, v_proj_5, 'Milestone 1 - Database Design', 30000000, 'COMPLETED', v_now - INTERVAL '5 days', v_now);

    -- MS for Project 6 (NO DISPUTE)
    INSERT INTO "milestones" ("id", "projectId", "title", "amount", "status", "dueDate", "createdAt")
    VALUES (v_ms_6, v_proj_6, 'Milestone 1 - Setup Ad Accounts', 10000000, 'COMPLETED', v_now - INTERVAL '1 week', v_now);

    -- MS for Project 8 (NO DISPUTE)
    INSERT INTO "milestones" ("id", "projectId", "title", "amount", "status", "dueDate", "createdAt")
    VALUES (v_ms_8, v_proj_8, 'Milestone UAT Testing', 20000000, 'IN_PROGRESS', v_now + INTERVAL '3 days', v_now);


    -- ================================================================
    -- 4. CREATE DISPUTES (Only for Disputed Projects)
    -- ================================================================

    -- Dispute 1: QUALITY (Code lỗi)
    INSERT INTO "disputes" (
        "id", "projectId", "milestoneId", "raisedById", "defendantId", 
        "reason", "status", "category", "priority", 
        "assignedStaffId", "assignedAt", "evidence", "createdAt", "updatedAt"
    ) VALUES (
        v_disp_1, v_proj_1, v_ms_1, v_client_id, v_freelancer_id, 
        'Code tích hợp cổng thanh toán bị lỗi nghiêm trọng, gây mất tiền user.', 
        'OPEN', 'QUALITY', 'HIGH',
        v_staff_id, v_now, 
        '[{"title": "Error Log", "url": "https://pastebin.com/raw/error_log_123", "type": "LOG"}, {"title": "Screen Rec", "url": "https://youtube.com/demo_bug", "type": "VIDEO"}]'::jsonb,
        v_now, v_now
    );

    -- Dispute 2: DEADLINE (Trễ hạn)
    INSERT INTO "disputes" (
        "id", "projectId", "milestoneId", "raisedById", "defendantId", 
        "reason", "status", "category", "priority", 
        "assignedStaffId", "assignedAt", "evidence", "createdAt", "updatedAt"
    ) VALUES (
        v_disp_2, v_proj_3, v_ms_2, v_client_id, v_freelancer_id, 
        'Đã quá hạn 2 tuần nhưng chưa giao model đạt chuẩn 99%.', 
        'OPEN', 'DEADLINE', 'MEDIUM',
        v_staff_id, v_now,
        '[{"title": "Chat History Zalo", "url": "https://img.upanh.com/chat_zalo.jpg", "type": "IMAGE"}]'::jsonb,
        v_now, v_now
    );

    -- Dispute 3: PAYMENT / SCOPE (Freelancer kiện Client)
    INSERT INTO "disputes" (
        "id", "projectId", "milestoneId", "raisedById", "defendantId", 
        "reason", "status", "category", "priority", 
        "assignedStaffId", "assignedAt", "evidence", "createdAt", "updatedAt"
    ) VALUES (
        v_disp_3, v_proj_5, v_ms_3, v_freelancer_id, v_client_id, -- Freelancer kiện
        'Client yêu cầu thêm tính năng Mobile App không có trong hợp đồng ban đầu.', 
        'OPEN', 'SCOPE_CHANGE', 'MEDIUM',
        v_staff_id, v_now, 
        '[{"title": "Original Scope PDF", "url": "https://docs.google.com/scope_v1.pdf", "type": "DOCUMENT"}]'::jsonb,
        v_now, v_now
    );


    -- ================================================================
    -- 5. RESULT
    -- ================================================================
    RAISE NOTICE '================================================';
    RAISE NOTICE 'EXTENDED DATA SEEDED SUCCESSFULLY!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Total Projects: 8';
    RAISE NOTICE '  - Disputed: 3';
    RAISE NOTICE '  - Normal:   5';
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'Added Disputes: 3';
    RAISE NOTICE '================================================';

END $$;
