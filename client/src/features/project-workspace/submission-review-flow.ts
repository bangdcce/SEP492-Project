import type { TaskSubmissionStatus } from "./types";

export const getSubmissionApprovalDialogCopy = (
  status?: TaskSubmissionStatus | null,
) => {
  if (status === "PENDING_CLIENT_REVIEW") {
    return {
      description: "The task will be marked as DONE.",
      actionLabel: "Confirm & Mark as Done",
    };
  }

  return {
    description: "The task will be marked as DONE immediately.",
    actionLabel: "Confirm & Mark as Done",
  };
};
