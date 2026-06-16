// app/feed/page.tsx
// The public confessions feed. Anyone can READ it (Reddit-style); posting,
// liking, commenting and messaging require an account. Signed-in users get the
// full app bar + composer; guests get a branded header and a sign-up nudge.
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listFeed } from "@/app/actions/posts";
import AppBar from "@/components/AppBar";
import Logo from "@/components/Logo";
import PostComposer from "@/components/PostComposer";
import PostCard from "@/components/PostCard";
import FeedSidebarLeft from "@/components/FeedSidebarLeft";
import FeedSidebarRight from "@/components/FeedSidebarRight";
import { listCommunities, listMyCommunities } from "@/app/actions/communities";

// Auth state must be read fresh per request, never served from a cached render,
// or a guest-cached page can hydrate against a signed-in client (and vice-versa).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Confessions — Sera",
  description: "Anonymous confessions from the Sera community. Read freely.",
};

export default async function FeedPage() {
  const user = await getCurrentUser();
  const handle = user
    ? (user as any).username || (user as any).displayUsername || "anon"
    : null;
  const [posts, communities, myCommunities] = await Promise.all([
    listFeed(),
    listCommunities(),
    listMyCommunities(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Signed-in: full app bar. Guest: simple branded header. */}
      {handle ? (
        <AppBar handle={handle} />
      ) : (
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
            <Logo href="/" size="sm" />
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/login"
                className="rounded-full px-4 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Join free
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* 3-column shell: nav rail | feed | discovery rail. Rails collapse below 1024px. */}
      <div
        className="feed-shell mx-auto w-full max-w-6xl px-4 py-6"
        style={{ display: "grid", gridTemplateColumns: "13rem minmax(0,1fr) 20rem", gap: "1.5rem" }}
      >
        <FeedSidebarLeft
          handle={handle}
          myCommunities={myCommunities}
          popularCommunities={communities}
        />

        <main className="min-w-0">
        {handle ? (
          <PostComposer handle={handle} />
        ) : (
          <div className="rounded-3xl border border-border bg-card p-5 text-center">
            <p className="font-display text-lg font-medium">Got something to confess?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an anonymous identity to post, react and reply. No real name needed.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get your anonymous ID
            </Link>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <p className="text-3xl">🕯️</p>
              <p className="mt-3 font-display text-lg font-medium">It&apos;s quiet in here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No confessions yet. Be the first to say something.
              </p>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post._id} post={post} readOnly={!handle} />)
          )}
        </div>
        </main>

        <FeedSidebarRight communities={communities} signedIn={!!handle} />
      </div>
    </div>
  );
}
