// lib/safety-log.ts
// Minimal, privacy-respecting security logging.
//
// We never store a raw IP. We store a SHA-256 hash of (IP + secret), which lets
// us spot patterns (e.g. one source spamming accounts) and respond to a valid
// legal request, without keeping data that directly identifies a person in the
// clear. Entries are meant to be pruned over time (see note below).
//
// This is disclosed to users in the privacy policy — Hush is anonymous to other
// users, but keeps minimal safety logs.
import { createHash } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/mongodb";

// Pull the client IP from common proxy headers (Vercel sets x-forwarded-for).
async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

function hashIp(ip: string): string {
  const secret = process.env.SAFETY_LOG_SALT || "hush-default-salt";
  return createHash("sha256").update(ip + secret).digest("hex");
}

// Exposed for rate limiting: the hashed identifier for the current request's IP.
// Same hashing as safety logs, so we never handle a raw IP outside this module.
export async function currentIpHash(): Promise<string> {
  return hashIp(await getClientIp());
}

// Record a safety event tied to a user. `kind` is e.g. "signup" or "post".
export async function logSafetyEvent(userId: string, kind: string) {
  try {
    const ip = await getClientIp();
    const h = await headers();

    await db.collection("safety_logs").insertOne({
      userId,
      kind,
      ipHash: hashIp(ip),
      // Coarse, non-identifying context that helps with abuse triage.
      userAgent: h.get("user-agent") || "unknown",
      // Country is the most precise location we keep — not city/coords.
      country: h.get("x-vercel-ip-country") || null,
      createdAt: new Date(),
    });
  } catch {
    // Logging must never break the user's action.
  }
}
