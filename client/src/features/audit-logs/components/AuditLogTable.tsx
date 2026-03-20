import { formatDistanceToNow } from "date-fns";
import type { AuditLogEntry } from "../types";
import { Badge } from "@/shared/components/ui";

export const AuditLogTable = ({
  logs,
  onRowClick,
}: {
  logs: AuditLogEntry[];
  onRowClick: (log: AuditLogEntry) => void;
}) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {["Actor", "Category", "Entity", "Route", "Correlation", "Time", "Risk"].map((label) => (
                <th
                  key={label}
                  className="px-5 py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => onRowClick(log)}
                className="cursor-pointer transition hover:bg-slate-50"
              >
                <td className="px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-950">{log.actor.name}</p>
                    <p className="text-xs text-slate-500">{log.actor.email}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{log.eventCategory}</Badge>
                    <Badge
                      className={
                        log.source === "CLIENT"
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }
                    >
                      {log.source}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{log.eventName}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm text-slate-900">{log.entity}</p>
                  <p className="mt-1 text-xs text-slate-500">{log.action}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[220px] truncate text-sm text-slate-900">
                    {log.route || "No route"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.httpMethod || "N/A"} {log.statusCode ? `• ${log.statusCode}` : ""}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="max-w-[200px] truncate text-sm text-slate-900">
                    {log.requestId || "No request ID"}
                  </p>
                  <p className="mt-1 max-w-[200px] truncate text-xs text-slate-500">
                    {log.sessionId || "No session ID"}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm text-slate-900">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <Badge
                    className={
                      log.riskLevel === "HIGH"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : log.riskLevel === "LOW"
                          ? "border-teal-200 bg-teal-50 text-teal-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {log.riskLevel}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
