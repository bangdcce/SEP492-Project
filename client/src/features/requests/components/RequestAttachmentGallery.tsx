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
  String(attachment.mimetype || "")
    .toLowerCase()
    .startsWith("image/");

interface RequestAttachmentGalleryProps {
  attachments?: ProjectRequestAttachment[] | null;
  emptyLabel?: string;
}

export function RequestAttachmentGallery({
  attachments,
  emptyLabel = "No attachments uploaded yet.",
}: RequestAttachmentGalleryProps) {
  const items = attachments || [];
  const imageItems = items.filter((item) => isImageAttachment(item));
  const documentItems = items.filter((item) => !isImageAttachment(item));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {imageItems.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {imageItems.map((attachment) => {
            const href = resolveAttachmentUrl(
              attachment.url || attachment.storagePath,
            );

            return (
              <a
                key={`${attachment.storagePath || attachment.url || attachment.filename}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                  <img
                    src={href}
                    alt={attachment.filename}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 wrap-break-word text-sm font-medium text-slate-900">
                      {attachment.filename}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 wrap-break-word">
                      {attachment.mimetype || "image"}
                    </p>
                  </div>
                  <div className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600">
                    <ImageIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Open</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {documentItems.length > 0 && (
        <div className="space-y-2">
          {documentItems.map((attachment) => {
            const href = resolveAttachmentUrl(
              attachment.url || attachment.storagePath,
            );

            return (
              <a
                key={`${attachment.storagePath || attachment.url || attachment.filename}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 wrap-break-word text-sm font-medium text-slate-900">
                      {attachment.filename}
                    </p>
                    <p className="text-xs text-slate-500 wrap-break-word">
                      {attachment.mimetype || "attachment"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-600">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
