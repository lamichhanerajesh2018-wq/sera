// components/PresenceDot.tsx
// Shows another user's live presence: a green dot when online, otherwise a muted
// "last seen …" label. Polls every 30s so the status stays fresh while viewing
// a chat or profile. Variant controls how much detail is shown.
"use client";

import { useEffect, useState } from "react";
import { fetchPresence } from "@/app/actions/presence";
import type { Presence } from "@/lib/presence";

const POLL_MS = 30 * 1000;

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "Offline";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Last seen just now";
  if (m < 60) return `Last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Last seen ${h}h ago`;
  const d = Math.floor(h / 24);
  return `Last seen ${d}d ago`;
}

export default function PresenceDot({
  username,
  initial,
  variant = "label",
}: {
  username: string;
  initial?: Presence;
  // "label" → dot + text; "dot" → just the dot (for compact spots like avatars)
  variant?: "label" | "dot";
}) {
  const [presence, setPresence] = useState<Presence>(
    initial ?? { online: false, lastSeen: null }
  );

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const p = await fetchPresence(username);
        if (alive) setPresence(p);
      } catch {
        // keep last value
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [username]);

  if (variant === "dot") {
    return (
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background ${
          presence.online ? "bg-green-500" : "bg-muted-foreground/40"
        }`}
        title={presence.online ? "Online" : lastSeenLabel(presence.lastSeen)}
        aria-label={presence.online ? "Online" : "Offline"}
      />
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          presence.online ? "bg-green-500" : "bg-muted-foreground/40"
        }`}
      />
      {presence.online ? (
        <span className="text-green-500">Online</span>
      ) : (
        lastSeenLabel(presence.lastSeen)
      )}
    </span>
  );
}
