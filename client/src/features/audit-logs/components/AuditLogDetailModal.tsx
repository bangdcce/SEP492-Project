import React from "react";
import { X } from "lucide-react";
import type { AuditLogEntry } from "../types";
import { format } from "date-fns";

interface AuditLogDetailModalProps {
  log: AuditLogEntry | null;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  log,
  onClose,
}) => {
  if (!log) return null;
  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-slate-900">Audit Log Details</h2>
            <p className="text-sm text-gray-500 mt-1">
              {format(new Date(log.timestamp), "PPpp")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Basic Info */}
          <div className="mb-6">
            <h3 className="text-slate-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Actor</p>
                <p className="text-sm text-slate-900">{log.actor.name}</p>
                <p className="text-xs text-gray-500">{log.actor.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Action</p>
                <p className="text-sm text-slate-900">{log.action}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Entity</p>
                <p className="text-sm text-slate-900">{log.entity}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">
                  IP Address
                </p>
                <p className="text-sm text-slate-900 font-mono">
                  {log.ipAddress}
                </p>
              </div>
            </div>
          </div>
          {/* Data Changes */}
          {(log.beforeData || log.afterData) && (
            <div className="space-y-4">
              <h3 className="text-slate-900">Data Changes</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before Data */}
                {log.beforeData && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-2">
                      Before
                    </p>
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto">
                      {JSON.stringify(log.beforeData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* After Data */}
                {log.afterData && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-2">
                      After
                    </p>
                    <pre className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs overflow-x-auto">
                      {JSON.stringify(log.afterData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && (
            <div className="mt-6">
              <h3 className="text-slate-900 mb-3">Additional Metadata</h3>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
