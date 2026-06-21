// app/api/bot/comment/route.ts
// Trigger the AI bot to comment on recent feed posts.
// Call this from a Vercel cron job or manually:
//   POST /api/bot/comment   (with Authorization: Bearer <BOT_SECRET>)
//
// Vercel cron example (vercel.json):
//   { "crons": [{ "path": "/api/bot/comment", "schedule": "0 */6 * * *" }] }

import { NextRequest, NextResponse } from "next/server";
import { botCommentOnRecentPosts } from "@/lib/bot";

export const runtime = "nodejs";
export const maxDuration = 60; // allow time for multiple GPT calls

export async function POST(req: NextRequest) {
  // Deny if BOT_SECRET is not configured or the header doesn't match.
  const secret = process.env.BOT_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 5), 20); // max 20 per run

  const count = await botCommentOnRecentPosts(limit);

  return NextResponse.json({ ok: true, commented: count });
}

// Also allow Vercel cron (which uses GET)
export async function GET(req: NextRequest) {
  // Vercel cron sends CRON_SECRET automatically. Deny if not configured or mismatched.
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await botCommentOnRecentPosts(5);
  return NextResponse.json({ ok: true, commented: count });
}
