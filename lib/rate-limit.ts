// lib/rate-limit.ts
// Lightweight, MongoDB-backed rate limiting keyed on the hashed client IP.
// Used to keep anonymous (no-login) message sending from being abused, without
// ever storing a raw IP. We just count recent "ask" events in a time window.
//
// Two limits are enforced together:
//   - per IP overall:        10 messages / 10 minutes
//   - per IP per recipient:   5 messages / 10 minutes  (stops targeted spam)
import { db } from "@/lib/mongodb";
import { currentIpHash } from "@/lib/safety-log";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_IP = 10;
const MAX_PER_IP_RECIPIENT = 5;

interface RateResult {
  ok: boolean;
  reason?: string;
}

// Check + record an anonymous-ask attempt. Returns ok:false if either limit is
// exceeded. On success it logs the attempt so it counts toward the window.
export async function checkAskRateLimit(recipientId: string): Promise<RateResult> {
  try {
    const ipHash = await currentIpHash();
    const since = new Date(Date.now() - WINDOW_MS);
    const coll = db.collection("ask_rate");

    const [ipCount, pairCount] = await Promise.all([
      coll.countDocuments({ ipHash, createdAt: { $gte: since } }),
      coll.countDocuments({ ipHash, recipientId, createdAt: { $gte: since } }),
    ]);

    if (pairCount >= MAX_PER_IP_RECIPIENT) {
      return {
        ok: false,
        reason: "You're sending messages to this person too quickly. Try again in a bit.",
      };
    }
    if (ipCount >= MAX_PER_IP) {
      return {
        ok: false,
        reason: "You're sending messages too quickly. Please slow down and try again soon.",
      };
    }

    // Record this attempt. A TTL index on createdAt (set up once in Mongo) can
    // auto-expire these; even without it, the window query keeps counts correct.
    await coll.insertOne({ ipHash, recipientId, createdAt: new Date() });
    return { ok: true };
  } catch {
    // On any infra error, fail open — never block a genuine user because the
    // rate-limit store had a hiccup.
    return { ok: true };
  }
}
