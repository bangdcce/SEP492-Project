import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Gavel,
  Loader2,
  Search,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { cn } from "@/shared/components/ui/utils";
import { sectionCardClass, panelTitleClass } from "./constants";
import { issueHearingVerdict } from "@/features/hearings/api";
import { MoneySplitSlider } from "@/features/disputes/components/shared/MoneySplitSlider";
import {
  getDisputeRuleCatalog,
  type DisputeRuleCatalogItem,
} from "@/features/disputes/api";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { INTERNAL_DEV_TOOLS_ENABLED } from "@/shared/utils/internalTools";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

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
] as const;

const FAULTY_PARTIES = [
  { value: "raiser", label: "Dispute raiser" },
  { value: "defendant", label: "Dispute defendant" },
  { value: "both", label: "Both dispute parties" },
  { value: "none", label: "No party at fault" },
] as const;

const VERDICT_RESULTS = [
  {
    value: "WIN_CLIENT",
    label: "Award to raiser",
    color: "border-sky-500 bg-sky-50 text-sky-800",
  },
  {
    value: "WIN_FREELANCER",
    label: "Award to defendant",
    color: "border-emerald-500 bg-emerald-50 text-emerald-800",
  },
  {
    value: "SPLIT",
    label: "Split",
    color: "border-amber-500 bg-amber-50 text-amber-800",
  },
] as const;

const SAMPLE_FACTUAL_FINDINGS =
  "Based on the signed scope, milestone history, hearing statements, and platform logs, the responsible party did not satisfy the agreed deliverable obligations within the confirmed timeline. The record shows unresolved defects and no approved scope change that would excuse the missed delivery baseline.";
const SAMPLE_LEGAL_ANALYSIS =
  "Under the InterDev dispute policy and contract record, the party that failed to deliver conforming work within the accepted scope bears primary contractual fault. The evidence chain is internally consistent, platform notice was sufficient, and no stronger contradictory record displaced the verified timeline.";
const SAMPLE_CONCLUSION =
  "The claim is substantiated and the requested financial disposition should be granted accordingly.";
const SAMPLE_ADMIN_COMMENT =
  "Verdict issued from the hearing record with policy-backed reasoning.";
const SAMPLE_MINUTES_SUMMARY =
  "Hearing completed with both sides heard, evidence reviewed, and verdict reasoning finalized.";
const SAMPLE_MINUTES_FINDINGS =
  "Minutes record the key factual findings, policy basis, and the final disposition prepared from the hearing evidence.";
const SAMPLE_NO_SHOW_NOTE =
  "Required participant attendance and no-show status were documented from the hearing roster.";
const SAMPLE_EVIDENCE_BASIS =
  "Hearing statements, platform logs, signed scope records, milestone submission history.";

interface InHearingVerdictPanelProps {
  hearingId: string;
  disputedAmount?: number;
  disputeCategory?: string | null;
  onVerdictIssued: () => void;
}

type PanelErrorState = {
  code?: string;
  message: string;
  unmetChecklist?: string[];
  unmetChecklistDetails?: string[];
  details?: string[];
};

const FACTUAL_MIN_LENGTH = 20;
const LEGAL_MIN_LENGTH = 20;
const CONCLUSION_MIN_LENGTH = 10;
const ADMIN_COMMENT_MIN_LENGTH = 5;

const CHECKLIST_LABELS: Record<string, string> = {
  hearingSessionActive: "Hearing is active",
  deliberationPhase: "Dispute is in deliberation",
  moderatorPresent: "Moderator presence confirmed",
  minutesPrepared: "Minutes are prepared",
  noShowDocumentation: "No-show documentation is complete",
  attendanceValidated: "Attendance validation passed",
};

const getFieldCounterTone = (valid: boolean, hasValue: boolean) => {
  if (valid) {
    return "text-emerald-600";
  }
  if (hasValue) {
    return "text-amber-600";
  }
  return "text-slate-400";
};

const parseApiErrorPayload = (error: unknown): PanelErrorState => {
  const details = getApiErrorDetails(error, "Failed to issue hearing verdict.");

  if (axios.isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as {
      code?: string;
      message?: string;
      details?: string[];
      errors?: string[];
      unmetChecklist?: string[];
      unmetChecklistDetails?: string[];
    };

    const mergedDetails = [
      ...(Array.isArray(payload.details) ? payload.details : []),
      ...(Array.isArray(payload.errors) ? payload.errors : []),
    ];

    return {
      code: details.code ?? payload.code,
      message: details.message,
      details: mergedDetails.length > 0 ? mergedDetails : undefined,
      unmetChecklist: Array.isArray(payload.unmetChecklist)
        ? payload.unmetChecklist
        : undefined,
      unmetChecklistDetails: Array.isArray(payload.unmetChecklistDetails)
        ? payload.unmetChecklistDetails
        : undefined,
    };
  }

  return {
    code: details.code,
    message: details.message,
  };
};

export const InHearingVerdictPanel = memo(function InHearingVerdictPanel({
  hearingId,
  disputedAmount,
  disputeCategory,
  onVerdictIssued,
}: InHearingVerdictPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [result, setResult] = useState<string>("");
  const [faultType, setFaultType] = useState("");
  const [faultyParty, setFaultyParty] = useState("");

  const [policyCatalog, setPolicyCatalog] = useState<DisputeRuleCatalogItem[]>([]);
  const [policySearch, setPolicySearch] = useState("");
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);

  const [evidenceBasis, setEvidenceBasis] = useState("");
  const [factualFindings, setFactualFindings] = useState("");
  const [legalAnalysis, setLegalAnalysis] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [adminComment, setAdminComment] = useState("");

  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [noShowNote, setNoShowNote] = useState("");
  const [forceEnd, setForceEnd] = useState(false);

  const [splitRatioClient, setSplitRatioClient] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<PanelErrorState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCatalogs = async () => {
      try {
        setCatalogLoading(true);
        const rules = await getDisputeRuleCatalog({
          faultType: faultType || undefined,
          disputeCategory: disputeCategory || undefined,
          result: result || undefined,
        });
        if (cancelled) {
          return;
        }
        setPolicyCatalog(rules);
        setSelectedPolicies((previous) =>
          previous.filter((code) => rules.some((rule) => rule.code === code)),
        );
      } catch (error) {
        console.error("Failed to load dispute policy catalog:", error);
        if (!cancelled) {
          toast.error("Could not load dispute policy catalog.");
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      cancelled = true;
    };
  }, [disputeCategory, faultType, result]);

  const totalAmount = useMemo(() => disputedAmount ?? 0, [disputedAmount]);
  const policyMap = useMemo(
    () => new Map(policyCatalog.map((item) => [item.code, item])),
    [policyCatalog],
  );

  const filteredPolicies = useMemo(() => {
    const query = policySearch.trim().toLowerCase();
    if (!query) {
      return policyCatalog.slice(0, 8);
    }
    return policyCatalog
      .filter((item) =>
        [item.code, item.title, item.summary].some((value) =>
          value.toLowerCase().includes(query),
        ),
      )
      .slice(0, 8);
  }, [policyCatalog, policySearch]);

  const factualLength = factualFindings.trim().length;
  const legalLength = legalAnalysis.trim().length;
  const conclusionLength = conclusion.trim().length;
  const evidenceBasisLength = evidenceBasis.trim().length;
  const adminCommentLength = adminComment.trim().length;
  const summaryLength = summary.trim().length;
  const findingsLength = findings.trim().length;

  const evidenceBasisValid = evidenceBasisLength > 0;
  const factualValid = factualLength >= FACTUAL_MIN_LENGTH;
  const legalValid = legalLength >= LEGAL_MIN_LENGTH;
  const conclusionValid = conclusionLength >= CONCLUSION_MIN_LENGTH;
  const adminCommentValid = adminCommentLength >= ADMIN_COMMENT_MIN_LENGTH;

  const coreReasoningValid =
    factualValid &&
    legalValid &&
    conclusionValid &&
    evidenceBasisValid;

  const verdictInputValid =
    Boolean(result) &&
    Boolean(faultType) &&
    Boolean(faultyParty) &&
    selectedPolicies.length >= 1 &&
    coreReasoningValid &&
    adminCommentValid;

  const minutesValid = summaryLength > 0 && findingsLength > 0;
  const isValid = verdictInputValid && minutesValid;

  const missingRequirements = useMemo(() => {
    const items: string[] = [];

    if (!result) items.push("Choose a verdict result");
    if (!faultType) items.push("Choose a fault type");
    if (!faultyParty) items.push("Choose a faulty party");
    if (selectedPolicies.length < 1) items.push("Select at least 1 violated policy");
    if (!evidenceBasisValid) items.push("Add evidence basis / references");
    if (!factualValid) items.push(`Factual findings need at least ${FACTUAL_MIN_LENGTH} characters`);
    if (!legalValid) items.push(`Legal analysis needs at least ${LEGAL_MIN_LENGTH} characters`);
    if (!conclusionValid) items.push(`Conclusion needs at least ${CONCLUSION_MIN_LENGTH} characters`);
    if (!adminCommentValid) {
      items.push(`Admin comment needs at least ${ADMIN_COMMENT_MIN_LENGTH} characters`);
    }
    if (summaryLength < 1) items.push("Add hearing minutes summary");
    if (findingsLength < 1) items.push("Add hearing minutes findings");

    return items;
  }, [
    adminCommentValid,
    conclusionValid,
    evidenceBasisValid,
    factualValid,
    faultType,
    faultyParty,
    findingsLength,
    legalValid,
    result,
    selectedPolicies.length,
    summaryLength,
  ]);

  const togglePolicy = useCallback((code: string) => {
    setSelectedPolicies((prev) =>
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code],
    );
  }, []);

  const handleFaultTypeChange = useCallback((value: string) => {
    setFaultType(value);
    if (value === "MUTUAL_FAULT") {
      setFaultyParty("both");
      setResult("SPLIT");
    } else if (value === "NO_FAULT") {
      setFaultyParty("none");
      setResult("SPLIT");
    }
  }, []);

  const fillValidSample = useCallback(() => {
    const firstPolicy = policyCatalog[0]?.code;

    setResult((prev) => prev || "WIN_CLIENT");
    handleFaultTypeChange("NON_DELIVERY");
    setFaultyParty((prev) => prev || "defendant");
    if (firstPolicy) {
      setSelectedPolicies((prev) => (prev.includes(firstPolicy) ? prev : [firstPolicy]));
    }
    setEvidenceBasis((prev) => prev.trim() || SAMPLE_EVIDENCE_BASIS);
    setFactualFindings((prev) =>
      prev.trim().length >= FACTUAL_MIN_LENGTH ? prev : SAMPLE_FACTUAL_FINDINGS,
    );
    setLegalAnalysis((prev) =>
      prev.trim().length >= LEGAL_MIN_LENGTH ? prev : SAMPLE_LEGAL_ANALYSIS,
    );
    setConclusion((prev) =>
      prev.trim().length >= CONCLUSION_MIN_LENGTH ? prev : SAMPLE_CONCLUSION,
    );
    setAdminComment((prev) =>
      prev.trim().length >= ADMIN_COMMENT_MIN_LENGTH ? prev : SAMPLE_ADMIN_COMMENT,
    );
    setSummary((prev) => (prev.trim().length > 0 ? prev : SAMPLE_MINUTES_SUMMARY));
    setFindings((prev) => (prev.trim().length > 0 ? prev : SAMPLE_MINUTES_FINDINGS));
    setNoShowNote((prev) => (prev.trim().length > 0 ? prev : SAMPLE_NO_SHOW_NOTE));
    setPanelError(null);
  }, [handleFaultTypeChange, policyCatalog]);

  const submitVerdict = useCallback(async () => {
    if (!isValid) {
      toast.error("Please complete required verdict and minutes fields.");
      return;
    }

    try {
      setSubmitting(true);
      setPanelError(null);

      await issueHearingVerdict(hearingId, {
        verdict: {
          result,
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
          splitRatioClient: result === "SPLIT" ? splitRatioClient : undefined,
        },
        closeHearing: {
          summary: summary.trim(),
          findings: findings.trim(),
          forceEnd: forceEnd || undefined,
          noShowNote: noShowNote.trim() || undefined,
        },
      });

      toast.success("Verdict issued and hearing minutes finalized.");
      setConfirmOpen(false);
      onVerdictIssued();
    } catch (error) {
      const parsed = parseApiErrorPayload(error);
      setPanelError(parsed);
      toast.error(parsed.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    adminComment,
    conclusion,
    evidenceBasis,
    factualFindings,
    faultType,
    faultyParty,
    findings,
    forceEnd,
    hearingId,
    isValid,
    legalAnalysis,
    noShowNote,
    onVerdictIssued,
    result,
    selectedPolicies,
    splitRatioClient,
    summary,
  ]);

  return (
    <section className={cn(sectionCardClass, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div>
          <h3 className={panelTitleClass}>In-Hearing Verdict</h3>
          <p className="mt-1 text-sm text-slate-500">
            Issue the verdict directly from the hearing record using the canonical
            policy catalog.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 p-2 text-slate-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded ? (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                This panel closes the hearing and issues the verdict in one transaction.
                Use canonical policy codes only.
              </div>
            </div>
            {INTERNAL_DEV_TOOLS_ENABLED ? (
              <button
                type="button"
                onClick={fillValidSample}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Fill Sample
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {VERDICT_RESULTS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setResult(item.value)}
                className={cn(
                  "rounded-xl border-2 px-4 py-4 text-left transition-colors",
                  result === item.value
                    ? item.color
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                <div className="text-sm font-semibold">{item.label}</div>
              </button>
            ))}
          </div>

          {result === "SPLIT" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h4 className="text-sm font-semibold text-slate-900">Money Split</h4>
              <div className="mt-4">
                <MoneySplitSlider
                  totalAmount={totalAmount}
                  onChange={(split) => setSplitRatioClient(split.clientPercent)}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
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

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-900">Violated Policies</h4>
            </div>
            <input
              value={policySearch}
              onChange={(event) => setPolicySearch(event.target.value)}
              placeholder="Search policy by code, title, or summary"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <div className="mt-3 grid gap-2">
              {catalogLoading ? (
                <div className="text-sm text-slate-500">Loading policy catalog...</div>
              ) : (
                filteredPolicies.map((policy) => {
                  const selected = selectedPolicies.includes(policy.code);
                  return (
                    <button
                      key={policy.code}
                      type="button"
                      onClick={() => togglePolicy(policy.code)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-teal-300 bg-teal-50"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {policy.code}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {policy.title}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{policy.summary}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedPolicies.length === 0 ? (
                <span className="text-sm text-slate-500">No policy selected yet.</span>
              ) : (
                selectedPolicies.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800"
                  >
                    {policyMap.get(code)?.title || code}
                    <button type="button" onClick={() => togglePolicy(code)}>
                      x
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Evidence Basis / References
              </label>
              <textarea
                rows={2}
                value={evidenceBasis}
                onChange={(event) => setEvidenceBasis(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="State the evidence basis, testimony, or platform logs relied on."
              />
              <div className="mt-1 text-right text-xs text-slate-500">
                {evidenceBasisValid ? "Required field completed" : "Required"}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Factual Findings
              </label>
              <textarea
                rows={4}
                value={factualFindings}
                onChange={(event) => setFactualFindings(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
              <div
                className={cn(
                  "mt-1 text-right text-xs",
                  getFieldCounterTone(factualValid, factualLength > 0),
                )}
              >
                {factualLength}/{FACTUAL_MIN_LENGTH} characters
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Legal Analysis
              </label>
              <textarea
                rows={4}
                value={legalAnalysis}
                onChange={(event) => setLegalAnalysis(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
              <div
                className={cn(
                  "mt-1 text-right text-xs",
                  getFieldCounterTone(legalValid, legalLength > 0),
                )}
              >
                {legalLength}/{LEGAL_MIN_LENGTH} characters
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Conclusion
              </label>
              <textarea
                rows={3}
                value={conclusion}
                onChange={(event) => setConclusion(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
              <div
                className={cn(
                  "mt-1 text-right text-xs",
                  getFieldCounterTone(conclusionValid, conclusionLength > 0),
                )}
              >
                {conclusionLength}/{CONCLUSION_MIN_LENGTH} characters
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Admin Comment
              </label>
              <textarea
                rows={2}
                value={adminComment}
                onChange={(event) => setAdminComment(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
              <div
                className={cn(
                  "mt-1 text-right text-xs",
                  getFieldCounterTone(adminCommentValid, adminCommentLength > 0),
                )}
              >
                {adminCommentLength}/{ADMIN_COMMENT_MIN_LENGTH} characters
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="text-sm font-semibold text-slate-900">Hearing Minutes</h4>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Summary
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                Findings
              </label>
              <textarea
                rows={3}
                value={findings}
                onChange={(event) => setFindings(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                No-show Note
              </label>
              <textarea
                rows={2}
                value={noShowNote}
                onChange={(event) => setNoShowNote(event.target.value)}
                className="block w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={forceEnd}
                onChange={(event) => setForceEnd(event.target.checked)}
              />
              Force-close unanswered questions if the gate still allows finalization.
            </label>
          </div>

          {panelError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="font-semibold">{panelError.message}</div>
              {panelError.details?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {panelError.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
              {panelError.unmetChecklist?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {panelError.unmetChecklist.map((item) => (
                    <li key={item}>{CHECKLIST_LABELS[item] || item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {!isValid ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Issue Verdict is still locked</div>
              <ul className="mt-2 list-disc pl-5">
                {missingRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <div className="text-right text-xs text-slate-500">
              {selectedPolicies.length} policy
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!isValid || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gavel className="h-4 w-4" />
              )}
              Issue Verdict
            </button>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Issue verdict and close hearing?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will finalize the current hearing session and submit the verdict
                  using the selected policy catalog items.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <ul className="space-y-1">
                  <li>Result: {result || "-"}</li>
                  <li>Fault type: {faultType || "-"}</li>
                  <li>Faulty party: {faultyParty || "-"}</li>
                  <li>Policies: {selectedPolicies.join(", ") || "-"}</li>
                </ul>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void submitVerdict()}
                  disabled={submitting}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {submitting ? "Submitting..." : "Confirm Verdict"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </section>
  );
});

export default InHearingVerdictPanel;
