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
  // Secure with a shared secret so random people can't trigger it
  const secret = process.env.BOT_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 5), 20); // max 20 per run

  const count = await botCommentOnRecentPosts(limit);

  return NextResponse.json({ ok: true, commented: count });
}

// Also allow Vercel cron (which uses GET)
export async function GET(req: NextRequest) {
  // Vercel cron sends the CRON_SECRET header automatically
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const count = await botCommentOnRecentPosts(5);
  return NextResponse.json({ ok: true, commented: count });
}
