// app/admin/stats/page.tsx
// Private admin dashboard. Gated by ?key=ADMIN_SECRET in the URL (same secret as
// the reports page). Shows user counts, activity, and content totals at a glance.
import Link from "next/link";
import { getAdminStats } from "@/app/actions/admin-stats";

export const metadata = { title: "Dashboard — Sera admin" };

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-medium ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const adminKey = key ?? "";

  const stats = await getAdminStats(adminKey);

  if (!stats) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-medium">Admin access</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Add <code>?key=YOUR_ADMIN_SECRET</code> to the URL to view the dashboard.
        </p>
      </main>
    );
  }

  const maxSignup = Math.max(1, ...stats.signupsByDay.map((d) => d.count));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-xl font-semibold tracking-tight">Dashboard</h1>
          <Link
            href={`/admin/reports?key=${encodeURIComponent(adminKey)}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Reports{stats.openReports > 0 ? ` (${stats.openReports})` : ""} →
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        {/* People */}
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">People</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total users" value={stats.totalUsers} accent />
          <Stat label="Online now" value={stats.onlineNow} sub="active in last minute" accent />
          <Stat label="Active 24h" value={stats.active24h} />
          <Stat label="New today" value={stats.newToday} sub={`${stats.new7d} this week`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Email accounts" value={stats.emailUsers} sub="recoverable" />
          <Stat label="Anonymous" value={stats.anonUsers} sub="no email" />
        </div>

        {/* Signups chart */}
        <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">
          Signups · last 7 days
        </h2>
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex h-40 items-end justify-between gap-2">
            {stats.signupsByDay.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{d.count}</span>
                <div
                  className="w-full rounded-t-lg bg-primary/70"
                  style={{ height: `${(d.count / maxSignup) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                />
                <span className="text-[11px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">Content</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Confessions" value={stats.posts} />
          <Stat label="Comments" value={stats.comments} />
          <Stat label="Communities" value={stats.communities} />
          <Stat label="Messages" value={stats.messages} />
          <Stat label="Conversations" value={stats.conversations} />
          <Stat label="Q&A questions" value={stats.questions} />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/60">
          Live snapshot · refresh to update
        </p>
      </main>
    </div>
  );
}
