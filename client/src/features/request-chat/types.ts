export type RequestChatAttachment = {
  url: string;
  storagePath?: string | null;
  name: string;
  type: string;
};

export type RequestChatSender = {
  id: string;
  fullName: string;
  role: string | null;
} | null;

export type RequestChatReplySummary = {
  id: string;
  messageType: "USER" | "SYSTEM";
  content: string;
  attachments: RequestChatAttachment[];
  isDeleted: boolean;
  createdAt: string;
  sender: RequestChatSender;
} | null;

export type RequestChatMessage = {
  id: string;
  requestId: string;
  senderId: string | null;
  replyToId: string | null;
  messageType: "USER" | "SYSTEM";
  content: string;
  attachments: RequestChatAttachment[];
  isEdited: boolean;
  editHistory: Array<{
    content: string;
    editedAt: string;
    editorId: string | null;
  }>;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sender: RequestChatSender;
  replyTo: RequestChatReplySummary;
};

export type RequestChatHistoryResponse = {
  success: boolean;
  data: RequestChatMessage[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
};

export type RequestChatMutationResponse = {
  success: boolean;
  data: RequestChatMessage;
};
