import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/shared/api/client";

/**
 * Periodically syncs with the server clock and exposes a corrected `nowMs`
 * that ticks every second locally but is adjusted by the measured offset.
 *
 * offset = serverTime − clientTime  (positive ⇒ server is ahead)
 *
 * Usage:
 *   const nowMs = useServerTimeSync();
 *   // nowMs ≈ Date.now() + offset
 */
export function useServerTimeSync(intervalMs = 60_000): number {
  const [offset, setOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const syncing = useRef(false);

  // Sync once on mount and then every `intervalMs`
  useEffect(() => {
    const sync = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const t0 = Date.now();
        const res = await apiClient.get<{ serverTime: string }>("/server-time");
        const t1 = Date.now();
        const serverMs = new Date(
          (res as { serverTime: string }).serverTime,
        ).getTime();
        const rtt = t1 - t0;
        // Estimated server time at the midpoint of the request
        const newOffset = serverMs - (t0 + rtt / 2);
        setOffset(newOffset);
      } catch {
        // silent — keep previous offset
      } finally {
        syncing.current = false;
      }
    };

    void sync();
    const id = window.setInterval(sync, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  // Tick every second with offset correction
  useEffect(() => {
    const tick = () => setNowMs(Date.now() + offset);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offset]);

  return nowMs;
}
