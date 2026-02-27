import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  DisputeEntity,
  DisputePhase,
  DisputeStatus,
  DisputeHearingEntity,
  HearingParticipantEntity,
  HearingParticipantRole,
  HearingStatus,
} from 'src/database/entities';

type VerdictChecklist = Record<string, boolean>;

export interface VerdictReadinessSnapshot {
  canIssueVerdict: boolean;
  checklist: VerdictChecklist;
  unmetChecklist: string[];
  unmetChecklistDetails: string[];
  context: {
    disputeId: string;
    disputeStatus?: DisputeStatus;
    disputePhase?: DisputePhase;
    hearingId?: string | null;
    hearingStatus?: HearingStatus | null;
  };
}

export interface HearingVerdictReadinessSnapshot extends VerdictReadinessSnapshot {
  blockingChecklist: string[];
  absentRequiredParticipants: Array<{
    participantId: string;
    userId: string;
    role: HearingParticipantRole;
  }>;
}

@Injectable()
export class VerdictReadinessService {
  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly participantRepo: Repository<HearingParticipantEntity>,
  ) {}

  private repos(manager?: EntityManager) {
    return {
      disputeRepo: manager ? manager.getRepository(DisputeEntity) : this.disputeRepo,
      hearingRepo: manager ? manager.getRepository(DisputeHearingEntity) : this.hearingRepo,
      participantRepo: manager
        ? manager.getRepository(HearingParticipantEntity)
        : this.participantRepo,
    };
  }

  private isPresent(participant: Pick<HearingParticipantEntity, 'joinedAt' | 'confirmedAt'>): boolean {
    return Boolean(participant.joinedAt || participant.confirmedAt);
  }

  async evaluateDisputeGate(
    disputeId: string,
    manager?: EntityManager,
  ): Promise<VerdictReadinessSnapshot> {
    const { disputeRepo, hearingRepo, participantRepo } = this.repos(manager);

    const dispute = await disputeRepo.findOne({
      where: { id: disputeId },
      select: ['id', 'phase', 'status'],
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    const liveHearing = await hearingRepo.findOne({
      where: {
        disputeId,
        status: In([HearingStatus.IN_PROGRESS, HearingStatus.PAUSED]),
      },
      order: { startedAt: 'DESC', updatedAt: 'DESC', createdAt: 'DESC' },
      select: ['id', 'status'],
    });

    if (liveHearing && dispute.phase === DisputePhase.DELIBERATION) {
      const checklist: VerdictChecklist = {
        completedHearing: true,
        hearingMinutes: true,
        attendanceEvidence: true,
        moderatorPresent: true,
        bothSidesRepresented: true,
        noShowDocumented: true,
        liveDeliberation: true,
      };
      return {
        canIssueVerdict: true,
        checklist,
        unmetChecklist: [],
        unmetChecklistDetails: [],
        context: {
          disputeId: dispute.id,
          disputePhase: dispute.phase,
          disputeStatus: dispute.status,
          hearingId: liveHearing.id,
          hearingStatus: liveHearing.status,
        },
      };
    }

    const completedHearing = await hearingRepo.findOne({
      where: { disputeId, status: HearingStatus.COMPLETED },
      order: { endedAt: 'DESC', updatedAt: 'DESC', createdAt: 'DESC' },
      select: ['id', 'status', 'summary', 'findings', 'startedAt', 'noShowNote'],
    });

    const checklist: VerdictChecklist = {
      completedHearing: Boolean(completedHearing),
      hearingMinutes: false,
      attendanceEvidence: false,
      moderatorPresent: false,
      bothSidesRepresented: false,
      noShowDocumented: false,
      liveDeliberation: false,
    };

    if (completedHearing) {
      const summary = completedHearing.summary?.trim() || '';
      const findings = completedHearing.findings?.trim() || '';
      const noShowNote = completedHearing.noShowNote?.trim() || '';
      checklist.hearingMinutes = summary.length > 0 && findings.length > 0;

      const participants = await participantRepo.find({
        where: { hearingId: completedHearing.id },
        select: ['id', 'userId', 'role', 'isRequired', 'joinedAt', 'confirmedAt'],
      });

      checklist.moderatorPresent =
        participants.some(
          (participant) =>
            participant.role === HearingParticipantRole.MODERATOR &&
            this.isPresent(participant),
        ) || Boolean(completedHearing.startedAt);

      const raiserPresent = participants.some(
        (participant) =>
          participant.role === HearingParticipantRole.RAISER && this.isPresent(participant),
      );
      const defendantPresent = participants.some(
        (participant) =>
          participant.role === HearingParticipantRole.DEFENDANT && this.isPresent(participant),
      );
      checklist.bothSidesRepresented = raiserPresent && defendantPresent;

      const missingRequiredSide = participants.some(
        (participant) =>
          participant.isRequired &&
          [HearingParticipantRole.RAISER, HearingParticipantRole.DEFENDANT].includes(
            participant.role,
          ) &&
          !this.isPresent(participant),
      );
      checklist.noShowDocumented = !missingRequiredSide || noShowNote.length > 0;

      checklist.attendanceEvidence =
        checklist.moderatorPresent &&
        (checklist.bothSidesRepresented || checklist.noShowDocumented);
    }

    const unmetChecklist: string[] = [];
    const unmetChecklistDetails: string[] = [];

    if (!checklist.completedHearing) {
      unmetChecklist.push('completedHearing');
      unmetChecklistDetails.push(
        'No completed hearing found. End at least one hearing so its status becomes COMPLETED.',
      );
    }

    if (!checklist.hearingMinutes) {
      unmetChecklist.push('hearingMinutes');
      unmetChecklistDetails.push(
        'Hearing minutes are incomplete. Fill both summary and findings on the completed hearing.',
      );
    }

    if (!checklist.attendanceEvidence) {
      unmetChecklist.push('attendanceEvidence');
      if (!checklist.completedHearing) {
        unmetChecklistDetails.push(
          'Attendance evidence cannot be validated until there is a completed hearing.',
        );
      } else {
        if (!checklist.moderatorPresent) {
          unmetChecklistDetails.push(
            'Moderator attendance is missing (moderator must be joined/confirmed or hearing must have startedAt).',
          );
        }
        if (!checklist.bothSidesRepresented && !checklist.noShowDocumented) {
          unmetChecklistDetails.push(
            'Required party attendance is incomplete and noShowNote is missing in hearing minutes.',
          );
        }
      }
    }

    return {
      canIssueVerdict: unmetChecklist.length === 0,
      checklist,
      unmetChecklist,
      unmetChecklistDetails,
      context: {
        disputeId: dispute.id,
        disputePhase: dispute.phase,
        disputeStatus: dispute.status,
        hearingId: completedHearing?.id ?? liveHearing?.id ?? null,
        hearingStatus: completedHearing?.status ?? liveHearing?.status ?? null,
      },
    };
  }

  async evaluateHearingReadiness(
    hearingId: string,
    manager?: EntityManager,
  ): Promise<HearingVerdictReadinessSnapshot> {
    const { disputeRepo, hearingRepo, participantRepo } = this.repos(manager);

    const hearing = await hearingRepo.findOne({
      where: { id: hearingId },
      select: ['id', 'disputeId', 'status', 'startedAt', 'summary', 'findings', 'noShowNote'],
    });
    if (!hearing) {
      throw new NotFoundException(`Hearing ${hearingId} not found`);
    }

    const dispute = await disputeRepo.findOne({
      where: { id: hearing.disputeId },
      select: ['id', 'phase', 'status'],
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${hearing.disputeId} not found`);
    }

    const participants = await participantRepo.find({
      where: { hearingId: hearing.id },
      select: ['id', 'userId', 'role', 'isRequired', 'joinedAt', 'confirmedAt'],
    });

    const moderatorPresent =
      participants.some(
        (participant) =>
          participant.role === HearingParticipantRole.MODERATOR && this.isPresent(participant),
      ) || Boolean(hearing.startedAt);

    const raiserPresent = participants.some(
      (participant) =>
        participant.role === HearingParticipantRole.RAISER && this.isPresent(participant),
    );
    const defendantPresent = participants.some(
      (participant) =>
        participant.role === HearingParticipantRole.DEFENDANT && this.isPresent(participant),
    );

    const absentRequiredParticipants = participants
      .filter((participant) => participant.isRequired && !this.isPresent(participant))
      .map((participant) => ({
        participantId: participant.id,
        userId: participant.userId,
        role: participant.role,
      }));

    const noShowDocumentation =
      absentRequiredParticipants.length === 0 || Boolean(hearing.noShowNote?.trim());
    const minutesPrepared =
      Boolean(hearing.summary?.trim()) && Boolean(hearing.findings?.trim());
    const attendanceValidated =
      moderatorPresent && (raiserPresent && defendantPresent ? true : noShowDocumentation);

    const checklist: VerdictChecklist = {
      hearingSessionActive: [HearingStatus.IN_PROGRESS, HearingStatus.PAUSED].includes(
        hearing.status,
      ),
      deliberationPhase: dispute.phase === DisputePhase.DELIBERATION,
      moderatorPresent,
      minutesPrepared,
      noShowDocumentation,
      attendanceValidated,
    };

    const blockingChecklist = [
      'hearingSessionActive',
      'deliberationPhase',
      'moderatorPresent',
    ];
    const canIssueVerdict = blockingChecklist.every((key) => checklist[key]);
    const unmetChecklist = Object.entries(checklist)
      .filter(([, met]) => !met)
      .map(([key]) => key);

    const unmetChecklistDetails: string[] = [];
    if (!checklist.hearingSessionActive) {
      unmetChecklistDetails.push(
        'Hearing must be IN_PROGRESS or PAUSED to issue verdict from Hearing Room.',
      );
    }
    if (!checklist.deliberationPhase) {
      unmetChecklistDetails.push(
        'Dispute phase must be DELIBERATION before issuing verdict in Hearing Room.',
      );
    }
    if (!checklist.moderatorPresent) {
      unmetChecklistDetails.push(
        'Moderator presence is missing (moderator must be joined/confirmed or hearing must have startedAt).',
      );
    }
    if (!checklist.minutesPrepared) {
      unmetChecklistDetails.push(
        'Minutes are currently incomplete; summary and findings will be required in closeHearing payload.',
      );
    }
    if (!checklist.noShowDocumentation) {
      unmetChecklistDetails.push(
        'Required participant is absent; provide closeHearing.noShowNote when issuing verdict.',
      );
    }
    if (!checklist.attendanceValidated) {
      unmetChecklistDetails.push(
        'Attendance validation requires moderator presence and either both sides present or documented no-show.',
      );
    }

    return {
      canIssueVerdict,
      blockingChecklist,
      checklist,
      unmetChecklist,
      unmetChecklistDetails,
      absentRequiredParticipants,
      context: {
        disputeId: dispute.id,
        disputeStatus: dispute.status,
        disputePhase: dispute.phase,
        hearingId: hearing.id,
        hearingStatus: hearing.status,
      },
    };
  }
}
