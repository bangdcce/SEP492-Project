import type { SettlementAttemptsSummary } from "@/features/disputes/types/dispute.types";

type OfferComposerProps = {
  amountToFreelancer: string;
  amountToClient: string;
  terms: string;
  loading?: boolean;
  summary?: SettlementAttemptsSummary | null;
  onAmountToFreelancerChange: (value: string) => void;
  onAmountToClientChange: (value: string) => void;
  onTermsChange: (value: string) => void;
  onSubmit: () => void;
};

export const OfferComposer = ({
  amountToFreelancer,
  amountToClient,
  terms,
  loading = false,
  summary,
  onAmountToFreelancerChange,
  onAmountToClientChange,
  onTermsChange,
  onSubmit,
}: OfferComposerProps) => {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Propose settlement</h4>
      <p className="mt-1 text-xs text-slate-600">
        Enter how the escrow should be split. The two amounts must match the escrow total.
      </p>

      {summary && (
        <p className="mt-2 text-[11px] text-slate-500">
          Attempts left: raiser {summary.raiserRemaining}, defendant {summary.defendantRemaining}.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-600">
          <span>Amount to freelancer (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountToFreelancer}
            onChange={(event) => onAmountToFreelancerChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-600">
          <span>Amount to client (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountToClient}
            onChange={(event) => onAmountToClientChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </label>
      </div>

      <label className="mt-2 block space-y-1 text-xs text-slate-600">
        <span>Terms (optional)</span>
        <textarea
          rows={3}
          value={terms}
          onChange={(event) => onTermsChange(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Explain conditions for this offer..."
        />
      </label>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="min-h-[40px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send offer"}
        </button>
      </div>
    </div>
  );
};
