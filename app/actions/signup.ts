// app/actions/signup.ts
"use server";

import { randomBytes } from "crypto";
import { generateUniqueUsername } from "@/lib/username";
import { logSafetyEvent } from "@/lib/safety-log";
import { db } from "@/lib/mongodb";
import { sendWelcomeMessage } from "@/lib/bot";

// Step 1 (before signup): hand the client a fresh, unique anonymous handle.
export async function reserveUsername(): Promise<string> {
  return generateUniqueUsername();
}

// Step 2 (after signup succeeds): write the minimal safety log for the new user,
// and — if they arrived via an invite link (?ref=) — record the referral.
// Called with the new user's username once Better Auth has created the account.
export async function logSignup(username: string, ref?: string) {
  const user = await db.collection("user").findOne({ username });
  if (!user) return;

  await logSafetyEvent(user._id.toString(), "signup");

  // Send AI welcome message (best-effort, non-blocking)
  sendWelcomeMessage(username).catch(() => {});

  // Referral linking is best-effort — never block or fail signup over it.
  try {
    const refHandle = (ref ?? "").trim().toLowerCase();
    if (!refHandle || refHandle === username.toLowerCase()) return; // no self-referral

    const referrer = await db.collection("user").findOne({ username: refHandle });
    if (!referrer) return;

    // Only set once, and only if not already referred.
    if (user.referredBy) return;

    await db.collection("user").updateOne(
      { _id: user._id },
      { $set: { referredBy: referrer.username, referredAt: new Date() } }
    );
    await db.collection("user").updateOne(
      { _id: referrer._id },
      { $inc: { referralCount: 1 } }
    );
  } catch {
    // ignore — the account already exists and works regardless
  }
}

// ---- pure-anonymous signup support --------------------------------------

// Credentials for a no-email account. The placeholder email satisfies Better
// Auth's email/password requirement but is never real; the password IS the
// recovery code shown to the user once. We format the code in readable groups.
export interface AnonCredentials {
  username: string;
  email: string; // placeholder @anon.sera.local — never receives mail
  password: string; // the recovery code, shown to the user exactly once
}

function formatRecoveryCode(raw: string): string {
  // 16 hex chars → "XXXX-XXXX-XXXX-XXXX" for easier copying.
  return raw.match(/.{1,4}/g)?.join("-").toUpperCase() ?? raw.toUpperCase();
}

// Build a fresh anonymous credential set. The client uses these to call
// authClient.signUp.email, then shows the recovery code to the user.
export async function createAnonCredentials(): Promise<AnonCredentials> {
  const username = await generateUniqueUsername();
  // 8 bytes → 16 hex chars of entropy. Plenty for a recovery secret.
  const code = formatRecoveryCode(randomBytes(8).toString("hex"));
  // Placeholder email is derived from the handle so it's unique and obviously
  // fake. It never receives mail (auth.ts skips sending for this domain).
  const email = `${username}@anon.sera.local`;
  return { username, email, password: code };
}
