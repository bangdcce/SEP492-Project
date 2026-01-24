import { useLocation, useSearchParams } from "react-router-dom";
import { DisputeDetailHub } from "@/features/disputes/components/dashboard/DisputeDetailHub";
import type { DisputeSummary } from "@/features/disputes/types/dispute.types";

export const StaffCaseloadPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as { dispute?: DisputeSummary } | undefined;
  const disputeId =
    searchParams.get("disputeId") ?? locationState?.dispute?.id ?? undefined;

  return (
    <div className="-m-6 h-[calc(100vh-4rem)]">
      {/* Fullscreen fit for the Hub */}
      <DisputeDetailHub
        disputeId={disputeId}
        initialDispute={locationState?.dispute}
      />
    </div>
  );
};
