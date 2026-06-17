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

// Format a count for display: small numbers exact, larger ones rounded with a
// "+" (e.g. 12,345 → "12,000+"). Keeps the homepage honest but tidy.
export function formatStat(n: number): string {
  if (n < 10) return String(n);
  if (n < 100) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`;
  if (n < 1_000_000) return `${(Math.floor(n / 1000) * 1000).toLocaleString()}+`;
  return `${(n / 1_000_000).toFixed(1)}M+`;
}
