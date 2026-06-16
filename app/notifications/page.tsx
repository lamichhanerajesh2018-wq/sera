// app/notifications/page.tsx
// The user's notification feed: every notification they've received, newest
// first, with unread ones visually highlighted. "Mark all read" lives in the
// header. Each row links to the relevant content.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listNotifications } from "@/app/actions/notifications";
import AppBar from "@/components/AppBar";
import MarkAllReadButton from "@/components/MarkAllReadButton";

export const metadata = { title: "Notifications — Sera" };

const ICONS: Record<string, string> = {
  question: "❓",
  reply: "💬",
  message: "✉️",
  answer: "💜",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function NotificationsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const notifications = await listNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-medium">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {notifications.length === 0
                ? "Activity on your posts, questions and chats shows up here."
                : `${notifications.length} notification${notifications.length === 1 ? "" : "s"}` +
                  (unread ? ` · ${unread} unread` : "")}
            </p>
          </div>
          <MarkAllReadButton hasUnread={unread > 0} />
        </div>

        <div className="mt-6 space-y-2">
          {notifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">🔔</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing yet. When someone reacts, replies or messages you, you'll
                see it here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <Link
                key={n._id}
                href={n.link || "#"}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                  n.read
                    ? "border-border bg-card/40 hover:bg-card/70"
                    : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <span className="mt-0.5 text-lg">{ICONS[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 text-foreground">{n.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
