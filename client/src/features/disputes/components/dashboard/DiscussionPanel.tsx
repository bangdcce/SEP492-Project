import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Lock, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  addDisputeNote,
  getDisputeNotes,
  sendDisputeMessage,
} from "../../api";
import type { DisputeNote } from "../../types/dispute.types";
import { STORAGE_KEYS } from "@/constants";
import { UserRole } from "../../../staff/types/staff.types";

interface DiscussionPanelProps {
  disputeId: string;
}

export const DiscussionPanel = ({ disputeId }: DiscussionPanelProps) => {
  const [notes, setNotes] = useState<DisputeNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [localMessages, setLocalMessages] = useState<
    { id: string; content: string; createdAt: string }[]
  >([]);

  const currentUserRole = useMemo(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { role?: UserRole };
      return parsed.role ?? null;
    } catch {
      return null;
    }
  }, []);

  const canViewInternal =
    currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;

  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const data = await getDisputeNotes(disputeId, canViewInternal);
      setNotes(data ?? []);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setNotesLoading(false);
    }
  }, [disputeId, canViewInternal]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNote = async () => {
    if (!noteInput.trim()) {
      toast.error("Please write a note.");
      return;
    }

    try {
      setAddingNote(true);
      const saved = await addDisputeNote(disputeId, {
        content: noteInput.trim(),
        isInternal: true,
        noteType: "GENERAL",
      });
      setNotes((prev) => [saved, ...prev]);
      setNoteInput("");
      toast.success("Note added.");
    } catch (error) {
      console.error("Failed to add note:", error);
      toast.error("Could not add note.");
    } finally {
      setAddingNote(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) {
      toast.error("Please enter a message.");
      return;
    }

    try {
      setSendingMessage(true);
      await sendDisputeMessage(disputeId, { content: messageInput.trim() });
      setLocalMessages((prev) => [
        {
          id: `local-${Date.now()}`,
          content: messageInput.trim(),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMessageInput("");
      toast.success("Message sent.");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Could not send message.");
    } finally {
      setSendingMessage(false);
    }
  };

  const isLocked = false;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-teal-600" />
            Internal Notes
          </h3>
        </div>
        <div className="mt-4 space-y-3">
          {notesLoading ? (
            <p className="text-sm text-gray-500">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-500">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="border border-gray-100 bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{note.author?.fullName || note.authorId}</span>
                  <span>
                    {note.createdAt
                      ? format(new Date(note.createdAt), "MMM d, yyyy h:mm a")
                      : "Unknown"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2">{note.content}</p>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 border-t border-gray-100 pt-3">
          <textarea
            rows={3}
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            placeholder="Add an internal note for staff..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-teal-500 focus:border-teal-500"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleAddNote}
              disabled={addingNote}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {addingNote ? "Saving..." : "Add note"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col h-[520px] bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
          {localMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              Message history is available via realtime events.
            </div>
          ) : (
            localMessages.map((message) => (
              <div key={message.id} className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shrink-0">
                  Y
                </div>
                <div className="bg-teal-50 p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] border border-teal-100">
                  <p className="text-sm text-gray-800">{message.content}</p>
                  <span className="text-xs text-teal-600/60 mt-1 block">
                    {format(new Date(message.createdAt), "h:mm a")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {isLocked && (
          <div className="bg-amber-50 border-y border-amber-200 p-3 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-amber-800 font-medium">
              Chat locked. Please resolve pending actions first.
            </p>
          </div>
        )}

        <div className="p-4 bg-white relative">
          <div className="relative">
            <input
              type="text"
              placeholder={
                isLocked ? "Action required to unlock chat..." : "Type your message..."
              }
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              disabled={isLocked || sendingMessage}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSendMessage}
              disabled={isLocked || sendingMessage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
