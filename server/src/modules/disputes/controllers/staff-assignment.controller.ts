// ============================================================================
// STAFF ASSIGNMENT CONTROLLER
// ============================================================================
// Endpoints for staff assignment, workload management, and session control
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';

// Services
import { StaffAssignmentService } from '../services/staff-assignment.service';

// Types
import { UserEntity, UserRole } from '../../../database/entities/user.entity';

// DTOs
import {
  EarlyReleaseDto,
  EmergencyReassignDto,
  ScheduleHearingDto,
  ReassignDisputeDto,
  BatchDisputeComplexityDto,
} from '../dto/staff-assignment.dto';

@ApiTags('Staff Assignment')
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffAssignmentController {
  constructor(private readonly staffAssignmentService: StaffAssignmentService) {}

  // ===========================================================================
  // COMPLEXITY ESTIMATION
  // ===========================================================================

  @Get('disputes/:disputeId/complexity')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Estimate dispute complexity',
    description: `
      Analyzes dispute to estimate handling complexity and time needed.
      
      **Returns:**
      - Complexity level (LOW, MEDIUM, HIGH, CRITICAL)
      - Time range: min/recommended/max minutes
      - Contributing factors with weights
      - Confidence score
      
      **Used for:**
      - Auto-scheduling hearings with appropriate time
      - Staff workload planning
      - Manual scheduling with recommended duration
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Complexity estimation returned',
  })
  async estimateComplexity(@Param('disputeId', ParseUUIDPipe) disputeId: string) {
    const estimation = await this.staffAssignmentService.estimateDisputeComplexity(disputeId);

    return {
      success: true,
      data: {
        ...estimation,
        scheduling: {
          minimumMinutes: estimation.timeEstimation.minMinutes,
          recommendedMinutes: estimation.timeEstimation.recommendedMinutes,
          maximumMinutes: estimation.timeEstimation.maxMinutes,
          note: 'Use recommended duration unless you have specific reasons to adjust',
        },
      },
    };
  }

  @Post('disputes/complexity/batch')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Estimate dispute complexity in batch',
    description: `
      Estimates complexity for multiple disputes in one request.
      
      **Returns:**
      - Map of disputeId => complexity estimation
      - Errors map for disputes that failed estimation
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Batch complexity estimation returned',
  })
  async estimateComplexityBatch(@Body() dto: BatchDisputeComplexityDto) {
    const uniqueIds = Array.from(new Set(dto.disputeIds));
    if (uniqueIds.length > 50) {
      throw new BadRequestException('Too many disputeIds. Maximum is 50 per request.');
    }

    const results = await Promise.allSettled(
      uniqueIds.map((disputeId) =>
        this.staffAssignmentService.estimateDisputeComplexity(disputeId),
      ),
    );

    const data: Record<string, any> = {};
    const errors: Record<string, string> = {};

    results.forEach((result, index) => {
      const disputeId = uniqueIds[index];
      if (result.status === 'fulfilled') {
        const estimation = result.value;
        data[disputeId] = {
          ...estimation,
          scheduling: {
            minimumMinutes: estimation.timeEstimation.minMinutes,
            recommendedMinutes: estimation.timeEstimation.recommendedMinutes,
            maximumMinutes: estimation.timeEstimation.maxMinutes,
            note: 'Use recommended duration unless you have specific reasons to adjust',
          },
        };
      } else {
        const message =
          result.reason instanceof Error ? result.reason.message : 'Failed to estimate complexity';
        errors[disputeId] = message;
      }
    });

    return {
      success: Object.keys(errors).length === 0,
      data,
      errors: Object.keys(errors).length ? errors : undefined,
    };
  }

  // ===========================================================================
  // STAFF AVAILABILITY
  // ===========================================================================

  @Get('available')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get available staff with scoring',
    description: `
      Returns all staff with availability status and assignment scores.
      
      **Scoring factors:**
      - Workload (40%): Lower utilization = higher score
      - Performance (40%): User rating - overturn penalty
      - Fairness (20%): Round-robin effect
      
      **Used for:**
      - Auto-assignment algorithm
      - Manual assignment suggestions
      - Workload monitoring dashboard
    `,
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Date to check availability (default: today)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available staff list returned',
  })
  async getAvailableStaff(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : undefined;
    const result = await this.staffAssignmentService.getAvailableStaff(targetDate);

    return {
      success: true,
      data: {
        ...result,
        scoring: {
          weights: {
            workload: '40%',
            performance: '40%',
            fairness: '20%',
          },
          note: 'Staff are sorted by total score. Top scorer is recommended for assignment.',
        },
      },
    };
  }

  // ===========================================================================
  // AUTO-ASSIGNMENT
  // ===========================================================================

  @Post('disputes/:disputeId/assign')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-assign staff to dispute',
    description: `
      Automatically assigns the best available staff to a dispute.
      
      **Algorithm:**
      1. Estimate dispute complexity
      2. Get available staff sorted by score
      3. Assign top-scored staff
      4. Update workload metrics
      
      **Note:** Assignment is MANDATORY. Staff cannot reject.
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Staff assigned successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No staff available',
  })
  async autoAssignStaff(@Param('disputeId', ParseUUIDPipe) disputeId: string) {
    const result = await this.staffAssignmentService.autoAssignStaffToDispute(disputeId);

    if (!result.success) {
      return {
        success: false,
        message: result.fallbackReason,
        data: {
          complexity: result.complexity,
          manualAssignmentRequired: true,
        },
      };
    }

    return {
      success: true,
      message: 'Staff assigned successfully',
      data: {
        staffId: result.staffId,
        complexity: result.complexity,
        estimatedDuration: result.complexity.timeEstimation,
      },
    };
  }

  // ===========================================================================
  // MANUAL DISPUTE REASSIGNMENT
  // ===========================================================================

  @Post('disputes/:disputeId/reassign')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually reassign dispute to different staff',
    description: `
      Allows Admin to manually reassign a dispute to a different staff member.
      
      **Use cases:**
      - Staff overloaded, need rebalancing
      - Staff on extended leave
      - Assigning to specific expert
      
      **Algorithm:**
      1. Validate dispute status (must not be RESOLVED or REJECTED)
      2. Validate new staff exists and is active
      3. Update assignment and workload for both staff
      4. Emit DISPUTE_REASSIGNED event
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute to reassign' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dispute reassigned successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot reassign - invalid status or staff',
  })
  async reassignDispute(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: ReassignDisputeDto,
    @GetUser() user: UserEntity,
  ) {
    const result = await this.staffAssignmentService.reassignDispute(
      disputeId,
      dto.newStaffId,
      dto.reason,
      user.id,
      dto.notes,
    );

    return {
      success: result.success,
      message: result.message,
      data: {
        disputeId,
        oldStaffId: result.oldStaffId,
        newStaffId: result.newStaffId,
      },
    };
  }

  // ===========================================================================
  // SESSION TIMING
  // ===========================================================================

  @Get('sessions/:eventId/timing')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Check session timing status',
    description: `
      Returns current timing status for an active session.
      
      **Statuses:**
      - ON_TIME: Within scheduled time
      - WARNING: 10 minutes remaining
      - OVERTIME: Past scheduled end, within buffer
      - CRITICAL_OVERRUN: Buffer exceeded, next event affected
      
      **Actions suggested:**
      - CONTINUE: Keep going
      - WRAP_UP: Start concluding
      - NOTIFY_NEXT: Notify next participant of delay
      - ADJOURN: Must pause and reschedule
    `,
  })
  @ApiParam({ name: 'eventId', description: 'UUID of the calendar event' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Timing status returned',
  })
  async checkSessionTiming(@Param('eventId', ParseUUIDPipe) eventId: string) {
    const result = await this.staffAssignmentService.checkSessionTiming(eventId);

    return {
      success: true,
      data: result,
    };
  }

  // ===========================================================================
  // EARLY RELEASE
  // ===========================================================================

  @Post('sessions/:eventId/early-release')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release staff early from session',
    description: `
      When a session ends before scheduled time, this endpoint:
      - Updates actual end time
      - Frees up staff's remaining time slot
      - Updates workload to allow new assignments
      
      **Edge Case Handled:** "Dead Time"
      - Prevents wasted capacity when sessions end early
    `,
  })
  @ApiParam({ name: 'eventId', description: 'UUID of the calendar event' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Staff released early',
  })
  async earlyReleaseStaff(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: EarlyReleaseDto,
  ) {
    const actualEndTime = dto.actualEndTime ? new Date(dto.actualEndTime) : new Date();
    const result = await this.staffAssignmentService.earlyReleaseStaff(eventId, actualEndTime);

    return {
      success: true,
      message:
        result.releasedMinutes > 0
          ? `Released ${result.releasedMinutes} minutes early`
          : 'Session ended at scheduled time',
      data: result,
    };
  }

  // ===========================================================================
  // FRAGMENTED TIME
  // ===========================================================================

  @Get('staff/:staffId/fragmented-time')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Analyze fragmented time and get filler tasks',
    description: `
      Analyzes a time gap and suggests appropriate tasks.
      
      **Logic:**
      - Gap >= 60 min: Can schedule a hearing
      - Gap 15-59 min: Suggest filler tasks (review, draft, etc.)
      - Gap < 15 min: Too short for any task
      
      **Filler Tasks:**
      - REVIEW_EVIDENCE: Prepare for upcoming hearings
      - DRAFT_VERDICT: Complete pending decisions
      - CHECK_PENDING_DISPUTES: Review assigned cases
      - DOCUMENTATION: Update notes
    `,
  })
  @ApiParam({ name: 'staffId', description: 'UUID of the staff' })
  @ApiQuery({ name: 'gapStart', description: 'ISO timestamp of gap start' })
  @ApiQuery({ name: 'gapEnd', description: 'ISO timestamp of gap end' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fragmented time analysis returned',
  })
  async analyzeFragmentedTime(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Query('gapStart') gapStart: string,
    @Query('gapEnd') gapEnd: string,
  ) {
    const result = await this.staffAssignmentService.analyzeFragmentedTime(
      staffId,
      new Date(gapStart),
      new Date(gapEnd),
    );

    return {
      success: true,
      data: result,
    };
  }

  // ===========================================================================
  // EMERGENCY RE-ASSIGNMENT
  // ===========================================================================

  @Post('sessions/:eventId/reassign')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emergency reassignment',
    description: `
      Reassigns an event to a different staff member.
      
      **Use cases:**
      - Staff reports sick
      - Emergency/conflict
      - Workload rebalancing
      
      **Algorithm:**
      1. Find available replacement staff
      2. Prefer specified replacement if available
      3. Otherwise pick top scorer
      4. If no replacement: mark for rescheduling
    `,
  })
  @ApiParam({ name: 'eventId', description: 'UUID of the calendar event' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reassignment processed',
  })
  async emergencyReassign(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: EmergencyReassignDto,
  ) {
    const result = await this.staffAssignmentService.emergencyReassign({
      eventId,
      originalStaffId: dto.originalStaffId,
      reason: dto.reason,
      urgency: dto.urgency,
      preferredReplacementId: dto.preferredReplacementId,
      notes: dto.notes,
    });

    return {
      success: result.success,
      message: result.success ? `Reassigned to staff ${result.newStaffId}` : result.failureReason,
      data: result,
    };
  }

  // ===========================================================================
  // IDLE CHECK (Called by WebSocket or Frontend polling)
  // ===========================================================================

  @Post('sessions/:eventId/activity-ping')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report session activity',
    description: `
      Called by frontend to report activity in a session.
      Used to prevent "Zombie Session" problem.
      
      **Logic:**
      - If no activity for 15 min: Send warning
      - If no response after 5 more min: Auto-close
    `,
  })
  @ApiParam({ name: 'eventId', description: 'UUID of the calendar event' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity recorded',
  })
  async recordActivity(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: { lastActivityAt?: string },
  ) {
    const lastActivity = body.lastActivityAt ? new Date(body.lastActivityAt) : new Date();

    const idleResult = await this.staffAssignmentService.checkSessionIdle(eventId, lastActivity);

    return {
      success: true,
      data: {
        ...idleResult,
        action: idleResult.shouldAutoClose
          ? 'AUTO_CLOSE_PENDING'
          : idleResult.shouldWarn
            ? 'WARNING'
            : 'ACTIVE',
      },
    };
  }

  // ===========================================================================
  // SMART SUGGESTION API (For Reassignment UI)
  // ===========================================================================

  @Get('suggestions-for-reassign')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get staff suggestions for reassignment',
    description: `
      Returns a sorted list of staff suggestions for reassigning a dispute.
      
      **Algorithm:**
      1. Filter staff by skill match (>= 50%)
      2. Check availability at scheduled time (if provided)
      3. Sort by: availability DESC, workload ASC, skill match DESC
      
      **Response colors:**
      - 🟢 Green (RECOMMENDED): Rảnh, skill phù hợp
      - 🟡 Yellow (AVAILABLE): Bận vừa hoặc skill trung bình
      - 🔴 Red (CONFLICT/BUSY): Trùng lịch hoặc quá tải
      
      **UI Usage:**
      - Show green staff first as recommended
      - Disable selection for red staff with conflicts
    `,
  })
  @ApiQuery({
    name: 'disputeId',
    required: true,
    description: 'UUID of the dispute to reassign',
  })
  @ApiQuery({
    name: 'scheduledTime',
    required: false,
    description: 'ISO timestamp of scheduled hearing (for conflict check)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Staff suggestions returned',
  })
  async getSuggestionsForReassign(
    @Query('disputeId', ParseUUIDPipe) disputeId: string,
    @Query('scheduledTime') scheduledTime?: string,
  ) {
    const scheduledDate = scheduledTime ? new Date(scheduledTime) : undefined;
    const result = await this.staffAssignmentService.suggestReplacementStaff(
      disputeId,
      scheduledDate,
    );

    return {
      success: true,
      data: {
        ...result,
        ui: {
          colorLegend: {
            green: 'Gợi ý tốt nhất - có thể chọn ngay',
            yellow: 'Khả dụng - cân nhắc workload',
            red: 'Không khả dụng - trùng lịch hoặc quá tải',
          },
          note: 'Chọn người màu xanh (green) là an toàn nhất',
        },
      },
    };
  }
}
