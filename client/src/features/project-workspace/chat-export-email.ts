export const WORKSPACE_CHAT_EXPORT_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const WORKSPACE_CHAT_EXPORT_EMAIL_SUCCESS_MESSAGE =
  "Your chat log export has been emailed to you. Check your inbox.";

export interface WorkspaceChatExportEmailDeps {
  sendExport: (projectId: string, file: File, fileName: string) => Promise<unknown>;
}

export interface WorkspaceChatExportEmailInput {
  projectId: string;
  fileName: string;
  workbookBuffer: ArrayBuffer | Uint8Array;
}

export const createWorkspaceChatExportFile = (
  fileName: string,
  workbookBuffer: ArrayBuffer | Uint8Array,
): File =>
  new File(
    [workbookBuffer instanceof Uint8Array ? Uint8Array.from(workbookBuffer) : workbookBuffer],
    fileName,
    {
      type: WORKSPACE_CHAT_EXPORT_MIME_TYPE,
    },
  );

export const emailWorkspaceChatExportFile = async (
  input: WorkspaceChatExportEmailInput,
  deps: WorkspaceChatExportEmailDeps,
): Promise<string> => {
  const file = createWorkspaceChatExportFile(input.fileName, input.workbookBuffer);
  await deps.sendExport(input.projectId, file, input.fileName);
  return WORKSPACE_CHAT_EXPORT_EMAIL_SUCCESS_MESSAGE;
};
