// app/actions/referrals.ts
"use server";

import { db } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/session";

export interface ReferralSummary {
  count: number;
  invitees: { username: string; joinedAt: string | null }[];
}

// Everyone the current user has referred (brought in via their invite link),
// plus the total count. Newest first.
export async function getMyReferrals(): Promise<ReferralSummary> {
  const me = await getCurrentUser();
  if (!me) return { count: 0, invitees: [] };

  const myUsername = ((me as any).username || (me as any).displayUsername || "").toLowerCase();
  if (!myUsername) return { count: 0, invitees: [] };

  const docs = await db
    .collection("user")
    .find({ referredBy: myUsername })
    .sort({ referredAt: -1 })
    .limit(200)
    .toArray();

  const invitees = docs.map((d) => ({
    username: d.username as string,
    joinedAt: d.referredAt
      ? (d.referredAt instanceof Date ? d.referredAt : new Date(d.referredAt)).toISOString()
      : d.createdAt
        ? (d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt)).toISOString()
        : null,
  }));

  return { count: invitees.length, invitees };
}
