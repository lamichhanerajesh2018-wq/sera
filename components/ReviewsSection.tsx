// components/ReviewsSection.tsx
// Home-page wall of love — real reviews from real Sera users (shown anonymously).
"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/app/actions/reviews";
import type { Review } from "@/app/actions/reviews";

export default function ReviewsSection({
  reviews,
  isLoggedIn,
}: {
  reviews: Review[];
  isLoggedIn: boolean;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);
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
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      setContent("");
      // Optimistically prepend
      setLocalReviews((prev) => [
        {
          _id: Date.now().toString(),
          content: text,
          authorUsername: "you",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    });
  }

  return (
    <section id="reviews" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
      <div className="mb-14 text-center">
        <p className="eyebrow">Wall of love</p>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          What Sera users say
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
          Real words from real people — shared anonymously, of course.
        </p>
      </div>

      {/* Reviews grid */}
      {localReviews.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {localReviews.map((r) => (
            <div
              key={r._id}
              className="flex h-full flex-col justify-between rounded-3xl border border-border bg-card p-6"
            >
              <p className="text-sm leading-7 text-foreground/90">&ldquo;{r.content}&rdquo;</p>
              <p className="mt-4 text-xs text-muted-foreground">— {r.authorUsername}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          No reviews yet. Be the first!
        </p>
      )}

      {/* Submit form — only for logged-in users */}
      {isLoggedIn && (
        <div className="mx-auto mt-12 max-w-lg">
          {done ? (
            <p className="rounded-2xl border border-primary/30 bg-primary/5 px-6 py-4 text-center text-sm text-primary">
              Thank you for your review! 💜
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-card p-6">
              <p className="mb-3 text-sm font-medium">Leave your review</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you think about Sera?"
                maxLength={280}
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{content.length}/280</span>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={pending || !content.trim()}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit review"}
              </button>
            </form>
          )}
        </div>
      )}

      {!isLoggedIn && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          <a href="/signup" className="text-primary hover:underline">Join Sera</a> to leave a review.
        </p>
      )}
    </section>
  );
}
