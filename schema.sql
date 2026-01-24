-- PostgreSQL Schema for Lucidchart Import (Minimal)

CREATE TABLE audit_logs (
  "id" UUID PRIMARY KEY,
  "actor_id" UUID
);

CREATE TABLE auth_sessions (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "replacedBySessionId" UUID
);

CREATE TABLE auto_schedule_rules (
  "id" UUID PRIMARY KEY
);

CREATE TABLE broker_proposals (
  "id" UUID PRIMARY KEY,
  "requestId" UUID,
  "brokerId" UUID
);

CREATE TABLE calendar_events (
  "id" UUID PRIMARY KEY,
  "organizerId" UUID,
  "previousEventId" UUID
);

CREATE TABLE contracts (
  "id" UUID PRIMARY KEY,
  "projectId" UUID,
  "createdBy" UUID
);

CREATE TABLE digital_signatures (
  "id" UUID PRIMARY KEY,
  "contractId" UUID,
  "userId" UUID
);

CREATE TABLE dispute_activities (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "actorId" UUID
);

CREATE TABLE dispute_evidences (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "uploaderId" UUID,
  "flaggedById" UUID
);

CREATE TABLE dispute_hearings (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "moderatorId" UUID,
  "hearingId" UUID,
  "userId" UUID,
  "participantId" UUID,
  "replyToStatementId" UUID,
  "retractionOfStatementId" UUID,
  "askedById" UUID,
  "targetUserId" UUID,
  "cancelledById" UUID
);

CREATE TABLE dispute_messages (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "senderId" UUID,
  "replyToMessageId" UUID,
  "relatedEvidenceId" UUID,
  "hearingId" UUID
);

CREATE TABLE dispute_notes (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "authorId" UUID
);

CREATE TABLE dispute_resolution_feedbacks (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "staffId" UUID,
  "userId" UUID
);

CREATE TABLE dispute_settlements (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "proposerId" UUID,
  "responderId" UUID
);

CREATE TABLE dispute_skill_requirements (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "skillId" UUID,
  "addedById" UUID
);

CREATE TABLE dispute_verdicts (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "adjudicatorId" UUID,
  "overridesVerdictId" UUID
);

CREATE TABLE disputes (
  "id" UUID PRIMARY KEY,
  "projectId" UUID,
  "raisedById" UUID,
  "defendantId" UUID,
  "resolvedById" UUID,
  "milestoneId" UUID,
  "parentDisputeId" UUID,
  "assignedStaffId" UUID,
  "escalatedToAdminId" UUID
);

CREATE TABLE documents (
  "id" UUID PRIMARY KEY,
  "projectId" UUID,
  "uploaderId" UUID
);

CREATE TABLE escrows (
  "id" UUID PRIMARY KEY,
  "projectId" UUID,
  "milestoneId" UUID,
  "disputeId" UUID
);

CREATE TABLE event_participants (
  "id" UUID PRIMARY KEY,
  "eventId" UUID,
  "userId" UUID
);

CREATE TABLE event_reschedule_requests (
  "id" UUID PRIMARY KEY,
  "eventId" UUID,
  "requesterId" UUID,
  "processedById" UUID,
  "newEventId" UUID
);

CREATE TABLE fee_configs (
  "id" UUID PRIMARY KEY,
  "updatedBy" UUID
);

CREATE TABLE kyc_verifications (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "reviewedBy" UUID
);

CREATE TABLE legal_signatures (
  "id" UUID PRIMARY KEY,
  "disputeId" UUID,
  "signerId" UUID
);

CREATE TABLE milestones (
  "id" UUID PRIMARY KEY,
  "projectId" UUID,
  "projectSpecId" UUID
);

CREATE TABLE notifications (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE payout_methods (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE payout_requests (
  "id" UUID PRIMARY KEY,
  "walletId" UUID,
  "payoutMethodId" UUID,
  "transactionId" UUID,
  "approvedBy" UUID,
  "processedBy" UUID
);

CREATE TABLE platform_settings (
  "id" UUID PRIMARY KEY,
  "updatedBy" UUID
);

CREATE TABLE profiles (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE project_categories (
  "id" UUID PRIMARY KEY
);

CREATE TABLE project_request_answers (
  "id" UUID PRIMARY KEY,
  "requestId" UUID,
  "questionId" UUID,
  "optionId" UUID
);

CREATE TABLE project_request_proposals (
  "id" UUID PRIMARY KEY,
  "requestId" UUID,
  "freelancerId" UUID,
  "brokerId" UUID
);

CREATE TABLE project_requests (
  "id" UUID PRIMARY KEY,
  "clientId" UUID,
  "brokerId" UUID
);

CREATE TABLE project_specs (
  "id" UUID PRIMARY KEY,
  "requestId" UUID
);

CREATE TABLE projects (
  "id" UUID PRIMARY KEY,
  "requestId" UUID,
  "clientId" UUID,
  "brokerId" UUID,
  "freelancerId" UUID
);

CREATE TABLE reports (
  "id" UUID PRIMARY KEY,
  "reporter_id" UUID,
  "review_id" UUID,
  "resolved_by" UUID
);

CREATE TABLE reviews (
  "id" UUID PRIMARY KEY,
  "projectId" UUID,
  "reviewerId" UUID,
  "targetUserId" UUID
);

CREATE TABLE saved_freelancers (
  "id" UUID PRIMARY KEY,
  "clientId" UUID,
  "freelancerId" UUID
);

CREATE TABLE skill_domains (
  "id" UUID PRIMARY KEY
);

CREATE TABLE skills (
  "id" UUID PRIMARY KEY,
  "domainId" UUID
);

CREATE TABLE social_accounts (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE staff_performances (
  "id" UUID PRIMARY KEY,
  "staffId" UUID
);

CREATE TABLE staff_workloads (
  "id" UUID PRIMARY KEY,
  "staffId" UUID
);

CREATE TABLE tasks (
  "id" UUID PRIMARY KEY,
  "milestoneId" UUID,
  "projectId" UUID,
  "assignedTo" UUID
);

CREATE TABLE transactions (
  "id" UUID PRIMARY KEY,
  "walletId" UUID
);

CREATE TABLE trust_score_history (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE user_availabilities (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "linkedEventId" UUID
);

CREATE TABLE user_flags (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "createdById" UUID,
  "resolvedById" UUID,
  "appealResolvedById" UUID
);

CREATE TABLE user_skills (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "skillId" UUID,
  "staffId" UUID
);

CREATE TABLE user_tokens (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE users (
  "id" UUID PRIMARY KEY
);

CREATE TABLE verification_documents (
  "id" UUID PRIMARY KEY,
  "userId" UUID,
  "verifiedBy" UUID
);

CREATE TABLE wallets (
  "id" UUID PRIMARY KEY,
  "userId" UUID
);

CREATE TABLE wizard_options (
  "id" UUID PRIMARY KEY,
  "question_id" UUID
);

CREATE TABLE wizard_questions (
  "id" UUID PRIMARY KEY
);

ALTER TABLE audit_logs ADD CONSTRAINT "fk_audit_logs_actor_id" FOREIGN KEY ("actor_id") REFERENCES users ("id");
ALTER TABLE auth_sessions ADD CONSTRAINT "fk_auth_sessions_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE auth_sessions ADD CONSTRAINT "fk_auth_sessions_replacedBySessionId" FOREIGN KEY ("replacedBySessionId") REFERENCES auth_sessions ("id");
ALTER TABLE broker_proposals ADD CONSTRAINT "fk_broker_proposals_requestId" FOREIGN KEY ("requestId") REFERENCES project_requests ("id");
ALTER TABLE broker_proposals ADD CONSTRAINT "fk_broker_proposals_brokerId" FOREIGN KEY ("brokerId") REFERENCES users ("id");
ALTER TABLE calendar_events ADD CONSTRAINT "fk_calendar_events_organizerId" FOREIGN KEY ("organizerId") REFERENCES users ("id");
ALTER TABLE calendar_events ADD CONSTRAINT "fk_calendar_events_previousEventId" FOREIGN KEY ("previousEventId") REFERENCES calendar_events ("id");
ALTER TABLE contracts ADD CONSTRAINT "fk_contracts_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE contracts ADD CONSTRAINT "fk_contracts_createdBy" FOREIGN KEY ("createdBy") REFERENCES users ("id");
ALTER TABLE digital_signatures ADD CONSTRAINT "fk_digital_signatures_contractId" FOREIGN KEY ("contractId") REFERENCES contracts ("id");
ALTER TABLE digital_signatures ADD CONSTRAINT "fk_digital_signatures_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE dispute_activities ADD CONSTRAINT "fk_dispute_activities_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_activities ADD CONSTRAINT "fk_dispute_activities_actorId" FOREIGN KEY ("actorId") REFERENCES users ("id");
ALTER TABLE dispute_evidences ADD CONSTRAINT "fk_dispute_evidences_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_evidences ADD CONSTRAINT "fk_dispute_evidences_uploaderId" FOREIGN KEY ("uploaderId") REFERENCES users ("id");
ALTER TABLE dispute_evidences ADD CONSTRAINT "fk_dispute_evidences_flaggedById" FOREIGN KEY ("flaggedById") REFERENCES users ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_moderatorId" FOREIGN KEY ("moderatorId") REFERENCES users ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_hearingId" FOREIGN KEY ("hearingId") REFERENCES dispute_hearings ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_hearingId" FOREIGN KEY ("hearingId") REFERENCES dispute_hearings ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_hearingId" FOREIGN KEY ("hearingId") REFERENCES dispute_hearings ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_askedById" FOREIGN KEY ("askedById") REFERENCES users ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_targetUserId" FOREIGN KEY ("targetUserId") REFERENCES users ("id");
ALTER TABLE dispute_hearings ADD CONSTRAINT "fk_dispute_hearings_cancelledById" FOREIGN KEY ("cancelledById") REFERENCES users ("id");
ALTER TABLE dispute_messages ADD CONSTRAINT "fk_dispute_messages_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_messages ADD CONSTRAINT "fk_dispute_messages_senderId" FOREIGN KEY ("senderId") REFERENCES users ("id");
ALTER TABLE dispute_messages ADD CONSTRAINT "fk_dispute_messages_replyToMessageId" FOREIGN KEY ("replyToMessageId") REFERENCES dispute_messages ("id");
ALTER TABLE dispute_messages ADD CONSTRAINT "fk_dispute_messages_relatedEvidenceId" FOREIGN KEY ("relatedEvidenceId") REFERENCES dispute_evidences ("id");
ALTER TABLE dispute_messages ADD CONSTRAINT "fk_dispute_messages_hearingId" FOREIGN KEY ("hearingId") REFERENCES dispute_hearings ("id");
ALTER TABLE dispute_notes ADD CONSTRAINT "fk_dispute_notes_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_notes ADD CONSTRAINT "fk_dispute_notes_authorId" FOREIGN KEY ("authorId") REFERENCES users ("id");
ALTER TABLE dispute_resolution_feedbacks ADD CONSTRAINT "fk_dispute_resolution_feedbacks_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_resolution_feedbacks ADD CONSTRAINT "fk_dispute_resolution_feedbacks_staffId" FOREIGN KEY ("staffId") REFERENCES users ("id");
ALTER TABLE dispute_resolution_feedbacks ADD CONSTRAINT "fk_dispute_resolution_feedbacks_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE dispute_settlements ADD CONSTRAINT "fk_dispute_settlements_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_settlements ADD CONSTRAINT "fk_dispute_settlements_proposerId" FOREIGN KEY ("proposerId") REFERENCES users ("id");
ALTER TABLE dispute_settlements ADD CONSTRAINT "fk_dispute_settlements_responderId" FOREIGN KEY ("responderId") REFERENCES users ("id");
ALTER TABLE dispute_skill_requirements ADD CONSTRAINT "fk_dispute_skill_requirements_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_skill_requirements ADD CONSTRAINT "fk_dispute_skill_requirements_skillId" FOREIGN KEY ("skillId") REFERENCES skills ("id");
ALTER TABLE dispute_skill_requirements ADD CONSTRAINT "fk_dispute_skill_requirements_addedById" FOREIGN KEY ("addedById") REFERENCES users ("id");
ALTER TABLE dispute_skill_requirements ADD CONSTRAINT "fk_dispute_skill_requirements_skillId" FOREIGN KEY ("skillId") REFERENCES skills ("id");
ALTER TABLE dispute_verdicts ADD CONSTRAINT "fk_dispute_verdicts_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE dispute_verdicts ADD CONSTRAINT "fk_dispute_verdicts_adjudicatorId" FOREIGN KEY ("adjudicatorId") REFERENCES users ("id");
ALTER TABLE dispute_verdicts ADD CONSTRAINT "fk_dispute_verdicts_overridesVerdictId" FOREIGN KEY ("overridesVerdictId") REFERENCES dispute_verdicts ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_raisedById" FOREIGN KEY ("raisedById") REFERENCES users ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_defendantId" FOREIGN KEY ("defendantId") REFERENCES users ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_resolvedById" FOREIGN KEY ("resolvedById") REFERENCES users ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_milestoneId" FOREIGN KEY ("milestoneId") REFERENCES milestones ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_parentDisputeId" FOREIGN KEY ("parentDisputeId") REFERENCES disputes ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_assignedStaffId" FOREIGN KEY ("assignedStaffId") REFERENCES users ("id");
ALTER TABLE disputes ADD CONSTRAINT "fk_disputes_escalatedToAdminId" FOREIGN KEY ("escalatedToAdminId") REFERENCES users ("id");
ALTER TABLE documents ADD CONSTRAINT "fk_documents_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE documents ADD CONSTRAINT "fk_documents_uploaderId" FOREIGN KEY ("uploaderId") REFERENCES users ("id");
ALTER TABLE escrows ADD CONSTRAINT "fk_escrows_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE escrows ADD CONSTRAINT "fk_escrows_milestoneId" FOREIGN KEY ("milestoneId") REFERENCES milestones ("id");
ALTER TABLE escrows ADD CONSTRAINT "fk_escrows_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE event_participants ADD CONSTRAINT "fk_event_participants_eventId" FOREIGN KEY ("eventId") REFERENCES calendar_events ("id");
ALTER TABLE event_participants ADD CONSTRAINT "fk_event_participants_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE event_reschedule_requests ADD CONSTRAINT "fk_event_reschedule_requests_eventId" FOREIGN KEY ("eventId") REFERENCES calendar_events ("id");
ALTER TABLE event_reschedule_requests ADD CONSTRAINT "fk_event_reschedule_requests_requesterId" FOREIGN KEY ("requesterId") REFERENCES users ("id");
ALTER TABLE event_reschedule_requests ADD CONSTRAINT "fk_event_reschedule_requests_processedById" FOREIGN KEY ("processedById") REFERENCES users ("id");
ALTER TABLE event_reschedule_requests ADD CONSTRAINT "fk_event_reschedule_requests_newEventId" FOREIGN KEY ("newEventId") REFERENCES calendar_events ("id");
ALTER TABLE fee_configs ADD CONSTRAINT "fk_fee_configs_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES users ("id");
ALTER TABLE kyc_verifications ADD CONSTRAINT "fk_kyc_verifications_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE kyc_verifications ADD CONSTRAINT "fk_kyc_verifications_reviewedBy" FOREIGN KEY ("reviewedBy") REFERENCES users ("id");
ALTER TABLE legal_signatures ADD CONSTRAINT "fk_legal_signatures_disputeId" FOREIGN KEY ("disputeId") REFERENCES disputes ("id");
ALTER TABLE legal_signatures ADD CONSTRAINT "fk_legal_signatures_signerId" FOREIGN KEY ("signerId") REFERENCES users ("id");
ALTER TABLE milestones ADD CONSTRAINT "fk_milestones_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE milestones ADD CONSTRAINT "fk_milestones_projectSpecId" FOREIGN KEY ("projectSpecId") REFERENCES project_specs ("id");
ALTER TABLE notifications ADD CONSTRAINT "fk_notifications_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE payout_methods ADD CONSTRAINT "fk_payout_methods_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE payout_requests ADD CONSTRAINT "fk_payout_requests_walletId" FOREIGN KEY ("walletId") REFERENCES wallets ("id");
ALTER TABLE payout_requests ADD CONSTRAINT "fk_payout_requests_payoutMethodId" FOREIGN KEY ("payoutMethodId") REFERENCES payout_methods ("id");
ALTER TABLE payout_requests ADD CONSTRAINT "fk_payout_requests_transactionId" FOREIGN KEY ("transactionId") REFERENCES transactions ("id");
ALTER TABLE payout_requests ADD CONSTRAINT "fk_payout_requests_approvedBy" FOREIGN KEY ("approvedBy") REFERENCES users ("id");
ALTER TABLE payout_requests ADD CONSTRAINT "fk_payout_requests_processedBy" FOREIGN KEY ("processedBy") REFERENCES users ("id");
ALTER TABLE platform_settings ADD CONSTRAINT "fk_platform_settings_updatedBy" FOREIGN KEY ("updatedBy") REFERENCES users ("id");
ALTER TABLE profiles ADD CONSTRAINT "fk_profiles_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE project_request_answers ADD CONSTRAINT "fk_project_request_answers_requestId" FOREIGN KEY ("requestId") REFERENCES project_requests ("id");
ALTER TABLE project_request_answers ADD CONSTRAINT "fk_project_request_answers_questionId" FOREIGN KEY ("questionId") REFERENCES wizard_questions ("id");
ALTER TABLE project_request_answers ADD CONSTRAINT "fk_project_request_answers_optionId" FOREIGN KEY ("optionId") REFERENCES wizard_options ("id");
ALTER TABLE project_request_proposals ADD CONSTRAINT "fk_project_request_proposals_requestId" FOREIGN KEY ("requestId") REFERENCES project_requests ("id");
ALTER TABLE project_request_proposals ADD CONSTRAINT "fk_project_request_proposals_freelancerId" FOREIGN KEY ("freelancerId") REFERENCES users ("id");
ALTER TABLE project_request_proposals ADD CONSTRAINT "fk_project_request_proposals_brokerId" FOREIGN KEY ("brokerId") REFERENCES users ("id");
ALTER TABLE project_requests ADD CONSTRAINT "fk_project_requests_clientId" FOREIGN KEY ("clientId") REFERENCES users ("id");
ALTER TABLE project_requests ADD CONSTRAINT "fk_project_requests_brokerId" FOREIGN KEY ("brokerId") REFERENCES users ("id");
ALTER TABLE project_specs ADD CONSTRAINT "fk_project_specs_requestId" FOREIGN KEY ("requestId") REFERENCES project_requests ("id");
ALTER TABLE projects ADD CONSTRAINT "fk_projects_requestId" FOREIGN KEY ("requestId") REFERENCES project_requests ("id");
ALTER TABLE projects ADD CONSTRAINT "fk_projects_clientId" FOREIGN KEY ("clientId") REFERENCES users ("id");
ALTER TABLE projects ADD CONSTRAINT "fk_projects_brokerId" FOREIGN KEY ("brokerId") REFERENCES users ("id");
ALTER TABLE projects ADD CONSTRAINT "fk_projects_freelancerId" FOREIGN KEY ("freelancerId") REFERENCES users ("id");
ALTER TABLE reports ADD CONSTRAINT "fk_reports_reporter_id" FOREIGN KEY ("reporter_id") REFERENCES users ("id");
ALTER TABLE reports ADD CONSTRAINT "fk_reports_review_id" FOREIGN KEY ("review_id") REFERENCES reviews ("id");
ALTER TABLE reports ADD CONSTRAINT "fk_reports_resolved_by" FOREIGN KEY ("resolved_by") REFERENCES users ("id");
ALTER TABLE reviews ADD CONSTRAINT "fk_reviews_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE reviews ADD CONSTRAINT "fk_reviews_reviewerId" FOREIGN KEY ("reviewerId") REFERENCES users ("id");
ALTER TABLE reviews ADD CONSTRAINT "fk_reviews_targetUserId" FOREIGN KEY ("targetUserId") REFERENCES users ("id");
ALTER TABLE saved_freelancers ADD CONSTRAINT "fk_saved_freelancers_clientId" FOREIGN KEY ("clientId") REFERENCES users ("id");
ALTER TABLE saved_freelancers ADD CONSTRAINT "fk_saved_freelancers_freelancerId" FOREIGN KEY ("freelancerId") REFERENCES users ("id");
ALTER TABLE skills ADD CONSTRAINT "fk_skills_domainId" FOREIGN KEY ("domainId") REFERENCES skill_domains ("id");
ALTER TABLE social_accounts ADD CONSTRAINT "fk_social_accounts_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE staff_performances ADD CONSTRAINT "fk_staff_performances_staffId" FOREIGN KEY ("staffId") REFERENCES users ("id");
ALTER TABLE staff_workloads ADD CONSTRAINT "fk_staff_workloads_staffId" FOREIGN KEY ("staffId") REFERENCES users ("id");
ALTER TABLE tasks ADD CONSTRAINT "fk_tasks_milestoneId" FOREIGN KEY ("milestoneId") REFERENCES milestones ("id");
ALTER TABLE tasks ADD CONSTRAINT "fk_tasks_projectId" FOREIGN KEY ("projectId") REFERENCES projects ("id");
ALTER TABLE tasks ADD CONSTRAINT "fk_tasks_assignedTo" FOREIGN KEY ("assignedTo") REFERENCES users ("id");
ALTER TABLE transactions ADD CONSTRAINT "fk_transactions_walletId" FOREIGN KEY ("walletId") REFERENCES wallets ("id");
ALTER TABLE trust_score_history ADD CONSTRAINT "fk_trust_score_history_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE user_availabilities ADD CONSTRAINT "fk_user_availabilities_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE user_availabilities ADD CONSTRAINT "fk_user_availabilities_linkedEventId" FOREIGN KEY ("linkedEventId") REFERENCES calendar_events ("id");
ALTER TABLE user_flags ADD CONSTRAINT "fk_user_flags_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE user_flags ADD CONSTRAINT "fk_user_flags_createdById" FOREIGN KEY ("createdById") REFERENCES users ("id");
ALTER TABLE user_flags ADD CONSTRAINT "fk_user_flags_resolvedById" FOREIGN KEY ("resolvedById") REFERENCES users ("id");
ALTER TABLE user_flags ADD CONSTRAINT "fk_user_flags_appealResolvedById" FOREIGN KEY ("appealResolvedById") REFERENCES users ("id");
ALTER TABLE user_skills ADD CONSTRAINT "fk_user_skills_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE user_skills ADD CONSTRAINT "fk_user_skills_skillId" FOREIGN KEY ("skillId") REFERENCES skills ("id");
ALTER TABLE user_skills ADD CONSTRAINT "fk_user_skills_staffId" FOREIGN KEY ("staffId") REFERENCES users ("id");
ALTER TABLE user_skills ADD CONSTRAINT "fk_user_skills_skillId" FOREIGN KEY ("skillId") REFERENCES skills ("id");
ALTER TABLE user_tokens ADD CONSTRAINT "fk_user_tokens_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE verification_documents ADD CONSTRAINT "fk_verification_documents_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE verification_documents ADD CONSTRAINT "fk_verification_documents_verifiedBy" FOREIGN KEY ("verifiedBy") REFERENCES users ("id");
ALTER TABLE wallets ADD CONSTRAINT "fk_wallets_userId" FOREIGN KEY ("userId") REFERENCES users ("id");
ALTER TABLE wizard_options ADD CONSTRAINT "fk_wizard_options_question_id" FOREIGN KEY ("question_id") REFERENCES wizard_questions ("id");
