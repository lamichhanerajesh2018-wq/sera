// app/actions/presence.ts
"use server";

import { touchPresence, getPresence } from "@/lib/presence";
import type { Presence } from "@/lib/presence";

// Called by the client heartbeat to mark the current user active.
export async function ping(): Promise<void> {
  await touchPresence();
}

// Fetch a user's current presence (online + last seen). Used by chat/profile to
// poll for live status.
export async function fetchPresence(username: string): Promise<Presence> {
  return getPresence(username);
}
