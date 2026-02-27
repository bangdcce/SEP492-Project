import { useCallback, useEffect, useRef } from "react";

/* ─── Types ─── */

type NotificationType =
  | "message"
  | "question"
  | "phase"
  | "warning"
  | "start"
  | "end";

interface NotifyOptions {
  type: NotificationType;
  title: string;
  body?: string;
  /** Also show a browser Notification (requires permission) */
  browser?: boolean;
}

/* ─── Tone generation (Web Audio API) ─── */

const TONE_FREQUENCIES: Record<NotificationType, number[]> = {
  message: [440],
  question: [523, 659],
  phase: [440, 554, 659],
  warning: [330, 330],
  start: [523, 659, 784],
  end: [784, 659, 523],
};

function playTone(frequencies: number[], durationMs = 120) {
  try {
    const ctx = new AudioContext();
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * (durationMs / 1000);
      const stop = start + durationMs / 1000;
      osc.start(start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, stop);
      osc.stop(stop + 0.05);
    });
  } catch {
    /* Audio not available — silent fallback */
  }
}

/* ─── Hook ─── */

export function useHearingNotifications() {
  const permissionRef = useRef<NotificationPermission>("default");

  /* Request notification permission on mount */
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    permissionRef.current = Notification.permission;
    if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    }
  }, []);

  const notify = useCallback(
    ({ type, title, body, browser }: NotifyOptions) => {
      /* Play sound */
      const freqs = TONE_FREQUENCIES[type] ?? TONE_FREQUENCIES.message;
      playTone(freqs);

      /* Browser notification (only if tab is hidden) */
      if (
        browser &&
        document.hidden &&
        typeof Notification !== "undefined" &&
        permissionRef.current === "granted"
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/assets/logo-icon.png",
            tag: `hearing-${type}`,
            requireInteraction: false,
          });
          setTimeout(() => n.close(), 6000);
        } catch {
          /* Notification API blocked */
        }
      }
    },
    [],
  );

  return { notify };
}
