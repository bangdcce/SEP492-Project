import axios from "axios";

type ApiErrorDetails = {
  code?: string;
  message: string;
};

const SCHEMA_NOT_READY_CODES = new Set<string>([
  "DISPUTE_INTERNAL_MEMBERSHIP_TABLE_MISSING",
  "DISPUTE_HEARING_NOSHOWNOTE_COLUMN_MISSING",
  "DISPUTE_SCHEMA_NOT_READY",
]);

export const isSchemaNotReadyErrorCode = (code?: string): boolean => {
  return Boolean(code && SCHEMA_NOT_READY_CODES.has(code));
};

const resolveStringMessage = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(", ");
    return joined.length > 0 ? joined : null;
  }
  return null;
};

export const getApiErrorDetails = (
  error: unknown,
  fallbackMessage: string,
): ApiErrorDetails => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as
      | {
          code?: string;
          message?:
            | string
            | string[]
            | { code?: string; message?: string | string[]; error?: string };
          error?: string;
        }
      | undefined;

    let code = responseData?.code;
    let message =
      resolveStringMessage(responseData?.message) ??
      resolveStringMessage(responseData?.error) ??
      null;

    if (
      responseData?.message &&
      typeof responseData.message === "object" &&
      !Array.isArray(responseData.message)
    ) {
      code = code ?? responseData.message.code;
      message =
        resolveStringMessage(responseData.message.message) ??
        resolveStringMessage(responseData.message.error) ??
        message;
    }

    if (!message) {
      message = resolveStringMessage(error.message) ?? fallbackMessage;
    }

    return { code, message };
  }

  if (error instanceof Error) {
    return { message: error.message || fallbackMessage };
  }

  return { message: fallbackMessage };
};
