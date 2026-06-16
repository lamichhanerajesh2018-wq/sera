// app/communities/page.tsx
// Browse and create communities.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listCommunities } from "@/app/actions/communities";
import AppBar from "@/components/AppBar";
import CreateCommunity from "@/components/CreateCommunity";
import JoinButton from "@/components/JoinButton";

export const metadata = { title: "Communities — Sera" };

export default async function CommunitiesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const communities = await listCommunities();

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-medium">Communities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spaces for anything — a feeling, a fandom, a secret.
          </p>
        </div>

        <CreateCommunity />

        <div className="mt-6 space-y-3">
          {communities.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <p className="text-3xl">🌐</p>
              <p className="mt-3 text-sm text-muted-foreground">
                No communities yet. Start the first one above.
              </p>
            </div>
          ) : (
            communities.map((c) => (
              <div
                key={c._id}
                className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5"
              >
                <Link href={`/c/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl">
                    🌐
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-medium">{c.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.description || `${c.memberCount} ${c.memberCount === 1 ? "member" : "members"}`}
                    </p>
                  </div>
                </Link>
                <JoinButton communityId={c._id} initialJoined={!!c.isMember} />
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
