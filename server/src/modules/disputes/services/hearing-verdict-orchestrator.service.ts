import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DisputeEntity,
  DisputeResult,
  DisputeHearingEntity,
  EscrowEntity,
  HearingParticipantEntity,
  HearingStatus,
  UserRole,
} from 'src/database/entities';
import { IssueHearingVerdictDto } from '../dto/hearing-verdict.dto';
import { HearingService } from './hearing.service';
import { VerdictService } from './verdict.service';
import { VerdictReadinessService } from './verdict-readiness.service';

@Injectable()
export class HearingVerdictOrchestratorService {
  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(EscrowEntity)
    private readonly escrowRepo: Repository<EscrowEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly hearingParticipantRepo: Repository<HearingParticipantEntity>,
    private readonly hearingService: HearingService,
    private readonly verdictService: VerdictService,
    private readonly verdictReadinessService: VerdictReadinessService,
  ) {}

  private async assertReadinessAccess(
    hearingId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<{
    hearing: Pick<DisputeHearingEntity, 'id' | 'disputeId' | 'moderatorId' | 'status'>;
    dispute: Pick<
      DisputeEntity,
      'id' | 'raisedById' | 'defendantId' | 'assignedStaffId' | 'escalatedToAdminId'
    >;
  }> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      select: ['id', 'disputeId', 'moderatorId', 'status'],
    });
    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: hearing.disputeId },
      select: ['id', 'raisedById', 'defendantId', 'assignedStaffId', 'escalatedToAdminId'],
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${hearing.disputeId} not found`);
    }

    if (requesterRole === UserRole.ADMIN) {
      return { hearing, dispute };
    }

    const isModerator = hearing.moderatorId === requesterId;
    const isParty = [dispute.raisedById, dispute.defendantId].includes(requesterId);
    const isAssignedStaff =
      requesterRole === UserRole.STAFF && dispute.assignedStaffId === requesterId;
    const isEscalatedAdmin = dispute.escalatedToAdminId === requesterId;
    const isParticipant = await this.hearingParticipantRepo.exist({
      where: {
        hearingId,
        userId: requesterId,
      },
    });

    if (!isModerator && !isParty && !isAssignedStaff && !isEscalatedAdmin && !isParticipant) {
      throw new ForbiddenException('Access denied');
    }

    return { hearing, dispute };
  }

  async getVerdictReadiness(hearingId: string, requesterId: string, requesterRole: UserRole) {
    await this.assertReadinessAccess(hearingId, requesterId, requesterRole);
    return await this.verdictReadinessService.evaluateHearingReadiness(hearingId);
  }

  async issueHearingVerdict(
    hearingId: string,
    requesterId: string,
    requesterRole: UserRole,
    dto: IssueHearingVerdictDto,
  ) {
    const { hearing } = await this.assertReadinessAccess(hearingId, requesterId, requesterRole);

    if (requesterRole !== UserRole.ADMIN && hearing.moderatorId !== requesterId) {
      throw new ForbiddenException(
        'Only the assigned moderator or admin can issue verdict from Hearing Room',
      );
    }

    if (![HearingStatus.IN_PROGRESS, HearingStatus.PAUSED].includes(hearing.status)) {
      throw new ConflictException({
        code: 'HEARING_NOT_ACTIVE_FOR_VERDICT',
        message: 'Hearing must be IN_PROGRESS or PAUSED before issuing verdict.',
        hearingStatus: hearing.status,
      });
    }

    const readiness = await this.verdictReadinessService.evaluateHearingReadiness(hearingId);
    if (!readiness.canIssueVerdict) {
      throw new ConflictException({
        code: 'VERDICT_HEARING_CHECKLIST_UNMET',
        message: 'Verdict cannot be issued yet due to hearing readiness checklist.',
        checklist: readiness.checklist,
        blockingChecklist: readiness.blockingChecklist,
        unmetChecklist: readiness.unmetChecklist,
        unmetChecklistDetails: readiness.unmetChecklistDetails,
        context: readiness.context,
      });
    }

    const summary = dto.closeHearing.summary?.trim();
    const findings = dto.closeHearing.findings?.trim();
    if (!summary || !findings) {
      throw new BadRequestException({
        code: 'HEARING_MINUTES_REQUIRED',
        message: 'Both summary and findings are required before issuing final verdict.',
      });
    }

    const noShowNote = dto.closeHearing.noShowNote?.trim();
    if (readiness.absentRequiredParticipants.length > 0 && !noShowNote) {
      throw new BadRequestException({
        code: 'NO_SHOW_NOTE_REQUIRED',
        message:
          'A no-show note is required when one or more required participants are absent.',
        absentRequiredParticipants: readiness.absentRequiredParticipants,
      });
    }

    const result = dto.verdict.result ?? dto.verdict.verdict;
    if (!result) {
      throw new BadRequestException('Verdict result is required');
    }

    const policies = dto.verdict.reasoning?.violatedPolicies || [];
    if (policies.length === 0) {
      throw new BadRequestException({
        code: 'VIOLATED_POLICIES_REQUIRED',
        message: 'At least one violated policy is required in verdict reasoning.',
      });
    }

    const dispute = await this.disputeRepo.findOne({
      where: { id: readiness.context.disputeId },
      select: ['id', 'milestoneId'],
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${readiness.context.disputeId} not found`);
    }

    const escrow = await this.escrowRepo.findOne({
      where: { milestoneId: dispute.milestoneId },
      select: ['id', 'fundedAmount', 'totalAmount', 'platformFee'],
    });
    if (!escrow) {
      throw new NotFoundException(`Escrow for milestone ${dispute.milestoneId} not found`);
    }

    const fundedAmount =
      escrow.fundedAmount && escrow.fundedAmount > 0 ? escrow.fundedAmount : escrow.totalAmount;
    const platformFee = escrow.platformFee || 0;

    const split = this.verdictService.resolveVerdictAmounts({
      result,
      splitRatioClient: dto.verdict.splitRatioClient,
      amountToClient: dto.verdict.amountToClient,
      amountToFreelancer: dto.verdict.amountToFreelancer,
      escrowFundedAmount: fundedAmount,
      fixedPlatformFee: platformFee,
    });

    const verdictResult = await this.verdictService.issueVerdict(
      {
        disputeId: dispute.id,
        result,
        faultType: dto.verdict.faultType,
        faultyParty: dto.verdict.faultyParty,
        reasoning: dto.verdict.reasoning,
        amountToClient: split.amountToClient,
        amountToFreelancer: split.amountToFreelancer,
        trustScorePenalty: dto.verdict.trustScorePenalty,
        banUser: dto.verdict.banUser,
        banDurationDays: dto.verdict.banDurationDays,
        warningMessage: dto.verdict.warningMessage,
        adminComment: dto.verdict.adminComment,
      },
      requesterId,
      requesterRole,
    );

    try {
      const ended = await this.hearingService.endHearing(
        {
          hearingId,
          summary,
          findings,
          pendingActions: dto.closeHearing.pendingActions,
          forceEnd: dto.closeHearing.forceEnd,
          noShowNote,
        },
        requesterId,
      );

      return {
        verdict: verdictResult.verdict,
        hearing: ended.hearing,
        checklist: readiness.checklist,
        unmetChecklist: readiness.unmetChecklist,
        unmetChecklistDetails: readiness.unmetChecklistDetails,
        context: readiness.context,
        transferSummary: {
          distribution: verdictResult.distribution,
          transferCount: verdictResult.transfers.length,
          transfers: verdictResult.transfers.map((transfer) => ({
            id: transfer.id,
            type: transfer.type,
            amount: transfer.amount,
            walletId: transfer.walletId,
            status: transfer.status,
          })),
        },
      };
    } catch (error) {
      throw new ConflictException({
        code: 'HEARING_AUTO_END_FAILED_AFTER_VERDICT',
        message:
          'Verdict was issued, but hearing could not be ended automatically. Please review hearing minutes and close the hearing manually.',
        verdictId: verdictResult.verdict.id,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
