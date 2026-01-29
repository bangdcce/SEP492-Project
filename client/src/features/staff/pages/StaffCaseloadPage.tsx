import { useLocation, useSearchParams } from "react-router-dom";
import { DisputeDetailHub } from "@/features/disputes/components/dashboard/DisputeDetailHub";
import type { DisputeSummary } from "@/features/disputes/types/dispute.types";
import { StaffDisputeBoard } from "@/features/disputes/components/dashboard/StaffDisputeBoard";

export const StaffCaseloadPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as { dispute?: DisputeSummary } | undefined;
  const disputeId =
    searchParams.get("disputeId") ?? locationState?.dispute?.id ?? undefined;
  const initialTab = searchParams.get("tab") ?? undefined;

  if (!disputeId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Caseload</h2>
          <p className="text-gray-500">
            Disputes assigned to you. Pick a case to review in detail.
          </p>
        </div>
        <StaffDisputeBoard mode="caseload" />
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
