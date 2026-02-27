/**
 * InHearingVerdictPanel - Hearing-scoped verdict flow.
 * Verdict is issued from Hearing Room and hearing is closed in the same transaction.
 */

import { memo, useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Gavel,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { cn } from "@/shared/components/ui/utils";
import { sectionCardClass, panelTitleClass } from "./constants";
import { issueHearingVerdict } from "@/features/hearings/api";
import { MoneySplitSlider } from "@/features/disputes/components/shared/MoneySplitSlider";
import { getApiErrorDetails } from "@/shared/utils/apiError";
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
];

const FAULTY_PARTIES = [
  { value: "raiser", label: "Raiser (Nguyen don)" },
  { value: "defendant", label: "Defendant (Bi don)" },
  { value: "both", label: "Both parties" },
  { value: "none", label: "No fault" },
];

const VERDICT_RESULTS = [
  {
    value: "WIN_CLIENT",
    label: "Refund Client",
    color: "border-sky-500 bg-sky-50 text-sky-800",
  },
  {
    value: "WIN_FREELANCER",
    label: "Pay Freelancer",
    color: "border-emerald-500 bg-emerald-50 text-emerald-800",
  },
  {
    value: "SPLIT",
    label: "Split",
    color: "border-amber-500 bg-amber-50 text-amber-800",
  },
];

const POLICY_SUGGESTIONS = [
  "TOS-3.2: Delivery obligations were not met by the responsible party.",
  "SLA-2.1: Service quality did not satisfy the accepted milestone criteria.",
  "EVID-1.4: Submitted records conflict with verified hearing evidence.",
];

const SAMPLE_FACTUAL_FINDINGS =
  "Based on signed scope documents, milestone acceptance records, hearing statements, and message chronology, the responsible party did not deliver the agreed output within the confirmed timeframe. The submitted files did not satisfy the defined acceptance criteria and key requirements remained unresolved after multiple reminders.";
const SAMPLE_LEGAL_ANALYSIS =
  "Under platform terms and dispute policy, a party that fails to deliver conforming work within the agreed schedule bears primary contractual fault. The evidence chain is internally consistent, no approved scope change justifies the delay, and no force majeure record was provided. Therefore liability is established on the responsible party.";
const SAMPLE_CONCLUSION =
  "The claim is substantiated and refund-side relief is warranted.";
const SAMPLE_ADMIN_COMMENT =
  "Verdict issued from hearing with evidence-backed reasoning.";
const SAMPLE_MINUTES_SUMMARY =
  "Hearing session completed with both sides heard, evidence reviewed, and final determination prepared.";
const SAMPLE_MINUTES_FINDINGS =
  "Minutes confirm breach of delivery and quality obligations by the responsible party; verdict follows documented evidence and policy criteria.";
const SAMPLE_NO_SHOW_NOTE =
  "Required participant absence documented by timeline evidence and moderator confirmation.";

interface InHearingVerdictPanelProps {
  hearingId: string;
  disputedAmount?: number;
  onVerdictIssued: () => void;
}

type PanelErrorState = {
  code?: string;
  message: string;
  unmetChecklist?: string[];
  unmetChecklistDetails?: string[];
  details?: string[];
};

const POLICY_FORMAT = /^[A-Z0-9]+-\d+(?:\.\d+)*:\s.+/;
const FACTUAL_MIN_LENGTH = 100;
const LEGAL_MIN_LENGTH = 100;
const CONCLUSION_MIN_LENGTH = 50;

const CHECKLIST_LABELS: Record<string, string> = {
  hearingSessionActive: "Hearing is active",
  deliberationPhase: "Dispute is in deliberation",
  moderatorPresent: "Moderator presence confirmed",
  minutesPrepared: "Minutes are prepared",
  noShowDocumentation: "No-show documentation is complete",
  attendanceValidated: "Attendance validation passed",
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
  onVerdictIssued,
}: InHearingVerdictPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [result, setResult] = useState<string>("");
  const [faultType, setFaultType] = useState("");
  const [faultyParty, setFaultyParty] = useState("");

  const [violatedPolicies, setViolatedPolicies] = useState<string[]>([]);
  const [policyDraft, setPolicyDraft] = useState("");

  const [factualFindings, setFactualFindings] = useState("");
  const [legalAnalysis, setLegalAnalysis] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [adminComment, setAdminComment] = useState("");

  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [noShowNote, setNoShowNote] = useState("");
  const [pendingActionDraft, setPendingActionDraft] = useState("");
  const [pendingActions, setPendingActions] = useState<string[]>([]);
  const [forceEnd, setForceEnd] = useState(false);

  const [splitRatioClient, setSplitRatioClient] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<PanelErrorState | null>(null);

  const totalAmount = useMemo(() => disputedAmount ?? 0, [disputedAmount]);

  const factualLength = factualFindings.trim().length;
  const legalLength = legalAnalysis.trim().length;
  const conclusionLength = conclusion.trim().length;
  const invalidPolicies = violatedPolicies.filter(
    (policy) => !POLICY_FORMAT.test(policy.trim()),
  );

  const coreReasoningValid =
    factualLength >= FACTUAL_MIN_LENGTH &&
    legalLength >= LEGAL_MIN_LENGTH &&
    conclusionLength >= CONCLUSION_MIN_LENGTH;

  const verdictInputValid =
    Boolean(result) &&
    Boolean(faultType) &&
    Boolean(faultyParty) &&
    violatedPolicies.length >= 1 &&
    invalidPolicies.length === 0 &&
    coreReasoningValid &&
    adminComment.trim().length >= 5;

  const minutesValid = summary.trim().length > 0 && findings.trim().length > 0;

  const isValid = verdictInputValid && minutesValid;

  const appendPolicy = useCallback((rawPolicy: string) => {
    const value = rawPolicy.trim();
    if (!value) return;
    setViolatedPolicies((prev) => {
      if (prev.some((item) => item.toLowerCase() === value.toLowerCase())) {
        return prev;
      }
      return [...prev, value];
    });
  }, []);

  const addPolicy = useCallback(() => {
    appendPolicy(policyDraft);
    setPolicyDraft("");
  }, [appendPolicy, policyDraft]);

  const removePolicy = useCallback((policy: string) => {
    setViolatedPolicies((prev) => prev.filter((item) => item !== policy));
  }, []);

  const addPendingAction = useCallback(() => {
    const value = pendingActionDraft.trim();
    if (!value) return;
    setPendingActions((prev) => {
      if (prev.some((item) => item.toLowerCase() === value.toLowerCase())) {
        return prev;
      }
      return [...prev, value];
    });
    setPendingActionDraft("");
  }, [pendingActionDraft]);

  const removePendingAction = useCallback((action: string) => {
    setPendingActions((prev) => prev.filter((item) => item !== action));
  }, []);

  const fillValidSample = useCallback(() => {
    setResult((prev) => prev || "WIN_CLIENT");
    setFaultType((prev) => prev || "NON_DELIVERY");
    setFaultyParty((prev) => prev || "defendant");
    appendPolicy(POLICY_SUGGESTIONS[0]);

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
      prev.trim().length >= 5 ? prev : SAMPLE_ADMIN_COMMENT,
    );
    setSummary((prev) => (prev.trim().length > 0 ? prev : SAMPLE_MINUTES_SUMMARY));
    setFindings((prev) => (prev.trim().length > 0 ? prev : SAMPLE_MINUTES_FINDINGS));
    setNoShowNote((prev) => (prev.trim().length > 0 ? prev : SAMPLE_NO_SHOW_NOTE));
    setPanelError(null);
  }, [appendPolicy]);

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
            violatedPolicies,
            factualFindings: factualFindings.trim(),
            legalAnalysis: legalAnalysis.trim(),
            conclusion: conclusion.trim(),
          },
          splitRatioClient: result === "SPLIT" ? splitRatioClient : undefined,
        },
        closeHearing: {
          summary: summary.trim(),
          findings: findings.trim(),
          pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
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
    isValid,
    hearingId,
    result,
    adminComment,
    faultType,
    faultyParty,
    violatedPolicies,
    factualFindings,
    legalAnalysis,
    conclusion,
    splitRatioClient,
    summary,
    findings,
    pendingActions,
    forceEnd,
    noShowNote,
    onVerdictIssued,
  ]);

  const handleOpenConfirm = useCallback(() => {
    if (!isValid) {
      toast.error("Please complete required verdict and minutes fields.");
      return;
    }
    setConfirmOpen(true);
  }, [isValid]);

  const selectClasses =
    "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-300 focus:border-amber-400 outline-none";
  const textareaClasses =
    "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-amber-300 focus:border-amber-400 outline-none placeholder-slate-400";
  const labelClasses = "block text-xs font-medium text-slate-700 mb-1";

  return (
    <div className={cn(sectionCardClass, "border-amber-200 bg-amber-50/30")}>
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-amber-700" />
          <span className={cn(panelTitleClass, "text-amber-800")}>Issue Verdict</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600" />
        )}
      </button>

      {!expanded && (
        <p className="text-xs text-amber-700 mt-1">
          DELIBERATION phase active. This flow will issue verdict and close hearing minutes in one step.
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={fillValidSample}
              className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-white px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
            >
              Fill valid sample
            </button>
          </div>

          <div>
            <label className={labelClasses}>Verdict Result *</label>
            <div className="flex gap-1.5">
              {VERDICT_RESULTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setResult(v.value)}
                  className={cn(
                    "flex-1 rounded-md border-2 px-2 py-2 text-xs font-medium transition-colors",
                    result === v.value
                      ? v.color + " ring-1 ring-offset-1"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {result === "SPLIT" && totalAmount > 0 && (
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <MoneySplitSlider
                totalAmount={totalAmount}
                onChange={(split) => setSplitRatioClient(split.clientPercent)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClasses}>Fault Type *</label>
              <select
                value={faultType}
                onChange={(e) => setFaultType(e.target.value)}
                className={selectClasses}
              >
                <option value="">Select...</option>
                {FAULT_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Faulty Party *</label>
              <select
                value={faultyParty}
                onChange={(e) => setFaultyParty(e.target.value)}
                className={selectClasses}
              >
                <option value="">Select...</option>
                {FAULTY_PARTIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses}>Violated Policies * (at least 1)</label>
            <div className="flex gap-1.5">
              <input
                value={policyDraft}
                onChange={(e) => setPolicyDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPolicy();
                  }
                }}
                placeholder="Example: CODE-1.1"
                className={selectClasses}
              />
              <button
                type="button"
                onClick={addPolicy}
                disabled={!policyDraft.trim()}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Required format: <b>CODE-1.1: Description</b>. At least one policy is mandatory for audit traceability.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {POLICY_SUGGESTIONS.map((policy) => (
                <button
                  key={policy}
                  type="button"
                  onClick={() => appendPolicy(policy)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  + {policy}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {violatedPolicies.length === 0 ? (
                <p className="text-[11px] text-rose-600">At least one policy is required.</p>
              ) : (
                violatedPolicies.map((policy) => (
                  <span
                    key={policy}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                  >
                    {policy}
                    <button
                      type="button"
                      onClick={() => removePolicy(policy)}
                      className="text-amber-700 hover:text-amber-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            {violatedPolicies.length > 0 && invalidPolicies.length > 0 && (
              <p className="mt-1 text-[11px] text-rose-600">
                Policy format must be like <b>CODE-1.1: Description</b>.
              </p>
            )}
          </div>

          <div>
            <label className={labelClasses}>Factual Findings *</label>
            <textarea
              rows={2}
              value={factualFindings}
              onChange={(e) => setFactualFindings(e.target.value)}
              className={textareaClasses}
              placeholder="Key facts and evidence..."
            />
            {factualLength < FACTUAL_MIN_LENGTH && (
              <p className="mt-1 text-[11px] text-rose-600">
                At least {FACTUAL_MIN_LENGTH} characters (current: {factualLength}).
              </p>
            )}
          </div>
          <div>
            <label className={labelClasses}>Legal Analysis *</label>
            <textarea
              rows={2}
              value={legalAnalysis}
              onChange={(e) => setLegalAnalysis(e.target.value)}
              className={textareaClasses}
              placeholder="Reasoning behind this verdict..."
            />
            {legalLength < LEGAL_MIN_LENGTH && (
              <p className="mt-1 text-[11px] text-rose-600">
                At least {LEGAL_MIN_LENGTH} characters (current: {legalLength}).
              </p>
            )}
          </div>
          <div>
            <label className={labelClasses}>Conclusion *</label>
            <textarea
              rows={2}
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              className={textareaClasses}
              placeholder="Final conclusion..."
            />
            {conclusionLength < CONCLUSION_MIN_LENGTH && (
              <p className="mt-1 text-[11px] text-rose-600">
                At least {CONCLUSION_MIN_LENGTH} characters (current: {conclusionLength}).
              </p>
            )}
          </div>
          <div>
            <label className={labelClasses}>Admin Comment *</label>
            <textarea
              rows={1}
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              className={textareaClasses}
              placeholder="Short summary for audit..."
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-2.5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Close hearing minutes
            </p>
            <div>
              <label className={labelClasses}>Summary *</label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className={textareaClasses}
                placeholder="Session summary for official record..."
              />
            </div>
            <div>
              <label className={labelClasses}>Findings *</label>
              <textarea
                rows={2}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                className={textareaClasses}
                placeholder="Key findings supporting this verdict..."
              />
            </div>
            <div>
              <label className={labelClasses}>No-show note (if required party absent)</label>
              <textarea
                rows={1}
                value={noShowNote}
                onChange={(e) => setNoShowNote(e.target.value)}
                className={textareaClasses}
                placeholder="Document no-show context if applicable..."
              />
            </div>
            <div>
              <label className={labelClasses}>Pending actions (optional)</label>
              <div className="flex gap-1.5">
                <input
                  value={pendingActionDraft}
                  onChange={(e) => setPendingActionDraft(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addPendingAction();
                    }
                  }}
                  className={selectClasses}
                  placeholder="Add pending action..."
                />
                <button
                  type="button"
                  onClick={addPendingAction}
                  disabled={!pendingActionDraft.trim()}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
              {pendingActions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pendingActions.map((action) => (
                    <span
                      key={action}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                    >
                      {action}
                      <button
                        type="button"
                        onClick={() => removePendingAction(action)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={forceEnd}
                onChange={(e) => setForceEnd(e.target.checked)}
                className="rounded border-slate-300"
              />
              Force end hearing even with pending questions
            </label>
          </div>

          {panelError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <p className="font-semibold inline-flex items-center gap-1">
                <CircleAlert className="h-3.5 w-3.5" />
                {panelError.code ? `${panelError.code}: ${panelError.message}` : panelError.message}
              </p>

              {Array.isArray(panelError.unmetChecklist) && panelError.unmetChecklist.length > 0 && (
                <ul className="mt-2 list-disc pl-4">
                  {panelError.unmetChecklist.map((item) => (
                    <li key={item}>{CHECKLIST_LABELS[item] || item}</li>
                  ))}
                </ul>
              )}

              {Array.isArray(panelError.unmetChecklistDetails) &&
                panelError.unmetChecklistDetails.length > 0 && (
                  <ul className="mt-2 list-disc pl-4">
                    {panelError.unmetChecklistDetails.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}

              {Array.isArray(panelError.details) && panelError.details.length > 0 && (
                <ul className="mt-2 list-disc pl-4">
                  {panelError.details.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenConfirm}
            disabled={!isValid || submitting}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
              isValid && !submitting
                ? "bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed",
            )}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gavel className="h-4 w-4" />
            )}
            {submitting ? "Submitting..." : "Issue Verdict & Close Hearing"}
          </button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Final Verdict</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  This will issue the verdict and immediately end the hearing with recorded minutes.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Result: {result || "-"}</li>
                  <li>Policies: {violatedPolicies.join(", ") || "-"}</li>
                  <li>Summary: {summary.trim().slice(0, 100) || "-"}</li>
                  <li>Findings: {findings.trim().slice(0, 100) || "-"}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void submitVerdict();
              }}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submitting ? "Submitting..." : "Confirm and issue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
