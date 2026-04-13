import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspaceChatExportFile,
  emailWorkspaceChatExportFile,
  WORKSPACE_CHAT_EXPORT_EMAIL_SUCCESS_MESSAGE,
  WORKSPACE_CHAT_EXPORT_MIME_TYPE,
} from "./chat-export-email.ts";

test("createWorkspaceChatExportFile builds an xlsx attachment with the expected filename", () => {
  const file = createWorkspaceChatExportFile(
    "WorkspaceChat_demo.xlsx",
    new Uint8Array([1, 2, 3, 4]),
  );

  assert.equal(file.name, "WorkspaceChat_demo.xlsx");
  assert.equal(file.type, WORKSPACE_CHAT_EXPORT_MIME_TYPE);
  assert.equal(file.size, 4);
});

test("emailWorkspaceChatExportFile sends the export through the provided sender without browser download APIs", async () => {
  let createObjectUrlCalled = false;
  const originalCreateObjectURL = URL.createObjectURL;

  URL.createObjectURL = (() => {
    createObjectUrlCalled = true;
    return "blob:unexpected";
  }) as typeof URL.createObjectURL;

  const calls: Array<{ projectId: string; fileName: string; file: File }> = [];

  const message = await emailWorkspaceChatExportFile(
    {
      projectId: "project-1",
      fileName: "WorkspaceChat_demo.xlsx",
      workbookBuffer: new Uint8Array([10, 20, 30]),
    },
    {
      sendExport: async (projectId, file, fileName) => {
        calls.push({ projectId, file, fileName });
      },
    },
  );

  URL.createObjectURL = originalCreateObjectURL;

  assert.equal(message, WORKSPACE_CHAT_EXPORT_EMAIL_SUCCESS_MESSAGE);
  assert.equal(createObjectUrlCalled, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].projectId, "project-1");
  assert.equal(calls[0].fileName, "WorkspaceChat_demo.xlsx");
  assert.equal(calls[0].file.name, "WorkspaceChat_demo.xlsx");
  assert.equal(calls[0].file.type, WORKSPACE_CHAT_EXPORT_MIME_TYPE);
});

test("emailWorkspaceChatExportFile propagates sender failures so the UI can show an error", async () => {
  await assert.rejects(
    () =>
      emailWorkspaceChatExportFile(
        {
          projectId: "project-1",
          fileName: "WorkspaceChat_demo.xlsx",
          workbookBuffer: new Uint8Array([10, 20, 30]),
        },
        {
          sendExport: async () => {
            throw new Error("SMTP down");
          },
        },
      ),
    /SMTP down/,
  );
});
