-- =========================================================
-- FIX ENUM SCRIPT
-- Run this script FIRST to ensure the 'DRAFT' status exists.
-- This must be run separately from data insertion queries.
-- =========================================================

DO $$
BEGIN
    -- Check if the enum type exists and doesn't have DRAFT
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_requests_status_enum') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
                       WHERE t.typname = 'project_requests_status_enum' AND e.enumlabel = 'DRAFT') THEN
            ALTER TYPE "project_requests_status_enum" ADD VALUE 'DRAFT';
        END IF;
    END IF;
END$$;
