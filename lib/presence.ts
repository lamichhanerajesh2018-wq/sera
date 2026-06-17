// lib/presence.ts
// Lightweight "online / last seen" presence, heartbeat-based. The client pings
// touchPresence() on an interval; we store the latest timestamp per user. A user
// is "online" if they pinged within ONLINE_WINDOW. No Pusher presence channel
// needed — this works cleanly on serverless (Vercel) and degrades gracefully.
import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";

// Considered online if seen within the last 60 seconds (clients ping every 30s,
// so this tolerates one missed beat).
export const ONLINE_WINDOW_MS = 60 * 1000;

export interface Presence {
  online: boolean;
  lastSeen: string | null; // ISO, or null if never seen
}

// Record that the current user is active right now. Cheap upsert keyed by the
// user's handle. Best-effort: never throws into the caller.
export async function touchPresence(): Promise<void> {
  try {
    const me = await getCurrentUser();
    if (!me) return;
    const handle = ((me as any).username || "").toLowerCase();
    if (!handle) return;

    await db.collection("presence").updateOne(
      { username: handle },
      { $set: { username: handle, lastSeen: new Date() } },
      { upsert: true }
    );
  } catch {
    // ignore — presence is non-critical
  }
}

// Look up a single user's presence by handle.
export async function getPresence(username: string): Promise<Presence> {
  const handle = (username || "").trim().toLowerCase();
  if (!handle) return { online: false, lastSeen: null };

  try {
    const doc = await db.collection("presence").findOne({ username: handle });
    if (!doc?.lastSeen) return { online: false, lastSeen: null };

    const last = doc.lastSeen instanceof Date ? doc.lastSeen : new Date(doc.lastSeen);
    const online = Date.now() - last.getTime() < ONLINE_WINDOW_MS;
    return { online, lastSeen: last.toISOString() };
  } catch {
    return { online: false, lastSeen: null };
  }
}
