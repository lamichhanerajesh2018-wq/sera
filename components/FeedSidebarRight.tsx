// components/FeedSidebarRight.tsx
// Discovery rail shown on the right of the feed (desktop only). Lists the most
// active communities and a quiet reminder about how anonymity works on Sera.
// Visible to guests and signed-in users alike.
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import JoinButton from "@/components/JoinButton";
import { submitReview } from "@/app/actions/reviews";
import type { Community } from "@/lib/types";

function ReviewWidget() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setError(null);
    const fd = new FormData();
    fd.set("content", text);
    startTransition(async () => {
      const res = await submitReview({}, fd);
      if (res?.error) { setError(res.error); return; }
      setDone(true);
    });
  }

  if (done) {
    return (
      <section className="rounded-3xl border border-primary/30 bg-primary/5 p-4 text-center text-xs text-primary">
        💜 Thanks for your review!
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold">
        <span>⭐</span> Leave a review
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 w-full rounded-2xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Share what you think about Sera →
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-2 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you think about Sera?"
            maxLength={280}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-2xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{content.length}/280</span>
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={pending || !content.trim()}
            className="w-full rounded-full bg-primary py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}
    </section>
  );
}

export default function FeedSidebarRight({
  communities,
  signedIn,
}: {
  communities: Community[];
  signedIn: boolean;
}) {
  const top = communities.slice(0, 5);

  return (
    <aside className="feed-rail">
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

        {/* Leave a review — only for signed-in users */}
        {signedIn && <ReviewWidget />}

        <p className="px-2 text-[11px] leading-relaxed text-muted-foreground/70">
          Sera ·{" "}
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
          <Link href="/guidelines" className="hover:text-foreground">Guidelines</Link> ·{" "}
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </p>
      </div>
    </aside>
  );
}
