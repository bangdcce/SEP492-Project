import React from "react";
import type { AuditLogEntry } from "../types";
import { Badge } from "../../../shared/components/custom/Badge";
import { formatDistanceToNow } from "date-fns";

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  onRowClick: (log: AuditLogEntry) => void;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  logs,
  onRowClick,
}) => {
  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return "bg-red-100 text-red-700";
      case "LOW":
        return "bg-teal-100 text-teal-700";
      default:
        return "bg-green-100 text-green-700";
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "DELETE":
        return "bg-red-100 text-red-700";
      case "CREATE":
        return "bg-green-100 text-green-700";
      case "UPDATE":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getRowBackgroundClass = (riskLevel: string) => {
    return riskLevel === "HIGH" ? "bg-red-50" : "bg-white";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                Actor
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                IP Address
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                Risk Level
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr
                key={log.id}
                onClick={() => onRowClick(log)}
                className={`${getRowBackgroundClass(
                  log.riskLevel
                )} hover:bg-gray-50 cursor-pointer transition-colors`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        log.actor.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          log.actor.name
                        )}&background=14b8a6&color=fff `
                      }
                      alt={log.actor.name}
                      className="h-10 w-10 rounded-full"
                    />
                    <div>
                      <p className="text-sm text-slate-900">{log.actor.name}</p>
                      <p className="text-xs text-gray-500">{log.actor.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={getActionBadgeColor(log.action)}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-6 py-4 ">
                  <p className="text-sm text-slate-900">{log.entity}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm text-gray-600 font-mono">
                    {log.ipAddress}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm text-gray-600">
                    {formatDistanceToNow(new Date(log.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={getRiskBadgeColor(log.riskLevel)}>
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
