import React, { memo, useCallback, useState } from "react";
import { FileUp, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

        <div className="space-y-4 py-2">
          {/* File info */}
          {file && (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <FileUp className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate font-medium">{file.name}</span>
              <span className="ml-auto shrink-0 text-xs text-slate-400">
                {Math.max(1, Math.round(file.size / 1024))} KB
              </span>
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="bg-slate-800 text-white hover:bg-slate-700"
          >
            {loading ? "Uploading…" : "Submit Evidence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
