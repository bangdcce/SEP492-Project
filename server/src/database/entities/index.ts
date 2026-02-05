// User & Auth Entities
export { UserEntity, UserRole, BadgeType } from './user.entity';
export { SocialAccountEntity } from './social-account.entity';
export { ProfileEntity } from './profile.entity';
export { SavedFreelancerEntity } from './saved-freelancer.entity';
export { AuthSessionEntity } from './auth-session.entity';
export { UserTokenEntity, UserTokenType, UserTokenStatus } from './user-token.entity';

// Project Request Entities
export { ProjectRequestEntity, RequestStatus } from './project-request.entity';
export { WizardQuestionEntity } from './wizard-question.entity';
export { WizardOptionEntity } from './wizard-option.entity';
export { ProjectRequestAnswerEntity } from './project-request-answer.entity';
export { ProjectSpecEntity, ProjectSpecStatus } from './project-spec.entity';
export { ProjectRequestProposalEntity } from './project-request-proposal.entity';

// Project Management Entities
export { ProjectEntity, ProjectStatus, PricingModel } from './project.entity';
export { ProjectCategoryEntity } from './project-category.entity';
export { MilestoneEntity, MilestoneStatus } from './milestone.entity';
export { TaskEntity, TaskStatus } from './task.entity';
export { ContractEntity } from './contract.entity';
export { DigitalSignatureEntity } from './digital-signature.entity';
export { DocumentEntity, DocType } from './document.entity';

// Payment & Wallet Entities
export { WalletEntity, WalletStatus } from './wallet.entity';
export { TransactionEntity, TransactionType, TransactionStatus } from './transaction.entity';
export { EscrowEntity, EscrowStatus } from './escrow.entity';
export { PayoutMethodEntity } from './payout-method.entity';
export { FeeConfigEntity, FeeType } from './fee-config.entity';
export { PayoutRequestEntity, PayoutStatus } from './payout-request.entity';
export { PlatformSettingsEntity } from './platform-settings.entity';

// Trust & Dispute Entities
export {
  DisputeEntity,
  DisputeStatus,
  DisputeResult,
  DisputeCategory,
  DisputePriority,
  DisputeType,
  DisputePhase,
} from './dispute.entity';
export { DisputeNoteEntity } from './dispute-note.entity';
export { DisputeActivityEntity, DisputeAction } from './dispute-activity.entity';
export {
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
  HearingStatus,
  HearingStatementType,
  HearingParticipantRole,
  SpeakerRole,
  HearingTier,
} from './dispute-hearing.entity';
export { DisputeEvidenceEntity } from './dispute-evidence.entity';
export { DisputeMessageEntity, MessageType } from './dispute-message.entity';
export { DisputeSettlementEntity, SettlementStatus } from './dispute-settlement.entity';
export { DisputeVerdictEntity, FaultType } from './dispute-verdict.entity';
export { LegalSignatureEntity, LegalActionType } from './legal-signature.entity';
export { StaffPerformanceEntity } from './staff-performance.entity';
export { StaffLeavePolicyEntity } from './staff-leave-policy.entity';
export { StaffLeaveRequestEntity, LeaveStatus, LeaveType } from './staff-leave-request.entity';
export { DisputeResolutionFeedbackEntity } from './dispute-resolution-feedback.entity';

// Skill & Tagging Entities (Master Taxonomy System)
export { SkillDomainEntity } from './skill-domain.entity';
export { SkillEntity, SkillCategory } from './skill.entity';
export {
  UserSkillEntity,
  SkillPriority,
  SkillVerificationStatus,
  StaffExpertiseEntity,
} from './user-skill.entity';
export {
  DisputeSkillRequirementEntity,
  DisputeSkillSource,
  SkillMappingRuleEntity,
} from './dispute-skill.entity';

// Trust Score & User Status Entities
export { TrustScoreHistoryEntity } from './trust-score-history.entity';
export { UserFlagEntity, FlagStatus } from './user-flag.entity';
export { ReviewEntity } from './review.entity';
export { ReportEntity, ReportStatus, ReportReason } from './report.entity';
export { VerificationDocumentEntity, VerificationStatus } from './verification-document.entity';
export { NotificationEntity } from './notification.entity';
export { AuditLogEntity } from './audit-log.entity';

// Calendar & Scheduling Entities
export {
  CalendarEventEntity,
  EventType,
  EventStatus,
  EventPriority,
} from './calendar-event.entity';
export {
  EventParticipantEntity,
  ParticipantRole,
  ParticipantStatus,
  AttendanceStatus,
} from './event-participant.entity';
export { UserAvailabilityEntity, AvailabilityType } from './user-availability.entity';
export { StaffWorkloadEntity } from './staff-workload.entity';
export {
  EventRescheduleRequestEntity,
  RescheduleRequestStatus,
} from './event-reschedule-request.entity';
export { AutoScheduleRuleEntity, SchedulingStrategy } from './auto-schedule-rule.entity';
