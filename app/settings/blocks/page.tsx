// app/settings/blocks/page.tsx
// Manage blocked users. Shows everyone the signed-in user has blocked, with an
// unblock control for each.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listBlocks } from "@/app/actions/blocks";
import AppBar from "@/components/AppBar";
import BlockButton from "@/components/BlockButton";

export const metadata = { title: "Blocked users — Sera" };

export default async function BlocksPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const blocks = await listBlocks();

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-medium">Blocked users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Blocked people can&apos;t message, ask, or chat with you.
          </p>
        </div>

        <div className="space-y-2">
          {blocks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">🔕</p>
              <p className="mt-3 text-sm text-muted-foreground">
                You haven&apos;t blocked anyone. You can block someone from their profile.
              </p>
            </div>
          ) : (
            blocks.map((b) => (
              <div
                key={b._id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-base">
                  🕶️
                </span>
                <Link
                  href={`/u/${b.blockedUsername}`}
                  className="flex-1 font-medium transition-colors hover:text-primary"
                >
                  @{b.blockedUsername}
                </Link>
                <BlockButton username={b.blockedUsername} initialBlocked={true} />
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
