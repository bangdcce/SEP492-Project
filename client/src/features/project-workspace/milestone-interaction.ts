import type { Milestone } from "./types";

export type MilestoneInteractionGateState =
  | "UNLOCKED"
  | "LOCKED_PREVIOUS_MILESTONE_NOT_PAID"
  | "LOCKED_NOT_FUNDED";

export type MilestoneInteractionGate = {
  milestoneId: string;
  state: MilestoneInteractionGateState;
  isUnlocked: boolean;
  reason: string | null;
  shortLabel: string | null;
  blockingMilestoneId: string | null;
  blockingMilestoneOrder: number | null;
};

const getMilestoneOrderNumber = (milestone: Milestone, index: number) =>
  typeof milestone.sortOrder === "number" ? milestone.sortOrder : index + 1;

const sortMilestonesForInteraction = (milestones: Milestone[]) =>
  [...milestones].sort((left, right) => {
    const leftSortOrder =
      typeof left.sortOrder === "number" ? left.sortOrder : Number.MAX_SAFE_INTEGER;
    const rightSortOrder =
      typeof right.sortOrder === "number" ? right.sortOrder : Number.MAX_SAFE_INTEGER;
    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    const leftStart = left.startDate
      ? new Date(left.startDate).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightStart = right.startDate
      ? new Date(right.startDate).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });

const isMilestoneEscrowFullyFunded = (milestone: Milestone): boolean => {
  const escrowStatus = String(milestone.escrow?.status || "").toUpperCase();
  const milestoneStatus = String(milestone.status || "").toUpperCase();

  if (milestoneStatus === "PAID" || milestoneStatus === "COMPLETED") {
    return true;
  }

  if (escrowStatus !== "FUNDED" && escrowStatus !== "RELEASED") {
    return false;
  }

  const fundedAmount = Number(milestone.escrow?.fundedAmount ?? 0);
  const totalAmount = Number(
    milestone.escrow?.totalAmount ?? milestone.amount ?? 0,
  );
  return fundedAmount >= totalAmount;
};

export const buildMilestoneInteractionGateMap = (
  milestones: Milestone[],
): Record<string, MilestoneInteractionGate> => {
  const gates: Record<string, MilestoneInteractionGate> = {};
  const sortedMilestones = sortMilestonesForInteraction(milestones);

  let firstBlockingMilestone: Milestone | null = null;
  let firstBlockingOrder: number | null = null;

  sortedMilestones.forEach((milestone, index) => {
    const orderNumber = getMilestoneOrderNumber(milestone, index);

    if (firstBlockingMilestone) {
      gates[milestone.id] = {
        milestoneId: milestone.id,
        state: "LOCKED_PREVIOUS_MILESTONE_NOT_PAID",
        isUnlocked: false,
        reason: `This milestone is locked until Milestone #${firstBlockingOrder} (${firstBlockingMilestone.title}) is fully approved and PAID.`,
        shortLabel: `Locked until Milestone #${firstBlockingOrder} is PAID`,
        blockingMilestoneId: firstBlockingMilestone.id,
        blockingMilestoneOrder: firstBlockingOrder,
      };
      return;
    }

    if (!isMilestoneEscrowFullyFunded(milestone)) {
      gates[milestone.id] = {
        milestoneId: milestone.id,
        state: "LOCKED_NOT_FUNDED",
        isUnlocked: false,
        reason: "This milestone is locked until the client fully funds its escrow.",
        shortLabel: "Funding required",
        blockingMilestoneId: null,
        blockingMilestoneOrder: null,
      };
    } else {
      gates[milestone.id] = {
        milestoneId: milestone.id,
        state: "UNLOCKED",
        isUnlocked: true,
        reason: null,
        shortLabel: null,
        blockingMilestoneId: null,
        blockingMilestoneOrder: null,
      };
    }

    if (String(milestone.status || "").toUpperCase() !== "PAID") {
      firstBlockingMilestone = milestone;
      firstBlockingOrder = orderNumber;
    }
  });

  return gates;
};
