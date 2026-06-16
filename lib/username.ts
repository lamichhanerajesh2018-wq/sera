// lib/username.ts
// Generates anonymous handles in the form "sera-3540". Users never pick their
// own name — everyone is assigned one, keeping identities uniform and unlinkable.
import { db } from "@/lib/mongodb";

function randomHandle(): string {
  // 4-digit number → "sera-3540". 9000 combos per attempt; we retry on collision.
  const n = Math.floor(1000 + Math.random() * 9000);
  return `sera-${n}`;
}

// Returns a handle not already taken. Falls back to a longer number if the
// small space ever fills up.
export async function generateUniqueUsername(): Promise<string> {
  const users = db.collection("user");

  for (let i = 0; i < 12; i++) {
    const handle = randomHandle();
    const existing = await users.findOne({ username: handle });
    if (!existing) return handle;
  }

  // Extremely unlikely fallback: wider range.
  for (let i = 0; i < 12; i++) {
    const handle = `sera-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await users.findOne({ username: handle });
    if (!existing) return handle;
  }

  // Last resort: timestamp-based, effectively always unique.
  return `sera-${Date.now().toString().slice(-7)}`;
}
