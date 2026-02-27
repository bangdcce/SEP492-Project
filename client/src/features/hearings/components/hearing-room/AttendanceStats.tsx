import { memo } from "react";
import { sectionCardClass, panelTitleClass } from "./constants";

interface AttendanceStatsProps {
  attendance:
    | {
        totals: {
          presentOnlineCount?: number;
          presentEverJoinedCount?: number;
          presentCount?: number;
          lateCount: number;
          veryLateCount: number;
          noShowCount: number;
        };
      }
    | null
    | undefined;
}

export const AttendanceStats = memo(function AttendanceStats({
  attendance,
}: AttendanceStatsProps) {
  if (!attendance) {
    return (
      <div className={sectionCardClass}>
        <p className={panelTitleClass}>Attendance</p>
        <p className="mt-1 text-xs text-slate-400">
          Visible for staff/admin only.
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: "Online",
      value: attendance.totals.presentOnlineCount ?? 0,
      color: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    {
      label: "Joined",
      value:
        attendance.totals.presentEverJoinedCount ??
        attendance.totals.presentCount ??
        0,
      color: "border-sky-200 bg-sky-50 text-sky-800",
    },
    {
      label: "Late",
      value: attendance.totals.lateCount + attendance.totals.veryLateCount,
      color: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "No-show",
      value: attendance.totals.noShowCount,
      color: "border-rose-200 bg-rose-50 text-rose-800",
    },
  ];

  return (
    <div className={sectionCardClass}>
      <p className={panelTitleClass}>Attendance</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-lg border p-2 text-center ${s.color}`}
          >
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
});
