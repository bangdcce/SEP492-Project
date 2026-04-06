import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Scale } from "lucide-react";
import { ROUTES } from "@/constants";
import { StaffDisputeBoard } from "../components/dashboard/StaffDisputeBoard";

type AdminDisputeView = "queue" | "caseload";

export const AdminDisputesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = useMemo<AdminDisputeView>(() => {
    return searchParams.get("view") === "queue" ? "queue" : "caseload";
  }, [searchParams]);

  const setView = (nextView: AdminDisputeView) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextView === "queue") {
      nextParams.set("view", "queue");
    } else {
      nextParams.delete("view");
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dispute Operations
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Admin can review intake queue pressure, cross-team caseload, and
            open any dispute record without switching into staff-only routes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={ROUTES.ADMIN_DISPUTE_APPEALS}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Scale className="h-4 w-4" />
            Appeal queue
          </Link>
          <Link
            to={ROUTES.ADMIN_HEARINGS}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" />
            Hearings
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["caseload", "Platform caseload"],
          ["queue", "Queue intake"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              view === value
                ? "border-teal-300 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <StaffDisputeBoard
        mode={view}
        titleOverride={
          view === "queue" ? "Dispute Queue" : "Platform Caseload"
        }
        detailHrefBuilder={(disputeId) => `/admin/disputes/${disputeId}`}
      />
    </div>
  );
};
