// app/api/bot/tip/route.ts
// Send a follow-up feature tip to a specific user (called a few hours after signup).
// POST /api/bot/tip  { "username": "sera-1234" }  + Authorization header

import { NextRequest, NextResponse } from "next/server";
import { sendFeatureTip } from "@/lib/bot";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Deny if BOT_SECRET is not configured or the header doesn't match.
  const secret = process.env.BOT_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json().catch(() => ({}));
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  await sendFeatureTip(username);
  return NextResponse.json({ ok: true });
}
