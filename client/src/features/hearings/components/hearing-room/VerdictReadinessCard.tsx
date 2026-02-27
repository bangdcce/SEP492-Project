import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, XCircle } from "lucide-react";
import { getHearingVerdictReadiness } from "@/features/hearings/api";
import type { VerdictReadiness } from "@/features/hearings/types";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { cn } from "@/shared/components/ui/utils";
import { panelTitleClass, sectionCardClass } from "./constants";

interface VerdictReadinessCardProps {
  hearingId: string;
  hearingStatus?: string;
  disputePhase?: string;
}

const CHECKLIST_LABELS: Record<string, string> = {
  hearingSessionActive: "Hearing is active (IN_PROGRESS or PAUSED)",
  deliberationPhase: "Dispute phase is DELIBERATION",
  moderatorPresent: "Moderator presence validated",
  minutesPrepared: "Minutes already saved on hearing record",
  noShowDocumentation: "No-show documentation is complete",
  attendanceValidated: "Attendance validation passed",
};

const CHECKLIST_ORDER = [
  "hearingSessionActive",
  "deliberationPhase",
  "moderatorPresent",
  "minutesPrepared",
  "noShowDocumentation",
  "attendanceValidated",
];

export const VerdictReadinessCard = memo(function VerdictReadinessCard({
  hearingId,
  hearingStatus,
  disputePhase,
}: VerdictReadinessCardProps) {
  const [readiness, setReadiness] = useState<VerdictReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getHearingVerdictReadiness(hearingId);
      setReadiness(data);
    } catch (error) {
      const details = getApiErrorDetails(error, "Could not load verdict readiness.");
      setErrorMessage(details.message);
    } finally {
      setLoading(false);
    }
  }, [hearingId]);

  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness, hearingStatus, disputePhase]);

  const checklistRows = useMemo(() => {
    if (!readiness?.checklist) return [] as Array<{ key: string; met: boolean }>;

    const checklist = readiness.checklist;
    const ordered = CHECKLIST_ORDER.filter((key) => Object.prototype.hasOwnProperty.call(checklist, key));
    const remaining = Object.keys(checklist).filter((key) => !ordered.includes(key));

    return [...ordered, ...remaining].map((key) => ({ key, met: Boolean(checklist[key]) }));
  }, [readiness]);

  const blockingSet = useMemo(
    () => new Set(readiness?.blockingChecklist ?? []),
    [readiness?.blockingChecklist],
  );

  return (
    <div className={cn(sectionCardClass, "border-sky-200 bg-sky-50/60")}> 
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn(panelTitleClass, "text-sky-800")}>Verdict Readiness</p>
          <p className="mt-1 text-xs text-sky-800">
            {readiness?.canIssueVerdict
              ? "Checklist satisfied for issuing verdict in Hearing Room."
              : "Verdict is currently blocked until required hearing checks are satisfied."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchReadiness()}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-sky-200 bg-white px-2 text-xs text-sky-700 hover:bg-sky-50"
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {errorMessage && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errorMessage}
        </div>
      )}

      {!errorMessage && (
        <div className="mt-3 space-y-1.5">
          {checklistRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs border border-sky-100">
              <span className="text-slate-700">{CHECKLIST_LABELS[row.key] || row.key}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  row.met
                    ? "text-emerald-600"
                    : blockingSet.has(row.key)
                      ? "text-rose-600"
                      : "text-amber-700",
                )}
              >
                {row.met ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : blockingSet.has(row.key) ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <CircleAlert className="h-3.5 w-3.5" />
                )}
                {row.met
                  ? "Met"
                  : blockingSet.has(row.key)
                    ? "Missing"
                    : "Will be provided on submit"}
              </span>
            </div>
          ))}
        </div>
      )}

      {Boolean(readiness?.unmetChecklistDetails?.length) && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold inline-flex items-center gap-1">
            <CircleAlert className="h-3.5 w-3.5" />
            Blocking details
          </p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {readiness?.unmetChecklistDetails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
