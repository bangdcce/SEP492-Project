// ============================================================================
// SETTLEMENT CONTROLLER
// ============================================================================
// Endpoints for creating and managing settlement offers during disputes.
// Only dispute parties (raiser/defendant) can participate in settlements.
// Staff/Admin can view but not participate.
// ============================================================================

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';

// Services
import { SettlementService } from '../services/settlement.service';

// DTOs
import { CreateSettlementOfferDto } from '../dto/settlement/create-settlement-offer.dto';
import { RespondToSettlementDto } from '../dto/settlement/respond-to-settlement.dto';
import { CreateStaffSuggestionDto } from '../dto/settlement/create-staff-suggestion.dto';

// Types
import { UserEntity, UserRole } from '../../../database/entities/user.entity';

@ApiTags('Dispute Settlements')
@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  // ===========================================================================
  // CREATE SETTLEMENT OFFER
  // ===========================================================================

  @Post(':disputeId/settlements')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'Create settlement offer',
    description: `
      Create a new settlement offer for a dispute.
      
      **Rules:**
      - Only dispute parties (raiser/defendant) can create offers
      - Each party can create maximum 3 offers total
      - Cannot create if a PENDING offer already exists
      - amountToFreelancer + amountToClient MUST equal escrow funded amount
      
      **Money Logic:**
      - All amounts in USD
      - Platform fee (5%) deducted from freelancer's portion
      - Client receives full amount without fee deduction
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Settlement offer created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid amounts or eligibility check failed',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not a party to this dispute',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Dispute or escrow not found',
  })
  async createSettlementOffer(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: CreateSettlementOfferDto,
    @GetUser() user: UserEntity,
  ) {
    const settlement = await this.settlementService.createSettlementOffer(disputeId, dto, user.id);

    return {
      success: true,
      message: 'Settlement offer created successfully',
      data: {
        settlement,
        note: 'The other party has been notified. They can accept or reject within the expiry window.',
      },
    };
  }

  // ===========================================================================
  // GET SETTLEMENTS FOR DISPUTE
  // ===========================================================================

  @Get(':disputeId/settlements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER, UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all settlements for a dispute',
    description: 'Returns the history of all settlement offers for a dispute.',
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of settlements returned',
  })
  async getSettlementsByDispute(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @GetUser() user: UserEntity,
  ) {
    const settlements = await this.settlementService.getSettlementsByDispute(
      disputeId,
      user.id,
      [user.role], // Convert single role to array
    );

    const summary = await this.settlementService.getSettlementAttemptsSummary(disputeId);

    return {
      success: true,
      data: {
        settlements,
        summary,
      },
    };
  }

  // ===========================================================================
  // GET SINGLE SETTLEMENT
  // ===========================================================================

  @Get('settlements/:settlementId')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER, UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get settlement by ID',
    description: 'Returns detailed information about a specific settlement offer.',
  })
  @ApiParam({ name: 'settlementId', description: 'UUID of the settlement' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement details returned',
  })
  async getSettlementById(
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @GetUser() user: UserEntity,
  ) {
    const settlement = await this.settlementService.getSettlementById(
      settlementId,
      user.id,
      [user.role], // Convert single role to array
    );

    // Calculate fee breakdown for display
    const feeBreakdown = {
      freelancerFee: settlement.amountToFreelancer * 0.05, // 5%
      clientFee: 0,
      freelancerNetAmount: settlement.amountToFreelancer * 0.95,
      clientNetAmount: settlement.amountToClient,
    };

    return {
      success: true,
      data: {
        settlement,
        feeBreakdown,
      },
    };
  }

  // ===========================================================================
  // RESPOND TO SETTLEMENT
  // ===========================================================================

  @Post('settlements/:settlementId/respond')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Respond to settlement offer',
    description: `
      Accept or reject a pending settlement offer.
      
      **Accept:**
      - Dispute is marked as RESOLVED
      - Money is distributed according to the settlement
      - Both parties receive notification
      
      **Reject:**
      - Proposer is notified of rejection
      - Rejection reason is stored
      - If both parties exhaust 3 attempts each, dispute escalates to hearing
    `,
  })
  @ApiParam({ name: 'settlementId', description: 'UUID of the settlement' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Response recorded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Settlement expired or not in PENDING status',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only the other party can respond to this settlement',
  })
  async respondToSettlement(
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @Body() dto: RespondToSettlementDto,
    @GetUser() user: UserEntity,
  ) {
    const settlement = await this.settlementService.respondToSettlement(settlementId, dto, user.id);

    const message = dto.accept
      ? 'Settlement accepted. Dispute has been resolved and funds will be distributed.'
      : 'Settlement rejected. The proposer has been notified.';

    return {
      success: true,
      message,
      data: {
        settlement,
      },
    };
  }

  // ===========================================================================
  // CANCEL SETTLEMENT
  // ===========================================================================

  @Delete('settlements/:settlementId')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel settlement offer',
    description: `
      Cancel your own pending settlement offer.
      
      **Rules:**
      - Only the proposer can cancel their offer
      - Can only cancel within 1 hour of creation
      - Cancelled offers still count towards your 3 attempt limit
    `,
  })
  @ApiParam({ name: 'settlementId', description: 'UUID of the settlement' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement cancelled successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cancel window expired or settlement not pending',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only the proposer can cancel',
  })
  async cancelSettlement(
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
    @GetUser() user: UserEntity,
  ) {
    const settlement = await this.settlementService.cancelSettlement(settlementId, user.id);

    return {
      success: true,
      message: 'Settlement offer cancelled successfully',
      data: {
        settlement,
        note: 'This offer still counts towards your settlement attempt limit.',
      },
    };
  }

  // ===========================================================================
  // GET SETTLEMENT ATTEMPTS SUMMARY
  // ===========================================================================

  @Get('disputes/:disputeId/settlements/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER, UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get settlement attempts summary',
    description: 'Returns how many attempts each party has used and remaining.',
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Summary returned',
  })
  async getSettlementAttemptsSummary(@Param('disputeId', ParseUUIDPipe) disputeId: string) {
    const summary = await this.settlementService.getSettlementAttemptsSummary(disputeId);

    return {
      success: true,
      data: summary,
    };
  }

  // ===========================================================================
  // EDGE CASE 1: CHAT LOCK STATUS
  // ===========================================================================

  @Get(':disputeId/chat-lock-status')
  @Roles(UserRole.CLIENT, UserRole.FREELANCER, UserRole.BROKER)
  @ApiOperation({
    summary: 'Check chat lock status',
    description: `
      Check if user's chat is locked due to pending settlement.
      
      **Edge Case: "Im lặng là vàng" (Silent Treatment)**
      - Responder cannot send messages in dispute chat until they respond
      - Returns lock status, pending settlement details, and deadline
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chat lock status returned',
  })
  async getChatLockStatus(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @GetUser() user: UserEntity,
  ) {
    const status = await this.settlementService.checkChatLockStatus(disputeId, user.id);

    return {
      success: true,
      data: {
        ...status,
        message: status.isLocked
          ? 'You must respond to the pending settlement offer before chatting.'
          : 'Chat is unlocked.',
      },
    };
  }

  // ===========================================================================
  // EDGE CASE 3: STAFF SUGGESTION
  // ===========================================================================

  @Post(':disputeId/settlements/suggestion')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create staff settlement suggestion',
    description: `
      Create a non-binding settlement suggestion for dispute parties.
      
      **Edge Case: "Staff vô hình" (Invisible Staff)**
      - Staff can provide guidance without creating formal offers
      - Suggestion based on similar cases and reasoning
      - Not counted as settlement attempt, purely advisory
      - Both parties notified of suggestion
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Staff suggestion created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid amounts or dispute closed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Dispute or escrow not found',
  })
  async createStaffSuggestion(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: CreateStaffSuggestionDto,
    @GetUser() user: UserEntity,
  ) {
    const suggestion = await this.settlementService.createStaffSuggestion(disputeId, user.id, dto);

    return {
      success: true,
      message: 'Staff suggestion created and sent to both parties',
      data: {
        suggestion,
        note: 'This is a non-binding recommendation. Both parties are encouraged to consider this suggestion.',
      },
    };
  }

  // ===========================================================================
  // EDGE CASE 1 & 2: NON-COMPLIANCE SUMMARY
  // ===========================================================================

  @Get(':disputeId/settlements/non-compliance')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get non-compliance summary',
    description: `
      Get summary of settlement non-compliance behavior.
      
      **Used for:**
      - Verdict decisions (factor in uncooperative behavior)
      - Determining if escalation to hearing is needed
      
      **Tracks:**
      - Ignored settlement offers (expiry without response)
      - Non-cooperative threshold violations
      - Recommendations for staff
    `,
  })
  @ApiParam({ name: 'disputeId', description: 'UUID of the dispute' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Non-compliance summary returned',
  })
  async getNonComplianceSummary(@Param('disputeId', ParseUUIDPipe) disputeId: string) {
    const summary = await this.settlementService.getNonComplianceSummary(disputeId);

    return {
      success: true,
      data: summary,
    };
  }
}
