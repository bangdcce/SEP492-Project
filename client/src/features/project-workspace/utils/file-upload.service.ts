import { apiClient } from "@/shared/api/client";

type UploadOptions = {
  bucket?: string;
  pathPrefix?: string;
};

export type UploadResponse = {
  url: string;
  fileName?: string;
  fileType?: string;
};

const appendFileNameToUrl = (url: string, fileName: string) => {
  const normalizedUrl = String(url || "").trim();
  const normalizedFileName = String(fileName || "").trim();
  if (!normalizedUrl || !normalizedFileName) {
    return normalizedUrl;
  }

  const separator = normalizedUrl.includes("#") ? "&" : "#";
  return `${normalizedUrl}${separator}filename=${encodeURIComponent(normalizedFileName)}`;
};

export const uploadImageToServer = async (
  file: File,
  _options: UploadOptions = {}
) => {
  if (!(file instanceof Blob)) {
    throw new Error("Upload failed: invalid file payload.");
  }

  const formData = new FormData();
  const fileName = file instanceof File && file.name ? file.name : "image-upload";
  formData.append("file", file, fileName);

  // Let the browser set multipart/form-data boundary automatically.
  const response = await apiClient.post<UploadResponse>("/tasks/upload-attachment", formData);

  if (!response?.url) {
    throw new Error("Upload succeeded, but no URL was returned.");
  }

  return {
    url: response.url,
    fileName: response.fileName?.trim() || fileName,
    fileType: response.fileType?.trim() || file.type || "application/octet-stream",
  };
};

export const buildDisplaySafeUploadUrl = (upload: {
  url: string;
  fileName?: string;
}) => appendFileNameToUrl(upload.url, upload.fileName || "");
