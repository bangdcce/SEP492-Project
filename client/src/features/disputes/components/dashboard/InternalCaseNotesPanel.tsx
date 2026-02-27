import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Link2, Search, StickyNote, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addDisputeNote,
  getDisputeInternalMembers,
  getDisputeMessages,
  getDisputeNotes,
} from "../../api";
import type {
  DisputeNote,
  InternalMember,
  LegacyArchiveMessage,
} from "../../types/dispute.types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { UserRole } from "../../../staff/types/staff.types";
import {
  getApiErrorDetails,
  isSchemaNotReadyErrorCode,
} from "@/shared/utils/apiError";

interface InternalCaseNotesPanelProps {
  disputeId: string;
}

type EvidenceReferenceType = "TASK" | "MILESTONE" | "SPEC";

interface EvidenceReference {
  type: EvidenceReferenceType;
  id: string;
  label: string;
}

interface ActiveReference extends EvidenceReference {
  messageId: string;
  messageCreatedAt?: string;
  senderLabel?: string;
}

const sourceLabel = (source: InternalMember["source"]): string => {
  switch (source) {
    case "ASSIGNED_STAFF":
      return "Assigned staff";
    case "ESCALATED_ADMIN":
      return "Escalated admin";
    case "SUPPORT_INVITED":
      return "Invited support";
    case "ADMIN_DEFAULT":
      return "Admin";
    default:
      return source;
  }
};

const normalizeArchiveMessage = (message: LegacyArchiveMessage): LegacyArchiveMessage => {
  const rawReferences = (message.metadata as { references?: EvidenceReference[] } | null | undefined)
    ?.references;
  const references = Array.isArray(rawReferences)
    ? rawReferences.filter(
        (item): item is EvidenceReference =>
          Boolean(item) &&
          typeof item.type === "string" &&
          typeof item.id === "string" &&
          typeof item.label === "string",
      )
    : [];

  return {
    ...message,
    references,
  };
};

export const InternalCaseNotesPanel = ({
  disputeId,
}: InternalCaseNotesPanelProps) => {
  const [notes, setNotes] = useState<DisputeNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [members, setMembers] = useState<InternalMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [archiveMessages, setArchiveMessages] = useState<LegacyArchiveMessage[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [activeReference, setActiveReference] = useState<ActiveReference | null>(null);
  const [schemaErrorMessage, setSchemaErrorMessage] = useState<string | null>(
    null,
  );
  const schemaToastShownRef = useRef(false);

  const currentUser = useMemo(() => {
    return getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER);
  }, []);

  const canWriteNotes =
    currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.STAFF;

  const handleLoadError = useCallback(
    (error: unknown, fallbackMessage: string, label: string) => {
      const details = getApiErrorDetails(error, fallbackMessage);
      console.error(label, error);

      if (isSchemaNotReadyErrorCode(details.code)) {
        setSchemaErrorMessage(details.message);
        if (!schemaToastShownRef.current) {
          toast.error(details.message);
          schemaToastShownRef.current = true;
        }
        return;
      }

      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
      toast.error(details.code ? `[${details.code}] ${details.message}` : details.message);
    },
    [],
  );

  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const data = await getDisputeNotes(disputeId, true);
      setNotes(data ?? []);
      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
    } catch (error) {
      handleLoadError(error, "Could not load internal notes.", "Failed to load notes:");
    } finally {
      setNotesLoading(false);
    }
  }, [disputeId, handleLoadError]);

  const loadMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const data = await getDisputeInternalMembers(disputeId);
      setMembers(data ?? []);
      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
    } catch (error) {
      handleLoadError(
        error,
        "Could not load internal members.",
        "Failed to load internal members:",
      );
    } finally {
      setMembersLoading(false);
    }
  }, [disputeId, handleLoadError]);

  const loadArchive = useCallback(async () => {
    try {
      setArchiveLoading(true);
      const data = await getDisputeMessages(disputeId, { includeHidden: true });
      const normalized = (data ?? []).map((message) =>
        normalizeArchiveMessage(message as LegacyArchiveMessage),
      );
      setArchiveMessages(normalized);
      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
    } catch (error) {
      handleLoadError(
        error,
        "Could not load archived discussion.",
        "Failed to load archive messages:",
      );
    } finally {
      setArchiveLoading(false);
    }
  }, [disputeId, handleLoadError]);

  useEffect(() => {
    void Promise.all([loadNotes(), loadMembers(), loadArchive()]);
  }, [loadNotes, loadMembers, loadArchive]);

  const handleAddNote = useCallback(async () => {
    const content = noteInput.trim();
    if (!content) {
      toast.error("Please write a note.");
      return;
    }

    try {
      setAddingNote(true);
      const saved = await addDisputeNote(disputeId, {
        content,
        isInternal: true,
        noteType: "GENERAL",
      });
      setNotes((prev) => [saved, ...prev]);
      setNoteInput("");
      toast.success("Internal note added.");
    } catch (error) {
      const details = getApiErrorDetails(error, "Could not add note.");
      console.error("Failed to add internal note:", error);
      toast.error(details.message);
    } finally {
      setAddingNote(false);
    }
  }, [disputeId, noteInput]);

  const filteredArchive = useMemo(() => {
    const keyword = archiveQuery.trim().toLowerCase();
    if (!keyword) return archiveMessages;

    return archiveMessages.filter((message) => {
      const senderLabel =
        message.sender?.fullName || message.sender?.email || message.senderRole || "";
      const content = message.content || "";
      const referenceText = (message.references ?? [])
        .map((item) => `${item.type} ${item.label} ${item.id}`)
        .join(" ");

      const haystack = `${senderLabel} ${content} ${referenceText}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [archiveMessages, archiveQuery]);

  return (
    <div className="space-y-6">
      {schemaErrorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Server schema is not ready</p>
          <p className="mt-1 text-xs text-amber-800">{schemaErrorMessage}</p>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Internal Case Notes</p>
        <p className="mt-1 text-xs text-amber-800">
          Public async dispute chat is retired. New public discussion must happen in Hearing Room.
          This tab is internal workspace + read-only archive.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-teal-600" />
              Internal notes
            </h3>
            <button
              type="button"
              onClick={() => void loadNotes()}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {notesLoading ? (
              <p className="text-sm text-gray-500">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-500">No internal notes yet.</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span className="font-medium text-slate-700">
                      {note.author?.fullName || note.author?.email || note.authorId}
                    </span>
                    <span>
                      {note.createdAt
                        ? new Date(note.createdAt).toLocaleString()
                        : "Unknown time"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))
            )}
          </div>

          {canWriteNotes && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <textarea
                rows={3}
                value={noteInput}
                onChange={(event) => setNoteInput(event.target.value)}
                placeholder="Add internal note for staff/admin/support..."
                className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-teal-500 focus:ring-teal-500"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleAddNote()}
                  disabled={addingNote}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {addingNote ? "Saving..." : "Add note"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600" />
              Internal members
            </h3>
            <button
              type="button"
              onClick={() => void loadMembers()}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {membersLoading ? (
              <p className="text-sm text-gray-500">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-500">No internal members found.</p>
            ) : (
              members.map((member) => (
                <div
                  key={`${member.userId}-${member.source}`}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-slate-800">
                    {member.fullName || member.email || member.userId}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {member.role} - {sourceLabel(member.source)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Archive className="h-4 w-4 text-teal-600" />
              Legacy async archive (read-only)
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Historical dispute-level discussion is kept for audit and evidence reference only.
            </p>
          </div>
          <label className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={archiveQuery}
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="Search content, sender, reference..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {archiveLoading ? (
              <p className="text-sm text-gray-500">Loading archive...</p>
            ) : filteredArchive.length === 0 ? (
              <p className="text-sm text-gray-500">No archived messages found.</p>
            ) : (
              filteredArchive.map((message) => {
                const senderLabel =
                  message.sender?.fullName ||
                  message.sender?.email ||
                  message.senderRole ||
                  "Unknown";

                return (
                  <div
                    key={message.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span className="font-medium text-slate-700">{senderLabel}</span>
                      <span>
                        {message.createdAt
                          ? new Date(message.createdAt).toLocaleString()
                          : "Unknown time"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {message.content || "(empty message)"}
                    </p>

                    {message.references && message.references.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.references.map((reference) => (
                          <button
                            key={`${message.id}-${reference.type}-${reference.id}`}
                            type="button"
                            onClick={() =>
                              setActiveReference({
                                ...reference,
                                messageId: message.id,
                                messageCreatedAt: message.createdAt,
                                senderLabel,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs text-teal-700 hover:bg-teal-100"
                          >
                            <Link2 className="h-3 w-3" />
                            {reference.type}: {reference.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 min-h-[180px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reference preview
            </p>
            {activeReference ? (
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p className="font-medium text-slate-900">
                  {activeReference.type}: {activeReference.label}
                </p>
                <p className="text-xs text-slate-500 break-all">
                  ID: {activeReference.id}
                </p>
                <p className="text-xs text-slate-500">Message: {activeReference.messageId}</p>
                {activeReference.senderLabel && (
                  <p className="text-xs text-slate-500">
                    Sender: {activeReference.senderLabel}
                  </p>
                )}
                {activeReference.messageCreatedAt && (
                  <p className="text-xs text-slate-500">
                    Time: {new Date(activeReference.messageCreatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Click a reference chip in archive messages to inspect details.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
