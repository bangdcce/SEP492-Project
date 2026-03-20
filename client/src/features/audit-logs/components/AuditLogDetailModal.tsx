import { Badge } from "@/shared/components/ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import type { AuditLogEntry, AuditLogTimelineResponse } from "../types";

export const AuditLogDetailModal = ({
  log,
  timeline,
  onClose,
}: {
  log: AuditLogEntry | null;
  timeline: AuditLogTimelineResponse | null;
  onClose: () => void;
}) => {
  return (
    <Sheet open={Boolean(log)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {log ? (
          <>
            <SheetHeader>
              <SheetTitle>{log.eventName}</SheetTitle>
              <SheetDescription>
                {log.actor.name} • {new Date(log.timestamp).toLocaleString()}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-6">
              <section className="grid gap-3 md:grid-cols-2">
                <InfoCard label="Action" value={log.action} />
                <InfoCard label="Entity" value={log.entity} />
                <InfoCard label="Route" value={log.route || "No route"} />
                <InfoCard label="Correlation" value={log.requestId || log.sessionId || "No correlation"} />
                <InfoCard label="Status" value={log.statusCode ? `${log.httpMethod || ""} ${log.statusCode}` : log.httpMethod || "N/A"} />
                <InfoCard label="Risk" value={log.riskLevel} />
              </section>

              {log.changedFields.length > 0 ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-950">Changed Fields</h3>
                    <Badge variant="outline">{log.changedFields.length} diffs</Badge>
                  </div>
                  <div className="space-y-2">
                    {log.changedFields.map((field) => (
                      <div key={field.path} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <p className="font-medium text-slate-900">{field.path}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Before: {JSON.stringify(field.before)}
                        </p>
                        <p className="text-xs text-slate-500">
                          After: {JSON.stringify(field.after)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {log.errorMessage ? (
                <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h3 className="text-sm font-semibold text-rose-900">Error Context</h3>
                  <p className="mt-2 text-sm text-rose-800">{log.errorCode || "Unspecified error"}</p>
                  <p className="mt-1 text-sm text-rose-700">{log.errorMessage}</p>
                </section>
              ) : null}

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-950">Timeline</h3>
                {timeline?.data?.length ? (
                  <div className="space-y-3">
                    {timeline.data.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-2xl border p-3 ${
                          entry.id === log.id
                            ? "border-teal-200 bg-teal-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.eventCategory}</Badge>
                          <Badge variant="outline">{entry.source}</Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-950">
                          {entry.eventName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.journeyStep || entry.route || entry.entity}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No correlated timeline was found.</p>
                )}
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <JsonBlock title="Before Data" value={log.beforeData} />
                <JsonBlock title="After Data" value={log.afterData} />
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-medium text-slate-950">{value}</p>
  </div>
);

const JsonBlock = ({
  title,
  value,
}: {
  title: string;
  value: Record<string, any> | null | undefined;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="mb-3 text-sm font-semibold text-slate-950">{title}</h3>
    <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
      {value ? JSON.stringify(value, null, 2) : "No data"}
    </pre>
  </div>
);
