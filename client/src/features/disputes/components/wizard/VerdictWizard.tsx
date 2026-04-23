import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FlaskConical,
  Loader2,
  Scale,
  Search,
} from "lucide-react";
import { MoneySplitSlider } from "../shared/MoneySplitSlider";
import { DisputeResult } from "../../../staff/types/staff.types";
import {
  getDisputeRuleCatalog,
  resolveDisputeAppeal,
  type DisputeRuleCatalogItem,
} from "../../api";
import { toast } from "sonner";
import { INTERNAL_DEV_TOOLS_ENABLED } from "@/shared/utils/internalTools";

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
  { value: "raiser", label: "Dispute raiser" },
  { value: "defendant", label: "Dispute defendant" },
  { value: "both", label: "Both dispute parties" },
  { value: "none", label: "No party at fault" },
];

const SAMPLE_APPEAL_VERDICT_COPY = {
  evidenceBasis:
    "Reviewed the Tier 1 hearing minutes, escrow ledger, milestone acceptance trail, dispute evidence uploads, and the filed appeal statement. The appeal record shows the original ruling understated unresolved delivery defects and the timing mismatch between milestone closure and acceptance evidence.",
  factualFindings:
    "The Tier 1 record confirms work was partially delivered, but the completion evidence remained inconsistent with the contractual acceptance checkpoints. Uploaded screenshots and the appeal narrative align with a pattern of incomplete handoff, unresolved revision comments, and no final acceptance event that would justify full release to the freelancer.",
  legalAnalysis:
    "Under the platform dispute standards, payout must track verified delivery, acceptance conditions, and proportional responsibility. The original verdict did not give enough weight to the unresolved acceptance gap and therefore requires modification on appeal. A split outcome better matches the proven work completed versus the verified deficiencies that remained outstanding.",
  conclusion:
    "The appeal is partially upheld. The Tier 1 verdict should be replaced with a split allocation that recognizes partial performance while preserving compensation for the unresolved delivery shortfall.",
  adminComment:
    "Appeal review completed. Tier 1 outcome adjusted after re-weighing hearing minutes, appeal reason, and acceptance evidence.",
  overrideReason:
    "The Tier 1 verdict is overridden because the appeal record establishes that the original analysis did not proportionally weigh the incomplete acceptance trail and unresolved delivery defects against the partial work that was actually provided.",
};

interface VerdictWizardProps {
  disputeId: string;
  disputedAmount?: number;
  disputeCategory?: string | null;
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

const normalizePolicyCatalog = (rules: unknown): DisputeRuleCatalogItem[] => {
  if (!Array.isArray(rules)) return [];

  return rules
    .filter(
      (item): item is Partial<DisputeRuleCatalogItem> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      code: String(item.code ?? "").trim(),
      title: String(item.title ?? "Untitled policy"),
      category:
        (item.category as DisputeRuleCatalogItem["category"] | undefined) ??
        "HEARING_CONDUCT",
      summary: String(item.summary ?? ""),
      legalBasis: Array.isArray(item.legalBasis)
        ? item.legalBasis.map((value) => String(value))
        : [],
      operationalGuidance: Array.isArray(item.operationalGuidance)
        ? item.operationalGuidance.map((value) => String(value))
        : [],
    }))
    .filter((item) => item.code.length > 0);
};

const VERDICT_GATE_LABELS: Record<string, string> = {
  completedHearing: "At least one completed hearing",
  hearingMinutes: "Hearing minutes (summary + findings)",
  attendanceEvidence: "Attendance evidence",
};

export const VerdictWizard = ({
  disputeId,
  disputedAmount,
  disputeCategory,
  mode = "initial",
  existingVerdictId,
  appealContext,
  onSubmitted,
}: VerdictWizardProps) => {
  const [verdict, setVerdict] = useState<DisputeResult | null>(null);
  const [faultType, setFaultType] = useState<string>("");
  const [faultyParty, setFaultyParty] = useState<string>("");
  const [policyCatalog, setPolicyCatalog] = useState<DisputeRuleCatalogItem[]>(
    [],
  );
  const [policySearch, setPolicySearch] = useState("");
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [evidenceBasis, setEvidenceBasis] = useState("");
  const [factualFindings, setFactualFindings] = useState<string>("");
  const [legalAnalysis, setLegalAnalysis] = useState<string>("");
  const [conclusion, setConclusion] = useState<string>("");
  const [adminComment, setAdminComment] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [splitRatioClient, setSplitRatioClient] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [sampleFillPending, setSampleFillPending] = useState(false);
  const [verdictGateError, setVerdictGateError] =
    useState<VerdictGateErrorPayload | null>(null);
  const sampleFillPendingRef = useRef(false);

  const totalAmount = useMemo(() => {
    const numericAmount = Number(disputedAmount);
    return Number.isFinite(numericAmount) ? numericAmount : 0;
  }, [disputedAmount]);
  const isAppealMode = mode === "appeal";
  const appealContextText = useMemo(() => {
    if (typeof appealContext === "string") return appealContext;
    if (appealContext == null) return "";

    try {
      return JSON.stringify(appealContext);
    } catch {
      return String(appealContext);
    }
  }, [appealContext]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const rules = await getDisputeRuleCatalog({
          faultType: faultType || undefined,
          disputeCategory: disputeCategory || undefined,
          result: verdict || undefined,
        });
        if (!cancelled) {
          const normalizedRules = normalizePolicyCatalog(rules);
          setPolicyCatalog(normalizedRules);
          if (sampleFillPendingRef.current) {
            setSelectedPolicies(
              normalizedRules.slice(0, 2).map((rule) => rule.code),
            );
            sampleFillPendingRef.current = false;
            setSampleFillPending(false);
          } else {
            setSelectedPolicies((previous) =>
              previous.filter((code) =>
                normalizedRules.some((rule) => rule.code === code),
              ),
            );
          }
        }
      } catch (error) {
        console.error("Failed to load dispute rule catalog:", error);
        if (!cancelled) {
          sampleFillPendingRef.current = false;
          setSampleFillPending(false);
          toast.error("Could not load dispute policy catalog.");
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [disputeCategory, faultType, verdict]);

  const filteredPolicies = useMemo(() => {
    const query = policySearch.trim().toLowerCase();
    if (!query) {
      return policyCatalog.slice(0, 8);
    }
    return policyCatalog
      .filter((item) =>
        [item.code, item.title, item.summary].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        ),
      )
      .slice(0, 8);
  }, [policyCatalog, policySearch]);

  const togglePolicy = (code: string) => {
    setSelectedPolicies((prev) =>
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code],
    );
  };

  const handleFaultTypeChange = (value: string) => {
    setFaultType(value);
    if (value === "MUTUAL_FAULT") {
      setFaultyParty("both");
      setVerdict(DisputeResult.SPLIT);
    } else if (value === "NO_FAULT") {
      setFaultyParty("none");
      setVerdict(DisputeResult.SPLIT);
    }
  };

  const fillAppealSample = () => {
    sampleFillPendingRef.current = true;
    setPolicySearch("");
    setVerdict(DisputeResult.SPLIT);
    setFaultType("QUALITY_MISMATCH");
    setFaultyParty("defendant");
    setSelectedPolicies([]);
    setSampleFillPending(true);
    setEvidenceBasis(SAMPLE_APPEAL_VERDICT_COPY.evidenceBasis);
    setFactualFindings(SAMPLE_APPEAL_VERDICT_COPY.factualFindings);
    setLegalAnalysis(SAMPLE_APPEAL_VERDICT_COPY.legalAnalysis);
    setConclusion(SAMPLE_APPEAL_VERDICT_COPY.conclusion);
    setAdminComment(SAMPLE_APPEAL_VERDICT_COPY.adminComment);
    setOverrideReason(SAMPLE_APPEAL_VERDICT_COPY.overrideReason);
    setSplitRatioClient(65);
  };

  const handleSubmit = async () => {
    if (!verdict) {
      toast.error("Select a verdict first.");
      return;
    }
    if (!faultType || !faultyParty) {
      toast.error("Fault type and faulty party are required.");
      return;
    }
    if (selectedPolicies.length === 0) {
      toast.error("Select at least one violated policy from the catalog.");
      return;
    }
    if (!evidenceBasis.trim()) {
      toast.error("Evidence basis is required.");
      return;
    }
    if (
      !factualFindings.trim() ||
      !legalAnalysis.trim() ||
      !conclusion.trim()
    ) {
      toast.error("Complete the reasoning section.");
      return;
    }
    if (!adminComment.trim()) {
      toast.error("Admin comment is required.");
      return;
    }
    if (!isAppealMode) {
      const payload = {
        message:
          "Initial verdicts must be issued from Hearing Room so minutes and hearing closure are recorded together.",
      };
      setVerdictGateError(payload);
      toast.error("Issue the initial verdict from Hearing Room.");
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
            violatedPolicies: selectedPolicies,
            factualFindings: factualFindings.trim(),
            legalAnalysis: legalAnalysis.trim(),
            conclusion: conclusion.trim(),
            evidenceReferences: [evidenceBasis.trim()],
          },
          splitRatioClient:
            verdict === DisputeResult.SPLIT ? splitRatioClient : undefined,
          overridesVerdictId: existingVerdictId!,
          overrideReason: overrideReason.trim(),
        });
        toast.success("Appeal verdict submitted.");
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
          isAppealMode
            ? "Could not submit appeal verdict."
            : "Could not submit verdict.",
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
              ? "Issue the final appeal decision that upholds or overrides the original verdict."
              : "Initial verdict issuance has moved to Hearing Room so the hearing can close with minutes and findings in one step."}
          </p>
        </div>
        {isAppealMode ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <Scale className="h-3.5 w-3.5" />
            Appeal Review
          </span>
        ) : null}
      </div>

      {!isAppealMode ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Use the Hearing Room verdict panel for initial verdicts. This wizard
          remains available only for appeal review so the platform does not
          bypass hearing minutes and closure requirements.
        </div>
      ) : null}

      {isAppealMode ? (
        <div className="mb-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Original Verdict ID
              </p>
              <p className="font-medium text-amber-950">
                {existingVerdictId ?? "Missing original verdict reference"}
              </p>
            </div>
            {INTERNAL_DEV_TOOLS_ENABLED ? (
              <button
                type="button"
                data-testid="appeal-verdict-fill-sample"
                onClick={fillAppealSample}
                disabled={submitting || sampleFillPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
              >
                {sampleFillPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="h-3.5 w-3.5" />
                )}
                {sampleFillPending ? "Loading sample..." : "Fill Sample"}
              </button>
            ) : null}
          </div>
          {appealContextText ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Appeal Context
              </p>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-white/80 p-3 text-sm leading-6 text-amber-950 whitespace-pre-wrap wrap-anywhere">
                {appealContextText}
              </div>
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
          <div className="font-bold">Award to Raiser</div>
          <div className="mt-1 text-xs opacity-80">Derived from escrow</div>
        </button>

        <button
          onClick={() => setVerdict(DisputeResult.WIN_FREELANCER)}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            verdict === DisputeResult.WIN_FREELANCER
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-gray-200 text-gray-600 hover:border-teal-300"
          }`}
        >
          <div className="font-bold">Award to Defendant</div>
          <div className="mt-1 text-xs opacity-80">Derived from escrow</div>
        </button>

        <button
          onClick={() => setVerdict(DisputeResult.SPLIT)}
          className={`rounded-xl border-2 p-4 text-center transition-all ${
            verdict === DisputeResult.SPLIT
              ? "border-amber-600 bg-amber-600 text-white"
              : "border-gray-200 text-gray-600 hover:border-amber-300"
          }`}
        >
          <div className="font-bold">Split Verdict</div>
          <div className="mt-1 text-xs opacity-80">1-99% to client</div>
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
            onChange={(event) => handleFaultTypeChange(event.target.value)}
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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-900">
              Violated Policies
            </h4>
          </div>
          <input
            value={policySearch}
            onChange={(event) => setPolicySearch(event.target.value)}
            placeholder="Search policy by code, title, or summary"
            className="mt-3 block w-full rounded-lg border border-gray-300 p-2 shadow-sm focus:border-teal-500 focus:ring-teal-500"
          />
          <div className="mt-3 grid gap-2">
            {catalogLoading ? (
              <div className="text-sm text-slate-500">
                Loading policy catalog...
              </div>
            ) : (
              filteredPolicies.map((policy) => {
                const selected = selectedPolicies.includes(policy.code);
                return (
                  <button
                    key={policy.code}
                    type="button"
                    onClick={() => togglePolicy(policy.code)}
                    className={`rounded-xl border p-3 text-left ${
                      selected
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {policy.code}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {policy.title}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {policy.summary}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-900">
            Evidence Basis / References
          </label>
          <textarea
            rows={2}
            value={evidenceBasis}
            onChange={(event) => setEvidenceBasis(event.target.value)}
            className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:ring-teal-500"
            placeholder="State the evidence basis, testimony, or platform logs relied on."
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

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {isAppealMode ? "Submit Appeal Verdict" : "Submit Verdict"}
        </button>
      </div>
    </div>
  );
};
