import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { DisputeDetailHub } from "@/features/disputes/components/dashboard/DisputeDetailHub";
import type { DisputeSummary } from "@/features/disputes/types/dispute.types";
import { StaffCaseloadBoard } from "@/features/disputes/components/dashboard/StaffCaseloadBoard";

export const StaffCaseloadPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = location.state as { dispute?: DisputeSummary } | undefined;
  const disputeId =
    searchParams.get("disputeId") ?? locationState?.dispute?.id ?? undefined;
  const rawTab = searchParams.get("tab")?.toLowerCase();
  const initialTab =
    rawTab === "resolution" || rawTab === "verdict"
      ? "hearings"
      : rawTab === "discussion" || rawTab === "chat"
        ? "internal-notes"
        : rawTab ?? undefined;

  useEffect(() => {
    if (!rawTab || !initialTab || rawTab === initialTab) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", initialTab);
    setSearchParams(next, { replace: true });
  }, [rawTab, initialTab, searchParams, setSearchParams]);

  if (!disputeId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Caseload</h2>
          <p className="text-gray-500">
            Disputes assigned to you. Pick a case to review in detail.
          </p>
        </div>
        <StaffCaseloadBoard />
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100vh-4rem)]">
      {/* Fullscreen fit for the Hub */}
      <DisputeDetailHub
        disputeId={disputeId}
        initialDispute={locationState?.dispute}
        initialTab={initialTab}
      />
    </div>
  );
};
