import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
  HearingStatus,
  HearingStatementType,
  HearingParticipantRole,
  DisputeEntity,
  DisputeStatus,
  UserEntity,
} from '../../database/entities';
import {
  ScheduleHearingDto,
  RescheduleHearingDto,
  SubmitStatementDto,
  AdminQuestionDto,
  AnswerQuestionDto,
  ConcludeHearingDto,
} from './dto';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_SCHEDULE_HOURS = 24; // Phải đặt lịch trước ít nhất 24h
const MAX_STATEMENTS_PER_TYPE = 3; // Tối đa 3 lời khai mỗi loại

// =============================================================================
// INTERFACES
// =============================================================================

export interface HearingCreateResult {
  hearing: DisputeHearingEntity;
  participants: HearingParticipantEntity[];
  notificationsSent: number;
}

export interface HearingRoomView {
  hearing: DisputeHearingEntity;
  participants: HearingParticipantEntity[];
  statements: HearingStatementEntity[];
  questions: HearingQuestionEntity[];
  myRole: HearingParticipantRole | null;
  canSubmitStatement: boolean;
  pendingQuestions: HearingQuestionEntity[];
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class HearingsService {
  constructor(
    @InjectRepository(DisputeHearingEntity)
    private hearingRepo: Repository<DisputeHearingEntity>,

    @InjectRepository(HearingParticipantEntity)
    private participantRepo: Repository<HearingParticipantEntity>,

    @InjectRepository(HearingStatementEntity)
    private statementRepo: Repository<HearingStatementEntity>,

    @InjectRepository(HearingQuestionEntity)
    private questionRepo: Repository<HearingQuestionEntity>,

    @InjectRepository(DisputeEntity)
    private disputeRepo: Repository<DisputeEntity>,

    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,

    private dataSource: DataSource,
  ) {}

  // ===========================================================================
  // ADMIN: SCHEDULE HEARING
  // ===========================================================================

  /**
   * Lên lịch phiên điều trần mới
   * - Chỉ Admin được phép
   * - Dispute phải đang IN_MEDIATION (đang được review)
   * - Phải đặt lịch trước ít nhất 24h
   */
  async scheduleHearing(
    disputeId: string,
    adminId: string,
    dto: ScheduleHearingDto,
  ): Promise<HearingCreateResult> {
    // === Validate dispute ===
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['raisedBy', 'defendant', 'project', 'project.broker'],
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // IN_MEDIATION is the review state
    if (dispute.status !== DisputeStatus.IN_MEDIATION) {
      throw new BadRequestException(
        `Cannot schedule hearing for dispute in ${dispute.status} status. Dispute must be IN_MEDIATION.`,
      );
    }

    // === Validate schedule time ===
    const scheduledAt = new Date(dto.scheduledAt);
    const minScheduleTime = new Date();
    minScheduleTime.setHours(minScheduleTime.getHours() + MIN_SCHEDULE_HOURS);

    if (scheduledAt < minScheduleTime) {
      throw new BadRequestException(
        `Hearing must be scheduled at least ${MIN_SCHEDULE_HOURS} hours in advance`,
      );
    }

    // === Check for conflicting hearings ===
    const existingHearings = await this.hearingRepo.count({
      where: {
        disputeId,
        status: In([HearingStatus.SCHEDULED, HearingStatus.IN_PROGRESS]),
      },
    });

    if (existingHearings > 0) {
      throw new ConflictException(
        'There is already an active or scheduled hearing for this dispute',
      );
    }

    // === Count previous hearings ===
    const previousHearings = await this.hearingRepo.count({
      where: { disputeId },
    });

    // === Create hearing ===
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create hearing
      const hearing = this.hearingRepo.create({
        disputeId,
        moderatorId: adminId,
        scheduledAt,
        agenda: dto.agenda,
        requiredDocuments: dto.requiredDocuments || [],
        meetingLink: dto.meetingLink,
        hearingNumber: previousHearings + 1,
        status: HearingStatus.SCHEDULED,
      });

      await queryRunner.manager.save(hearing);

      // === Create participants ===
      const participants: HearingParticipantEntity[] = [];

      // Raiser
      const raiserParticipant = this.participantRepo.create({
        hearingId: hearing.id,
        userId: dispute.raisedById,
        role: HearingParticipantRole.RAISER,
        invitedAt: new Date(),
      });
      participants.push(raiserParticipant);

      // Defendant
      const defendantParticipant = this.participantRepo.create({
        hearingId: hearing.id,
        userId: dispute.defendantId,
        role: HearingParticipantRole.DEFENDANT,
        invitedAt: new Date(),
      });
      participants.push(defendantParticipant);

      // Broker as observer (if exists and not already involved)
      if (
        dispute.project?.broker &&
        dispute.project.broker.id !== dispute.raisedById &&
        dispute.project.broker.id !== dispute.defendantId
      ) {
        const brokerParticipant = this.participantRepo.create({
          hearingId: hearing.id,
          userId: dispute.project.broker.id,
          role: HearingParticipantRole.OBSERVER,
          invitedAt: new Date(),
        });
        participants.push(brokerParticipant);
      }

      // Moderator
      const moderatorParticipant = this.participantRepo.create({
        hearingId: hearing.id,
        userId: adminId,
        role: HearingParticipantRole.MODERATOR,
        invitedAt: new Date(),
        confirmedAt: new Date(), // Admin tự động xác nhận
      });
      participants.push(moderatorParticipant);

      // Add additional participants if provided
      if (dto.additionalParticipantIds?.length) {
        for (const userId of dto.additionalParticipantIds) {
          // Check not duplicate
          if (!participants.find((p) => p.userId === userId)) {
            const additionalParticipant = this.participantRepo.create({
              hearingId: hearing.id,
              userId,
              role: HearingParticipantRole.WITNESS,
              invitedAt: new Date(),
            });
            participants.push(additionalParticipant);
          }
        }
      }

      await queryRunner.manager.save(participants);

      await queryRunner.commitTransaction();

      // TODO: Send notifications to all participants
      const notificationsSent = participants.length;

      return {
        hearing,
        participants,
        notificationsSent,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ===========================================================================
  // ADMIN: START HEARING
  // ===========================================================================

  /**
   * Bắt đầu phiên điều trần
   * - Chuyển status từ SCHEDULED sang IN_PROGRESS
   */
  async startHearing(hearingId: string, adminId: string): Promise<DisputeHearingEntity> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      relations: ['participants'],
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    if (hearing.moderatorId !== adminId) {
      throw new ForbiddenException('Only the assigned moderator can start this hearing');
    }

    if (hearing.status !== HearingStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot start hearing in ${hearing.status} status`);
    }

    hearing.status = HearingStatus.IN_PROGRESS;
    hearing.startedAt = new Date();

    return this.hearingRepo.save(hearing);
  }

  // ===========================================================================
  // ADMIN: RESCHEDULE HEARING
  // ===========================================================================

  async rescheduleHearing(
    hearingId: string,
    adminId: string,
    dto: RescheduleHearingDto,
  ): Promise<DisputeHearingEntity> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    if (hearing.moderatorId !== adminId) {
      throw new ForbiddenException('Only the assigned moderator can reschedule this hearing');
    }

    if (hearing.status !== HearingStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot reschedule hearing in ${hearing.status} status`);
    }

    // Validate new time
    const newScheduledAt = new Date(dto.newScheduledAt);
    const minScheduleTime = new Date();
    minScheduleTime.setHours(minScheduleTime.getHours() + MIN_SCHEDULE_HOURS);

    if (newScheduledAt < minScheduleTime) {
      throw new BadRequestException(
        `Hearing must be scheduled at least ${MIN_SCHEDULE_HOURS} hours in advance`,
      );
    }

    hearing.scheduledAt = newScheduledAt;
    hearing.status = HearingStatus.RESCHEDULED;

    if (dto.reason) {
      hearing.agenda = `[RESCHEDULED: ${dto.reason}]\n\n${hearing.agenda || ''}`;
    }

    // Reset confirmations from participants
    await this.participantRepo.update(
      { hearingId, role: In([HearingParticipantRole.RAISER, HearingParticipantRole.DEFENDANT]) },
      { confirmedAt: undefined as unknown as Date },
    );

    return this.hearingRepo.save(hearing);
  }

  // ===========================================================================
  // USER: CONFIRM ATTENDANCE
  // ===========================================================================

  async confirmAttendance(hearingId: string, userId: string): Promise<HearingParticipantEntity> {
    const participant = await this.participantRepo.findOne({
      where: { hearingId, userId },
    });

    if (!participant) {
      throw new NotFoundException('You are not a participant of this hearing');
    }

    if (participant.confirmedAt) {
      throw new BadRequestException('You have already confirmed attendance');
    }

    participant.confirmedAt = new Date();

    return this.participantRepo.save(participant);
  }

  // ===========================================================================
  // USER: JOIN HEARING ROOM
  // ===========================================================================

  async joinHearingRoom(hearingId: string, userId: string): Promise<HearingRoomView> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      relations: [
        'dispute',
        'participants',
        'participants.user',
        'statements',
        'statements.participant',
        'questions',
      ],
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    // Find participant
    const participant = hearing.participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new ForbiddenException('You are not a participant of this hearing');
    }

    // Update join time
    if (hearing.status === HearingStatus.IN_PROGRESS) {
      participant.joinedAt = new Date();
      participant.isOnline = true;
      await this.participantRepo.save(participant);
    }

    // Filter statements (hide redacted from non-admin)
    const visibleStatements =
      participant.role === HearingParticipantRole.MODERATOR
        ? hearing.statements
        : hearing.statements.filter((s) => !s.isRedacted);

    // Get pending questions for this user
    const pendingQuestions = hearing.questions.filter(
      (q) => q.targetUserId === userId && !q.answer,
    );

    // Check if user can submit statement
    const canSubmitStatement = await this.canSubmitStatement(hearing, participant);

    return {
      hearing,
      participants: hearing.participants,
      statements: visibleStatements.sort((a, b) => a.orderIndex - b.orderIndex),
      questions: hearing.questions.sort((a, b) => a.orderIndex - b.orderIndex),
      myRole: participant.role,
      canSubmitStatement,
      pendingQuestions,
    };
  }

  // ===========================================================================
  // USER: SUBMIT STATEMENT
  // ===========================================================================

  async submitStatement(
    hearingId: string,
    userId: string,
    dto: SubmitStatementDto,
  ): Promise<HearingStatementEntity> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      relations: ['participants', 'statements'],
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only submit statements during an active hearing');
    }

    // Find participant
    const participant = hearing.participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new ForbiddenException('You are not a participant of this hearing');
    }

    // Check statement limits
    const canSubmit = await this.canSubmitStatement(hearing, participant);
    if (!canSubmit) {
      throw new BadRequestException('You have reached the maximum number of statements');
    }

    // Validate rebuttal
    if (dto.type === HearingStatementType.REBUTTAL && dto.replyToStatementId) {
      const targetStatement = hearing.statements.find((s) => s.id === dto.replyToStatementId);
      if (!targetStatement) {
        throw new BadRequestException('Statement to rebut not found');
      }
      if (targetStatement.participantId === participant.id) {
        throw new BadRequestException('Cannot rebut your own statement');
      }
    }

    // Get next order index
    const maxOrderIndex = Math.max(...hearing.statements.map((s) => s.orderIndex), 0);

    const statement = this.statementRepo.create({
      hearingId,
      participantId: participant.id,
      type: dto.type,
      content: dto.content,
      attachments: dto.attachments || [],
      replyToStatementId: dto.replyToStatementId,
      orderIndex: maxOrderIndex + 1,
    });

    await this.statementRepo.save(statement);

    // Update participant flag
    participant.hasSubmittedStatement = true;
    await this.participantRepo.save(participant);

    return statement;
  }

  // ===========================================================================
  // ADMIN: ASK QUESTION
  // ===========================================================================

  async askQuestion(
    hearingId: string,
    adminId: string,
    dto: AdminQuestionDto,
  ): Promise<HearingQuestionEntity> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      relations: ['participants', 'questions'],
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    if (hearing.moderatorId !== adminId) {
      throw new ForbiddenException('Only the moderator can ask questions');
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only ask questions during an active hearing');
    }

    // Verify target is a participant
    const targetParticipant = hearing.participants.find((p) => p.userId === dto.targetUserId);

    if (!targetParticipant) {
      throw new BadRequestException('Target user is not a participant');
    }

    // Get next order index
    const maxOrderIndex = Math.max(...hearing.questions.map((q) => q.orderIndex), 0);

    // Calculate deadline
    let deadline: Date | undefined;
    if (dto.deadlineMinutes) {
      deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + dto.deadlineMinutes);
    }

    const question = this.questionRepo.create({
      hearingId,
      askedById: adminId,
      targetUserId: dto.targetUserId,
      question: dto.question,
      isRequired: dto.isRequired ?? false,
      deadline,
      orderIndex: maxOrderIndex + 1,
    });

    return this.questionRepo.save(question);
  }

  // ===========================================================================
  // USER: ANSWER QUESTION
  // ===========================================================================

  async answerQuestion(
    questionId: string,
    userId: string,
    dto: AnswerQuestionDto,
  ): Promise<HearingQuestionEntity> {
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
      relations: ['hearing'],
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (question.targetUserId !== userId) {
      throw new ForbiddenException('This question is not addressed to you');
    }

    if (question.hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only answer questions during an active hearing');
    }

    if (question.answer) {
      throw new BadRequestException('Question has already been answered');
    }

    // Check deadline
    if (question.deadline && new Date() > question.deadline) {
      throw new BadRequestException('Answer deadline has passed');
    }

    question.answer = dto.answer;
    question.answeredAt = new Date();

    return this.questionRepo.save(question);
  }

  // ===========================================================================
  // ADMIN: REDACT STATEMENT
  // ===========================================================================

  async redactStatement(
    statementId: string,
    adminId: string,
    reason: string,
  ): Promise<HearingStatementEntity> {
    const statement = await this.statementRepo.findOne({
      where: { id: statementId },
      relations: ['hearing'],
    });

    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.hearing.moderatorId !== adminId) {
      throw new ForbiddenException('Only the moderator can redact statements');
    }

    statement.isRedacted = true;
    statement.redactedReason = reason;

    return this.statementRepo.save(statement);
  }

  // ===========================================================================
  // ADMIN: CONCLUDE HEARING
  // ===========================================================================

  async concludeHearing(
    hearingId: string,
    adminId: string,
    dto: ConcludeHearingDto,
  ): Promise<DisputeHearingEntity> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      relations: ['questions', 'participants'],
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    if (hearing.moderatorId !== adminId) {
      throw new ForbiddenException('Only the moderator can conclude this hearing');
    }

    if (hearing.status !== HearingStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot conclude hearing in ${hearing.status} status`);
    }

    // Check for unanswered required questions
    const unansweredRequired = hearing.questions.filter((q) => q.isRequired && !q.answer);

    if (unansweredRequired.length > 0 && !dto.forceClose) {
      throw new BadRequestException(
        `There are ${unansweredRequired.length} unanswered required questions. Use forceClose=true to override.`,
      );
    }

    hearing.status = HearingStatus.COMPLETED;
    hearing.endedAt = new Date();
    hearing.summary = dto.summary;
    hearing.findings = dto.findings ?? '';
    hearing.pendingActions = dto.pendingActions || [];

    // Mark all participants as offline
    await this.participantRepo.update({ hearingId }, { isOnline: false, leftAt: new Date() });

    return this.hearingRepo.save(hearing);
  }

  // ===========================================================================
  // ADMIN: CANCEL HEARING
  // ===========================================================================

  async cancelHearing(
    hearingId: string,
    adminId: string,
    reason: string,
  ): Promise<DisputeHearingEntity> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
    });

    if (!hearing) {
      throw new NotFoundException('Hearing not found');
    }

    if (hearing.moderatorId !== adminId) {
      throw new ForbiddenException('Only the moderator can cancel this hearing');
    }

    if (!['SCHEDULED', 'RESCHEDULED'].includes(hearing.status)) {
      throw new BadRequestException(`Cannot cancel hearing in ${hearing.status} status`);
    }

    hearing.status = HearingStatus.CANCELED;
    hearing.summary = `[CANCELED] ${reason}`;

    return this.hearingRepo.save(hearing);
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  async getHearingsByDispute(disputeId: string): Promise<DisputeHearingEntity[]> {
    return this.hearingRepo.find({
      where: { disputeId },
      relations: ['participants', 'participants.user'],
      order: { hearingNumber: 'ASC' },
    });
  }

  async getUpcomingHearings(userId: string): Promise<DisputeHearingEntity[]> {
    const participations = await this.participantRepo.find({
      where: { userId },
      relations: ['hearing', 'hearing.dispute'],
    });

    return participations
      .filter(
        (p) =>
          p.hearing.status === HearingStatus.SCHEDULED ||
          p.hearing.status === HearingStatus.RESCHEDULED,
      )
      .map((p) => p.hearing)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  async getActiveHearings(adminId: string): Promise<DisputeHearingEntity[]> {
    return this.hearingRepo.find({
      where: {
        moderatorId: adminId,
        status: HearingStatus.IN_PROGRESS,
      },
      relations: ['dispute', 'participants'],
    });
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async canSubmitStatement(
    hearing: DisputeHearingEntity,
    participant: HearingParticipantEntity,
  ): Promise<boolean> {
    // Observer và Moderator không submit statement
    if (
      participant.role === HearingParticipantRole.OBSERVER ||
      participant.role === HearingParticipantRole.MODERATOR
    ) {
      return false;
    }

    // Count statements by type
    const statements = await this.statementRepo.find({
      where: { hearingId: hearing.id, participantId: participant.id },
    });

    const countByType = new Map<HearingStatementType, number>();
    for (const s of statements) {
      countByType.set(s.type, (countByType.get(s.type) || 0) + 1);
    }

    // Check if any type still has room
    for (const type of Object.values(HearingStatementType)) {
      // QUESTION and ANSWER are for admin only
      if (type === HearingStatementType.QUESTION || type === HearingStatementType.ANSWER) {
        continue;
      }

      const count = countByType.get(type) || 0;
      if (count < MAX_STATEMENTS_PER_TYPE) {
        return true;
      }
    }

    return false;
  }
}
