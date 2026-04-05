import { expect, type Page } from "@playwright/test";

export const API_BASE_URL = "https://localhost:3000";
export const TESTER_NAME = "BangDC";
export const NOW_ISO = "2026-03-30T09:00:00.000Z";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type SessionUser = {
  id: string;
  fullName: string;
  role: string;
  email: string;
  avatarUrl?: string | null;
};

type RequestLog = {
  method: string;
  path: string;
  query: string;
  bodyText: string | null;
};

export type MockState = {
  caseId: string;
  sessionUser: SessionUser;
  notifications: Array<Record<string, any>>;
  trustProfiles: Record<string, Record<string, any>>;
  reviewHistory: Record<string, Array<Record<string, any>>>;
  moderationReviews: Array<Record<string, any>>;
  moderationAssignees: Array<Record<string, any>>;
  disputeList: Array<Record<string, any>>;
  disputesById: Record<string, Record<string, any>>;
  disputeActivities: Record<string, Array<Record<string, any>>>;
  disputeComplexities: Record<string, Record<string, any>>;
  disputeDossiers: Record<string, Record<string, any>>;
  disputeVerdicts: Record<string, Record<string, any> | null>;
  disputeEvidence: Record<string, Array<Record<string, any>>>;
  disputeEvidenceQuota: Record<string, Record<string, any>>;
  disputeHearings: Record<string, Array<Record<string, any>>>;
  schedulingWorklist: Array<Record<string, any>>;
  schedulingProposals: Record<string, Array<Record<string, any>>>;
  calendarEvents: Array<Record<string, any>>;
  availability: Array<Record<string, any>>;
  workspaceBoard: Record<string, any>;
  workspaceProject: Record<string, any>;
  createdDisputeId: string | null;
  nextReviewId: number;
  nextEvidenceId: number;
  nextHearingId: number;
  requestLog: RequestLog[];
};

const users = {
  client: {
    id: "client-100",
    fullName: "Cindy Tran",
    role: "CLIENT",
    email: "cindy.tran@interdev.test",
    avatarUrl: null,
  },
  freelancer: {
    id: "freelancer-200",
    fullName: "Alex Stone",
    role: "FREELANCER",
    email: "alex.stone@interdev.test",
    avatarUrl: null,
  },
  broker: {
    id: "broker-300",
    fullName: "Brooke Hall",
    role: "BROKER",
    email: "brooke.hall@interdev.test",
    avatarUrl: null,
  },
  staff: {
    id: "staff-500",
    fullName: "Taylor Ward",
    role: "STAFF",
    email: "taylor.ward@interdev.test",
    avatarUrl: null,
  },
  admin900: {
    id: "admin-900",
    fullName: "Morgan Lee",
    role: "ADMIN",
    email: "morgan.lee@interdev.test",
    avatarUrl: null,
  },
  admin901: {
    id: "admin-901",
    fullName: "Riley Chen",
    role: "ADMIN",
    email: "riley.chen@interdev.test",
    avatarUrl: null,
  },
} satisfies Record<string, SessionUser>;

const makeCompletedProjectHistory = () => ({
  projectId: "project-900",
  title: "Brand Portal Revamp",
  status: "COMPLETED",
  totalBudget: 8500,
  completedAt: "2026-03-21T14:30:00.000Z",
  targetRoleInProject: "FREELANCER",
  viewerRoleInProject: "CLIENT",
  client: { id: users.client.id, fullName: users.client.fullName },
  broker: { id: users.broker.id, fullName: users.broker.fullName },
  freelancer: { id: users.freelancer.id, fullName: users.freelancer.fullName },
});

const makeThirdPartyReview = () => ({
  id: "review-third-party-1",
  rating: 5,
  comment:
    "Excellent collaboration. The redesign met the approved accessibility checklist and the final delivery package was easy to verify.",
  weight: 1.2,
  createdAt: "2026-03-18T09:00:00.000Z",
  updatedAt: "2026-03-18T09:00:00.000Z",
  reviewer: {
    id: "client-201",
    fullName: "Jordan Miles",
    avatarUrl: null,
    badge: "VERIFIED",
    currentTrustScore: 87,
    stats: {
      finished: 8,
      disputes: 0,
      score: 87,
    },
  },
  project: {
    id: "project-901",
    title: "Accessibility QA Sprint",
    totalBudget: 2800,
    status: "COMPLETED",
    category: "QA",
  },
});

const makeOwnReview = (overrides?: Partial<Record<string, any>>) => ({
  id: "review-own-1",
  rating: 4,
  comment:
    "Delivered the dashboard fixes on schedule and communicated clearly about each milestone hand-off.",
  weight: 1.5,
  createdAt: "2026-03-29T10:00:00.000Z",
  updatedAt: "2026-03-29T10:00:00.000Z",
  reviewer: {
    id: users.client.id,
    fullName: users.client.fullName,
    avatarUrl: null,
    badge: "VERIFIED",
    currentTrustScore: 91,
    stats: {
      finished: 12,
      disputes: 1,
      score: 91,
    },
  },
  project: {
    id: "project-900",
    title: "Brand Portal Revamp",
    totalBudget: 8500,
    status: "COMPLETED",
    category: "Web App",
  },
  ...overrides,
});

const makeTrustProfile = (reviews: Array<Record<string, any>>) => ({
  user: {
    id: users.freelancer.id,
    fullName: users.freelancer.fullName,
    avatarUrl: null,
    isVerified: true,
    isEmailVerified: true,
    currentTrustScore: 92,
    badge: "TRUSTED",
    role: "FREELANCER",
    bio: "Frontend engineer focused on dashboard UX and accessibility.",
    skills: ["React", "TypeScript", "Accessibility"],
    createdAt: "2025-06-10T09:00:00.000Z",
    stats: {
      finished: 23,
      disputes: 1,
      score: 92,
    },
  },
  reviews,
  projectHistory: [makeCompletedProjectHistory()],
});

const makeReviewHistory = (
  review: Record<string, any>,
  entries: Array<{
    id: string;
    version: number;
    rating: number;
    comment: string;
    editedAt: string;
  }>,
) =>
  entries.map((entry) => ({
    id: entry.id,
    reviewId: review.id,
    version: entry.version,
    rating: entry.rating,
    comment: entry.comment,
    editedAt: entry.editedAt,
    editedBy: {
      id: review.reviewer.id,
      fullName: review.reviewer.fullName,
      avatarUrl: review.reviewer.avatarUrl,
    },
  }));

const baseNotifications = () => [
  {
    id: "notif-dispute-1",
    title: "Dispute dispute-200 needs your response",
    body: "Respond to the staff request before the next hearing slot closes.",
    isRead: false,
    readAt: null,
    relatedType: "Dispute",
    relatedId: "dispute-200",
    createdAt: "2026-03-30T08:30:00.000Z",
  },
  {
    id: "notif-hearing-1",
    title: "Hearing H-12 has been rescheduled",
    body: "The hearing for dispute-300 now starts at 09:30.",
    isRead: false,
    readAt: null,
    relatedType: "DisputeHearing",
    relatedId: "hearing-300-1",
    createdAt: "2026-03-30T08:20:00.000Z",
  },
  {
    id: "notif-info-1",
    title: "Workspace checklist updated",
    body: "The delivery checklist now includes the revised accessibility steps.",
    isRead: false,
    readAt: null,
    relatedType: null,
    relatedId: null,
    createdAt: "2026-03-30T08:10:00.000Z",
  },
  {
    id: "notif-read-1",
    title: "Broker approved the revised scope",
    body: "The scope amendment is now visible in the workspace timeline.",
    isRead: true,
    readAt: "2026-03-29T16:00:00.000Z",
    relatedType: null,
    relatedId: null,
    createdAt: "2026-03-29T15:55:00.000Z",
  },
];

const makeServerModerationReview = (overrides?: Partial<Record<string, any>>) => ({
  id: "review-flagged-1",
  rating: 1,
  comment:
    "This freelancer never delivered anything real and the testimonial is not tied to a real contract.",
  weight: 1,
  createdAt: "2026-03-28T12:00:00.000Z",
  updatedAt: "2026-03-28T12:00:00.000Z",
  reviewer: {
    id: "reviewer-flagged-1",
    fullName: "Casey Doyle",
    profile: { avatarUrl: null },
    badge: "WARNING",
    currentTrustScore: 55,
  },
  project: {
    id: "project-flagged-1",
    title: "Ops Dashboard Migration",
    totalBudget: 3200,
    status: "COMPLETED",
  },
  reportInfo: {
    reportCount: 2,
    reasons: ["FAKE_REVIEW", "SPAM"],
    lastReportedAt: "2026-03-29T11:30:00.000Z",
    reportedBy: [
      { id: users.client.id, fullName: users.client.fullName },
      { id: users.broker.id, fullName: users.broker.fullName },
    ],
  },
  openedBy: null,
  currentAssignee: null,
  lastAssignedBy: null,
  lastAssignedAt: null,
  assignmentVersion: 0,
  lockStatus: {
    isOpened: false,
    isAssigned: false,
    openedById: null,
    currentAssigneeId: null,
  },
  moderationHistorySummary: [],
  ...overrides,
});

const makeDeletedModerationReview = () =>
  makeServerModerationReview({
    id: "review-deleted-1",
    rating: 2,
    comment:
      "Removed pending moderator review because the supporting evidence was originally incomplete.",
    deletedAt: "2026-03-27T10:00:00.000Z",
    deleteReason: "FAKE_REVIEW: Historical false positive review.",
    currentAssignee: {
      id: users.admin900.id,
      fullName: users.admin900.fullName,
      email: users.admin900.email,
      role: "ADMIN",
    },
    reportInfo: undefined,
    assignmentVersion: 2,
    moderationHistorySummary: [
      {
        id: "mod-delete-1",
        action: "SOFT_DELETE",
        reason: "Historical false positive review.",
        performedAt: "2026-03-27T10:00:00.000Z",
        performedBy: {
          id: users.admin900.id,
          fullName: users.admin900.fullName,
          email: users.admin900.email,
          role: "ADMIN",
        },
      },
    ],
  });

const makeDisputeSummary = (overrides?: Partial<Record<string, any>>) => ({
  id: "dispute-200",
  displayCode: "DSP-0200",
  displayTitle: "Brand Portal Revamp Delivery Dispute",
  projectId: "project-900",
  category: "QUALITY",
  status: "IN_MEDIATION",
  caseStage: "PRE_HEARING_SUBMISSIONS",
  isAppealed: false,
  reason:
    "Submitted UI build ignored the approved accessibility checklist and shipped incomplete navigation states.",
  reasonExcerpt:
    "Submitted UI build ignored the approved accessibility checklist and shipped incomplete navigation states.",
  nextActionLabel: "Review evidence and join the next hearing",
  flowGuide: "Upload final evidence, then confirm hearing attendance before verdict review.",
  updatedAt: "2026-03-30T08:00:00.000Z",
  appealState: "No appeal filed",
  appealDeadline: "2026-04-04T08:00:00.000Z",
  raisedById: users.client.id,
  defendantId: users.freelancer.id,
  disputedAmount: 2500,
  responseDeadline: "2026-04-01T10:00:00.000Z",
  resolutionDeadline: "2026-04-05T17:00:00.000Z",
  project: {
    id: "project-900",
    title: "Brand Portal Revamp",
    clientId: users.client.id,
    brokerId: users.broker.id,
    freelancerId: users.freelancer.id,
  },
  latestHearing: {
    hearingNumber: 12,
  },
  participants: [
    {
      userId: users.client.id,
      displayName: users.client.fullName,
      username: "cindy.client",
      email: users.client.email,
      caseRole: "CLAIMANT",
    },
    {
      userId: users.freelancer.id,
      displayName: users.freelancer.fullName,
      username: "alex.freelancer",
      email: users.freelancer.email,
      caseRole: "RESPONDENT",
    },
    {
      userId: users.staff.id,
      displayName: users.staff.fullName,
      username: "taylor.staff",
      email: users.staff.email,
      caseRole: "MODERATOR",
    },
  ],
  allowedActions: [],
  appealTrack: {
    kind: "NONE",
    canSubmit: false,
    deadline: "2026-04-04T08:00:00.000Z",
  },
  ...overrides,
});

const makeEvidenceItem = (overrides?: Partial<Record<string, any>>) => ({
  id: "evidence-graphic-1",
  disputeId: "dispute-200",
  fileName: "accessibility-audit.png",
  fileSize: 1_250_000,
  mimeType: "image/png",
  signedUrl: `${API_BASE_URL}/mock-files/accessibility-audit.png`,
  description: "Annotated screenshot showing missing keyboard focus state.",
  uploadedAt: "2026-03-29T10:20:00.000Z",
  uploaderId: users.client.id,
  uploader: {
    id: users.client.id,
    fullName: users.client.fullName,
  },
  isFlagged: false,
  ...overrides,
});

const makeHearing = (overrides?: Partial<Record<string, any>>) => ({
  id: "hearing-300-1",
  disputeId: "dispute-300",
  status: "SCHEDULED",
  lifecycle: "ACTIVE",
  scheduledAt: "2026-04-02T09:30:00.000Z",
  estimatedDurationMinutes: 90,
  agenda: "Review escrow release evidence and delivery acceptance timeline.",
  requiredDocuments: ["signed change request", "final hand-off build"],
  externalMeetingLink: "https://meet.google.com/aaa-bbbb-ccc",
  hearingNumber: 12,
  tier: "TIER_1",
  isActionable: true,
  isArchived: false,
  minutesRecorded: false,
  participantConfirmationSummary: {
    totalParticipants: 3,
    requiredParticipants: 3,
    accepted: 3,
    declined: 0,
    tentative: 0,
    pending: 0,
    requiredAccepted: 3,
    requiredDeclined: 0,
    requiredTentative: 0,
    requiredPending: 0,
    allRequiredAccepted: true,
    hasModeratorAccepted: true,
    primaryPartyAcceptedCount: 2,
    primaryPartyPendingCount: 0,
    primaryPartyDeclinedCount: 0,
    confirmedPrimaryRoles: ["RAISER", "DEFENDANT"],
    confirmationSatisfied: true,
    participants: [],
  },
  ...overrides,
});

const buildBaseState = (caseId: string): MockState => {
  const activeDispute = makeDisputeSummary();
  const appealedDispute = makeDisputeSummary({
    id: "dispute-400",
    displayCode: "DSP-0400",
    displayTitle: "Escrow Split Appeal",
    status: "RESOLVED",
    caseStage: "VERDICT_ISSUED",
    reason: "Final refund split ignored the signed scope amendment.",
    reasonExcerpt: "Final refund split ignored the signed scope amendment.",
    nextActionLabel: "Submit appeal or request review",
    flowGuide: "Review the verdict details, then file an appeal if material facts were missed.",
    appealState: "Appeal available",
    allowedActions: ["SUBMIT_APPEAL", "REQUEST_SUPPORT_ESCALATION"],
    disputedAmount: 4200,
    project: {
      id: "project-901",
      title: "Checkout Modernization",
      clientId: users.client.id,
      brokerId: users.broker.id,
      freelancerId: users.freelancer.id,
    },
    latestHearing: { hearingNumber: 16 },
    appealTrack: {
      kind: "VERDICT",
      canSubmit: true,
      deadline: "2026-04-05T12:00:00.000Z",
    },
  });
  const closedDispute = makeDisputeSummary({
    id: "dispute-500",
    displayCode: "DSP-0500",
    displayTitle: "Closed Scope Clarification Case",
    status: "RESOLVED",
    caseStage: "FINAL_ARCHIVE",
    reason: "Archived resolved dispute for reporting coverage.",
    reasonExcerpt: "Archived resolved dispute for reporting coverage.",
    nextActionLabel: "Archived record",
    flowGuide: "Reference only.",
    appealState: "Appeal expired",
    appealDeadline: "2026-03-20T08:00:00.000Z",
  });
  const previewTrustProfile = makeTrustProfile([makeThirdPartyReview()]);
  const ownReview = makeOwnReview();
  const evidenceList = [
    makeEvidenceItem(),
    makeEvidenceItem({
      id: "evidence-handoff-1",
      fileName: "final-handoff.pdf",
      mimeType: "application/pdf",
      fileSize: 810_000,
      signedUrl: `${API_BASE_URL}/mock-files/final-handoff.pdf`,
      description: "Original hand-off checklist and acceptance notes.",
      uploadedAt: "2026-03-29T09:50:00.000Z",
    }),
  ];

  return {
    caseId,
    sessionUser: users.client,
    notifications: baseNotifications(),
    trustProfiles: {
      [users.freelancer.id]: previewTrustProfile,
    },
    reviewHistory: {
      "review-own-1": makeReviewHistory(ownReview, [
        {
          id: "review-own-1-v3",
          version: 3,
          rating: 3,
          comment:
            "Needed one more revision cycle before approval, but the final hand-off was correct.",
          editedAt: "2026-03-30T07:30:00.000Z",
        },
        {
          id: "review-own-1-v2",
          version: 2,
          rating: 4,
          comment:
            "Communication improved after the broker clarified the deliverable checklist.",
          editedAt: "2026-03-29T16:00:00.000Z",
        },
        {
          id: "review-own-1-v1",
          version: 1,
          rating: 5,
          comment: "Initial review submitted after the first approved delivery package.",
          editedAt: "2026-03-29T10:00:00.000Z",
        },
      ]),
    },
    moderationReviews: [makeServerModerationReview(), makeDeletedModerationReview()],
    moderationAssignees: [
      {
        id: users.admin900.id,
        fullName: users.admin900.fullName,
        email: users.admin900.email,
        role: "ADMIN",
      },
      {
        id: users.admin901.id,
        fullName: users.admin901.fullName,
        email: users.admin901.email,
        role: "ADMIN",
      },
    ],
    disputeList: [activeDispute, appealedDispute, closedDispute],
    disputesById: {
      "dispute-200": activeDispute,
      "dispute-300": makeDisputeSummary({
        id: "dispute-300",
        displayCode: "DSP-0300",
        displayTitle: "Hearing Preparation Case",
        caseStage: "HEARING_IN_PROGRESS",
      }),
      "dispute-400": appealedDispute,
      "dispute-500": closedDispute,
      "dispute-parent-01": makeDisputeSummary({
        id: "dispute-parent-01",
        displayCode: "DSP-PARENT-01",
        displayTitle: "Existing Multi-party Payment Case",
      }),
    },
    disputeActivities: {
      "dispute-200": [
        {
          id: "activity-1",
          action: "EVIDENCE_SUBMITTED",
          actor: { fullName: users.client.fullName },
          description: "Client uploaded the accessibility audit evidence package.",
          timestamp: "2026-03-29T10:20:00.000Z",
          isInternal: false,
        },
        {
          id: "activity-2",
          action: "HEARING_SCHEDULED",
          actor: { fullName: users.staff.fullName },
          description: "Staff scheduled a hearing for the next available slot.",
          timestamp: "2026-03-29T11:30:00.000Z",
          isInternal: false,
        },
      ],
      "dispute-300": [
        {
          id: "activity-3",
          action: "HEARING_DRAFTED",
          actor: { fullName: users.staff.fullName },
          description: "Draft hearing reserved for mediation follow-up.",
          timestamp: "2026-03-30T07:45:00.000Z",
          isInternal: true,
        },
      ],
      "dispute-400": [
        {
          id: "activity-4",
          action: "VERDICT_ISSUED",
          actor: { fullName: users.staff.fullName },
          description: "Original verdict issued and appeal window opened.",
          timestamp: "2026-03-29T15:00:00.000Z",
          isInternal: false,
        },
      ],
    },
    disputeComplexities: {
      "dispute-200": {
        level: "MEDIUM",
        timeEstimation: {
          minMinutes: 45,
          recommendedMinutes: 90,
          maxMinutes: 120,
        },
        confidence: 0.84,
      },
      "dispute-300": {
        level: "MEDIUM",
        timeEstimation: {
          minMinutes: 30,
          recommendedMinutes: 75,
          maxMinutes: 105,
        },
        confidence: 0.78,
      },
    },
    disputeDossiers: {
      "dispute-200": {
        contracts: [
          {
            id: "contract-900",
            projectId: "project-900",
            title: "Brand Portal Revamp Contract",
            status: "ACTIVE",
            contractUrl: `${API_BASE_URL}/mock-files/contract-900.pdf`,
            createdAt: "2026-03-01T10:00:00.000Z",
            termsPreview: "Revised accessibility acceptance checklist signed on March 21.",
          },
        ],
      },
      "dispute-300": { contracts: [] },
      "dispute-400": {
        contracts: [
          {
            id: "contract-901",
            projectId: "project-901",
            title: "Checkout Modernization Contract",
            status: "ACTIVE",
            contractUrl: `${API_BASE_URL}/mock-files/contract-901.pdf`,
            createdAt: "2026-02-15T09:00:00.000Z",
            termsPreview: "Scope amendment accepted before the final settlement calculation.",
          },
        ],
      },
    },
    disputeVerdicts: {
      "dispute-200": null,
      "dispute-300": null,
      "dispute-400": {
        id: "verdict-400-1",
        disputeId: "dispute-400",
        adjudicatorId: users.staff.id,
        adjudicatorRole: "STAFF",
        result: "SPLIT",
        faultType: "SCOPE_CHANGE",
        faultyParty: "both",
        reasoning: {
          violatedPolicies: ["SCOPE_CHANGE"],
          factualFindings:
            "Both parties accepted a revised scope, but the settlement ignored the amendment.",
          legalAnalysis:
            "Refund calculation should follow the last signed scope update.",
          conclusion: "Appeal window remains open for review.",
        },
        amountToFreelancer: 1800,
        amountToClient: 2400,
        tier: 1,
        isAppealVerdict: false,
        appealDeadline: "2026-04-05T12:00:00.000Z",
        issuedAt: "2026-03-29T15:00:00.000Z",
      },
    },
    disputeEvidence: {
      "dispute-200": evidenceList,
      "dispute-300": [makeEvidenceItem({ id: "evidence-300-1", disputeId: "dispute-300" })],
      "dispute-400": [makeEvidenceItem({ id: "evidence-400-1", disputeId: "dispute-400" })],
    },
    disputeEvidenceQuota: {
      "dispute-200": { total: 20, remaining: 18, used: 2 },
      "dispute-300": { total: 20, remaining: 19, used: 1 },
      "dispute-400": { total: 20, remaining: 19, used: 1 },
    },
    disputeHearings: {
      "dispute-200": [makeHearing({ id: "hearing-200-1", disputeId: "dispute-200" })],
      "dispute-300": [makeHearing()],
      "dispute-400": [makeHearing({ id: "hearing-400-1", disputeId: "dispute-400" })],
    },
    schedulingWorklist: [],
    schedulingProposals: { "dispute-created-1": [] },
    calendarEvents: [
      {
        id: "calendar-hearing-1",
        title: "Hearing H-12",
        startTime: "2026-04-02T09:30:00.000Z",
        endTime: "2026-04-02T11:00:00.000Z",
        status: "SCHEDULED",
        type: "DISPUTE_HEARING",
        referenceId: "hearing-300-1",
        referenceType: "DisputeHearing",
        externalMeetingLink: "https://meet.google.com/aaa-bbbb-ccc",
        metadata: {
          disputeSummary: {
            id: "dispute-300",
            displayCode: "DSP-0300",
            displayTitle: "Hearing Preparation Case",
            projectTitle: "Brand Portal Revamp",
            reasonExcerpt: "Review escrow release evidence and delivery acceptance timeline.",
            status: "IN_MEDIATION",
            appealState: "NONE",
          },
          hearingSummary: {
            hearingId: "hearing-300-1",
            hearingNumber: 12,
            tier: "TIER_1",
            status: "SCHEDULED",
            isActionable: true,
            isArchived: false,
          },
        },
        participants: [],
      },
    ],
    availability: [],
    workspaceBoard: {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    },
    workspaceProject: {
      id: "project-900",
      title: "Brand Portal Revamp",
      status: "IN_PROGRESS",
      hasActiveDispute: false,
      activeDisputeCount: 0,
      contracts: [],
      brokerId: users.broker.id,
      clientId: users.client.id,
      freelancerId: users.freelancer.id,
      client: { id: users.client.id, fullName: users.client.fullName, email: users.client.email, role: "CLIENT" },
      broker: { id: users.broker.id, fullName: users.broker.fullName, email: users.broker.email, role: "BROKER" },
      freelancer: {
        id: users.freelancer.id,
        fullName: users.freelancer.fullName,
        email: users.freelancer.email,
        role: "FREELANCER",
      },
      currency: "USD",
    },
    createdDisputeId: null,
    nextReviewId: 2,
    nextEvidenceId: 2,
    nextHearingId: 1,
    requestLog: [],
  };
};

export const buildScenario = (caseId: string): MockState => {
  const state = buildBaseState(caseId);
  const recentOwnReview = makeOwnReview();
  const expiredOwnReview = makeOwnReview({
    createdAt: "2026-03-20T08:00:00.000Z",
    updatedAt: "2026-03-20T08:00:00.000Z",
  });

  switch (caseId) {
    case "View Trust Profile - 1":
      state.sessionUser = users.client;
      state.trustProfiles[users.freelancer.id] = makeTrustProfile([
        makeThirdPartyReview(),
        {
          ...makeThirdPartyReview(),
          id: "review-third-party-2",
          rating: 4,
          comment:
            "Strong communication and a clean hand-off package for the reporting screens.",
          reviewer: {
            id: "client-202",
            fullName: "Harper Cole",
            avatarUrl: null,
            badge: "VERIFIED",
            currentTrustScore: 89,
            stats: { finished: 6, disputes: 0, score: 89 },
          },
          project: {
            id: "project-902",
            title: "Reporting Dashboard Hardening",
            totalBudget: 3400,
            status: "COMPLETED",
            category: "Analytics",
          },
        },
      ]);
      break;
    case "View Trust Profile - 2":
      state.sessionUser = users.client;
      delete state.trustProfiles[users.freelancer.id];
      break;
    case "Create Review - 1":
    case "Create Review - 2":
      state.sessionUser = users.client;
      state.trustProfiles[users.freelancer.id] = makeTrustProfile([makeThirdPartyReview()]);
      break;
    case "Edit Review - 1":
    case "View Edit History - 1":
      state.sessionUser = users.client;
      state.trustProfiles[users.freelancer.id] = makeTrustProfile([
        recentOwnReview,
        makeThirdPartyReview(),
      ]);
      break;
    case "Edit Review - 2":
      state.sessionUser = users.client;
      state.trustProfiles[users.freelancer.id] = makeTrustProfile([
        expiredOwnReview,
        makeThirdPartyReview(),
      ]);
      state.reviewHistory[expiredOwnReview.id] = makeReviewHistory(expiredOwnReview, [
        {
          id: "review-own-old-v1",
          version: 1,
          rating: expiredOwnReview.rating,
          comment: expiredOwnReview.comment,
          editedAt: expiredOwnReview.createdAt,
        },
      ]);
      break;
    case "View Edit History - 2":
      state.sessionUser = users.client;
      state.trustProfiles[users.freelancer.id] = makeTrustProfile([recentOwnReview]);
      state.reviewHistory[recentOwnReview.id] = makeReviewHistory(recentOwnReview, [
        {
          id: "review-own-1-single",
          version: 1,
          rating: recentOwnReview.rating,
          comment: recentOwnReview.comment,
          editedAt: recentOwnReview.createdAt,
        },
      ]);
      break;
    case "Report Review Abuse - 1":
    case "Report Review Abuse - 2":
      state.sessionUser = users.client;
      state.trustProfiles[users.freelancer.id] = makeTrustProfile([makeThirdPartyReview()]);
      break;
    case "Moderate Reviews - 1":
    case "Moderate Reviews - 2":
      state.sessionUser = users.admin900;
      break;
    case "Create Dispute - 1":
      state.sessionUser = users.client;
      state.disputeList = [];
      state.schedulingWorklist = [];
      break;
    case "Create Dispute - 2":
      state.sessionUser = users.client;
      state.disputeList = [state.disputesById["dispute-parent-01"]];
      break;
    case "Open My Disputes - 1":
    case "Open My Disputes - 2":
      state.sessionUser = users.client;
      state.disputesById["dispute-400"] = {
        ...state.disputesById["dispute-400"],
        status: "APPEALED",
        isAppealed: true,
        appealState: "Appeal active",
      };
      state.disputeList = state.disputeList.map((item) =>
        item.id === "dispute-400"
          ? {
              ...item,
              status: "APPEALED",
              isAppealed: true,
              appealState: "Appeal active",
            }
          : item,
      );
      break;
    case "Manage Evidence - 1":
      state.sessionUser = users.client;
      state.disputesById["dispute-200"] = {
        ...state.disputesById["dispute-200"],
        allowedActions: ["UPLOAD_EVIDENCE"],
      };
      break;
    case "Manage Evidence - 2":
      state.sessionUser = users.staff;
      state.disputesById["dispute-200"] = {
        ...state.disputesById["dispute-200"],
        allowedActions: ["UPLOAD_EVIDENCE"],
      };
      break;
    case "Conduct Hearing & Verdict - 1":
    case "Conduct Hearing & Verdict - 2":
      state.sessionUser = users.staff;
      state.disputesById["dispute-300"] = {
        ...state.disputesById["dispute-300"],
        allowedActions: ["MANAGE_HEARING"],
      };
      break;
    case "Open Notifications - 2":
      state.notifications = [];
      break;
    case "Mark All Notifications Read - 2":
      state.notifications = state.notifications.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || "2026-03-30T08:45:00.000Z",
      }));
      break;
    default:
      state.sessionUser = caseId.startsWith("Moderate Reviews")
        ? users.admin900
        : caseId.startsWith("Manage Evidence - 2") ||
            caseId.startsWith("Conduct Hearing & Verdict")
          ? users.staff
          : users.client;
      break;
  }

  if (caseId === "Read Notification - 1") {
    state.notifications = [
      {
        id: "notif-info-unread",
        title: "Workspace checklist updated",
        body: "Accessibility checklist requires final keyboard regression notes.",
        isRead: false,
        readAt: null,
        relatedType: null,
        relatedId: null,
        createdAt: "2026-03-30T08:30:00.000Z",
      },
      {
        id: "notif-secondary",
        title: "Dispute dispute-200 needs your response",
        body: "Respond to the staff request before the next hearing slot closes.",
        isRead: true,
        readAt: "2026-03-30T08:00:00.000Z",
        relatedType: "Dispute",
        relatedId: "dispute-200",
        createdAt: "2026-03-30T07:50:00.000Z",
      },
    ];
  }

  if (caseId === "Read Notification - 2") {
    state.notifications = [
      {
        id: "notif-read-stable",
        title: "Broker approved the revised scope",
        body: "The scope amendment is already confirmed and visible to both parties.",
        isRead: true,
        readAt: "2026-03-29T16:00:00.000Z",
        relatedType: null,
        relatedId: null,
        createdAt: "2026-03-29T15:55:00.000Z",
      },
      {
        id: "notif-read-helper",
        title: "Workspace checklist updated",
        body: "Final review notes were archived successfully.",
        isRead: true,
        readAt: "2026-03-29T15:00:00.000Z",
        relatedType: null,
        relatedId: null,
        createdAt: "2026-03-29T14:50:00.000Z",
      },
    ];
  }

  return state;
};

const pushRequestLog = (
  state: MockState,
  method: string,
  path: string,
  query: string,
  bodyText: string | null,
) => {
  state.requestLog.push({ method, path, query, bodyText });
};

const parseJsonBody = (bodyText: string | null): Record<string, any> => {
  if (!bodyText) {
    return {};
  }
  try {
    return JSON.parse(bodyText) as Record<string, any>;
  } catch {
    return {};
  }
};

const findReviewInProfiles = (state: MockState, reviewId: string) => {
  for (const profile of Object.values(state.trustProfiles)) {
    const review = (profile.reviews || []).find((item: Record<string, any>) => item.id === reviewId);
    if (review) {
      return { profile, review };
    }
  }
  return null;
};

const updateProfileReview = (
  state: MockState,
  reviewId: string,
  updater: (review: Record<string, any>) => void,
) => {
  const located = findReviewInProfiles(state, reviewId);
  if (!located) {
    return null;
  }
  updater(located.review);
  return located.review;
};

const jsonResponse = async (
  route: Parameters<Page["route"]>[1] extends (arg: infer T) => any ? T : never,
  status: number,
  data: JsonValue,
) => {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(data),
  });
};

const rawResponse = async (
  route: Parameters<Page["route"]>[1] extends (arg: infer T) => any ? T : never,
  status: number,
  body: string | Buffer,
  contentType: string,
  headers?: Record<string, string>,
) => {
  await route.fulfill({
    status,
    contentType,
    headers,
    body: typeof body === "string" ? body : body.toString("binary"),
  });
};

const handleMockFile = async (
  route: Parameters<Page["route"]>[1] extends (arg: infer T) => any ? T : never,
  path: string,
) => {
  if (path.endsWith(".png")) {
    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl9d1cAAAAASUVORK5CYII=",
      "base64",
    );
    await rawResponse(route, 200, transparentPng, "image/png");
    return;
  }

  if (path.endsWith(".pdf")) {
    await rawResponse(
      route,
      200,
      "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
      "application/pdf",
    );
    return;
  }

  await rawResponse(
    route,
    200,
    "Mock artifact generated for Playwright integration evidence.",
    "text/plain; charset=utf-8",
  );
};

export const installScenario = async (page: Page, state: MockState) => {
  await page.addInitScript(({ user }) => {
    const storageKey = "user";
    const serialized = JSON.stringify(user);
    window.localStorage.setItem(storageKey, serialized);
    window.sessionStorage.setItem(storageKey, serialized);

    const listenersByNamespace = new Map<string, Map<string, Set<(payload: unknown) => void>>>();
    const getNamespaceListeners = (namespace: string) => {
      const normalizedNamespace = namespace || "/ws";
      const existing = listenersByNamespace.get(normalizedNamespace);
      if (existing) {
        return existing;
      }
      const created = new Map<string, Set<(payload: unknown) => void>>();
      listenersByNamespace.set(normalizedNamespace, created);
      return created;
    };

    const createSocket = (namespace: string) => {
      const listeners = getNamespaceListeners(namespace);
      return {
        connected: false,
        on(event: string, handler: (payload: unknown) => void) {
          if (!listeners.has(event)) {
            listeners.set(event, new Set());
          }
          listeners.get(event)!.add(handler);
          return this;
        },
        once(event: string, handler: (payload: unknown) => void) {
          const wrapped = (payload: unknown) => {
            this.off(event, wrapped);
            handler(payload);
          };
          return this.on(event, wrapped);
        },
        off(event: string, handler?: (payload: unknown) => void) {
          const set = listeners.get(event);
          if (!set) {
            return this;
          }
          if (handler) {
            set.delete(handler);
          } else {
            set.clear();
          }
          return this;
        },
        emit() {
          return this;
        },
        connect() {
          this.connected = true;
          return this;
        },
        disconnect() {
          this.connected = false;
          return this;
        },
        removeAllListeners() {
          listeners.clear();
          return this;
        },
      };
    };

    (
      window as typeof window & {
        __INTERDEV_TEST_SOCKET_FACTORY__?: (namespace: string) => unknown;
        __INTERDEV_TEST_EMIT_SOCKET_EVENT__?: (
          namespace: string,
          event: string,
          payload: unknown,
        ) => void;
      }
    ).__INTERDEV_TEST_SOCKET_FACTORY__ = (namespace: string) => createSocket(namespace);

    (
      window as typeof window & {
        __INTERDEV_TEST_EMIT_SOCKET_EVENT__?: (
          namespace: string,
          event: string,
          payload: unknown,
        ) => void;
      }
    ).__INTERDEV_TEST_EMIT_SOCKET_EVENT__ = (
      namespace: string,
      event: string,
      payload: unknown,
    ) => {
      const handlers = getNamespaceListeners(namespace).get(event);
      handlers?.forEach((handler) => handler(payload));
    };
  }, { user: state.sessionUser });

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();
    const bodyText = request.postData() ?? null;

    pushRequestLog(state, method, path, url.search, bodyText);

    if (path.startsWith("/mock-files/")) {
      await handleMockFile(route, path);
      return;
    }

    if (path === "/auth/session" && method === "GET") {
      await jsonResponse(route, 200, { data: state.sessionUser });
      return;
    }

    if (path === "/auth/refresh" && method === "POST") {
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (path === "/notifications" && method === "GET") {
      await jsonResponse(route, 200, {
        data: {
          items: state.notifications,
          total: state.notifications.length,
          page: Number(url.searchParams.get("page") || 1),
          limit: Number(url.searchParams.get("limit") || 10),
        },
      });
      return;
    }

    if (path === "/notifications/read-all" && method === "PATCH") {
      state.notifications = state.notifications.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || NOW_ISO,
      }));
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/notifications\/[^/]+\/read$/.test(path) && method === "PATCH") {
      const notificationId = path.split("/")[2];
      state.notifications = state.notifications.map((item) =>
        item.id === notificationId
          ? { ...item, isRead: true, readAt: item.readAt || NOW_ISO }
          : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/trust-profiles\/[^/]+$/.test(path) && method === "GET") {
      const profileId = path.split("/")[2];
      const profile = state.trustProfiles[profileId];
      if (!profile) {
        await jsonResponse(route, 404, {
          statusCode: 404,
          message: "The requested trust profile could not be found.",
        });
        return;
      }
      await jsonResponse(route, 200, profile);
      return;
    }

    if (path === "/reviews" && method === "POST") {
      if (state.caseId === "Create Review - 2") {
        await jsonResponse(route, 400, { message: "ﾄ妥｣ ﾄ妥｡nh giﾃ｡" });
        return;
      }

      const payload = parseJsonBody(bodyText);
      const profile = state.trustProfiles[payload.targetUserId];
      const createdReview = makeOwnReview({
        id: `review-created-${state.nextReviewId++}`,
        rating: payload.rating,
        comment: payload.comment,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });

      if (profile) {
        profile.reviews = [createdReview, ...(profile.reviews || [])];
      }

      state.reviewHistory[createdReview.id] = makeReviewHistory(createdReview, [
        {
          id: `${createdReview.id}-v1`,
          version: 1,
          rating: createdReview.rating,
          comment: createdReview.comment,
          editedAt: createdReview.createdAt,
        },
      ]);

      await jsonResponse(route, 201, createdReview);
      return;
    }

    if (/^\/reviews\/[^/]+$/.test(path) && method === "PATCH") {
      const reviewId = path.split("/")[2];
      const payload = parseJsonBody(bodyText);
      const updatedReview = updateProfileReview(state, reviewId, (review) => {
        review.rating = payload.rating ?? review.rating;
        review.comment = payload.comment ?? review.comment;
        review.updatedAt = NOW_ISO;
      });

      if (!updatedReview) {
        await jsonResponse(route, 404, { message: "Review not found." });
        return;
      }

      state.reviewHistory[reviewId] = makeReviewHistory(updatedReview, [
        {
          id: `${reviewId}-v2`,
          version: 2,
          rating: updatedReview.rating,
          comment: updatedReview.comment,
          editedAt: NOW_ISO,
        },
        ...(state.reviewHistory[reviewId] || []).map((entry) => ({
          id: entry.id,
          version: entry.version,
          rating: entry.rating,
          comment: entry.comment,
          editedAt: entry.editedAt,
        })),
      ]);

      await jsonResponse(route, 200, updatedReview);
      return;
    }

    if (/^\/reviews\/[^/]+\/history$/.test(path) && method === "GET") {
      const reviewId = path.split("/")[2];
      await jsonResponse(route, 200, state.reviewHistory[reviewId] || []);
      return;
    }

    if (path === "/reports" && method === "POST") {
      if (state.caseId === "Report Review Abuse - 2") {
        await jsonResponse(route, 400, { message: "ﾄ妥｣ report" });
        return;
      }
      await jsonResponse(route, 201, { success: true });
      return;
    }

    if (path === "/reviews/admin/moderation" && method === "GET") {
      const status = url.searchParams.get("status");
      const filtered =
        !status || status === "ALL"
          ? state.moderationReviews
          : status === "FLAGGED"
            ? state.moderationReviews.filter((item) => Boolean(item.reportInfo) && !item.deletedAt)
            : status === "SOFT_DELETED"
              ? state.moderationReviews.filter((item) => Boolean(item.deletedAt))
              : state.moderationReviews.filter((item) => !item.deletedAt && !item.reportInfo);
      await jsonResponse(route, 200, filtered);
      return;
    }

    if (path === "/users" && method === "GET") {
      await jsonResponse(route, 200, { users: state.moderationAssignees });
      return;
    }

    if (/^\/reviews\/admin\/moderation\/[^/]+\/open$/.test(path) && method === "POST") {
      const reviewId = path.split("/")[4];
      state.moderationReviews = state.moderationReviews.map((item) =>
        item.id === reviewId
          ? {
              ...item,
              openedBy: {
                id: state.sessionUser.id,
                fullName: state.sessionUser.fullName,
                email: state.sessionUser.email,
                role: state.sessionUser.role,
              },
              lockStatus: {
                ...(item.lockStatus || {}),
                isOpened: true,
                openedById: state.sessionUser.id,
              },
              assignmentVersion: (item.assignmentVersion || 0) + 1,
            }
          : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/reviews\/admin\/moderation\/[^/]+\/take$/.test(path) && method === "POST") {
      const reviewId = path.split("/")[4];
      state.moderationReviews = state.moderationReviews.map((item) =>
        item.id === reviewId
          ? {
              ...item,
              currentAssignee: {
                id: state.sessionUser.id,
                fullName: state.sessionUser.fullName,
                email: state.sessionUser.email,
                role: state.sessionUser.role,
              },
              lastAssignedBy: {
                id: state.sessionUser.id,
                fullName: state.sessionUser.fullName,
                email: state.sessionUser.email,
                role: state.sessionUser.role,
              },
              lastAssignedAt: NOW_ISO,
              assignmentVersion: (item.assignmentVersion || 0) + 1,
              lockStatus: {
                ...(item.lockStatus || {}),
                isOpened: true,
                isAssigned: true,
                currentAssigneeId: state.sessionUser.id,
              },
            }
          : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/reviews\/admin\/moderation\/[^/]+\/reassign$/.test(path) && method === "POST") {
      const reviewId = path.split("/")[4];
      const payload = parseJsonBody(bodyText);
      const assignee = state.moderationAssignees.find((item) => item.id === payload.assigneeId);
      state.moderationReviews = state.moderationReviews.map((item) =>
        item.id === reviewId
          ? {
              ...item,
              currentAssignee: assignee || null,
              lastAssignedBy: {
                id: state.sessionUser.id,
                fullName: state.sessionUser.fullName,
                email: state.sessionUser.email,
                role: state.sessionUser.role,
              },
              lastAssignedAt: NOW_ISO,
              assignmentVersion: (item.assignmentVersion || 0) + 1,
              lockStatus: {
                ...(item.lockStatus || {}),
                isOpened: true,
                isAssigned: true,
                currentAssigneeId: payload.assigneeId,
              },
            }
          : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/reviews\/[^/]+\/dismiss-report$/.test(path) && method === "POST") {
      const reviewId = path.split("/")[2];
      state.moderationReviews = state.moderationReviews.map((item) =>
        item.id === reviewId ? { ...item, reportInfo: undefined } : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/reviews\/[^/]+\/restore$/.test(path) && method === "POST") {
      const reviewId = path.split("/")[2];
      const reason = parseJsonBody(bodyText).reason || "Restored after moderator review.";
      state.moderationReviews = state.moderationReviews.map((item) =>
        item.id === reviewId
          ? {
              ...item,
              deletedAt: undefined,
              deleteReason: undefined,
              moderationHistorySummary: [
                {
                  id: `mod-restore-${reviewId}`,
                  action: "RESTORE",
                  reason,
                  performedAt: NOW_ISO,
                  performedBy: {
                    id: state.sessionUser.id,
                    fullName: state.sessionUser.fullName,
                    email: state.sessionUser.email,
                    role: state.sessionUser.role,
                  },
                },
                ...(item.moderationHistorySummary || []),
              ],
            }
          : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/reviews\/[^/]+$/.test(path) && method === "DELETE") {
      const reviewId = path.split("/")[2];
      const reason = parseJsonBody(bodyText).reason || "Soft deleted by moderator.";
      state.moderationReviews = state.moderationReviews.map((item) =>
        item.id === reviewId
          ? {
              ...item,
              deletedAt: NOW_ISO,
              deleteReason: reason,
              moderationHistorySummary: [
                {
                  id: `mod-delete-${reviewId}`,
                  action: "SOFT_DELETE",
                  reason,
                  performedAt: NOW_ISO,
                  performedBy: {
                    id: state.sessionUser.id,
                    fullName: state.sessionUser.fullName,
                    email: state.sessionUser.email,
                    role: state.sessionUser.role,
                  },
                },
                ...(item.moderationHistorySummary || []),
              ],
            }
          : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (path === "/disputes/my" && method === "GET") {
      await jsonResponse(route, 200, { data: state.disputeList });
      return;
    }

    if (path === "/disputes/scheduling/worklist" && method === "GET") {
      await jsonResponse(route, 200, {
        enabled: true,
        items: state.schedulingWorklist,
        generatedAt: NOW_ISO,
      });
      return;
    }

    if (/^\/disputes\/[^/]+\/scheduling\/proposals$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, { items: state.schedulingProposals[disputeId] || [] });
      return;
    }

    if (/^\/disputes\/[^/]+\/viewed$/.test(path) && method === "PATCH") {
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/disputes\/[^/]+$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, state.disputesById[disputeId] || makeDisputeSummary({ id: disputeId }));
      return;
    }

    if (/^\/disputes\/[^/]+\/activities$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, state.disputeActivities[disputeId] || []);
      return;
    }

    if (/^\/staff\/disputes\/[^/]+\/complexity$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[3];
      await jsonResponse(route, 200, { data: state.disputeComplexities[disputeId] || {} });
      return;
    }

    if (/^\/disputes\/[^/]+\/dossier$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, state.disputeDossiers[disputeId] || { contracts: [] });
      return;
    }

    if (/^\/disputes\/[^/]+\/dossier\/export$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await rawResponse(route, 200, "mock zip content", "application/zip", {
        "content-disposition": `attachment; filename="dispute-${disputeId}-dossier.zip"`,
      });
      return;
    }

    if (/^\/disputes\/[^/]+\/verdict$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, { data: state.disputeVerdicts[disputeId] || null });
      return;
    }

    if (/^\/disputes\/[^/]+\/appeal$/.test(path) && method === "POST") {
      const disputeId = path.split("/")[2];
      state.disputesById[disputeId] = {
        ...state.disputesById[disputeId],
        isAppealed: true,
        appealState: "Appealed",
        appealReason: parseJsonBody(bodyText).reason,
      };
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/disputes\/[^/]+\/review-request$/.test(path) && method === "POST") {
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/disputes\/[^/]+\/escalation-request$/.test(path) && method === "POST") {
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/disputes\/[^/]+\/evidence\/quota$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, state.disputeEvidenceQuota[disputeId] || { total: 20, remaining: 20, used: 0 });
      return;
    }

    if (/^\/disputes\/[^/]+\/evidence$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[2];
      await jsonResponse(route, 200, state.disputeEvidence[disputeId] || []);
      return;
    }

    if (/^\/disputes\/[^/]+\/evidence$/.test(path) && method === "POST") {
      const disputeId = path.split("/")[2];
      const fileNameMatch = bodyText?.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || `uploaded-file-${state.nextEvidenceId}.txt`;
      const createdEvidence = makeEvidenceItem({
        id: `evidence-upload-${state.nextEvidenceId++}`,
        disputeId,
        fileName,
        fileSize: 12_000,
        mimeType: "text/plain",
        signedUrl: `${API_BASE_URL}/mock-files/${encodeURIComponent(fileName)}`,
        description: "Uploaded during Playwright evidence automation.",
        uploadedAt: NOW_ISO,
      });
      state.disputeEvidence[disputeId] = [createdEvidence, ...(state.disputeEvidence[disputeId] || [])];
      const quota = state.disputeEvidenceQuota[disputeId] || { total: 20, remaining: 20, used: 0 };
      state.disputeEvidenceQuota[disputeId] = {
        total: quota.total,
        remaining: Math.max(0, (quota.remaining ?? 20) - 1),
        used: (quota.used ?? 0) + 1,
      };
      await jsonResponse(route, 201, createdEvidence);
      return;
    }

    if (/^\/disputes\/[^/]+\/evidence\/[^/]+\/flag$/.test(path) && method === "POST") {
      const segments = path.split("/");
      const disputeId = segments[2];
      const evidenceId = segments[4];
      state.disputeEvidence[disputeId] = (state.disputeEvidence[disputeId] || []).map((item) =>
        item.id === evidenceId ? { ...item, isFlagged: true } : item,
      );
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/disputes\/hearings\/dispute\/[^/]+$/.test(path) && method === "GET") {
      const disputeId = path.split("/")[4];
      await jsonResponse(route, 200, { data: state.disputeHearings[disputeId] || [] });
      return;
    }

    if (path === "/disputes/hearings/schedule" && method === "POST") {
      const payload = parseJsonBody(bodyText);
      const hearingId = `hearing-created-${state.nextHearingId++}`;
      const createdHearing = makeHearing({
        id: hearingId,
        disputeId: payload.disputeId,
        scheduledAt: payload.scheduledAt,
        estimatedDurationMinutes: payload.estimatedDurationMinutes,
        agenda: payload.agenda,
        requiredDocuments: payload.requiredDocuments,
        externalMeetingLink: payload.externalMeetingLink || null,
        hearingNumber: 20,
      });
      state.disputeHearings[payload.disputeId] = [
        createdHearing,
        ...(state.disputeHearings[payload.disputeId] || []),
      ];
      await jsonResponse(route, 200, {
        data: {
          manualRequired: false,
          hearing: createdHearing,
          calendarEvent: {
            id: `calendar-${hearingId}`,
            status: "SCHEDULED",
            startTime: payload.scheduledAt,
            endTime: payload.scheduledAt,
          },
          participants: [],
          scheduledAt: payload.scheduledAt,
          responseDeadline: "2026-04-01T12:00:00.000Z",
          participantConfirmationSummary: createdHearing.participantConfirmationSummary,
          warnings: [],
        },
      });
      return;
    }

    if (/^\/disputes\/hearings\/[^/]+\/start$/.test(path) && method === "POST") {
      const hearingId = path.split("/")[3];
      Object.keys(state.disputeHearings).forEach((disputeId) => {
        state.disputeHearings[disputeId] = state.disputeHearings[disputeId].map((hearing) =>
          hearing.id === hearingId ? { ...hearing, status: "IN_PROGRESS", startedAt: NOW_ISO } : hearing,
        );
      });
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (/^\/disputes\/hearings\/[^/]+\/end$/.test(path) && method === "POST") {
      const hearingId = path.split("/")[3];
      const payload = parseJsonBody(bodyText);
      Object.keys(state.disputeHearings).forEach((disputeId) => {
        state.disputeHearings[disputeId] = state.disputeHearings[disputeId].map((hearing) =>
          hearing.id === hearingId
            ? {
                ...hearing,
                status: "COMPLETED",
                lifecycle: "ARCHIVED",
                endedAt: NOW_ISO,
                summary: payload.summary,
                findings: payload.findings,
                pendingActions: payload.pendingActions,
                isActionable: false,
                isArchived: true,
                minutesRecorded: true,
              }
            : hearing,
        );
      });
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (path === "/calendar/events" && method === "GET") {
      await jsonResponse(route, 200, { data: { items: state.calendarEvents, total: state.calendarEvents.length } });
      return;
    }

    if (path === "/calendar/availability/me" && method === "GET") {
      await jsonResponse(route, 200, { data: { userId: state.sessionUser.id, availability: state.availability, events: [] } });
      return;
    }

    if (/^\/calendar\/events\/[^/]+\/respond$/.test(path) && method === "POST") {
      await jsonResponse(route, 200, { success: true });
      return;
    }

    if (path === "/tasks/board/project-900" && method === "GET") {
      const milestoneStatus =
        state.caseId === "Create Dispute - 1" || state.caseId === "Create Dispute - 2"
          ? "SUBMITTED"
          : "IN_PROGRESS";
      await jsonResponse(route, 200, {
        tasks: state.workspaceBoard,
        milestones: [
          {
            id: "milestone-900-1",
            title: "Phase 1 Delivery",
            amount: 2500,
            status: milestoneStatus,
            description: "Primary dashboard delivery milestone.",
            startDate: "2026-03-20T08:00:00.000Z",
            dueDate: "2026-03-31T17:00:00.000Z",
            retentionAmount: 250,
            acceptanceCriteria: ["Accessibility checklist reviewed", "Navigation states verified"],
          },
        ],
      });
      return;
    }

    if (path === "/projects/project-900" && method === "GET") {
      await jsonResponse(route, 200, state.workspaceProject);
      return;
    }

    if (path === "/disputes" && method === "POST") {
      const payload = parseJsonBody(bodyText);
      const createdDisputeId = "dispute-created-1";
      state.createdDisputeId = createdDisputeId;
      state.disputesById[createdDisputeId] = makeDisputeSummary({
        id: createdDisputeId,
        displayCode: "DSP-NEW-01",
        displayTitle: "New Workspace Dispute",
        category: payload.category,
        status: "IN_MEDIATION",
        reason: payload.reason,
        reasonExcerpt: payload.reason,
        raisedById: state.sessionUser.id,
        defendantId: payload.defendantId,
      });
      await jsonResponse(route, 201, state.disputesById[createdDisputeId]);
      return;
    }

    if (path === "/disputes/hearings/mine" && method === "GET") {
      await jsonResponse(route, 200, { data: [] });
      return;
    }

    if (method === "GET") {
      await jsonResponse(route, 200, {});
      return;
    }

    await jsonResponse(route, 200, { success: true });
  });
};

export const emitSocketEvent = async (
  page: Page,
  event: string,
  payload: Record<string, any>,
  namespace: string = "/ws",
) => {
  await page.evaluate(
    ([targetNamespace, targetEvent, targetPayload]) => {
      (
        window as typeof window & {
          __INTERDEV_TEST_EMIT_SOCKET_EVENT__?: (
            namespace: string,
            event: string,
            payload: unknown,
          ) => void;
        }
      ).__INTERDEV_TEST_EMIT_SOCKET_EVENT__?.(
        targetNamespace,
        targetEvent,
        targetPayload,
      );
    },
    [namespace, event, payload] as const,
  );
};

export const findLoggedRequest = (state: MockState, method: string, pathPattern: RegExp) =>
  state.requestLog.find((entry) => entry.method === method && pathPattern.test(entry.path));

export const expectNotificationBadge = async (page: Page, expectedText: string | null) => {
  const badge = page.getByTestId("notification-unread-count");
  if (expectedText === null) {
    await expect(badge).toHaveCount(0);
    return;
  }
  await expect(badge).toHaveText(expectedText);
};
