import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Scale } from "lucide-react";
import { MoneySplitSlider } from "../shared/MoneySplitSlider";
import { DisputeResult } from "../../../staff/types/staff.types";
import { resolveDispute, resolveDisputeAppeal } from "../../api";
import { toast } from "sonner";

const FAULT_TYPES = [
  { value: "NON_DELIVERY", label: "Non-delivery" },
  { value: "QUALITY_MISMATCH", label: "Quality mismatch" },
  { value: "DEADLINE_MISSED", label: "Deadline missed" },
  { value: "GHOSTING", label: "Ghosting" },
  { value: "SCOPE_CHANGE_CONFLICT", label: "Scope change conflict" },
  { value: "PAYMENT_ISSUE", label: "Payment issue" },
  { value: "FRAUD", label: "Fraud" },
  { value: "MUTUAL_FAULT", label: "Mutual fault" },
  { value: "NO_FAULT", label: "No fault" },
  { value: "OTHER", label: "Other" },
];

const FAULTY_PARTIES = [
  { value: "raiser", label: "Raiser" },
  { value: "defendant", label: "Defendant" },
  { value: "both", label: "Both parties" },
  { value: "none", label: "No fault" },
];

interface VerdictWizardProps {
  disputeId: string;
  disputedAmount?: number;
  mode?: "initial" | "appeal";
  existingVerdictId?: string;
  appealContext?: string;
  onSubmitted?: () => void | Promise<void>;
}

type VerdictGateErrorPayload = {
  message?: string;
  checklist?: Record<string, boolean>;
  unmetChecklist?: string[];
  unmetChecklistDetails?: string[];
};

const VERDICT_GATE_LABELS: Record<string, string> = {
  completedHearing: "At least one completed hearing",
  hearingMinutes: "Hearing minutes (summary + findings)",
  attendanceEvidence: "Attendance evidence",
};

export const VerdictWizard = ({
  disputeId,
  disputedAmount,
  mode = "initial",
  existingVerdictId,
  appealContext,
  onSubmitted,
}: VerdictWizardProps) => {
  const [verdict, setVerdict] = useState<DisputeResult | null>(null);
  const [faultType, setFaultType] = useState<string>("");
  const [faultyParty, setFaultyParty] = useState<string>("");
  const [violatedPolicies, setViolatedPolicies] = useState<string>("");
  const [factualFindings, setFactualFindings] = useState<string>("");
  const [legalAnalysis, setLegalAnalysis] = useState<string>("");
  const [conclusion, setConclusion] = useState<string>("");
  const [adminComment, setAdminComment] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [splitRatioClient, setSplitRatioClient] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const [verdictGateError, setVerdictGateError] =
    useState<VerdictGateErrorPayload | null>(null);

  const totalAmount = useMemo(() => disputedAmount ?? 0, [disputedAmount]);
  const isAppealMode = mode === "appeal";

  const computedAmounts = useMemo(() => {
    if (verdict === DisputeResult.WIN_CLIENT) {
      return { amountToClient: totalAmount, amountToFreelancer: 0 };
    }
    if (verdict === DisputeResult.WIN_FREELANCER) {
      return { amountToClient: 0, amountToFreelancer: totalAmount };
    }
    if (verdict === DisputeResult.SPLIT) {
      const amountToClient = Number(
        ((totalAmount * splitRatioClient) / 100).toFixed(2),
      );
      return {
        amountToClient,
        amountToFreelancer: Number((totalAmount - amountToClient).toFixed(2)),
      };
    }
    return { amountToClient: 0, amountToFreelancer: 0 };
  }, [splitRatioClient, totalAmount, verdict]);

  const handleSubmit = async () => {
    if (!verdict) {
      toast.error("Select a verdict first.");
      return;
    }
    if (!faultType || !faultyParty) {
      toast.error("Fault type and faulty party are required.");
      return;
    }
    if (!factualFindings.trim() || !legalAnalysis.trim() || !conclusion.trim()) {
      toast.error("Complete the reasoning section.");
      return;
    }
    if (!adminComment.trim()) {
      toast.error("Admin comment is required.");
      return;
    }
    if (isAppealMode && !existingVerdictId) {
      toast.error("Appeal verdict requires the original verdict reference.");
      return;
    }
    if (isAppealMode && !overrideReason.trim()) {
      toast.error("Override reason is required for appeal resolution.");
      return;
    }

    const policies = violatedPolicies
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
      setVerdictGateError(null);

      if (isAppealMode) {
        await resolveDisputeAppeal(disputeId, {
          result: verdict,
          adminComment: adminComment.trim(),
          faultType,
          faultyParty,
          reasoning: {
            violatedPolicies: policies,
            factualFindings: factualFindings.trim(),
            legalAnalysis: legalAnalysis.trim(),
            conclusion: conclusion.trim(),
          },
          amountToFreelancer: computedAmounts.amountToFreelancer,
          amountToClient: computedAmounts.amountToClient,
          overridesVerdictId: existingVerdictId!,
          overrideReason: overrideReason.trim(),
        });
        toast.success("Appeal verdict submitted.");
      } else {
        await resolveDispute(disputeId, {
          verdict,
          adminComment: adminComment.trim(),
          faultType,
          faultyParty,
          reasoning: {
            violatedPolicies: policies,
            factualFindings: factualFindings.trim(),
            legalAnalysis: legalAnalysis.trim(),
            conclusion: conclusion.trim(),
          },
          splitRatioClient:
            verdict === DisputeResult.SPLIT ? splitRatioClient : undefined,
        });
        toast.success("Verdict submitted.");
      }

      if (onSubmitted) {
        await onSubmitted();
      }
    } catch (error) {
      console.error("Failed to submit verdict:", error);
      const apiError = error as {
        response?: {
          status?: number;
          data?: VerdictGateErrorPayload;
        };
      };
      const isGateBlocked =
        apiError?.response?.status === 409 &&
        Array.isArray(apiError?.response?.data?.unmetChecklist);

      if (isGateBlocked) {
        const payload = apiError.response?.data ?? {};
        setVerdictGateError(payload);
        toast.error(
          payload.message ||
            "Verdict is blocked until hearing completion and minutes requirements are met.",
        );
      } else {
        toast.error(
          isAppealMode ? "Could not submit appeal verdict." : "Could not submit verdict.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {isAppealMode ? "Appeal Verdict" : "Official Verdict"}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {isAppealMode
              ? "Issue the Tier 2 decision that upholds or overrides the original verdict."
              : "Record the official dispute outcome and financial distribution."}
          </p>
        </div>
        {isAppealMode ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <Scale className="h-3.5 w-3.5" />
            Tier 2 Appeal Review
          </span>
        ) : null}
      </div>

      {isAppealMode ? (
        <div className="mb-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Original Verdict ID
            </p>
            <p className="font-medium text-amber-950">
              {existingVerdictId ?? "Missing original verdict reference"}
            </p>
          </div>
          {appealContext ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Appeal Context
              </p>
              <p className="whitespace-pre-wrap text-amber-950">{appealContext}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          onClick={() => setVerdict(DisputeResult.WIN_CLIENT)}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            verdict === DisputeResult.WIN_CLIENT
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-gray-200 text-gray-600 hover:border-slate-300"
          }`}
        >
          <div className="font-bold">Refund Client</div>
          <div className="mt-1 text-xs opacity-80">100% to Client</div>
        </button>

        <button
          onClick={() => setVerdict(DisputeResult.WIN_FREELANCER)}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            verdict === DisputeResult.WIN_FREELANCER
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-gray-200 text-gray-600 hover:border-teal-300"
          }`}
        >
          <div className="font-bold">Pay Freelancer</div>
          <div className="mt-1 text-xs opacity-80">100% to Freelancer</div>
        </button>

        <button
          onClick={() => setVerdict(DisputeResult.SPLIT)}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            verdict === DisputeResult.SPLIT
              ? "border-purple-600 bg-purple-600 text-white"
              : "border-gray-200 text-gray-600 hover:border-purple-300"
          }`}
        >
          <div className="font-bold">Split Verdict</div>
          <div className="mt-1 text-xs opacity-80">Custom %</div>
        </button>
      </div>

      {verdict === DisputeResult.SPLIT ? (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h4 className="mb-6 text-sm font-semibold text-gray-900">
            Adjust Distribution
          </h4>
          <MoneySplitSlider
            totalAmount={totalAmount}
            onChange={(split) => setSplitRatioClient(split.clientPercent)}
          />
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Fault Type
          </label>
          <select
            value={faultType}
            onChange={(event) => setFaultType(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-2 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          >
            <option value="">Select a fault type</option>
            {FAULT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Faulty Party
          </label>
          <select
            value={faultyParty}
            onChange={(event) => setFaultyParty(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-2 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          >
            <option value="">Select the faulty party</option>
            {FAULTY_PARTIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Violated Policies (comma-separated)
          </label>
          <input
            value={violatedPolicies}
            onChange={(event) => setViolatedPolicies(event.target.value)}
            placeholder="CODE-1.1, CODE-2.3"
            className="block w-full rounded-lg border border-gray-300 p-2 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Factual Findings
          </label>
          <textarea
            rows={3}
            value={factualFindings}
            onChange={(event) => setFactualFindings(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
            placeholder="Summarize key facts and evidence..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Legal Analysis
          </label>
          <textarea
            rows={3}
            value={legalAnalysis}
            onChange={(event) => setLegalAnalysis(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
            placeholder="Explain the reasoning behind this verdict..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Conclusion
          </label>
          <textarea
            rows={2}
            value={conclusion}
            onChange={(event) => setConclusion(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
            placeholder="State the final conclusion clearly..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Admin Comment
          </label>
          <textarea
            rows={2}
            value={adminComment}
            onChange={(event) => setAdminComment(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
            placeholder="Short summary for audit logs..."
          />
        </div>
        {isAppealMode ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-900">
              Override Reason
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
              placeholder="Explain why the Tier 1 verdict is upheld or overridden..."
            />
          </div>
        ) : null}
      </div>

      {verdictGateError ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            {verdictGateError.message ||
              "Verdict is blocked until required hearing checks are complete."}
          </p>
          {Array.isArray(verdictGateError.unmetChecklist) &&
          verdictGateError.unmetChecklist.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {verdictGateError.unmetChecklist.map((item) => (
                <li key={item}>{VERDICT_GATE_LABELS[item] || item}</li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(verdictGateError.unmetChecklistDetails) &&
          verdictGateError.unmetChecklistDetails.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {verdictGateError.unmetChecklistDetails.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!existingVerdictId && isAppealMode ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Original verdict reference is missing. Appeal resolution is disabled until
              the Tier 1 verdict can be loaded.
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex justify-end border-t border-gray-100 pt-6">
        <button
          disabled={!verdict || submitting || (isAppealMode && !existingVerdictId)}
          onClick={handleSubmit}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting
            ? "Submitting..."
            : isAppealMode
              ? "Submit Appeal Verdict"
              : "Submit Verdict"}
        </button>
      </div>
    </div>
  );
};
