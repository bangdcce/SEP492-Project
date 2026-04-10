import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  type ProjectRequestAttachment,
  wizardService,
} from "../services/wizardService";
import { Upload, X, FileText, Paperclip } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { toast } from "sonner";

interface StepB5Props {
  description: string;
  setDescription: (val: string) => void;
  title: string;
  setTitle: (val: string) => void;
  attachments: ProjectRequestAttachment[];
  onAttachmentsChange: (attachments: ProjectRequestAttachment[]) => void;
}

const ATTACHMENT_HINT = "PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG, JPEG, WEBP up to 10MB each";

export function StepB5({
  description,
  setDescription,
  title,
  setTitle,
  attachments,
  onAttachmentsChange,
}: StepB5Props) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      setUploading(true);
      const res = await wizardService.uploadFiles(files, "attachments");
      const nextAttachments = [...attachments, ...(res.attachments || [])];
      onAttachmentsChange(
        nextAttachments.filter(
          (attachment, index, current) =>
            current.findIndex((candidate) => candidate.url === attachment.url) === index,
        ),
      );
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Could not upload attachments.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveFile = (url: string) => {
    onAttachmentsChange(attachments.filter((attachment) => attachment.url !== url));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-primary">Idea Description</h2>
        <p className="mt-2 text-muted-foreground">
          Capture the core idea clearly. Supporting documents stay attached to the draft.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Project Title</Label>
          <Input
            id="title"
            placeholder="e.g. ERP inventory reconciliation workflow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Detailed Description</Label>
          <Textarea
            id="description"
            className="min-h-37.5"
            placeholder="Describe scope, constraints, target audience, workflows, and anything brokers/freelancers should understand before replying."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Reference Documents</Label>
              <p className="text-xs text-muted-foreground">{ATTACHMENT_HINT}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              {attachments.length} file{attachments.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center transition-colors hover:border-teal-300 hover:bg-teal-50/40">
            <Input
              type="file"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium text-slate-700">
                {uploading ? "Uploading attachments..." : "Add one or more supporting files"}
              </p>
              <p className="text-xs">Use attachments for briefs, screenshots, spreadsheets, and reference docs.</p>
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.url}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-md bg-teal-50 p-2 text-teal-700">
                      {attachment.mimetype?.startsWith("image/") ? (
                        <Paperclip className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{attachment.filename}</p>
                      <p className="text-xs text-slate-500">
                        {attachment.mimetype || "Unknown type"}
                        {typeof attachment.size === "number"
                          ? ` - ${(attachment.size / 1024 / 1024).toFixed(2)} MB`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(attachment.url)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
