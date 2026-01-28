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
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<UploadResponse>(
    "/tasks/upload-attachment",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );

  if (!response?.url) {
    throw new Error("Upload succeeded, but no URL was returned.");
  }

  return response.url;
};
