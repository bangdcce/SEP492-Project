import { apiClient } from "@/shared/api/client";

type UploadOptions = {
  bucket?: string;
  pathPrefix?: string;
};

type UploadResponse = {
  url: string;
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

  return response.url;
};
