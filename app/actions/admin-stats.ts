// app/actions/admin-stats.ts
// Read-only stats for the private admin dashboard. Gated by the same shared
// ADMIN_SECRET as the reports dashboard (passed as ?key= in the URL). Returns a
// snapshot of users, activity and content counts.
"use server";

import { db } from "@/lib/mongodb";
import { ONLINE_WINDOW_MS } from "@/lib/presence";

function requireAdmin(adminKey: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && adminKey === secret;
}

export interface AdminStats {
  totalUsers: number;
  newToday: number;
  new7d: number;
  onlineNow: number; // active within the presence window (~1 min)
  active24h: number; // seen at least once in the last 24h
  emailUsers: number; // accounts with a real (recoverable) email
  anonUsers: number; // pure-anonymous accounts (placeholder email)
  posts: number;
  comments: number;
  messages: number;
  conversations: number;
  communities: number;
  questions: number;
  openReports: number;
  // Last 7 days of signups, oldest→newest, for a tiny bar chart.
  signupsByDay: { day: string; count: number }[];
}

export async function getAdminStats(adminKey: string): Promise<AdminStats | null> {
  if (!requireAdmin(adminKey)) return null;

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const onlineSince = new Date(now - ONLINE_WINDOW_MS);

  const users = db.collection("user");
  const presence = db.collection("presence");

  const [
    totalUsers,
    newToday,
    new7d,
    onlineNow,
    active24h,
    anonUsers,
    posts,
    comments,
    messages,
    conversations,
    communities,
    questions,
    openReports,
  ] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ createdAt: { $gte: startOfToday } }),
    users.countDocuments({ createdAt: { $gte: weekAgo } }),
    presence.countDocuments({ lastSeen: { $gte: onlineSince } }),
    presence.countDocuments({ lastSeen: { $gte: dayAgo } }),
    users.countDocuments({ email: { $regex: /@anon\.sera\.local$/ } }),
    db.collection("posts").countDocuments({}),
    db.collection("comments").countDocuments({}),
    db.collection("messages").countDocuments({}),
    db.collection("conversations").countDocuments({}),
    db.collection("communities").countDocuments({}),
    db.collection("questions").countDocuments({}),
    db.collection("reports").countDocuments({ status: "open" }),
  ]);

  // Signups per day for the last 7 days.
  const signupAgg = await users
    .aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const countByDay = new Map<string, number>();
  for (const row of signupAgg) countByDay.set(row._id as string, row.count as number);

  const signupsByDay: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: "short" });
    signupsByDay.push({ day: label, count: countByDay.get(key) ?? 0 });
  }

  return {
    totalUsers,
    newToday,
    new7d,
    onlineNow,
    active24h,
    emailUsers: totalUsers - anonUsers,
    anonUsers,
    posts,
    comments,
    messages,
    conversations,
    communities,
    questions,
    openReports,
    signupsByDay,
  };
}
