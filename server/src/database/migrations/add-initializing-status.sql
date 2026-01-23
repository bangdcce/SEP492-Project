-- Migration: Add INITIALIZING status to projects_status_enum
-- Purpose: Allow Projects to be created in a "draft" state before Contract is signed
-- Run this BEFORE deploying the new contracts module

-- PostgreSQL: Add new value to existing enum
ALTER TYPE projects_status_enum ADD VALUE IF NOT EXISTS 'INITIALIZING';

-- Note: This is a one-way migration. PostgreSQL does not support removing enum values easily.
-- The INITIALIZING status represents a Project that:
--   1. Has been created from an Approved Spec
--   2. Has a Draft Contract awaiting signatures
--   3. Should be HIDDEN from normal Dashboard queries
--   4. Will transition to IN_PROGRESS once Contract is signed
