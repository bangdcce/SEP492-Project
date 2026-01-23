import { BadRequestException } from '@nestjs/common';
import { DisputeResult, DisputeStatus, DisputeType } from 'src/database/entities';

const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  [DisputeStatus.OPEN]: [DisputeStatus.PENDING_REVIEW, DisputeStatus.IN_MEDIATION, DisputeStatus.INFO_REQUESTED, DisputeStatus.REJECTED],
  [DisputeStatus.PENDING_REVIEW]: [DisputeStatus.IN_MEDIATION, DisputeStatus.INFO_REQUESTED, DisputeStatus.REJECTED],
  [DisputeStatus.INFO_REQUESTED]: [DisputeStatus.PENDING_REVIEW, DisputeStatus.REJECTED],
  [DisputeStatus.IN_MEDIATION]: [DisputeStatus.REJECTED, DisputeStatus.RESOLVED],
  [DisputeStatus.REJECTED]: [DisputeStatus.REJECTION_APPEALED],
  [DisputeStatus.REJECTION_APPEALED]: [DisputeStatus.IN_MEDIATION, DisputeStatus.REJECTED],
  [DisputeStatus.RESOLVED]: [DisputeStatus.APPEALED], // Resolved có thể chuyển sang APPEALED
  [DisputeStatus.APPEALED]: [DisputeStatus.IN_MEDIATION, DisputeStatus.RESOLVED], // Appeal có thể mở lại hoặc giữ nguyên
};

export class DisputeStateMachine {
  static canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static transition(currentStatus: DisputeStatus, newStatus: DisputeStatus) {
    if (!this.canTransition(currentStatus, newStatus))
      throw new BadRequestException(
        `Cannot change from ${currentStatus} " to" ${newStatus}.` +
          `Hợp lệ: [${VALID_TRANSITIONS[currentStatus].join(', ') || 'KHÔNG CÓ'}]`,
      );

    return newStatus;
  }

  static validateVerdict(verdict: DisputeResult) {
    if (verdict === DisputeResult.PENDING)
      throw new BadRequestException('Verdict không thể là PENDING khi resolve');
  }
  static canResolve(currentStatus: DisputeStatus): boolean {
    return this.canTransition(currentStatus, DisputeStatus.RESOLVED);
  }

  static isTerminalState(status: DisputeStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0;
  }
}

/**
 * Xác định người thua cuộc dựa trên verdict và dispute type
 * Hỗ trợ tất cả các loại dispute bao gồm cả broker
 */
export function determineLoser(
  verdict: DisputeResult,
  raiserId: string,
  defendantId: string,
  disputeType?: DisputeType,
): { loserId: string | null; winnerId: string | null } {
  // SPLIT = không ai thua
  if (verdict === DisputeResult.SPLIT || verdict === DisputeResult.PENDING) {
    return { loserId: null, winnerId: null };
  }

  // Xác định ai là "Client side" và ai là "Freelancer side" dựa trên dispute type
  // Note: Trong dispute type, người đầu tiên luôn là raiser
  let clientSideId: string;
  let freelancerSideId: string;

  switch (disputeType) {
    // Client là raiser
    case DisputeType.CLIENT_VS_FREELANCER:
    case DisputeType.CLIENT_VS_BROKER:
      clientSideId = raiserId;
      freelancerSideId = defendantId;
      break;

    // Freelancer là raiser
    case DisputeType.FREELANCER_VS_CLIENT:
    case DisputeType.FREELANCER_VS_BROKER:
      clientSideId = defendantId;
      freelancerSideId = raiserId;
      break;

    // Broker là raiser (broker được coi như freelancer side)
    case DisputeType.BROKER_VS_CLIENT:
      clientSideId = defendantId;
      freelancerSideId = raiserId;
      break;
    case DisputeType.BROKER_VS_FREELANCER:
      // Broker vs Freelancer: cả hai là "freelancer side", raiser thua nếu WIN_CLIENT là vô nghĩa
      // Trong trường hợp này, WIN_FREELANCER = defendant thắng, WIN_CLIENT = raiser thắng
      clientSideId = raiserId; // Broker đóng vai "client side" trong dispute này
      freelancerSideId = defendantId;
      break;

    // Default: giả định raiser = client, defendant = freelancer (backward compatible)
    default:
      clientSideId = raiserId;
      freelancerSideId = defendantId;
  }

  switch (verdict) {
    case DisputeResult.WIN_CLIENT:
      return { loserId: freelancerSideId, winnerId: clientSideId };
    case DisputeResult.WIN_FREELANCER:
      return { loserId: clientSideId, winnerId: freelancerSideId };
    default:
      return { loserId: null, winnerId: null };
  }
}
