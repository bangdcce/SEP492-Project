import { useCallback, useRef, useState } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface TypingUser {
  userId: string;
  userName?: string;
  /** when the typing event was last received */
  lastSeen: number;
}

/**
 * Manages typing indicator state.
 * - Emits HEARING_TYPING events when the current user types
 * - Tracks other users' typing state with auto-expiry
 */
export function useTypingIndicator(
  hearingId: string | undefined,
  currentUserId: string | undefined,
) {
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(
    new Map(),
  );
  const lastEmitRef = useRef(0);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Emit typing signal (debounced at 2s) ── */
  const emitTyping = useCallback(() => {
    if (!hearingId || !currentUserId) return;
    const now = Date.now();
    if (now - lastEmitRef.current < 2000) return;
    lastEmitRef.current = now;

    try {
      const socket = connectSocket();
      socket.emit("HEARING_TYPING", {
        hearingId,
        userId: currentUserId,
        isTyping: true,
      });
    } catch {
      /* socket unavailable */
    }
  }, [hearingId, currentUserId]);

  /* ── Handle incoming typing event ── */
  const handleTyping = useCallback(
    (payload: { userId: string; userName?: string; isTyping: boolean }) => {
      if (!payload?.userId || payload.userId === currentUserId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (payload.isTyping) {
          next.set(payload.userId, {
            userId: payload.userId,
            userName: payload.userName,
            lastSeen: Date.now(),
          });
        } else {
          next.delete(payload.userId);
        }
        return next;
      });

      /* Set up expiry check (4s timeout) */
      if (!expiryTimerRef.current) {
        expiryTimerRef.current = setInterval(() => {
          const now = Date.now();
          setTypingUsers((prev) => {
            const next = new Map(prev);
            let changed = false;
            for (const [uid, t] of next) {
              if (now - t.lastSeen > 4000) {
                next.delete(uid);
                changed = true;
              }
            }
            if (next.size === 0 && expiryTimerRef.current) {
              clearInterval(expiryTimerRef.current);
              expiryTimerRef.current = null;
            }
            return changed ? next : prev;
          });
        }, 2000);
      }
    },
    [currentUserId],
  );

  const typingList = Array.from(typingUsers.values());

  return { typingList, emitTyping, handleTyping };
}
