import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { DisputeSettlement } from "@/features/disputes/types/dispute.types";

type PendingOfferDecisionCardProps = {
  settlement: DisputeSettlement;
  loading?: boolean;
  onAccept: (settlementId: string) => void;
  onReject: (settlementId: string, reason: string) => void;
};

export const PendingOfferDecisionCard = ({
  settlement,
  loading = false,
  onAccept,
  onReject,
}: PendingOfferDecisionCardProps) => {
  const [reason, setReason] = useState("");
  const expiresInText = useMemo(() => {
    if (!settlement.expiresAt) return "No expiry";
    const date = new Date(settlement.expiresAt);
    if (Number.isNaN(date.getTime())) return "No expiry";
    return formatDistanceToNow(date, { addSuffix: true });
  }, [settlement.expiresAt]);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Required now: respond to offer</h4>
      <p className="mt-1 text-xs text-slate-600">
        Offer split: ${settlement.amountToFreelancer} to freelancer, ${settlement.amountToClient} to
        client.
      </p>
      <p className="mt-1 text-xs text-amber-700">Expires {expiresInText}.</p>

      <textarea
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
        placeholder="Reason (required if you reject)"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onAccept(settlement.id)}
          disabled={loading}
          className="min-h-[40px] flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Accept offer
        </button>
        <button
          type="button"
          onClick={() => onReject(settlement.id, reason)}
          disabled={loading || reason.trim().length < 5}
          className="min-h-[40px] flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Reject offer
        </button>
      </div>
    </div>
  );
};
