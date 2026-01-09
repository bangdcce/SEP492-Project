import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { HearingsService, HearingRoomView, HearingCreateResult } from './hearings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, GetUser } from '../auth/decorators';
import { UserRole } from '../../database/entities';
import {
  ScheduleHearingDto,
  RescheduleHearingDto,
  SubmitStatementDto,
  AdminQuestionDto,
  AnswerQuestionDto,
  ConcludeHearingDto,
} from './dto';
import {
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingStatementEntity,
  HearingQuestionEntity,
} from '../../database/entities';

@ApiTags('Dispute Hearings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes/:disputeId/hearings')
export class HearingsController {
  constructor(private readonly hearingsService: HearingsService) {}

  // ===========================================================================
  // ADMIN ENDPOINTS
  // ===========================================================================

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Schedule a new hearing for a dispute' })
  @ApiParam({ name: 'disputeId', type: 'string' })
  async scheduleHearing(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: ScheduleHearingDto,
    @GetUser('id') adminId: string,
  ): Promise<HearingCreateResult> {
    return this.hearingsService.scheduleHearing(disputeId, adminId, dto);
  }

  @Patch(':hearingId/start')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Start a scheduled hearing' })
  async startHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser('id') adminId: string,
  ): Promise<DisputeHearingEntity> {
    return this.hearingsService.startHearing(hearingId, adminId);
  }

  @Patch(':hearingId/reschedule')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reschedule a hearing' })
  async rescheduleHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: RescheduleHearingDto,
    @GetUser('id') adminId: string,
  ): Promise<DisputeHearingEntity> {
    return this.hearingsService.rescheduleHearing(hearingId, adminId, dto);
  }

  @Patch(':hearingId/cancel')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel a scheduled hearing' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  async cancelHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body('reason') reason: string,
    @GetUser('id') adminId: string,
  ): Promise<DisputeHearingEntity> {
    return this.hearingsService.cancelHearing(hearingId, adminId, reason);
  }

  @Patch(':hearingId/conclude')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Conclude an active hearing' })
  async concludeHearing(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: ConcludeHearingDto,
    @GetUser('id') adminId: string,
  ): Promise<DisputeHearingEntity> {
    return this.hearingsService.concludeHearing(hearingId, adminId, dto);
  }

  @Post(':hearingId/questions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ask a question to a participant' })
  async askQuestion(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: AdminQuestionDto,
    @GetUser('id') adminId: string,
  ): Promise<HearingQuestionEntity> {
    return this.hearingsService.askQuestion(hearingId, adminId, dto);
  }

  @Patch('statements/:statementId/redact')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Redact an inappropriate statement' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  async redactStatement(
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @Body('reason') reason: string,
    @GetUser('id') adminId: string,
  ): Promise<HearingStatementEntity> {
    return this.hearingsService.redactStatement(statementId, adminId, reason);
  }

  @Get('active')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all active hearings moderated by current admin' })
  async getActiveHearings(@GetUser('id') adminId: string): Promise<DisputeHearingEntity[]> {
    return this.hearingsService.getActiveHearings(adminId);
  }

  // ===========================================================================
  // USER ENDPOINTS
  // ===========================================================================

  @Get()
  @ApiOperation({ summary: 'Get all hearings for a dispute' })
  async getHearingsByDispute(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
  ): Promise<DisputeHearingEntity[]> {
    return this.hearingsService.getHearingsByDispute(disputeId);
  }

  @Get(':hearingId/room')
  @ApiOperation({ summary: 'Enter the hearing room (get full hearing view)' })
  async joinHearingRoom(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser('id') userId: string,
  ): Promise<HearingRoomView> {
    return this.hearingsService.joinHearingRoom(hearingId, userId);
  }

  @Patch(':hearingId/confirm')
  @ApiOperation({ summary: 'Confirm attendance for a scheduled hearing' })
  async confirmAttendance(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @GetUser('id') userId: string,
  ): Promise<HearingParticipantEntity> {
    return this.hearingsService.confirmAttendance(hearingId, userId);
  }

  @Post(':hearingId/statements')
  @ApiOperation({ summary: 'Submit a statement during an active hearing' })
  async submitStatement(
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body() dto: SubmitStatementDto,
    @GetUser('id') userId: string,
  ): Promise<HearingStatementEntity> {
    return this.hearingsService.submitStatement(hearingId, userId, dto);
  }

  @Patch('questions/:questionId/answer')
  @ApiOperation({ summary: 'Answer a question from the moderator' })
  async answerQuestion(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: AnswerQuestionDto,
    @GetUser('id') userId: string,
  ): Promise<HearingQuestionEntity> {
    return this.hearingsService.answerQuestion(questionId, userId, dto);
  }
}

// ===========================================================================
// MY HEARINGS CONTROLLER (Separate route)
// ===========================================================================

@ApiTags('My Hearings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hearings/my')
export class MyHearingsController {
  constructor(private readonly hearingsService: HearingsService) {}

  @Get('upcoming')
  @ApiOperation({ summary: 'Get my upcoming hearings' })
  async getUpcomingHearings(@GetUser('id') userId: string): Promise<DisputeHearingEntity[]> {
    return this.hearingsService.getUpcomingHearings(userId);
  }
}
