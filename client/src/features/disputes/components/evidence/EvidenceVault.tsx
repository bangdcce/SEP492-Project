import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  FileText,
  Flag,
  Download,
  AlertTriangle,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  flagDisputeEvidence,
  getDisputeEvidence,
  getDisputeEvidenceQuota,
  uploadDisputeEvidence,
} from "../../api";
import type { DisputeEvidence, DisputeEvidenceQuota } from "../../types/dispute.types";
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

interface EvidenceVaultProps {
  disputeId: string;
  refreshToken?: number;
}

export const EvidenceVault = ({ disputeId, refreshToken }: EvidenceVaultProps) => {
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([]);
  const [quota, setQuota] = useState<DisputeEvidenceQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagTarget, setFlagTarget] = useState<DisputeEvidence | null>(null);
  const [flagging, setFlagging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUserRole = useMemo(() => {
    const parsed = getStoredJson<{ role?: UserRole }>(STORAGE_KEYS.USER);
    return parsed?.role ?? null;
  }, []);

  const canFlag =
    currentUserRole === UserRole.STAFF || currentUserRole === UserRole.ADMIN;
  const canUpload =
    currentUserRole !== UserRole.STAFF && currentUserRole !== UserRole.ADMIN;

  const loadEvidence = useCallback(async () => {
    try {
      setLoading(true);
      const [items, quotaInfo] = await Promise.all([
        getDisputeEvidence(disputeId),
        getDisputeEvidenceQuota(disputeId),
      ]);
      setEvidence(items ?? []);
      setQuota(quotaInfo ?? null);
    } catch (error) {
      console.error("Failed to load evidence:", error);
      toast.error("Could not load evidence");
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

  const handleDownload = (item: DisputeEvidence) => {
    if (!item.signedUrl) return;
    window.open(item.signedUrl, "_blank", "noopener,noreferrer");
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-900">Evidence Vault</h3>
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

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading evidence...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidence.map((file) => (
            <div
              key={file.id}
              className={`group relative bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-md
                        ${file.isFlagged ? "border-red-200 bg-red-50/10" : "border-gray-200"}
                    `}
            >
              <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                {file.isFlagged ? (
                  <div className="text-center p-4">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-red-600">
                      Content Hidden
                    </p>
                    <p className="text-xs text-red-400">Flagged by Moderator</p>
                  </div>
                ) : (
                  <FileText className="w-12 h-12 text-gray-400" />
                )}

                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                  <button
                    className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
                    title="View"
                    onClick={() => handleDownload(file)}
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
                    title="Download"
                    onClick={() => handleDownload(file)}
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  {canFlag && (
                    <button
                      className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600"
                      title="Flag as Inappropriate"
                      onClick={() => openFlagDialog(file)}
                    >
                      <Flag className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3">
                <div className="flex items-start justify-between">
                  <p
                    className="text-sm font-medium text-slate-700 truncate"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </p>
                  <span className="text-xs text-gray-400 uppercase">
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
              </div>
            </div>
          ))}

          {canUpload ? (
            <button
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
          ) : (
            <div className="border border-gray-200 rounded-xl flex items-center justify-center p-6 text-sm text-gray-500 bg-gray-50">
              Evidence uploads are limited to dispute participants.
            </div>
          )}
        </div>
      )}

      {canUpload ? (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      ) : null}

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
