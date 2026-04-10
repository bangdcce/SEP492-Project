import React, { memo, useCallback, useState } from "react";
import { FileUp, AlertCircle, Loader2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";

interface EvidenceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected file ready for upload */
  file: File | null;
  /** Called with description when user confirms */
  onConfirm: (description: string) => void;
  loading?: boolean;
  /** If we're in-hearing and outside EVIDENCE_SUBMISSION phase, require justification */
  requireJustification?: boolean;
}

export const EvidenceUploadDialog = memo(function EvidenceUploadDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
  loading,
  requireJustification,
}: EvidenceUploadDialogProps) {
  const [description, setDescription] = useState("");

  const isValid = description.trim().length >= 10;

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    onConfirm(description.trim());
    setDescription("");
  }, [isValid, description, onConfirm]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setDescription("");
    onOpenChange(false);
  }, [loading, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        handleClose();
        return;
      }

      onOpenChange(true);
    },
    [handleClose, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(100vw-2rem,36rem)] overflow-x-hidden sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-amber-600" />
            Submit Evidence
          </DialogTitle>
          <DialogDescription>
            Describe what this evidence proves and which issue it relates to.
            This helps the adjudicator evaluate it properly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-x-hidden">
          {/* File info */}
          {file && (
            <div
              className={[
                "flex flex-col gap-1 overflow-hidden rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-2",
                loading
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700",
              ].join(" ")}
            >
              <FileUp className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-slate-400 sm:ml-auto">
                {Math.max(1, Math.round(file.size / 1024))} KB
              </span>
            </div>
          )}

          {loading && (
            <div
              aria-live="polite"
              className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 p-4 text-sm text-slate-700"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Uploading evidence and running security scan
                    </p>
                    <p className="text-slate-600">
                      The server confirms the upload only after the malware
                      scan finishes. Large images can take a bit longer here.
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500" />
                  </div>
                  <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                      <span>Storage upload and validation in progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Virus scan must finish before confirmation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="evi-desc" className="text-sm font-medium">
              Evidence description <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="evi-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Screenshot of completed milestone #3 showing all deliverables were submitted on time…"
              rows={3}
              className="text-sm"
              maxLength={500}
              disabled={loading}
            />
            <p className="text-xs text-slate-400">
              Min 10 characters · {description.length}/500
            </p>
          </div>

          {requireJustification && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Evidence is being submitted outside the designated Evidence
                Submission phase. Your description should explain why this
                evidence is being submitted late or why it was newly discovered.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="bg-slate-800 text-white hover:bg-slate-700"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading and scanning…
                </span>
              ) : (
                "Submit Evidence"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
