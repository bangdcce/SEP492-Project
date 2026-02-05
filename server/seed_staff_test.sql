-- ==================================================================================
-- SCRIPT: seed_staff_test.sql
-- VER: 6.0 (Fixed password hash)
-- PASSWORD: password123
-- ==================================================================================

DO $$
DECLARE
    -- UUIDs
    v_staff_id uuid := gen_random_uuid();
    v_client_id uuid := gen_random_uuid();
    v_freelancer_id uuid := gen_random_uuid();
    v_broker_id uuid := gen_random_uuid();
    
    v_project_id uuid := gen_random_uuid();
    v_milestone_id uuid := gen_random_uuid();
    v_dispute_id uuid := gen_random_uuid();
    
    v_kyc_staff_id uuid := gen_random_uuid();
    v_kyc_client_id uuid := gen_random_uuid();
    v_kyc_freelancer_id uuid := gen_random_uuid();
    v_kyc_broker_id uuid := gen_random_uuid();
    
    -- CORRECT Password hash for "password123" (from demo_seed.sql)
    v_password_hash text := '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW';
    
    -- Timestamps
    v_now timestamp := NOW();
    v_verified_at timestamp := NOW() - INTERVAL '1 month';
    v_start_date timestamp := NOW() - INTERVAL '1 month';
    v_end_date timestamp := NOW() + INTERVAL '2 months';

BEGIN
    -- ================================================================
    -- 1. USERS
    -- ================================================================
    INSERT INTO "users" ("id", "email", "passwordHash", "fullName", "role", "phoneNumber", "isVerified", "currentTrustScore", "createdAt", "updatedAt")
    VALUES 
        (v_staff_id, 'staff.test.new@example.com', v_password_hash, 'Test Staff Member', 'STAFF', '0999888111', true, 5.00, v_now, v_now),
        (v_client_id, 'client.test.new@example.com', v_password_hash, 'Test Client Owner', 'CLIENT', '0999888222', true, 4.50, v_now, v_now),
        (v_freelancer_id, 'freelancer.test.new@example.com', v_password_hash, 'Test Freelancer Dev', 'FREELANCER', '0999888333', true, 4.80, v_now, v_now),
        (v_broker_id, 'broker.test.new@example.com', v_password_hash, 'Test Broker', 'BROKER', '0999888444', true, 4.90, v_now, v_now);

    -- ================================================================
    -- 2. KYC VERIFICATIONS
    -- ================================================================
    INSERT INTO "kyc_verifications" ("id", "userId", "status", "documentType", "fullNameOnDocument", "documentNumber", "dateOfBirth", "documentExpiryDate", "documentFrontUrl", "documentBackUrl", "selfieUrl", "reviewedBy", "reviewedAt", "createdAt", "updatedAt")
    VALUES
        (v_kyc_staff_id, v_staff_id, 'APPROVED', 'CCCD', 'TEST STAFF MEMBER', '001234567890', '1990-01-01', '2030-01-01', 'https://example.com/staff-front.jpg', 'https://example.com/staff-back.jpg', 'https://example.com/staff-selfie.jpg', v_staff_id, v_verified_at, v_verified_at, v_now),
        (v_kyc_client_id, v_client_id, 'APPROVED', 'PASSPORT', 'TEST CLIENT OWNER', 'B1234567', '1985-05-15', '2028-05-15', 'https://example.com/client-front.jpg', 'https://example.com/client-back.jpg', 'https://example.com/client-selfie.jpg', v_staff_id, v_verified_at, v_verified_at, v_now),
        (v_kyc_freelancer_id, v_freelancer_id, 'APPROVED', 'CCCD', 'TEST FREELANCER DEV', '009876543210', '1995-10-20', '2035-10-20', 'https://example.com/freelancer-front.jpg', 'https://example.com/freelancer-back.jpg', 'https://example.com/freelancer-selfie.jpg', v_staff_id, v_verified_at, v_verified_at, v_now),
        (v_kyc_broker_id, v_broker_id, 'APPROVED', 'DRIVER_LICENSE', 'TEST BROKER', 'DL99887766', '1988-08-08', '2028-08-08', 'https://example.com/broker-front.jpg', 'https://example.com/broker-back.jpg', 'https://example.com/broker-selfie.jpg', v_staff_id, v_verified_at, v_verified_at, v_now);

    -- ================================================================
    -- 3. PROJECT
    -- ================================================================
    INSERT INTO "projects" ("id", "clientId", "freelancerId", "brokerId", "title", "description", "status", "totalBudget", "currency", "startDate", "endDate", "createdAt", "updatedAt")
    VALUES (v_project_id, v_client_id, v_freelancer_id, v_broker_id, 'Dự án Test Tranh Chấp', 'Dự án test đầy đủ các stakeholder.', 'DISPUTED', 15000000, 'USD', v_start_date, v_end_date, v_now, v_now);

    -- ================================================================
    -- 4. MILESTONE (Required for Dispute)
    -- ================================================================
    INSERT INTO "milestones" ("id", "projectId", "title", "amount", "status", "dueDate", "createdAt")
    VALUES (v_milestone_id, v_project_id, 'Milestone 1 - Thiết kế UI', 5000000, 'IN_PROGRESS', v_end_date, v_now);

    -- ================================================================
    -- 5. DISPUTE
    -- ================================================================
    INSERT INTO "disputes" ("id", "projectId", "milestoneId", "raisedById", "defendantId", "reason", "status", "assignedStaffId", "assignedAt", "createdAt", "updatedAt")
    VALUES (v_dispute_id, v_project_id, v_milestone_id, v_client_id, v_freelancer_id, 'Freelancer không bàn giao đúng hạn milestone.', 'OPEN', v_staff_id, v_now, v_now, v_now);

    -- ================================================================
    -- 6. RESULT
    -- ================================================================
    RAISE NOTICE '================================================';
    RAISE NOTICE 'SUCCESS! Version 6.0 - Correct password hash';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Password: password123';
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'Staff:      staff.test.new@example.com';
    RAISE NOTICE 'Client:     client.test.new@example.com';
    RAISE NOTICE 'Freelancer: freelancer.test.new@example.com';
    RAISE NOTICE 'Broker:     broker.test.new@example.com';
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'Project ID:   %', v_project_id;
    RAISE NOTICE 'Milestone ID: %', v_milestone_id;
    RAISE NOTICE 'Dispute ID:   %', v_dispute_id;
    RAISE NOTICE '================================================';
END $$;
