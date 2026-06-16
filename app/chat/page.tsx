// app/chat/page.tsx
// Chat inbox: start a new conversation, and a list of existing ones.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listConversations } from "@/app/actions/chat";
import AppBar from "@/components/AppBar";
import StartChat from "@/components/StartChat";

export const metadata = { title: "Chats — Sera" };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function ChatListPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const conversations = await listConversations();

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-display text-2xl font-medium">Chats</h1>

        <StartChat />

        <div className="mt-6 space-y-2">
          {conversations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">💬</p>
              <p className="mt-3 text-sm text-muted-foreground">
                No chats yet. Start one above with someone&apos;s username.
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <Link
                key={c._id}
                href={`/chat/${c._id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-lg">🕶️</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">@{c.otherUsername}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.lastMessage || "No messages yet"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
