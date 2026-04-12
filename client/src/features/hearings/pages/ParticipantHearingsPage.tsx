import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  Clock3,
  Gavel,
  Video,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  deleteAvailability,
  getEvents,
  getMyAvailability,
  respondEventInvite,
  setAvailability,
} from "@/features/calendar/api";
import {
  AvailabilityType,
  type CalendarDisputeContext,
  EventStatus,
  EventType,
  type CalendarEvent,
  type CalendarDisputeSummaryMetadata,
  type CalendarEventParticipant,
  type CalendarHearingSummaryMetadata,
  type EventInviteResponse,
} from "@/features/calendar/types";
import {
  cancelDispute,
  createSchedulingProposal,
  deleteSchedulingProposal,
  getSchedulingProposals,
  getSchedulingWorklist,
  markDisputeViewed,
  provideDisputeInfo,
  submitSchedulingProposals,
} from "@/features/disputes/api";
import { STORAGE_KEYS } from "@/constants";
import { cn } from "@/lib/utils";
import { getStoredJson } from "@/shared/utils/storage";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { connectSocket } from "@/shared/realtime/socket";
import type {
  DisputeScheduleProposal,
  SchedulingWorklistItem,
} from "@/features/disputes/types/dispute.types";
import { SchedulingCaseList } from "@/features/hearings/components/SchedulingCaseList";
import { SchedulingActionPanel } from "@/features/hearings/components/SchedulingActionPanel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { resolveRoleBasePath } from "../utils/hearingRouting";
import { isActiveCalendarHearingStatus } from "../utils/hearingLifecycle";
import { normalizeExternalMeetingLink } from "../utils/externalMeetingLink";

type HearingCalendarEvent = {
  id: string;
  title: string;
  displayTitle: string;
  displayCode: string;
  start: Date;
  end: Date;
  status: EventStatus;
  type: EventType;
  referenceId?: string;
  referenceType?: string;
  externalMeetingLink?: string;
  metadata?: Record<string, unknown>;
  disputeId?: string;
  projectTitle?: string;
  reasonExcerpt?: string;
  hearingNumber?: number;
  tier?: string;
  nextAction?: string;
  appealState?: string;
  isActionable?: boolean;
  isArchived?: boolean;
  freezeReason?: string;
  disputeSummary?: CalendarDisputeSummaryMetadata;
  hearingSummary?: CalendarHearingSummaryMetadata;
  participants?: CalendarEventParticipant[];
  disputeContext?: CalendarDisputeContext;
};

type CalendarViewType =
  | "dayGridMonth"
  | "timeGridWeek"
  | "timeGridDay"
  | "listWeek";
type MobileStep = "cases" | "actions";
type CalendarVisibleRange = {
  startIso: string;
  endIso: string;
};

const buildVisibleRange = (
  start: Date,
  end: Date,
): CalendarVisibleRange => ({
  startIso: start.toISOString(),
  endIso: end.toISOString(),
});

const STATUS_STYLES: Record<
  EventStatus,
  { bg: string; border: string; text: string }
> = {
  [EventStatus.DRAFT]: { bg: "#f8fafc", border: "#cbd5f5", text: "#475569" },
  [EventStatus.SCHEDULED]: {
    bg: "#dcfce7",
    border: "#86efac",
    text: "#166534",
  },
  [EventStatus.PENDING_CONFIRMATION]: {
    bg: "#fef3c7",
    border: "#fcd34d",
    text: "#92400e",
  },
  [EventStatus.RESCHEDULING]: {
    bg: "#ede9fe",
    border: "#c4b5fd",
    text: "#5b21b6",
  },
  [EventStatus.IN_PROGRESS]: {
    bg: "#dbeafe",
    border: "#93c5fd",
    text: "#1d4ed8",
  },
  [EventStatus.COMPLETED]: {
    bg: "#f1f5f9",
    border: "#cbd5e1",
    text: "#475569",
  },
  [EventStatus.CANCELLED]: {
    bg: "#f8fafc",
    border: "#e2e8f0",
    text: "#64748b",
  },
};

const statusLabelMap: Record<EventStatus, string> = {
  [EventStatus.DRAFT]: "Draft",
  [EventStatus.SCHEDULED]: "Scheduled",
  [EventStatus.PENDING_CONFIRMATION]: "Pending confirmation",
  [EventStatus.RESCHEDULING]: "Rescheduling",
  [EventStatus.IN_PROGRESS]: "In progress",
  [EventStatus.COMPLETED]: "Completed",
  [EventStatus.CANCELLED]: "Cancelled",
};

const statusShortLabelMap: Record<EventStatus, string> = {
  [EventStatus.DRAFT]: "Draft",
  [EventStatus.SCHEDULED]: "Set",
  [EventStatus.PENDING_CONFIRMATION]: "Hold",
  [EventStatus.RESCHEDULING]: "Shift",
  [EventStatus.IN_PROGRESS]: "Live",
  [EventStatus.COMPLETED]: "Done",
  [EventStatus.CANCELLED]: "Stop",
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.DISPUTE_HEARING]: "Dispute Hearing",
  [EventType.PROJECT_MEETING]: "Project Meeting",
  [EventType.INTERNAL_MEETING]: "Internal Meeting",
  [EventType.PERSONAL_BLOCK]: "Personal Block",
  [EventType.REVIEW_SESSION]: "Review Session",
  [EventType.TASK_DEADLINE]: "Task Deadline",
  [EventType.OTHER]: "Other",
};

const EVENT_TYPE_BADGE_STYLE: Record<EventType, string> = {
  [EventType.DISPUTE_HEARING]: "bg-indigo-100 text-indigo-700",
  [EventType.PROJECT_MEETING]: "bg-blue-100 text-blue-700",
  [EventType.INTERNAL_MEETING]: "bg-cyan-100 text-cyan-700",
  [EventType.PERSONAL_BLOCK]: "bg-slate-200 text-slate-700",
  [EventType.REVIEW_SESSION]: "bg-emerald-100 text-emerald-700",
  [EventType.TASK_DEADLINE]: "bg-amber-100 text-amber-700",
  [EventType.OTHER]: "bg-purple-100 text-purple-700",
};

const APPEAL_STATE_LABELS: Record<string, string> = {
  NONE: "No appeal",
  AVAILABLE: "Appeal available",
  FILED: "Appeal submitted",
  RESOLVED: "Appeal resolved",
  EXPIRED: "Appeal window closed",
};

const ROLE_LABELS: Record<string, string> = {
  CLIENT: "Client",
  BROKER: "Broker",
  FREELANCER: "Freelancer",
  ADMIN: "Admin",
  STAFF: "Staff",
  MODERATOR: "Moderator",
  RAISER: "Claimant",
  DEFENDANT: "Respondent",
  OBSERVER: "Observer",
  WITNESS: "Witness",
};

const INVITE_STATUS_LABELS: Record<string, string> = {
  NO_RESPONSE: "No response",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  TENTATIVE: "Tentative",
  REQUIRED: "Required",
};

const formatEnumLabel = (
  value?: string | null,
  fallback: string = "Not available",
) => {
  if (!value) return fallback;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatTierLabel = (value?: string | null) => {
  if (!value) return "Hearing tier";
  if (value.toUpperCase().startsWith("TIER_")) {
    return `Tier ${value.slice(5)}`;
  }
  return formatEnumLabel(value, "Hearing tier");
};

const formatAppealStateLabel = (value?: string | null) => {
  if (!value) return "No appeal";
  return APPEAL_STATE_LABELS[value] || formatEnumLabel(value, "No appeal");
};

const formatRoleLabel = (value?: string | null) => {
  if (!value) return "Role not set";
  return ROLE_LABELS[value] || formatEnumLabel(value, "Role not set");
};

const formatInviteStatusLabel = (value?: string | null) => {
  if (!value) return "Pending";
  return INVITE_STATUS_LABELS[value] || formatEnumLabel(value, "Pending");
};

const resolveHearingBadgeLabel = (event: HearingCalendarEvent) => {
  if (event.hearingNumber) {
    return `Hearing #${event.hearingNumber}`;
  }
  return EVENT_TYPE_LABELS[event.type] || "Hearing";
};

const shouldShowAppealBadge = (appealState?: string | null) =>
  Boolean(appealState && appealState !== "NONE");

const CALENDAR_STATUS_LEGEND = [
  {
    label: "Scheduled / ready",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    label: "Pending confirmation",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    label: "In progress / live",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    label: "Archive / reference",
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
];

const REALTIME_REFRESH_DEBOUNCE_MS = 500;
const REALTIME_EVENT_DEDUPE_TTL_MS = 1500;

const isInviteResponseValue = (
  value: unknown,
): value is EventInviteResponse =>
  value === "accept" || value === "decline" || value === "tentative";

const toEventStatus = (value: unknown): EventStatus | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return (Object.values(EventStatus) as string[]).includes(value)
    ? (value as EventStatus)
    : undefined;
};

const mapInviteResponseToParticipantStatus = (
  response: EventInviteResponse,
): string => {
  if (response === "accept") {
    return "ACCEPTED";
  }
  if (response === "decline") {
    return "DECLINED";
  }
  return "TENTATIVE";
};

const applyInviteResponseToParticipants = (
  participants: CalendarEventParticipant[] | undefined,
  participantId: string,
  response: EventInviteResponse,
) => {
  if (!participants?.length) {
    return participants;
  }

  const status = mapInviteResponseToParticipantStatus(response);
  const respondedAt = new Date().toISOString();

  return participants.map((participant) =>
    participant.id === participantId
      ? {
          ...participant,
          status,
          respondedAt,
        }
      : participant,
  );
};

type AvailabilityEntry = {
  id: string;
  type: AvailabilityType;
  startTime?: string;
  endTime?: string;
  note?: string;
  isRecurring?: boolean;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getStringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumberValue = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getBooleanValue = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const DISPUTE_DEMO_PROJECT_TITLE_PATTERN = /^DISPUTE\s*DEMO\s*::\s*\d+\s*::\s*/i;

const normalizeProjectDisplayTitle = (value?: string | null): string | undefined => {
  const normalized = `${value || ""}`.trim();
  if (!normalized) {
    return undefined;
  }

  return (
    normalized.replace(DISPUTE_DEMO_PROJECT_TITLE_PATTERN, "").trim() ||
    normalized
  );
};

const normalizeDisputeSummary = (
  value: unknown,
): CalendarDisputeSummaryMetadata | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }
  const id = getStringValue(value.id);
  if (!id) {
    return undefined;
  }
  return {
    id,
    displayCode: getStringValue(value.displayCode) ?? id.slice(0, 8).toUpperCase(),
    displayTitle: getStringValue(value.displayTitle) ?? "Dispute hearing",
    projectTitle: getStringValue(value.projectTitle),
    reasonExcerpt: getStringValue(value.reasonExcerpt) ?? "No dispute summary provided.",
    status: getStringValue(value.status),
    appealState: getStringValue(value.appealState) ?? "NONE",
  };
};

const normalizeHearingSummary = (
  value: unknown,
): CalendarHearingSummaryMetadata | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }
  const hearingId = getStringValue(value.hearingId);
  if (!hearingId) {
    return undefined;
  }
  return {
    hearingId,
    hearingNumber: getNumberValue(value.hearingNumber),
    tier: getStringValue(value.tier),
    status: getStringValue(value.status),
    isActionable: getBooleanValue(value.isActionable) ?? false,
    isArchived: getBooleanValue(value.isArchived) ?? false,
    freezeReason: getStringValue(value.freezeReason),
    scheduledAt: getStringValue(value.scheduledAt),
    nextAction: getStringValue(value.nextAction),
    appealState: getStringValue(value.appealState) ?? "NONE",
    externalMeetingLink:
      normalizeExternalMeetingLink(getStringValue(value.externalMeetingLink)) ??
      getStringValue(value.externalMeetingLink),
  };
};

const isActionableEvent = (event: HearingCalendarEvent) =>
  event.isActionable ?? isActiveCalendarHearingStatus(event.status);

const isArchivedEvent = (event: HearingCalendarEvent) =>
  event.isArchived ?? !isActionableEvent(event);

const getHearingId = (event: HearingCalendarEvent) => {
  if (event.hearingSummary?.hearingId) {
    return event.hearingSummary.hearingId;
  }
  if (event.referenceType === "DisputeHearing" && event.referenceId) {
    return event.referenceId;
  }
  const metadata = event.metadata;
  if (metadata && typeof metadata === "object" && "hearingId" in metadata) {
    const value = metadata.hearingId;
    if (typeof value === "string") return value;
  }
  return undefined;
};

const resolveRange = (baseDate: Date, view: CalendarViewType) => {
  if (view === "dayGridMonth") {
    const start = startOfWeek(startOfMonth(baseDate));
    const end = addDays(endOfWeek(endOfMonth(baseDate)), 1);
    return { start, end };
  }
  if (view === "timeGridWeek" || view === "listWeek") {
    const start = startOfWeek(baseDate);
    const end = addDays(endOfWeek(baseDate), 1);
    return { start, end };
  }
  const start = startOfDay(baseDate);
  const end = addDays(start, 1);
  return { start, end };
};

const toLocalDateTimeInputValue = (value: Date) =>
  format(value, "yyyy-MM-dd'T'HH:mm");

const toDurationLabel = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  if (minutes <= 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

const truncate = (value: string | undefined, maxLength: number) => {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
};

export const ParticipantHearingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<CalendarViewType>("timeGridWeek");
  const [events, setEvents] = useState<HearingCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityDeletingId, setAvailabilityDeletingId] = useState<
    string | null
  >(null);
  const [availabilityEntries, setAvailabilityEntries] = useState<
    AvailabilityEntry[]
  >([]);
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>(
    AvailabilityType.BUSY,
  );
  const [availabilityNote, setAvailabilityNote] = useState("");

  const [worklistLoading, setWorklistLoading] = useState(false);
  const [worklistItems, setWorklistItems] = useState<SchedulingWorklistItem[]>(
    [],
  );
  const [worklistDegradedMessage, setWorklistDegradedMessage] = useState<
    string | null
  >(null);
  const [markingViewedIds, setMarkingViewedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedDisputeId, setSelectedDisputeId] = useState("");
  const [mobileStep, setMobileStep] = useState<MobileStep>("cases");
  const [visibleRange, setVisibleRange] = useState<CalendarVisibleRange>(() => {
    const initialRange = resolveRange(new Date(), "timeGridWeek");
    return buildVisibleRange(initialRange.start, initialRange.end);
  });

  const [cancelingDispute, setCancelingDispute] = useState(false);
  const [submittingInfo, setSubmittingInfo] = useState(false);
  const [scheduleProposals, setScheduleProposals] = useState<
    DisputeScheduleProposal[]
  >([]);
  const [proposalStart, setProposalStart] = useState("");
  const [proposalEnd, setProposalEnd] = useState("");
  const [proposalNote, setProposalNote] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalDeleteId, setProposalDeleteId] = useState<string | null>(null);
  const [proposalSubmitLoading, setProposalSubmitLoading] = useState(false);
  const [infoResponseDraft, setInfoResponseDraft] = useState("");
  const [infoEvidenceIds, setInfoEvidenceIds] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<HearingCalendarEvent | null>(null);
  const [responding, setResponding] = useState<EventInviteResponse | null>(
    null,
  );
  const notifiedRef = useRef<Set<string>>(new Set());
  const joinedDisputeIdsRef = useRef<Set<string>>(new Set());
  const refreshTimeoutRef = useRef<number | null>(null);
  const realtimeEventSignaturesRef = useRef<Map<string, number>>(new Map());
  const fetchSequenceRef = useRef(0);

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string; role?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const userId = currentUser?.id;
  const roleBasePath = useMemo(
    () => resolveRoleBasePath(currentUser?.role),
    [currentUser?.role],
  );
  const selectedExternalMeetingHref = normalizeExternalMeetingLink(
    selectedEvent?.externalMeetingLink,
  );
  const createdDisputeId = searchParams.get("createdDisputeId");
  const focusedDisputeId =
    searchParams.get("disputeId") || createdDisputeId || "";

  useEffect(() => {
    if (!createdDisputeId) return;
    toast.success(
      `Dispute #${createdDisputeId.slice(0, 8)} created successfully.`,
    );
  }, [createdDisputeId]);

  const selectedCase = useMemo(
    () =>
      worklistItems.find((item) => item.disputeId === selectedDisputeId) ||
      null,
    [selectedDisputeId, worklistItems],
  );

  const proposalValidation = useMemo(() => {
    if (!selectedCase?.canProposeSlots) {
      return {
        isValid: false,
        durationMinutes: null as number | null,
        durationLabel: "",
        error: null as string | null,
      };
    }

    if (!proposalStart || !proposalEnd) {
      return {
        isValid: false,
        durationMinutes: null as number | null,
        durationLabel: "",
        error: null as string | null,
      };
    }

    const start = new Date(proposalStart);
    const end = new Date(proposalEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return {
        isValid: false,
        durationMinutes: null as number | null,
        durationLabel: "",
        error: "Invalid start/end date value.",
      };
    }

    if (end <= start) {
      return {
        isValid: false,
        durationMinutes: null as number | null,
        durationLabel: "",
        error: "End time must be after start time.",
      };
    }

    if (start.getTime() <= Date.now()) {
      return {
        isValid: false,
        durationMinutes: null as number | null,
        durationLabel: "",
        error: "Start time must be in the future.",
      };
    }

    const durationMinutes = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60),
    );

    if (durationMinutes < 15) {
      return {
        isValid: false,
        durationMinutes,
        durationLabel: toDurationLabel(durationMinutes),
        error: "Minimum proposal duration is 15 minutes.",
      };
    }

    if (durationMinutes > 8 * 60) {
      return {
        isValid: false,
        durationMinutes,
        durationLabel: toDurationLabel(durationMinutes),
        error: "Maximum proposal duration is 8 hours.",
      };
    }

    return {
      isValid: true,
      durationMinutes,
      durationLabel: toDurationLabel(durationMinutes),
      error: null as string | null,
    };
  }, [proposalEnd, proposalStart, selectedCase?.canProposeSlots]);

  const canCreateProposal =
    Boolean(selectedCase?.canProposeSlots) &&
    Boolean(proposalStart) &&
    Boolean(proposalEnd) &&
    proposalValidation.isValid;

  const fetchEvents = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const fetchSequence = ++fetchSequenceRef.current;

    if (!userId) {
      setEvents([]);
      setAvailabilityEntries([]);
      setWorklistItems([]);
      return;
    }

    if (!silent) {
      setLoading(true);
      setWorklistLoading(true);
    }

    setWorklistDegradedMessage(null);

    const rangeStartIso = visibleRange.startIso;
    const rangeEndIso = visibleRange.endIso;

    const [eventsResult, availabilityResult, worklistResult] =
      await Promise.allSettled([
        getEvents({
          startDate: rangeStartIso,
          endDate: rangeEndIso,
          type: EventType.DISPUTE_HEARING,
          limit: 200,
        }),
        getMyAvailability(rangeStartIso, rangeEndIso),
        getSchedulingWorklist(),
      ]);

    if (fetchSequenceRef.current !== fetchSequence) {
      return;
    }

    if (eventsResult.status === "fulfilled") {
      const items = eventsResult.value?.items ?? [];
      const mapped = items
        .map((event: CalendarEvent): HearingCalendarEvent | null => {
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          if (
            Number.isNaN(startTime.getTime()) ||
            Number.isNaN(endTime.getTime())
          ) {
            return null;
          }
          const disputeSummary = normalizeDisputeSummary(
            event.metadata?.disputeSummary,
          );
          const hearingSummary = normalizeHearingSummary(
            event.metadata?.hearingSummary,
          );
          const contextProjectTitle = normalizeProjectDisplayTitle(
            event.disputeContext?.projectTitle,
          );
          const projectTitle =
            contextProjectTitle ||
            normalizeProjectDisplayTitle(disputeSummary?.projectTitle);
          const displayCode =
            event.disputeContext?.displayCode ||
            disputeSummary?.displayCode ||
            `DSP-${(event.referenceId || event.id).slice(0, 8).toUpperCase()}`;
          const displayTitle =
            (projectTitle ? `${projectTitle} dispute` : undefined) ||
            disputeSummary?.displayTitle ||
            event.title ||
            "Dispute Hearing";

          return {
            id: event.id,
            title: event.title || "Dispute Hearing",
            start: startTime,
            end: endTime,
            status: event.status,
            type: event.type,
            referenceId: event.referenceId,
            referenceType: event.referenceType,
            externalMeetingLink:
              normalizeExternalMeetingLink(event.externalMeetingLink) ??
              event.externalMeetingLink,
            metadata: (event.metadata as Record<string, unknown>) || undefined,
            disputeId:
              event.disputeContext?.disputeId ||
              disputeSummary?.id ||
              (typeof event.metadata?.disputeId === "string"
                ? event.metadata.disputeId
                : undefined),
            displayTitle,
            displayCode,
            projectTitle,
            reasonExcerpt: disputeSummary?.reasonExcerpt,
            hearingNumber: hearingSummary?.hearingNumber,
            tier: hearingSummary?.tier,
            nextAction: hearingSummary?.nextAction,
            appealState:
              disputeSummary?.appealState ||
              hearingSummary?.appealState,
            isActionable:
              hearingSummary?.isActionable,
            isArchived:
              hearingSummary?.isArchived,
            freezeReason:
              hearingSummary?.freezeReason,
            disputeSummary,
            hearingSummary,
            participants: event.participants ?? [],
            disputeContext: event.disputeContext,
          };
        })
        .filter((event): event is HearingCalendarEvent => {
          if (!event) return false;
          const isDisputeHearingType = event.type === EventType.DISPUTE_HEARING;
          const isDisputeReference =
            event.referenceType === "DisputeHearing" ||
            event.referenceType?.toLowerCase().includes("dispute") ||
            event.referenceType?.toLowerCase().includes("hearing");
          return isDisputeHearingType || Boolean(isDisputeReference);
        });
      setEvents(mapped);
      setSelectedEvent((current) => {
        if (!current) {
          return current;
        }
        const refreshed = mapped.find((event) => event.id === current.id);
        if (refreshed) {
          return refreshed;
        }

        const fallback = mapped.find(
          (event) =>
            Boolean(current.disputeId) && event.disputeId === current.disputeId,
        );

        return fallback ?? null;
      });
    } else {
      console.error("Failed to load calendar events:", eventsResult.reason);
      if (!silent) {
        toast.error("Could not load calendar events.");
      }
    }

    if (availabilityResult.status === "fulfilled") {
      setAvailabilityEntries(
        (availabilityResult.value?.availability ?? []) as AvailabilityEntry[],
      );
    } else {
      console.error(
        "Failed to load availability data:",
        availabilityResult.reason,
      );
      setAvailabilityEntries([]);
    }

    if (worklistResult.status === "fulfilled") {
      const payload = worklistResult.value;
      const items = payload?.items ?? [];
      if (!payload?.enabled) {
        const disabledMessage =
          payload?.message ||
          "Scheduling worklist is currently disabled by configuration.";
        setWorklistItems([]);
        setSelectedDisputeId("");
        setWorklistDegradedMessage(disabledMessage);
        toast.warning(disabledMessage);
      } else {
        setWorklistItems(items);
        setSelectedDisputeId((current) => {
          if (current && items.some((item) => item.disputeId === current)) {
            return current;
          }
          if (
            focusedDisputeId &&
            items.some((item) => item.disputeId === focusedDisputeId)
          ) {
            return focusedDisputeId;
          }
          return items[0]?.disputeId || "";
        });
      }

      if (payload?.degraded) {
        setWorklistDegradedMessage(
          payload.message ||
            "Some scheduling metadata is unavailable. Please run pending migrations.",
        );
      }
    } else {
      console.error(
        "Failed to load scheduling worklist:",
        worklistResult.reason,
      );
      setWorklistDegradedMessage(
        "Could not refresh dispute scheduling worklist. Showing last synced data.",
      );
      if (!silent) {
        toast.warning(
          "Some dispute scheduling data failed to load. Calendar is still available.",
        );
      }
    }

    if (!silent) {
      setWorklistLoading(false);
      setLoading(false);
    }
  }, [focusedDisputeId, userId, visibleRange.endIso, visibleRange.startIso]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      void fetchEvents({ silent: true });
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [fetchEvents]);

  const applyRealtimeInviteResponse = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const eventPayload = payload as Record<string, unknown>;
    const eventId =
      typeof eventPayload.eventId === "string" ? eventPayload.eventId : null;
    const participantId =
      typeof eventPayload.participantId === "string"
        ? eventPayload.participantId
        : null;
    const response = isInviteResponseValue(eventPayload.response)
      ? eventPayload.response
      : null;
    const nextStatus = toEventStatus(eventPayload.eventStatus);

    if (!eventId) {
      return;
    }

    const updateEvent = (event: HearingCalendarEvent): HearingCalendarEvent => {
      if (event.id !== eventId) {
        return event;
      }

      return {
        ...event,
        status: nextStatus ?? event.status,
        participants:
          participantId && response
            ? applyInviteResponseToParticipants(event.participants, participantId, response)
            : event.participants,
      };
    };

    setEvents((current) => current.map(updateEvent));
    setSelectedEvent((current) => (current ? updateEvent(current) : current));
  }, []);

  const realtimeDisputeIds = useMemo(() => {
    const ids = new Set<string>();

    events.forEach((event) => {
      if (event.disputeId) {
        ids.add(event.disputeId);
      }
    });

    worklistItems.forEach((item) => {
      if (item.disputeId) {
        ids.add(item.disputeId);
      }
    });

    if (selectedEvent?.disputeId) {
      ids.add(selectedEvent.disputeId);
    }

    return Array.from(ids);
  }, [events, selectedEvent?.disputeId, worklistItems]);

  useEffect(() => {
    const socket = connectSocket();
    const joined = joinedDisputeIdsRef.current;

    const joinTrackedRooms = () => {
      realtimeDisputeIds.forEach((disputeId) => {
        if (!joined.has(disputeId)) {
          socket.emit("joinDispute", { disputeId });
          joined.add(disputeId);
        }
      });
    };

    if (socket.connected) {
      joinTrackedRooms();
    } else {
      socket.once("connect", joinTrackedRooms);
    }

    joined.forEach((disputeId) => {
      if (!realtimeDisputeIds.includes(disputeId)) {
        socket.emit("leaveDispute", { disputeId });
        joined.delete(disputeId);
      }
    });

    return () => {
      socket.off("connect", joinTrackedRooms);
    };
  }, [realtimeDisputeIds]);

  useEffect(() => {
    const socket = connectSocket();
    const realtimeEvents = [
      "HEARING_SCHEDULED",
      "HEARING_RESCHEDULED",
      "HEARING_STARTED",
      "HEARING_PAUSED",
      "HEARING_RESUMED",
      "HEARING_ENDED",
      "HEARING_EXTENDED",
      "HEARING_FOLLOW_UP_SCHEDULED",
      "HEARING_INVITE_RESPONDED",
      "APPEAL_SUBMITTED",
      "APPEAL_RESOLVED",
      "VERDICT_ISSUED",
      "APPEAL_DEADLINE_PASSED",
    ] as const;
    const handlers = new Map<string, (payload: unknown) => void>();

    const cleanupStaleSignatures = (now: number) => {
      const signatures = realtimeEventSignaturesRef.current;
      signatures.forEach((timestamp, key) => {
        if (now - timestamp > REALTIME_EVENT_DEDUPE_TTL_MS) {
          signatures.delete(key);
        }
      });
    };

    const buildRealtimeSignature = (eventName: string, payload: unknown): string => {
      if (!payload || typeof payload !== "object") {
        return `${eventName}:no-payload`;
      }

      const value = payload as Record<string, unknown>;
      const eventId = typeof value.eventId === "string" ? value.eventId : "";
      const disputeId = typeof value.disputeId === "string" ? value.disputeId : "";
      const hearingId = typeof value.hearingId === "string" ? value.hearingId : "";
      const participantId =
        typeof value.participantId === "string" ? value.participantId : "";
      const response = typeof value.response === "string" ? value.response : "";
      const eventStatus =
        typeof value.eventStatus === "string" ? value.eventStatus : "";
      const respondedAt =
        typeof value.respondedAt === "string" ? value.respondedAt : "";
      const serverTimestamp =
        typeof value.serverTimestamp === "string" ? value.serverTimestamp : "";

      return [
        eventName,
        eventId,
        disputeId,
        hearingId,
        participantId,
        response,
        eventStatus,
        respondedAt,
        serverTimestamp,
      ].join("|");
    };

    realtimeEvents.forEach((eventName) => {
      const handler = (payload: unknown) => {
        const now = Date.now();
        cleanupStaleSignatures(now);

        const signature = buildRealtimeSignature(eventName, payload);
        const signatures = realtimeEventSignaturesRef.current;
        const seenAt = signatures.get(signature);
        if (seenAt && now - seenAt < REALTIME_EVENT_DEDUPE_TTL_MS) {
          return;
        }
        signatures.set(signature, now);

        if (eventName === "HEARING_INVITE_RESPONDED") {
          applyRealtimeInviteResponse(payload);
        }

        scheduleRealtimeRefresh();
      };

      handlers.set(eventName, handler);
      socket.on(eventName, handler);
    });

    return () => {
      realtimeEvents.forEach((eventName) => {
        const handler = handlers.get(eventName);
        if (handler) {
          socket.off(eventName, handler);
        }
      });
    };
  }, [applyRealtimeInviteResponse, scheduleRealtimeRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      const socket = connectSocket();
      joinedDisputeIdsRef.current.forEach((disputeId) => {
        socket.emit("leaveDispute", { disputeId });
      });
      joinedDisputeIdsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const loadProposals = useCallback(async () => {
    if (!selectedCase?.canProposeSlots) {
      setScheduleProposals([]);
      return;
    }
    try {
      const items = await getSchedulingProposals(selectedCase.disputeId);
      const sorted = [...items]
        .filter((item) => item.status !== "WITHDRAWN")
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
      setScheduleProposals(sorted);
    } catch (error) {
      console.error("Failed to load scheduling proposals:", error);
      toast.error("Could not load scheduling proposals.");
      setScheduleProposals([]);
    }
  }, [selectedCase]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    if (!selectedCase || selectedCase.actionType !== "PROVIDE_INFO") {
      setInfoResponseDraft("");
      setInfoEvidenceIds([]);
      return;
    }

    setInfoEvidenceIds([]);
  }, [selectedCase?.actionType, selectedCase?.disputeId]);

  useEffect(() => {
    if (
      !selectedCase ||
      selectedCase.isSeen ||
      markingViewedIds.has(selectedCase.disputeId)
    ) {
      return;
    }

    setWorklistItems((prev) =>
      prev.map((item) =>
        item.disputeId === selectedCase.disputeId
          ? { ...item, isSeen: true, isNew: false }
          : item,
      ),
    );

    setMarkingViewedIds((prev) => {
      const next = new Set(prev);
      next.add(selectedCase.disputeId);
      return next;
    });

    void markDisputeViewed(selectedCase.disputeId)
      .catch((error) => {
        console.error("Failed to mark dispute as viewed:", error);
      })
      .finally(() => {
        setMarkingViewedIds((prev) => {
          const next = new Set(prev);
          next.delete(selectedCase.disputeId);
          return next;
        });
      });
  }, [markingViewedIds, selectedCase]);

  useEffect(() => {
    if (!events.length) return;

    const notify = () => {
      const now = new Date();
      events.forEach((event) => {
        if (!isActionableEvent(event)) return;
        const minutesUntil = (event.start.getTime() - now.getTime()) / 60000;
        if (minutesUntil > 10 || minutesUntil < -5) return;
        const key = `${event.id}:${event.start.toISOString()}`;
        if (notifiedRef.current.has(key)) return;
        const label =
          minutesUntil <= 0
            ? "Your hearing is starting now."
            : `Your hearing starts in ${Math.ceil(minutesUntil)} minutes.`;
        toast.info(label);
        notifiedRef.current.add(key);
      });
    };

    notify();
    const interval = window.setInterval(notify, 60_000);
    return () => window.clearInterval(interval);
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter(
        (event) =>
          !isArchivedEvent(event) && event.end.getTime() >= now.getTime(),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 4);
  }, [events]);
  const archivedEvents = useMemo(() => {
    return [...events]
      .filter((event) => isArchivedEvent(event))
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .slice(0, 6);
  }, [events]);

  const handleSelectEvent = useCallback((event: HearingCalendarEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  const selectedParticipant = useMemo(() => {
    if (!selectedEvent || !userId) return null;
    return (
      selectedEvent.participants?.find(
        (participant) => participant.userId === userId,
      ) ?? null
    );
  }, [selectedEvent, userId]);
  const selectedParticipantRoster = useMemo(() => {
    if (!selectedEvent?.participants?.length) {
      return [];
    }

    return selectedEvent.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      displayName:
        participant.user?.fullName ||
        participant.user?.handle ||
        participant.user?.email ||
        participant.userId,
      handle: participant.user?.handle,
      systemRole: participant.user?.role,
      hearingRole: participant.role,
      inviteStatus: participant.status,
    }));
  }, [selectedEvent?.participants]);

  const canRespondInvite =
    selectedEvent?.status === EventStatus.PENDING_CONFIRMATION &&
    !!selectedParticipant;

  const handleRespondInvite = useCallback(
    async (response: EventInviteResponse) => {
      if (!selectedEvent || !selectedParticipant) return;

      const previousSelectedEvent = selectedEvent;
      const previousEvents = events;

      setSelectedEvent((current) => {
        if (!current || current.id !== selectedEvent.id) {
          return current;
        }
        return {
          ...current,
          participants: applyInviteResponseToParticipants(
            current.participants,
            selectedParticipant.id,
            response,
          ),
        };
      });
      setEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                participants: applyInviteResponseToParticipants(
                  event.participants,
                  selectedParticipant.id,
                  response,
                ),
              }
            : event,
        ),
      );

      try {
        setResponding(response);
        const result = await respondEventInvite(selectedEvent.id, {
          participantId: selectedParticipant.id,
          response,
        });
        const payload =
          (result as { data?: { manualRequired?: boolean; reason?: string } })
            .data ?? result;

        if (payload?.manualRequired) {
          toast.warning(
            payload.reason || "Reschedule required after your response.",
          );
        } else if (response === "accept") {
          toast.success("Invitation accepted.");
        } else if (response === "decline") {
          toast.success(
            "Invitation declined. The system will try to reschedule.",
          );
        } else {
          toast.success("Marked as tentative.");
        }

        await fetchEvents();
        scheduleRealtimeRefresh();
      } catch (error) {
        setSelectedEvent(previousSelectedEvent);
        setEvents(previousEvents);
        console.error("Failed to respond to hearing invitation:", error);
        toast.error("Could not submit your response.");
      } finally {
        setResponding(null);
      }
    },
    [events, fetchEvents, scheduleRealtimeRefresh, selectedEvent, selectedParticipant],
  );

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.displayTitle,
        start: event.start,
        end: event.end,
        extendedProps: {
          interdevEvent: event,
        },
      })),
    [events],
  );

  const renderCalendarEvent = useCallback((arg: EventContentArg) => {
    const event = (arg.event.extendedProps as { interdevEvent?: HearingCalendarEvent })
      .interdevEvent;
    if (!event) {
      return <div className="text-xs font-medium text-slate-700">{arg.event.title}</div>;
    }
    const statusStyle =
      STATUS_STYLES[event.status] ?? STATUS_STYLES[EventStatus.SCHEDULED];
    const isMonthView = arg.view.type === "dayGridMonth";
    const isListView = arg.view.type === "listWeek";
    const isCompact = isMonthView || isListView;

    if (isMonthView) {
      return (
        <div
          className={cn(
            "flex min-w-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm",
            isArchivedEvent(event) ? "bg-slate-50" : "bg-white",
          )}
          style={{
            borderColor: statusStyle.border,
            backgroundColor: statusStyle.bg,
            color: statusStyle.text,
          }}
        >
          <span className="truncate">{resolveHearingBadgeLabel(event)}</span>
          <span className="shrink-0 rounded-full bg-white/80 px-1 py-0.5 text-[9px]">
            {statusShortLabelMap[event.status]}
          </span>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "rounded-xl border px-2.5 py-2 shadow-sm transition-all",
          isArchivedEvent(event)
            ? "border-slate-200 bg-slate-50/95"
            : "border-teal-200 bg-white/95",
        )}
        style={{
          borderColor: statusStyle.border,
          backgroundColor: statusStyle.bg,
          color: statusStyle.text,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold text-slate-800">
            {resolveHearingBadgeLabel(event)}
          </span>
          <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold">
            {statusShortLabelMap[event.status]}
          </span>
        </div>
        <div className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-slate-900">
          {event.displayTitle}
        </div>
        {event.projectTitle ? (
          <div className="mt-1 truncate text-[11px] text-slate-700">
            {event.projectTitle}
          </div>
        ) : null}
        {!isListView && event.reasonExcerpt ? (
          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-700">
            {truncate(event.reasonExcerpt, 96)}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded-full bg-white/75 px-1.5 py-0.5 text-[10px] font-medium">
            {statusLabelMap[event.status]}
          </span>
          {event.tier ? (
            <span className="rounded-full bg-white/75 px-1.5 py-0.5 text-[10px] font-medium">
              {formatTierLabel(event.tier)}
            </span>
          ) : null}
          {shouldShowAppealBadge(event.appealState) ? (
            <span className="rounded-full bg-white/75 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {formatAppealStateLabel(event.appealState)}
            </span>
          ) : null}
          {event.nextAction && !isListView ? (
            <span className="rounded-full bg-white/75 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {truncate(event.nextAction, 26)}
            </span>
          ) : null}
        </div>
        {!isCompact ? (
          <div className="mt-2 truncate text-[11px] text-slate-600">
            {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
          </div>
        ) : null}
        {isListView && event.reasonExcerpt ? (
          <div className="mt-2 flex flex-wrap gap-1">
            <div className="line-clamp-2 text-[11px] leading-4 text-slate-700">
              {truncate(event.reasonExcerpt, 120)}
            </div>
          </div>
        ) : null}
      </div>
    );
  }, []);

  const handleCalendarEventClick = useCallback((arg: EventClickArg) => {
    const event = (arg.event.extendedProps as { interdevEvent?: HearingCalendarEvent })
      .interdevEvent;
    if (!event) return;
    handleSelectEvent(event);
  }, [handleSelectEvent]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const nextRange = buildVisibleRange(arg.start, arg.end);

    setVisibleRange((current) =>
      current.startIso === nextRange.startIso &&
      current.endIso === nextRange.endIso
        ? current
        : nextRange,
    );

    setView((current) =>
      current === (arg.view.type as CalendarViewType)
        ? current
        : (arg.view.type as CalendarViewType),
    );
  }, []);

  const copyDisputeId = useCallback(async () => {
    if (!selectedEvent?.disputeId) return;
    try {
      await navigator.clipboard.writeText(selectedEvent.disputeId);
      toast.success("Technical case ID copied");
    } catch {
      toast.error("Could not copy technical case ID");
    }
  }, [selectedEvent?.disputeId]);

  const handleSaveAvailability = useCallback(async () => {
    if (!availabilityStart || !availabilityEnd) {
      toast.error("Please select busy slot start and end.");
      return;
    }
    const start = new Date(availabilityStart);
    const end = new Date(availabilityEnd);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      toast.error("Invalid busy slot range.");
      return;
    }

    try {
      setSavingAvailability(true);
      await setAvailability({
        slots: [
          {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            type: availabilityType,
            note: availabilityNote.trim() || undefined,
          },
        ],
      });
      toast.success("Busy/unavailable slot saved.");
      setAvailabilityStart("");
      setAvailabilityEnd("");
      setAvailabilityNote("");
      await fetchEvents();
    } catch (error) {
      console.error("Failed to set availability:", error);
      toast.error("Could not save availability.");
    } finally {
      setSavingAvailability(false);
    }
  }, [
    availabilityEnd,
    availabilityNote,
    availabilityStart,
    availabilityType,
    fetchEvents,
  ]);

  const handleDeleteAvailability = useCallback(
    async (availabilityId: string) => {
      try {
        setAvailabilityDeletingId(availabilityId);
        await deleteAvailability(availabilityId);
        toast.success("Availability slot removed.");
        await fetchEvents();
      } catch (error) {
        console.error("Failed to delete availability:", error);
        toast.error("Could not remove availability slot.");
      } finally {
        setAvailabilityDeletingId(null);
      }
    },
    [fetchEvents],
  );

  const handleCancelDispute = useCallback(async () => {
    if (!selectedCase?.canCancel) {
      toast.error("This dispute is not eligible for cancellation.");
      return;
    }

    try {
      setCancelingDispute(true);
      await cancelDispute(
        selectedCase.disputeId,
        "Canceled by raiser from scheduling workspace",
      );
      toast.success("Dispute canceled.");
      await fetchEvents();
    } catch (error) {
      console.error("Failed to cancel dispute:", error);
      toast.error("Could not cancel dispute.");
    } finally {
      setCancelingDispute(false);
    }
  }, [fetchEvents, selectedCase]);

  const handleProvideInfo = useCallback(async () => {
    if (!selectedCase || selectedCase.actionType !== "PROVIDE_INFO") {
      toast.error("No info request is pending for this case.");
      return;
    }

    const message = infoResponseDraft.trim();
    const evidenceIds = infoEvidenceIds;

    if (!message && evidenceIds.length === 0) {
      toast.error("Add a response message or select evidence before submitting.");
      return;
    }

    if (message.length > 0 && message.length < 10 && evidenceIds.length === 0) {
      toast.error("Please provide at least 10 characters for your response.");
      return;
    }

    try {
      setSubmittingInfo(true);
      await provideDisputeInfo(selectedCase.disputeId, {
        message: message || undefined,
        evidenceIds: evidenceIds.length > 0 ? evidenceIds : undefined,
      });
      toast.success(
        evidenceIds.length > 0
          ? "Additional information and evidence submitted."
          : "Additional information submitted.",
      );
      setInfoResponseDraft("");
      setInfoEvidenceIds([]);
      await fetchEvents();
    } catch (error) {
      console.error("Failed to provide dispute info:", error);
      toast.error("Could not submit additional information.");
    } finally {
      setSubmittingInfo(false);
    }
  }, [fetchEvents, infoEvidenceIds, infoResponseDraft, selectedCase]);

  const handleProposalStartChange = useCallback(
    (value: string) => {
      setProposalStart(value);
      if (!value) {
        return;
      }

      const parsedStart = new Date(value);
      if (Number.isNaN(parsedStart.getTime())) {
        return;
      }

      if (proposalEnd) {
        const parsedEnd = new Date(proposalEnd);
        if (
          !Number.isNaN(parsedEnd.getTime()) &&
          parsedEnd.getTime() > parsedStart.getTime()
        ) {
          return;
        }
      }

      const suggestedEnd = new Date(parsedStart.getTime() + 90 * 60 * 1000);
      setProposalEnd(toLocalDateTimeInputValue(suggestedEnd));
    },
    [proposalEnd],
  );

  const handleProposalEndChange = useCallback((value: string) => {
    setProposalEnd(value);
  }, []);

  const handleCreateProposal = useCallback(async () => {
    if (!selectedCase?.canProposeSlots) {
      toast.error(
        selectedCase?.notEligibleReasonText ||
          "This case cannot accept slot proposals right now.",
      );
      return;
    }
    if (!proposalStart || !proposalEnd) {
      toast.error("Please select proposal start and end.");
      return;
    }

    if (!proposalValidation.isValid) {
      toast.error(proposalValidation.error || "Invalid proposal time range.");
      return;
    }

    const start = new Date(proposalStart);
    const end = new Date(proposalEnd);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      toast.error("Invalid proposal time range.");
      return;
    }

    try {
      setProposalLoading(true);
      await createSchedulingProposal(selectedCase.disputeId, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        note: proposalNote.trim() || undefined,
      });
      toast.success("Proposed slot submitted.");
      setProposalStart("");
      setProposalEnd("");
      setProposalNote("");
      await loadProposals();
      await fetchEvents();
    } catch (error) {
      console.error("Failed to create scheduling proposal:", error);
      const details = getApiErrorDetails(error, "Could not submit proposed slot.");
      toast.error(
        details.code ? `[${details.code}] ${details.message}` : details.message,
      );
    } finally {
      setProposalLoading(false);
    }
  }, [
    fetchEvents,
    loadProposals,
    proposalEnd,
    proposalNote,
    proposalStart,
    proposalValidation.error,
    proposalValidation.isValid,
    selectedCase,
  ]);

  const handleDeleteProposal = useCallback(
    async (proposalId: string) => {
      if (!selectedCase) return;
      try {
        setProposalDeleteId(proposalId);
        await deleteSchedulingProposal(selectedCase.disputeId, proposalId);
        toast.success("Proposed slot removed.");
        await loadProposals();
      } catch (error) {
        console.error("Failed to delete scheduling proposal:", error);
        toast.error("Could not remove proposed slot.");
      } finally {
        setProposalDeleteId(null);
      }
    },
    [loadProposals, selectedCase],
  );

  const handleSubmitProposals = useCallback(async () => {
    if (!selectedCase?.canProposeSlots) {
      toast.error(
        selectedCase?.notEligibleReasonText ||
          "This case cannot submit proposals right now.",
      );
      return;
    }
    try {
      setProposalSubmitLoading(true);
      const result = await submitSchedulingProposals(selectedCase.disputeId);
      if ((result.submitted ?? 0) > 0) {
        toast.success(
          `Submitted ${result.submitted} proposal(s) for scheduling.`,
        );
      } else {
        toast.info("No active proposal to submit.");
      }
      await loadProposals();
      await fetchEvents();
    } catch (error) {
      console.error("Failed to submit scheduling proposals:", error);
      toast.error("Could not submit scheduling proposals.");
    } finally {
      setProposalSubmitLoading(false);
    }
  }, [fetchEvents, loadProposals, selectedCase]);

  const availabilityBlocks = useMemo(() => {
    return availabilityEntries
      .filter(
        (entry) =>
          Boolean(entry.startTime && entry.endTime) && !entry.isRecurring,
      )
      .sort((a, b) => {
        const aTime = new Date(a.startTime || "").getTime();
        const bTime = new Date(b.startTime || "").getTime();
        return aTime - bTime;
      })
      .slice(0, 8);
  }, [availabilityEntries]);

  if (!userId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Please sign in to view your hearing schedule.
      </div>
    );
  }

  const selectedHearingId = selectedEvent
    ? getHearingId(selectedEvent)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-teal-600" />
            Dispute Calendar & Hearings
          </h1>
          <p className="text-sm text-slate-600">
            Track hearing timeline, mark busy blocks, and propose available
            slots per dispute.
          </p>
        </div>
        {loading && (
          <div className="text-xs text-slate-500">Refreshing calendar...</div>
        )}
      </div>

      {createdDisputeId && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          New dispute created successfully. Open Disputes for the full case record.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-600">
              Review the docket by month, week, day, or list view. Month view stays compact;
              full dispute detail opens in the drawer.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CALENDAR_STATUS_LEGEND.map((item) => (
                <span
                  key={item.label}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    item.color,
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="interdev-fc h-175 overflow-hidden rounded-2xl border border-slate-200">
              <FullCalendar
                plugins={[
                  dayGridPlugin,
                  timeGridPlugin,
                  listPlugin,
                  interactionPlugin,
                ]}
                initialView={view}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                }}
                buttonText={{
                  today: "Today",
                  month: "Month",
                  week: "Week",
                  day: "Day",
                  list: "List",
                }}
                events={calendarEvents}
                datesSet={handleDatesSet}
                eventClick={handleCalendarEventClick}
                eventContent={renderCalendarEvent}
                height="100%"
                slotEventOverlap={false}
                dayMaxEventRows={3}
                progressiveEventRendering
                nowIndicator
                allDaySlot={false}
                stickyHeaderDates
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Video className="h-4 w-4 text-teal-600" />
              Upcoming events
            </h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {upcomingEvents.length === 0 && (
                <p className="text-sm text-slate-500">No upcoming events.</p>
              )}
              {upcomingEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-700">
                        {resolveHearingBadgeLabel(event)}
                      </div>
                      <div className="truncate font-medium text-slate-900">
                        {event.displayTitle}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${EVENT_TYPE_BADGE_STYLE[event.type]}`}
                    >
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {format(event.start, "MMM d, h:mm a")} | {statusLabelMap[event.status]}
                  </div>
                  {event.reasonExcerpt ? (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {truncate(event.reasonExcerpt, 96)}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-slate-600" />
              Archived hearings
            </h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {archivedEvents.length === 0 && (
                <p className="text-sm text-slate-500">No archived hearings yet.</p>
              )}
              {archivedEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-700">
                        {resolveHearingBadgeLabel(event)}
                      </div>
                      <div className="truncate font-medium text-slate-900">
                        {event.displayTitle}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {statusLabelMap[event.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {format(event.start, "MMM d, h:mm a")}
                  </div>
                  {event.freezeReason ? (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {event.freezeReason}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-teal-600" />
              Mark Busy / Unavailable
            </h3>
            <p className="text-xs text-slate-500">
              Scheduler treats BUSY / OUT_OF_OFFICE / DO_NOT_DISTURB as hard
              constraints.
            </p>
            <div className="grid gap-2">
              <input
                type="datetime-local"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-colors focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={availabilityStart}
                onChange={(event) => setAvailabilityStart(event.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-colors focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={availabilityEnd}
                onChange={(event) => setAvailabilityEnd(event.target.value)}
              />
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-colors focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                value={availabilityType}
                onChange={(event) =>
                  setAvailabilityType(event.target.value as AvailabilityType)
                }
              >
                <option value={AvailabilityType.BUSY}>Busy</option>
                <option value={AvailabilityType.OUT_OF_OFFICE}>
                  Out of office
                </option>
                <option value={AvailabilityType.DO_NOT_DISTURB}>
                  Do not disturb
                </option>
                <option value={AvailabilityType.PREFERRED}>
                  Preferred (hint)
                </option>
                <option value={AvailabilityType.AVAILABLE}>
                  Available (hint)
                </option>
              </select>
              <input
                type="text"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm transition-colors focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="Optional note"
                value={availabilityNote}
                onChange={(event) => setAvailabilityNote(event.target.value)}
              />
              <button
                className="rounded-lg bg-teal-600 text-white px-3 py-2.5 text-sm font-medium shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-colors"
                disabled={savingAvailability}
                onClick={handleSaveAvailability}
              >
                {savingAvailability ? "Saving..." : "Save busy slot"}
              </button>
            </div>

            <div className="space-y-2">
              {availabilityBlocks.length === 0 && (
                <p className="text-xs text-slate-500">
                  No manual availability blocks in this range.
                </p>
              )}
              {availabilityBlocks.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-medium text-slate-700">
                      {entry.type.replaceAll("_", " ")}
                    </div>
                    <div>
                      {entry.startTime
                        ? format(new Date(entry.startTime), "MMM d, h:mm a")
                        : "-"}{" "}
                      -{" "}
                      {entry.endTime
                        ? format(new Date(entry.endTime), "h:mm a")
                        : "-"}
                    </div>
                  </div>
                  <button
                    className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
                    disabled={availabilityDeletingId === entry.id}
                    onClick={() => handleDeleteAvailability(entry.id)}
                  >
                    {availabilityDeletingId === entry.id ? "..." : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dispute Scheduling Cases - Full width section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Gavel className="h-5 w-5 text-teal-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Dispute Scheduling
              </h3>
              <p className="text-xs text-slate-500">
                Select a case, then perform the required action.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <button
              className={cn(
                "min-h-10 rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
                mobileStep === "cases"
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
              onClick={() => setMobileStep("cases")}
            >
              Cases
            </button>
            <button
              className={cn(
                "min-h-10 rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
                mobileStep === "actions"
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
              onClick={() => setMobileStep("actions")}
              disabled={!selectedCase}
            >
              Actions
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div
              className={cn(
                mobileStep === "actions" ? "hidden lg:block" : "block",
              )}
            >
              <SchedulingCaseList
                items={worklistItems}
                selectedDisputeId={selectedDisputeId}
                loading={worklistLoading}
                degraded={Boolean(worklistDegradedMessage)}
                degradedMessage={worklistDegradedMessage || undefined}
                onSelect={(disputeId) => {
                  setSelectedDisputeId(disputeId);
                  setMobileStep("actions");
                }}
              />
            </div>
            <div
              className={cn(
                mobileStep === "cases" ? "hidden lg:block" : "block",
              )}
            >
              <div className="mb-3 lg:hidden">
                <button
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                  onClick={() => setMobileStep("cases")}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to case list
                </button>
              </div>
              <SchedulingActionPanel
                selectedCase={selectedCase}
                proposalStart={proposalStart}
                proposalEnd={proposalEnd}
                proposalNote={proposalNote}
                proposalDurationLabel={proposalValidation.durationLabel}
                proposalValidationError={proposalValidation.error}
                canCreateProposal={canCreateProposal}
                proposalLoading={proposalLoading}
                proposalSubmitLoading={proposalSubmitLoading}
                proposalDeleteId={proposalDeleteId}
                scheduleProposals={scheduleProposals}
                infoResponseDraft={infoResponseDraft}
                infoEvidenceIds={infoEvidenceIds}
                submittingInfo={submittingInfo}
                canceling={cancelingDispute}
                onProposalStartChange={handleProposalStartChange}
                onProposalEndChange={handleProposalEndChange}
                onProposalNoteChange={setProposalNote}
                onInfoResponseChange={setInfoResponseDraft}
                onInfoEvidenceIdsChange={setInfoEvidenceIds}
                onCreateProposal={handleCreateProposal}
                onSubmitProposals={handleSubmitProposals}
                onDeleteProposal={handleDeleteProposal}
                onProvideInfo={handleProvideInfo}
                onCancelDispute={handleCancelDispute}
              />
            </div>
          </div>
        </div>
      </div>

      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedEvent(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader className="border-b border-slate-200 pb-4">
            <SheetTitle>{selectedEvent?.displayTitle ?? "Event details"}</SheetTitle>
            <SheetDescription>
              {selectedEvent
                ? format(selectedEvent.start, "MMM d, yyyy - h:mm a")
                : "Hearing schedule or archive record"}
            </SheetDescription>
          </SheetHeader>
          {selectedEvent && (
            <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                    {resolveHearingBadgeLabel(selectedEvent)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                    {statusLabelMap[selectedEvent.status]}
                  </span>
                  {selectedEvent.tier ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                      {formatTierLabel(selectedEvent.tier)}
                    </span>
                  ) : null}
                  {selectedEvent.disputeId ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                      Case ref: {selectedEvent.displayCode}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Schedule
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {format(selectedEvent.start, "MMM d, yyyy h:mm a")} -{" "}
                      {format(selectedEvent.end, "h:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Hearing
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedEvent.hearingNumber
                        ? `Hearing #${selectedEvent.hearingNumber}`
                        : "Hearing record"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Project
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {selectedEvent.projectTitle || "Unnamed project"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Appeal state
                    </p>
                    <p className="mt-1 font-medium text-slate-900">
                      {formatAppealStateLabel(selectedEvent.appealState)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedEvent.reasonExcerpt ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Dispute summary
                  </p>
                  <p className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 leading-6 text-slate-700">
                    {selectedEvent.reasonExcerpt}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Claimant
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedEvent.disputeContext?.claimantName || "Unavailable"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Respondent
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedEvent.disputeContext?.defendantName || "Unavailable"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Next action
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedEvent.nextAction ||
                      (isActionableEvent(selectedEvent)
                        ? "Join or confirm this hearing."
                        : "Read-only docket record.")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Case reference
                  </p>
                  <div className="mt-1 space-y-2">
                    <p className="font-medium text-slate-900">
                      {selectedEvent.displayCode || "Unavailable"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-slate-600">
                        Technical ID: {selectedEvent.disputeId || "Unavailable"}
                      </span>
                      {selectedEvent.disputeId ? (
                        <button
                          type="button"
                          onClick={() => void copyDisputeId()}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Copy ID
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Use this technical ID only when contacting support.
                    </p>
                  </div>
                </div>
              </div>

              {selectedParticipantRoster.length ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Hearing participants
                  </p>
                  <div className="mt-3 space-y-2">
                    {selectedParticipantRoster.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {participant.displayName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>{formatRoleLabel(participant.hearingRole)}</span>
                            {participant.handle ? <span>{participant.handle}</span> : null}
                            {participant.systemRole ? (
                              <span>{formatRoleLabel(participant.systemRole)}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {formatInviteStatusLabel(participant.inviteStatus)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedParticipant ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Your response
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatInviteStatusLabel(selectedParticipant.status)}
                  </p>
                </div>
              ) : null}

              {selectedEvent.freezeReason ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {selectedEvent.freezeReason}
                </div>
              ) : null}

              {selectedExternalMeetingHref ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Meeting link
                  </p>
                  <a
                    href={selectedExternalMeetingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 font-medium text-teal-700 hover:bg-teal-100"
                  >
                    Open external meeting room
                  </a>
                </div>
              ) : null}
            </div>
          )}
          <SheetFooter className="border-t border-slate-200">
            {canRespondInvite && (
              <>
                <button
                  className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  onClick={() => handleRespondInvite("accept")}
                  disabled={responding !== null}
                >
                  {responding === "accept" ? "Saving..." : "Accept"}
                </button>
                <button
                  className="px-4 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  onClick={() => handleRespondInvite("tentative")}
                  disabled={responding !== null}
                >
                  {responding === "tentative" ? "Saving..." : "Tentative"}
                </button>
                <button
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => handleRespondInvite("decline")}
                  disabled={responding !== null}
                >
                  {responding === "decline" ? "Saving..." : "Decline"}
                </button>
              </>
            )}
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setDetailOpen(false)}
            >
              Close
            </button>
            {selectedHearingId && selectedEvent && (
                <button
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                  onClick={() => {
                    setDetailOpen(false);
                    navigate(`${roleBasePath}/hearings/${selectedHearingId}`);
                  }}
                >
                  {isActionableEvent(selectedEvent)
                    ? "Join hearing room"
                    : "View hearing record"}
                </button>
              )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <style>{`
        .interdev-fc .fc {
          height: 100%;
        }
        .interdev-fc .fc-toolbar {
          gap: 8px;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }
        .interdev-fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .interdev-fc .fc-button {
          border-radius: 9999px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          box-shadow: none;
          text-transform: none;
        }
        .interdev-fc .fc-button-primary:not(:disabled).fc-button-active,
        .interdev-fc .fc-button-primary:not(:disabled):active {
          background: #0f766e;
          border-color: #0f766e;
          color: white;
        }
        .interdev-fc .fc-theme-standard td,
        .interdev-fc .fc-theme-standard th {
          border-color: #e2e8f0;
        }
        .interdev-fc .fc-col-header-cell {
          background: #f8fafc;
          padding: 8px 0;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }
        .interdev-fc .fc-daygrid-day-frame,
        .interdev-fc .fc-timegrid-slot {
          min-height: 76px;
        }
        .interdev-fc .fc-timegrid-event,
        .interdev-fc .fc-daygrid-event,
        .interdev-fc .fc-list-event {
          border: none;
          background: transparent;
          box-shadow: none;
          margin: 3px 6px;
        }
        .interdev-fc .fc-daygrid-event-harness {
          margin-top: 2px;
        }
        .interdev-fc .fc-daygrid-day-events {
          margin: 0 2px;
        }
        .interdev-fc .fc-event-main {
          padding: 0;
          min-width: 0;
        }
        .interdev-fc .fc-day-today {
          background: #f0fdfa !important;
        }
      `}</style>
    </div>
  );
};
