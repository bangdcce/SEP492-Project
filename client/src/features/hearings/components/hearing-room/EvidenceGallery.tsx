import React, { memo, useState, useCallback } from "react";
import { Image, FileText, File, User, Download } from "lucide-react";
import { cn } from "@/shared/components/ui/utils";
import {
  isImage,
  formatDateTime,
  panelTitleClass,
  roleBadgeLightClass,
  roleLabel,
} from "./constants";
import type { DisputeEvidence } from "@/features/disputes/types/dispute.types";
import { downloadEvidencePackage } from "@/features/hearings/api";

interface EvidenceGalleryProps {
  evidence: DisputeEvidence[];
  previewEvidenceId: string | null;
  onSelectEvidence: (id: string) => void;
  disputeId?: string;
}

/** Map uploaderRole to a user-friendly party label */
const partyLabel = (role?: string | null) => {
  if (!role) return "Unknown";
  if (role === "CLIENT") return "Claimant";
  if (role === "FREELANCER") return "Respondent";
  if (role === "BROKER") return "Broker";
  if (role === "STAFF") return "Staff";
  if (role === "ADMIN") return "Admin";
  return roleLabel(role);
};

export const EvidenceGallery = memo(function EvidenceGallery({
  evidence,
  previewEvidenceId,
  onSelectEvidence,
  disputeId,
}: EvidenceGalleryProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!disputeId || exporting) return;
    setExporting(true);
    try {
      await downloadEvidencePackage(disputeId);
    } catch {
      /* silent — button shows spinner */
    } finally {
      setExporting(false);
    }
  }, [disputeId, exporting]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-500" />
        <p className={panelTitleClass}>Evidence gallery</p>
        <span className="ml-auto text-sm text-slate-400">
          {evidence.length} items
        </span>
        {disputeId && evidence.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            title="Export evidence as ZIP"
            className="ml-1 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
          >
            <Download
              className={cn("h-3.5 w-3.5", exporting && "animate-pulse")}
            />
          </button>
        )}
      </div>

      {evidence.length ? (
        <div className="grid grid-cols-2 gap-2">
          {evidence.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectEvidence(item.id)}
              className={cn(
                "group overflow-hidden rounded-lg border text-left transition-all cursor-pointer",
                previewEvidenceId === item.id
                  ? "border-slate-800 ring-2 ring-slate-300 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
              )}
            >
              {/* Thumbnail */}
              {isImage(item.mimeType) && item.signedUrl ? (
                <div className="h-20 overflow-hidden bg-slate-100">
                  <img
                    src={item.signedUrl}
                    alt={item.fileName}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center bg-slate-100">
                  {item.mimeType?.includes("pdf") ? (
                    <FileText className="h-6 w-6 text-rose-400" />
                  ) : (
                    <File className="h-6 w-6 text-slate-400" />
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="p-2 space-y-1">
                {/* Uploader attribution */}
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 shrink-0 text-slate-400" />
                  <span
                    className={cn(
                      "inline-flex items-center rounded-sm border px-1 py-0.5 text-xs font-medium leading-none",
                      roleBadgeLightClass(
                        item.uploaderRole === "CLIENT"
                          ? "RAISER"
                          : item.uploaderRole === "FREELANCER"
                            ? "DEFENDANT"
                            : item.uploaderRole === "BROKER"
                              ? "OBSERVER"
                              : undefined,
                      ),
                    )}
                  >
                    {partyLabel(item.uploaderRole)}
                  </span>
                  <span className="text-xs text-slate-600 truncate">
                    {item.uploader?.fullName || item.uploader?.name || ""}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-900 line-clamp-1">
                  {item.fileName}
                </p>
                {item.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 italic">
                    {item.description}
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  {Math.max(1, Math.round(item.fileSize / 1024))} KB ·{" "}
                  {formatDateTime(item.uploadedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Image className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">
            No evidence uploaded yet.
          </p>
        </div>
      )}
    </div>
  );
});
