import type { TaskAttachment } from "../types";

const TASK_ATTACHMENTS_BUCKET = "task-attachments";
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i;

export const isTaskImageAttachment = (attachment: TaskAttachment) => {
  const fileType = `${attachment.fileType || ""}`.toLowerCase();
  const fileName = `${attachment.fileName || ""}`.toLowerCase();
  const url = `${attachment.url || ""}`.toLowerCase();

  return (
    fileType.includes("image/") ||
    fileType === "image" ||
    IMAGE_EXTENSION_PATTERN.test(fileName) ||
    IMAGE_EXTENSION_PATTERN.test(url)
  );
};

export const resolveTaskAttachmentUrl = (rawUrl?: string | null) => {
  const trimmed = `${rawUrl || ""}`.trim();
  if (!trimmed) return null;

  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  const supabaseBaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!supabaseBaseUrl) {
    return trimmed;
  }

  const normalizedPath = trimmed.replace(/^\/+/, "");
  if (normalizedPath.startsWith("storage/v1/object/public/")) {
    return `${supabaseBaseUrl}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith(`${TASK_ATTACHMENTS_BUCKET}/`)) {
    return `${supabaseBaseUrl}/storage/v1/object/public/${normalizedPath}`;
  }

  return `${supabaseBaseUrl}/storage/v1/object/public/${TASK_ATTACHMENTS_BUCKET}/${normalizedPath}`;
};
