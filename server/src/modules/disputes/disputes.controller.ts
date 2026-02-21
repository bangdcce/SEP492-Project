import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { JwtAuthGuard, Roles, RolesGuard, GetUser } from '../auth';
import { UpdateDisputeDto } from './dto/update-disputes.dto';
import { UpdateDisputePhaseDto } from './dto/update-dispute-phase.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { DefendantResponseDto } from './dto/defendant-response.dto';
import { AppealDto } from './dto/appeal.dto';
import { AppealRejectionDto } from './dto/appeal-rejection.dto';
import { RequestDisputeInfoDto } from './dto/request-info.dto';
import { ResolveRejectionAppealDto } from './dto/resolve-rejection-appeal.dto';
import { AppealVerdictDto } from './dto/verdict.dto';
import { TriageDisputeDto } from './dto/triage-dispute.dto';
import { AdminUpdateDisputeDto } from './dto/admin-update-dispute.dto';
import { DisputeFilterDto, DisputeSortBy } from './dto/dispute-filter.dto';
import { SendDisputeMessageDto, HideMessageDto } from './dto/message.dto';
import { CancelDisputeDto } from './dto/cancel-dispute.dto';
import { AutoScheduleTuningDto } from './dto/auto-schedule-tuning.dto';
import { ProvideDisputeInfoDto } from './dto/provide-dispute-info.dto';
import { CreateDisputeScheduleProposalDto } from './dto/schedule-proposal.dto';
import { DisputeStatus, UserRole, UserEntity } from 'src/database/entities';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createDisputes(@GetUser() user: UserEntity, @Body() createDisputes: CreateDisputeDto) {
    return await this.disputesService.create(user.id, createDisputes);
  }

  // =============================================================================
  // LIST DISPUTES WITH PAGINATION & FILTERS

  /**
   * Lấy danh sách disputes với pagination, filters, và smart sorting
   * GET /disputes?page=1&limit=20&status=OPEN&sortBy=urgency
   *
   * Smart sorting: Disputes gần hết hạn + priority cao sẽ được đẩy lên đầu
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  async getListDisputes(@GetUser() user: UserEntity, @Query() filters: DisputeFilterDto) {
    const effectiveFilters: DisputeFilterDto = { ...filters };
    if (user.role === UserRole.STAFF) {
      const queueStatuses = new Set<DisputeStatus>([
        DisputeStatus.OPEN,
        DisputeStatus.TRIAGE_PENDING,
      ]);
      const requestedStatuses = effectiveFilters.statusIn?.length
        ? effectiveFilters.statusIn
        : effectiveFilters.status
          ? [effectiveFilters.status]
          : [];
      const isQueueScopedRequest =
        effectiveFilters.includeUnassignedForStaff === true ||
        (requestedStatuses.length > 0 &&
          requestedStatuses.every((status) => queueStatuses.has(status)));

      if (effectiveFilters.assignedStaffId && effectiveFilters.assignedStaffId !== user.id) {
        throw new ForbiddenException('Staff can only view their own caseload.');
      }

      if (isQueueScopedRequest) {
        if (!effectiveFilters.unassignedOnly) {
          effectiveFilters.assignedStaffId = user.id;
          effectiveFilters.includeUnassignedForStaff = true;
        }
      } else if (!effectiveFilters.assignedStaffId && !effectiveFilters.unassignedOnly) {
        // Default staff scope is personal caseload unless queue scope is explicitly requested.
        effectiveFilters.assignedStaffId = user.id;
      }
    }
    return await this.disputesService.getAll(effectiveFilters);
  }

  /**
   * Lấy disputes của tôi (tôi kiện / kiện tôi / liên quan)
   * GET /disputes/my?asRaiser=true&asDefendant=true
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyDisputes(@GetUser() user: UserEntity, @Query() filters: DisputeFilterDto) {
    return await this.disputesService.getMyDisputes(user.id, filters);
  }

  /**
   * Lấy thống kê disputes cho admin dashboard
   * GET /disputes/stats
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('stats')
  async getDisputeStats() {
    return await this.disputesService.getDisputeStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('queue/count')
  async getQueueCount(@GetUser() user: UserEntity) {
    return await this.disputesService.getQueueCount(user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('queue')
  async getQueueDisputes(@GetUser() user: UserEntity, @Query() filters: DisputeFilterDto) {
    const effectiveFilters: DisputeFilterDto = {
      ...filters,
      status: undefined,
      statusIn: [DisputeStatus.TRIAGE_PENDING, DisputeStatus.OPEN],
      sortBy: filters.sortBy || DisputeSortBy.CREATED_AT,
      includeUnassignedForStaff: true,
    };

    if (user.role === UserRole.STAFF) {
      if (effectiveFilters.assignedStaffId && effectiveFilters.assignedStaffId !== user.id) {
        throw new ForbiddenException('Staff can only view their own queue scope.');
      }
      effectiveFilters.assignedStaffId = user.id;
    }

    return await this.disputesService.getQueueDisputes(effectiveFilters);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('caseload')
  async getCaseloadDisputes(@GetUser() user: UserEntity, @Query() filters: DisputeFilterDto) {
    const effectiveFilters: DisputeFilterDto = {
      ...filters,
      includeUnassignedForStaff: false,
      unassignedOnly: false,
    };

    if (user.role === UserRole.STAFF) {
      if (effectiveFilters.assignedStaffId && effectiveFilters.assignedStaffId !== user.id) {
        throw new ForbiddenException('Staff can only view their own caseload.');
      }
      effectiveFilters.assignedStaffId = user.id;
    }

    return await this.disputesService.getCaseloadDisputes(effectiveFilters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('scheduling/worklist')
  async getSchedulingWorklist(@GetUser() user: UserEntity) {
    return await this.disputesService.getSchedulingWorklist(user.id, user.role);
  }

  @Get(':id')
  async getDetailDisputes(@Param('id', ParseUUIDPipe) id: string) {
    return await this.disputesService.getDetail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/dossier')
  async getDisputeDossier(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: UserEntity) {
    return await this.disputesService.getDisputeDossier(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/ledger')
  async getDisputeLedger(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: UserEntity) {
    return await this.disputesService.getDisputeLedger(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/escalation-policy')
  async getEscalationPolicy(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: UserEntity) {
    return await this.disputesService.getEscalationPolicy(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/auto-schedule/options')
  async getAutoScheduleOptions(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserEntity,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 5;
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new BadRequestException('Invalid limit');
    }
    return await this.disputesService.getAutoScheduleOptions(id, user.id, user.role, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/scheduling/proposals')
  async getSchedulingProposals(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.getSchedulingProposals(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/scheduling/proposals')
  async createSchedulingProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDisputeScheduleProposalDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.createSchedulingProposal(id, user.id, user.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/scheduling/proposals/:proposalId')
  async deleteSchedulingProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.deleteSchedulingProposal(
      id,
      proposalId,
      user.id,
      user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/scheduling/proposals/submit')
  async submitSchedulingProposals(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.submitSchedulingProposals(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/messages/:id')
  async updateDisputes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputeDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.updateDisputes(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/provide-info')
  async provideAdditionalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProvideDisputeInfoDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.provideAdditionalInfo(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/viewed')
  async markDisputeViewed(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.markDisputeViewed(id, user.id, user.role);
  }

  // =============================================================================
  // DISPUTE MESSAGES
  // - Dispute-level: Nộp hồ sơ, bằng chứng, comment (Async - không giới hạn lượt)
  // - Hearing-level: Chat realtime trong phiên tòa (kiểm soát bởi SpeakerRole)
  // =============================================================================

  @UseGuards(JwtAuthGuard)
  @Post(':disputeId/messages')
  async sendDisputeMessage(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: SendDisputeMessageDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.disputeId && dto.disputeId !== disputeId) {
      throw new BadRequestException('disputeId in body does not match URL');
    }

    const result = await this.disputesService.sendDisputeMessage(
      { ...dto, disputeId },
      user.id,
      user.role,
      user,
    );

    return {
      success: true,
      message: 'Message sent',
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':disputeId/messages')
  async listDisputeMessages(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Query('hearingId') hearingId: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('includeHidden') includeHiddenRaw: string | undefined,
    @GetUser() user: UserEntity,
  ) {
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    if (
      limitRaw &&
      (parsedLimit === undefined || !Number.isFinite(parsedLimit) || parsedLimit <= 0)
    ) {
      throw new BadRequestException('Invalid limit');
    }

    const includeHidden = includeHiddenRaw === 'true';

    const data = await this.disputesService.getDisputeMessages(disputeId, user.id, user.role, {
      hearingId,
      limit: parsedLimit,
      includeHidden,
    });

    return {
      success: true,
      data,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch('messages/:messageId/hide')
  async hideMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: HideMessageDto,
    @GetUser() user: UserEntity,
  ) {
    if (dto.messageId && dto.messageId !== messageId) {
      throw new BadRequestException('messageId in body does not match URL');
    }

    const result = await this.disputesService.hideMessage(
      { ...dto, messageId },
      user.id,
      user.role,
    );

    return {
      success: true,
      message: 'Message hidden',
      data: result,
    };
  }

  // =============================================================================
  // ACTIVITY TIMELINE
  // =============================================================================

  /**
   * Lấy timeline hoạt động của dispute
   * GET /disputes/:id/activities
   * Query: includeInternal (chỉ Admin mới xem được internal)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/activities')
  async getActivities(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeInternal') includeInternal: string,
    @GetUser() user: UserEntity,
  ) {
    // Chỉ Admin/Staff mới xem được hoạt động internal
    const canViewInternal = [UserRole.ADMIN, UserRole.STAFF].includes(user.role);
    const showInternal = includeInternal === 'true' && canViewInternal;
    return await this.disputesService.getActivities(id, showInternal);
  }

  // =============================================================================
  // NOTES (Ghi chú)
  // =============================================================================

  /**
   * Lấy danh sách ghi chú của dispute
   * GET /disputes/:id/notes
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/notes')
  async getNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeInternal') includeInternal: string,
    @GetUser() user: UserEntity,
  ) {
    const canViewInternal = [UserRole.ADMIN, UserRole.STAFF].includes(user.role);
    const showInternal = includeInternal === 'true' && canViewInternal;
    return await this.disputesService.getNotes(id, showInternal);
  }

  /**
   * Thêm ghi chú vào dispute (Admin/Staff)
   * POST /disputes/:id/notes
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post(':id/notes')
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.addNote(user.id, user.role, id, dto);
  }

  /**
   * Xóa ghi chú
   * DELETE /disputes/:id/notes/:noteId
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(@Param('noteId', ParseUUIDPipe) noteId: string, @GetUser() user: UserEntity) {
    await this.disputesService.deleteNote(user.id, noteId);
  }

  // =============================================================================
  // DEFENDANT RESPONSE
  // =============================================================================

  /**
   * Bị đơn gửi phản hồi và bằng chứng phản bác
   * POST /disputes/:id/respond
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/respond')
  async submitDefendantResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DefendantResponseDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.submitDefendantResponse(user.id, id, dto);
  }

  // =============================================================================
  // APPEAL SYSTEM
  // =============================================================================

  /**
   * Gửi khiếu nại lại (Appeal)
   * POST /disputes/:id/appeal
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/appeal')
  async submitAppeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppealDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.submitAppeal(user.id, id, dto);
  }

  /**
   * Appeal a dismissal (within 24h after rejection)
   * POST /disputes/:id/rejection/appeal
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/rejection/appeal')
  async appealRejection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppealRejectionDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.appealRejection(user.id, id, dto.reason);
  }

  /**
   * Admin xử lý Appeal
   * PATCH /disputes/:id/appeal/resolve
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/appeal/resolve')
  async resolveAppeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppealVerdictDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.resolveAppeal(user.id, id, dto);
  }

  /**
   * Admin resolves dismissal appeal
   * PATCH /disputes/:id/rejection/appeal/resolve
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/rejection/appeal/resolve')
  async resolveRejectionAppeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveRejectionAppealDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.resolveRejectionAppeal(
      user.id,
      id,
      dto.decision,
      dto.resolution,
    );
  }

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  /**
   * Update dispute moderation phase
   * PATCH /disputes/:id/phase
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/phase')
  async updateDisputePhase(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputePhaseDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.updatePhase(id, dto.phase, user.id, user.role);
  }

  /**
   * Staff/Admin request additional info before preliminary review
   * PATCH /disputes/:id/request-info
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/request-info')
  async requestAdditionalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestDisputeInfoDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.requestAdditionalInfo(
      user.id,
      id,
      dto.reason,
      dto.deadlineAt,
    );
  }

  /**
   * Admin cập nhật thông tin dispute (category, priority, deadlines)
   * PATCH /disputes/:id/admin-update
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/admin-update')
  async adminUpdateDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateDisputeDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.adminUpdateDispute(user.id, id, dto);
  }

  /**
   * 🔥 API Phán quyết tranh chấp (Chỉ ADMIN/STAFF)
   *
   * POST /disputes/:id/resolve
   * Body: { verdict: 'WIN_CLIENT' | 'WIN_FREELANCER' | 'SPLIT', adminComment: string, splitRatioClient?: number }
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.resolveDispute(user.id, id, dto);
  }

  /**
   * Chuyển Dispute sang trạng thái IN_MEDIATION (Admin bắt đầu xem xét)
   *
   * PATCH /disputes/:id/escalate
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/escalate')
  async escalateDispute(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: UserEntity) {
    const dispute = await this.disputesService.escalateToMediation(user.id, id);
    let scheduleResult;
    try {
      scheduleResult = await this.disputesService.escalateToHearing(id, user.id);
    } catch (error) {
      scheduleResult = {
        manualRequired: true,
        reason: error instanceof Error ? error.message : 'Auto-schedule failed',
      };
    }
    return { dispute, scheduleResult };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post(':id/auto-schedule')
  async autoScheduleHearing(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: UserEntity,
    @Body() tuning?: AutoScheduleTuningDto,
  ) {
    return await this.disputesService.escalateToHearing(id, user.id, tuning);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancelDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDisputeDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.cancelDispute(user.id, id, dto.reason);
  }

  /**
   * Staff chấp nhận dispute từ queue vào caseload (OPEN → PENDING_REVIEW)
   *
   * PATCH /disputes/:id/accept
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/accept')
  async acceptDispute(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: UserEntity) {
    return await this.disputesService.acceptDispute(user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/triage')
  async triageDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriageDisputeDto,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.triageDispute(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/preview/complete')
  async completePreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note: string | undefined,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.completePreviewWithScheduling(user.id, id, note);
  }

  /**
   * Từ chối Dispute (không hợp lệ)
   *
   * PATCH /disputes/:id/reject
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/reject')
  async rejectDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @GetUser() user: UserEntity,
  ) {
    return await this.disputesService.rejectDispute(user.id, id, reason);
  }
}
