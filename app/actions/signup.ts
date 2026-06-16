// app/actions/signup.ts
"use server";

import { randomBytes } from "crypto";
import { generateUniqueUsername } from "@/lib/username";
import { logSafetyEvent } from "@/lib/safety-log";
import { db } from "@/lib/mongodb";

// Step 1 (before signup): hand the client a fresh, unique anonymous handle.
export async function reserveUsername(): Promise<string> {
  return generateUniqueUsername();
}

// Step 2 (after signup succeeds): write the minimal safety log for the new user.
// Called with the new user's id once Better Auth has created the account.
export async function logSignup(username: string) {
  const user = await db.collection("user").findOne({ username });
  if (user) {
    await logSafetyEvent(user._id.toString(), "signup");
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
