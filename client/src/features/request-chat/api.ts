import { apiClient } from "@/shared/api/client";
import type {
  RequestChatAttachment,
  RequestChatHistoryResponse,
  RequestChatMutationResponse,
} from "./types";

export const fetchRequestChatMessages = async (
  requestId: string,
  query: { limit?: number; offset?: number } = {},
): Promise<RequestChatHistoryResponse> => {
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));

  return apiClient.get<RequestChatHistoryResponse>(
    `/request-chat/requests/${requestId}/messages?${params.toString()}`,
  );
};

export const sendRequestChatMessage = async (
  requestId: string,
  payload: {
    content?: string;
    attachments?: RequestChatAttachment[];
    replyToId?: string;
  },
): Promise<RequestChatMutationResponse> => {
  return apiClient.post<RequestChatMutationResponse>(
    `/request-chat/requests/${requestId}/messages`,
    payload,
  );
};

export const uploadRequestChatAttachments = async (
  requestId: string,
  files: File[],
): Promise<{ success: boolean; data: RequestChatAttachment[] }> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  return apiClient.post(`/request-chat/requests/${requestId}/attachments`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
