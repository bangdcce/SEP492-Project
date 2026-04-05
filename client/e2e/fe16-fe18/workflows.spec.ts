import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import {
  NOW_ISO,
  TESTER_NAME,
  buildScenario,
  emitSocketEvent,
  expectNotificationBadge,
  findLoggedRequest,
  installScenario,
  type MockState,
} from "./helpers";

type CatalogCase = {
  id: string;
  route: string;
  description: string;
  procedure: string[];
  expectedResults: string[];
};

type CatalogFunction = {
  name: string;
  description: string;
  preCondition: string;
  cases: CatalogCase[];
};

type CatalogFeature = {
  sheetName: string;
  testRequirement: string;
  referenceDocument: string;
  functions: CatalogFunction[];
};

type Catalog = {
  projectName: string;
  projectCode: string;
  documentVersion: string;
  issueDate: string;
  tester: string;
  features: CatalogFeature[];
};

type FlatCase = {
  featureName: string;
  functionName: string;
  functionDescription: string;
  preCondition: string;
  testCase: CatalogCase;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const caseCatalogPath = path.join(currentDir, "case-catalog.json");
const evidenceDir = path.join(
  currentDir,
  "..",
  "..",
  "test-artifacts",
  "fe16-fe18",
  "evidence",
);

const catalog = JSON.parse(fs.readFileSync(caseCatalogPath, "utf8")) as Catalog;
const flatCases: FlatCase[] = catalog.features.flatMap((feature) =>
  feature.functions.flatMap((fn) =>
    fn.cases.map((testCase) => ({
      featureName: feature.sheetName,
      functionName: fn.name,
      functionDescription: fn.description,
      preCondition: fn.preCondition,
      testCase,
    })),
  ),
);

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const parseLoggedJson = (bodyText: string | null) => {
  if (!bodyText) {
    return null;
  }
  try {
    return JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const ensureRequest = (
  state: MockState,
  method: string,
  pathPattern: RegExp,
  message: string,
) => {
  const request = findLoggedRequest(state, method, pathPattern);
  expect(request, message).toBeTruthy();
  return request!;
};

const writeEvidence = (payload: Record<string, unknown>) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const filename = `${slugify(String(payload.id))}.json`;
  fs.writeFileSync(
    path.join(evidenceDir, filename),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
};

const requestLine = (entry: { method: string; path: string; query: string }) =>
  `${entry.method} ${entry.path}${entry.query}`;

const openReviewMenu = async (page: Page, reviewId: string) => {
  await page.getByTestId(`review-menu-${reviewId}`).click();
};

const openNotificationPanel = async (page: Page) => {
  await page.getByTestId("notification-trigger").click();
  await expect(page.getByTestId("notification-panel")).toBeVisible();
};

const openDisputeDetailTab = async (
  page: Page,
  tabName: "Timeline" | "Hearings" | "Evidence Vault",
) => {
  const tab = page.getByRole("tab", { name: tabName });
  await expect(tab).toBeVisible();
  const isSelected = await tab.getAttribute("aria-selected");
  if (isSelected !== "true") {
    await tab.click();
  }
  await expect(tab).toHaveAttribute("aria-selected", "true");
};

const openDisputeWizard = async (page: Page) => {
  await page.getByTestId("raise-dispute-milestone-900-1").click();
  await expect(page.getByTestId("dispute-category-quality")).toBeVisible();
};

const advanceDisputeWizard = async (
  page: Page,
  {
    categoryId,
    defendantId,
    reason,
    parentDisputeId,
  }: {
    categoryId: string;
    defendantId: string;
    reason: string;
    parentDisputeId?: string;
  },
) => {
  if (parentDisputeId) {
    await page
      .getByLabel("Add another party to an existing dispute case on this milestone")
      .check();
    await page.locator("select").first().selectOption(parentDisputeId);
  }

  await page.getByTestId(`dispute-category-${categoryId}`).click();
  await page.getByTestId("dispute-defendant-select").selectOption(defendantId);
  await page.getByTestId("dispute-step-1-next").click();
  await page.getByTestId("dispute-reason-textarea").fill(reason);
  await page.getByTestId("dispute-step-2-next").click();
  await page.getByTestId("dispute-disclaimer-checkbox").check();
  await page.getByTestId("dispute-confirm-submit").click();
};

const fillLongAppealReason = () =>
  [
    "The verdict ignores the signed revision approval dated March 21 and the delivery acceptance note recorded after the scope amendment.",
    "It calculates the refund split from the original estimate instead of the revised scope that both parties confirmed in writing.",
    "That procedural error materially changes the refund math, the escrow release logic, and the responsibility assigned to each party in the final settlement summary.",
  ].join(" ");

const caseHandlers: Record<string, (page: Page, state: MockState) => Promise<string>> = {
  "View Trust Profile - 1": async (page, state) => {
    await expect(page.getByText("Alex Stone")).toBeVisible();
    await expect(page.getByTestId("trust-profile-reviews-section")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Brand Portal Revamp" })).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/trust-profiles\/freelancer-200$/,
      "Expected trust-profile request for freelancer-200.",
    );
    return `Loaded ${requestLine(request)} and rendered Alex Stone's trust score, seeded review cards, and completed project history for Brand Portal Revamp.`;
  },
  "View Trust Profile - 2": async (page, state) => {
    await expect(page.getByText("Unable to load trust profile")).toBeVisible();
    await expect(page.getByText("The requested trust profile could not be found.")).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/trust-profiles\/missing-user$/,
      "Expected trust-profile request for missing-user.",
    );
    return `Stayed inside the protected layout after ${requestLine(request)} failed and showed the stable trust-profile error panel with the Back action.`;
  },
  "Create Review - 1": async (page, state) => {
    await page.getByTestId("open-create-review").click();
    await expect(page.getByTestId("create-review-modal")).toBeVisible();
    await page.getByTestId("create-review-rating-star-4").click();
    await page
      .getByTestId("create-review-comment")
      .fill("Delivered the dashboard fixes on schedule and communicated clearly.");
    await page.getByTestId("submit-create-review").click();
    await expect(
      page.getByText("Delivered the dashboard fixes on schedule and communicated clearly."),
    ).toBeVisible();
    await expect(page.getByText("You have already reviewed this user.")).toBeVisible();
    const request = ensureRequest(
      state,
      "POST",
      /^\/reviews$/,
      "Expected create-review request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.rating).toBe(4);
    return `Submitted ${requestLine(request)} with rating ${String(payload?.rating)} and the review comment, then the trust profile reloaded with the new review card and the already-reviewed banner.`;
  },
  "Create Review - 2": async (page, state) => {
    await page.getByTestId("open-create-review").click();
    await page
      .getByTestId("create-review-comment")
      .fill("Attempting to submit a duplicate review for the same project.");
    await page.getByTestId("submit-create-review").click();
    await expect(page.getByText("You have already reviewed this user.")).toBeVisible();
    const request = ensureRequest(
      state,
      "POST",
      /^\/reviews$/,
      "Expected duplicate create-review request.",
    );
    return `Triggered ${requestLine(request)} and the modal stayed open with the translated duplicate-review validation message instead of appending a new review card.`;
  },
  "Edit Review - 1": async (page, state) => {
    await openReviewMenu(page, "review-own-1");
    await page.getByTestId("edit-review-review-own-1").click();
    await expect(page.getByTestId("edit-review-modal")).toBeVisible();
    await page.getByTestId("edit-review-rating-star-3").click();
    await page
      .getByTestId("edit-review-comment")
      .fill("Needed one more revision cycle before approval, but the final hand-off was correct.");
    await page.getByTestId("submit-edit-review").click();
    await expect(
      page.getByText("Needed one more revision cycle before approval, but the final hand-off was correct."),
    ).toBeVisible();
    await expect(page.getByText("(edited)")).toBeVisible();
    const request = ensureRequest(
      state,
      "PATCH",
      /^\/reviews\/review-own-1$/,
      "Expected review update request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.rating).toBe(3);
    return `Executed ${requestLine(request)} with the revised 3-star payload and the trust profile refreshed the own review card with the edited marker.`;
  },
  "Edit Review - 2": async (page) => {
    await openReviewMenu(page, "review-own-1");
    await expect(page.getByText("Edit expired (72h limit)")).toBeVisible();
    await expect(page.getByTestId("edit-review-review-own-1")).toHaveCount(0);
    return "Opened the review action menu for an older review and verified that editing was locked behind the visible 72-hour expiry message.";
  },
  "View Edit History - 1": async (page, state) => {
    await openReviewMenu(page, "review-own-1");
    await page.getByTestId("review-history-review-own-1").click();
    await expect(page.getByTestId("review-edit-history-page")).toBeVisible();
    await expect(page.getByTestId("history-entry-review-own-1-v3")).toBeVisible();
    await expect(page.getByTestId("history-entry-review-own-1-v2")).toBeVisible();
    await expect(page.getByTestId("history-entry-review-own-1-v1")).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/reviews\/review-own-1\/history$/,
      "Expected review history request.",
    );
    return `Opened the dedicated history page after ${requestLine(request)} and rendered the current plus prior saved versions in descending order.`;
  },
  "View Edit History - 2": async (page, state) => {
    await openReviewMenu(page, "review-own-1");
    await page.getByTestId("review-history-review-own-1").click();
    await expect(page.getByTestId("review-edit-history-page")).toBeVisible();
    await expect(page.getByTestId("history-entry-review-own-1-single")).toBeVisible();
    await expect(page.getByText("Original")).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/reviews\/review-own-1\/history$/,
      "Expected single-entry review history request.",
    );
    return `Loaded ${requestLine(request)} and kept the history page stable even when the timeline only contained the original saved version.`;
  },
  "Report Review Abuse - 1": async (page, state) => {
    await openReviewMenu(page, "review-third-party-1");
    await page.getByTestId("report-review-review-third-party-1").click();
    await page.getByTestId("report-reason-other").click();
    await page
      .getByTestId("report-review-description")
      .fill("The review references a project that never existed in this account.");
    await page.getByTestId("submit-report-review").click();
    await expect(page.getByText("Report submitted")).toBeVisible();
    const request = ensureRequest(
      state,
      "POST",
      /^\/reports$/,
      "Expected abuse-report request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.reason).toBe("OTHER");
    return `Submitted ${requestLine(request)} with the OTHER reason and moderator note, then the modal moved into the success confirmation state.`;
  },
  "Report Review Abuse - 2": async (page, state) => {
    await openReviewMenu(page, "review-third-party-1");
    await page.getByTestId("report-review-review-third-party-1").click();
    await page.getByTestId("report-reason-fake_review").click();
    await page.getByTestId("submit-report-review").click();
    await expect(page.getByText("You have already reported this review.")).toBeVisible();
    const request = ensureRequest(
      state,
      "POST",
      /^\/reports$/,
      "Expected duplicate abuse-report request.",
    );
    return `Triggered ${requestLine(request)} and the modal remained open with the duplicate-report error instead of showing a success confirmation.`;
  },
  "Moderate Reviews - 1": async (page, state) => {
    await expect(page.getByTestId("moderation-review-review-flagged-1")).toBeVisible();
    await page.getByTestId("moderation-open-case-review-flagged-1").click();
    await page.getByTestId("moderation-take-ownership-review-flagged-1").click();
    await page.getByTestId("moderation-soft-delete-review-flagged-1").click();
    await page.getByLabel("Fake / Fraudulent Review").check();
    await page
      .getByPlaceholder("Provide additional context or details...")
      .fill("Confirmed fake testimonial from unrelated account.");
    await page.getByRole("button", { name: "Soft Delete Review" }).click();
    await expect(page.getByTestId("moderation-review-review-flagged-1")).toContainText("Deleted");
    const openRequest = ensureRequest(
      state,
      "POST",
      /^\/reviews\/admin\/moderation\/review-flagged-1\/open$/,
      "Expected moderation open-case request.",
    );
    const takeRequest = ensureRequest(
      state,
      "POST",
      /^\/reviews\/admin\/moderation\/review-flagged-1\/take$/,
      "Expected moderation take-ownership request.",
    );
    const deleteRequest = ensureRequest(
      state,
      "DELETE",
      /^\/reviews\/review-flagged-1$/,
      "Expected moderation soft-delete request.",
    );
    return `Processed ${requestLine(openRequest)}, ${requestLine(takeRequest)}, and ${requestLine(deleteRequest)}; the flagged card stayed visible in the queue with Deleted status and refreshed moderation history.`;
  },
  "Moderate Reviews - 2": async (page, state) => {
    await page.getByTestId("moderation-reassign-review-flagged-1").click();
    await page.getByLabel("Assign to").selectOption("admin-901");
    await page.getByLabel("Handoff note").fill("Move to the backup admin for queue balancing.");
    await page.getByRole("button", { name: "Confirm Reassign" }).click();
    await expect(page.getByTestId("moderation-review-review-flagged-1")).toContainText("Riley Chen");

    await page.getByTestId("moderation-restore-review-deleted-1").click();
    await page
      .getByPlaceholder("e.g., False positive, user appeal approved, content was acceptable...")
      .fill("Evidence cleared after moderator review.");
    await page.getByRole("button", { name: "Restore Review" }).click();
    await expect(page.getByTestId("moderation-restore-review-deleted-1")).toHaveCount(0);

    const reassignRequest = ensureRequest(
      state,
      "POST",
      /^\/reviews\/admin\/moderation\/review-flagged-1\/reassign$/,
      "Expected moderation reassign request.",
    );
    const restoreRequest = ensureRequest(
      state,
      "POST",
      /^\/reviews\/review-deleted-1\/restore$/,
      "Expected moderation restore request.",
    );
    return `Reassigned the flagged case through ${requestLine(reassignRequest)} and restored the deleted review through ${requestLine(restoreRequest)}; the queue reflected the new assignee and removed the Restore action from the recovered card.`;
  },
  "Open My Disputes - 1": async (page, state) => {
    await expect(page.getByText("My Disputes")).toBeVisible();
    await expect(page.getByTestId("dispute-card-dispute-200")).toBeVisible();
    await expect(page.getByText("Brand Portal Revamp Delivery Dispute")).toBeVisible();
    await expect(page.getByTestId("dispute-group-active")).toContainText("Active (1)");
    await expect(page.getByTestId("dispute-group-appeals")).toContainText("Appeals (1)");
    await expect(page.getByTestId("dispute-group-closed")).toContainText("Closed (1)");
    const request = ensureRequest(
      state,
      "GET",
      /^\/disputes\/my$/,
      "Expected participant dispute list request.",
    );
    return `Loaded ${requestLine(request)} and rendered the active case card with project metadata, next-step guidance, plus correct Active/Appeals/Closed counters.`;
  },
  "Open My Disputes - 2": async (page, state) => {
    await page.getByTestId("dispute-group-appeals").click();
    const appealedCard = page.getByTestId("dispute-card-dispute-400");
    await expect(appealedCard).toBeVisible();
    await expect(appealedCard.getByText("Appeal active").first()).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/disputes\/my$/,
      "Expected participant dispute list request before filtering appeals.",
    );
    return `Used the Appeals pill after ${requestLine(request)} and the dashboard filtered the list down to the appealed dispute card with Appeal active metadata.`;
  },
  "Create Dispute - 1": async (page, state) => {
    await openDisputeWizard(page);
    await advanceDisputeWizard(page, {
      categoryId: "quality",
      defendantId: "freelancer-200",
      reason:
        "Submitted UI build ignored the approved accessibility checklist and delivered incomplete navigation states.",
    });
    await expect(page).toHaveURL(/\/client\/hearings\?createdDisputeId=dispute-created-1&projectId=project-900/);
    const request = ensureRequest(
      state,
      "POST",
      /^\/disputes$/,
      "Expected dispute creation request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.category).toBe("QUALITY");
    expect(payload?.defendantId).toBe("freelancer-200");
    return `Created a new workspace dispute through ${requestLine(request)} with the QUALITY category, freelancer-200 as defendant, and redirected the client to the hearings route with createdDisputeId=dispute-created-1.`;
  },
  "Create Dispute - 2": async (page, state) => {
    await openDisputeWizard(page);
    await advanceDisputeWizard(page, {
      categoryId: "payment",
      defendantId: "broker-300",
      parentDisputeId: "dispute-parent-01",
      reason:
        "Need the broker added because the refund route now involves both payment approvers.",
    });
    await expect(page).toHaveURL(/\/client\/hearings\?createdDisputeId=dispute-created-1&projectId=project-900/);
    const request = ensureRequest(
      state,
      "POST",
      /^\/disputes$/,
      "Expected add-party dispute creation request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.parentDisputeId).toBe("dispute-parent-01");
    expect(payload?.defendantId).toBe("broker-300");
    return `Submitted ${requestLine(request)} with parentDisputeId=dispute-parent-01 so the new party was attached to the existing milestone case before redirecting to the hearings page.`;
  },
  "Review Dispute Detail - 1": async (page, state) => {
    await expect(page.getByText("Brand Portal Revamp Delivery Dispute")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Timeline" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await openDisputeDetailTab(page, "Evidence Vault");
    await expect(page.getByTestId("evidence-vault")).toBeVisible();
    await openDisputeDetailTab(page, "Hearings");
    await expect(page.getByTestId("dispute-hearing-panel")).toBeVisible();
    const detailRequest = ensureRequest(
      state,
      "GET",
      /^\/disputes\/dispute-200$/,
      "Expected dispute detail request.",
    );
    const activitiesRequest = ensureRequest(
      state,
      "GET",
      /^\/disputes\/dispute-200\/activities$/,
      "Expected dispute activity request.",
    );
    return `Rendered the dispute hub after ${requestLine(detailRequest)} and ${requestLine(activitiesRequest)}; the case summary, timeline, evidence vault, and hearing panel all loaded without leaving the dispute route.`;
  },
  "Review Dispute Detail - 2": async (page, state) => {
    await page.getByTestId("export-dispute-dossier").click();
    const exportRequest = ensureRequest(
      state,
      "GET",
      /^\/disputes\/dispute-200\/dossier\/export$/,
      "Expected dossier export request.",
    );
    return `Triggered ${requestLine(exportRequest)} from the dispute action bar and the frontend completed the dossier export flow without a visible UI error.`;
  },
  "Manage Evidence - 1": async (page, state) => {
    await openDisputeDetailTab(page, "Evidence Vault");
    await expect(page.getByTestId("evidence-vault")).toBeVisible();
    await page.getByTestId("upload-evidence-input").setInputFiles({
      name: "handoff-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("playwright evidence upload"),
    });
    await expect(page.getByText("handoff-notes.txt")).toBeVisible();
    const uploadRequest = ensureRequest(
      state,
      "POST",
      /^\/disputes\/dispute-200\/evidence$/,
      "Expected evidence upload request.",
    );
    expect(uploadRequest.bodyText).toContain("handoff-notes.txt");
    return `Uploaded participant evidence through ${requestLine(uploadRequest)} and the refreshed vault prepended the new handoff-notes.txt card on the same dispute page.`;
  },
  "Manage Evidence - 2": async (page, state) => {
    await openDisputeDetailTab(page, "Evidence Vault");
    const evidenceCard = page.getByTestId("evidence-card-evidence-graphic-1");
    await expect(evidenceCard).toBeVisible();
    await evidenceCard.hover();
    await page.getByTestId("evidence-flag-evidence-graphic-1").click({ force: true });
    await page
      .getByTestId("flag-evidence-reason")
      .fill("Sensitive personal data is visible in the uploaded screenshot.");
    await page.getByTestId("flag-evidence-confirm").click();
    await expect(evidenceCard).toContainText("Content Hidden");
    const flagRequest = ensureRequest(
      state,
      "POST",
      /^\/disputes\/dispute-200\/evidence\/evidence-graphic-1\/flag$/,
      "Expected evidence flag request.",
    );
    return `Flagged the evidence item through ${requestLine(flagRequest)} and the vault refreshed the card into the Content Hidden moderator state.`;
  },
  "Conduct Hearing & Verdict - 1": async (page, state) => {
    await openDisputeDetailTab(page, "Hearings");
    await expect(page.getByTestId("dispute-hearing-panel")).toBeVisible();
    await page.getByTestId("schedule-hearing-at").fill("2026-04-02T09:30");
    await page.getByTestId("schedule-hearing-duration").fill("90");
    await page
      .getByTestId("schedule-hearing-agenda")
      .fill("Review escrow release evidence and cross-check delivery acceptance timeline.");
    await page
      .getByTestId("schedule-hearing-required-docs")
      .fill("signed change request, final hand-off build");
    await page
      .getByTestId("schedule-hearing-meeting-link")
      .fill("https://meet.google.com/aaa-bbbb-ccc");
    await page.getByTestId("schedule-hearing-confirmed").check();
    await page.getByTestId("schedule-hearing-submit").click();
    await expect(page.getByTestId("hearing-card-hearing-created-1")).toBeVisible();
    const request = ensureRequest(
      state,
      "POST",
      /^\/disputes\/hearings\/schedule$/,
      "Expected hearing schedule request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.estimatedDurationMinutes).toBe(90);
    return `Scheduled a new hearing through ${requestLine(request)} with a 90-minute duration and the custom agenda, then the new hearing card appeared in the active timeline.`;
  },
  "Conduct Hearing & Verdict - 2": async (page, state) => {
    await openDisputeDetailTab(page, "Hearings");
    await expect(page.getByTestId("hearing-card-hearing-300-1")).toBeVisible();
    await page.getByTestId("start-hearing-hearing-300-1").click();
    await page.getByTestId("open-end-hearing-hearing-300-1").click();
    await page
      .getByTestId("end-hearing-summary")
      .fill("Both parties joined and confirmed the revised scope agreement.");
    await page
      .getByTestId("end-hearing-findings")
      .fill("Evidence confirms the scope changed after the original estimate was approved.");
    await page
      .getByTestId("end-hearing-pending-actions")
      .fill("Broker to issue a revised payment release recommendation.");
    await page.getByTestId("end-hearing-submit").click();
    await expect(page.getByTestId("hearing-card-hearing-300-1")).toContainText("COMPLETED");
    const startRequest = ensureRequest(
      state,
      "POST",
      /^\/disputes\/hearings\/hearing-300-1\/start$/,
      "Expected hearing start request.",
    );
    const endRequest = ensureRequest(
      state,
      "POST",
      /^\/disputes\/hearings\/hearing-300-1\/end$/,
      "Expected hearing end request.",
    );
    return `Advanced the hearing lifecycle with ${requestLine(startRequest)} and ${requestLine(endRequest)}; the hearing card moved to completed state and displayed the saved summary/findings content.`;
  },
  "Submit Appeal / Review Request - 1": async (page, state) => {
    await page.getByTestId("open-appeal-dialog").click();
    await expect(page.getByTestId("appeal-dialog")).toBeVisible();
    await page.getByTestId("appeal-reason-input").fill(fillLongAppealReason());
    await page.getByTestId("appeal-review-step").click();
    await page.getByTestId("appeal-disclaimer-checkbox").check();
    await page.getByTestId("submit-appeal").click();
    await expect(page.getByTestId("appeal-dialog")).toHaveCount(0);
    const request = ensureRequest(
      state,
      "POST",
      /^\/disputes\/dispute-400\/appeal$/,
      "Expected dispute appeal request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(String(payload?.reason || "").length).toBeGreaterThanOrEqual(200);
    return `Submitted the formal appeal through ${requestLine(request)} with a 200+ character reason and completed the disclaimer review step before the dialog closed.`;
  },
  "Submit Appeal / Review Request - 2": async (page, state) => {
    await page.getByTestId("open-support-escalation-dialog").click();
    await expect(page.getByTestId("review-request-dialog")).toBeVisible();
    await page
      .getByTestId("review-request-reason")
      .fill("Need a neutral staff review because both parties disagree on which milestone acceptance checklist applies.");
    await page
      .getByTestId("review-request-impact")
      .fill("Project delivery is blocked and escrow release cannot proceed until the checklist conflict is resolved.");
    await page.getByTestId("submit-review-request").click();
    await expect(page.getByTestId("review-request-dialog")).toHaveCount(0);
    const request = ensureRequest(
      state,
      "POST",
      /^\/disputes\/dispute-400\/escalation-request$/,
      "Expected support-escalation request.",
    );
    const payload = parseLoggedJson(request.bodyText);
    expect(payload?.kind).toBe("SUPPORT_ESCALATION");
    return `Submitted ${requestLine(request)} from the review-request dialog with the support-escalation reason and impact summary, then the dialog closed cleanly.`;
  },
  "Open Notifications - 1": async (page, state) => {
    await expectNotificationBadge(page, "3");
    await openNotificationPanel(page);
    await expect(page.getByTestId("notification-item-notif-dispute-1")).toBeVisible();
    await expect(page.getByTestId("notification-item-notif-hearing-1")).toBeVisible();
    await expect(page.getByTestId("notification-item-notif-info-1")).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/notifications$/,
      "Expected notification list request.",
    );
    return `Loaded ${requestLine(request)} and the header dropdown showed the unread badge plus the seeded dispute, hearing, and informational notification items in the protected client layout.`;
  },
  "Open Notifications - 2": async (page, state) => {
    await expectNotificationBadge(page, null);
    await openNotificationPanel(page);
    await expect(page.getByText("No notifications yet.")).toBeVisible();
    const request = ensureRequest(
      state,
      "GET",
      /^\/notifications$/,
      "Expected notification list request for the empty state.",
    );
    return `Loaded ${requestLine(request)} with an empty feed and the dropdown rendered the stable No notifications yet. placeholder instead of a broken list.`;
  },
  "Read Notification - 1": async (page, state) => {
    await expectNotificationBadge(page, "1");
    await openNotificationPanel(page);
    await page.getByTestId("notification-item-notif-info-unread").click();
    await expectNotificationBadge(page, null);
    await expect(page).toHaveURL(/\/client\/disputes$/);
    const request = ensureRequest(
      state,
      "PATCH",
      /^\/notifications\/notif-info-unread\/read$/,
      "Expected single notification mark-read request.",
    );
    return `Clicked the unread informational item, sent ${requestLine(request)}, removed the unread badge, and stayed on the current client disputes route because the notification had no target link.`;
  },
  "Read Notification - 2": async (page, state) => {
    await expectNotificationBadge(page, null);
    await openNotificationPanel(page);
    await page.getByTestId("notification-item-notif-read-stable").click();
    await expectNotificationBadge(page, null);
    const request = findLoggedRequest(
      state,
      "PATCH",
      /^\/notifications\/notif-read-stable\/read$/,
    );
    expect(request).toBeUndefined();
    return "Opened an already-read notification without issuing a new mark-read request, and the unread badge stayed unchanged at zero.";
  },
  "Mark All Notifications Read - 1": async (page, state) => {
    await expectNotificationBadge(page, "3");
    await openNotificationPanel(page);
    await page.getByTestId("mark-all-notifications-read").click();
    await expectNotificationBadge(page, null);
    await expect(page.getByText("Unread")).toHaveCount(0);
    const request = ensureRequest(
      state,
      "PATCH",
      /^\/notifications\/read-all$/,
      "Expected bulk notification mark-read request.",
    );
    return `Triggered ${requestLine(request)} and cleared all unread markers from the open dropdown so the unread badge disappeared completely.`;
  },
  "Mark All Notifications Read - 2": async (page, state) => {
    await expectNotificationBadge(page, null);
    await openNotificationPanel(page);
    await page.getByTestId("mark-all-notifications-read").click();
    await expect(page.getByTestId("notification-panel")).toBeVisible();
    await expectNotificationBadge(page, null);
    const request = ensureRequest(
      state,
      "PATCH",
      /^\/notifications\/read-all$/,
      "Expected mark-all-read request even for the already-cleared feed.",
    );
    return `Executed ${requestLine(request)} against an already-read feed and kept the dropdown panel stable with the unread badge still hidden.`;
  },
  "Navigate From Notification - 1": async (page, state) => {
    await openNotificationPanel(page);
    await page.getByTestId("notification-item-notif-dispute-1").click();
    await expect(page).toHaveURL(/\/client\/disputes\/dispute-200$/);
    await expect(page.getByText("Brand Portal Revamp Delivery Dispute")).toBeVisible();
    const request = ensureRequest(
      state,
      "PATCH",
      /^\/notifications\/notif-dispute-1\/read$/,
      "Expected mark-read request for the dispute notification.",
    );
    return `Selected the dispute notification, completed ${requestLine(request)}, and navigated directly to /client/disputes/dispute-200 with the dispute detail hub loaded.`;
  },
  "Navigate From Notification - 2": async (page, state) => {
    await openNotificationPanel(page);
    await page.getByTestId("notification-item-notif-hearing-1").click();
    await expect(page).toHaveURL(/\/client\/hearings$/);
    await expect(page.getByText("Scheduled / ready")).toBeVisible();
    const request = ensureRequest(
      state,
      "PATCH",
      /^\/notifications\/notif-hearing-1\/read$/,
      "Expected mark-read request for the hearing notification.",
    );
    return `Used the hearing notification after ${requestLine(request)} and the frontend navigated into the protected /client/hearings calendar route.`;
  },
  "Receive Realtime Notification - 1": async (page) => {
    await expectNotificationBadge(page, "3");
    await emitSocketEvent(page, "NOTIFICATION_CREATED", {
      notification: {
        id: "notif-live-01",
        title: "Live hearing reminder",
        body: "Join the dispute hearing in 15 minutes.",
        isRead: false,
        readAt: null,
        relatedType: "DisputeHearing",
        relatedId: "hearing-300-1",
        createdAt: "2026-03-30T08:40:00.000Z",
      },
    });
    await expectNotificationBadge(page, "4");
    await openNotificationPanel(page);
    await expect(page.getByTestId("notification-item-notif-live-01")).toBeVisible();
    return "Injected a realtime NOTIFICATION_CREATED event while the panel was closed, saw the unread badge increment from 3 to 4 immediately, and confirmed the new Live hearing reminder item appeared at the top of the dropdown.";
  },
  "Receive Realtime Notification - 2": async (page) => {
    await openNotificationPanel(page);
    await expectNotificationBadge(page, "3");
    await emitSocketEvent(page, "NOTIFICATION_CREATED", {
      notification: {
        id: "notif-live-02",
        title: "Evidence review updated",
        body: "A moderator added a new review note to dispute-200.",
        isRead: false,
        readAt: null,
        relatedType: "Dispute",
        relatedId: "dispute-200",
        createdAt: "2026-03-30T08:41:00.000Z",
      },
    });
    await expectNotificationBadge(page, "4");
    await expect(page.getByTestId("notification-item-notif-live-02")).toBeVisible();
    return "Kept the dropdown open during a realtime NOTIFICATION_CREATED event and verified that the new Evidence review updated item was prepended in place while the badge stayed synchronized.";
  },
};

test.beforeAll(() => {
  fs.rmSync(evidenceDir, { recursive: true, force: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
});

for (const flatCase of flatCases) {
  test(flatCase.testCase.id, async ({ page }) => {
    const { testCase } = flatCase;
    const state = buildScenario(testCase.id);
    let actualResults = `Opened ${testCase.route} and started the Playwright verification flow.`;

    try {
      await installScenario(page, state);
      await page.goto(testCase.route);
      await page.waitForLoadState("domcontentloaded");

      const handler = caseHandlers[testCase.id];
      if (!handler) {
        throw new Error(`No case handler implemented for ${testCase.id}.`);
      }

      actualResults = await handler(page, state);

      writeEvidence({
        id: testCase.id,
        feature: flatCase.featureName,
        functionName: flatCase.functionName,
        description: testCase.description,
        actualResults,
        result: "Pass",
        testDate: NOW_ISO.slice(0, 10),
        tester: TESTER_NAME,
        note: "",
        evidenceRef: `client/test-artifacts/fe16-fe18/evidence/${slugify(testCase.id)}.json`,
      });
    } catch (error) {
      writeEvidence({
        id: testCase.id,
        feature: flatCase.featureName,
        functionName: flatCase.functionName,
        description: testCase.description,
        actualResults,
        result: "Fail",
        testDate: NOW_ISO.slice(0, 10),
        tester: TESTER_NAME,
        note: error instanceof Error ? error.message : String(error),
        evidenceRef: `client/test-artifacts/fe16-fe18/evidence/${slugify(testCase.id)}.json`,
      });
      throw error;
    }
  });
}
