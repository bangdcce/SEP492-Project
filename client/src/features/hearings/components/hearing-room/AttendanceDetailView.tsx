import React, { memo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
} from "lucide-react";
import type { HearingAttendanceSummary } from "@/features/hearings/types";
import { sectionCardClass, panelTitleClass } from "./constants";

interface AttendanceDetailViewProps {
  attendance: HearingAttendanceSummary | null | undefined;
}

/* ─── Status helpers ─── */

const statusConfig: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  PRESENT: { icon: CheckCircle, color: "text-emerald-600", label: "Present" },
  ON_TIME: { icon: CheckCircle, color: "text-emerald-600", label: "On Time" },
  LATE: { icon: Clock, color: "text-amber-600", label: "Late" },
  VERY_LATE: {
    icon: AlertTriangle,
    color: "text-orange-600",
    label: "Very Late",
  },
  NO_SHOW: { icon: XCircle, color: "text-rose-600", label: "No Show" },
  ABSENT: { icon: XCircle, color: "text-rose-600", label: "Absent" },
};

function getStatusConfig(status?: string) {
  if (!status) return { icon: Clock, color: "text-slate-400", label: "" };
  return (
    statusConfig[status.toUpperCase()] ?? {
      icon: Clock,
      color: "text-slate-400",
      label: status,
    }
  );
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtMinutes(min: number | undefined): string {
  if (min == null) return "—";
  if (min < 1) return "<1m";
  return `${Math.round(min)}m`;
}

/* ─── Role badge ─── */

const roleBadgeClass: Record<string, string> = {
  MODERATOR: "bg-amber-100 text-amber-800 border-amber-200",
  RAISER: "bg-blue-100 text-blue-800 border-blue-200",
  DEFENDANT: "bg-purple-100 text-purple-800 border-purple-200",
  WITNESS: "bg-teal-100 text-teal-800 border-teal-200",
  OBSERVER: "bg-slate-100 text-slate-600 border-slate-200",
};

/* ─── Component ─── */

export const AttendanceDetailView = memo(function AttendanceDetailView({
  attendance,
}: AttendanceDetailViewProps) {
  const [expanded, setExpanded] = useState(false);

  if (!attendance || !attendance.participants?.length) return null;

  const { totals, participants } = attendance;

  /* Sort: required first, then by role, then by name */
  const sorted = [...participants].sort((a, b) => {
    if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    const nameA = a.user?.fullName ?? a.userId;
    const nameB = b.user?.fullName ?? b.userId;
    return nameA.localeCompare(nameB);
  });

  return (
    <div className={sectionCardClass}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between"
      >
        <p className={panelTitleClass}>Attendance Details</p>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wider text-slate-500">
            <span>
              Total:{" "}
              <b className="text-slate-700">{totals.totalParticipants}</b>
            </span>
            <span>
              Required:{" "}
              <b className="text-slate-700">{totals.requiredParticipants}</b>
            </span>
            <span>
              Avg:{" "}
              <b className="text-slate-700">
                {fmtMinutes(totals.averageAttendanceMinutes)}
              </b>
            </span>
            {attendance.requiredAttendanceMinutes != null && (
              <span>
                Min req:{" "}
                <b className="text-slate-700">
                  {attendance.requiredAttendanceMinutes}m
                </b>
              </span>
            )}
          </div>

          {/* Participant list */}
          <div className="space-y-1.5">
            {sorted.map((p) => {
              const cfg = getStatusConfig(p.attendanceStatus);
              const Icon = cfg.icon;
              const badge = roleBadgeClass[p.role] ?? roleBadgeClass.OBSERVER;
              const name =
                p.user?.fullName ?? p.user?.email ?? p.userId.slice(0, 8);

              return (
                <div
                  key={p.participantId}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
                >
                  {/* Avatar placeholder */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                  </div>

                  {/* Name + role */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-800">
                        {name}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${badge}`}
                      >
                        {p.role}
                      </span>
                      {p.isRequired && (
                        <span className="text-[9px] font-medium text-rose-500">
                          REQ
                        </span>
                      )}
                    </div>

                    {/* Times row */}
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                      <span>Joined: {fmtTime(p.joinedAt)}</span>
                      <span>Left: {fmtTime(p.leftAt)}</span>
                      <span>
                        Online:{" "}
                        {fmtMinutes(
                          p.totalOnlineMinutes ?? p.attendanceMinutes,
                        )}
                      </span>
                      {(p.lateMinutes ?? 0) > 0 && (
                        <span className="text-amber-600">
                          Late: {fmtMinutes(p.lateMinutes)}
                        </span>
                      )}
                    </div>

                    {/* Attendance progress bar */}
                    {attendance.requiredAttendanceMinutes != null &&
                      attendance.requiredAttendanceMinutes > 0 &&
                      (() => {
                        const mins =
                          p.totalOnlineMinutes ?? p.attendanceMinutes ?? 0;
                        const reqMins = attendance.requiredAttendanceMinutes!;
                        const pct = Math.min(
                          100,
                          Math.round((mins / reqMins) * 100),
                        );
                        const met = mins >= reqMins;
                        return (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${met ? "bg-emerald-500" : pct > 50 ? "bg-amber-400" : "bg-rose-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span
                              className={`text-[9px] font-semibold uppercase ${met ? "text-emerald-600" : "text-slate-400"}`}
                            >
                              {met ? "Met" : `${pct}%`}
                            </span>
                          </div>
                        );
                      })()}
                  </div>

                  {/* Status badge */}
                  <div
                    className={`flex items-center gap-1 ${cfg.color}`}
                    title={cfg.label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{cfg.label}</span>
                  </div>

                  {/* Online indicator */}
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${p.isOnline ? "bg-emerald-500" : "bg-slate-300"}`}
                    title={p.isOnline ? "Online" : "Offline"}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
