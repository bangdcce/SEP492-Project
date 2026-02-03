import { connectSocket } from "@/shared/realtime/socket";

export type DisputeMessageType =
  | "TEXT"
  | "IMAGE"
  | "FILE"
  | "EVIDENCE_LINK"
  | "SYSTEM_LOG"
  | "SETTLEMENT_PROPOSAL"
  | "ADMIN_ANNOUNCEMENT";

export interface SendDisputeMessagePayload {
  disputeId: string;
  type?: DisputeMessageType;
  content?: string;
  replyToMessageId?: string;
  relatedEvidenceId?: string;
  hearingId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendDisputeMessageAck {
  success: boolean;
  messageId: string;
  disputeId: string;
  hearingId?: string | null;
  createdAt: string;
}

const waitForConnect = (timeoutMs: number) => {
  const socket = connectSocket();
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Socket connection timeout"));
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

export const sendDisputeMessageRealtime = async (
  payload: SendDisputeMessagePayload,
  options?: { timeoutMs?: number },
): Promise<SendDisputeMessageAck> => {
  const timeoutMs = options?.timeoutMs ?? 8000;
  await waitForConnect(timeoutMs);

  const socket = connectSocket();

  return new Promise<SendDisputeMessageAck>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Socket message timeout"));
    }, timeoutMs);

    socket.emit(
      "sendDisputeMessage",
      {
        ...payload,
        type: payload.type ?? "TEXT",
      },
      (response?: SendDisputeMessageAck & { error?: string }) => {
        clearTimeout(timer);
        if (!response) {
          reject(new Error("No acknowledgement received"));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      },
    );
  });
};
