--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: hypopg; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;


--
-- Name: EXTENSION hypopg; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION hypopg IS 'Hypothetical indexes for PostgreSQL';


--
-- Name: index_advisor; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;


--
-- Name: EXTENSION index_advisor; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION index_advisor IS 'Query index advisor';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: auto_schedule_rules_eventtype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.auto_schedule_rules_eventtype_enum AS ENUM (
    'DISPUTE_HEARING',
    'PROJECT_MEETING',
    'INTERNAL_MEETING',
    'PERSONAL_BLOCK',
    'REVIEW_SESSION',
    'TASK_DEADLINE',
    'OTHER'
);


ALTER TYPE public.auto_schedule_rules_eventtype_enum OWNER TO postgres;

--
-- Name: auto_schedule_rules_strategy_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.auto_schedule_rules_strategy_enum AS ENUM (
    'BALANCED',
    'URGENT_FIRST',
    'ROUND_ROBIN',
    'LEAST_BUSY'
);


ALTER TYPE public.auto_schedule_rules_strategy_enum OWNER TO postgres;

--
-- Name: broker_proposals_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.broker_proposals_status_enum AS ENUM (
    'PENDING',
    'INVITED',
    'ACCEPTED',
    'REJECTED'
);


ALTER TYPE public.broker_proposals_status_enum OWNER TO postgres;

--
-- Name: calendar_events_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.calendar_events_priority_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public.calendar_events_priority_enum OWNER TO postgres;

--
-- Name: calendar_events_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.calendar_events_status_enum AS ENUM (
    'DRAFT',
    'PENDING_CONFIRMATION',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'RESCHEDULING'
);


ALTER TYPE public.calendar_events_status_enum OWNER TO postgres;

--
-- Name: calendar_events_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.calendar_events_type_enum AS ENUM (
    'DISPUTE_HEARING',
    'PROJECT_MEETING',
    'INTERNAL_MEETING',
    'PERSONAL_BLOCK',
    'REVIEW_SESSION',
    'TASK_DEADLINE',
    'OTHER'
);


ALTER TYPE public.calendar_events_type_enum OWNER TO postgres;

--
-- Name: dispute_activities_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_activities_action_enum AS ENUM (
    'CREATED',
    'ESCALATED',
    'RESOLVED',
    'REJECTED',
    'REVIEW_ACCEPTED',
    'INFO_REQUESTED',
    'INFO_PROVIDED',
    'REJECTION_APPEALED',
    'REJECTION_APPEAL_RESOLVED',
    'REOPENED',
    'EVIDENCE_ADDED',
    'EVIDENCE_REMOVED',
    'DEFENDANT_RESPONDED',
    'DEFENDANT_EVIDENCE_ADDED',
    'NOTE_ADDED',
    'PRIORITY_CHANGED',
    'CATEGORY_CHANGED',
    'ASSIGNED',
    'DEADLINE_EXTENDED',
    'APPEAL_SUBMITTED',
    'APPEAL_RESOLVED',
    'MESSAGE_SENT',
    'NOTIFICATION_SENT',
    'CANCELED'
);


ALTER TYPE public.dispute_activities_action_enum OWNER TO postgres;

--
-- Name: dispute_activities_actorrole_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_activities_actorrole_enum AS ENUM (
    'ADMIN',
    'STAFF',
    'BROKER',
    'CLIENT',
    'CLIENT_SME',
    'FREELANCER'
);


ALTER TYPE public.dispute_activities_actorrole_enum OWNER TO postgres;

--
-- Name: dispute_hearings_currentspeakerrole_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_hearings_currentspeakerrole_enum AS ENUM (
    'ALL',
    'MODERATOR_ONLY',
    'RAISER_ONLY',
    'DEFENDANT_ONLY',
    'MUTED_ALL'
);


ALTER TYPE public.dispute_hearings_currentspeakerrole_enum OWNER TO postgres;

--
-- Name: dispute_hearings_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_hearings_status_enum AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELED',
    'RESCHEDULED'
);


ALTER TYPE public.dispute_hearings_status_enum OWNER TO postgres;

--
-- Name: dispute_hearings_tier_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_hearings_tier_enum AS ENUM (
    'TIER_1',
    'TIER_2'
);


ALTER TYPE public.dispute_hearings_tier_enum OWNER TO postgres;

--
-- Name: dispute_messages_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_messages_type_enum AS ENUM (
    'TEXT',
    'IMAGE',
    'FILE',
    'EVIDENCE_LINK',
    'SYSTEM_LOG',
    'SETTLEMENT_PROPOSAL',
    'ADMIN_ANNOUNCEMENT'
);


ALTER TYPE public.dispute_messages_type_enum OWNER TO postgres;

--
-- Name: dispute_notes_authorrole_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_notes_authorrole_enum AS ENUM (
    'ADMIN',
    'STAFF',
    'BROKER',
    'CLIENT',
    'CLIENT_SME',
    'FREELANCER'
);


ALTER TYPE public.dispute_notes_authorrole_enum OWNER TO postgres;

--
-- Name: dispute_parties_side_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_parties_side_enum AS ENUM (
    'RAISER',
    'DEFENDANT',
    'THIRD_PARTY'
);


ALTER TYPE public.dispute_parties_side_enum OWNER TO postgres;

--
-- Name: dispute_schedule_proposals_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_schedule_proposals_status_enum AS ENUM (
    'ACTIVE',
    'SUBMITTED',
    'WITHDRAWN'
);


ALTER TYPE public.dispute_schedule_proposals_status_enum OWNER TO postgres;

--
-- Name: dispute_settlements_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_settlements_status_enum AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public.dispute_settlements_status_enum OWNER TO postgres;

--
-- Name: dispute_skill_requirements_source_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_skill_requirements_source_enum AS ENUM (
    'AUTO_DETECTED',
    'MANUAL_TAGGED',
    'ESCALATION'
);


ALTER TYPE public.dispute_skill_requirements_source_enum OWNER TO postgres;

--
-- Name: dispute_verdicts_faulttype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dispute_verdicts_faulttype_enum AS ENUM (
    'NON_DELIVERY',
    'QUALITY_MISMATCH',
    'DEADLINE_MISSED',
    'GHOSTING',
    'SCOPE_CHANGE_CONFLICT',
    'PAYMENT_ISSUE',
    'FRAUD',
    'MUTUAL_FAULT',
    'NO_FAULT',
    'OTHER'
);


ALTER TYPE public.dispute_verdicts_faulttype_enum OWNER TO postgres;

--
-- Name: disputes_category_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_category_enum AS ENUM (
    'QUALITY',
    'DEADLINE',
    'PAYMENT',
    'COMMUNICATION',
    'SCOPE_CHANGE',
    'FRAUD',
    'CONTRACT',
    'OTHER'
);


ALTER TYPE public.disputes_category_enum OWNER TO postgres;

--
-- Name: disputes_defendantrole_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_defendantrole_enum AS ENUM (
    'ADMIN',
    'STAFF',
    'BROKER',
    'CLIENT',
    'CLIENT_SME',
    'FREELANCER'
);


ALTER TYPE public.disputes_defendantrole_enum OWNER TO postgres;

--
-- Name: disputes_disputetype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_disputetype_enum AS ENUM (
    'CLIENT_VS_FREELANCER',
    'CLIENT_VS_BROKER',
    'FREELANCER_VS_CLIENT',
    'FREELANCER_VS_BROKER',
    'BROKER_VS_CLIENT',
    'BROKER_VS_FREELANCER'
);


ALTER TYPE public.disputes_disputetype_enum OWNER TO postgres;

--
-- Name: disputes_phase_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_phase_enum AS ENUM (
    'PRESENTATION',
    'CROSS_EXAMINATION',
    'INTERROGATION',
    'DELIBERATION'
);


ALTER TYPE public.disputes_phase_enum OWNER TO postgres;

--
-- Name: disputes_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_priority_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public.disputes_priority_enum OWNER TO postgres;

--
-- Name: disputes_raiserrole_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_raiserrole_enum AS ENUM (
    'ADMIN',
    'STAFF',
    'BROKER',
    'CLIENT',
    'CLIENT_SME',
    'FREELANCER'
);


ALTER TYPE public.disputes_raiserrole_enum OWNER TO postgres;

--
-- Name: disputes_result_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_result_enum AS ENUM (
    'PENDING',
    'WIN_CLIENT',
    'WIN_FREELANCER',
    'SPLIT'
);


ALTER TYPE public.disputes_result_enum OWNER TO postgres;

--
-- Name: disputes_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.disputes_status_enum AS ENUM (
    'OPEN',
    'IN_MEDIATION',
    'RESOLVED',
    'REJECTED',
    'APPEALED',
    'PENDING_REVIEW',
    'INFO_REQUESTED',
    'REJECTION_APPEALED',
    'TRIAGE_PENDING',
    'PREVIEW',
    'CANCELED'
);


ALTER TYPE public.disputes_status_enum OWNER TO postgres;

--
-- Name: documents_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.documents_type_enum AS ENUM (
    'SRS',
    'SDS',
    'MOCKUP',
    'REPORT',
    'OTHER'
);


ALTER TYPE public.documents_type_enum OWNER TO postgres;

--
-- Name: escrows_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.escrows_status_enum AS ENUM (
    'PENDING',
    'FUNDED',
    'RELEASED',
    'REFUNDED',
    'DISPUTED'
);


ALTER TYPE public.escrows_status_enum OWNER TO postgres;

--
-- Name: event_participants_attendancestatus_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_participants_attendancestatus_enum AS ENUM (
    'NOT_STARTED',
    'ON_TIME',
    'LATE',
    'VERY_LATE',
    'NO_SHOW',
    'EXCUSED'
);


ALTER TYPE public.event_participants_attendancestatus_enum OWNER TO postgres;

--
-- Name: event_participants_role_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_participants_role_enum AS ENUM (
    'ORGANIZER',
    'MODERATOR',
    'REQUIRED',
    'OPTIONAL',
    'OBSERVER'
);


ALTER TYPE public.event_participants_role_enum OWNER TO postgres;

--
-- Name: event_participants_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_participants_status_enum AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'TENTATIVE',
    'NO_RESPONSE'
);


ALTER TYPE public.event_participants_status_enum OWNER TO postgres;

--
-- Name: event_reschedule_requests_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_reschedule_requests_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'AUTO_RESOLVED',
    'WITHDRAWN'
);


ALTER TYPE public.event_reschedule_requests_status_enum OWNER TO postgres;

--
-- Name: fee_configs_feetype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.fee_configs_feetype_enum AS ENUM (
    'PLATFORM_FEE',
    'BROKER_COMMISSION',
    'WITHDRAWAL_FEE'
);


ALTER TYPE public.fee_configs_feetype_enum OWNER TO postgres;

--
-- Name: flag_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.flag_status_enum AS ENUM (
    'ACTIVE',
    'RESOLVED',
    'APPEALED',
    'EXPIRED',
    'DISMISSED'
);


ALTER TYPE public.flag_status_enum OWNER TO postgres;

--
-- Name: hearing_participants_role_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hearing_participants_role_enum AS ENUM (
    'RAISER',
    'DEFENDANT',
    'WITNESS',
    'MODERATOR',
    'OBSERVER'
);


ALTER TYPE public.hearing_participants_role_enum OWNER TO postgres;

--
-- Name: hearing_questions_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hearing_questions_status_enum AS ENUM (
    'PENDING_ANSWER',
    'ANSWERED',
    'CANCELLED_BY_MODERATOR'
);


ALTER TYPE public.hearing_questions_status_enum OWNER TO postgres;

--
-- Name: hearing_reminder_deliveries_remindertype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hearing_reminder_deliveries_remindertype_enum AS ENUM (
    'T24H',
    'T1H',
    'T10M',
    'T72H'
);


ALTER TYPE public.hearing_reminder_deliveries_remindertype_enum OWNER TO postgres;

--
-- Name: hearing_statements_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hearing_statements_status_enum AS ENUM (
    'DRAFT',
    'SUBMITTED'
);


ALTER TYPE public.hearing_statements_status_enum OWNER TO postgres;

--
-- Name: hearing_statements_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hearing_statements_type_enum AS ENUM (
    'OPENING',
    'EVIDENCE',
    'REBUTTAL',
    'CLOSING',
    'QUESTION',
    'ANSWER'
);


ALTER TYPE public.hearing_statements_type_enum OWNER TO postgres;

--
-- Name: kyc_access_logs_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_access_logs_action_enum AS ENUM (
    'VIEW_LIST',
    'VIEW_DETAIL',
    'DOWNLOAD_IMAGE',
    'APPROVE',
    'REJECT',
    'REQUEST_ACCESS'
);


ALTER TYPE public.kyc_access_logs_action_enum OWNER TO postgres;

--
-- Name: kyc_access_logs_reason_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_access_logs_reason_enum AS ENUM (
    'ROUTINE_REVIEW',
    'DISPUTE_INVESTIGATION',
    'FRAUD_REPORT',
    'LEGAL_REQUEST',
    'COMPLIANCE_AUDIT',
    'USER_SUPPORT'
);


ALTER TYPE public.kyc_access_logs_reason_enum OWNER TO postgres;

--
-- Name: kyc_verifications_documenttype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_verifications_documenttype_enum AS ENUM (
    'CCCD',
    'PASSPORT',
    'DRIVER_LICENSE'
);


ALTER TYPE public.kyc_verifications_documenttype_enum OWNER TO postgres;

--
-- Name: kyc_verifications_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_verifications_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED'
);


ALTER TYPE public.kyc_verifications_status_enum OWNER TO postgres;

--
-- Name: legal_signatures_actiontype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.legal_signatures_actiontype_enum AS ENUM (
    'CREATE_DISPUTE',
    'ACCEPT_SETTLEMENT',
    'ACCEPT_VERDICT',
    'APPEAL_SUBMISSION',
    'WITHDRAW_DISPUTE'
);


ALTER TYPE public.legal_signatures_actiontype_enum OWNER TO postgres;

--
-- Name: milestones_deliverabletype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.milestones_deliverabletype_enum AS ENUM (
    'DESIGN_PROTOTYPE',
    'API_DOCS',
    'DEPLOYMENT',
    'SOURCE_CODE',
    'SYS_OPERATION_DOCS',
    'CREDENTIAL_VAULT',
    'OTHER'
);


ALTER TYPE public.milestones_deliverabletype_enum OWNER TO postgres;

--
-- Name: milestones_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.milestones_status_enum AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'LOCKED',
    'COMPLETED',
    'PAID',
    'SUBMITTED',
    'REVISIONS_REQUIRED'
);


ALTER TYPE public.milestones_status_enum OWNER TO postgres;

--
-- Name: payout_requests_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payout_requests_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'PROCESSING',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public.payout_requests_status_enum OWNER TO postgres;

--
-- Name: project_requests_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_requests_status_enum AS ENUM (
    'PUBLIC_DRAFT',
    'PRIVATE_DRAFT',
    'BROKER_ASSIGNED',
    'SPEC_APPROVED',
    'CONTRACT_PENDING',
    'HIRING',
    'CONVERTED_TO_PROJECT',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELED',
    'DRAFT',
    'PENDING',
    'PENDING_SPECS',
    'PROCESSING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'SPEC_SUBMITTED'
);


ALTER TYPE public.project_requests_status_enum OWNER TO postgres;

--
-- Name: project_spec_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_spec_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.project_spec_status_enum OWNER TO postgres;

--
-- Name: project_specs_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.project_specs_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'PENDING_AUDIT',
    'CLIENT_REVIEW',
    'CLIENT_APPROVED',
    'FINAL_REVIEW',
    'ALL_SIGNED'
);


ALTER TYPE public.project_specs_status_enum OWNER TO postgres;

--
-- Name: projects_pricingmodel_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.projects_pricingmodel_enum AS ENUM (
    'FIXED_PRICE',
    'TIME_MATERIALS'
);


ALTER TYPE public.projects_pricingmodel_enum OWNER TO postgres;

--
-- Name: projects_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.projects_status_enum AS ENUM (
    'INITIALIZING',
    'PLANNING',
    'IN_PROGRESS',
    'TESTING',
    'COMPLETED',
    'PAID',
    'DISPUTED',
    'CANCELED'
);


ALTER TYPE public.projects_status_enum OWNER TO postgres;

--
-- Name: reports_reason_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reports_reason_enum AS ENUM (
    'SPAM',
    'HARASSMENT',
    'DOXING',
    'FAKE_REVIEW',
    'INAPPROPRIATE_LANGUAGE',
    'OFF_TOPIC',
    'OTHER'
);


ALTER TYPE public.reports_reason_enum OWNER TO postgres;

--
-- Name: reports_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reports_status_enum AS ENUM (
    'PENDING',
    'RESOLVED',
    'REJECTED'
);


ALTER TYPE public.reports_status_enum OWNER TO postgres;

--
-- Name: skills_category_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.skills_category_enum AS ENUM (
    'FRONTEND',
    'BACKEND',
    'MOBILE',
    'DATABASE',
    'DEVOPS',
    'DESIGN',
    'TESTING',
    'DATA',
    'AI_ML',
    'BUSINESS_ANALYSIS',
    'PROJECT_MANAGEMENT',
    'CONSULTING',
    'DOMAIN_EXPERTISE',
    'AUDIT_SECURITY',
    'AUDIT_CODE_QUALITY',
    'AUDIT_FINANCE',
    'AUDIT_LEGAL',
    'AUDIT_TECHNICAL',
    'OTHER'
);


ALTER TYPE public.skills_category_enum OWNER TO postgres;

--
-- Name: spec_phase_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.spec_phase_enum AS ENUM (
    'CLIENT_SPEC',
    'FULL_SPEC'
);


ALTER TYPE public.spec_phase_enum OWNER TO postgres;

--
-- Name: staff_leave_requests_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_leave_requests_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public.staff_leave_requests_status_enum OWNER TO postgres;

--
-- Name: staff_leave_requests_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.staff_leave_requests_type_enum AS ENUM (
    'SHORT_TERM',
    'LONG_TERM'
);


ALTER TYPE public.staff_leave_requests_type_enum OWNER TO postgres;

--
-- Name: task_submissions_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_submissions_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'REQUEST_CHANGES'
);


ALTER TYPE public.task_submissions_status_enum OWNER TO postgres;

--
-- Name: tasks_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tasks_priority_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public.tasks_priority_enum OWNER TO postgres;

--
-- Name: tasks_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tasks_status_enum AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'REVISIONS_REQUIRED',
    'BLOCKED',
    'DONE'
);


ALTER TYPE public.tasks_status_enum OWNER TO postgres;

--
-- Name: transactions_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transactions_status_enum AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public.transactions_status_enum OWNER TO postgres;

--
-- Name: transactions_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transactions_type_enum AS ENUM (
    'DEPOSIT',
    'WITHDRAWAL',
    'ESCROW_HOLD',
    'ESCROW_RELEASE',
    'REFUND',
    'FEE_DEDUCTION'
);


ALTER TYPE public.transactions_type_enum OWNER TO postgres;

--
-- Name: user_availabilities_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_availabilities_type_enum AS ENUM (
    'AVAILABLE',
    'BUSY',
    'OUT_OF_OFFICE',
    'PREFERRED',
    'DO_NOT_DISTURB'
);


ALTER TYPE public.user_availabilities_type_enum OWNER TO postgres;

--
-- Name: user_flags_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_flags_status_enum AS ENUM (
    'ACTIVE',
    'RESOLVED',
    'APPEALED',
    'EXPIRED',
    'DISMISSED'
);


ALTER TYPE public.user_flags_status_enum OWNER TO postgres;

--
-- Name: user_skills_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_skills_priority_enum AS ENUM (
    'PRIMARY',
    'SECONDARY'
);


ALTER TYPE public.user_skills_priority_enum OWNER TO postgres;

--
-- Name: user_skills_verificationstatus_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_skills_verificationstatus_enum AS ENUM (
    'SELF_DECLARED',
    'PORTFOLIO_LINKED',
    'PROJECT_VERIFIED',
    'ADMIN_VERIFIED'
);


ALTER TYPE public.user_skills_verificationstatus_enum OWNER TO postgres;

--
-- Name: user_tokens_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_tokens_status_enum AS ENUM (
    'PENDING',
    'USED',
    'REVOKED'
);


ALTER TYPE public.user_tokens_status_enum OWNER TO postgres;

--
-- Name: user_tokens_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_tokens_type_enum AS ENUM (
    'EMAIL_VERIFICATION',
    'PASSWORD_RESET'
);


ALTER TYPE public.user_tokens_type_enum OWNER TO postgres;

--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.users_role_enum AS ENUM (
    'ADMIN',
    'STAFF',
    'BROKER',
    'CLIENT',
    'FREELANCER',
    'CLIENT_SME'
);


ALTER TYPE public.users_role_enum OWNER TO postgres;

--
-- Name: users_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.users_status_enum AS ENUM (
    'ACTIVE',
    'DELETED'
);


ALTER TYPE public.users_status_enum OWNER TO postgres;

--
-- Name: verification_documents_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.verification_documents_status_enum AS ENUM (
    'PENDING',
    'VERIFIED',
    'REJECTED'
);


ALTER TYPE public.verification_documents_status_enum OWNER TO postgres;

--
-- Name: wallets_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.wallets_status_enum AS ENUM (
    'ACTIVE',
    'FROZEN',
    'SUSPENDED'
);


ALTER TYPE public.wallets_status_enum OWNER TO postgres;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) OWNER TO supabase_storage_admin;

--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION storage.get_level(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION storage.get_prefix(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION storage.get_prefixes(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.protect_delete() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    actor_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying NOT NULL,
    ip_address character varying(45),
    user_agent text,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "refreshTokenHash" character varying NOT NULL,
    "userAgent" character varying,
    "ipAddress" character varying,
    "isRevoked" boolean DEFAULT false NOT NULL,
    "revokedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastUsedAt" timestamp without time zone,
    "replacedBySessionId" uuid,
    "validAccessFrom" timestamp without time zone,
    "refreshTokenFingerprint" character varying(64)
);


ALTER TABLE public.auth_sessions OWNER TO postgres;

--
-- Name: auto_schedule_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auto_schedule_rules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    "eventType" public.auto_schedule_rules_eventtype_enum NOT NULL,
    strategy public.auto_schedule_rules_strategy_enum DEFAULT 'BALANCED'::public.auto_schedule_rules_strategy_enum NOT NULL,
    "defaultDurationMinutes" integer DEFAULT 60 NOT NULL,
    "bufferMinutes" integer DEFAULT 15 NOT NULL,
    "maxStaffUtilizationRate" integer DEFAULT 80 NOT NULL,
    "maxEventsPerStaffPerDay" integer DEFAULT 5 NOT NULL,
    "workingHoursStart" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "workingHoursEnd" time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    "workingDays" jsonb DEFAULT '[1, 2, 3, 4, 5]'::jsonb NOT NULL,
    "respectUserPreferredSlots" boolean DEFAULT true NOT NULL,
    "avoidLunchHours" boolean DEFAULT true NOT NULL,
    "lunchStartTime" time without time zone DEFAULT '11:30:00'::time without time zone,
    "lunchEndTime" time without time zone DEFAULT '13:00:00'::time without time zone,
    "maxRescheduleCount" integer DEFAULT 2 NOT NULL,
    "minRescheduleNoticeHours" integer DEFAULT 24 NOT NULL,
    "autoAssignStaff" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auto_schedule_rules OWNER TO postgres;

--
-- Name: COLUMN auto_schedule_rules."eventType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."eventType" IS 'Rule áp dụng cho loại event nào';


--
-- Name: COLUMN auto_schedule_rules."defaultDurationMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."defaultDurationMinutes" IS 'Thời lượng mặc định (phút)';


--
-- Name: COLUMN auto_schedule_rules."bufferMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."bufferMinutes" IS 'Khoảng trống tối thiểu giữa 2 event (phút)';


--
-- Name: COLUMN auto_schedule_rules."maxStaffUtilizationRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."maxStaffUtilizationRate" IS 'Staff chỉ nhận việc khi utilizationRate < X%';


--
-- Name: COLUMN auto_schedule_rules."maxEventsPerStaffPerDay"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."maxEventsPerStaffPerDay" IS 'Số event tối đa mỗi Staff/ngày';


--
-- Name: COLUMN auto_schedule_rules."workingHoursStart"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."workingHoursStart" IS 'Giờ bắt đầu làm việc';


--
-- Name: COLUMN auto_schedule_rules."workingHoursEnd"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."workingHoursEnd" IS 'Giờ kết thúc làm việc';


--
-- Name: COLUMN auto_schedule_rules."workingDays"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."workingDays" IS 'Ngày làm việc (1=T2, 5=T6)';


--
-- Name: COLUMN auto_schedule_rules."respectUserPreferredSlots"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."respectUserPreferredSlots" IS 'Ưu tiên khung giờ user đánh dấu PREFERRED';


--
-- Name: COLUMN auto_schedule_rules."avoidLunchHours"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."avoidLunchHours" IS 'Tránh giờ nghỉ trưa (11:30-13:00)';


--
-- Name: COLUMN auto_schedule_rules."maxRescheduleCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."maxRescheduleCount" IS 'Số lần dời lịch tối đa';


--
-- Name: COLUMN auto_schedule_rules."minRescheduleNoticeHours"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."minRescheduleNoticeHours" IS 'Phải dời trước ít nhất X giờ';


--
-- Name: COLUMN auto_schedule_rules."autoAssignStaff"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."autoAssignStaff" IS 'Tự động gán Staff khi tạo event';


--
-- Name: COLUMN auto_schedule_rules."isDefault"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.auto_schedule_rules."isDefault" IS 'Rule mặc định cho eventType này';


--
-- Name: broker_proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broker_proposals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "requestId" uuid NOT NULL,
    "brokerId" uuid NOT NULL,
    "coverLetter" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    status public.broker_proposals_status_enum DEFAULT 'PENDING'::public.broker_proposals_status_enum NOT NULL
);


ALTER TABLE public.broker_proposals OWNER TO postgres;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    type public.calendar_events_type_enum NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    priority public.calendar_events_priority_enum DEFAULT 'MEDIUM'::public.calendar_events_priority_enum NOT NULL,
    status public.calendar_events_status_enum DEFAULT 'DRAFT'::public.calendar_events_status_enum NOT NULL,
    "startTime" timestamp with time zone NOT NULL,
    "endTime" timestamp with time zone NOT NULL,
    "durationMinutes" integer NOT NULL,
    "organizerId" uuid NOT NULL,
    "referenceType" character varying(50),
    "referenceId" character varying,
    "isAutoScheduled" boolean DEFAULT false NOT NULL,
    "autoScheduleRuleId" character varying,
    "rescheduleCount" integer DEFAULT 0 NOT NULL,
    "previousEventId" uuid,
    "lastRescheduledAt" timestamp without time zone,
    location character varying,
    "externalMeetingLink" character varying,
    "reminderMinutes" jsonb,
    notes text,
    metadata jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.calendar_events OWNER TO postgres;

--
-- Name: COLUMN calendar_events."durationMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."durationMinutes" IS 'Thời lượng (phút)';


--
-- Name: COLUMN calendar_events."organizerId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."organizerId" IS 'Người tạo event (Staff/Admin/User)';


--
-- Name: COLUMN calendar_events."referenceType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."referenceType" IS 'DisputeHearing, Project, Task...';


--
-- Name: COLUMN calendar_events."isAutoScheduled"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."isAutoScheduled" IS 'TRUE = Hệ thống tự tạo';


--
-- Name: COLUMN calendar_events."autoScheduleRuleId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."autoScheduleRuleId" IS 'Rule đã dùng để auto-schedule';


--
-- Name: COLUMN calendar_events."rescheduleCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."rescheduleCount" IS 'Số lần đã dời lịch (Max 2-3)';


--
-- Name: COLUMN calendar_events."previousEventId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."previousEventId" IS 'Event cũ nếu là reschedule';


--
-- Name: COLUMN calendar_events.location; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events.location IS 'Online, Room A, etc.';


--
-- Name: COLUMN calendar_events."externalMeetingLink"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."externalMeetingLink" IS 'Link Google Meet/Zoom nếu online (bên thứ 3)';


--
-- Name: COLUMN calendar_events."reminderMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calendar_events."reminderMinutes" IS 'Cấu hình nhắc nhở [15, 60, 1440] phút trước';


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "projectId" uuid NOT NULL,
    title character varying,
    "contractUrl" character varying NOT NULL,
    "termsContent" text,
    status character varying DEFAULT 'DRAFT'::character varying NOT NULL,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "sourceSpecId" uuid
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: digital_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digital_signatures (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "contractId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "signatureHash" character varying NOT NULL,
    "ipAddress" character varying,
    "signedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.digital_signatures OWNER TO postgres;

--
-- Name: dispute_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_activities (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "actorId" uuid,
    "actorRole" public.dispute_activities_actorrole_enum,
    action public.dispute_activities_action_enum NOT NULL,
    description character varying(500),
    metadata jsonb,
    "isInternal" boolean DEFAULT false NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_activities OWNER TO postgres;

--
-- Name: dispute_evidences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_evidences (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "uploaderId" uuid NOT NULL,
    "uploaderRole" character varying NOT NULL,
    "storagePath" character varying NOT NULL,
    "fileName" character varying NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" character varying NOT NULL,
    description text,
    "fileHash" character varying(64),
    "isFlagged" boolean DEFAULT false NOT NULL,
    "flagReason" text,
    "flaggedById" uuid,
    "flaggedAt" timestamp without time zone,
    "uploadedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_evidences OWNER TO postgres;

--
-- Name: COLUMN dispute_evidences."uploaderId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."uploaderId" IS 'Người upload bằng chứng';


--
-- Name: COLUMN dispute_evidences."uploaderRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."uploaderRole" IS 'Role của người upload lúc đó (CLIENT/FREELANCER/STAFF/ADMIN)';


--
-- Name: COLUMN dispute_evidences."storagePath"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."storagePath" IS 'Đường dẫn file trong Supabase Bucket (e.g., disputes/uuid/file.png)';


--
-- Name: COLUMN dispute_evidences."fileName"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."fileName" IS 'Tên file gốc người dùng upload (để hiển thị trên UI)';


--
-- Name: COLUMN dispute_evidences."fileSize"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."fileSize" IS 'Dung lượng file tính bằng bytes';


--
-- Name: COLUMN dispute_evidences."mimeType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."mimeType" IS 'MIME Type chi tiết (image/jpeg, application/pdf...)';


--
-- Name: COLUMN dispute_evidences.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences.description IS 'Mô tả ngắn cho bằng chứng (Caption)';


--
-- Name: COLUMN dispute_evidences."fileHash"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."fileHash" IS 'SHA-256 hash để verify integrity';


--
-- Name: COLUMN dispute_evidences."isFlagged"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."isFlagged" IS 'TRUE = Admin ẩn do nhạy cảm (Soft Hide)';


--
-- Name: COLUMN dispute_evidences."flagReason"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."flagReason" IS 'Lý do bị ẩn (VD: Mã độc, Ảnh fake)';


--
-- Name: COLUMN dispute_evidences."flaggedById"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."flaggedById" IS 'Admin/Staff đã flag';


--
-- Name: COLUMN dispute_evidences."uploadedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_evidences."uploadedAt" IS 'Thời điểm upload bằng chứng (Immutable)';


--
-- Name: dispute_hearings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_hearings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    status public.dispute_hearings_status_enum DEFAULT 'SCHEDULED'::public.dispute_hearings_status_enum NOT NULL,
    "scheduledAt" timestamp without time zone NOT NULL,
    "startedAt" timestamp without time zone,
    "endedAt" timestamp without time zone,
    agenda text,
    "requiredDocuments" jsonb,
    "moderatorId" uuid NOT NULL,
    summary text,
    findings text,
    "pendingActions" jsonb,
    "hearingNumber" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "externalMeetingLink" character varying,
    "currentSpeakerRole" public.dispute_hearings_currentspeakerrole_enum DEFAULT 'MUTED_ALL'::public.dispute_hearings_currentspeakerrole_enum NOT NULL,
    tier public.dispute_hearings_tier_enum DEFAULT 'TIER_1'::public.dispute_hearings_tier_enum NOT NULL,
    "isChatRoomActive" boolean DEFAULT false NOT NULL,
    "estimatedDurationMinutes" integer DEFAULT 60 NOT NULL,
    "rescheduleCount" integer DEFAULT 0 NOT NULL,
    "previousHearingId" character varying,
    "lastRescheduledAt" timestamp without time zone
);


ALTER TABLE public.dispute_hearings OWNER TO postgres;

--
-- Name: COLUMN dispute_hearings."moderatorId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."moderatorId" IS 'Staff/Admin chủ trì phiên điều trần';


--
-- Name: COLUMN dispute_hearings."externalMeetingLink"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."externalMeetingLink" IS 'Link Google Meet/Zoom nếu cần video call (optional, do bên thứ 3 cung cấp)';


--
-- Name: COLUMN dispute_hearings."currentSpeakerRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."currentSpeakerRole" IS 'Kiểm soát ai được quyền chat hiện tại';


--
-- Name: COLUMN dispute_hearings.tier; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings.tier IS 'Tier 1 = Staff, Tier 2 = Admin phúc thẩm';


--
-- Name: COLUMN dispute_hearings."isChatRoomActive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."isChatRoomActive" IS 'TRUE = Phòng chat đang hoạt động';


--
-- Name: COLUMN dispute_hearings."estimatedDurationMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."estimatedDurationMinutes" IS 'Thời lượng dự kiến (phút)';


--
-- Name: COLUMN dispute_hearings."rescheduleCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."rescheduleCount" IS 'Số lần đã dời lịch (Max 2-3)';


--
-- Name: COLUMN dispute_hearings."previousHearingId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_hearings."previousHearingId" IS 'Phiên cũ nếu đây là reschedule';


--
-- Name: dispute_ledgers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_ledgers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "eventType" character varying(80) NOT NULL,
    "actorId" character varying,
    reason text,
    payload jsonb,
    "previousHash" character varying(128),
    "canonicalPayload" text NOT NULL,
    hash character varying(128) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_ledgers OWNER TO postgres;

--
-- Name: dispute_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "senderId" uuid,
    "senderRole" character varying NOT NULL,
    type public.dispute_messages_type_enum DEFAULT 'TEXT'::public.dispute_messages_type_enum NOT NULL,
    content text,
    "replyToMessageId" uuid,
    "relatedEvidenceId" uuid,
    "hearingId" uuid,
    metadata jsonb,
    "isHidden" boolean DEFAULT false NOT NULL,
    "hiddenReason" text,
    "hiddenById" character varying,
    "hiddenAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_messages OWNER TO postgres;

--
-- Name: COLUMN dispute_messages."senderId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages."senderId" IS 'User ID (null = System message)';


--
-- Name: COLUMN dispute_messages."senderRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages."senderRole" IS 'Role lúc gửi: CLIENT/FREELANCER/BROKER/STAFF/ADMIN/SYSTEM';


--
-- Name: COLUMN dispute_messages.content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages.content IS 'Nội dung chat text';


--
-- Name: COLUMN dispute_messages."replyToMessageId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages."replyToMessageId" IS 'Reply tin nhắn nào?';


--
-- Name: COLUMN dispute_messages."relatedEvidenceId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages."relatedEvidenceId" IS 'Tin nhắn này đang bàn luận về bằng chứng nào?';


--
-- Name: COLUMN dispute_messages."hearingId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages."hearingId" IS 'Phiên điều trần (nếu chat trong hearing)';


--
-- Name: COLUMN dispute_messages."isHidden"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_messages."isHidden" IS 'Admin ẩn tin nhắn này';


--
-- Name: dispute_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_notes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "authorId" uuid NOT NULL,
    "authorRole" public.dispute_notes_authorrole_enum NOT NULL,
    content text NOT NULL,
    "isInternal" boolean DEFAULT false NOT NULL,
    "isPinned" boolean DEFAULT false NOT NULL,
    "noteType" character varying(50) DEFAULT 'GENERAL'::character varying NOT NULL,
    attachments jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_notes OWNER TO postgres;

--
-- Name: dispute_parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_parties (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "groupId" uuid NOT NULL,
    "disputeId" uuid,
    "userId" uuid NOT NULL,
    role public.users_role_enum,
    side public.dispute_parties_side_enum DEFAULT 'THIRD_PARTY'::public.dispute_parties_side_enum NOT NULL,
    "joinedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_parties OWNER TO postgres;

--
-- Name: dispute_resolution_feedbacks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_resolution_feedbacks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "staffId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "userRole" character varying NOT NULL,
    rating integer NOT NULL,
    comment text,
    "fairnessRating" integer,
    "responsivenessRating" integer,
    "professionalismRating" integer,
    "clarityRating" integer,
    "isSatisfied" boolean DEFAULT false NOT NULL,
    "isReported" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_resolution_feedbacks OWNER TO postgres;

--
-- Name: COLUMN dispute_resolution_feedbacks."staffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."staffId" IS 'Staff đã xử lý dispute';


--
-- Name: COLUMN dispute_resolution_feedbacks."userId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."userId" IS 'User đánh giá (raiser hoặc defendant)';


--
-- Name: COLUMN dispute_resolution_feedbacks."userRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."userRole" IS 'Role của user khi đánh giá';


--
-- Name: COLUMN dispute_resolution_feedbacks.rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks.rating IS 'Rating tổng thể (1-5 sao)';


--
-- Name: COLUMN dispute_resolution_feedbacks.comment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks.comment IS 'Nhận xét chi tiết (optional)';


--
-- Name: COLUMN dispute_resolution_feedbacks."fairnessRating"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."fairnessRating" IS 'Công bằng trong xử lý (1-5)';


--
-- Name: COLUMN dispute_resolution_feedbacks."responsivenessRating"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."responsivenessRating" IS 'Tốc độ phản hồi (1-5)';


--
-- Name: COLUMN dispute_resolution_feedbacks."professionalismRating"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."professionalismRating" IS 'Chuyên nghiệp (1-5)';


--
-- Name: COLUMN dispute_resolution_feedbacks."clarityRating"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."clarityRating" IS 'Giải thích rõ ràng (1-5)';


--
-- Name: COLUMN dispute_resolution_feedbacks."isSatisfied"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."isSatisfied" IS 'User có hài lòng với kết quả?';


--
-- Name: COLUMN dispute_resolution_feedbacks."isReported"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_resolution_feedbacks."isReported" IS 'Feedback bị report (spam/không hợp lệ)';


--
-- Name: dispute_schedule_proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_schedule_proposals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "startTime" timestamp with time zone NOT NULL,
    "endTime" timestamp with time zone NOT NULL,
    status public.dispute_schedule_proposals_status_enum DEFAULT 'ACTIVE'::public.dispute_schedule_proposals_status_enum NOT NULL,
    note text,
    "submittedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_schedule_proposals OWNER TO postgres;

--
-- Name: dispute_settlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_settlements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "proposerId" uuid NOT NULL,
    "proposerRole" character varying NOT NULL,
    "amountToFreelancer" numeric(15,2) NOT NULL,
    "amountToClient" numeric(15,2) NOT NULL,
    "platformFee" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    terms text,
    status public.dispute_settlements_status_enum DEFAULT 'PENDING'::public.dispute_settlements_status_enum NOT NULL,
    "responderId" uuid,
    "respondedAt" timestamp without time zone,
    "rejectedReason" text,
    "expiresAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_settlements OWNER TO postgres;

--
-- Name: COLUMN dispute_settlements."proposerId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."proposerId" IS 'Người đưa ra đề xuất hòa giải';


--
-- Name: COLUMN dispute_settlements."proposerRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."proposerRole" IS 'Role của người đề xuất';


--
-- Name: COLUMN dispute_settlements."amountToFreelancer"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."amountToFreelancer" IS 'Tiền chia cho Freelancer';


--
-- Name: COLUMN dispute_settlements."amountToClient"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."amountToClient" IS 'Tiền trả lại Client';


--
-- Name: COLUMN dispute_settlements."platformFee"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."platformFee" IS 'Phí platform (nếu có - tính từ amountToFreelancer)';


--
-- Name: COLUMN dispute_settlements.terms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements.terms IS 'Điều kiện/ghi chú kèm theo đề xuất';


--
-- Name: COLUMN dispute_settlements."responderId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."responderId" IS 'Người phản hồi (bên còn lại)';


--
-- Name: COLUMN dispute_settlements."rejectedReason"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."rejectedReason" IS 'Lý do từ chối (nếu rejected)';


--
-- Name: COLUMN dispute_settlements."expiresAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."expiresAt" IS 'Thời hạn phản hồi (24-48h)';


--
-- Name: COLUMN dispute_settlements."updatedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_settlements."updatedAt" IS 'Thời điểm chốt deal (Dùng để log Transaction)';


--
-- Name: dispute_skill_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_skill_requirements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "skillId" uuid NOT NULL,
    source public.dispute_skill_requirements_source_enum DEFAULT 'AUTO_DETECTED'::public.dispute_skill_requirements_source_enum NOT NULL,
    "requiredLevel" integer DEFAULT 1 NOT NULL,
    "isMandatory" boolean DEFAULT true NOT NULL,
    "addedById" uuid,
    notes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_skill_requirements OWNER TO postgres;

--
-- Name: COLUMN dispute_skill_requirements."skillId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_skill_requirements."skillId" IS 'Required audit skill';


--
-- Name: COLUMN dispute_skill_requirements.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_skill_requirements.source IS 'How was this skill requirement added?';


--
-- Name: COLUMN dispute_skill_requirements."requiredLevel"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_skill_requirements."requiredLevel" IS 'Required expertise level (1-5). Higher = need more expert staff';


--
-- Name: COLUMN dispute_skill_requirements."isMandatory"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_skill_requirements."isMandatory" IS 'Is this a mandatory requirement? false = nice-to-have';


--
-- Name: COLUMN dispute_skill_requirements."addedById"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_skill_requirements."addedById" IS 'Who added this requirement (if manual)';


--
-- Name: COLUMN dispute_skill_requirements.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_skill_requirements.notes IS 'Notes about why this skill is needed';


--
-- Name: dispute_verdicts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_verdicts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "adjudicatorId" uuid NOT NULL,
    "adjudicatorRole" character varying NOT NULL,
    "faultType" public.dispute_verdicts_faulttype_enum NOT NULL,
    "faultyParty" character varying NOT NULL,
    "amountToFreelancer" numeric(15,2) NOT NULL,
    "amountToClient" numeric(15,2) NOT NULL,
    "platformFee" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "trustScorePenalty" integer DEFAULT 0 NOT NULL,
    "isBanTriggered" boolean DEFAULT false NOT NULL,
    "banDurationDays" integer DEFAULT 0 NOT NULL,
    "warningMessage" text,
    tier integer DEFAULT 1 NOT NULL,
    "isAppealVerdict" boolean DEFAULT false NOT NULL,
    "overridesVerdictId" uuid,
    "issuedAt" timestamp without time zone DEFAULT now() NOT NULL,
    reasoning jsonb NOT NULL
);


ALTER TABLE public.dispute_verdicts OWNER TO postgres;

--
-- Name: COLUMN dispute_verdicts."adjudicatorId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."adjudicatorId" IS 'Staff/Admin ra phán quyết';


--
-- Name: COLUMN dispute_verdicts."adjudicatorRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."adjudicatorRole" IS 'Role của người phán quyết (STAFF/ADMIN)';


--
-- Name: COLUMN dispute_verdicts."faultType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."faultType" IS 'Lỗi thuộc về nhóm nào?';


--
-- Name: COLUMN dispute_verdicts."faultyParty"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."faultyParty" IS 'Bên bị xác định có lỗi chính (raiser/defendant/both/none)';


--
-- Name: COLUMN dispute_verdicts."amountToFreelancer"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."amountToFreelancer" IS 'Tiền chia cho Freelancer';


--
-- Name: COLUMN dispute_verdicts."amountToClient"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."amountToClient" IS 'Tiền trả lại Client';


--
-- Name: COLUMN dispute_verdicts."trustScorePenalty"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."trustScorePenalty" IS 'Điểm Trust Score bị trừ (0-100)';


--
-- Name: COLUMN dispute_verdicts."isBanTriggered"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."isBanTriggered" IS 'Cấm user này hoạt động tạm thời?';


--
-- Name: COLUMN dispute_verdicts."banDurationDays"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."banDurationDays" IS 'Số ngày bị cấm (nếu ban)';


--
-- Name: COLUMN dispute_verdicts."warningMessage"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."warningMessage" IS 'Cảnh cáo gửi cho bên có lỗi';


--
-- Name: COLUMN dispute_verdicts.tier; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts.tier IS 'Tier 1 = Staff, Tier 2 = Admin (Appeal)';


--
-- Name: COLUMN dispute_verdicts."isAppealVerdict"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."isAppealVerdict" IS 'TRUE = Đây là phán quyết override từ Admin';


--
-- Name: COLUMN dispute_verdicts."overridesVerdictId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."overridesVerdictId" IS 'Verdict ID bị override (nếu là appeal verdict)';


--
-- Name: COLUMN dispute_verdicts."issuedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts."issuedAt" IS 'Thời điểm ra phán quyết';


--
-- Name: COLUMN dispute_verdicts.reasoning; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_verdicts.reasoning IS 'Lý do phán quyết có cấu trúc (violatedPolicies, supportingEvidenceIds, factualFindings, legalAnalysis, conclusion)';


--
-- Name: dispute_view_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_view_states (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "lastViewedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.dispute_view_states OWNER TO postgres;

--
-- Name: disputes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.disputes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "projectId" uuid NOT NULL,
    reason text NOT NULL,
    status public.disputes_status_enum DEFAULT 'TRIAGE_PENDING'::public.disputes_status_enum NOT NULL,
    "resolvedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "raisedById" uuid NOT NULL,
    "defendantId" uuid NOT NULL,
    evidence jsonb,
    result public.disputes_result_enum DEFAULT 'PENDING'::public.disputes_result_enum NOT NULL,
    "adminComment" text,
    "resolvedById" uuid,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "raiserRole" public.disputes_raiserrole_enum,
    "defendantRole" public.disputes_defendantrole_enum,
    "disputeType" public.disputes_disputetype_enum,
    category public.disputes_category_enum,
    priority public.disputes_priority_enum DEFAULT 'MEDIUM'::public.disputes_priority_enum NOT NULL,
    "disputedAmount" numeric(15,2),
    "defendantResponse" text,
    "defendantEvidence" jsonb,
    "defendantRespondedAt" timestamp without time zone,
    "responseDeadline" timestamp without time zone,
    "resolutionDeadline" timestamp without time zone,
    "isOverdue" boolean DEFAULT false NOT NULL,
    "parentDisputeId" uuid,
    "isAppealed" boolean DEFAULT false NOT NULL,
    "appealReason" text,
    "appealedAt" timestamp without time zone,
    "appealResolution" text,
    "appealResolvedAt" timestamp without time zone,
    "milestoneId" uuid NOT NULL,
    messages text,
    "appealResolvedById" character varying,
    "assignedStaffId" uuid,
    "assignedAt" timestamp without time zone,
    "currentTier" integer DEFAULT 1 NOT NULL,
    "escalatedToAdminId" uuid,
    "escalatedAt" timestamp without time zone,
    "escalationReason" text,
    "acceptedSettlementId" character varying,
    "isAutoResolved" boolean DEFAULT false NOT NULL,
    "settlementAttempts" integer DEFAULT 0 NOT NULL,
    "appealDeadline" timestamp without time zone,
    "infoRequestReason" text,
    "infoRequestedById" character varying,
    "infoRequestedAt" timestamp without time zone,
    "infoProvidedAt" timestamp without time zone,
    "dismissalHoldUntil" timestamp without time zone,
    "rejectionAppealReason" text,
    "rejectionAppealedAt" timestamp without time zone,
    "rejectionAppealResolvedById" character varying,
    "rejectionAppealResolution" text,
    "rejectionAppealResolvedAt" timestamp without time zone,
    phase public.disputes_phase_enum DEFAULT 'PRESENTATION'::public.disputes_phase_enum NOT NULL,
    "triageReason" text,
    "triageActorId" character varying,
    "triageAt" timestamp without time zone,
    "triagePreviousStatus" character varying(50),
    "infoRequestDeadline" timestamp without time zone,
    "previewCompletedById" character varying,
    "previewCompletedAt" timestamp without time zone,
    "groupId" uuid
);


ALTER TABLE public.disputes OWNER TO postgres;

--
-- Name: COLUMN disputes."assignedStaffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."assignedStaffId" IS 'Staff được gán xử lý';


--
-- Name: COLUMN disputes."currentTier"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."currentTier" IS '1 = Staff xử lý, 2 = Admin phúc thẩm';


--
-- Name: COLUMN disputes."escalatedToAdminId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."escalatedToAdminId" IS 'Admin phúc thẩm (nếu escalate)';


--
-- Name: COLUMN disputes."escalationReason"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."escalationReason" IS 'Lý do escalate lên Admin';


--
-- Name: COLUMN disputes."acceptedSettlementId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."acceptedSettlementId" IS 'Settlement đã được accept (nếu có)';


--
-- Name: COLUMN disputes."isAutoResolved"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."isAutoResolved" IS 'TRUE = Auto-win do bị đơn không phản hồi';


--
-- Name: COLUMN disputes."settlementAttempts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."settlementAttempts" IS 'Số lần đề xuất hòa giải bị reject (max 3)';


--
-- Name: COLUMN disputes."appealDeadline"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes."appealDeadline" IS 'Hạn kháng cáo (3 ngày sau resolve)';


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "projectId" uuid NOT NULL,
    "uploaderId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    "fileUrl" character varying NOT NULL,
    type public.documents_type_enum NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    description text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: escrows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.escrows (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "projectId" uuid NOT NULL,
    "milestoneId" uuid NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL,
    "fundedAmount" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "releasedAmount" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "developerShare" numeric(15,2) NOT NULL,
    "brokerShare" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "platformFee" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "developerPercentage" numeric(5,2) DEFAULT '85'::numeric NOT NULL,
    "brokerPercentage" numeric(5,2) DEFAULT '10'::numeric NOT NULL,
    "platformPercentage" numeric(5,2) DEFAULT '5'::numeric NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    status public.escrows_status_enum DEFAULT 'PENDING'::public.escrows_status_enum NOT NULL,
    "fundedAt" timestamp without time zone,
    "releasedAt" timestamp without time zone,
    "refundedAt" timestamp without time zone,
    "clientApproved" boolean DEFAULT false NOT NULL,
    "clientApprovedAt" timestamp without time zone,
    "clientWalletId" uuid,
    "developerWalletId" uuid,
    "brokerWalletId" uuid,
    "holdTransactionId" uuid,
    "releaseTransactionIds" jsonb,
    "refundTransactionId" uuid,
    "disputeId" uuid,
    notes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.escrows OWNER TO postgres;

--
-- Name: event_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_participants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "eventId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role public.event_participants_role_enum NOT NULL,
    status public.event_participants_status_enum DEFAULT 'PENDING'::public.event_participants_status_enum NOT NULL,
    "responseDeadline" timestamp without time zone,
    "respondedAt" timestamp without time zone,
    "responseNote" text,
    "attendanceStatus" public.event_participants_attendancestatus_enum DEFAULT 'NOT_STARTED'::public.event_participants_attendancestatus_enum NOT NULL,
    "joinedAt" timestamp without time zone,
    "leftAt" timestamp without time zone,
    "isOnline" boolean DEFAULT false NOT NULL,
    "lateMinutes" integer,
    "excuseReason" text,
    "excuseApproved" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.event_participants OWNER TO postgres;

--
-- Name: COLUMN event_participants."responseDeadline"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_participants."responseDeadline" IS 'Hạn phản hồi lời mời';


--
-- Name: COLUMN event_participants."responseNote"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_participants."responseNote" IS 'Lý do từ chối/ghi chú';


--
-- Name: COLUMN event_participants."joinedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_participants."joinedAt" IS 'Thời điểm vào event';


--
-- Name: COLUMN event_participants."leftAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_participants."leftAt" IS 'Thời điểm rời event';


--
-- Name: COLUMN event_participants."lateMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_participants."lateMinutes" IS 'Số phút trễ (nếu LATE)';


--
-- Name: event_reschedule_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_reschedule_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "eventId" uuid NOT NULL,
    "requesterId" uuid NOT NULL,
    reason text NOT NULL,
    "proposedTimeSlots" jsonb,
    "useAutoSchedule" boolean DEFAULT false NOT NULL,
    status public.event_reschedule_requests_status_enum DEFAULT 'PENDING'::public.event_reschedule_requests_status_enum NOT NULL,
    "processedById" uuid,
    "processedAt" timestamp without time zone,
    "processNote" text,
    "newEventId" uuid,
    "selectedNewStartTime" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.event_reschedule_requests OWNER TO postgres;

--
-- Name: COLUMN event_reschedule_requests."requesterId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."requesterId" IS 'Người yêu cầu dời lịch';


--
-- Name: COLUMN event_reschedule_requests.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests.reason IS 'Lý do xin dời lịch';


--
-- Name: COLUMN event_reschedule_requests."proposedTimeSlots"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."proposedTimeSlots" IS 'Các khung giờ user đề xuất (tối đa 3)';


--
-- Name: COLUMN event_reschedule_requests."useAutoSchedule"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."useAutoSchedule" IS 'TRUE = Để hệ thống tự tìm giờ phù hợp';


--
-- Name: COLUMN event_reschedule_requests."processedById"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."processedById" IS 'Staff/Admin xử lý';


--
-- Name: COLUMN event_reschedule_requests."processNote"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."processNote" IS 'Ghi chú khi approve/reject';


--
-- Name: COLUMN event_reschedule_requests."newEventId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."newEventId" IS 'Event mới được tạo (nếu approved)';


--
-- Name: COLUMN event_reschedule_requests."selectedNewStartTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.event_reschedule_requests."selectedNewStartTime" IS 'Thời gian mới được chọn';


--
-- Name: fee_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fee_configs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "feeType" public.fee_configs_feetype_enum NOT NULL,
    percentage numeric(5,2) NOT NULL,
    "minAmount" numeric(15,2),
    "maxAmount" numeric(15,2),
    description character varying(255),
    "isActive" boolean DEFAULT true NOT NULL,
    "effectiveFrom" timestamp without time zone,
    "effectiveTo" timestamp without time zone,
    "updatedBy" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fee_configs OWNER TO postgres;

--
-- Name: hearing_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hearing_participants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "hearingId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role public.hearing_participants_role_enum NOT NULL,
    "invitedAt" timestamp without time zone,
    "confirmedAt" timestamp without time zone,
    "joinedAt" timestamp without time zone,
    "leftAt" timestamp without time zone,
    "isOnline" boolean DEFAULT false NOT NULL,
    "hasSubmittedStatement" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "isRequired" boolean DEFAULT false NOT NULL,
    "responseDeadline" timestamp without time zone,
    "declineReason" text,
    "lastOnlineAt" timestamp without time zone,
    "totalOnlineMinutes" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.hearing_participants OWNER TO postgres;

--
-- Name: COLUMN hearing_participants."isRequired"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hearing_participants."isRequired" IS 'Bắt buộc tham gia (Nguyên đơn, Bị đơn = true)';


--
-- Name: COLUMN hearing_participants."responseDeadline"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hearing_participants."responseDeadline" IS 'Hạn phản hồi lời mời';


--
-- Name: COLUMN hearing_participants."declineReason"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hearing_participants."declineReason" IS 'Lý do từ chối/xin dời';


--
-- Name: COLUMN hearing_participants."lastOnlineAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hearing_participants."lastOnlineAt" IS 'Lần online gần nhất';


--
-- Name: COLUMN hearing_participants."totalOnlineMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.hearing_participants."totalOnlineMinutes" IS 'Tổng phút online trong phiên';


--
-- Name: hearing_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hearing_questions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "hearingId" uuid NOT NULL,
    "askedById" uuid NOT NULL,
    "targetUserId" uuid NOT NULL,
    question text NOT NULL,
    answer text,
    "answeredAt" timestamp without time zone,
    deadline timestamp without time zone,
    "isRequired" boolean DEFAULT false NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    status public.hearing_questions_status_enum DEFAULT 'PENDING_ANSWER'::public.hearing_questions_status_enum NOT NULL,
    "cancelledAt" timestamp without time zone,
    "cancelledById" uuid
);


ALTER TABLE public.hearing_questions OWNER TO postgres;

--
-- Name: hearing_reminder_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hearing_reminder_deliveries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "hearingId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "reminderType" public.hearing_reminder_deliveries_remindertype_enum NOT NULL,
    "scheduledFor" timestamp without time zone NOT NULL,
    "notificationId" uuid,
    "emailSent" boolean DEFAULT false NOT NULL,
    "emailSentAt" timestamp without time zone,
    "deliveredAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hearing_reminder_deliveries OWNER TO postgres;

--
-- Name: hearing_statements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hearing_statements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "hearingId" uuid NOT NULL,
    "participantId" uuid NOT NULL,
    type public.hearing_statements_type_enum NOT NULL,
    content text NOT NULL,
    attachments jsonb,
    "replyToStatementId" uuid,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "isRedacted" boolean DEFAULT false NOT NULL,
    "redactedReason" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    title character varying(255),
    status public.hearing_statements_status_enum DEFAULT 'DRAFT'::public.hearing_statements_status_enum NOT NULL,
    "retractionOfStatementId" uuid
);


ALTER TABLE public.hearing_statements OWNER TO postgres;

--
-- Name: kv_store_34447448; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kv_store_34447448 (
    key text NOT NULL,
    value jsonb NOT NULL
);


ALTER TABLE public.kv_store_34447448 OWNER TO postgres;

--
-- Name: kyc_access_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_access_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "kycId" uuid NOT NULL,
    "reviewerId" uuid NOT NULL,
    "reviewerEmail" character varying(100) NOT NULL,
    "reviewerRole" character varying(50) NOT NULL,
    action public.kyc_access_logs_action_enum NOT NULL,
    reason public.kyc_access_logs_reason_enum,
    "reasonDetails" text,
    "ipAddress" character varying(45) NOT NULL,
    "userAgent" character varying(255),
    "sessionId" character varying(100),
    "accessedImages" text,
    "watermarkApplied" boolean DEFAULT true NOT NULL,
    "watermarkId" character varying(100),
    "viewDurationSeconds" integer,
    "flaggedAsSuspicious" boolean DEFAULT false NOT NULL,
    "suspiciousReason" text,
    "legalHold" boolean DEFAULT false NOT NULL,
    "accessExpiresAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.kyc_access_logs OWNER TO postgres;

--
-- Name: COLUMN kyc_access_logs."accessedImages"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.kyc_access_logs."accessedImages" IS 'Comma-separated list of accessed images';


--
-- Name: COLUMN kyc_access_logs."legalHold"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.kyc_access_logs."legalHold" IS 'If true, this log cannot be deleted';


--
-- Name: kyc_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_verifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "fullNameOnDocument" character varying(255) NOT NULL,
    "documentNumber" character varying(20) NOT NULL,
    "documentType" public.kyc_verifications_documenttype_enum DEFAULT 'CCCD'::public.kyc_verifications_documenttype_enum NOT NULL,
    "dateOfBirth" date,
    "documentExpiryDate" date,
    "documentFrontUrl" character varying(500) NOT NULL,
    "documentBackUrl" character varying(500) NOT NULL,
    "selfieUrl" character varying(500) NOT NULL,
    status public.kyc_verifications_status_enum DEFAULT 'PENDING'::public.kyc_verifications_status_enum NOT NULL,
    "rejectionReason" text,
    "reviewedBy" uuid,
    "reviewedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kyc_verifications OWNER TO postgres;

--
-- Name: legal_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.legal_signatures (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "disputeId" uuid NOT NULL,
    "signerId" uuid NOT NULL,
    "signerRole" character varying NOT NULL,
    "actionType" public.legal_signatures_actiontype_enum NOT NULL,
    "termsContentSnapshot" text NOT NULL,
    "termsVersion" character varying(10) NOT NULL,
    "referenceType" character varying,
    "referenceId" character varying,
    "ipAddress" character varying(45) NOT NULL,
    "userAgent" text NOT NULL,
    "deviceFingerprint" character varying(64),
    "signedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.legal_signatures OWNER TO postgres;

--
-- Name: COLUMN legal_signatures."signerRole"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."signerRole" IS 'Role lúc ký';


--
-- Name: COLUMN legal_signatures."termsContentSnapshot"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."termsContentSnapshot" IS 'Snapshot nội dung điều khoản User đã đọc lúc bấm nút';


--
-- Name: COLUMN legal_signatures."termsVersion"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."termsVersion" IS 'Version của điều khoản';


--
-- Name: COLUMN legal_signatures."ipAddress"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."ipAddress" IS 'IP Address của User lúc ký';


--
-- Name: COLUMN legal_signatures."userAgent"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."userAgent" IS 'Trình duyệt/Thiết bị lúc ký';


--
-- Name: COLUMN legal_signatures."deviceFingerprint"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."deviceFingerprint" IS 'Browser fingerprint hash (optional)';


--
-- Name: COLUMN legal_signatures."signedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.legal_signatures."signedAt" IS 'Thời điểm pháp lý có hiệu lực (Immutable)';


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: milestone_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.milestone_payments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "milestoneId" uuid NOT NULL,
    "holdTransactionId" uuid,
    "releaseTransactionId" uuid
);


ALTER TABLE public.milestone_payments OWNER TO postgres;

--
-- Name: milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.milestones (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "projectId" uuid,
    title character varying(255) NOT NULL,
    description text,
    amount numeric(14,2) NOT NULL,
    "startDate" timestamp without time zone,
    "dueDate" timestamp without time zone,
    status public.milestones_status_enum DEFAULT 'PENDING'::public.milestones_status_enum NOT NULL,
    "proofOfWork" character varying,
    feedback text,
    "sortOrder" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "projectSpecId" uuid,
    "deliverableType" public.milestones_deliverabletype_enum DEFAULT 'OTHER'::public.milestones_deliverabletype_enum NOT NULL,
    "retentionAmount" numeric(14,2) DEFAULT 0,
    "acceptanceCriteria" jsonb,
    "videoDemoUrl" character varying(500),
    "submittedAt" timestamp without time zone
);


ALTER TABLE public.milestones OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp without time zone,
    "relatedType" character varying,
    "relatedId" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: payout_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payout_methods (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "bankName" character varying(100) NOT NULL,
    "bankCode" character varying(20),
    "accountNumber" character varying(30) NOT NULL,
    "accountHolderName" character varying(255) NOT NULL,
    "branchName" character varying(100),
    "isDefault" boolean DEFAULT false NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payout_methods OWNER TO postgres;

--
-- Name: payout_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payout_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "walletId" uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    status public.payout_requests_status_enum DEFAULT 'PENDING'::public.payout_requests_status_enum NOT NULL,
    "requestedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "processedAt" timestamp without time zone,
    "processedBy" uuid,
    note text,
    "payoutMethodId" uuid NOT NULL,
    fee numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "netAmount" numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "approvedAt" timestamp without time zone,
    "approvedBy" uuid,
    "rejectedAt" timestamp without time zone,
    "rejectedBy" character varying,
    "rejectionReason" text,
    "externalReference" character varying,
    "transactionId" uuid,
    "adminNote" text,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payout_requests OWNER TO postgres;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_settings (
    key character varying NOT NULL,
    value jsonb NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedBy" uuid
);


ALTER TABLE public.platform_settings OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    bio text,
    "companyName" character varying(255),
    skills text[],
    "portfolioLinks" jsonb,
    "bankInfo" jsonb,
    "avatarUrl" text,
    "linkedinUrl" text,
    "cvUrl" text
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: project_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_categories OWNER TO postgres;

--
-- Name: project_category_map; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_category_map (
    project_id uuid NOT NULL,
    category_id uuid NOT NULL
);


ALTER TABLE public.project_category_map OWNER TO postgres;

--
-- Name: project_request_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_request_answers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "requestId" uuid NOT NULL,
    "valueText" text,
    "questionId" integer NOT NULL,
    "optionId" integer
);


ALTER TABLE public.project_request_answers OWNER TO postgres;

--
-- Name: project_request_proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_request_proposals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "requestId" uuid NOT NULL,
    "freelancerId" uuid NOT NULL,
    "brokerId" uuid,
    "proposedBudget" numeric(15,2),
    "estimatedDuration" character varying,
    "coverLetter" text,
    status character varying DEFAULT 'PENDING'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_request_proposals OWNER TO postgres;

--
-- Name: project_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "clientId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    "budgetRange" character varying,
    "intendedTimeline" character varying,
    "techPreferences" character varying,
    status public.project_requests_status_enum DEFAULT 'PENDING'::public.project_requests_status_enum NOT NULL,
    "brokerId" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_requests OWNER TO postgres;

--
-- Name: project_spec_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_spec_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "specId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "signerRole" character varying(32) NOT NULL,
    "signedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_spec_signatures OWNER TO postgres;

--
-- Name: project_specs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_specs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "requestId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    "totalBudget" numeric(14,2) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    status public.project_specs_status_enum DEFAULT 'DRAFT'::public.project_specs_status_enum NOT NULL,
    features jsonb,
    "techStack" character varying(500),
    "referenceLinks" jsonb,
    "rejectionReason" text,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "specPhase" public.spec_phase_enum DEFAULT 'FULL_SPEC'::public.spec_phase_enum,
    "parentSpecId" uuid,
    "clientFeatures" jsonb,
    "estimatedTimeline" character varying(255),
    "projectCategory" character varying(120),
    "clientApprovedAt" timestamp without time zone,
    "richContentJson" jsonb
);


ALTER TABLE public.project_specs OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "requestId" uuid,
    "clientId" uuid NOT NULL,
    "brokerId" uuid NOT NULL,
    "freelancerId" uuid,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    "totalBudget" numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    "pricingModel" public.projects_pricingmodel_enum,
    "startDate" timestamp without time zone,
    "endDate" timestamp without time zone,
    status public.projects_status_enum DEFAULT 'PLANNING'::public.projects_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reporter_id uuid NOT NULL,
    review_id uuid NOT NULL,
    reason public.reports_reason_enum NOT NULL,
    description text,
    status public.reports_status_enum DEFAULT 'PENDING'::public.reports_status_enum NOT NULL,
    resolved_by uuid,
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "projectId" uuid NOT NULL,
    "reviewerId" uuid NOT NULL,
    "targetUserId" uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    weight numeric(3,2) DEFAULT '1'::numeric NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    delete_reason text
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: saved_freelancers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saved_freelancers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "clientId" uuid NOT NULL,
    "freelancerId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.saved_freelancers OWNER TO postgres;

--
-- Name: skill_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skill_domains (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    "wizardMapping" jsonb,
    "matchingWeight" integer DEFAULT 30 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skill_domains OWNER TO postgres;

--
-- Name: COLUMN skill_domains.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains.name IS 'Display name (e.g., "E-commerce")';


--
-- Name: COLUMN skill_domains.slug; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains.slug IS 'URL-friendly slug (e.g., "e-commerce")';


--
-- Name: COLUMN skill_domains.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains.description IS 'Description of the domain';


--
-- Name: COLUMN skill_domains.icon; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains.icon IS 'Icon name (e.g., "shopping-cart")';


--
-- Name: COLUMN skill_domains."wizardMapping"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains."wizardMapping" IS 'Mapping from wizard answers to auto-tag. E.g., {"Q1": ["A", "B"]} → client answers these → auto-tag';


--
-- Name: COLUMN skill_domains."matchingWeight"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains."matchingWeight" IS 'Weight for matching algorithm (default 30% for domain matching)';


--
-- Name: COLUMN skill_domains."isActive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains."isActive" IS 'Is this domain active for selection?';


--
-- Name: COLUMN skill_domains."sortOrder"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_domains."sortOrder" IS 'Display order in UI';


--
-- Name: skill_mapping_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skill_mapping_rules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "entityType" character varying(50) NOT NULL,
    "entityValue" character varying(100) NOT NULL,
    "skillId" uuid NOT NULL,
    "requiredLevel" integer DEFAULT 1 NOT NULL,
    "isMandatory" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skill_mapping_rules OWNER TO postgres;

--
-- Name: COLUMN skill_mapping_rules."entityType"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_mapping_rules."entityType" IS 'Entity type to map from. E.g., "DISPUTE_CATEGORY", "WIZARD_ANSWER"';


--
-- Name: COLUMN skill_mapping_rules."entityValue"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_mapping_rules."entityValue" IS 'Entity value to match. E.g., "FRAUD", "PAYMENT"';


--
-- Name: COLUMN skill_mapping_rules."skillId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_mapping_rules."skillId" IS 'Skill to auto-assign when matched';


--
-- Name: COLUMN skill_mapping_rules."requiredLevel"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_mapping_rules."requiredLevel" IS 'Minimum required expertise level for auto-assignment';


--
-- Name: COLUMN skill_mapping_rules."isMandatory"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_mapping_rules."isMandatory" IS 'Is this a mandatory skill when rule matches?';


--
-- Name: COLUMN skill_mapping_rules.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skill_mapping_rules.priority IS 'Priority when multiple rules match';


--
-- Name: skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skills (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "domainId" uuid,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    category public.skills_category_enum DEFAULT 'OTHER'::public.skills_category_enum NOT NULL,
    aliases text,
    "forFreelancer" boolean DEFAULT true NOT NULL,
    "forBroker" boolean DEFAULT false NOT NULL,
    "forStaff" boolean DEFAULT false NOT NULL,
    "matchingWeight" integer DEFAULT 70 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skills OWNER TO postgres;

--
-- Name: COLUMN skills."domainId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."domainId" IS 'Parent domain (Layer 1)';


--
-- Name: COLUMN skills.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills.name IS 'Display name (e.g., "ReactJS")';


--
-- Name: COLUMN skills.slug; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills.slug IS 'URL-friendly slug (e.g., "reactjs")';


--
-- Name: COLUMN skills.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills.description IS 'Description of the skill';


--
-- Name: COLUMN skills.icon; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills.icon IS 'Icon name or URL';


--
-- Name: COLUMN skills.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills.category IS 'Skill category for filtering';


--
-- Name: COLUMN skills.aliases; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills.aliases IS 'Alternative names/aliases for search. E.g., ["React", "React.js"]';


--
-- Name: COLUMN skills."forFreelancer"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."forFreelancer" IS 'Can Freelancers select this skill?';


--
-- Name: COLUMN skills."forBroker"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."forBroker" IS 'Can Brokers select this skill?';


--
-- Name: COLUMN skills."forStaff"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."forStaff" IS 'Is this an audit skill for Staff?';


--
-- Name: COLUMN skills."matchingWeight"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."matchingWeight" IS 'Weight for matching algorithm (default 70% for skill matching)';


--
-- Name: COLUMN skills."isActive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."isActive" IS 'Is this skill active for selection?';


--
-- Name: COLUMN skills."sortOrder"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.skills."sortOrder" IS 'Display order in UI';


--
-- Name: social_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_accounts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    provider character varying(50) NOT NULL,
    "providerId" character varying(255) NOT NULL,
    email character varying(255),
    "avatarUrl" text,
    payload jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.social_accounts OWNER TO postgres;

--
-- Name: staff_expertise; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_expertise (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "staffId" uuid NOT NULL,
    "skillId" uuid NOT NULL,
    "expertiseLevel" integer DEFAULT 1 NOT NULL,
    "certificationName" character varying(255),
    "certificationExpiry" date,
    "disputesHandled" integer DEFAULT 0 NOT NULL,
    "successRate" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_expertise OWNER TO postgres;

--
-- Name: COLUMN staff_expertise."staffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."staffId" IS 'Staff user ID';


--
-- Name: COLUMN staff_expertise."skillId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."skillId" IS 'Skill (should have forStaff=true)';


--
-- Name: COLUMN staff_expertise."expertiseLevel"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."expertiseLevel" IS 'Expertise level 1-5 (affects assignment priority)';


--
-- Name: COLUMN staff_expertise."certificationName"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."certificationName" IS 'Certification name if any';


--
-- Name: COLUMN staff_expertise."certificationExpiry"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."certificationExpiry" IS 'Certification expiry date';


--
-- Name: COLUMN staff_expertise."disputesHandled"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."disputesHandled" IS 'Disputes handled with this expertise';


--
-- Name: COLUMN staff_expertise."successRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."successRate" IS 'Success rate % for disputes in this area';


--
-- Name: COLUMN staff_expertise."isActive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_expertise."isActive" IS 'Is this expertise active?';


--
-- Name: staff_leave_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_leave_policies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "staffId" uuid NOT NULL,
    "monthlyAllowanceMinutes" integer DEFAULT 480 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_leave_policies OWNER TO postgres;

--
-- Name: COLUMN staff_leave_policies."staffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_policies."staffId" IS 'User co role = STAFF';


--
-- Name: COLUMN staff_leave_policies."monthlyAllowanceMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_policies."monthlyAllowanceMinutes" IS 'T?ng s? phut ngh? phep m?i thang (default 480 = 1 ngay)';


--
-- Name: staff_leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_leave_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "staffId" uuid NOT NULL,
    type public.staff_leave_requests_type_enum NOT NULL,
    status public.staff_leave_requests_status_enum DEFAULT 'PENDING'::public.staff_leave_requests_status_enum NOT NULL,
    "startTime" timestamp with time zone NOT NULL,
    "endTime" timestamp with time zone NOT NULL,
    "durationMinutes" integer DEFAULT 0 NOT NULL,
    reason text,
    "isAutoApproved" boolean DEFAULT false NOT NULL,
    "processedById" uuid,
    "processedAt" timestamp with time zone,
    "processedNote" text,
    "cancelledById" uuid,
    "cancelledAt" timestamp with time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_leave_requests OWNER TO postgres;

--
-- Name: COLUMN staff_leave_requests."staffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_requests."staffId" IS 'User co role = STAFF';


--
-- Name: COLUMN staff_leave_requests."startTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_requests."startTime" IS 'Th?i gian b?t ??u ngh? phep';


--
-- Name: COLUMN staff_leave_requests."endTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_requests."endTime" IS 'Th?i gian k?t thuc ngh? phep';


--
-- Name: COLUMN staff_leave_requests."durationMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_requests."durationMinutes" IS 'T?ng s? phut ngh? (trong gi? lam vi?c)';


--
-- Name: COLUMN staff_leave_requests."isAutoApproved"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_leave_requests."isAutoApproved" IS 'TRUE = T? ??ng duy?t (short-term)';


--
-- Name: staff_performances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_performances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "staffId" uuid NOT NULL,
    period character varying(7) NOT NULL,
    "totalDisputesAssigned" integer DEFAULT 0 NOT NULL,
    "totalDisputesResolved" integer DEFAULT 0 NOT NULL,
    "totalDisputesPending" integer DEFAULT 0 NOT NULL,
    "totalAppealed" integer DEFAULT 0 NOT NULL,
    "totalOverturnedByAdmin" integer DEFAULT 0 NOT NULL,
    "appealRate" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "overturnRate" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "avgResolutionTimeHours" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "avgUserRating" numeric(3,2),
    "totalUserRatings" integer DEFAULT 0 NOT NULL,
    "totalHearingsConducted" integer DEFAULT 0 NOT NULL,
    "totalHearingsRescheduled" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "pendingAppealCases" integer DEFAULT 0 NOT NULL,
    "totalCasesFinalized" integer DEFAULT 0 NOT NULL,
    "totalLeaveMinutes" integer DEFAULT 0 NOT NULL,
    "leaveRequestCount" integer DEFAULT 0 NOT NULL,
    "leaveOverageMinutes" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.staff_performances OWNER TO postgres;

--
-- Name: COLUMN staff_performances."staffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."staffId" IS 'User có role = STAFF';


--
-- Name: COLUMN staff_performances.period; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances.period IS 'YYYY-MM (e.g., 2026-01) hoặc YYYY-QX';


--
-- Name: COLUMN staff_performances."totalDisputesAssigned"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalDisputesAssigned" IS 'Số vụ được gán trong kỳ';


--
-- Name: COLUMN staff_performances."totalDisputesResolved"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalDisputesResolved" IS 'Số vụ đã xử lý xong';


--
-- Name: COLUMN staff_performances."totalDisputesPending"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalDisputesPending" IS 'Số vụ đang pending';


--
-- Name: COLUMN staff_performances."totalAppealed"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalAppealed" IS 'Số vụ bị kháng cáo';


--
-- Name: COLUMN staff_performances."totalOverturnedByAdmin"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalOverturnedByAdmin" IS 'Số vụ bị Admin đảo ngược quyết định';


--
-- Name: COLUMN staff_performances."appealRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."appealRate" IS '% bị appeal = totalAppealed/totalResolved * 100';


--
-- Name: COLUMN staff_performances."overturnRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."overturnRate" IS '% bị đảo = totalOverturned/totalAppealed * 100';


--
-- Name: COLUMN staff_performances."avgResolutionTimeHours"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."avgResolutionTimeHours" IS 'Thời gian xử lý trung bình (giờ)';


--
-- Name: COLUMN staff_performances."avgUserRating"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."avgUserRating" IS 'Rating trung bình từ user (1.00-5.00)';


--
-- Name: COLUMN staff_performances."totalUserRatings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalUserRatings" IS 'Số lượt rating từ user';


--
-- Name: COLUMN staff_performances."totalHearingsConducted"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalHearingsConducted" IS 'Số phiên điều trần đã chủ trì';


--
-- Name: COLUMN staff_performances."totalHearingsRescheduled"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalHearingsRescheduled" IS 'Số phiên bị reschedule (do Staff)';


--
-- Name: COLUMN staff_performances."pendingAppealCases"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."pendingAppealCases" IS 'Số case đang IN_APPEAL chưa đóng (loại khỏi calculation)';


--
-- Name: COLUMN staff_performances."totalCasesFinalized"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalCasesFinalized" IS 'Số case đã finalized (used for accurate calculation)';


--
-- Name: COLUMN staff_performances."totalLeaveMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."totalLeaveMinutes" IS 'Tổng số phút nghỉ phép trong kỳ (giờ làm việc)';


--
-- Name: COLUMN staff_performances."leaveRequestCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."leaveRequestCount" IS 'Số lượt nghỉ phép trong kỳ';


--
-- Name: COLUMN staff_performances."leaveOverageMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_performances."leaveOverageMinutes" IS 'Số phút nghỉ vượt quota trong kỳ';


--
-- Name: staff_workloads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_workloads (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "staffId" uuid NOT NULL,
    date date NOT NULL,
    "totalEventsScheduled" integer DEFAULT 0 NOT NULL,
    "totalDisputesPending" integer DEFAULT 0 NOT NULL,
    "scheduledMinutes" integer DEFAULT 0 NOT NULL,
    "dailyCapacityMinutes" integer DEFAULT 480 NOT NULL,
    "utilizationRate" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "isOverloaded" boolean DEFAULT false NOT NULL,
    "canAcceptNewEvent" boolean DEFAULT true NOT NULL,
    "isOnLeave" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.staff_workloads OWNER TO postgres;

--
-- Name: COLUMN staff_workloads."staffId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."staffId" IS 'User có role = STAFF';


--
-- Name: COLUMN staff_workloads.date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads.date IS 'Ngày tính workload';


--
-- Name: COLUMN staff_workloads."totalEventsScheduled"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."totalEventsScheduled" IS 'Số event đã lên lịch trong ngày';


--
-- Name: COLUMN staff_workloads."totalDisputesPending"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."totalDisputesPending" IS 'Số dispute đang xử lý (tổng thể - chưa resolve)';


--
-- Name: COLUMN staff_workloads."scheduledMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."scheduledMinutes" IS 'Tổng số phút đã book trong ngày';


--
-- Name: COLUMN staff_workloads."dailyCapacityMinutes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."dailyCapacityMinutes" IS 'Sức chứa tối đa (default 8h = 480 phút)';


--
-- Name: COLUMN staff_workloads."utilizationRate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."utilizationRate" IS '= scheduledMinutes / dailyCapacityMinutes * 100';


--
-- Name: COLUMN staff_workloads."isOverloaded"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."isOverloaded" IS 'TRUE = utilizationRate > 90%';


--
-- Name: COLUMN staff_workloads."canAcceptNewEvent"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."canAcceptNewEvent" IS 'TRUE = có thể nhận thêm việc (utilizationRate < 80%)';


--
-- Name: COLUMN staff_workloads."isOnLeave"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_workloads."isOnLeave" IS 'TRUE = Staff đánh dấu nghỉ ngày này';


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "taskId" uuid NOT NULL,
    "uploaderId" uuid NOT NULL,
    url text NOT NULL,
    "fileName" character varying(255) DEFAULT 'attachment'::character varying NOT NULL,
    "fileType" character varying(50) DEFAULT 'image'::character varying NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_attachments OWNER TO postgres;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "taskId" uuid NOT NULL,
    "actorId" uuid NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_comments OWNER TO postgres;

--
-- Name: task_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "taskId" uuid NOT NULL,
    "actorId" uuid,
    "fieldChanged" character varying(50) NOT NULL,
    "oldValue" text,
    "newValue" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_history OWNER TO postgres;

--
-- Name: task_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_links (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "taskId" uuid NOT NULL,
    url text NOT NULL,
    title character varying(255),
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_links OWNER TO postgres;

--
-- Name: task_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_submissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    content text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer NOT NULL,
    status public.task_submissions_status_enum DEFAULT 'PENDING'::public.task_submissions_status_enum NOT NULL,
    "submitterId" uuid NOT NULL,
    "taskId" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "reviewNote" text,
    "reviewerId" uuid,
    "reviewedAt" timestamp with time zone
);


ALTER TABLE public.task_submissions OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "milestoneId" uuid NOT NULL,
    "projectId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status public.tasks_status_enum DEFAULT 'TODO'::public.tasks_status_enum NOT NULL,
    "assignedTo" uuid,
    "dueDate" timestamp without time zone,
    "sortOrder" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    submission_note text,
    proof_link character varying(500),
    submitted_at timestamp without time zone,
    "reporterId" uuid,
    priority public.tasks_priority_enum DEFAULT 'MEDIUM'::public.tasks_priority_enum NOT NULL,
    "storyPoints" integer,
    "startDate" timestamp without time zone,
    labels text,
    "parentTaskId" uuid
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "walletId" uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    type public.transactions_type_enum NOT NULL,
    status public.transactions_status_enum DEFAULT 'PENDING'::public.transactions_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    fee numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "netAmount" numeric(15,2),
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "paymentMethod" character varying(50),
    "externalTransactionId" character varying,
    metadata jsonb,
    description text,
    "failureReason" text,
    "balanceAfter" numeric(15,2),
    "initiatedBy" character varying(50),
    "ipAddress" character varying(45),
    "relatedTransactionId" uuid,
    "completedAt" timestamp without time zone,
    "referenceType" character varying(50),
    "referenceId" uuid
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: trust_score_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trust_score_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "ratingScore" numeric(3,2),
    "behaviorScore" numeric(3,2),
    "disputeScore" numeric(3,2),
    "verificationScore" numeric(3,2),
    "totalScore" numeric(3,2),
    "calculatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.trust_score_history OWNER TO postgres;

--
-- Name: user_availabilities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_availabilities (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "startTime" timestamp with time zone,
    "endTime" timestamp with time zone,
    type public.user_availabilities_type_enum NOT NULL,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "dayOfWeek" integer,
    "recurringStartTime" time without time zone,
    "recurringEndTime" time without time zone,
    "recurringStartDate" date,
    "recurringEndDate" date,
    "isAutoGenerated" boolean DEFAULT false NOT NULL,
    "linkedEventId" uuid,
    note text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "linkedLeaveRequestId" uuid
);


ALTER TABLE public.user_availabilities OWNER TO postgres;

--
-- Name: COLUMN user_availabilities."startTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."startTime" IS 'Thời gian bắt đầu (cho one-time)';


--
-- Name: COLUMN user_availabilities."endTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."endTime" IS 'Thời gian kết thúc (cho one-time)';


--
-- Name: COLUMN user_availabilities."dayOfWeek"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."dayOfWeek" IS 'Ngày trong tuần (0=CN, 1=T2, 2=T3...)';


--
-- Name: COLUMN user_availabilities."recurringStartTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."recurringStartTime" IS 'GiềEbắt đầu recurring (08:00)';


--
-- Name: COLUMN user_availabilities."recurringEndTime"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."recurringEndTime" IS 'GiềEkết thúc recurring (17:00)';


--
-- Name: COLUMN user_availabilities."recurringStartDate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."recurringStartDate" IS 'Ngày bắt đầu hiệu lực của recurring';


--
-- Name: COLUMN user_availabilities."recurringEndDate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."recurringEndDate" IS 'Ngày kết thúc hiệu lực (null = vĩnh viềE)';


--
-- Name: COLUMN user_availabilities."isAutoGenerated"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."isAutoGenerated" IS 'TRUE = Tự động tạo từ CalendarEvent';


--
-- Name: COLUMN user_availabilities."linkedEventId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."linkedEventId" IS 'CalendarEvent đã tạo availability này';


--
-- Name: COLUMN user_availabilities.note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities.note IS 'Ghi chú (Họp nội bềE NghềEphép...)';


--
-- Name: COLUMN user_availabilities."linkedLeaveRequestId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_availabilities."linkedLeaveRequestId" IS 'LeaveRequest created this availability';


--
-- Name: user_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_flags (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    type character varying(100) NOT NULL,
    severity integer DEFAULT 1 NOT NULL,
    description text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    status public.user_flags_status_enum DEFAULT 'ACTIVE'::public.user_flags_status_enum NOT NULL,
    metadata jsonb,
    "isAutoGenerated" boolean DEFAULT false NOT NULL,
    "adminNote" text,
    resolution text,
    "createdById" uuid,
    "resolvedById" uuid,
    "resolvedAt" timestamp without time zone,
    "appealReason" text,
    "appealEvidence" jsonb,
    "appealedAt" timestamp without time zone,
    "appealResolution" text,
    "appealResolvedById" uuid,
    "appealResolvedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_flags OWNER TO postgres;

--
-- Name: user_skill_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_skill_domains (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "domainId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_skill_domains OWNER TO postgres;

--
-- Name: user_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_skills (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "skillId" uuid NOT NULL,
    priority public.user_skills_priority_enum DEFAULT 'SECONDARY'::public.user_skills_priority_enum NOT NULL,
    "verificationStatus" public.user_skills_verificationstatus_enum DEFAULT 'SELF_DECLARED'::public.user_skills_verificationstatus_enum NOT NULL,
    "portfolioUrl" text,
    "completedProjectsCount" integer DEFAULT 0 NOT NULL,
    "lastUsedAt" timestamp without time zone,
    "proficiencyLevel" integer,
    "yearsOfExperience" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_skills OWNER TO postgres;

--
-- Name: COLUMN user_skills.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills.priority IS 'PRIMARY = main strength, SECONDARY = additional skill';


--
-- Name: COLUMN user_skills."verificationStatus"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills."verificationStatus" IS 'How was this skill verified?';


--
-- Name: COLUMN user_skills."portfolioUrl"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills."portfolioUrl" IS 'Link to portfolio or proof';


--
-- Name: COLUMN user_skills."completedProjectsCount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills."completedProjectsCount" IS 'Number of completed projects using this skill';


--
-- Name: COLUMN user_skills."lastUsedAt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills."lastUsedAt" IS 'When last used in a completed project';


--
-- Name: COLUMN user_skills."proficiencyLevel"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills."proficiencyLevel" IS 'Self-rated proficiency 1-10 (optional, for future)';


--
-- Name: COLUMN user_skills."yearsOfExperience"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_skills."yearsOfExperience" IS 'Years of experience with this skill';


--
-- Name: user_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tokens (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    type public.user_tokens_type_enum NOT NULL,
    "tokenHash" character varying NOT NULL,
    status public.user_tokens_status_enum DEFAULT 'PENDING'::public.user_tokens_status_enum NOT NULL,
    "maxUses" integer DEFAULT 1 NOT NULL,
    "useCount" integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "usedAt" timestamp without time zone,
    "createdIp" character varying,
    "lastUsedIp" character varying,
    "lastUsedUserAgent" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_tokens OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    "passwordHash" character varying(255),
    "fullName" character varying(255) NOT NULL,
    role public.users_role_enum DEFAULT 'CLIENT'::public.users_role_enum NOT NULL,
    "phoneNumber" character varying(20),
    "isVerified" boolean DEFAULT false NOT NULL,
    "currentTrustScore" numeric(3,2) DEFAULT '0'::numeric NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "totalProjectsFinished" integer DEFAULT 0 NOT NULL,
    "totalProjectsCancelled" integer DEFAULT 0 NOT NULL,
    "totalDisputesLost" integer DEFAULT 0 NOT NULL,
    "totalLateProjects" integer DEFAULT 0 NOT NULL,
    resetpasswordotp character varying(6),
    resetpasswordotpexpires timestamp without time zone,
    "isBanned" boolean DEFAULT false NOT NULL,
    "banReason" text,
    "bannedAt" timestamp without time zone,
    "bannedBy" uuid,
    "emailVerificationToken" character varying(64),
    "emailVerificationExpires" timestamp without time zone,
    "emailVerifiedAt" timestamp without time zone,
    "termsAcceptedAt" timestamp without time zone,
    "privacyAcceptedAt" timestamp without time zone,
    "registrationIp" character varying(45),
    "registrationUserAgent" text,
    "timeZone" character varying(64) DEFAULT 'UTC'::character varying NOT NULL,
    status public.users_status_enum DEFAULT 'ACTIVE'::public.users_status_enum NOT NULL,
    "deletedAt" timestamp without time zone,
    "deletedReason" character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: verification_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "docType" character varying(100),
    "documentUrl" character varying NOT NULL,
    status public.verification_documents_status_enum DEFAULT 'PENDING'::public.verification_documents_status_enum NOT NULL,
    "submittedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "verifiedAt" timestamp without time zone,
    "verifiedBy" uuid,
    "rejectReason" text
);


ALTER TABLE public.verification_documents OWNER TO postgres;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    balance numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "pendingBalance" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "heldBalance" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "totalDeposited" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "totalWithdrawn" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "totalEarned" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "totalSpent" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    status public.wallets_status_enum DEFAULT 'ACTIVE'::public.wallets_status_enum NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Name: wizard_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wizard_options (
    id integer NOT NULL,
    question_id integer NOT NULL,
    value character varying NOT NULL,
    label text NOT NULL,
    sort_order integer
);


ALTER TABLE public.wizard_options OWNER TO postgres;

--
-- Name: wizard_options_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wizard_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wizard_options_id_seq OWNER TO postgres;

--
-- Name: wizard_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wizard_options_id_seq OWNED BY public.wizard_options.id;


--
-- Name: wizard_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wizard_questions (
    id integer NOT NULL,
    code character varying NOT NULL,
    label text NOT NULL,
    help_text text,
    input_type character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wizard_questions OWNER TO postgres;

--
-- Name: wizard_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wizard_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wizard_questions_id_seq OWNER TO postgres;

--
-- Name: wizard_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wizard_questions_id_seq OWNED BY public.wizard_questions.id;


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: wizard_options id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_options ALTER COLUMN id SET DEFAULT nextval('public.wizard_options_id_seq'::regclass);


--
-- Name: wizard_questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_questions ALTER COLUMN id SET DEFAULT nextval('public.wizard_questions_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wizard_questions PK_01980ba9ae3a226aa28c08b2007; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_questions
    ADD CONSTRAINT "PK_01980ba9ae3a226aa28c08b2007" PRIMARY KEY (id);


--
-- Name: staff_performances PK_03c57f7ad04ac58124e1ff1940c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_performances
    ADD CONSTRAINT "PK_03c57f7ad04ac58124e1ff1940c" PRIMARY KEY (id);


--
-- Name: project_categories PK_03d7af35c2601369d030b3617bc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT "PK_03d7af35c2601369d030b3617bc" PRIMARY KEY (id);


--
-- Name: staff_leave_requests PK_066c3ab8534c6675f094d717d2f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_leave_requests
    ADD CONSTRAINT "PK_066c3ab8534c6675f094d717d2f" PRIMARY KEY (id);


--
-- Name: milestones PK_0bdbfe399c777a6a8520ff902d9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY (id);


--
-- Name: skills PK_0d3212120f4ecedf90864d7e298; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT "PK_0d3212120f4ecedf90864d7e298" PRIMARY KEY (id);


--
-- Name: hearing_statements PK_0eec53fe84d1c3d6144f0351f88; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_statements
    ADD CONSTRAINT "PK_0eec53fe84d1c3d6144f0351f88" PRIMARY KEY (id);


--
-- Name: digital_signatures PK_11dff7aef9846ed49b2134b0869; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_signatures
    ADD CONSTRAINT "PK_11dff7aef9846ed49b2134b0869" PRIMARY KEY (id);


--
-- Name: dispute_notes PK_12c264679d2c3abe161f0f04c9b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_notes
    ADD CONSTRAINT "PK_12c264679d2c3abe161f0f04c9b" PRIMARY KEY (id);


--
-- Name: skill_domains PK_145bdc4c995f214718b9e93fac0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_domains
    ADD CONSTRAINT "PK_145bdc4c995f214718b9e93fac0" PRIMARY KEY (id);


--
-- Name: skill_mapping_rules PK_14d0fc9b9752e08203639f905db; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_mapping_rules
    ADD CONSTRAINT "PK_14d0fc9b9752e08203639f905db" PRIMARY KEY (id);


--
-- Name: audit_logs PK_1bb179d048bbc581caa3b013439; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);


--
-- Name: project_category_map PK_20f09ce6ad412dfdf5adc394426; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_category_map
    ADD CONSTRAINT "PK_20f09ce6ad412dfdf5adc394426" PRIMARY KEY (project_id, category_id);


--
-- Name: reviews PK_231ae565c273ee700b283f15c1d; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY (id);


--
-- Name: staff_leave_policies PK_249a599c0551a94ce801a856a99; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_leave_policies
    ADD CONSTRAINT "PK_249a599c0551a94ce801a856a99" PRIMARY KEY (id);


--
-- Name: kyc_access_logs PK_25c369aa8ab1a6e546271be7fc2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_access_logs
    ADD CONSTRAINT "PK_25c369aa8ab1a6e546271be7fc2" PRIMARY KEY (id);


--
-- Name: contracts PK_2c7b8f3a7b1acdd49497d83d0fb; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "PK_2c7b8f3a7b1acdd49497d83d0fb" PRIMARY KEY (id);


--
-- Name: auto_schedule_rules PK_30a7072435c9e07b25a34fc113a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_schedule_rules
    ADD CONSTRAINT "PK_30a7072435c9e07b25a34fc113a" PRIMARY KEY (id);


--
-- Name: payout_requests PK_3a6acb302f56ad7dadda35c86b8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "PK_3a6acb302f56ad7dadda35c86b8" PRIMARY KEY (id);


--
-- Name: disputes PK_3c97580d01c1a4b0b345c42a107; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY (id);


--
-- Name: staff_workloads PK_3df5dac98d0a3901160284e55c1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_workloads
    ADD CONSTRAINT "PK_3df5dac98d0a3901160284e55c1" PRIMARY KEY (id);


--
-- Name: milestone_payments PK_421444a538d4babff59b8921a60; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestone_payments
    ADD CONSTRAINT "PK_421444a538d4babff59b8921a60" PRIMARY KEY (id);


--
-- Name: hearing_participants PK_486427acde77ce82fbd7bd26228; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_participants
    ADD CONSTRAINT "PK_486427acde77ce82fbd7bd26228" PRIMARY KEY (id);


--
-- Name: user_skills PK_4d0a72117fbf387752dbc8506af; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT "PK_4d0a72117fbf387752dbc8506af" PRIMARY KEY (id);


--
-- Name: dispute_evidences PK_5303a0ad975cf37cc0303bc831e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_evidences
    ADD CONSTRAINT "PK_5303a0ad975cf37cc0303bc831e" PRIMARY KEY (id);


--
-- Name: dispute_activities PK_5450fd07c723de5852f536ebf3a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_activities
    ADD CONSTRAINT "PK_5450fd07c723de5852f536ebf3a" PRIMARY KEY (id);


--
-- Name: kyc_verifications PK_57b7c6b141dd225ce5dc95d7fb0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT "PK_57b7c6b141dd225ce5dc95d7fb0" PRIMARY KEY (id);


--
-- Name: dispute_resolution_feedbacks PK_5d209e71c3abd94cb28e26768f5; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_resolution_feedbacks
    ADD CONSTRAINT "PK_5d209e71c3abd94cb28e26768f5" PRIMARY KEY (id);


--
-- Name: platform_settings PK_5d9031e30fac3ec3ec8b9602e17; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT "PK_5d9031e30fac3ec3ec8b9602e17" PRIMARY KEY (key);


--
-- Name: projects PK_6271df0a7aed1d6c0691ce6ac50; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY (id);


--
-- Name: user_tokens PK_63764db9d9aaa4af33e07b2f4bf; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tokens
    ADD CONSTRAINT "PK_63764db9d9aaa4af33e07b2f4bf" PRIMARY KEY (id);


--
-- Name: auth_sessions PK_641507381f32580e8479efc36cd; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY (id);


--
-- Name: event_reschedule_requests PK_64eb192a85910c5ea6081d06560; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_reschedule_requests
    ADD CONSTRAINT "PK_64eb192a85910c5ea6081d06560" PRIMARY KEY (id);


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: hearing_questions PK_6a847731b78e8f5e9ec4af2b91b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_questions
    ADD CONSTRAINT "PK_6a847731b78e8f5e9ec4af2b91b" PRIMARY KEY (id);


--
-- Name: user_flags PK_6de618449277fb758cd2f13c1e3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_flags
    ADD CONSTRAINT "PK_6de618449277fb758cd2f13c1e3" PRIMARY KEY (id);


--
-- Name: task_history PK_716670443aea4a2f4a599bb7c53; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "PK_716670443aea4a2f4a599bb7c53" PRIMARY KEY (id);


--
-- Name: dispute_verdicts PK_7387005b86d6dddbe3db0af2bbb; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_verdicts
    ADD CONSTRAINT "PK_7387005b86d6dddbe3db0af2bbb" PRIMARY KEY (id);


--
-- Name: task_attachments PK_7f18b8e8a6c6a0c87b987a7b0db; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT "PK_7f18b8e8a6c6a0c87b987a7b0db" PRIMARY KEY (id);


--
-- Name: project_requests PK_823e3ef5750d70abfbb943ee4ff; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT "PK_823e3ef5750d70abfbb943ee4ff" PRIMARY KEY (id);


--
-- Name: task_comments PK_83b99b0b03db29d4cafcb579b77; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT "PK_83b99b0b03db29d4cafcb579b77" PRIMARY KEY (id);


--
-- Name: wallets PK_8402e5df5a30a229380e83e4f7e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY (id);


--
-- Name: dispute_messages PK_8826f78d556a1846f8cbad5ed05; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_messages
    ADD CONSTRAINT "PK_8826f78d556a1846f8cbad5ed05" PRIMARY KEY (id);


--
-- Name: wizard_options PK_888ae1a4fab441bd429fcdc4452; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_options
    ADD CONSTRAINT "PK_888ae1a4fab441bd429fcdc4452" PRIMARY KEY (id);


--
-- Name: user_availabilities PK_8bc9ab5a97c0d7ac41a57888d2c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_availabilities
    ADD CONSTRAINT "PK_8bc9ab5a97c0d7ac41a57888d2c" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: tasks PK_8d12ff38fcc62aaba2cab748772; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY (id);


--
-- Name: task_submissions PK_8d19d6b5dd776e373113de50018; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT "PK_8d19d6b5dd776e373113de50018" PRIMARY KEY (id);


--
-- Name: profiles PK_8e520eb4da7dc01d0e190447c8e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY (id);


--
-- Name: staff_expertise PK_8e6e8189687c4ca6332c16cd28a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_expertise
    ADD CONSTRAINT "PK_8e6e8189687c4ca6332c16cd28a" PRIMARY KEY (id);


--
-- Name: fee_configs PK_9353f3fc4bd5b35c9615f77a2ac; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_configs
    ADD CONSTRAINT "PK_9353f3fc4bd5b35c9615f77a2ac" PRIMARY KEY (id);


--
-- Name: escrows PK_9cd10ae5b52350c3a20d124f5d3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT "PK_9cd10ae5b52350c3a20d124f5d3" PRIMARY KEY (id);


--
-- Name: transactions PK_a219afd8dd77ed80f5a862f1db9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: documents PK_ac51aa5181ee2036f5ca482857c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY (id);


--
-- Name: project_request_answers PK_ae029739fd856296276f8cbab69; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_answers
    ADD CONSTRAINT "PK_ae029739fd856296276f8cbab69" PRIMARY KEY (id);


--
-- Name: verification_documents PK_b4dc59d87f87ce5a1bb1d3fe0bf; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT "PK_b4dc59d87f87ce5a1bb1d3fe0bf" PRIMARY KEY (id);


--
-- Name: event_participants PK_b65ffd558d76fd51baffe81d42b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT "PK_b65ffd558d76fd51baffe81d42b" PRIMARY KEY (id);


--
-- Name: broker_proposals PK_broker_proposals; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_proposals
    ADD CONSTRAINT "PK_broker_proposals" PRIMARY KEY (id);


--
-- Name: dispute_skill_requirements PK_c01f5cdf09a1842b3d47ab3d3a0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_skill_requirements
    ADD CONSTRAINT "PK_c01f5cdf09a1842b3d47ab3d3a0" PRIMARY KEY (id);


--
-- Name: saved_freelancers PK_c0ad842aac86d1014650bed12c1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_freelancers
    ADD CONSTRAINT "PK_c0ad842aac86d1014650bed12c1" PRIMARY KEY (id);


--
-- Name: dispute_settlements PK_c93a0d89d516eeea1ffe9b40887; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_settlements
    ADD CONSTRAINT "PK_c93a0d89d516eeea1ffe9b40887" PRIMARY KEY (id);


--
-- Name: payout_methods PK_cedb0a9e379a9a0a16ad050527e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_methods
    ADD CONSTRAINT "PK_cedb0a9e379a9a0a16ad050527e" PRIMARY KEY (id);


--
-- Name: reports PK_d9013193989303580053c0b5ef6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY (id);


--
-- Name: user_skill_domains PK_ddaa8409d755b40b4e160994948; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skill_domains
    ADD CONSTRAINT "PK_ddaa8409d755b40b4e160994948" PRIMARY KEY (id);


--
-- Name: dispute_ledgers PK_dispute_ledgers_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_ledgers
    ADD CONSTRAINT "PK_dispute_ledgers_id" PRIMARY KEY (id);


--
-- Name: dispute_parties PK_dispute_parties_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_parties
    ADD CONSTRAINT "PK_dispute_parties_id" PRIMARY KEY (id);


--
-- Name: dispute_schedule_proposals PK_dispute_schedule_proposals_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_schedule_proposals
    ADD CONSTRAINT "PK_dispute_schedule_proposals_id" PRIMARY KEY (id);


--
-- Name: dispute_view_states PK_dispute_view_states_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_view_states
    ADD CONSTRAINT "PK_dispute_view_states_id" PRIMARY KEY (id);


--
-- Name: project_request_proposals PK_e3a1f06e8f77e967076bd9404a6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_proposals
    ADD CONSTRAINT "PK_e3a1f06e8f77e967076bd9404a6" PRIMARY KEY (id);


--
-- Name: dispute_hearings PK_e88b196b9cbf0b37e3d1632fc62; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_hearings
    ADD CONSTRAINT "PK_e88b196b9cbf0b37e3d1632fc62" PRIMARY KEY (id);


--
-- Name: social_accounts PK_e9e58d2d8e9fafa20af914d9750; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT "PK_e9e58d2d8e9fafa20af914d9750" PRIMARY KEY (id);


--
-- Name: legal_signatures PK_f43925e14ba327e052d0de59352; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_signatures
    ADD CONSTRAINT "PK_f43925e14ba327e052d0de59352" PRIMARY KEY (id);


--
-- Name: calendar_events PK_faf5391d232322a87cdd1c6f30c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "PK_faf5391d232322a87cdd1c6f30c" PRIMARY KEY (id);


--
-- Name: trust_score_history PK_fc2095d09415689b51678b46615; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_score_history
    ADD CONSTRAINT "PK_fc2095d09415689b51678b46615" PRIMARY KEY (id);


--
-- Name: hearing_reminder_deliveries PK_hearing_reminder_deliveries_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_reminder_deliveries
    ADD CONSTRAINT "PK_hearing_reminder_deliveries_id" PRIMARY KEY (id);


--
-- Name: project_spec_signatures PK_project_spec_signatures_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_spec_signatures
    ADD CONSTRAINT "PK_project_spec_signatures_id" PRIMARY KEY (id);


--
-- Name: task_links PK_task_links_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_links
    ADD CONSTRAINT "PK_task_links_id" PRIMARY KEY (id);


--
-- Name: profiles REL_315ecd98bd1a42dcf2ec4e2e98; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT "REL_315ecd98bd1a42dcf2ec4e2e98" UNIQUE ("userId");


--
-- Name: dispute_verdicts REL_a027522850799c0ff026bceb1c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_verdicts
    ADD CONSTRAINT "REL_a027522850799c0ff026bceb1c" UNIQUE ("disputeId");


--
-- Name: user_skills UQ_060bea7fd45868588324719de3c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT "UQ_060bea7fd45868588324719de3c" UNIQUE ("userId", "skillId");


--
-- Name: staff_expertise UQ_118b1153e34e56649744630850f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_expertise
    ADD CONSTRAINT "UQ_118b1153e34e56649744630850f" UNIQUE ("staffId", "skillId");


--
-- Name: skill_domains UQ_374b86eb42609c0b1839a0d19b2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_domains
    ADD CONSTRAINT "UQ_374b86eb42609c0b1839a0d19b2" UNIQUE (slug);


--
-- Name: project_categories UQ_46046d6693cbabd6b882cd0e5d3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_categories
    ADD CONSTRAINT "UQ_46046d6693cbabd6b882cd0e5d3" UNIQUE (slug);


--
-- Name: user_skill_domains UQ_4e65a495b8249281aff57084337; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skill_domains
    ADD CONSTRAINT "UQ_4e65a495b8249281aff57084337" UNIQUE ("userId", "domainId");


--
-- Name: skills UQ_55b7acbf80551e7fa2b5a33ed6c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT "UQ_55b7acbf80551e7fa2b5a33ed6c" UNIQUE (slug);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: dispute_skill_requirements UQ_b1e77eec0db27c6fb7309c8c8b3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_skill_requirements
    ADD CONSTRAINT "UQ_b1e77eec0db27c6fb7309c8c8b3" UNIQUE ("disputeId", "skillId");


--
-- Name: dispute_parties UQ_dispute_parties_group_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_parties
    ADD CONSTRAINT "UQ_dispute_parties_group_user" UNIQUE ("groupId", "userId");


--
-- Name: wizard_questions UQ_fec5bf63c0e39ebf237b3bbc486; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_questions
    ADD CONSTRAINT "UQ_fec5bf63c0e39ebf237b3bbc486" UNIQUE (code);


--
-- Name: hearing_reminder_deliveries UQ_hearing_reminder_deliveries_hearing_user_type; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_reminder_deliveries
    ADD CONSTRAINT "UQ_hearing_reminder_deliveries_hearing_user_type" UNIQUE ("hearingId", "userId", "reminderType");


--
-- Name: project_spec_signatures UQ_project_spec_signatures_spec_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_spec_signatures
    ADD CONSTRAINT "UQ_project_spec_signatures_spec_user" UNIQUE ("specId", "userId");


--
-- Name: kv_store_34447448 kv_store_34447448_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kv_store_34447448
    ADD CONSTRAINT kv_store_34447448_pkey PRIMARY KEY (key);


--
-- Name: project_specs project_specs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_specs
    ADD CONSTRAINT project_specs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: IDX_02daa0e833626078f4b5c608ef; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_02daa0e833626078f4b5c608ef" ON public.project_category_map USING btree (category_id);


--
-- Name: IDX_0fee7d9cc550129521f99ca861; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_0fee7d9cc550129521f99ca861" ON public.user_flags USING btree ("userId", type);


--
-- Name: IDX_11c123605d5b0aa135a5283321; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_11c123605d5b0aa135a5283321" ON public.calendar_events USING btree ("organizerId", "startTime");


--
-- Name: IDX_2c9d9548cf8410e425e120b5e6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_2c9d9548cf8410e425e120b5e6" ON public.transactions USING btree ("walletId", "createdAt");


--
-- Name: IDX_2ecdb33f23e9a6fc392025c0b9; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_2ecdb33f23e9a6fc392025c0b9" ON public.wallets USING btree ("userId");


--
-- Name: IDX_3108804238a667da7d826fba4b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_3108804238a667da7d826fba4b" ON public.event_reschedule_requests USING btree ("eventId", status);


--
-- Name: IDX_35fc4b83a39ef23f08a4b5ac9c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_35fc4b83a39ef23f08a4b5ac9c" ON public.transactions USING btree (type, status);


--
-- Name: IDX_372920d813ceab29336fc5221e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_372920d813ceab29336fc5221e" ON public.payout_methods USING btree ("userId");


--
-- Name: IDX_374b86eb42609c0b1839a0d19b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_374b86eb42609c0b1839a0d19b" ON public.skill_domains USING btree (slug);


--
-- Name: IDX_488f342c925037dc95dd38c407; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_488f342c925037dc95dd38c407" ON public.user_skill_domains USING btree ("domainId");


--
-- Name: IDX_4be126f755193c85b7b4359051; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_4be126f755193c85b7b4359051" ON public.user_skill_domains USING btree ("userId");


--
-- Name: IDX_54b1af06e01e858558a708d47c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_54b1af06e01e858558a708d47c" ON public.escrows USING btree ("milestoneId");


--
-- Name: IDX_55b7acbf80551e7fa2b5a33ed6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_55b7acbf80551e7fa2b5a33ed6" ON public.skills USING btree (slug);


--
-- Name: IDX_59315b31da1e22039f4adaeb7f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_59315b31da1e22039f4adaeb7f" ON public.staff_leave_policies USING btree ("staffId");


--
-- Name: IDX_5e959878bf336b30d674d43fe4; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_5e959878bf336b30d674d43fe4" ON public.broker_proposals USING btree ("requestId", "brokerId");


--
-- Name: IDX_63d1dc4e442a80233613bc0d15; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_63d1dc4e442a80233613bc0d15" ON public.project_category_map USING btree (project_id);


--
-- Name: IDX_6ea8194aa51f091685b7189c83; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_6ea8194aa51f091685b7189c83" ON public.staff_workloads USING btree ("staffId", date);


--
-- Name: IDX_724c0d98a342b4c1b800987b6d; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_724c0d98a342b4c1b800987b6d" ON public.dispute_skill_requirements USING btree ("skillId");


--
-- Name: IDX_756c5751bed65f11ac540eec0c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_756c5751bed65f11ac540eec0c" ON public.user_flags USING btree (status, severity);


--
-- Name: IDX_764bd953684c413eea5bd3059a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_764bd953684c413eea5bd3059a" ON public.calendar_events USING btree (status, "startTime");


--
-- Name: IDX_7c5efa28f1cc59dcb589c07c90; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_7c5efa28f1cc59dcb589c07c90" ON public.dispute_resolution_feedbacks USING btree ("staffId", "createdAt");


--
-- Name: IDX_7d90a2ab3ea972461a2b698adc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_7d90a2ab3ea972461a2b698adc" ON public.event_participants USING btree ("eventId", "userId");


--
-- Name: IDX_7f932413b0fcf2a2113c60fdb7; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_7f932413b0fcf2a2113c60fdb7" ON public.dispute_skill_requirements USING btree ("disputeId");


--
-- Name: IDX_845042ee2b14702b78b0428d19; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_845042ee2b14702b78b0428d19" ON public.event_participants USING btree ("userId", status);


--
-- Name: IDX_85132512bfb49b6441a05ffa0d; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_85132512bfb49b6441a05ffa0d" ON public.reviews USING btree ("projectId", "reviewerId", "targetUserId");


--
-- Name: IDX_98e7bfa27a5dc3f1ea6854491f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_98e7bfa27a5dc3f1ea6854491f" ON public.staff_expertise USING btree ("skillId");


--
-- Name: IDX_a9cbc17b602d6612732446411e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_a9cbc17b602d6612732446411e" ON public.dispute_messages USING btree ("disputeId", "createdAt");


--
-- Name: IDX_ac1cbe4c27fbb852c69edc736d; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_ac1cbe4c27fbb852c69edc736d" ON public.user_availabilities USING btree ("userId", type);


--
-- Name: IDX_ae13f5b449f0c4eb0355461e25; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_ae13f5b449f0c4eb0355461e25" ON public.dispute_resolution_feedbacks USING btree ("disputeId", "userId");


--
-- Name: IDX_auth_sessions_refresh_token_fingerprint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_auth_sessions_refresh_token_fingerprint" ON public.auth_sessions USING btree ("refreshTokenFingerprint");


--
-- Name: IDX_b00e523249685dadae620f80e4; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_b00e523249685dadae620f80e4" ON public.dispute_messages USING btree ("senderId", "createdAt");


--
-- Name: IDX_c248539f79b9a09139010aa646; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_c248539f79b9a09139010aa646" ON public.user_skills USING btree ("userId", priority);


--
-- Name: IDX_c67935e88b6f1b7a82c56838fb; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_c67935e88b6f1b7a82c56838fb" ON public.audit_logs USING btree (actor_id, entity_id, created_at);


--
-- Name: IDX_cac20fd0c92979420b2ae94d9b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_cac20fd0c92979420b2ae94d9b" ON public.project_request_proposals USING btree ("requestId", "freelancerId");


--
-- Name: IDX_cbd5e2246a825b3c4a5d36a80f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_cbd5e2246a825b3c4a5d36a80f" ON public.skills USING btree ("domainId", category);


--
-- Name: IDX_contracts_sourceSpecId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_contracts_sourceSpecId" ON public.contracts USING btree ("sourceSpecId");


--
-- Name: IDX_dac8e51dee0245e76de7099fc5; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dac8e51dee0245e76de7099fc5" ON public.dispute_settlements USING btree ("disputeId", status);


--
-- Name: IDX_de7b1e3103a486f694fedc726f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_de7b1e3103a486f694fedc726f" ON public.dispute_evidences USING btree ("disputeId", "uploadedAt");


--
-- Name: IDX_dispute_ledgers_dispute_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_ledgers_dispute_id_created_at" ON public.dispute_ledgers USING btree ("disputeId", "createdAt");


--
-- Name: IDX_dispute_ledgers_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_ledgers_hash" ON public.dispute_ledgers USING btree (hash);


--
-- Name: IDX_dispute_parties_dispute_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_parties_dispute_id" ON public.dispute_parties USING btree ("disputeId");


--
-- Name: IDX_dispute_parties_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_parties_group_id" ON public.dispute_parties USING btree ("groupId");


--
-- Name: IDX_dispute_schedule_proposals_dispute_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_schedule_proposals_dispute_range" ON public.dispute_schedule_proposals USING btree ("disputeId", "startTime", "endTime");


--
-- Name: IDX_dispute_schedule_proposals_dispute_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_schedule_proposals_dispute_status" ON public.dispute_schedule_proposals USING btree ("disputeId", status);


--
-- Name: IDX_dispute_schedule_proposals_dispute_user_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_schedule_proposals_dispute_user_start" ON public.dispute_schedule_proposals USING btree ("disputeId", "userId", "startTime");


--
-- Name: IDX_dispute_schedule_proposals_dispute_user_status_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_schedule_proposals_dispute_user_status_start" ON public.dispute_schedule_proposals USING btree ("disputeId", "userId", status, "startTime");


--
-- Name: IDX_dispute_view_states_user_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_dispute_view_states_user_updated" ON public.dispute_view_states USING btree ("userId", "updatedAt");


--
-- Name: IDX_disputes_defendant_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_disputes_defendant_status_updated" ON public.disputes USING btree ("defendantId", status, "updatedAt");


--
-- Name: IDX_disputes_groupId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_disputes_groupId" ON public.disputes USING btree ("groupId");


--
-- Name: IDX_disputes_raised_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_disputes_raised_status_updated" ON public.disputes USING btree ("raisedById", status, "updatedAt");


--
-- Name: IDX_disputes_status_assigned_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_disputes_status_assigned_created" ON public.disputes USING btree (status, "assignedStaffId", "createdAt");


--
-- Name: IDX_disputes_status_resolution_deadline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_disputes_status_resolution_deadline" ON public.disputes USING btree (status, "resolutionDeadline");


--
-- Name: IDX_e377a1b2968a22e35e20494d50; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_e377a1b2968a22e35e20494d50" ON public.user_availabilities USING btree ("userId", "startTime", "endTime");


--
-- Name: IDX_e8063ccf1d8a6844462602e379; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_e8063ccf1d8a6844462602e379" ON public.legal_signatures USING btree ("disputeId", "signerId");


--
-- Name: IDX_f06364d9c26debe2955aefb18c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f06364d9c26debe2955aefb18c" ON public.staff_leave_requests USING btree ("staffId", status);


--
-- Name: IDX_f07f9d851481059289600bc412; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f07f9d851481059289600bc412" ON public.escrows USING btree ("projectId");


--
-- Name: IDX_f1d523469df6ac4e853b4bf531; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "IDX_f1d523469df6ac4e853b4bf531" ON public.saved_freelancers USING btree ("clientId", "freelancerId");


--
-- Name: IDX_f470385602469dc1fb0615d4c6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f470385602469dc1fb0615d4c6" ON public.staff_performances USING btree ("staffId", period);


--
-- Name: IDX_f643baf957249229e5be5651e6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f643baf957249229e5be5651e6" ON public.user_skills USING btree ("skillId", "verificationStatus");


--
-- Name: IDX_f75a9520717592042c60fbc3f7; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f75a9520717592042c60fbc3f7" ON public.skill_mapping_rules USING btree ("entityType", "entityValue");


--
-- Name: IDX_fb3f2230a784122307b26d18a3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_fb3f2230a784122307b26d18a3" ON public.calendar_events USING btree ("startTime", "endTime");


--
-- Name: IDX_fd18fc4e1930d961ced296f6e4; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_fd18fc4e1930d961ced296f6e4" ON public.staff_expertise USING btree ("staffId");


--
-- Name: IDX_fe6affc86bd737d0ed35ae638a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_fe6affc86bd737d0ed35ae638a" ON public.staff_leave_requests USING btree ("staffId", "startTime", "endTime");


--
-- Name: IDX_hearing_reminder_deliveries_delivered_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_hearing_reminder_deliveries_delivered_at" ON public.hearing_reminder_deliveries USING btree ("deliveredAt");


--
-- Name: IDX_hearing_reminder_deliveries_hearing_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_hearing_reminder_deliveries_hearing_type" ON public.hearing_reminder_deliveries USING btree ("hearingId", "reminderType");


--
-- Name: IDX_kyc_access_logs_flagged; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_kyc_access_logs_flagged" ON public.kyc_access_logs USING btree ("flaggedAsSuspicious");


--
-- Name: IDX_kyc_access_logs_ip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_kyc_access_logs_ip" ON public.kyc_access_logs USING btree ("ipAddress");


--
-- Name: IDX_kyc_access_logs_kyc_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_kyc_access_logs_kyc_action" ON public.kyc_access_logs USING btree ("kycId", action);


--
-- Name: IDX_kyc_access_logs_reviewer_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_kyc_access_logs_reviewer_created" ON public.kyc_access_logs USING btree ("reviewerId", "createdAt");


--
-- Name: IDX_project_specs_parentSpecId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_project_specs_parentSpecId" ON public.project_specs USING btree ("parentSpecId");


--
-- Name: UQ_dispute_view_states_dispute_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UQ_dispute_view_states_dispute_user" ON public.dispute_view_states USING btree ("disputeId", "userId");


--
-- Name: kv_store_34447448_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX kv_store_34447448_key_idx ON public.kv_store_34447448 USING btree (key text_pattern_ops);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: disputes FK_00ac6d80806ccdd62cf9c159785; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_00ac6d80806ccdd62cf9c159785" FOREIGN KEY ("resolvedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: projects FK_026902dba3d3ceefa3817500674; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_026902dba3d3ceefa3817500674" FOREIGN KEY ("requestId") REFERENCES public.project_requests(id) ON DELETE SET NULL;


--
-- Name: project_category_map FK_02daa0e833626078f4b5c608ef7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_category_map
    ADD CONSTRAINT "FK_02daa0e833626078f4b5c608ef7" FOREIGN KEY (category_id) REFERENCES public.project_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dispute_skill_requirements FK_07db9a3bc01a0ae9fb9a74aa54e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_skill_requirements
    ADD CONSTRAINT "FK_07db9a3bc01a0ae9fb9a74aa54e" FOREIGN KEY ("addedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: escrows FK_08723ed58ba58a217b8713f531d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT "FK_08723ed58ba58a217b8713f531d" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE SET NULL;


--
-- Name: projects FK_091f9433895a53408cb8ae3864f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_091f9433895a53408cb8ae3864f" FOREIGN KEY ("clientId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: disputes FK_095c0da1ca820448832b8644d48; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_095c0da1ca820448832b8644d48" FOREIGN KEY ("parentDisputeId") REFERENCES public.disputes(id);


--
-- Name: hearing_questions FK_0a74115a3ce8722a5a4580a37f3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_questions
    ADD CONSTRAINT "FK_0a74115a3ce8722a5a4580a37f3" FOREIGN KEY ("cancelledById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: event_reschedule_requests FK_0ac7c3e37b89c3175104a8fb6c1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_reschedule_requests
    ADD CONSTRAINT "FK_0ac7c3e37b89c3175104a8fb6c1" FOREIGN KEY ("eventId") REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: user_availabilities FK_0ad39d7a62d181f5e03d24b967b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_availabilities
    ADD CONSTRAINT "FK_0ad39d7a62d181f5e03d24b967b" FOREIGN KEY ("linkedLeaveRequestId") REFERENCES public.staff_leave_requests(id) ON DELETE CASCADE;


--
-- Name: task_comments FK_0f1678d088b531e97e5cd665de8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT "FK_0f1678d088b531e97e5cd665de8" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_links FK_12e04786c9ec8436f467421b11d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_links
    ADD CONSTRAINT "FK_12e04786c9ec8436f467421b11d" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_history FK_158887786322644785a61e6980e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "FK_158887786322644785a61e6980e" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: dispute_resolution_feedbacks FK_15ec954127ddaf6a2ccf2ed3736; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_resolution_feedbacks
    ADD CONSTRAINT "FK_15ec954127ddaf6a2ccf2ed3736" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events FK_16e7e7cc00e7fdc1ae7a4762a4e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "FK_16e7e7cc00e7fdc1ae7a4762a4e" FOREIGN KEY ("previousEventId") REFERENCES public.calendar_events(id);


--
-- Name: audit_logs FK_177183f29f438c488b5e8510cdb; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: hearing_participants FK_1f896e5790ddfc051f02ad2b385; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_participants
    ADD CONSTRAINT "FK_1f896e5790ddfc051f02ad2b385" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects FK_22f434063fa3502539bab88858d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_22f434063fa3502539bab88858d" FOREIGN KEY ("freelancerId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contracts FK_2421e3588c8e452a325ca49b70f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "FK_2421e3588c8e452a325ca49b70f" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_submissions FK_244f39fcbecb5ec48e68b120f37; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT "FK_244f39fcbecb5ec48e68b120f37" FOREIGN KEY ("submitterId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: digital_signatures FK_272d16a5c66344d957a1efecb25; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_signatures
    ADD CONSTRAINT "FK_272d16a5c66344d957a1efecb25" FOREIGN KEY ("contractId") REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: dispute_messages FK_288e9a3fe13cfe14abe9824e9ce; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_messages
    ADD CONSTRAINT "FK_288e9a3fe13cfe14abe9824e9ce" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: reviews FK_299e0ce9838de08dea4eac93e28; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "FK_299e0ce9838de08dea4eac93e28" FOREIGN KEY ("targetUserId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets FK_2ecdb33f23e9a6fc392025c0b97; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payout_requests FK_2efebf9c50eb838dd24d5816cc5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "FK_2efebf9c50eb838dd24d5816cc5" FOREIGN KEY ("processedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: profiles FK_315ecd98bd1a42dcf2ec4e2e985; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_notes FK_3282d2ccb98a92b5ecbf66adf76; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_notes
    ADD CONSTRAINT "FK_3282d2ccb98a92b5ecbf66adf76" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: saved_freelancers FK_32d1522472855a34af369949ad9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_freelancers
    ADD CONSTRAINT "FK_32d1522472855a34af369949ad9" FOREIGN KEY ("freelancerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks FK_34701b0b8d466af308ba202e4ef; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "FK_34701b0b8d466af308ba202e4ef" FOREIGN KEY ("parentTaskId") REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: project_request_proposals FK_36541dd025948b388251c3c01f4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_proposals
    ADD CONSTRAINT "FK_36541dd025948b388251c3c01f4" FOREIGN KEY ("brokerId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payout_methods FK_372920d813ceab29336fc5221e6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_methods
    ADD CONSTRAINT "FK_372920d813ceab29336fc5221e6" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: milestone_payments FK_372e96a14c5f890c42b0d6e58e0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestone_payments
    ADD CONSTRAINT "FK_372e96a14c5f890c42b0d6e58e0" FOREIGN KEY ("releaseTransactionId") REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: project_request_proposals FK_3a404d4e7ec6b5db69aa875cbf8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_proposals
    ADD CONSTRAINT "FK_3a404d4e7ec6b5db69aa875cbf8" FOREIGN KEY ("freelancerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_leave_requests FK_3ac65a6dc7c2a47a1307d8faaa4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_leave_requests
    ADD CONSTRAINT "FK_3ac65a6dc7c2a47a1307d8faaa4" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks FK_3b34ce2db713f0be359768db816; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "FK_3b34ce2db713f0be359768db816" FOREIGN KEY ("assignedTo") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: legal_signatures FK_3cc89eed44ba0a39380c6a08f16; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_signatures
    ADD CONSTRAINT "FK_3cc89eed44ba0a39380c6a08f16" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: task_attachments FK_4070df3ea94ef8eb1fc86192174; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT "FK_4070df3ea94ef8eb1fc86192174" FOREIGN KEY ("uploaderId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fee_configs FK_42214cd963e2591ef028f0ebdd9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_configs
    ADD CONSTRAINT "FK_42214cd963e2591ef028f0ebdd9" FOREIGN KEY ("updatedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_attachments FK_47d3c46e4edb30cdaf97ccdb8d8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT "FK_47d3c46e4edb30cdaf97ccdb8d8" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: user_skill_domains FK_488f342c925037dc95dd38c4077; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skill_domains
    ADD CONSTRAINT "FK_488f342c925037dc95dd38c4077" FOREIGN KEY ("domainId") REFERENCES public.skill_domains(id) ON DELETE CASCADE;


--
-- Name: event_participants FK_4907f15416577c3bbbcd604d121; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT "FK_4907f15416577c3bbbcd604d121" FOREIGN KEY ("eventId") REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: user_skill_domains FK_4be126f755193c85b7b4359051b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skill_domains
    ADD CONSTRAINT "FK_4be126f755193c85b7b4359051b" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_settlements FK_4f739e97f1d4001972b83f55d92; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_settlements
    ADD CONSTRAINT "FK_4f739e97f1d4001972b83f55d92" FOREIGN KEY ("responderId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: escrows FK_54b1af06e01e858558a708d47cb; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT "FK_54b1af06e01e858558a708d47cb" FOREIGN KEY ("milestoneId") REFERENCES public.milestones(id) ON DELETE CASCADE;


--
-- Name: dispute_settlements FK_55edb94d39d55c06ec6d791e609; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_settlements
    ADD CONSTRAINT "FK_55edb94d39d55c06ec6d791e609" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: hearing_statements FK_563a966c8469466df1c6200004e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_statements
    ADD CONSTRAINT "FK_563a966c8469466df1c6200004e" FOREIGN KEY ("retractionOfStatementId") REFERENCES public.hearing_statements(id);


--
-- Name: event_reschedule_requests FK_5804d5a5bf7b121d5bbf17b1381; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_reschedule_requests
    ADD CONSTRAINT "FK_5804d5a5bf7b121d5bbf17b1381" FOREIGN KEY ("requesterId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dispute_messages FK_587f533d1927b5ec42342b19edb; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_messages
    ADD CONSTRAINT "FK_587f533d1927b5ec42342b19edb" FOREIGN KEY ("replyToMessageId") REFERENCES public.dispute_messages(id);


--
-- Name: staff_leave_policies FK_59315b31da1e22039f4adaeb7ff; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_leave_policies
    ADD CONSTRAINT "FK_59315b31da1e22039f4adaeb7ff" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_activities FK_5cacac4c36fa75db2ecac2d6d2d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_activities
    ADD CONSTRAINT "FK_5cacac4c36fa75db2ecac2d6d2d" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hearing_questions FK_5e8108abe09d1b27fdfa4921450; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_questions
    ADD CONSTRAINT "FK_5e8108abe09d1b27fdfa4921450" FOREIGN KEY ("askedById") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_skills FK_60177dd93dcdc055e4eaa93bade; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT "FK_60177dd93dcdc055e4eaa93bade" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports FK_628fb90b2d3a87f2bb236befa66; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "FK_628fb90b2d3a87f2bb236befa66" FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: project_category_map FK_63d1dc4e442a80233613bc0d154; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_category_map
    ADD CONSTRAINT "FK_63d1dc4e442a80233613bc0d154" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: milestones FK_662a1f9d865fe49768fa369fd0f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: saved_freelancers FK_66a3a09dc240f9edd007d8294b1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_freelancers
    ADD CONSTRAINT "FK_66a3a09dc240f9edd007d8294b1" FOREIGN KEY ("clientId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_evidences FK_66cc1a5a31819855cf1aff32d56; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_evidences
    ADD CONSTRAINT "FK_66cc1a5a31819855cf1aff32d56" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: notifications FK_692a909ee0fa9383e7859f9b406; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_flags FK_6a27efdb19b62bdd218c689108a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_flags
    ADD CONSTRAINT "FK_6a27efdb19b62bdd218c689108a" FOREIGN KEY ("resolvedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_availabilities FK_6ae26565ff5f86a6a7c39681ca8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_availabilities
    ADD CONSTRAINT "FK_6ae26565ff5f86a6a7c39681ca8" FOREIGN KEY ("linkedEventId") REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: staff_leave_requests FK_6c53a2e5caa7d94888aa08ccfdd; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_leave_requests
    ADD CONSTRAINT "FK_6c53a2e5caa7d94888aa08ccfdd" FOREIGN KEY ("processedById") REFERENCES public.users(id);


--
-- Name: trust_score_history FK_6d46e08df04dfeb9f4311df2378; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trust_score_history
    ADD CONSTRAINT "FK_6d46e08df04dfeb9f4311df2378" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks FK_6dc5020fc4c6814347816455e7a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "FK_6dc5020fc4c6814347816455e7a" FOREIGN KEY ("milestoneId") REFERENCES public.milestones(id) ON DELETE CASCADE;


--
-- Name: auth_sessions FK_6e11140db54eefb6f4991a40df0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT "FK_6e11140db54eefb6f4991a40df0" FOREIGN KEY ("replacedBySessionId") REFERENCES public.auth_sessions(id) ON DELETE SET NULL;


--
-- Name: dispute_activities FK_6e8e8ceb8825dc4b0f9f53ac650; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_activities
    ADD CONSTRAINT "FK_6e8e8ceb8825dc4b0f9f53ac650" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: dispute_skill_requirements FK_724c0d98a342b4c1b800987b6da; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_skill_requirements
    ADD CONSTRAINT "FK_724c0d98a342b4c1b800987b6da" FOREIGN KEY ("skillId") REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: contracts FK_754103da22018eef9a0ee6f21e5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "FK_754103da22018eef9a0ee6f21e5" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: hearing_statements FK_7784614ca12bdeca446e7e5166c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_statements
    ADD CONSTRAINT "FK_7784614ca12bdeca446e7e5166c" FOREIGN KEY ("replyToStatementId") REFERENCES public.hearing_statements(id);


--
-- Name: legal_signatures FK_78dbf28b52549311a8b9ceee32f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_signatures
    ADD CONSTRAINT "FK_78dbf28b52549311a8b9ceee32f" FOREIGN KEY ("signerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: milestone_payments FK_78f7c3195dff24da67bb49b29d5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestone_payments
    ADD CONSTRAINT "FK_78f7c3195dff24da67bb49b29d5" FOREIGN KEY ("holdTransactionId") REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: disputes FK_7aebab8b5f52cd36df7211844b9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_7aebab8b5f52cd36df7211844b9" FOREIGN KEY ("milestoneId") REFERENCES public.milestones(id) ON DELETE CASCADE;


--
-- Name: dispute_hearings FK_7affb78273ec41d28d86a728829; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_hearings
    ADD CONSTRAINT "FK_7affb78273ec41d28d86a728829" FOREIGN KEY ("moderatorId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: social_accounts FK_7de933c3670ec71c68aca0afd56; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT "FK_7de933c3670ec71c68aca0afd56" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hearing_questions FK_7e40541c0cd7707c53d9c3d176b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_questions
    ADD CONSTRAINT "FK_7e40541c0cd7707c53d9c3d176b" FOREIGN KEY ("targetUserId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks FK_7ecc6be7d74a3f441f7aa5215ef; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "FK_7ecc6be7d74a3f441f7aa5215ef" FOREIGN KEY ("reporterId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payout_requests FK_7ecca99cfa68cbb2bfade96cd05; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "FK_7ecca99cfa68cbb2bfade96cd05" FOREIGN KEY ("walletId") REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: dispute_skill_requirements FK_7f932413b0fcf2a2113c60fdb7b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_skill_requirements
    ADD CONSTRAINT "FK_7f932413b0fcf2a2113c60fdb7b" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: milestone_payments FK_820aa06a348b448f9b6a8c52ad5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestone_payments
    ADD CONSTRAINT "FK_820aa06a348b448f9b6a8c52ad5" FOREIGN KEY ("milestoneId") REFERENCES public.milestones(id) ON DELETE CASCADE;


--
-- Name: dispute_evidences FK_85e8296ddc6ac2f0bb1aa054348; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_evidences
    ADD CONSTRAINT "FK_85e8296ddc6ac2f0bb1aa054348" FOREIGN KEY ("uploaderId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_availabilities FK_867c57e48ca1d079aca44fca934; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_availabilities
    ADD CONSTRAINT "FK_867c57e48ca1d079aca44fca934" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_verdicts FK_878605b8bb3318d5bf1032bb161; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_verdicts
    ADD CONSTRAINT "FK_878605b8bb3318d5bf1032bb161" FOREIGN KEY ("overridesVerdictId") REFERENCES public.dispute_verdicts(id);


--
-- Name: user_flags FK_87be2c376b9c867c1e12916c2af; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_flags
    ADD CONSTRAINT "FK_87be2c376b9c867c1e12916c2af" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: disputes FK_8880a40e54bc9b4675323ca102e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_8880a40e54bc9b4675323ca102e" FOREIGN KEY ("raisedById") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_hearings FK_890bb8c2c38b9d08fa1073f7d11; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_hearings
    ADD CONSTRAINT "FK_890bb8c2c38b9d08fa1073f7d11" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: user_flags FK_8947514bed8a3f78d16d6ac3f7e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_flags
    ADD CONSTRAINT "FK_8947514bed8a3f78d16d6ac3f7e" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_submissions FK_8b64cdeb41cbea6ce153dde4881; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT "FK_8b64cdeb41cbea6ce153dde4881" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: projects FK_8c56501d961c9f7b440abdce5d5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "FK_8c56501d961c9f7b440abdce5d5" FOREIGN KEY ("brokerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_notes FK_8e5bf63d7e5d911cc06d2a6e05d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_notes
    ADD CONSTRAINT "FK_8e5bf63d7e5d911cc06d2a6e05d" FOREIGN KEY ("authorId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payout_requests FK_8f9cb3fd93e7a728acf64f61930; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "FK_8f9cb3fd93e7a728acf64f61930" FOREIGN KEY ("transactionId") REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: payout_requests FK_90c93283fb9c279f41bcde3c51f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "FK_90c93283fb9c279f41bcde3c51f" FOREIGN KEY ("payoutMethodId") REFERENCES public.payout_methods(id) ON DELETE RESTRICT;


--
-- Name: auth_sessions FK_925b24d7fc2f9324ce972aee025; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT "FK_925b24d7fc2f9324ce972aee025" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: milestones FK_927a9184a0da350a677aa7e6269; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT "FK_927a9184a0da350a677aa7e6269" FOREIGN KEY ("projectSpecId") REFERENCES public.project_specs(id) ON DELETE CASCADE;


--
-- Name: user_tokens FK_92ce9a299624e4c4ffd99b645b6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tokens
    ADD CONSTRAINT "FK_92ce9a299624e4c4ffd99b645b6" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports FK_9459b9bf907a3807ef7143d2ead; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead" FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: project_specs FK_97ee9024805b4f2abe68ed78623; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_specs
    ADD CONSTRAINT "FK_97ee9024805b4f2abe68ed78623" FOREIGN KEY ("requestId") REFERENCES public.project_requests(id) ON DELETE CASCADE;


--
-- Name: staff_expertise FK_98e7bfa27a5dc3f1ea6854491f0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_expertise
    ADD CONSTRAINT "FK_98e7bfa27a5dc3f1ea6854491f0" FOREIGN KEY ("skillId") REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: disputes FK_9a4ad337edc45133e24c8bcaf4d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_9a4ad337edc45133e24c8bcaf4d" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_request_answers FK_9e7d84f4f6c8c98fa0b733c5d5e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_answers
    ADD CONSTRAINT "FK_9e7d84f4f6c8c98fa0b733c5d5e" FOREIGN KEY ("optionId") REFERENCES public.wizard_options(id) ON DELETE SET NULL;


--
-- Name: skills FK_9efef6747eca479da5e43ef38d1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT "FK_9efef6747eca479da5e43ef38d1" FOREIGN KEY ("domainId") REFERENCES public.skill_domains(id) ON DELETE SET NULL;


--
-- Name: calendar_events FK_a007ca3d443825b41461d9da45c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "FK_a007ca3d443825b41461d9da45c" FOREIGN KEY ("organizerId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dispute_verdicts FK_a027522850799c0ff026bceb1cd; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_verdicts
    ADD CONSTRAINT "FK_a027522850799c0ff026bceb1cd" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id);


--
-- Name: project_request_proposals FK_a3e8fc57db73e22a5128c22e6c7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_proposals
    ADD CONSTRAINT "FK_a3e8fc57db73e22a5128c22e6c7" FOREIGN KEY ("requestId") REFERENCES public.project_requests(id) ON DELETE CASCADE;


--
-- Name: kyc_verifications FK_a62a22506fed8625d73996501b3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT "FK_a62a22506fed8625d73996501b3" FOREIGN KEY ("reviewedBy") REFERENCES public.users(id);


--
-- Name: transactions FK_a88f466d39796d3081cf96e1b66; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "FK_a88f466d39796d3081cf96e1b66" FOREIGN KEY ("walletId") REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: dispute_resolution_feedbacks FK_ae1b9e4e007b9c33141e8b5fb44; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_resolution_feedbacks
    ADD CONSTRAINT "FK_ae1b9e4e007b9c33141e8b5fb44" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: dispute_resolution_feedbacks FK_ae7c221c89bb137ee857f8a61d6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_resolution_feedbacks
    ADD CONSTRAINT "FK_ae7c221c89bb137ee857f8a61d6" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hearing_participants FK_b042a3349ecc4a9249d630813e2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_participants
    ADD CONSTRAINT "FK_b042a3349ecc4a9249d630813e2" FOREIGN KEY ("hearingId") REFERENCES public.dispute_hearings(id) ON DELETE CASCADE;


--
-- Name: dispute_settlements FK_b18d40f213ca9be50bdba26a391; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_settlements
    ADD CONSTRAINT "FK_b18d40f213ca9be50bdba26a391" FOREIGN KEY ("proposerId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_skills FK_b19f190afaada3852e0f56566bc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT "FK_b19f190afaada3852e0f56566bc" FOREIGN KEY ("skillId") REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: payout_requests FK_b52c23ed48d02fb1fe17449d2d6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT "FK_b52c23ed48d02fb1fe17449d2d6" FOREIGN KEY ("approvedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_comments FK_ba265816ca1d93f51083e06c520; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT "FK_ba265816ca1d93f51083e06c520" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: project_requests FK_ba91413ed0daddd79814a09ef4d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT "FK_ba91413ed0daddd79814a09ef4d" FOREIGN KEY ("brokerId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_flags FK_ba9ed3cec568084e68b8cb382a8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_flags
    ADD CONSTRAINT "FK_ba9ed3cec568084e68b8cb382a8" FOREIGN KEY ("appealResolvedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wizard_options FK_bc14ab4d06540c3bd1e408729e3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wizard_options
    ADD CONSTRAINT "FK_bc14ab4d06540c3bd1e408729e3" FOREIGN KEY (question_id) REFERENCES public.wizard_questions(id) ON DELETE CASCADE;


--
-- Name: disputes FK_bcfa408d5738fa2c2550bc2c073; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_bcfa408d5738fa2c2550bc2c073" FOREIGN KEY ("defendantId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_request_answers FK_bd1b708124a60b84cddb67a9fef; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_answers
    ADD CONSTRAINT "FK_bd1b708124a60b84cddb67a9fef" FOREIGN KEY ("questionId") REFERENCES public.wizard_questions(id) ON DELETE CASCADE;


--
-- Name: skill_mapping_rules FK_be9c9478a57973b539501713319; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skill_mapping_rules
    ADD CONSTRAINT "FK_be9c9478a57973b539501713319" FOREIGN KEY ("skillId") REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: documents FK_befd700a02312da4cc725ccaace; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "FK_befd700a02312da4cc725ccaace" FOREIGN KEY ("uploaderId") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: platform_settings FK_bf32a1bcd51436a0b202a00a834; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT "FK_bf32a1bcd51436a0b202a00a834" FOREIGN KEY ("updatedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_history FK_c1868055eed5213f0ea2cac9c1f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "FK_c1868055eed5213f0ea2cac9c1f" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dispute_messages FK_c663721f6b7170bd81b6df60fcc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_messages
    ADD CONSTRAINT "FK_c663721f6b7170bd81b6df60fcc" FOREIGN KEY ("hearingId") REFERENCES public.dispute_hearings(id);


--
-- Name: dispute_verdicts FK_c76130cead6c14ef502b45ebf87; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_verdicts
    ADD CONSTRAINT "FK_c76130cead6c14ef502b45ebf87" FOREIGN KEY ("adjudicatorId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: broker_proposals FK_cdfb328ffe79fb43e6b965076cd; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_proposals
    ADD CONSTRAINT "FK_cdfb328ffe79fb43e6b965076cd" FOREIGN KEY ("brokerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contracts FK_contracts_source_spec; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT "FK_contracts_source_spec" FOREIGN KEY ("sourceSpecId") REFERENCES public.project_specs(id) ON DELETE SET NULL;


--
-- Name: event_participants FK_d1b1a40ec360951071605b0f7a0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT "FK_d1b1a40ec360951071605b0f7a0" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hearing_statements FK_d2a9328c62241eaf82a83939db9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_statements
    ADD CONSTRAINT "FK_d2a9328c62241eaf82a83939db9" FOREIGN KEY ("hearingId") REFERENCES public.dispute_hearings(id) ON DELETE CASCADE;


--
-- Name: disputes FK_d3d83cc3eaaafdd439787146ed4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_d3d83cc3eaaafdd439787146ed4" FOREIGN KEY ("assignedStaffId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dispute_messages FK_dc82f55f2a951d0ef0582c9e030; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_messages
    ADD CONSTRAINT "FK_dc82f55f2a951d0ef0582c9e030" FOREIGN KEY ("relatedEvidenceId") REFERENCES public.dispute_evidences(id);


--
-- Name: dispute_schedule_proposals FK_dispute_schedule_proposals_dispute; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_schedule_proposals
    ADD CONSTRAINT "FK_dispute_schedule_proposals_dispute" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: dispute_schedule_proposals FK_dispute_schedule_proposals_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_schedule_proposals
    ADD CONSTRAINT "FK_dispute_schedule_proposals_user" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: dispute_view_states FK_dispute_view_states_dispute; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_view_states
    ADD CONSTRAINT "FK_dispute_view_states_dispute" FOREIGN KEY ("disputeId") REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: dispute_view_states FK_dispute_view_states_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_view_states
    ADD CONSTRAINT "FK_dispute_view_states_user" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks FK_e08fca67ca8966e6b9914bf2956; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "FK_e08fca67ca8966e6b9914bf2956" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: dispute_messages FK_e154dd9c8d78610a275b5c72536; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_messages
    ADD CONSTRAINT "FK_e154dd9c8d78610a275b5c72536" FOREIGN KEY ("senderId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_requests FK_e207c2a029bb73b35ad1453426a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_requests
    ADD CONSTRAINT "FK_e207c2a029bb73b35ad1453426a" FOREIGN KEY ("clientId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verification_documents FK_e3acb36093f2773ea7893b4c972; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT "FK_e3acb36093f2773ea7893b4c972" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: broker_proposals FK_e47dedae186b41203c8614a98e0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_proposals
    ADD CONSTRAINT "FK_e47dedae186b41203c8614a98e0" FOREIGN KEY ("requestId") REFERENCES public.project_requests(id) ON DELETE CASCADE;


--
-- Name: disputes FK_e823d628afa329e33896cbffd01; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT "FK_e823d628afa329e33896cbffd01" FOREIGN KEY ("escalatedToAdminId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: dispute_evidences FK_e99822e169b518e548bf4b72ad0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_evidences
    ADD CONSTRAINT "FK_e99822e169b518e548bf4b72ad0" FOREIGN KEY ("flaggedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: hearing_statements FK_edda350924cebff8659732193e1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_statements
    ADD CONSTRAINT "FK_edda350924cebff8659732193e1" FOREIGN KEY ("participantId") REFERENCES public.hearing_participants(id) ON DELETE CASCADE;


--
-- Name: reviews FK_ee90086bb783380da5453d240b9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "FK_ee90086bb783380da5453d240b9" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: event_reschedule_requests FK_efd9b7049628373061b4c17db01; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_reschedule_requests
    ADD CONSTRAINT "FK_efd9b7049628373061b4c17db01" FOREIGN KEY ("processedById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: escrows FK_f07f9d851481059289600bc4128; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT "FK_f07f9d851481059289600bc4128" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: kyc_verifications FK_f71e34495dae27087b5773b35b4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT "FK_f71e34495dae27087b5773b35b4" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_workloads FK_f74d45b106d825f29cc2e5b99cd; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_workloads
    ADD CONSTRAINT "FK_f74d45b106d825f29cc2e5b99cd" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports FK_f7790853594bca5892d390e1daf; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "FK_f7790853594bca5892d390e1daf" FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: event_reschedule_requests FK_f7d69babb32833a937c01c9dfcf; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_reschedule_requests
    ADD CONSTRAINT "FK_f7d69babb32833a937c01c9dfcf" FOREIGN KEY ("newEventId") REFERENCES public.calendar_events(id);


--
-- Name: project_request_answers FK_f80351df95d44f963e86f1c8d92; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_request_answers
    ADD CONSTRAINT "FK_f80351df95d44f963e86f1c8d92" FOREIGN KEY ("requestId") REFERENCES public.project_requests(id) ON DELETE CASCADE;


--
-- Name: reviews FK_f9238c3e3739dc40322f577fc46; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "FK_f9238c3e3739dc40322f577fc46" FOREIGN KEY ("reviewerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hearing_questions FK_fa6f17995c98740ae434dc7432d; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hearing_questions
    ADD CONSTRAINT "FK_fa6f17995c98740ae434dc7432d" FOREIGN KEY ("hearingId") REFERENCES public.dispute_hearings(id) ON DELETE CASCADE;


--
-- Name: verification_documents FK_fc6a9c92a9cc696671c2561b73e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT "FK_fc6a9c92a9cc696671c2561b73e" FOREIGN KEY ("verifiedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_expertise FK_fd18fc4e1930d961ced296f6e40; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_expertise
    ADD CONSTRAINT "FK_fd18fc4e1930d961ced296f6e40" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: digital_signatures FK_fda9661a44dca0e61b72fb4680a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digital_signatures
    ADD CONSTRAINT "FK_fda9661a44dca0e61b72fb4680a" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: documents FK_fe6ebd6e679c0feee3a7ecc0354; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "FK_fe6ebd6e679c0feee3a7ecc0354" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: staff_performances FK_feb22f7363173d1b0ef31b66018; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_performances
    ADD CONSTRAINT "FK_feb22f7363173d1b0ef31b66018" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_submissions FK_ffd7e03786e2ac6c1aed69a0503; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT "FK_ffd7e03786e2ac6c1aed69a0503" FOREIGN KEY ("reviewerId") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: kyc_access_logs FK_kyc_access_logs_kyc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_access_logs
    ADD CONSTRAINT "FK_kyc_access_logs_kyc" FOREIGN KEY ("kycId") REFERENCES public.kyc_verifications(id) ON DELETE CASCADE;


--
-- Name: kyc_access_logs FK_kyc_access_logs_reviewer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_access_logs
    ADD CONSTRAINT "FK_kyc_access_logs_reviewer" FOREIGN KEY ("reviewerId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_spec_signatures FK_project_spec_signatures_spec; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_spec_signatures
    ADD CONSTRAINT "FK_project_spec_signatures_spec" FOREIGN KEY ("specId") REFERENCES public.project_specs(id) ON DELETE CASCADE;


--
-- Name: project_spec_signatures FK_project_spec_signatures_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_spec_signatures
    ADD CONSTRAINT "FK_project_spec_signatures_user" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: project_specs FK_project_specs_parent_spec; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_specs
    ADD CONSTRAINT "FK_project_specs_parent_spec" FOREIGN KEY ("parentSpecId") REFERENCES public.project_specs(id) ON DELETE SET NULL;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: kv_store_34447448; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kv_store_34447448 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects no_delete_evidence_policy 4pweun_0; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "no_delete_evidence_policy 4pweun_0" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'disputes'::text) AND false));


--
-- Name: objects no_delete_evidence_policy 4pweun_1; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "no_delete_evidence_policy 4pweun_1" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'disputes'::text) AND false));


--
-- Name: objects no_update_evidence_policy 4pweun_0; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "no_update_evidence_policy 4pweun_0" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'disputes'::text) AND false));


--
-- Name: objects no_update_evidence_policy 4pweun_1; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "no_update_evidence_policy 4pweun_1" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'disputes'::text) AND false));


--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects upload_evidence_policy 4pweun_0; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "upload_evidence_policy 4pweun_0" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'disputes'::text) AND (EXISTS ( SELECT 1
   FROM public.disputes d
  WHERE (((d.id)::text = split_part(objects.name, '/'::text, 1)) AND ((d."raisedById" = auth.uid()) OR (d."defendantId" = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.users u
          WHERE ((u.id = auth.uid()) AND (u.role = ANY (ARRAY['STAFF'::public.users_role_enum, 'ADMIN'::public.users_role_enum])))))) AND (d.status = ANY (ARRAY['OPEN'::public.disputes_status_enum, 'IN_MEDIATION'::public.disputes_status_enum, 'APPEALED'::public.disputes_status_enum])))))));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: objects view_evidence_policy 4pweun_0; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "view_evidence_policy 4pweun_0" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'disputes'::text) AND (EXISTS ( SELECT 1
   FROM public.disputes d
  WHERE (((d.id)::text = split_part(objects.name, '/'::text, 1)) AND ((d."raisedById" = auth.uid()) OR (d."defendantId" = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.users u
          WHERE ((u.id = auth.uid()) AND (u.role = ANY (ARRAY['STAFF'::public.users_role_enum, 'ADMIN'::public.users_role_enum])))))))))));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: supabase_realtime project_requests; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.project_requests;


--
-- Name: supabase_realtime projects; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.projects;


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION hypopg(OUT indexname text, OUT indexrelid oid, OUT indrelid oid, OUT innatts integer, OUT indisunique boolean, OUT indkey int2vector, OUT indcollation oidvector, OUT indclass oidvector, OUT indoption oidvector, OUT indexprs pg_node_tree, OUT indpred pg_node_tree, OUT amid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg(OUT indexname text, OUT indexrelid oid, OUT indrelid oid, OUT innatts integer, OUT indisunique boolean, OUT indkey int2vector, OUT indcollation oidvector, OUT indclass oidvector, OUT indoption oidvector, OUT indexprs pg_node_tree, OUT indpred pg_node_tree, OUT amid oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_create_index(sql_order text, OUT indexrelid oid, OUT indexname text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_create_index(sql_order text, OUT indexrelid oid, OUT indexname text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_drop_index(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_drop_index(indexid oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_get_indexdef(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_get_indexdef(indexid oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_hidden_indexes(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_hidden_indexes() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_hide_index(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_hide_index(indexid oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_relation_size(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_relation_size(indexid oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_reset(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_reset() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_reset_index(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_reset_index() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_unhide_all_indexes(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_unhide_all_indexes() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hypopg_unhide_index(indexid oid); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.hypopg_unhide_index(indexid oid) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION index_advisor(query text); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.index_advisor(query text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE hypopg_list_indexes; Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON TABLE extensions.hypopg_list_indexes TO postgres WITH GRANT OPTION;


--
-- Name: TABLE hypopg_hidden_indexes; Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON TABLE extensions.hypopg_hidden_indexes TO postgres WITH GRANT OPTION;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

--
-- PostgreSQL database dump complete
--

