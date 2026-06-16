// components/FeedSidebarRight.tsx
// Discovery rail shown on the right of the feed (desktop only). Lists the most
// active communities and a quiet reminder about how anonymity works on Sera.
// Visible to guests and signed-in users alike.
import Link from "next/link";
import JoinButton from "@/components/JoinButton";
import type { Community } from "@/lib/types";

export default function FeedSidebarRight({
  communities,
  signedIn,
}: {
  communities: Community[];
  signedIn: boolean;
}) {
  const top = communities.slice(0, 5);

  return (
    <aside className="feed-rail" style={{ display: "block" }}>
      <div className="sticky top-24 space-y-4">
        {/* Discover groups */}
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Discover groups</h2>
            <Link
              href={signedIn ? "/communities" : "/signup"}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              + New
            </Link>
          </div>

          <div className="mt-3 space-y-1">
            {top.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No groups yet.
              </p>
            ) : (
              top.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between gap-2 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/40"
                >
                  <Link href={`/c/${c.slug}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                    </p>
                  </Link>
                  {signedIn ? (
                    <JoinButton communityId={c._id} initialJoined={!!c.isMember} />
                  ) : (
                    <Link
                      href="/signup"
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Join
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>

          {top.length > 0 && (
            <Link
              href="/communities"
              className="mt-1 block px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              See all groups →
            </Link>
          )}
        </section>

        {/* Safe-space reminder */}
        <section className="rounded-3xl border border-border bg-card/50 p-4">
          <p className="flex items-center gap-2 font-display text-sm font-semibold">
            <span>🕯️</span> A quiet, safe space
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            No real names, ever. Your identity is a random <code className="text-foreground/80">@sera-XXXX</code> handle.
            We hash IPs with a salt for safety — raw addresses are never stored.
          </p>
        </section>

        <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/70">
          Sera ·{" "}
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
          <Link href="/guidelines" className="hover:text-foreground">Guidelines</Link>
        </p>
      </div>
    </aside>
  );
}
