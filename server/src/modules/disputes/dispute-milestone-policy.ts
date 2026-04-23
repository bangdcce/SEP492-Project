import { DisputeCategory, EscrowStatus, MilestoneStatus } from 'src/database/entities';

export const USER_RAISEABLE_DISPUTE_CATEGORIES = [
  DisputeCategory.QUALITY,
  DisputeCategory.DEADLINE,
  DisputeCategory.COMMUNICATION,
  DisputeCategory.PAYMENT,
] as const;

export type UserRaiseableDisputeCategory = (typeof USER_RAISEABLE_DISPUTE_CATEGORIES)[number];
export type MilestoneDisputePhase = 'PRE_DELIVERY' | 'REVIEW' | 'POST_DELIVERY' | 'CLOSED';

export interface MilestoneDisputePolicy {
  canRaise: boolean;
  phase: MilestoneDisputePhase;
  allowedCategories: UserRaiseableDisputeCategory[];
  blockedCategories: Partial<Record<UserRaiseableDisputeCategory, string>>;
  reason: string | null;
  warrantyEndsAt: Date | null;
}

interface ResolveMilestoneDisputePolicyInput {
  milestoneStatus?: string | null;
  escrowStatus?: string | null;
  releasedAt?: Date | string | null;
  dueDate?: Date | string | null;
  now?: Date;
}

export const DISPUTE_WARRANTY_WINDOW_DAYS = 30;

const toDate = (value?: Date | string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildBlockedCategoryMap = (reason: string) =>
  USER_RAISEABLE_DISPUTE_CATEGORIES.reduce<Partial<Record<UserRaiseableDisputeCategory, string>>>(
    (accumulator, category) => {
      accumulator[category] = reason;
      return accumulator;
    },
    {},
  );

export const isUserRaiseableDisputeCategory = (
  category: DisputeCategory,
): category is UserRaiseableDisputeCategory =>
  USER_RAISEABLE_DISPUTE_CATEGORIES.includes(category as UserRaiseableDisputeCategory);

export const resolveMilestoneDisputePolicy = (
  input: ResolveMilestoneDisputePolicyInput,
): MilestoneDisputePolicy => {
  const now = input.now ?? new Date();
  const milestoneStatus = String(input.milestoneStatus ?? '').toUpperCase() as MilestoneStatus;
  const escrowStatus = input.escrowStatus
    ? (String(input.escrowStatus).toUpperCase() as EscrowStatus)
    : null;

  let phase: MilestoneDisputePhase = 'CLOSED';
  let reason: string | null = null;
  let allowedCategories: UserRaiseableDisputeCategory[] = [];
  const blockedCategories: Partial<Record<UserRaiseableDisputeCategory, string>> = {};
  let warrantyEndsAt: Date | null = null;

  switch (milestoneStatus) {
    case MilestoneStatus.IN_PROGRESS:
      phase = 'PRE_DELIVERY';
      allowedCategories = [
        DisputeCategory.DEADLINE,
        DisputeCategory.COMMUNICATION,
        DisputeCategory.PAYMENT,
      ];
      break;

    case MilestoneStatus.SUBMITTED:
    case MilestoneStatus.PENDING_STAFF_REVIEW:
    case MilestoneStatus.PENDING_CLIENT_APPROVAL:
    case MilestoneStatus.REVISIONS_REQUIRED:
      phase = 'REVIEW';
      allowedCategories = [...USER_RAISEABLE_DISPUTE_CATEGORIES];
      break;

    case MilestoneStatus.COMPLETED:
      phase = 'POST_DELIVERY';
      allowedCategories = [DisputeCategory.QUALITY, DisputeCategory.PAYMENT];
      break;

    case MilestoneStatus.PAID: {
      phase = 'POST_DELIVERY';
      allowedCategories = [DisputeCategory.QUALITY, DisputeCategory.PAYMENT];

      const paidAt = toDate(input.releasedAt) ?? toDate(input.dueDate);
      if (paidAt) {
        warrantyEndsAt = new Date(paidAt);
        warrantyEndsAt.setDate(warrantyEndsAt.getDate() + DISPUTE_WARRANTY_WINDOW_DAYS);

        if (now.getTime() > warrantyEndsAt.getTime()) {
          reason =
            'Post-delivery dispute window has expired. Paid milestones can only be disputed within 30 days of payout.';
        }
      }
      break;
    }

    case MilestoneStatus.PENDING: {
      const dueDate = toDate(input.dueDate);
      if (dueDate && dueDate.getTime() < now.getTime()) {
        phase = 'PRE_DELIVERY';
        allowedCategories = [DisputeCategory.DEADLINE];
      } else {
        reason = 'Dispute opens after work starts or the milestone enters review.';
      }
      break;
    }

    case MilestoneStatus.LOCKED:
      reason = 'This milestone is already locked by an active dispute workflow.';
      break;

    default:
      reason = 'Dispute is not available for the current milestone state.';
      break;
  }

  if (!reason && allowedCategories.includes(DisputeCategory.DEADLINE)) {
    const dueDate = toDate(input.dueDate);
    if (!dueDate) {
      blockedCategories[DisputeCategory.DEADLINE] =
        'Deadline disputes require the milestone to have a due date.';
      allowedCategories = allowedCategories.filter(
        (category) => category !== DisputeCategory.DEADLINE,
      );
    } else if (dueDate.getTime() >= now.getTime()) {
      blockedCategories[DisputeCategory.DEADLINE] =
        'Deadline disputes open only after the milestone due date has passed.';
      allowedCategories = allowedCategories.filter(
        (category) => category !== DisputeCategory.DEADLINE,
      );
    }
  }

  if (!reason) {
    const allowedEscrowStatuses =
      milestoneStatus === MilestoneStatus.PAID
        ? new Set<EscrowStatus>([
            EscrowStatus.FUNDED,
            EscrowStatus.RELEASED,
            EscrowStatus.DISPUTED,
          ])
        : new Set<EscrowStatus>([EscrowStatus.FUNDED, EscrowStatus.DISPUTED]);

    if (!escrowStatus) {
      reason = 'Dispute opens after escrow is set up for this milestone.';
    } else if (!allowedEscrowStatuses.has(escrowStatus)) {
      reason =
        escrowStatus === EscrowStatus.PENDING
          ? 'Dispute opens after the milestone escrow is funded.'
          : 'Escrow is not in a dispute-ready state for this milestone.';
    }
  }

  if (reason) {
    return {
      canRaise: false,
      phase,
      allowedCategories: [],
      blockedCategories: buildBlockedCategoryMap(reason),
      reason,
      warrantyEndsAt,
    };
  }

  return {
    canRaise: allowedCategories.length > 0,
    phase,
    allowedCategories,
    blockedCategories,
    reason: allowedCategories.length > 0 ? null : 'No dispute categories are available right now.',
    warrantyEndsAt,
  };
};
