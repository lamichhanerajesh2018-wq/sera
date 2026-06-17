// app/actions/public-stats.ts
// Public, non-sensitive counts for the marketing homepage. These are aggregate
// totals only (no user data), safe to show to anyone. Numbers are real — read
// live from the database — so the homepage never shows invented figures.
"use server";

import { db } from "@/lib/mongodb";

export interface PublicStats {
  posts: number;
  conversations: number;
  communities: number;
  users: number;
}

export async function getPublicStats(): Promise<PublicStats> {
  try {
    const [posts, conversations, communities, users] = await Promise.all([
      db.collection("posts").countDocuments({}),
      db.collection("conversations").countDocuments({}),
      db.collection("communities").countDocuments({}),
      db.collection("user").countDocuments({}),
    ]);
    return { posts, conversations, communities, users };
  } catch {
    return { posts: 0, conversations: 0, communities: 0, users: 0 };
  }
}
