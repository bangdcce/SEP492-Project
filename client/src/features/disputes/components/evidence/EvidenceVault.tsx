import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  FileText,
  Flag,
  Download,
  AlertTriangle,
  Loader2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Unlink,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  flagDisputeEvidence,
  getDisputeEvidence,
  getDisputeEvidenceQuota,
  uploadDisputeEvidence,
} from "../../api";
import type {
  DisputeEvidence,
  DisputeEvidenceQuota,
} from "../../types/dispute.types";
import { STORAGE_KEYS } from "@/constants";
import { UserRole } from "../../../staff/types/staff.types";
import { getStoredJson } from "@/shared/utils/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PREVIEWABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const PREVIEWABLE_PDF_TYPE = "application/pdf";

function isPreviewableImage(mimeType?: string) {
  return !!mimeType && PREVIEWABLE_IMAGE_TYPES.has(mimeType);
}
function isPreviewablePdf(mimeType?: string) {
  return mimeType === PREVIEWABLE_PDF_TYPE;
}
function canPreview(mimeType?: string) {
  return isPreviewableImage(mimeType) || isPreviewablePdf(mimeType);
}

interface EvidenceVaultProps {
  disputeId: string;
  refreshToken?: number;
  readOnly?: boolean;
}

export const EvidenceVault = ({
  disputeId,
  refreshToken,
  readOnly = false,
}: EvidenceVaultProps) => {
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([]);
  const [quota, setQuota] = useState<DisputeEvidenceQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagTarget, setFlagTarget] = useState<DisputeEvidence | null>(null);
  const [flagging, setFlagging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview state
  const [previewItem, setPreviewItem] = useState<DisputeEvidence | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);

  const currentUserRole = useMemo(() => {
    const parsed = getStoredJson<{ role?: UserRole }>(STORAGE_KEYS.USER);
    return parsed?.role ?? null;
  }, []);

  const canFlag =
    currentUserRole === UserRole.STAFF || currentUserRole === UserRole.ADMIN;
  const canUpload =
    !readOnly && currentUserRole !== UserRole.STAFF && currentUserRole !== UserRole.ADMIN;

  // -------------------------------------------------------------------------
  // Load evidence — fetch list and quota independently so one failure
  // doesn't break the other
  // -------------------------------------------------------------------------
  const loadEvidence = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch independently: quota failure should NOT block evidence list
      const evidencePromise = getDisputeEvidence(disputeId).catch((err) => {
        console.error("Failed to load evidence list:", err);
        toast.error("Could not load evidence list");
        return [] as DisputeEvidence[];
      });
      const quotaPromise = getDisputeEvidenceQuota(disputeId).catch((err) => {
        console.error("Failed to load quota:", err);
        return null as DisputeEvidenceQuota | null;
      });

      const [items, quotaInfo] = await Promise.all([
        evidencePromise,
        quotaPromise,
      ]);
      setEvidence(items ?? []);
      setQuota(quotaInfo ?? null);
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence, refreshToken]);

  const quotaUsed = quota?.used ?? (quota ? quota.total - quota.remaining : 0);
  const quotaTotal = quota?.total ?? 20;

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await uploadDisputeEvidence(disputeId, file);
      toast.success("Evidence uploaded");
      await loadEvidence();
    } catch (error) {
      console.error("Failed to upload evidence:", error);
      toast.error("Could not upload evidence");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // -------------------------------------------------------------------------
  // View — inline preview for images/PDFs, fallback to new tab
  // -------------------------------------------------------------------------
  const handleView = (item: DisputeEvidence) => {
    if (!item.signedUrl) {
      toast.error(
        "Download URL is not available. The file may not exist in storage.",
      );
      return;
    }
    if (canPreview(item.mimeType)) {
      setPreviewItem(item);
      setPreviewZoom(1);
    } else {
      window.open(item.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  // -------------------------------------------------------------------------
  // Download — actual file download via fetch + blob
  // -------------------------------------------------------------------------
  const handleDownload = async (item: DisputeEvidence) => {
    if (!item.signedUrl) {
      toast.error(
        "Download URL is not available. The file may not exist in storage.",
      );
      return;
    }
    try {
      setDownloading(item.id);
      const response = await fetch(item.signedUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.fileName || "evidence";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download file. Try opening in a new tab instead.");
      // fallback: open in new tab
      window.open(item.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(null);
    }
  };

  const openFlagDialog = (item: DisputeEvidence) => {
    setFlagTarget(item);
    setFlagReason("");
    setFlagDialogOpen(true);
  };

  const handleFlagSubmit = async () => {
    if (!flagTarget) return;
    if (!flagReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      setFlagging(true);
      await flagDisputeEvidence(disputeId, flagTarget.id, flagReason.trim());
      toast.success("Evidence flagged");
      setFlagDialogOpen(false);
      await loadEvidence();
    } catch (error) {
      console.error("Failed to flag evidence:", error);
      toast.error("Could not flag evidence");
    } finally {
      setFlagging(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="evidence-vault">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-900">
          Evidence Vault
          {!loading && evidence.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({evidence.length} file{evidence.length !== 1 ? "s" : ""})
            </span>
          )}
        </h3>
        {canUpload ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500"
                style={{ width: `${(quotaUsed / quotaTotal) * 100}%` }}
              />
            </div>
            <span>
              {quotaUsed}/{quotaTotal} files used
            </span>
          </div>
        ) : null}
      </div>

      {readOnly ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Evidence uploads are locked because this dispute is closed. Existing evidence remains
          available for review.
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading evidence...
        </div>
      ) : evidence.length === 0 && !canUpload ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No evidence has been submitted yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidence.map((file) => {
            const urlAvailable = !!file.signedUrl;
            const isDownloading = downloading === file.id;

            return (
              <div
                key={file.id}
                data-testid={`evidence-card-${file.id}`}
                className={`group relative bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-md
                  ${file.isFlagged ? "border-red-200 bg-red-50/10" : !urlAvailable ? "border-amber-200" : "border-gray-200"}
                `}
              >
                {/* Thumbnail area */}
                <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                  {file.isFlagged ? (
                    <div className="text-center p-4">
                      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-red-600">
                        Content Hidden
                      </p>
                      <p className="text-xs text-red-400">
                        Flagged by Moderator
                      </p>
                    </div>
                  ) : !urlAvailable ? (
                    <div className="text-center p-4">
                      <Unlink className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-amber-600">
                        URL Unavailable
                      </p>
                      <p className="text-xs text-amber-400">
                        File may not exist in storage
                      </p>
                    </div>
                  ) : isPreviewableImage(file.mimeType) && urlAvailable ? (
                    <img
                      src={file.signedUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement)
                          .parentElement!.querySelector(".fallback-icon")!
                          .classList.remove("hidden");
                      }}
                    />
                  ) : (
                    <FileText className="w-12 h-12 text-gray-400" />
                  )}
                  {/* Hidden fallback icon for broken images */}
                  {isPreviewableImage(file.mimeType) && urlAvailable && (
                    <div className="fallback-icon hidden absolute inset-0 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-gray-400" />
                    </div>
                  )}

                  {/* Hover overlay with action buttons */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                    <button
                      data-testid={`evidence-view-${file.id}`}
                      className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-40"
                      title={
                        canPreview(file.mimeType)
                          ? "Preview"
                          : "Open in new tab"
                      }
                      onClick={() => handleView(file)}
                      disabled={!urlAvailable}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      data-testid={`evidence-download-${file.id}`}
                      className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-40"
                      title="Download"
                      onClick={() => handleDownload(file)}
                      disabled={!urlAvailable || isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                    </button>
                    {canFlag && !file.isFlagged && (
                      <button
                        data-testid={`evidence-flag-${file.id}`}
                        className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600"
                        title="Flag as Inappropriate"
                        onClick={() => openFlagDialog(file)}
                      >
                        <Flag className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card footer info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <p
                      className="text-sm font-medium text-slate-700 truncate flex-1"
                      title={file.fileName}
                    >
                      {file.fileName}
                    </p>
                    <span className="text-xs text-gray-400 uppercase shrink-0">
                      {file.fileName.split(".").pop()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    <span>
                      by{" "}
                      {file.uploader?.fullName ||
                        file.uploader?.name ||
                        file.uploaderId ||
                        "Unknown"}{" "}
                      at{" "}
                      {file.uploadedAt
                        ? format(new Date(file.uploadedAt), "MMM d, h:mm a")
                        : "N/A"}
                    </span>
                  </div>
                  {file.description && (
                    <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">
                      {file.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {canUpload ? (
            <button
              data-testid="upload-evidence-trigger"
              onClick={handlePickFile}
              disabled={uploading}
              className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-6 text-gray-400 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 mb-2 animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8 mb-2" />
              )}
              <span className="font-medium text-sm">
                {uploading ? "Uploading..." : "Upload New Evidence"}
              </span>
              <span className="text-xs mt-1">Max 50MB</span>
            </button>
          ) : null}
        </div>
      )}

      {canUpload ? (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          data-testid="upload-evidence-input"
          onChange={handleFileChange}
        />
      ) : null}

      {/* ================================================================== */}
      {/* INLINE PREVIEW MODAL                                                */}
      {/* ================================================================== */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewItem(null)}
        >
          {/* Toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {isPreviewableImage(previewItem.mimeType) && (
              <>
                <button
                  className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
                  title="Zoom In"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewZoom((z) => Math.min(z + 0.25, 3));
                  }}
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
                  title="Zoom Out"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewZoom((z) => Math.max(z - 0.25, 0.25));
                  }}
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
              title="Open in new tab"
              onClick={(e) => {
                e.stopPropagation();
                window.open(
                  previewItem.signedUrl,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            >
              <ExternalLink className="w-5 h-5" />
            </button>
            <button
              className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
              title="Download"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(previewItem);
              }}
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
              title="Close"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewItem(null);
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File name label */}
          <div className="absolute top-4 left-4 text-white text-sm bg-black/40 px-3 py-1.5 rounded-lg max-w-xs truncate">
            {previewItem.fileName}
          </div>

          {/* Preview content */}
          <div
            className="max-w-[90vw] max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {isPreviewableImage(previewItem.mimeType) ? (
              <img
                src={previewItem.signedUrl}
                alt={previewItem.fileName}
                className="rounded-lg shadow-2xl transition-transform duration-200"
                style={{
                  transform: `scale(${previewZoom})`,
                  transformOrigin: "center",
                }}
                draggable={false}
              />
            ) : isPreviewablePdf(previewItem.mimeType) ? (
              <iframe
                src={previewItem.signedUrl}
                title={previewItem.fileName}
                className="w-[85vw] h-[85vh] rounded-lg bg-white"
              />
            ) : null}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FLAG DIALOG                                                         */}
      {/* ================================================================== */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Flag evidence</DialogTitle>
            <DialogDescription>
              Explain why this evidence should be hidden.
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={3}
            value={flagReason}
            data-testid="flag-evidence-reason"
            onChange={(event) => setFlagReason(event.target.value)}
            placeholder="Reason for flagging"
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-teal-500 focus:border-teal-500"
          />
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setFlagDialogOpen(false)}
              disabled={flagging}
            >
              Cancel
            </button>
            <button
              data-testid="flag-evidence-confirm"
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              onClick={handleFlagSubmit}
              disabled={flagging}
            >
              {flagging ? "Flagging..." : "Flag evidence"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
