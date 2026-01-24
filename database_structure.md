# Database Entities Documentation

## Table: `audit_logs`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| actor_id | UUID | Foreign Key |
| action | VARCHAR | Action performed |
| entity_type | VARCHAR | Category or discriminator |
| entity_id | VARCHAR | entity_id |
| ip_address | VARCHAR | Client IP Address |
| user_agent | TEXT | User Agent string |
| before_data | JSONB | JSON data structure |
| after_data | JSONB | JSON data structure |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `auth_sessions`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| refreshTokenHash | VARCHAR | Unique digital fingerprint/hash |
| userAgent | VARCHAR | User Agent string |
| ipAddress | VARCHAR | Client IP Address |
| isRevoked | BOOLEAN | Flag: isRevoked |
| revokedAt | TIMESTAMP | Timestamp: When revoked |
| expiresAt | TIMESTAMP | Timestamp: When expires |
| createdAt | TIMESTAMP | Record creation timestamp |
| lastUsedAt | TIMESTAMP | Timestamp: When last Used |
| replacedBySessionId | UUID | Identifier for replaced By Session |
| validAccessFrom | TIMESTAMP | valid Access From |

---

## Table: `auto_schedule_rules`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| name | VARCHAR | Name or Identifier |
| description | TEXT | Detailed text content |
| eventType | ENUM | Rule áp dụng cho loại event nào |
| strategy | ENUM | Monetary or numerical value |
| defaultDurationMinutes | INT/DECIMAL | Time duration (minutes/hours) |
| bufferMinutes | INT/DECIMAL | buffer Minutes |
| maxStaffUtilizationRate | INT/DECIMAL | Staff chỉ nhận việc khi utilizationRate < X% |
| maxEventsPerStaffPerDay | INT/DECIMAL | Số event tối đa mỗi Staff/ngày |
| workingHoursStart | TIME | Giờ bắt đầu làm việc |
| workingHoursEnd | TIME | Giờ kết thúc làm việc |
| workingDays | JSONB | working Days |
| respectUserPreferredSlots | BOOLEAN | Ưu tiên khung giờ user đánh dấu PREFERRED |
| avoidLunchHours | BOOLEAN | avoid Lunch Hours |
| lunchStartTime | TIME | lunch Start Time |
| lunchEndTime | TIME | lunch End Time |
| maxRescheduleCount | INT/DECIMAL | Số lần dời lịch tối đa |
| minRescheduleNoticeHours | INT/DECIMAL | Phải dời trước ít nhất X giờ |
| autoAssignStaff | BOOLEAN | Tự động gán Staff khi tạo event |
| isActive | BOOLEAN | Flag: isActive |
| isDefault | BOOLEAN | Rule mặc định cho eventType này |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `broker_proposals`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| requestId | UUID | Identifier for request |
| brokerId | UUID | Identifier for broker |
| coverLetter | TEXT | cover Letter |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `calendar_events`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| type | ENUM | Category or discriminator |
| title | VARCHAR | Title or headline |
| description | TEXT | Detailed text content |
| priority | ENUM | Priority level (e.g. Low, High) |
| status | ENUM | Current status/state |
| startTime | TIMESTAMP | start Time |
| endTime | TIMESTAMP | end Time |
| durationMinutes | INT | Time duration (minutes/hours) |
| organizerId | UUID | Identifier for organizer |
| referenceId | VARCHAR | Identifier for reference |
| isAutoScheduled | BOOLEAN | TRUE = Hệ thống tự tạo |
| autoScheduleRuleId | VARCHAR | Rule đã dùng để auto-schedule |
| rescheduleCount | INT/DECIMAL | Count or quantity |
| previousEventId | UUID | Event cũ nếu là reschedule |
| lastRescheduledAt | TIMESTAMP | Date or Deadline |
| location | VARCHAR | Online, Room A, etc. |
| externalMeetingLink | VARCHAR | external Meeting Link |
| reminderMinutes | JSONB | Cấu hình nhắc nhở [15, 60, 1440] phút trước |
| notes | TEXT | Text content/notes |
| metadata | JSONB | JSON data structure |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `contracts`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| projectId | UUID | Identifier for project |
| title | VARCHAR | Title or headline |
| contractUrl | VARCHAR | URL link to resource |
| termsContent | TEXT | Detailed text content |
| status | VARCHAR | Current status/state |
| createdBy | UUID | Foreign Key |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `digital_signatures`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| contractId | UUID | Identifier for contract |
| userId | UUID | Identifier for user |
| signatureHash | VARCHAR | Unique digital fingerprint/hash |
| ipAddress | VARCHAR | Client IP Address |
| signedAt | TIMESTAMP | Record creation timestamp |

---

## Table: `dispute_activities`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| actorId | UUID | Identifier for actor |
| actorRole | ENUM | User role or permission level |
| action | ENUM | Action performed |
| description | VARCHAR | Detailed text content |
| metadata | JSONB | JSON data structure |
| isInternal | BOOLEAN | Flag: isInternal |
| timestamp | TIMESTAMP | Record creation timestamp |

---

## Table: `dispute_evidences`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| uploaderId | UUID | Người upload bằng chứng |
| uploaderRole | VARCHAR | User role or permission level |
| storagePath | VARCHAR | File path or storage key |
| fileName | VARCHAR | Name of the file |
| fileSize | INT | Dung lượng file tính bằng bytes |
| mimeType | VARCHAR | MIME type of file (e.g. image/png) |
| description | TEXT | Detailed text content |
| isFlagged | BOOLEAN | Flag: isFlagged |
| flagReason | TEXT | Reason or explanation text |
| flaggedById | UUID | Admin/Staff đã flag |
| flaggedAt | TIMESTAMP | Timestamp: When flagged |
| uploadedAt | TIMESTAMP | Record creation timestamp |

---

## Table: `dispute_hearings`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| scheduledAt | TIMESTAMP | Date or Deadline |
| startedAt | TIMESTAMP | Timestamp: When started |
| endedAt | TIMESTAMP | Timestamp: When ended |
| agenda | TEXT | agenda |
| requiredDocuments | JSONB | required Documents |
| moderatorId | UUID | Staff/Admin chủ trì phiên điều trần |
| isChatRoomActive | BOOLEAN | TRUE = Phòng chat đang hoạt động |
| estimatedDurationMinutes | INT | Time duration (minutes/hours) |
| rescheduleCount | INT/DECIMAL | Count or quantity |
| previousHearingId | VARCHAR | Phiên cũ nếu đây là reschedule |
| lastRescheduledAt | TIMESTAMP | Date or Deadline |
| summary | TEXT | Detailed text content |
| findings | TEXT | findings |
| pendingActions | JSONB | pending Actions |
| hearingNumber | INT/DECIMAL | Count or quantity |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |
| hearingId | UUID | Identifier for hearing |
| userId | UUID | Identifier for user |
| invitedAt | TIMESTAMP | Timestamp: When invited |
| confirmedAt | TIMESTAMP | Timestamp: When confirmed |
| joinedAt | TIMESTAMP | Timestamp: When joined |
| leftAt | TIMESTAMP | Timestamp: When left |
| isOnline | BOOLEAN | Flag: isOnline |
| lastOnlineAt | TIMESTAMP | Lần online gần nhất |
| totalOnlineMinutes | INT | Tổng phút online trong phiên |
| hasSubmittedStatement | BOOLEAN | Flag: hasSubmittedStatement |
| isRequired | BOOLEAN | Flag: isRequired |
| responseDeadline | TIMESTAMP | Hạn phản hồi lời mời |
| declineReason | TEXT | Lý do từ chối/xin dời |
| participantId | UUID | Identifier for participant |
| title | VARCHAR | Title or headline |
| content | TEXT | Detailed text content |
| attachments | JSONB | attachments |
| replyToStatementId | UUID | Identifier for reply To Statement |
| retractionOfStatementId | UUID | Identifier for retraction Of Statement |
| orderIndex | INT/DECIMAL | order Index |
| isRedacted | BOOLEAN | Flag: isRedacted |
| redactedReason | TEXT | Reason or explanation text |
| askedById | UUID | Identifier for asked By |
| targetUserId | UUID | Identifier for target User |
| question | TEXT | question |
| answer | TEXT | answer |
| answeredAt | TIMESTAMP | Timestamp: When answered |
| deadline | TIMESTAMP | Date or Deadline |
| cancelledAt | TIMESTAMP | Timestamp: When cancelled |
| cancelledById | UUID | Identifier for cancelled By |

---

## Table: `dispute_messages`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| senderId | UUID | Identifier for sender |
| senderRole | VARCHAR | Role lúc gửi: CLIENT/FREELANCER/BROKER/STAFF/ADMIN/SYSTEM |
| type | ENUM | Category or discriminator |
| content | TEXT | Nội dung chat text |
| replyToMessageId | UUID | Reply tin nhắn nào? |
| relatedEvidenceId | UUID | Tin nhắn này đang bàn luận về bằng chứng nào? |
| hearingId | UUID | Identifier for hearing |
| metadata | JSONB | JSON data structure |
| isHidden | BOOLEAN | Admin ẩn tin nhắn này |
| hiddenReason | TEXT | Reason or explanation text |
| hiddenById | VARCHAR | Identifier for hidden By |
| hiddenAt | TIMESTAMP | Timestamp: When hidden |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `dispute_notes`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| authorId | UUID | Identifier for author |
| authorRole | ENUM | User role or permission level |
| content | TEXT | Detailed text content |
| isInternal | BOOLEAN | Flag: isInternal |
| isPinned | BOOLEAN | Flag: isPinned |
| noteType | VARCHAR | Category or discriminator |
| attachments | JSONB | attachments |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `dispute_resolution_feedbacks`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| staffId | UUID | Staff đã xử lý dispute |
| userId | UUID | Identifier for user |
| userRole | VARCHAR | Role của user khi đánh giá |
| rating | INT | Score/Rating value |
| comment | TEXT | Text content/notes |
| fairnessRating | INT | Score/Rating value |
| responsivenessRating | INT | Score/Rating value |
| professionalismRating | INT | Score/Rating value |
| clarityRating | INT | Score/Rating value |
| isSatisfied | BOOLEAN | User có hài lòng với kết quả? |
| isReported | BOOLEAN | Flag: isReported |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `dispute_settlements`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| proposerId | UUID | Người đưa ra đề xuất hòa giải |
| proposerRole | VARCHAR | Role của người đề xuất |
| amountToFreelancer | INT/DECIMAL | Tiền chia cho Freelancer |
| amountToClient | INT/DECIMAL | Tiền trả lại Client |
| terms | TEXT | Điều kiện/ghi chú kèm theo đề xuất |
| status | ENUM | Current status/state |
| responderId | UUID | Identifier for responder |
| respondedAt | TIMESTAMP | Timestamp: When responded |
| rejectedReason | TEXT | Reason or explanation text |
| expiresAt | TIMESTAMP | Timestamp: When expires |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `dispute_skill_requirements`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| skillId | UUID | Skill to auto-assign when matched |
| addedById | UUID | Identifier for added By |
| notes | TEXT | Notes about why this skill is needed |
| createdAt | TIMESTAMP | Record creation timestamp |
| isActive | BOOLEAN | Flag: isActive |
| priority | INT | Priority when multiple rules match |

---

## Table: `dispute_verdicts`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| adjudicatorId | UUID | Staff/Admin ra phán quyết |
| adjudicatorRole | VARCHAR | User role or permission level |
| faultType | ENUM | Lỗi thuộc về nhóm nào? |
| faultyParty | VARCHAR | faulty Party |
| amountToFreelancer | INT/DECIMAL | Tiền chia cho Freelancer |
| amountToClient | INT/DECIMAL | Tiền trả lại Client |
| platformFee | INT/DECIMAL | Monetary or numerical value |
| trustScorePenalty | INT/DECIMAL | Score/Rating value |
| isBanTriggered | BOOLEAN | Cấm user này hoạt động tạm thời? |
| banDurationDays | INT | Time duration (minutes/hours) |
| warningMessage | TEXT | Cảnh cáo gửi cho bên có lỗi |
| tier | INT/DECIMAL | tier |
| isAppealVerdict | BOOLEAN | TRUE = Đây là phán quyết override từ Admin |
| overridesVerdictId | UUID | Identifier for overrides Verdict |
| issuedAt | TIMESTAMP | Record creation timestamp |

---

## Table: `disputes`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| projectId | UUID | Identifier for project |
| milestoneId | UUID | Identifier for milestone |
| raisedById | UUID | Identifier for raised By |
| raiserRole | ENUM | User role or permission level |
| defendantId | UUID | Identifier for defendant |
| defendantRole | ENUM | User role or permission level |
| disputeType | ENUM | Category or discriminator |
| category | ENUM | category |
| priority | ENUM | Priority level (e.g. Low, High) |
| disputedAmount | DECIMAL | Monetary or numerical value |
| reason | TEXT | Reason or explanation text |
| messages | TEXT | Text content/notes |
| evidence | JSONB | evidence |
| defendantResponse | TEXT | defendant Response |
| defendantEvidence | JSONB | defendant Evidence |
| defendantRespondedAt | TIMESTAMP | Timestamp: When defendant Responded |
| responseDeadline | TIMESTAMP | Date or Deadline |
| resolutionDeadline | TIMESTAMP | Date or Deadline |
| isOverdue | BOOLEAN | Flag: isOverdue |
| adminComment | TEXT | Text content/notes |
| resolvedById | UUID | Identifier for resolved By |
| resolvedAt | TIMESTAMP | Timestamp: When resolved |
| parentDisputeId | UUID | Identifier for parent Dispute |
| groupId | VARCHAR | Identifier for group |
| assignedStaffId | UUID | Staff được gán xử lý |
| assignedAt | TIMESTAMP | Timestamp: When assigned |
| currentTier | INT/DECIMAL | 1 = Staff xử lý, 2 = Admin phúc thẩm |
| escalatedToAdminId | UUID | Identifier for escalated To Admin |
| escalatedAt | TIMESTAMP | Timestamp: When escalated |
| escalationReason | TEXT | Lý do escalate lên Admin |
| acceptedSettlementId | VARCHAR | Identifier for accepted Settlement |
| isAutoResolved | BOOLEAN | TRUE = Auto-win do bị đơn không phản hồi |
| settlementAttempts | INT/DECIMAL | settlement Attempts |
| isAppealed | BOOLEAN | Flag: isAppealed |
| appealReason | TEXT | Reason or explanation text |
| appealedAt | TIMESTAMP | Timestamp: When appealed |
| appealDeadline | TIMESTAMP | Date or Deadline |
| appealResolvedById | VARCHAR | Identifier for appeal Resolved By |
| appealResolution | TEXT | appeal Resolution |
| appealResolvedAt | TIMESTAMP | Timestamp: When appeal Resolved |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `documents`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| projectId | UUID | Identifier for project |
| uploaderId | UUID | Identifier for uploader |
| name | VARCHAR | Name or Identifier |
| fileUrl | VARCHAR | URL link to resource |
| version | INT | version |
| description | TEXT | Detailed text content |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `escrows`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| projectId | UUID | Identifier for project |
| milestoneId | UUID | Identifier for milestone |
| developerPercentage | DECIMAL | Percentage value (0-100) |
| brokerPercentage | DECIMAL | Percentage value (0-100) |
| platformPercentage | DECIMAL | Percentage value (0-100) |
| currency | VARCHAR | Currency code (e.g. VND, USD) |
| fundedAt | TIMESTAMP | Timestamp: When funded |
| releasedAt | TIMESTAMP | Timestamp: When released |
| refundedAt | TIMESTAMP | Timestamp: When refunded |
| clientApproved | BOOLEAN | client Approved |
| clientApprovedAt | TIMESTAMP | Timestamp: When client Approved |
| clientWalletId | UUID | Identifier for client Wallet |
| developerWalletId | UUID | Identifier for developer Wallet |
| brokerWalletId | UUID | Identifier for broker Wallet |
| holdTransactionId | UUID | Identifier for hold Transaction |
| releaseTransactionIds | JSONB | release Transaction Ids |
| refundTransactionId | UUID | Identifier for refund Transaction |
| disputeId | UUID | Identifier for dispute |
| notes | TEXT | Text content/notes |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `event_participants`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| eventId | UUID | Identifier for event |
| userId | UUID | Identifier for user |
| role | ENUM | User role or permission level |
| status | ENUM | Current status/state |
| responseDeadline | TIMESTAMP | Hạn phản hồi lời mời |
| respondedAt | TIMESTAMP | Timestamp: When responded |
| responseNote | TEXT | Lý do từ chối/ghi chú |
| joinedAt | TIMESTAMP | Thời điểm vào event |
| leftAt | TIMESTAMP | Thời điểm rời event |
| isOnline | BOOLEAN | Flag: isOnline |
| lateMinutes | INT | late Minutes |
| excuseReason | TEXT | Reason or explanation text |
| excuseApproved | BOOLEAN | excuse Approved |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `event_reschedule_requests`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| eventId | UUID | Identifier for event |
| requesterId | UUID | Người yêu cầu dời lịch |
| reason | TEXT | Lý do xin dời lịch |
| useAutoSchedule | BOOLEAN | TRUE = Để hệ thống tự tìm giờ phù hợp |
| status | ENUM | Current status/state |
| processedById | UUID | Staff/Admin xử lý |
| processedAt | TIMESTAMP | Timestamp: When processed |
| processNote | TEXT | Ghi chú khi approve/reject |
| newEventId | UUID | Identifier for new Event |
| selectedNewStartTime | TIMESTAMP | Thời gian mới được chọn |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `fee_configs`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| feeType | ENUM | Category or discriminator |
| description | VARCHAR | Detailed text content |
| isActive | BOOLEAN | Flag: isActive |
| effectiveFrom | TIMESTAMP | effective From |
| effectiveTo | TIMESTAMP | effective To |
| updatedBy | UUID | Date or Deadline |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `kyc_verifications`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| fullNameOnDocument | VARCHAR | Name or Identifier |
| documentNumber | VARCHAR | Count or quantity |
| documentType | ENUM | Category or discriminator |
| dateOfBirth | DATE | Date or Deadline |
| documentExpiryDate | DATE | Date or Deadline |
| documentFrontUrl | VARCHAR | URL link to resource |
| documentBackUrl | VARCHAR | URL link to resource |
| selfieUrl | VARCHAR | URL link to resource |
| status | ENUM | Current status/state |
| rejectionReason | TEXT | Reason or explanation text |
| reviewedBy | UUID | Foreign Key |
| reviewedAt | TIMESTAMP | Timestamp: When reviewed |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `legal_signatures`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| disputeId | UUID | Identifier for dispute |
| signerId | UUID | Identifier for signer |
| signerRole | VARCHAR | Role lúc ký |
| actionType | ENUM | Category or discriminator |
| termsContentSnapshot | TEXT | Snapshot nội dung điều khoản User đã đọc lúc bấm nút |
| termsVersion | VARCHAR | Version của điều khoản |
| referenceType | VARCHAR | Category or discriminator |
| referenceId | VARCHAR | Identifier for reference |
| ipAddress | VARCHAR | IP Address của User lúc ký |
| userAgent | TEXT | Trình duyệt/Thiết bị lúc ký |
| signedAt | TIMESTAMP | Record creation timestamp |

---

## Table: `milestones`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| projectId | UUID | Identifier for project |
| title | VARCHAR | Title or headline |
| description | TEXT | Detailed text content |
| amount | DECIMAL | Monetary or numerical value |
| projectSpecId | UUID | Identifier for project Spec |
| startDate | TIMESTAMP | Date or Deadline |
| dueDate | TIMESTAMP | Date or Deadline |
| proofOfWork | VARCHAR | proof Of Work |
| feedback | TEXT | Monetary or numerical value |
| sortOrder | INT | sort Order |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `notifications`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| title | VARCHAR | Title or headline |
| body | TEXT | Detailed text content |
| isRead | BOOLEAN | Flag: isRead |
| readAt | TIMESTAMP | Timestamp: When read |
| relatedType | VARCHAR | Category or discriminator |
| relatedId | VARCHAR | Identifier for related |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `payout_methods`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| bankName | VARCHAR | Name or Identifier |
| bankCode | VARCHAR | bank Code |
| accountNumber | VARCHAR | Count or quantity |
| accountHolderName | VARCHAR | Name or Identifier |
| branchName | VARCHAR | Name or Identifier |
| isDefault | BOOLEAN | Flag: isDefault |
| isVerified | BOOLEAN | Flag: isVerified |
| verifiedAt | TIMESTAMP | Timestamp: When verified |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `payout_requests`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| walletId | UUID | Identifier for wallet |
| payoutMethodId | UUID | Identifier for payout Method |
| currency | VARCHAR | Currency code (e.g. VND, USD) |
| approvedAt | TIMESTAMP | Timestamp: When approved |
| approvedBy | UUID | Foreign Key |
| rejectedAt | TIMESTAMP | Timestamp: When rejected |
| rejectedBy | VARCHAR | rejected By |
| rejectionReason | TEXT | Reason or explanation text |
| processedAt | TIMESTAMP | Timestamp: When processed |
| processedBy | UUID | processed By |
| externalReference | VARCHAR | external Reference |
| transactionId | UUID | Identifier for transaction |
| note | TEXT | Text content/notes |
| adminNote | TEXT | Text content/notes |
| requestedAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `platform_settings`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| value | JSONB | value |
| updatedAt | TIMESTAMP | Date or Deadline |
| updatedBy | UUID | Date or Deadline |

---

## Table: `profiles`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| avatarUrl | TEXT | URL link to resource |
| bio | TEXT | Biography / Self-description |
| companyName | VARCHAR | Name or Identifier |
| skills | TEXT | skills |
| portfolioLinks | JSONB | portfolio Links |
| linkedinUrl | TEXT | URL link to resource |
| cvUrl | TEXT | URL link to resource |
| bankInfo | JSONB | JSON data structure |

---

## Table: `project_categories`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| name | VARCHAR | Name or Identifier |
| slug | VARCHAR | URL-friendly identifier |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `project_request_answers`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| requestId | UUID | Identifier for request |
| questionId | UUID | Identifier for question |
| optionId | UUID | Identifier for option |
| valueText | TEXT | value Text |

---

## Table: `project_request_proposals`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| requestId | UUID | Identifier for request |
| freelancerId | UUID | Identifier for freelancer |
| brokerId | UUID | Identifier for broker |
| proposedBudget | DECIMAL | Monetary or numerical value |
| estimatedDuration | VARCHAR | Time duration (minutes/hours) |
| coverLetter | TEXT | cover Letter |
| status | VARCHAR | Current status/state |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `project_requests`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| clientId | UUID | Identifier for client |
| title | VARCHAR | Title or headline |
| description | TEXT | Detailed text content |
| budgetRange | VARCHAR | Monetary or numerical value |
| intendedTimeline | VARCHAR | intended Timeline |
| techPreferences | VARCHAR | JSON data structure |
| brokerId | UUID | Identifier for broker |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `project_specs`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| requestId | UUID | Identifier for request |
| title | VARCHAR | Title or headline |
| description | TEXT | Detailed text content |
| totalBudget | DECIMAL | Monetary or numerical value |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `projects`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| requestId | UUID | Identifier for request |
| clientId | UUID | Identifier for client |
| brokerId | UUID | Identifier for broker |
| freelancerId | UUID | Identifier for freelancer |
| title | VARCHAR | Title or headline |
| description | TEXT | Detailed text content |
| totalBudget | DECIMAL | Monetary or numerical value |
| currency | VARCHAR | Currency code (e.g. VND, USD) |
| startDate | TIMESTAMP | Date or Deadline |
| endDate | TIMESTAMP | Date or Deadline |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Date or Deadline |

---

## Table: `reports`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| reporter_id | UUID | Foreign Key |
| review_id | UUID | Foreign Key |
| reason | ENUM | Reason or explanation text |
| description | TEXT | Detailed text content |
| status | ENUM | Current status/state |
| resolved_by | UUID | Foreign Key |
| admin_note | TEXT | Text content/notes |
| createdAt | TIMESTAMP | Record creation timestamp |
| resolved_at | TIMESTAMP | resolved_at |

---

## Table: `reviews`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| projectId | UUID | Identifier for project |
| reviewerId | UUID | Identifier for reviewer |
| targetUserId | UUID | Identifier for target User |
| rating | INT | Score/Rating value |
| comment | TEXT | Text content/notes |
| weight | DECIMAL | weight |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |
| deleted_by | UUID | deleted_by |
| delete_reason | TEXT | Reason or explanation text |

---

## Table: `saved_freelancers`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| clientId | UUID | Identifier for client |
| freelancerId | UUID | Identifier for freelancer |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `skill_domains`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| name | VARCHAR | Name or Identifier |
| description | TEXT | Description of the domain |
| isActive | BOOLEAN | Is this domain active for selection? |
| sortOrder | INT | Display order in UI |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `skills`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| domainId | UUID | Identifier for domain |
| name | VARCHAR | Name or Identifier |
| description | TEXT | Description of the skill |
| icon | VARCHAR | Icon name or URL |
| forFreelancer | BOOLEAN | Can Freelancers select this skill? |
| forBroker | BOOLEAN | Can Brokers select this skill? |
| forStaff | BOOLEAN | Is this an audit skill for Staff? |
| isActive | BOOLEAN | Is this skill active for selection? |
| sortOrder | INT | Display order in UI |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `social_accounts`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| provider | VARCHAR | provider |
| providerId | VARCHAR | Identifier for provider |
| email | VARCHAR | Email address |
| avatarUrl | TEXT | URL link to resource |
| payload | JSONB | payload |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `staff_performances`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| staffId | UUID | User có role = STAFF |
| period | VARCHAR | period |
| totalDisputesAssigned | INT/DECIMAL | Số vụ được gán trong kỳ |
| totalDisputesResolved | INT/DECIMAL | Số vụ đã xử lý xong |
| totalDisputesPending | INT/DECIMAL | Số vụ đang pending |
| totalAppealed | INT/DECIMAL | Số vụ bị kháng cáo |
| totalOverturnedByAdmin | INT/DECIMAL | Số vụ bị Admin đảo ngược quyết định |
| totalUserRatings | INT/DECIMAL | Số lượt rating từ user |
| totalHearingsConducted | INT/DECIMAL | Số phiên điều trần đã chủ trì |
| totalHearingsRescheduled | INT/DECIMAL | Monetary or numerical value |
| pendingAppealCases | INT/DECIMAL | pending Appeal Cases |
| totalCasesFinalized | INT/DECIMAL | Monetary or numerical value |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `staff_workloads`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| staffId | UUID | User có role = STAFF |
| date | DATE | Ngày tính workload |
| totalEventsScheduled | INT/DECIMAL | Số event đã lên lịch trong ngày |
| totalDisputesPending | INT/DECIMAL | Monetary or numerical value |
| scheduledMinutes | INT/DECIMAL | Tổng số phút đã book trong ngày |
| dailyCapacityMinutes | INT/DECIMAL | daily Capacity Minutes |
| isOverloaded | BOOLEAN | TRUE = utilizationRate > 90% |
| canAcceptNewEvent | BOOLEAN | can Accept New Event |
| isOnLeave | BOOLEAN | TRUE = Staff đánh dấu nghỉ ngày này |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `tasks`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| milestoneId | UUID | Identifier for milestone |
| projectId | UUID | Identifier for project |
| title | VARCHAR | Title or headline |
| description | TEXT | Detailed text content |
| assignedTo | UUID | Foreign Key |
| dueDate | TIMESTAMP | Date or Deadline |
| sortOrder | INT | sort Order |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `transactions`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| walletId | UUID | Identifier for wallet |
| currency | VARCHAR | Currency code (e.g. VND, USD) |
| type | ENUM | Category or discriminator |
| referenceType | VARCHAR | Category or discriminator |
| referenceId | UUID | Identifier for reference |
| paymentMethod | VARCHAR | payment Method |
| externalTransactionId | VARCHAR | Identifier for external Transaction |
| metadata | JSONB | JSON data structure |
| description | TEXT | Detailed text content |
| failureReason | TEXT | Reason or explanation text |
| initiatedBy | VARCHAR | initiated By |
| ipAddress | VARCHAR | Client IP Address |
| relatedTransactionId | UUID | Identifier for related Transaction |
| completedAt | TIMESTAMP | Timestamp: When completed |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `trust_score_history`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| ratingScore | DECIMAL | Score/Rating value |
| behaviorScore | DECIMAL | Score/Rating value |
| disputeScore | DECIMAL | Score/Rating value |
| verificationScore | DECIMAL | Score/Rating value |
| totalScore | DECIMAL | Monetary or numerical value |
| calculatedAt | TIMESTAMP | Record creation timestamp |

---

## Table: `user_availabilities`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| startTime | TIMESTAMP | start Time |
| endTime | TIMESTAMP | end Time |
| type | ENUM | Category or discriminator |
| isRecurring | BOOLEAN | Flag: isRecurring |
| dayOfWeek | INT | day Of Week |
| recurringStartTime | TIME | recurring Start Time |
| recurringEndTime | TIME | recurring End Time |
| recurringStartDate | DATE | Ngày bắt đầu hiệu lực của recurring |
| recurringEndDate | DATE | Date or Deadline |
| isAutoGenerated | BOOLEAN | TRUE = Tự động tạo từ CalendarEvent |
| linkedEventId | UUID | CalendarEvent đã tạo availability này |
| note | TEXT | Text content/notes |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `user_flags`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| type | VARCHAR | Category or discriminator |
| severity | INT | severity |
| description | TEXT | Detailed text content |
| metadata | JSONB | JSON data structure |
| isAutoGenerated | BOOLEAN | Monetary or numerical value |
| adminNote | TEXT | Text content/notes |
| resolution | TEXT | resolution |
| createdById | UUID | Identifier for created By |
| resolvedById | UUID | Identifier for resolved By |
| resolvedAt | TIMESTAMP | Timestamp: When resolved |
| appealReason | TEXT | Reason or explanation text |
| appealEvidence | JSONB | appeal Evidence |
| appealedAt | TIMESTAMP | Timestamp: When appealed |
| appealResolution | TEXT | appeal Resolution |
| appealResolvedById | UUID | Identifier for appeal Resolved By |
| appealResolvedAt | TIMESTAMP | Timestamp: When appeal Resolved |
| expiresAt | TIMESTAMP | Timestamp: When expires |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `user_skills`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| skillId | UUID | Identifier for skill |
| portfolioUrl | TEXT | Link to portfolio or proof |
| completedProjectsCount | INT | Number of completed projects using this skill |
| lastUsedAt | TIMESTAMP | When last used in a completed project |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |
| staffId | UUID | Staff user ID |
| certificationName | VARCHAR | Certification name if any |
| certificationExpiry | DATE | Certification expiry date |
| disputesHandled | INT | Disputes handled with this expertise |
| isActive | BOOLEAN | Is this expertise active? |

---

## Table: `user_tokens`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| tokenHash | VARCHAR | Unique digital fingerprint/hash |
| maxUses | INT | max Uses |
| useCount | INT | Count or quantity |
| expiresAt | TIMESTAMP | Timestamp: When expires |
| usedAt | TIMESTAMP | Timestamp: When used |
| createdIp | VARCHAR | created Ip |
| lastUsedIp | VARCHAR | last Used Ip |
| lastUsedUserAgent | VARCHAR | User Agent string |
| createdAt | TIMESTAMP | Record creation timestamp |

---

## Table: `users`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| email | VARCHAR | Email address |
| passwordHash | VARCHAR | Hashed password string |
| fullName | VARCHAR | Name or Identifier |
| phoneNumber | VARCHAR | Count or quantity |
| isVerified | BOOLEAN | Flag: isVerified |
| totalProjectsFinished | INT/DECIMAL | Monetary or numerical value |
| totalProjectsCancelled | INT/DECIMAL | Monetary or numerical value |
| totalDisputesLost | INT/DECIMAL | Monetary or numerical value |
| totalLateProjects | INT/DECIMAL | Monetary or numerical value |
| currentTrustScore | DECIMAL | Score/Rating value |
| resetpasswordotp | VARCHAR | resetpasswordotp |
| resetpasswordotpexpires | TIMESTAMP | resetpasswordotpexpires |
| isBanned | BOOLEAN | Flag: isBanned |
| banReason | TEXT | Reason or explanation text |
| bannedAt | TIMESTAMP | Timestamp: When banned |
| bannedBy | UUID | banned By |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `verification_documents`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| docType | VARCHAR | Category or discriminator |
| documentUrl | VARCHAR | URL link to resource |
| submittedAt | TIMESTAMP | Record creation timestamp |
| verifiedAt | TIMESTAMP | Timestamp: When verified |
| verifiedBy | UUID | Foreign Key |
| rejectReason | TEXT | Reason or explanation text |

---

## Table: `wallets`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| userId | UUID | Identifier for user |
| currency | VARCHAR | Currency code (e.g. VND, USD) |
| createdAt | TIMESTAMP | Record creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Table: `wizard_options`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| question_id | UUID | Foreign Key |
| value | VARCHAR | value |
| label | TEXT | label |
| sort_order | INT | sort_order |

---

## Table: `wizard_questions`

| Attribute | Data Type | Description |
| :--- | :--- | :--- |
| id | UUID | Primary Key |
| code | VARCHAR | code |
| label | TEXT | label |
| help_text | TEXT | help_text |
| input_type | VARCHAR | Category or discriminator |
| is_active | BOOLEAN | Flag: is_active |
| sort_order | INT | sort_order |
| created_at | TIMESTAMP | created_at |

---

