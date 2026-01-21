# Data Dictionary

This document details the schema for all 42 entities in the project, grouped by functional module.

## 1. User & Identity

### UserEntity (`users`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `email` | `varchar(255)` | Unique email address |
| `passwordHash` | `varchar(255)` | Hashed password (nullable for OAuth) |
| `fullName` | `varchar(255)` | Display name |
| `role` | `enum` | **UserRole**: ADMIN, STAFF, BROKER, CLIENT, FREELANCER |
| `phoneNumber` | `varchar(20)` | Contact number (nullable) |
| `isVerified` | `boolean` | Email/Phone verification status |
| `totalProjectsFinished` | `int` | Stat: Projects completed |
| `totalDisputesLost` | `int` | Stat: Performance metric |
| `currentTrustScore` | `decimal(3,2)` | Computed reputation score (0.00-5.00) |
| `badge` | `enum` | **BadgeType** (Virtual): Computed status |
| `resetPasswordOtp` | `varchar(6)` | OTP for password reset |
| `createdAt` | `timestamp` | Creation time |
| `updatedAt` | `timestamp` | Last update time |

### ProfileEntity (`profiles`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Foreign Key -> UserEntity |
| `avatarUrl` | `text` | Profile image URL |
| `bio` | `text` | User biography |
| `companyName` | `varchar(255)` | Business name |
| `skills` | `text[]` | Array of skill tags |
| `portfolioLinks` | `jsonb` | List of `{title, url}` |
| `bankInfo` | `jsonb` | Encrypted/Stuctured bank details |

### SocialAccountEntity (`social_accounts`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Foreign Key -> UserEntity |
| `provider` | `varchar(50)` | e.g., 'google', 'facebook' |
| `providerId` | `varchar(255)` | ID from the provider |
| `email` | `varchar(255)` | Email from provider |
| `avatarUrl` | `text` | Avatar from provider |
| `payload` | `jsonb` | Raw profile data |

### AuthSessionEntity (`auth_sessions`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key (Session ID) |
| `userId` | `uuid` | User owner |
| `refreshTokenHash` | `varchar` | Hashed refresh token |
| `userAgent` | `varchar` | Device info |
| `ipAddress` | `varchar` | IP Address |
| `isRevoked` | `boolean` | If true, session is invalid |
| `expiresAt` | `timestamp` | Token expiration |
| `lastUsedAt` | `timestamp` | Last activity |

### UserTokenEntity (`user_tokens`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | User owner |
| `type` | `enum` | EMAIL_VERIFICATION, PASSWORD_RESET |
| `tokenHash` | `varchar` | Hashed token value |
| `status` | `enum` | PENDING, USED, REVOKED |
| `expiresAt` | `timestamp` | Expiration time |

### KycVerificationEntity (`kyc_verifications`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Submitting User |
| `fullNameOnDocument` | `varchar` | Name on ID |
| `documentNumber` | `varchar` | ID Number |
| `documentType` | `enum` | CCCD, PASSPORT, DRIVER_LICENSE |
| `documentFrontUrl` | `varchar` | Image URL |
| `documentBackUrl` | `varchar` | Image URL |
| `selfieUrl` | `varchar` | Image URL |
| `status` | `enum` | PENDING, APPROVED, REJECTED, EXPIRED |
| `rejectionReason` | `text` | Admin feedback if rejected |

### VerificationDocumentEntity (`verification_documents`)
*Supplement to KYC, for generic docs like degrees/certifications*
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Owner |
| `docType` | `varchar` | e.g., 'DEGREE', 'LICENSE' |
| `documentUrl` | `varchar` | File URL |
| `status` | `enum` | Verification status |

---

## 2. Finance Module

### WalletEntity (`wallets`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Owner |
| `balance` | `decimal(15,2)` | Available funds |
| `pendingBalance` | `decimal(15,2)` | Incoming (uncleared) |
| `heldBalance` | `decimal(15,2)` | Locked in Escrow |
| `totalDeposited` | `decimal(15,2)` | Lifetime statistic |
| `currency` | `varchar(3)` | 'VND' |
| `status` | `enum` | ACTIVE, FROZEN, SUSPENDED |

### TransactionEntity (`transactions`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `walletId` | `uuid` | Related Wallet |
| `amount` | `decimal(15,2)` | Transaction value |
| `fee` | `decimal(15,2)` | Processing fee |
| `netAmount` | `decimal(15,2)` | Amount - Fee |
| `type` | `enum` | DEPOSIT, WITHDRAWAL, ESCROW_HOLD... |
| `status` | `enum` | PENDING, COMPLETED, FAILED |
| `referenceType` | `varchar` | Entity type (Escrow, Payout...) |
| `referenceId` | `uuid` | Entity ID |
| `balanceAfter` | `decimal` | Audit trail balance |

### EscrowEntity (`escrows`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `projectId` | `uuid` | Project Context |
| `milestoneId` | `uuid` | Specific Milestone (Unique) |
| `totalAmount` | `decimal(15,2)` | Amount to hold |
| `fundedAmount` | `decimal(15,2)` | Amount deposited |
| `releasedAmount` | `decimal(15,2)` | Amount paid out |
| `developerShare` | `decimal` | Snapshot (85%) |
| `brokerShare` | `decimal` | Snapshot (10%) |
| `platformFee` | `decimal` | Snapshot (5%) |
| `status` | `enum` | PENDING, FUNDED, RELEASED, DISPUTED |
| `clientApproved` | `boolean` | Release trigger |

### PayoutRequestEntity (`payout_requests`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `walletId` | `uuid` | Requesting Wallet |
| `payoutMethodId` | `uuid` | Bank account used |
| `amount` | `decimal` | Withdrawal amount |
| `status` | `enum` | PENDING, APPROVED, PROCESSED... |
| `externalReference` | `varchar` | Bank transaction ID |
| `approver` | `uuid` | Admin ID (Relation) |

### PayoutMethodEntity (`payout_methods`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Owner |
| `bankName` | `varchar` | Bank Name |
| `accountNumber` | `varchar` | Bank Account No. |
| `accountHolderName` | `varchar` | Name on Account |
| `isDefault` | `boolean` | Preferred method |
| `isVerified` | `boolean` | Verification status |

### FeeConfigEntity (`fee_configs`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `feeType` | `enum` | PLATFORM_FEE, BROKER_COMMISSION... |
| `percentage` | `decimal(5,2)` | Rate (e.g., 5.00) |
| `minAmount` | `decimal` | Floor cap |
| `maxAmount` | `decimal` | Ceiling cap |
| `isActive` | `boolean` | Current rule status |

---

## 3. Project Management

### ProjectRequestEntity (`project_requests`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `clientId` | `uuid` | Creator |
| `title` | `varchar` | Request title |
| `description` | `text` | Detailed requirements |
| `status` | `enum` | PUBLIC_DRAFT, PRIVATE_DRAFT, HIRING... |
| `brokerId` | `uuid` | Assigned Broker (if any) |
| `budgetRange` | `varchar` | e.g. "10-20M" |

### ProjectEntity (`projects`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `requestId` | `uuid` | Origin Request |
| `clientId` | `uuid` | Client User |
| `brokerId` | `uuid` | Broker User |
| `freelancerId` | `uuid` | Freelancer User (Nullable) |
| `totalBudget` | `decimal` | Final contract value |
| `status` | `enum` | PLANNING, IN_PROGRESS, COMPLETED... |
| `startDate` | `timestamp` | Execution start |
| `endDate` | `timestamp` | Execution deadline |

### MilestoneEntity (`milestones`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `projectId` | `uuid` | Parent Project |
| `title` | `varchar` | Milestone Name |
| `amount` | `decimal` | Payout value |
| `status` | `enum` | PENDING, IN_PROGRESS, LOCKED... |
| `dueDate` | `timestamp` | Deadline |
| `proofOfWork` | `text` | Submission URL/Content |

### TaskEntity (`tasks`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `milestoneId` | `uuid` | Parent Milestone |
| `title` | `varchar` | Task Name |
| `status` | `enum` | TODO, IN_PROGRESS, DONE |
| `assignedTo` | `uuid` | Assignee |

### ProjectCategoryEntity (`project_categories`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `name` | `varchar` | Category Name |
| `slug` | `varchar` | URL-friendly name |

### SavedFreelancerEntity (`saved_freelancers`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `clientId` | `uuid` | User who saved |
| `freelancerId` | `uuid` | Role saved |

### DocumentEntity (`documents`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `projectId` | `uuid` | Context |
| `uploaderId` | `uuid` | Owner |
| `name` | `varchar` | File name |
| `fileUrl` | `varchar` | Storage path |
| `type` | `enum` | SRS, SDS, MOCKUP, REPORT |
| `version` | `int` | Version number |

### ContractEntity (`contracts`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `projectId` | `uuid` | Context |
| `contractUrl` | `varchar` | PDF path |
| `termsContent` | `text` | Raw text terms |
| `status` | `varchar` | DRAFT, SIGNED |

### DigitalSignatureEntity (`digital_signatures`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `contractId` | `uuid` | Parent Contract |
| `userId` | `uuid` | Signer |
| `signatureHash` | `varchar` | Cryptographic proof |
| `ipAddress` | `varchar` | Security audit |

---

## 4. Offers & Proposals

### ProjectRequestAnswerEntity (`project_request_answers`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `requestId` | `uuid` | Parent Request |
| `questionId` | `int` | Wizard Question |
| `optionId` | `int` | Selected Option |
| `valueText` | `text` | Free text answer |

### ProjectRequestProposalEntity (`project_request_proposals`)
*Freelancer bidding on a Request*
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `requestId` | `uuid` | Target Request |
| `freelancerId` | `uuid` | Bidder |
| `proposedBudget` | `decimal` | Bid amount |
| `coverLetter` | `text` | Introduction |
| `status` | `varchar` | PENDING, ACCEPTED, REJECTED |

### BrokerProposalEntity (`broker_proposals`)
*Broker applying to manage a Request*
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `requestId` | `uuid` | Target Request |
| `brokerId` | `uuid` | Applicant |
| `coverLetter` | `text` | Pitch |
| `status` | `enum` | PENDING, INVITED, ACCEPTED |

---

## 5. Dispute & Governance

### DisputeEntity (`disputes`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `projectId` | `uuid` | Context |
| `raisedById` | `uuid` | Plaintiff |
| `defendantId` | `uuid` | Defendant |
| `disputeType` | `enum` | e.g. CLIENT_VS_FREELANCER |
| `reason` | `text` | Initial claim |
| `evidence` | `jsonb` | Array of URLs |
| `status` | `enum` | OPEN, IN_MEDIATION, RESOLVED |
| `result` | `enum` | WIN_CLIENT, WIN_FREELANCER, SPLIT |
| `adminComment` | `text` | Verdict explanation |

### DisputeActivityEntity (`dispute_activities`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `disputeId` | `uuid` | Parent Dispute |
| `action` | `enum` | CREATED, RESOLVED, EVIDENCE_ADDED... |
| `description` | `varchar` | Human readable log |
| `isInternal` | `boolean` | Staff-only visibility |

### DisputeNoteEntity (`dispute_notes`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `disputeId` | `uuid` | Context |
| `content` | `text` | Note body |
| `isInternal` | `boolean` | Staff-only visibility |
| `noteType` | `varchar` | GENERAL, DECISION... |

### ReviewEntity (`reviews`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `projectId` | `uuid` | Context |
| `reviewerId` | `uuid` | Author |
| `targetUserId` | `uuid` | Subject |
| `rating` | `int` | 1-5 Stars |
| `comment` | `text` | Content |
| `weight` | `decimal` | Influence weight |

### ReportEntity (`reports`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `reporterId` | `uuid` | Reporter |
| `reviewId` | `uuid` | Flagged content |
| `reason` | `enum` | SPAM, HARASSMENT... |
| `status` | `enum` | PENDING, RESOLVED |

### UserFlagEntity (`user_flags`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Target User |
| `type` | `varchar` | Violation type |
| `severity` | `int` | 1-5 Scale |
| `status` | `enum` | ACTIVE, RESOLVED, EXPIRED |
| `description` | `text` | Details |

### TrustScoreHistoryEntity (`trust_score_history`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Owner |
| `totalScore` | `decimal` | Final Score |
| `behaviorScore` | `decimal` | Component Score |
| `calculatedAt` | `timestamp` | Snapshot time |

### DisputeHearingEntity (`dispute_hearings`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `disputeId` | `uuid` | Context |
| `status` | `enum` | SCHEDULED, IN_PROGRESS, COMPLETED |
| `scheduledAt` | `timestamp` | Meeting time |
| `meetingLink` | `varchar` | URL |

### HearingParticipantEntity (`hearing_participants`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `hearingId` | `uuid` | Context |
| `userId` | `uuid` | Participant |
| `role` | `enum` | WITNESS, OBSERVER... |
| `isOnline` | `boolean` | Live status |

### HearingStatementEntity (`hearing_statements`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `hearingId` | `uuid` | Context |
| `type` | `enum` | OPENING, EVIDENCE, CLOSING... |
| `content` | `text` | Statement text |
| `attachments` | `jsonb` | File URLs |

### HearingQuestionEntity (`hearing_questions`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `hearingId` | `uuid` | Context |
| `question` | `text` | Admin inquiry |
| `answer` | `text` | Participant response |

---

## 6. System & Configuration

### AuditLogEntity (`audit_logs`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `actorId` | `uuid` | Performer |
| `action` | `varchar` | Operation Name |
| `entityType` | `varchar` | Target Table |
| `beforeData` | `jsonb` | Previous State |
| `afterData` | `jsonb` | New State |

### NotificationEntity (`notifications`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `userId` | `uuid` | Recipient |
| `title` | `varchar` | Header |
| `body` | `text` | Content |
| `isRead` | `boolean` | Status |

### PlatformSettingsEntity (`platform_settings`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `key` | `varchar` | Config Key (PK) |
| `value` | `jsonb` | Flexible Config Object |

### WizardQuestionEntity (`wizard_questions`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `int` | Primary Key |
| `code` | `varchar` | Unique ID |
| `label` | `text` | User-facing text |
| `inputType` | `varchar` | TEXT, SELECT, RADIO... |

### WizardOptionEntity (`wizard_options`)
| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| `id` | `int` | Primary Key |
| `questionId` | `int` | Parent Question |
| `value` | `varchar` | Stored value |
| `label` | `text` | Display text |

