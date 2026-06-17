// app/admin/reports/page.tsx
// Moderator dashboard. Gated by the admin session cookie (sign in at
// /admin/login). Lists reported content with snapshot + reason, and lets the
// moderator dismiss or remove.
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { listReports } from "@/app/actions/reports";
import { logoutAdmin } from "@/app/actions/admin-auth";
import ReportActions from "@/components/ReportActions";

export const metadata = { title: "Reports — Sera admin" };
export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const STATUS_STYLE: Record<string, string> = {
  open: "border-primary/30 bg-primary/10 text-primary",
  reviewed: "border-border bg-background/40 text-muted-foreground",
  dismissed: "border-border bg-background/40 text-muted-foreground",
};

export default async function AdminReportsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const reports = await listReports();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-xl font-semibold tracking-tight">Reports</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/admin/stats"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Dashboard
            </Link>
            <span className="text-muted-foreground">
              {reports.filter((r) => r.status === "open").length} open
            </span>
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        {reports.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-3xl">🛡️</p>
            <p className="mt-3 font-display text-lg font-medium">All clear</p>
            <p className="mt-1 text-sm text-muted-foreground">No reports right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <div key={r._id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2.5 py-0.5 ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="text-muted-foreground">
                      {r.targetType} · {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">by @{r.authorUsername}</span>
                </div>

                <p className="mt-3 rounded-2xl border border-border bg-background/40 p-3 text-sm leading-6">
                  {r.contentSnapshot || <span className="text-muted-foreground">(no text)</span>}
                </p>

                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  {r.reason}
                </p>

                {r.status === "open" && (
                  <div className="mt-4 flex justify-end">
                    <ReportActions reportId={r._id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
