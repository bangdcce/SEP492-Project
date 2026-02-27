/**
 * Hearing Room — Shared constants, helpers, and style tokens
 * ─────────────────────────────────────────────────────────────
 * Courtroom-inspired design system:
 *   Primary:  slate-900 / slate-800  (navy / authority)
 *   Accent:   amber-600 / amber-500  (gold / judicial)
 *   Success:  emerald-600            (online / positive)
 *   Danger:   rose-600               (destructive actions)
 *   Neutral:  slate-100…slate-700    (backgrounds, text)
 */

import type {
  HearingParticipantRole,
  SpeakerRole,
} from "@/features/hearings/types";
import type { DisputeMessage } from "@/features/disputes/types/dispute.types";

/* ────────── Local types shared across sub-components ────────── */

export type LocalMessage = DisputeMessage & {
  status?: "sending" | "sent" | "delivered" | "error";
};

export type MobilePane = "dossier" | "main" | "control";
export type DossierTab = "overview" | "spec" | "timeline";
export type ControlTab = "participants" | "evidence";
export type PaneLayout = [number, number, number];

export type UnifiedTimelineItem =
  | {
      kind: "message";
      id: string;
      occurredAt: string;
      sortAt: number;
      message: LocalMessage;
    }
  | {
      kind: "statement";
      id: string;
      occurredAt: string;
      sortAt: number;
      statement: import("@/features/hearings/types").HearingStatementSummary;
    }
  | {
      kind: "question";
      id: string;
      occurredAt: string;
      sortAt: number;
      question: import("@/features/hearings/types").HearingQuestionSummary;
    }
  | {
      kind: "verdict";
      id: string;
      occurredAt: string;
      sortAt: number;
      verdictResult: string;
      adjudicatorName?: string;
    };

/* ────────── Layout persistence ────────── */

const LEGACY_LAYOUT_KEY = "hearing-room-layout-v2";
const LAYOUT_KEY = "hearing-room-layout-v4";
export const DEFAULT_LAYOUT: PaneLayout = [22, 53, 25];

const parseLayout = (raw: unknown): PaneLayout | null => {
  if (Array.isArray(raw) && raw.length === 3 && raw.every(Number.isFinite)) {
    return [Number(raw[0]), Number(raw[1]), Number(raw[2])];
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const mid =
      typeof record.main === "number" ? record.main : record.conversation;
    if (
      typeof record.dossier === "number" &&
      typeof mid === "number" &&
      typeof record.control === "number"
    ) {
      return [record.dossier, mid, record.control];
    }
  }
  return null;
};

export const loadLayout = (): PaneLayout => {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const saved = window.localStorage.getItem(LAYOUT_KEY);
    const parsed = saved ? parseLayout(JSON.parse(saved)) : null;
    if (parsed) return parsed;
  } catch {
    /* ignore */
  }
  try {
    const legacy = window.localStorage.getItem(LEGACY_LAYOUT_KEY);
    const parsedLegacy = legacy ? parseLayout(JSON.parse(legacy)) : null;
    if (parsedLegacy) {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(parsedLegacy));
      return parsedLegacy;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYOUT;
};

export const saveLayout = (layout: unknown) => {
  if (typeof window === "undefined") return;
  const parsed = parseLayout(layout);
  if (parsed) window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(parsed));
};

/* ────────── Evidence helpers ────────── */

export const EVIDENCE_TAG_REGEX = /#EVD-([A-Za-z0-9-]+)/g;
export const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const isImage = (mimeType?: string | null) =>
  Boolean(mimeType && IMAGE_TYPES.has(mimeType));
export const isPdf = (mimeType?: string | null) =>
  mimeType === "application/pdf";

export const parseTags = (content?: string | null) => {
  if (!content) return [] as string[];
  const ids = new Set<string>();
  for (const m of content.matchAll(EVIDENCE_TAG_REGEX)) if (m[1]) ids.add(m[1]);
  return Array.from(ids);
};

export const extractEvidenceId = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : null;
  const evidence =
    root.evidence && typeof root.evidence === "object"
      ? (root.evidence as Record<string, unknown>)
      : null;
  const dataEvidence =
    data?.evidence && typeof data.evidence === "object"
      ? (data.evidence as Record<string, unknown>)
      : null;
  const hit = [root.id, data?.id, evidence?.id, dataEvidence?.id].find(
    (x) => typeof x === "string" && x.trim().length > 0,
  );
  return typeof hit === "string" ? hit : null;
};

/* ────────── Time helpers ────────── */

export const toMs = (value?: string | null) => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

/** Relative time string like "2m ago", "1h ago", "just now" */
export const relativeTime = (value?: string | Date | null): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/* ────────── Role / Label helpers ────────── */

export const roleLabel = (role?: HearingParticipantRole | string | null) =>
  role ? String(role).replace(/_/g, " ") : "Participant";

export const speakerLabel = (role?: SpeakerRole | null) => {
  if (!role) return "Not set";
  const map: Record<string, string> = {
    ALL: "Open floor",
    MODERATOR_ONLY: "Moderator only",
    RAISER_ONLY: "Raiser only",
    DEFENDANT_ONLY: "Defendant only",
    WITNESS_ONLY: "Witness only",
    OBSERVER_ONLY: "Observer only",
    MUTED_ALL: "Muted",
  };
  return map[role] || role;
};

export const speakerDescription = (role: SpeakerRole) => {
  const map: Record<string, string> = {
    ALL: "All participants may send messages freely.",
    MODERATOR_ONLY: "Only the moderator can send messages.",
    RAISER_ONLY: "Only the dispute raiser may speak.",
    DEFENDANT_ONLY: "Only the defendant may speak.",
    WITNESS_ONLY: "Only witnesses may speak (e.g. broker testimony).",
    OBSERVER_ONLY: "Only observers may speak (intermediary support).",
    MUTED_ALL: "All participants are muted. No messages allowed.",
  };
  return map[role] || "";
};

/* ────────── Courtroom colour tokens ────────── */

/** Role-based colours — reduced from ~10 families to 5 */
export const roleBadgeClass = (role?: string | null) => {
  if (role === "MODERATOR") return "border-slate-400 bg-slate-800 text-white";
  if (role === "RAISER") return "border-sky-400 bg-sky-700 text-white";
  if (role === "DEFENDANT") return "border-rose-400 bg-rose-700 text-white";
  if (role === "OBSERVER")
    return "border-slate-300 bg-slate-200 text-slate-700";
  if (role === "WITNESS") return "border-amber-400 bg-amber-100 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-600";
};

/** Lighter badge variant for inline use in timeline */
export const roleBadgeLightClass = (role?: string | null) => {
  if (role === "MODERATOR")
    return "border-slate-300 bg-slate-100 text-slate-800";
  if (role === "RAISER") return "border-sky-200 bg-sky-50 text-sky-800";
  if (role === "DEFENDANT") return "border-rose-200 bg-rose-50 text-rose-800";
  if (role === "OBSERVER") return "border-slate-200 bg-slate-50 text-slate-600";
  if (role === "WITNESS") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

/** Hearing status badge — courtroom palette */
export const hearingStatusBadgeClass = (status?: string | null) => {
  if (status === "IN_PROGRESS")
    return "border-emerald-400 bg-emerald-600 text-white";
  if (status === "PAUSED") return "border-amber-400 bg-amber-500 text-white";
  if (status === "SCHEDULED") return "border-sky-300 bg-sky-100 text-sky-800";
  if (status === "CANCELED") return "border-rose-400 bg-rose-600 text-white";
  if (status === "COMPLETED") return "border-slate-400 bg-slate-600 text-white";
  return "border-slate-300 bg-slate-100 text-slate-700";
};

/** Avatar background colour by role */
export const avatarBgClass = (role?: string | null) => {
  if (role === "MODERATOR") return "bg-slate-800 text-white";
  if (role === "RAISER") return "bg-sky-700 text-white";
  if (role === "DEFENDANT") return "bg-rose-700 text-white";
  if (role === "OBSERVER") return "bg-slate-400 text-white";
  if (role === "WITNESS") return "bg-amber-600 text-white";
  return "bg-slate-500 text-white";
};

/** Get initials from a name */
export const getInitials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ────────── Shared card classes (courtroom style) ────────── */

export const cardClass =
  "rounded-lg border border-slate-200 bg-white shadow-sm";
export const sectionCardClass =
  "rounded-lg border border-slate-200 bg-slate-50/80 p-3";
export const panelTitleClass =
  "text-base font-semibold uppercase tracking-wider text-slate-500";
