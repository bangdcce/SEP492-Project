import { Inbox, Loader2 } from "lucide-react";
import type { SchedulingWorklistItem } from "@/features/disputes/types/dispute.types";
import { SchedulingCaseCard } from "./SchedulingCaseCard";

type SchedulingCaseListProps = {
  items: SchedulingWorklistItem[];
  selectedDisputeId?: string;
  loading?: boolean;
  degraded?: boolean;
  degradedMessage?: string;
  onSelect: (disputeId: string) => void;
};

export const SchedulingCaseList = ({
  items,
  selectedDisputeId,
  loading = false,
  degraded = false,
  degradedMessage,
  onSelect,
}: SchedulingCaseListProps) => {
  const newCount = items.filter((item) => item.isNew).length;
  const actionCount = items.filter((item) => item.requiresAction).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Dispute Cases</h3>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
            {items.length}
          </span>
          {actionCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
              {actionCount} action
            </span>
          )}
          {newCount > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal-700">
              {newCount} new
            </span>
          )}
        </div>
      </div>

      {degraded && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {degradedMessage ||
            "Some scheduling metadata is unavailable. Case list may be partial until migration is completed."}
        </div>
      )}

      <div className="p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="mt-2">Loading cases...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-slate-100 p-2.5">
              <Inbox className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-600">
              No active cases
            </p>
            <p className="mt-0.5 max-w-[200px] text-xs text-slate-400">
              No disputes in scheduling workflow right now.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
            {items.map((item) => (
              <SchedulingCaseCard
                key={item.disputeId}
                item={item}
                isActive={selectedDisputeId === item.disputeId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
