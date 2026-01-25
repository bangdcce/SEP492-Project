import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { MoneySplitSlider } from "../shared/MoneySplitSlider";
import { DisputeResult } from "../../../staff/types/staff.types";
import { resolveDispute } from "../../api";
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
}

export const VerdictWizard = ({ disputeId, disputedAmount }: VerdictWizardProps) => {
  const [verdict, setVerdict] = useState<DisputeResult | null>(null);
  const [faultType, setFaultType] = useState<string>("");
  const [faultyParty, setFaultyParty] = useState<string>("");
  const [violatedPolicies, setViolatedPolicies] = useState<string>("");
  const [factualFindings, setFactualFindings] = useState<string>("");
  const [legalAnalysis, setLegalAnalysis] = useState<string>("");
  const [conclusion, setConclusion] = useState<string>("");
  const [adminComment, setAdminComment] = useState<string>("");
  const [splitRatioClient, setSplitRatioClient] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = useMemo(() => disputedAmount ?? 0, [disputedAmount]);

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

    const policies = violatedPolicies
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
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
        splitRatioClient: verdict === DisputeResult.SPLIT ? splitRatioClient : undefined,
      });
      toast.success("Verdict submitted.");
    } catch (error) {
      console.error("Failed to submit verdict:", error);
      toast.error("Could not submit verdict.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">
        Official Verdict
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setVerdict(DisputeResult.WIN_CLIENT)}
          className={`p-4 rounded-xl border-2 text-center transition-all
                        ${
                          verdict === DisputeResult.WIN_CLIENT
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-gray-200 hover:border-slate-300 text-gray-600"
                        }
                    `}
        >
          <div className="font-bold">Refund Client</div>
          <div className="text-xs opacity-80 mt-1">100% to Client</div>
        </button>

        <button
          onClick={() => setVerdict(DisputeResult.WIN_FREELANCER)}
          className={`p-4 rounded-xl border-2 text-center transition-all
                         ${
                           verdict === DisputeResult.WIN_FREELANCER
                             ? "border-teal-600 bg-teal-600 text-white"
                             : "border-gray-200 hover:border-teal-300 text-gray-600"
                         }
                    `}
        >
          <div className="font-bold">Pay Freelancer</div>
          <div className="text-xs opacity-80 mt-1">100% to Freelancer</div>
        </button>

        <button
          onClick={() => setVerdict(DisputeResult.SPLIT)}
          className={`p-4 rounded-xl border-2 text-center transition-all
                         ${
                           verdict === DisputeResult.SPLIT
                             ? "border-purple-600 bg-purple-600 text-white"
                             : "border-gray-200 hover:border-purple-300 text-gray-600"
                         }
                    `}
        >
          <div className="font-bold">Split Verdict</div>
          <div className="text-xs opacity-80 mt-1">Custom %</div>
        </button>
      </div>

      {verdict === DisputeResult.SPLIT && (
        <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-6">
            Adjust Distribution
          </h4>
          <MoneySplitSlider
            totalAmount={totalAmount}
            onChange={(split) => setSplitRatioClient(split.clientPercent)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Fault Type
          </label>
          <select
            value={faultType}
            onChange={(event) => setFaultType(event.target.value)}
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-2"
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
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Faulty Party
          </label>
          <select
            value={faultyParty}
            onChange={(event) => setFaultyParty(event.target.value)}
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-2"
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
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Violated Policies (comma-separated)
          </label>
          <input
            value={violatedPolicies}
            onChange={(event) => setViolatedPolicies(event.target.value)}
            placeholder="CODE-1.1, CODE-2.3"
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Factual Findings
          </label>
          <textarea
            rows={3}
            value={factualFindings}
            onChange={(event) => setFactualFindings(event.target.value)}
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-3 placeholder-gray-400"
            placeholder="Summarize key facts and evidence..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Legal Analysis
          </label>
          <textarea
            rows={3}
            value={legalAnalysis}
            onChange={(event) => setLegalAnalysis(event.target.value)}
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-3 placeholder-gray-400"
            placeholder="Explain the reasoning behind this verdict..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Conclusion
          </label>
          <textarea
            rows={2}
            value={conclusion}
            onChange={(event) => setConclusion(event.target.value)}
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-3 placeholder-gray-400"
            placeholder="State the final conclusion clearly..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Admin Comment
          </label>
          <textarea
            rows={2}
            value={adminComment}
            onChange={(event) => setAdminComment(event.target.value)}
            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 border p-3 placeholder-gray-400"
            placeholder="Short summary for audit logs..."
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
        <button
          disabled={!verdict || submitting}
          onClick={handleSubmit}
          className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? "Submitting..." : "Submit Verdict"}
        </button>
      </div>
    </div>
  );
};
