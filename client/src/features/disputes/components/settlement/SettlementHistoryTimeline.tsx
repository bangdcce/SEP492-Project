import { format } from "date-fns";
import type { DisputeSettlement } from "@/features/disputes/types/dispute.types";

type SettlementHistoryTimelineProps = {
  settlements: DisputeSettlement[];
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "EXPIRED":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-white text-slate-600";
  }
};

export const SettlementHistoryTimeline = ({ settlements }: SettlementHistoryTimelineProps) => {
  if (!settlements.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No settlement offers yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {settlements.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(item.status)}`}
            >
              {item.status}
            </span>
            <span className="text-[11px] text-slate-500">
              {format(new Date(item.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            ${item.amountToFreelancer} freelancer / ${item.amountToClient} client
          </p>
          {item.rejectedReason && (
            <p className="mt-1 text-xs text-red-700">Reject reason: {item.rejectedReason}</p>
          )}
        </div>
      ))}
    </div>
  );
};
