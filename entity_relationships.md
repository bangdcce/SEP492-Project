# Database Entity Relationships

## Table: audit_logs
- **ManyToOne** -> `UserEntity`

## Table: auth_sessions
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `AuthSessionEntity`

## Table: auto_schedule_rules
No defined relationships.

## Table: broker_proposals
- **ManyToOne** -> `ProjectRequestEntity`
- **ManyToOne** -> `UserEntity`

## Table: calendar_events
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `CalendarEventEntity`
- **OneToMany** -> `EventParticipantEntity`
- **OneToMany** -> `EventRescheduleRequestEntity`

## Table: contracts
- **ManyToOne** -> `ProjectEntity`
- **ManyToOne** -> `UserEntity`
- **OneToMany** -> `DigitalSignatureEntity`

## Table: digital_signatures
- **ManyToOne** -> `ContractEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_activities
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_evidences
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_hearings
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`
- **OneToMany** -> `HearingParticipantEntity`
- **OneToMany** -> `HearingStatementEntity`
- **OneToMany** -> `HearingQuestionEntity`
- **ManyToOne** -> `DisputeHearingEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `DisputeHearingEntity`
- **ManyToOne** -> `HearingParticipantEntity`
- **ManyToOne** -> `HearingStatementEntity`
- **ManyToOne** -> `HearingStatementEntity`
- **ManyToOne** -> `DisputeHearingEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_messages
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `DisputeMessageEntity`
- **ManyToOne** -> `DisputeEvidenceEntity`
- **ManyToOne** -> `DisputeHearingEntity`

## Table: dispute_notes
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_resolution_feedbacks
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_settlements
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: dispute_skill_requirements
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `SkillEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `SkillEntity`

## Table: dispute_verdicts
- **OneToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `DisputeVerdictEntity`

## Table: disputes
- **ManyToOne** -> `ProjectEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `MilestoneEntity`
- **ManyToOne** -> `DisputeEntity`
- **OneToMany** -> `DisputeNoteEntity`
- **OneToMany** -> `DisputeActivityEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: documents
- **ManyToOne** -> `ProjectEntity`
- **ManyToOne** -> `UserEntity`

## Table: escrows
- **ManyToOne** -> `ProjectEntity`
- **ManyToOne** -> `MilestoneEntity`
- **ManyToOne** -> `DisputeEntity`

## Table: event_participants
- **ManyToOne** -> `CalendarEventEntity`
- **ManyToOne** -> `UserEntity`

## Table: event_reschedule_requests
- **ManyToOne** -> `CalendarEventEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `CalendarEventEntity`

## Table: fee_configs
- **ManyToOne** -> `UserEntity`

## Table: kyc_verifications
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: legal_signatures
- **ManyToOne** -> `DisputeEntity`
- **ManyToOne** -> `UserEntity`

## Table: milestones
- **ManyToOne** -> `ProjectEntity`
- **OneToMany** -> `TaskEntity`
- **ManyToOne** -> `ProjectSpecEntity`

## Table: notifications
- **ManyToOne** -> `UserEntity`

## Table: payout_methods
- **ManyToOne** -> `UserEntity`

## Table: payout_requests
- **ManyToOne** -> `WalletEntity`
- **ManyToOne** -> `PayoutMethodEntity`
- **ManyToOne** -> `TransactionEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: platform_settings
- **ManyToOne** -> `UserEntity`

## Table: profiles
- **OneToOne** -> `UserEntity`

## Table: project_categories
No defined relationships.

## Table: project_request_answers
- **ManyToOne** -> `ProjectRequestEntity`
- **ManyToOne** -> `WizardQuestionEntity`
- **ManyToOne** -> `WizardOptionEntity`

## Table: project_request_proposals
- **ManyToOne** -> `ProjectRequestEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: project_requests
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **OneToMany** -> `ProjectRequestAnswerEntity`
- **OneToMany** -> `ProjectRequestProposalEntity`
- **OneToOne** -> `ProjectSpecEntity`
- **OneToMany** -> `BrokerProposalEntity`

## Table: project_specs
- **OneToOne** -> `ProjectRequestEntity`
- **OneToMany** -> `MilestoneEntity`

## Table: projects
- **ManyToOne** -> `ProjectRequestEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **OneToMany** -> `MilestoneEntity`
- **OneToMany** -> `ContractEntity`
- **OneToMany** -> `DocumentEntity`
- **ManyToMany** -> `ProjectCategoryEntity`

## Table: reports
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `ReviewEntity`
- **ManyToOne** -> `UserEntity`

## Table: reviews
- **ManyToOne** -> `ProjectEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: saved_freelancers
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: skill_domains
- **OneToMany** -> `SkillEntity`

## Table: skills
- **ManyToOne** -> `SkillDomainEntity`
- **OneToMany** -> `UserSkillEntity`

## Table: social_accounts
- **ManyToOne** -> `UserEntity`

## Table: staff_performances
- **ManyToOne** -> `UserEntity`

## Table: staff_workloads
- **ManyToOne** -> `UserEntity`

## Table: tasks
- **ManyToOne** -> `MilestoneEntity`
- **ManyToOne** -> `ProjectEntity`
- **ManyToOne** -> `UserEntity`

## Table: transactions
- **ManyToOne** -> `WalletEntity`

## Table: trust_score_history
- **ManyToOne** -> `UserEntity`

## Table: user_availabilities
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `CalendarEventEntity`

## Table: user_flags
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: user_skills
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `SkillEntity`
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `SkillEntity`

## Table: user_tokens
- **ManyToOne** -> `UserEntity`

## Table: users
- **OneToOne** -> `ProfileEntity`
- **OneToMany** -> `SocialAccountEntity`
- **OneToMany** -> `AuthSessionEntity`
- **OneToMany** -> `UserTokenEntity`
- **OneToMany** -> `SavedFreelancerEntity`
- **OneToMany** -> `ProjectRequestEntity`
- **OneToMany** -> `ProjectRequestEntity`
- **OneToMany** -> `ProjectRequestProposalEntity`
- **OneToMany** -> `BrokerProposalEntity`
- **OneToMany** -> `ProjectEntity`
- **OneToMany** -> `ProjectEntity`
- **OneToMany** -> `ProjectEntity`
- **OneToMany** -> `UserFlagEntity`

## Table: verification_documents
- **ManyToOne** -> `UserEntity`
- **ManyToOne** -> `UserEntity`

## Table: wallets
- **ManyToOne** -> `UserEntity`
- **OneToMany** -> `TransactionEntity`

## Table: wizard_options
- **ManyToOne** -> `WizardQuestionEntity`

## Table: wizard_questions
- **OneToMany** -> `WizardOptionEntity`
- **OneToMany** -> `ProjectRequestAnswerEntity`

