// ============================================================================
// HEARING CONTROLLER
// ============================================================================
// Endpoints for scheduling and managing dispute hearings
// ============================================================================

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
  UseFilters,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { UserEntity, UserRole } from '../../../database/entities/user.entity';
import { HearingStatus } from '../../../database/entities/dispute-hearing.entity';

// Service
import { HearingLifecycleFilter, HearingService } from '../services/hearing.service';
import { DisputeSchemaReadinessFilter } from '../filters/dispute-schema-readiness.filter';

// DTOs
import {
  ScheduleHearingDto,
  ModerateHearingDto,
  SubmitHearingStatementDto,
  AskHearingQuestionDto,
  AnswerHearingQuestionDto,
  EndHearingDto,
  RescheduleHearingDto,
  TransitionHearingPhaseDto,
  ExtendHearingDto,
  InviteSupportStaffDto,
  DispatchHearingRemindersDto,
  OpenEvidenceIntakeDto,
  PauseHearingDto,
} from '../dto/hearing.dto';

@ApiTags('Dispute Hearings')
@Controller('disputes/hearings')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(DisputeSchemaReadinessFilter)
@ApiBearerAuth()
export class HearingController {
  constructor(private readonly hearingService: HearingService) {}

  private parseLifecycleFilter(raw?: string): HearingLifecycleFilter {
    if (!raw) {
      return 'all';
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'active' || normalized === 'archived' || normalized === 'all') {
      return normalized;
    }

    throw new BadRequestException('Invalid lifecycle filter');
  }

  // ===========================================================================
  // SCHEDULE HEARING
  // ===========================================================================

  @Post('schedule')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Schedule a new hearing',
    description: `
      Creates a new dispute hearing session.

      **Edge Cases Handled:**
      - **Emergency Hearing**: If isEmergency=true, bypasses 24h notice rule.
      - **Required Participants**: Automatically adding Raiser, Defendant, and Broker/Supervisor.
      - **Conflict Detection**: Checks for calendar conflicts.
    `,
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Hearing scheduled successfully',
  })
  async scheduleHearing(@Body() dto: ScheduleHearingDto, @GetUser() user: UserEntity) {
    const result = await this.hearingService.scheduleHearing(dto, user.id);

    return {
      success: true,
      message: 'Hearing scheduled successfully',
      data: result,
    };
  }

  // ===========================================================================
  // LIST HEARINGS BY DISPUTE
  // ===========================================================================

  @Get('dispute/:disputeId')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'List hearings for a dispute',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'disputeId', type: 'string', format: 'uuid' })
  async listHearingsForDispute(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Query('lifecycle') lifecycleRaw: string | undefined,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getHearingsForDispute(
      disputeId,
      user,
      this.parseLifecycleFilter(lifecycleRaw),
    );
    return { success: true, data };
  }

  // ===========================================================================
  // LIST MY HEARINGS (STAFF/ADMIN)
  // ===========================================================================

  @Get('mine')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'List hearings for the current staff/admin user',
  })
  @HttpCode(HttpStatus.OK)
  async listMyHearings(
    @GetUser() user: UserEntity,
    @Query('status') statusRaw?: string,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
    @Query('lifecycle') lifecycleRaw?: string,
  ) {
    const statuses = statusRaw
      ? statusRaw
          .split(',')
          .map((value) => value.trim())
          .filter((value) => Object.values(HearingStatus).includes(value as HearingStatus))
      : [];

    if (statusRaw && statuses.length === 0) {
      throw new BadRequestException('Invalid status filter');
    }

    const from = fromRaw ? new Date(fromRaw) : undefined;
    if (fromRaw && Number.isNaN(from?.getTime())) {
      throw new BadRequestException('Invalid from date');
    }

    const to = toRaw ? new Date(toRaw) : undefined;
    if (toRaw && Number.isNaN(to?.getTime())) {
      throw new BadRequestException('Invalid to date');
    }

    const data = await this.hearingService.getHearingsForUser(user, {
      statuses: statuses.length > 0 ? (statuses as HearingStatus[]) : undefined,
      from,
      to,
      lifecycle: this.parseLifecycleFilter(lifecycleRaw),
    });

    return { success: true, data };
  }

  // ===========================================================================
  // GET HEARING BY ID
  // ===========================================================================

  @Get(':hearingId')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'Get hearing details',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async getHearingById(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getHearingById(hearingId, user);
    return { success: true, data };
  }

  @Get(':hearingId/workspace')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'Get hearing workspace snapshot',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async getHearingWorkspace(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getHearingWorkspace(hearingId, user);
    return { success: true, data };
  }

  // ===========================================================================
  // HEARING STATEMENTS
  // ===========================================================================

  @Get(':hearingId/statements')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'List hearing statements',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async listHearingStatements(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Query('includeDrafts') includeDraftsRaw: string | undefined,
    @GetUser() user: UserEntity,
  ) {
    const includeDrafts = includeDraftsRaw === 'true';
    const data = await this.hearingService.getHearingStatements(hearingId, user, {
      includeDrafts,
    });
    return { success: true, data };
  }

  // ===========================================================================
  // HEARING QUESTIONS
  // ===========================================================================

  @Get(':hearingId/questions')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'List hearing questions',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async listHearingQuestions(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getHearingQuestions(hearingId, user);
    return { success: true, data };
  }

  // ===========================================================================
  // HEARING TIMELINE
  // ===========================================================================

  @Get(':hearingId/timeline')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'Get hearing timeline details',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async getHearingTimeline(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getHearingTimeline(hearingId, user);
    return { success: true, data };
  }

  // ===========================================================================
  // HEARING ATTENDANCE ANALYTICS
  // ===========================================================================

  @Get(':hearingId/attendance')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get hearing attendance and no-show analytics',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async getHearingAttendance(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getHearingAttendance(hearingId, user);
    return { success: true, data };
  }

  // ===========================================================================
  // PARTICIPANT CHECK
  // ===========================================================================

  @Post('validate-schedule')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Validate hearing schedule',
    description: 'Checks for conflicts and rule violations before scheduling.',
  })
  validateSchedule(@Body() _dto: ScheduleHearingDto) {
    // Only implemented validation logic exposed
    // Need list of participant IDs to call validateHearingSchedule
    // This endpoint might need to fetch participants first
    return {
      success: true,
      message: 'Validation endpoint',
    };
  }

  // ===========================================================================
  // START HEARING
  // ===========================================================================

  @Post(':hearingId/start')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Start a hearing session',
    description: `
      Starts a hearing session.

      **Rules:**
      - Cannot start before scheduled time unless all required participants are online and ready
      - Chat room is activated on start
    `,
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async startHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.hearingService.startHearing(hearingId, user.id);

    return {
      success: true,
      message: 'Hearing started',
      data: result,
    };
  }

  // ===========================================================================
  // SPEAKER CONTROL
  // ===========================================================================

  /**
   * Chuyển phase phiên tòa (PRESENTATION -> CROSS_EXAMINATION -> INTERROGATION -> DELIBERATION)
   * Tự động mapping DisputePhase sang SpeakerRole phù hợp.
   * Nghịp vụ tòa án:
   *   PRESENTATION      -> Chỉ Nguyên đơn được nói
   *   CROSS_EXAMINATION -> Chỉ Bị đơn được nói
   *   INTERROGATION     -> Chỉ Thẩm phán (Staff/Admin) được nói
   *   DELIBERATION      -> Khóa chat toàn bộ (Nghị án)
   */
  @Patch(':hearingId/phase')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Transition hearing phase',
    description: `
      Transitions the hearing to a new phase, automatically mapping to the correct speaker role.

      **Phase -> Speaker Role Mapping:**
      - PRESENTATION -> RAISER_ONLY (Only raiser can speak)
      - CROSS_EXAMINATION -> DEFENDANT_ONLY (Only defendant can speak)
      - INTERROGATION -> MODERATOR_ONLY (Only moderator/staff can speak)
      - DELIBERATION -> MUTED_ALL (All muted, deliberation in progress)
    `,
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async transitionHearingPhase(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: TransitionHearingPhaseDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.transitionHearingPhase(hearingId, dto.phase, user.id);
    return {
      success: true,
      message: `Phase transitioned to ${dto.phase}`,
      data: result,
    };
  }

  @Patch(':hearingId/pause')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Pause hearing session',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async pauseHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: PauseHearingDto,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.hearingService.pauseHearing(hearingId, user.id, dto.reason.trim());
    return {
      success: true,
      message: 'Hearing paused',
      data: result,
    };
  }

  @Patch(':hearingId/resume')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Resume paused hearing session',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async resumeHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.hearingService.resumeHearing(hearingId, user.id);
    return {
      success: true,
      message: 'Hearing resumed',
      data: result,
    };
  }

  @Post(':hearingId/evidence-intake/open')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Open hearing evidence intake window',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async openEvidenceIntake(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: OpenEvidenceIntakeDto,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.openEvidenceIntake(
      hearingId,
      user.id,
      dto.reason.trim(),
    );
    return { success: true, data };
  }

  @Post(':hearingId/evidence-intake/close')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Close hearing evidence intake window',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async closeEvidenceIntake(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.closeEvidenceIntake(hearingId, user.id);
    return { success: true, data };
  }

  @Patch(':hearingId/speaker-control')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update speaker control',
    description: `
      Update who is allowed to speak during the hearing.

      **Grace period:**
      - 5 seconds grace when switching from ALL to MODERATOR_ONLY
    `,
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async updateSpeakerControl(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: ModerateHearingDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.updateSpeakerControl(
      hearingId,
      user.id,
      dto.speakerRole,
    );

    return {
      success: true,
      message: 'Speaker control updated',
      data: result,
    };
  }

  // ===========================================================================
  // SUBMIT STATEMENT
  // ===========================================================================

  @Post(':hearingId/statements')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER, UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Submit hearing statement (draft or submit)',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async submitStatement(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: SubmitHearingStatementDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.submitHearingStatement({ ...dto, hearingId }, user.id);

    return {
      success: true,
      message: dto.isDraft ? 'Draft saved' : 'Statement submitted',
      data: result,
    };
  }

  // ===========================================================================
  // ASK QUESTION
  // ===========================================================================

  @Post(':hearingId/questions')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Ask a hearing question',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async askQuestion(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: AskHearingQuestionDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.askHearingQuestion({ ...dto, hearingId }, user.id);

    return {
      success: true,
      message: 'Question asked',
      data: result,
    };
  }

  // ===========================================================================
  // ANSWER QUESTION
  // ===========================================================================

  @Patch(':hearingId/questions/:questionId/answer')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER, UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Answer a hearing question',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async answerQuestion(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: AnswerHearingQuestionDto,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.hearingService.answerHearingQuestion(
      hearingId,
      questionId,
      dto.answer,
      user.id,
    );

    return {
      success: true,
      message: 'Question answered',
      data: result,
    };
  }

  // ===========================================================================
  // CANCEL / SKIP QUESTION
  // ===========================================================================

  @Patch(':hearingId/questions/:questionId/cancel')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel / skip a pending hearing question' })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'questionId', type: 'string', format: 'uuid' })
  async cancelQuestion(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.hearingService.cancelHearingQuestion(hearingId, questionId, user.id);
    return {
      success: true,
      message: 'Question cancelled',
      data: result,
    };
  }

  // ===========================================================================
  // END HEARING
  // ===========================================================================

  @Post(':hearingId/end')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'End hearing session',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async endHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: EndHearingDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.endHearing({ ...dto, hearingId }, user.id);

    return {
      success: true,
      message: 'Hearing ended',
      data: result,
    };
  }

  // ===========================================================================
  // RESCHEDULE HEARING
  // ===========================================================================

  @Post(':hearingId/reschedule')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Reschedule a hearing session',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async rescheduleHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: RescheduleHearingDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.rescheduleHearing({ ...dto, hearingId }, user.id);

    return {
      success: true,
      message: 'Hearing rescheduled',
      data: result,
    };
  }

  // ===========================================================================
  // EXTEND HEARING
  // ===========================================================================

  @Post(':hearingId/extend')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Extend hearing duration',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async extendHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: ExtendHearingDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.extendHearingDuration({ ...dto, hearingId }, user.id);

    return {
      success: true,
      message: 'Hearing duration extended',
      data: result,
    };
  }

  // ===========================================================================
  // SUPPORT STAFF
  // ===========================================================================

  @Get(':hearingId/support-candidates')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get support candidates for hearing escalation',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async getSupportCandidates(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser() user: UserEntity,
  ) {
    const data = await this.hearingService.getSupportCandidates(hearingId, user.id);
    return { success: true, data };
  }

  @Post(':hearingId/invite-support')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Invite support staff/admin into hearing',
  })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'hearingId', type: 'string', format: 'uuid' })
  async inviteSupport(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: InviteSupportStaffDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.hearingId && dto.hearingId !== hearingId) {
      throw new BadRequestException('hearingId in body does not match URL');
    }

    const result = await this.hearingService.inviteSupportStaff({ ...dto, hearingId }, user.id);
    return {
      success: true,
      message: 'Support invited',
      data: result,
    };
  }

  // ===========================================================================
  // REMINDER DISPATCH
  // ===========================================================================

  @Post('reminders/dispatch')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Dispatch due hearing reminders (manual trigger)',
  })
  @HttpCode(HttpStatus.OK)
  async dispatchDueReminders(
    @Body() dto: DispatchHearingRemindersDto,
    @GetUser() _user: UserEntity,
  ) {
    const referenceAt = dto?.at ? new Date(dto.at) : new Date();
    if (Number.isNaN(referenceAt.getTime())) {
      throw new BadRequestException('Invalid reminder reference time');
    }

    const result = await this.hearingService.dispatchDueHearingReminders(referenceAt);
    return {
      success: true,
      message: 'Reminder dispatch completed',
      data: result,
    };
  }
}
