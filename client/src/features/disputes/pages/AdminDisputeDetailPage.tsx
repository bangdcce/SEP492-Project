import { Component, type ErrorInfo, type ReactNode } from "react";
import { useEffect } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ROUTES } from "@/constants";
import { DisputeDetailHub } from "../components/dashboard/DisputeDetailHub";
import type { DisputeSummary } from "../types/dispute.types";

type DetailBoundaryProps = {
  children: ReactNode;
};

type DetailBoundaryState = {
  hasError: boolean;
};

class AdminDisputeDetailErrorBoundary extends Component<
  DetailBoundaryProps,
  DetailBoundaryState
> {
  state: DetailBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): DetailBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin dispute detail crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <AdminDisputeDetailFallback />;
    }

    return this.props.children;
  }
}

const AdminDisputeDetailFallback = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Dispute detail is unavailable
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The admin dispute view hit a render error. Return to the dispute board
          and reload the case record.
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.ADMIN_DISPUTES)}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to disputes
        </button>
      </div>
    </div>
  );
};

export const AdminDisputeDetailPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { disputeId } = useParams<{ disputeId: string }>();
  const locationState = location.state as { dispute?: DisputeSummary } | undefined;
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
  }, [initialTab, rawTab, searchParams, setSearchParams]);

  return (
    <div className="h-[calc(100vh-4rem)]">
      <AdminDisputeDetailErrorBoundary>
        <DisputeDetailHub
          disputeId={disputeId}
          initialDispute={locationState?.dispute}
          initialTab={initialTab}
        />
      </AdminDisputeDetailErrorBoundary>
    </div>
  );
};
