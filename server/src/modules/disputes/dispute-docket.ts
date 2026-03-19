import {
  DisputePhase,
  DisputeStatus,
  HearingStatus,
  HearingTier,
  UserRole,
} from 'src/database/entities';

export type DisputeCaseStage =
  | 'FILED'
  | 'TRIAGE'
  | 'PRE_HEARING_SUBMISSIONS'
  | 'HEARING_IN_PROGRESS'
  | 'DELIBERATION'
  | 'VERDICT_ISSUED'
  | 'APPEAL_WINDOW'
  | 'APPEAL_HEARING'
  | 'FINAL_ARCHIVE';

export type DisputeAppealState = 'NONE' | 'AVAILABLE' | 'FILED' | 'RESOLVED' | 'EXPIRED';

export type DisputeAllowedAction =
  | 'VIEW_CASE'
  | 'VIEW_DOCKET'
  | 'VIEW_EVIDENCE'
  | 'VIEW_TIMELINE'
  | 'VIEW_CONTRACTS'
  | 'EXPORT_DOSSIER'
  | 'OPEN_HEARING'
  | 'UPLOAD_EVIDENCE'
  | 'SEND_STATEMENT'
  | 'SUBMIT_APPEAL'
  | 'RESOLVE_APPEAL'
  | 'MANAGE_HEARING'
  | 'VIEW_COMPLEXITY';

export interface DocketHearingSnapshot {
  id: string;
  status: HearingStatus;
  tier?: HearingTier | null;
  scheduledAt?: Date | string | null;
  agenda?: string | null;
  previousHearingId?: string | null;
  hearingNumber?: number | null;
  summary?: string | null;
  findings?: string | null;
  noShowNote?: string | null;
  externalMeetingLink?: string | null;
}

export interface HearingDocketEntry {
  hearingId: string;
  hearingNumber: number;
  tier?: HearingTier | null;
  status: HearingStatus;
  scheduledAt?: Date | string | null;
  agenda?: string | null;
  summary?: string | null;
  findings?: string | null;
  noShowNote?: string | null;
  previousHearingId?: string | null;
  externalMeetingLink?: string | null;
  isActionable: boolean;
  isArchived: boolean;
  lifecycle: 'ACTIVE' | 'ARCHIVED';
  freezeReason?: string;
  minutesRecorded: boolean;
}

export interface HearingDocketResult {
  items: HearingDocketEntry[];
  activeHearingId: string | null;
  latestHearingId: string | null;
}

export interface DisputeRuleCatalogItem {
  code: string;
  title: string;
  category:
    | 'CONTRACT_PERFORMANCE'
    | 'DELIVERY_QUALITY'
    | 'DEADLINE_DELAY'
    | 'PAYMENT_ESCROW'
    | 'SCOPE_CHANGE'
    | 'COOPERATION_DUTY'
    | 'FRAUD_MISREPRESENTATION'
    | 'EVIDENCE_INTEGRITY'
    | 'HEARING_CONDUCT';
  summary: string;
  legalBasis: string[];
  operationalGuidance: string[];
}

const ACTIVE_HEARING_STATUSES = new Set<HearingStatus>([
  HearingStatus.PENDING_CONFIRMATION,
  HearingStatus.SCHEDULED,
  HearingStatus.IN_PROGRESS,
  HearingStatus.PAUSED,
]);

const CLOSED_DISPUTE_STATUSES = new Set<DisputeStatus>([
  DisputeStatus.RESOLVED,
  DisputeStatus.REJECTED,
  DisputeStatus.CANCELED,
]);

const APPEAL_DISPUTE_STATUSES = new Set<DisputeStatus>([
  DisputeStatus.APPEALED,
  DisputeStatus.REJECTION_APPEALED,
]);

const INTERNAL_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.STAFF]);

export const DISPUTE_RULE_CATALOG: DisputeRuleCatalogItem[] = [
  {
    code: 'IDP-CP-1.0',
    title: 'Contract performance baseline',
    category: 'CONTRACT_PERFORMANCE',
    summary:
      'Assess whether each party performed according to the accepted scope, deliverables, and milestone obligations recorded in the project contract.',
    legalBasis: [
      'InterDev contract and milestone record',
      'Vietnam Civil Procedure Code 2015, Articles 93-95 (evidence evaluation)',
    ],
    operationalGuidance: [
      'Use signed contract snapshots and approved milestones as the primary scope reference.',
      'Treat undocumented scope changes as disputed unless corroborated by acceptance records or platform logs.',
    ],
  },
  {
    code: 'IDP-DQ-2.0',
    title: 'Delivery and quality mismatch',
    category: 'DELIVERY_QUALITY',
    summary:
      'Determine whether delivered work materially deviates from the approved requirements, acceptance criteria, or promised output quality.',
    legalBasis: ['InterDev quality and milestone acceptance records'],
    operationalGuidance: [
      'Compare the deliverable against the latest approved specification, proofs of work, and acceptance history.',
      'Minor presentation differences alone should not be treated as a material breach without business impact.',
    ],
  },
  {
    code: 'IDP-DD-3.0',
    title: 'Deadline and delay accountability',
    category: 'DEADLINE_DELAY',
    summary:
      'Measure whether delay is attributable to the delivering party, the requesting party, or an approved scope-change / dependency shift.',
    legalBasis: ['InterDev milestone due dates and scheduling history'],
    operationalGuidance: [
      'Weigh approved extensions and blocked dependencies before attributing fault.',
      'Use late delivery evidence, reminders, and staff scheduling logs to support the finding.',
    ],
  },
  {
    code: 'IDP-PE-4.0',
    title: 'Payment and escrow release',
    category: 'PAYMENT_ESCROW',
    summary:
      'Apply escrow outcomes based on verified delivery, rejection grounds, and contract-linked payment obligations.',
    legalBasis: ['InterDev escrow ledger and payment records'],
    operationalGuidance: [
      'Escrow release or refund must map to verified performance and the final verdict distribution.',
      'Payment disputes require transaction, milestone, and acceptance records to be cited explicitly.',
    ],
  },
  {
    code: 'IDP-SC-5.0',
    title: 'Scope change authorization',
    category: 'SCOPE_CHANGE',
    summary:
      'Unapproved scope additions or requirement drift should not automatically create liability without a recorded authorization trail.',
    legalBasis: ['InterDev project specification history and documented approvals'],
    operationalGuidance: [
      'Prefer explicit platform approvals over informal chat claims when determining whether a change became binding.',
      'If evidence conflicts, default to the last authoritative approved spec and milestone set.',
    ],
  },
  {
    code: 'IDP-CD-6.0',
    title: 'Communication and cooperation duty',
    category: 'COOPERATION_DUTY',
    summary:
      'Both parties must cooperate in good faith by responding, clarifying blockers, and attending required hearing or review steps.',
    legalBasis: ['InterDev dispute workflow and hearing participation records'],
    operationalGuidance: [
      'Repeated non-response, obstruction, or refusal to engage with required dispute steps may weigh against that party.',
      'Use message, notification, and attendance logs rather than unsupported assertions.',
    ],
  },
  {
    code: 'IDP-FM-7.0',
    title: 'Fraud and misrepresentation',
    category: 'FRAUD_MISREPRESENTATION',
    summary:
      'Intentional deception, fabricated delivery claims, or materially false representations are treated as severe violations.',
    legalBasis: ['InterDev fraud policy', 'Vietnam Law on Electronic Transactions 2023, Articles 8-11'],
    operationalGuidance: [
      'Fraud findings require evidence provenance review and should cite the strongest corroborating records available.',
      'Escalate sanctions, trust penalties, or bans only when the evidence record is coherent and traceable.',
    ],
  },
  {
    code: 'IDP-EI-8.0',
    title: 'Evidence integrity and provenance',
    category: 'EVIDENCE_INTEGRITY',
    summary:
      'Evidence should be traceable, attributable, and internally consistent with upload history, timestamps, and file integrity metadata.',
    legalBasis: [
      'Vietnam Law on Electronic Transactions 2023, Articles 8-11',
      'NIST digital integrity / hash guidance',
    ],
    operationalGuidance: [
      'Favor platform-uploaded files, checksum-linked exports, and timestamped records over unverifiable off-platform screenshots.',
      'Conflicting or altered evidence should be flagged in the verdict reasoning and timeline package.',
    ],
  },
  {
    code: 'IDP-HC-9.0',
    title: 'Hearing no-show and obstruction',
    category: 'HEARING_CONDUCT',
    summary:
      'A required participant who no-shows or obstructs the hearing flow may weaken their position when the docket record shows fair notice and opportunity to respond.',
    legalBasis: ['InterDev hearing attendance and scheduling confirmations'],
    operationalGuidance: [
      'No-show findings should cite notice, confirmation status, and any no-show note captured when the hearing closed.',
      'A single no-show should not outweigh stronger merits evidence without proportional analysis.',
    ],
  },
];

const compareHearings = (a: DocketHearingSnapshot, b: DocketHearingSnapshot) => {
  const aNumber = a.hearingNumber ?? 0;
  const bNumber = b.hearingNumber ?? 0;
  if (aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
  const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
  return aTime - bTime;
};

export const isDisputeClosedStatus = (status?: DisputeStatus | null): boolean =>
  Boolean(status && CLOSED_DISPUTE_STATUSES.has(status));

export const isDisputeAppealFlowStatus = (status?: DisputeStatus | null): boolean =>
  Boolean(status && APPEAL_DISPUTE_STATUSES.has(status));

export const isDisputeReadOnly = (status?: DisputeStatus | null): boolean =>
  isDisputeClosedStatus(status) || isDisputeAppealFlowStatus(status);

export const resolveDisputeAppealState = (input: {
  status?: DisputeStatus | null;
  isAppealed?: boolean | null;
  appealDeadline?: Date | string | null;
  appealResolvedAt?: Date | string | null;
  appealResolution?: string | null;
  isAppealVerdict?: boolean | null;
}): DisputeAppealState => {
  if (input.appealResolvedAt || input.appealResolution || input.isAppealVerdict) {
    return 'RESOLVED';
  }

  if (input.isAppealed || isDisputeAppealFlowStatus(input.status)) {
    return 'FILED';
  }

  if (input.status === DisputeStatus.RESOLVED && input.appealDeadline) {
    return new Date(input.appealDeadline).getTime() > Date.now() ? 'AVAILABLE' : 'EXPIRED';
  }

  return 'NONE';
};

export const buildHearingDocket = (
  hearings: DocketHearingSnapshot[] | null | undefined,
  disputeStatus?: DisputeStatus | null,
): HearingDocketResult => {
  const ordered = [...(hearings ?? [])].sort(compareHearings);
  const latestHearingId = ordered.length > 0 ? ordered[ordered.length - 1].id : null;

  const actionableCandidates = ordered.filter((hearing) => {
    if (!ACTIVE_HEARING_STATUSES.has(hearing.status)) {
      return false;
    }

    if (
      hearing.tier === HearingTier.TIER_1 &&
      disputeStatus &&
      APPEAL_DISPUTE_STATUSES.has(disputeStatus)
    ) {
      return false;
    }

    return true;
  });

  const activeHearingId =
    actionableCandidates.length > 0 ? actionableCandidates[actionableCandidates.length - 1].id : null;

  const items = ordered.map((hearing): HearingDocketEntry => {
    const minutesRecorded = Boolean(
      hearing.summary?.trim() || hearing.findings?.trim() || hearing.noShowNote?.trim(),
    );

    let isArchived = !ACTIVE_HEARING_STATUSES.has(hearing.status);
    let freezeReason: string | undefined;

    if (
      hearing.tier === HearingTier.TIER_1 &&
      disputeStatus &&
      APPEAL_DISPUTE_STATUSES.has(disputeStatus)
    ) {
      isArchived = true;
      freezeReason = 'Tier 1 hearing is archived because the dispute is now in appeal review.';
    } else if (
      ACTIVE_HEARING_STATUSES.has(hearing.status) &&
      activeHearingId &&
      activeHearingId !== hearing.id
    ) {
      isArchived = true;
      freezeReason = 'A later hearing on this dispute is now the actionable docket entry.';
    } else if (hearing.status === HearingStatus.RESCHEDULED) {
      freezeReason = 'This hearing was superseded by a rescheduled follow-up.';
    } else if (hearing.status === HearingStatus.CANCELED) {
      freezeReason = 'This hearing was canceled and is now archival record only.';
    } else if (hearing.status === HearingStatus.COMPLETED) {
      freezeReason = 'This hearing was completed and is now reference material only.';
    }

    return {
      hearingId: hearing.id,
      hearingNumber: hearing.hearingNumber ?? 1,
      tier: hearing.tier ?? null,
      status: hearing.status,
      scheduledAt: hearing.scheduledAt ?? null,
      agenda: hearing.agenda ?? null,
      summary: hearing.summary ?? null,
      findings: hearing.findings ?? null,
      noShowNote: hearing.noShowNote ?? null,
      previousHearingId: hearing.previousHearingId ?? null,
      externalMeetingLink: hearing.externalMeetingLink ?? null,
      isActionable: activeHearingId === hearing.id,
      isArchived,
      lifecycle: isArchived ? 'ARCHIVED' : 'ACTIVE',
      freezeReason,
      minutesRecorded,
    };
  });

  return {
    items,
    activeHearingId,
    latestHearingId,
  };
};

export const resolveDisputeCaseStage = (input: {
  status?: DisputeStatus | null;
  phase?: DisputePhase | null;
  hasActionableHearing: boolean;
  appealState: DisputeAppealState;
}): DisputeCaseStage => {
  if (input.appealState === 'RESOLVED') {
    return 'FINAL_ARCHIVE';
  }

  if (input.status === DisputeStatus.APPEALED || input.appealState === 'FILED') {
    return input.hasActionableHearing ? 'APPEAL_HEARING' : 'APPEAL_WINDOW';
  }

  if (input.status === DisputeStatus.RESOLVED) {
    return input.appealState === 'AVAILABLE' ? 'APPEAL_WINDOW' : 'VERDICT_ISSUED';
  }

  if (input.status === DisputeStatus.REJECTED || input.status === DisputeStatus.CANCELED) {
    return 'FINAL_ARCHIVE';
  }

  if (
    input.phase === DisputePhase.DELIBERATION &&
    (input.status === DisputeStatus.IN_MEDIATION || input.status === DisputeStatus.PENDING_REVIEW)
  ) {
    return 'DELIBERATION';
  }

  if (input.hasActionableHearing) {
    return 'HEARING_IN_PROGRESS';
  }

  if (
    input.status === DisputeStatus.PREVIEW ||
    input.status === DisputeStatus.PENDING_REVIEW ||
    input.status === DisputeStatus.INFO_REQUESTED ||
    input.status === DisputeStatus.IN_MEDIATION
  ) {
    return 'PRE_HEARING_SUBMISSIONS';
  }

  if (input.status === DisputeStatus.TRIAGE_PENDING || input.status === DisputeStatus.OPEN) {
    return 'TRIAGE';
  }

  return 'FILED';
};

export const resolveDisputeAllowedActions = (input: {
  status?: DisputeStatus | null;
  userId?: string | null;
  userRole?: UserRole | null;
  raisedById?: string | null;
  defendantId?: string | null;
  canAppealVerdict: boolean;
  hasActionableHearing: boolean;
}): DisputeAllowedAction[] => {
  const actions = new Set<DisputeAllowedAction>([
    'VIEW_CASE',
    'VIEW_DOCKET',
    'VIEW_EVIDENCE',
    'VIEW_TIMELINE',
    'VIEW_CONTRACTS',
    'EXPORT_DOSSIER',
  ]);

  if (input.hasActionableHearing) {
    actions.add('OPEN_HEARING');
  }

  const isParty =
    Boolean(input.userId) &&
    (input.userId === input.raisedById || input.userId === input.defendantId);
  const isInternal = Boolean(input.userRole && INTERNAL_ROLES.has(input.userRole));

  if (!isDisputeReadOnly(input.status) && isParty) {
    actions.add('UPLOAD_EVIDENCE');
    actions.add('SEND_STATEMENT');
  }

  if (input.canAppealVerdict) {
    actions.add('SUBMIT_APPEAL');
  }

  if (input.status === DisputeStatus.APPEALED && input.userRole === UserRole.ADMIN) {
    actions.add('RESOLVE_APPEAL');
  }

  if (
    (input.status === DisputeStatus.APPEALED || input.status === DisputeStatus.IN_MEDIATION) &&
    isInternal
  ) {
    actions.add('MANAGE_HEARING');
  }

  if (isInternal) {
    actions.add('VIEW_COMPLEXITY');
  }

  return Array.from(actions);
};

export const resolveDisputeDisplayTitle = (input: {
  projectTitle?: string | null;
  reason?: string | null;
  disputeId: string;
}): string => {
  if (input.projectTitle?.trim()) {
    return `${input.projectTitle.trim()} dispute`;
  }

  if (input.reason?.trim()) {
    return input.reason.trim().slice(0, 72);
  }

  return `Dispute ${input.disputeId.slice(0, 8).toUpperCase()}`;
};

export const resolveReasonExcerpt = (reason?: string | null, maxLength: number = 160): string => {
  const normalized = reason?.trim() ?? '';
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

export const resolveCaseGuide = (input: {
  userRole?: UserRole | null;
  caseStage: DisputeCaseStage;
  canAppealVerdict: boolean;
}): string => {
  if (input.userRole === UserRole.ADMIN) {
    return input.caseStage === 'APPEAL_HEARING' || input.caseStage === 'APPEAL_WINDOW'
      ? 'Admin is reviewing the appeal record and may issue the final appeal verdict.'
      : 'Admin access is primarily read-only unless appeal review is escalated to this tier.';
  }

  if (input.userRole === UserRole.STAFF) {
    return input.caseStage === 'HEARING_IN_PROGRESS'
      ? 'Conduct the active hearing, capture minutes, then close the session before any follow-up hearing.'
      : 'Triage the case, review submissions, and advance the docket without leaving multiple hearings actionable.';
  }

  if (input.canAppealVerdict) {
    return 'The verdict has been issued. The case is read-only except for filing an appeal before the deadline.';
  }

  switch (input.caseStage) {
    case 'PRE_HEARING_SUBMISSIONS':
      return 'Prepare hearing submissions, evidence, and scheduling confirmations for the next docket step.';
    case 'HEARING_IN_PROGRESS':
      return 'Join the active hearing, review the agenda, and follow the hearing instructions in sequence.';
    case 'VERDICT_ISSUED':
    case 'FINAL_ARCHIVE':
      return 'This case record is archived for reference. Regular dispute actions are locked.';
    case 'APPEAL_HEARING':
    case 'APPEAL_WINDOW':
      return 'The original ruling is frozen while appeal review proceeds. Watch the appeal docket for the next action.';
    default:
      return 'Follow the dispute docket for the next required action on this case.';
  }
};

