import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "react-big-calendar";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
  EventStatus,
  EventType,
  type CalendarEvent,
  type CalendarEventParticipant,
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
import { localizer } from "@/features/project-workspace/components/calendar";
import { STORAGE_KEYS } from "@/constants";
import { cn } from "@/lib/utils";
import { getStoredJson } from "@/shared/utils/storage";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import type {
  DisputeScheduleProposal,
  SchedulingWorklistItem,
} from "@/features/disputes/types/dispute.types";
import { SchedulingCaseList } from "@/features/hearings/components/SchedulingCaseList";
import { SchedulingActionPanel } from "@/features/hearings/components/SchedulingActionPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { resolveRoleBasePath } from "../utils/hearingRouting";

type HearingCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: EventStatus;
  type: EventType;
  referenceId?: string;
  referenceType?: string;
  externalMeetingLink?: string;
  metadata?: Record<string, unknown>;
  participants?: CalendarEventParticipant[];
};

type CalendarViewType = "month" | "week" | "day" | "agenda";
type MobileStep = "cases" | "actions";

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

type AvailabilityEntry = {
  id: string;
  type: AvailabilityType;
  startTime?: string;
  endTime?: string;
  note?: string;
  isRecurring?: boolean;
};

const isActiveStatus = (status: EventStatus) =>
  ![EventStatus.CANCELLED, EventStatus.COMPLETED].includes(status);

const getHearingId = (event: HearingCalendarEvent) => {
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
  if (view === "month" || view === "agenda") {
    const start = startOfWeek(startOfMonth(baseDate));
    const end = addDays(endOfWeek(endOfMonth(baseDate)), 1);
    return { start, end };
  }
  if (view === "week") {
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

export const ParticipantHearingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
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
  const [selectedDisputeId, setSelectedDisputeId] = useState("");
  const [mobileStep, setMobileStep] = useState<MobileStep>("cases");
  const [markingViewedIds, setMarkingViewedIds] = useState<Set<string>>(
    new Set(),
  );

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
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<HearingCalendarEvent | null>(null);
  const [responding, setResponding] = useState<EventInviteResponse | null>(
    null,
  );
  const notifiedRef = useRef<Set<string>>(new Set());

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string; role?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const userId = currentUser?.id;
  const roleBasePath = useMemo(
    () => resolveRoleBasePath(currentUser?.role),
    [currentUser?.role],
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

  const fetchEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      setAvailabilityEntries([]);
      setWorklistItems([]);
      return;
    }

    setLoading(true);
    setWorklistLoading(true);
    setWorklistDegradedMessage(null);
    const { start, end } = resolveRange(date, view);
    const [eventsResult, availabilityResult, worklistResult] =
      await Promise.allSettled([
        getEvents({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          participantId: userId,
        }),
        getMyAvailability(start.toISOString(), end.toISOString()),
        getSchedulingWorklist(),
      ]);

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
          return {
            id: event.id,
            title: event.title || "Dispute Hearing",
            start: startTime,
            end: endTime,
            status: event.status,
            type: event.type,
            referenceId: event.referenceId,
            referenceType: event.referenceType,
            externalMeetingLink: event.externalMeetingLink,
            metadata: (event.metadata as Record<string, unknown>) || undefined,
            participants: event.participants ?? [],
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
    } else {
      console.error("Failed to load calendar events:", eventsResult.reason);
      toast.error("Could not load calendar events.");
      setEvents([]);
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
      toast.warning(
        "Some dispute scheduling data failed to load. Calendar is still available.",
      );
    }

    setWorklistLoading(false);
    setLoading(false);
  }, [date, focusedDisputeId, userId, view]);

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
    }
  }, [selectedCase]);

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
        if (!isActiveStatus(event.status)) return;
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
      .filter((event) => event.end.getTime() >= now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 4);
  }, [events]);

  const handleSelectEvent = useCallback((event: HearingCalendarEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  const eventPropGetter = useCallback((event: HearingCalendarEvent) => {
    const style =
      STATUS_STYLES[event.status] ?? STATUS_STYLES[EventStatus.SCHEDULED];
    return {
      style: {
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
        borderRadius: "8px",
        borderWidth: "2px",
        borderStyle: "solid",
        fontWeight: 600,
        padding: "4px 8px",
        cursor: "pointer",
      },
    };
  }, []);

  const selectedParticipant = useMemo(() => {
    if (!selectedEvent || !userId) return null;
    return (
      selectedEvent.participants?.find(
        (participant) => participant.userId === userId,
      ) ?? null
    );
  }, [selectedEvent, userId]);

  const canRespondInvite =
    selectedEvent?.status === EventStatus.PENDING_CONFIRMATION &&
    !!selectedParticipant;

  const handleRespondInvite = useCallback(
    async (response: EventInviteResponse) => {
      if (!selectedEvent || !selectedParticipant) return;
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
        setDetailOpen(false);
        setSelectedEvent(null);
      } catch (error) {
        console.error("Failed to respond to hearing invitation:", error);
        toast.error("Could not submit your response.");
      } finally {
        setResponding(null);
      }
    },
    [fetchEvents, selectedEvent, selectedParticipant],
  );

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
    if (message.length < 10) {
      toast.error("Please provide at least 10 characters for your response.");
      return;
    }

    try {
      setSubmittingInfo(true);
      await provideDisputeInfo(selectedCase.disputeId, { message });
      toast.success("Additional information submitted.");
      setInfoResponseDraft("");
      await fetchEvents();
    } catch (error) {
      console.error("Failed to provide dispute info:", error);
      toast.error("Could not submit additional information.");
    } finally {
      setSubmittingInfo(false);
    }
  }, [fetchEvents, infoResponseDraft, selectedCase]);

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
          New dispute created:{" "}
          <span className="font-semibold">#{createdDisputeId.slice(0, 8)}</span>
          .
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-slate-50 text-sm text-slate-600">
            Click any hearing event to view details, respond invite, or join
            hearing room.
          </div>
          <div className="px-4 pb-4">
            <div className="h-[600px] interdev-calendar">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%" }}
                views={["month", "week", "day", "agenda"]}
                date={date}
                view={view}
                onNavigate={setDate}
                onView={(nextView) => setView(nextView as CalendarViewType)}
                eventPropGetter={eventPropGetter}
                onSelectEvent={handleSelectEvent}
                toolbar
                popup
                showMultiDayTimes
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
                    <div className="font-medium text-slate-900 truncate">
                      {event.title}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${EVENT_TYPE_BADGE_STYLE[event.type]}`}
                    >
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {format(event.start, "MMM d, h:mm a")} -{" "}
                    {statusLabelMap[event.status]}
                  </div>
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
                "min-h-[40px] rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
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
                "min-h-[40px] rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
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
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
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
                submittingInfo={submittingInfo}
                canceling={cancelingDispute}
                onProposalStartChange={handleProposalStartChange}
                onProposalEndChange={handleProposalEndChange}
                onProposalNoteChange={setProposalNote}
                onInfoResponseChange={setInfoResponseDraft}
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

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedEvent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title ?? "Event details"}</DialogTitle>
            <DialogDescription>
              {selectedEvent
                ? format(selectedEvent.start, "MMM d, yyyy - h:mm a")
                : "Hearing schedule"}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Status
                </p>
                <p className="font-medium text-slate-900">
                  {statusLabelMap[selectedEvent.status]}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Time
                </p>
                <p className="font-medium text-slate-900">
                  {format(selectedEvent.start, "h:mm a")} -{" "}
                  {format(selectedEvent.end, "h:mm a")}
                </p>
              </div>
              {selectedParticipant && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Your response
                  </p>
                  <p className="font-medium text-slate-900">
                    {selectedParticipant.status.replaceAll("_", " ")}
                  </p>
                </div>
              )}
              {selectedEvent.externalMeetingLink && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Meeting link
                  </p>
                  <a
                    href={selectedEvent.externalMeetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Open meeting link
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-wrap gap-2 sm:gap-0">
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
            {selectedHearingId &&
              selectedEvent &&
              isActiveStatus(selectedEvent.status) && (
                <button
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                  onClick={() => {
                    setDetailOpen(false);
                    navigate(`${roleBasePath}/hearings/${selectedHearingId}`);
                  }}
                >
                  Join hearing room
                </button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .interdev-calendar .rbc-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .interdev-calendar .rbc-toolbar-label {
          font-weight: 600;
          color: #0f172a;
        }
        .interdev-calendar .rbc-header {
          padding: 10px 8px;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .interdev-calendar .rbc-time-view,
        .interdev-calendar .rbc-month-view {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .interdev-calendar .rbc-today {
          background-color: #f0fdfa !important;
        }
        .interdev-calendar .rbc-event-content {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};
