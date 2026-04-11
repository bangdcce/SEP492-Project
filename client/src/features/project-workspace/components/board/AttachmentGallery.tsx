import { memo, useMemo } from "react";
import type { TaskAttachment } from "../../types";
import {
  isTaskImageAttachment,
  resolveTaskAttachmentUrl,
} from "../../utils/task-attachments";

type AttachmentGalleryProps = {
  attachments: TaskAttachment[];
};

function AttachmentGalleryInner({ attachments }: AttachmentGalleryProps) {
  const sorted = useMemo(
    () =>
      (attachments || [])
        .filter(isTaskImageAttachment)
        .sort((a, b) => {
          const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [attachments],
  );

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
        Attachments ({sorted.length})
      </div>
      <div className="flex flex-wrap gap-3">
        {sorted.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() =>
              window.open(
                resolveTaskAttachmentUrl(attachment.url) || attachment.url,
                "_blank",
                "noopener,noreferrer",
              )
            }
            className="group h-[90px] w-[120px] overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow"
            title={attachment.fileName}
          >
            <img
              src={resolveTaskAttachmentUrl(attachment.url) || attachment.url}
              alt={attachment.fileName}
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(AttachmentGalleryInner);
