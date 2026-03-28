export interface DisputeFollowUpActionCatalogItem {
  code: string;
  label: string;
  ownerRole: string;
  defaultUrgent: boolean;
  guidance: string;
}

export interface NormalizedDisputeFollowUpAction {
  code: string;
  label: string;
  ownerRole: string;
  dueAt?: string | null;
  urgent: boolean;
  note?: string | null;
}

export type DisputeFollowUpActionInput =
  | string
  | Partial<NormalizedDisputeFollowUpAction>
  | null
  | undefined;

export const DISPUTE_FOLLOW_UP_ACTION_CATALOG: DisputeFollowUpActionCatalogItem[] = [
  {
    code: 'REQUEST_MORE_EVIDENCE',
    label: 'Request More Evidence',
    ownerRole: 'STAFF',
    defaultUrgent: false,
    guidance:
      'Ask the relevant party to submit more evidence before the dispute proceeds.',
  },
  {
    code: 'SCHEDULE_FOLLOW_UP_HEARING',
    label: 'Schedule Follow-up Hearing',
    ownerRole: 'STAFF',
    defaultUrgent: true,
    guidance:
      'Book another hearing when the current session ends without a verdict.',
  },
  {
    code: 'REQUEST_PARTY_CLARIFICATION',
    label: 'Request Party Clarification',
    ownerRole: 'STAFF',
    defaultUrgent: false,
    guidance:
      'Collect a clearer explanation from one or more parties before deciding next steps.',
  },
  {
    code: 'ESCALATE_TO_ADMIN_REVIEW',
    label: 'Escalate To Admin Review',
    ownerRole: 'ADMIN',
    defaultUrgent: true,
    guidance:
      'Hand the dispute over for admin review when policy or risk requires a higher level decision.',
  },
  {
    code: 'CONFIRM_HEARING_ATTENDANCE',
    label: 'Confirm Hearing Attendance',
    ownerRole: 'STAFF',
    defaultUrgent: true,
    guidance:
      'Follow up with required participants to confirm attendance before the next session.',
  },
];

const DISPUTE_FOLLOW_UP_ACTION_CATALOG_MAP = new Map(
  DISPUTE_FOLLOW_UP_ACTION_CATALOG.map((item) => [item.code, item] as const),
);

const fallbackLabelFromCode = (code: string) =>
  code
    .trim()
    .toUpperCase()
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');

const normalizeDueAt = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }

  const raw = String(value ?? '').trim();
  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();

export const buildDefaultFollowUpAction = (
  code: string,
  overrides: Partial<NormalizedDisputeFollowUpAction> = {},
): NormalizedDisputeFollowUpAction => {
  const normalizedCode = normalizeCode(code);
  const catalogItem = DISPUTE_FOLLOW_UP_ACTION_CATALOG_MAP.get(normalizedCode);

  return {
    code: normalizedCode,
    label:
      String(overrides.label ?? '').trim() ||
      catalogItem?.label ||
      fallbackLabelFromCode(normalizedCode),
    ownerRole:
      String(overrides.ownerRole ?? '').trim().toUpperCase() ||
      catalogItem?.ownerRole ||
      'STAFF',
    dueAt: normalizeDueAt(overrides.dueAt),
    urgent:
      typeof overrides.urgent === 'boolean'
        ? overrides.urgent
        : (catalogItem?.defaultUrgent ?? false),
    note: String(overrides.note ?? '').trim() || null,
  };
};

export const normalizeDisputeFollowUpActionInput = (
  input: DisputeFollowUpActionInput[],
): NormalizedDisputeFollowUpAction[] => {
  const actions = Array.isArray(input) ? input : [];

  return actions
    .map((item) => {
      if (!item) {
        return null;
      }

      if (typeof item === 'string') {
        const code = normalizeCode(item);
        return code ? buildDefaultFollowUpAction(code) : null;
      }

      const code = normalizeCode(item.code);
      return code ? buildDefaultFollowUpAction(code, item) : null;
    })
    .filter(
      (item): item is NormalizedDisputeFollowUpAction =>
        Boolean(item && item.code && item.label && item.ownerRole),
    );
};
