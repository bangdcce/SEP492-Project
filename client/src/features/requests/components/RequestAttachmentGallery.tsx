import { API_CONFIG } from "@/constants";
import type { ProjectRequestAttachment } from "../types";
import { ExternalLink, FileText, ImageIcon } from "lucide-react";

const resolveAttachmentUrl = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_CONFIG.BASE_URL.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
};

const isImageAttachment = (attachment: ProjectRequestAttachment) =>
  String(attachment.mimetype || "").toLowerCase().startsWith("image/");

interface RequestAttachmentGalleryProps {
  attachments?: ProjectRequestAttachment[] | null;
  emptyLabel?: string;
}

export function RequestAttachmentGallery({
  attachments,
  emptyLabel = "No attachments uploaded yet.",
}: RequestAttachmentGalleryProps) {
  const items = attachments || [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((attachment) => {
        const href = resolveAttachmentUrl(attachment.url || attachment.storagePath);
        const image = isImageAttachment(attachment);

        return (
          <div
            key={`${attachment.storagePath || attachment.url || attachment.filename}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            {image ? (
              <a href={href} target="_blank" rel="noreferrer" className="block">
                <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                  <img
                    src={href}
                    alt={attachment.filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {attachment.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      {attachment.mimetype || "image"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                    <ImageIcon className="h-4 w-4" />
                    Preview
                  </div>
                </div>
              </a>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {attachment.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      {attachment.mimetype || "attachment"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </div>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
