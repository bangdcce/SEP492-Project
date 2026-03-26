import { Badge } from "@/shared/components/ui";
import type { ProjectHistoryItem } from "../types";

interface ProjectHistorySectionProps {
  items: ProjectHistoryItem[];
}

const formatDate = (value?: string) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

export function ProjectHistorySection({ items }: ProjectHistorySectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Project History</h2>
        <p className="mt-1 text-sm text-slate-600">
          Completed work and collaboration context for this profile.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No project history available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.projectId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <Badge variant="outline">{String(item.status || "UNKNOWN").replace(/_/g, " ")}</Badge>
                    <Badge variant="secondary">{item.targetRoleInProject}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>Completed: {formatDate(item.completedAt)}</span>
                    <span>Budget: {formatCurrency(item.totalBudget)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Project ID: {item.projectId}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Client</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {item.client?.fullName || "Unknown"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Broker</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {item.broker?.fullName || "Unknown"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Freelancer</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {item.freelancer?.fullName || "Unknown"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
