import { Component, type ErrorInfo, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DisputeDetailHub } from "../components/dashboard/DisputeDetailHub";

type DetailBoundaryProps = {
  children: ReactNode;
};

type DetailBoundaryState = {
  hasError: boolean;
};

class ParticipantDisputeDetailErrorBoundary extends Component<
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
    console.error("Participant dispute detail crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ParticipantDisputeDetailFallback />;
    }

    return this.props.children;
  }
}

const ParticipantDisputeDetailFallback = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dispute detail is unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          The dispute page hit a render error. Return to the dispute history and reload the case.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Go back
        </button>
      </div>
    </div>
  );
};

export const ParticipantDisputeDetailPage = () => {
  const { disputeId } = useParams<{ disputeId: string }>();

  return (
    <div className="-m-6 h-[calc(100vh-4rem)]">
      <ParticipantDisputeDetailErrorBoundary>
        <DisputeDetailHub disputeId={disputeId} />
      </ParticipantDisputeDetailErrorBoundary>
    </div>
  );
};
