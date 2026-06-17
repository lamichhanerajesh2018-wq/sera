// components/PresenceBeacon.tsx
// Invisible heartbeat: marks the signed-in user as "online" by pinging the
// server every 30s while the tab is open and visible. Pauses when the tab is
// hidden (so a backgrounded tab eventually reads as offline) and pings once
// immediately on mount.
"use client";

import { useEffect } from "react";
import { ping } from "@/app/actions/presence";

const INTERVAL_MS = 30 * 1000;

export default function PresenceBeacon() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (document.visibilityState === "visible") {
        ping().catch(() => {});
      }
    };

    beat(); // immediate
    timer = setInterval(beat, INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
