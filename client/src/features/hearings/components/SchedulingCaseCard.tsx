import {
  Clock,
  AlertCircle,
  CalendarCheck,
  MessageSquareWarning,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchedulingWorklistItem } from "@/features/disputes/types/dispute.types";

type SchedulingCaseCardProps = {
  item: SchedulingWorklistItem;
  isActive: boolean;
  onSelect: (disputeId: string) => void;
};

const statusBadgeStyle = (status: string) => {
  switch (status) {
    case "TRIAGE_PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "PREVIEW":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "INFO_REQUESTED":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "IN_MEDIATION":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "PENDING_REVIEW":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const actionIcon = (actionType: SchedulingWorklistItem["actionType"]) => {
  switch (actionType) {
    case "CONFIRM_HEARING":
      return <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />;
    case "PROVIDE_INFO":
      return <MessageSquareWarning className="h-3.5 w-3.5 text-orange-600" />;
    case "PROPOSE_SLOT":
      return <Clock className="h-3.5 w-3.5 text-blue-600" />;
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-slate-400" />;
  }
};

const actionLabel = (actionType: SchedulingWorklistItem["actionType"]) => {
  switch (actionType) {
    case "CONFIRM_HEARING":
      return "Confirm hearing";
    case "PROVIDE_INFO":
      return "Action required";
    case "PROPOSE_SLOT":
      return "Needs your slot";
    default:
      return "Waiting staff";
  }
};

const actionChipStyle = (actionType: SchedulingWorklistItem["actionType"]) => {
  switch (actionType) {
    case "CONFIRM_HEARING":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PROVIDE_INFO":
      return "bg-red-50 text-red-700 border-red-200";
    case "PROPOSE_SLOT":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const resolveDirectionText = (item: SchedulingWorklistItem) => {
  const raiser = item.raiserName || "Unknown";
  const defendant = item.defendantName || "Unknown";

  if (item.perspective === "RAISER") {
    return `You filed against ${defendant}`;
  }

  if (item.perspective === "DEFENDANT") {
    return `${raiser} filed against you`;
  }

  return `${raiser} vs ${defendant}`;
};

export const SchedulingCaseCard = ({
  item,
  isActive,
  onSelect,
}: SchedulingCaseCardProps) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.disputeId)}
      className={cn(
        "group w-full rounded-xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
        isActive
          ? "border-teal-300 bg-teal-50/60 shadow-sm ring-1 ring-teal-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
      )}
      aria-pressed={isActive}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">
            {item.projectTitle || "Untitled project"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">
              {item.displayCode}
            </span>
            {item.category ? ` - ${item.category}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {item.isNew && (
            <span className="inline-flex items-center rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white">
              NEW
            </span>
          )}
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-colors",
              isActive
                ? "text-teal-500"
                : "text-slate-300 group-hover:text-slate-400",
            )}
          />
        </div>
      </div>

      <div className="mt-1.5 text-xs text-slate-600">
        {resolveDirectionText(item)}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {item.counterpartyName || "Counterparty unknown"}
        {item.counterpartyRole ? ` (${item.counterpartyRole})` : ""}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        Staff: {item.assignedStaffName || item.assignedStaffEmail || "Pending assignment"}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            statusBadgeStyle(item.status),
          )}
          title={item.status}
        >
          {item.status.replaceAll("_", " ")}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            actionChipStyle(item.actionType),
          )}
        >
          {actionIcon(item.actionType)}
          {actionLabel(item.actionType)}
        </span>
      </div>
    </button>
  );
};
