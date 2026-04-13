import test from "node:test";
import assert from "node:assert/strict";
import { getSubmissionApprovalDialogCopy } from "./submission-review-flow.ts";

test("broker approval copy marks pending submissions done immediately instead of sending them to client review", () => {
  const copy = getSubmissionApprovalDialogCopy("PENDING");

  assert.equal(copy.description, "The task will be marked as DONE immediately.");
  assert.equal(copy.actionLabel, "Confirm & Mark as Done");
});

test("legacy client-review submissions still use done-focused approval copy", () => {
  const copy = getSubmissionApprovalDialogCopy("PENDING_CLIENT_REVIEW");

  assert.equal(copy.description, "The task will be marked as DONE.");
  assert.equal(copy.actionLabel, "Confirm & Mark as Done");
});
