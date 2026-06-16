// components/PostComposer.tsx
// The "say something" box at the top of the feed. Posts anonymously under the
// user's handle via the createPost server action, then refreshes the feed.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/app/actions/posts";

const MAX = 2000;

export default function PostComposer({
  handle,
  communitySlug,
}: {
  handle: string;
  communitySlug?: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const text = content.trim();
    if (!text) {
      setError("Say something first.");
      return;
    }

    const formData = new FormData();
    formData.set("content", text);
    if (communitySlug) formData.set("communitySlug", communitySlug);

    startTransition(async () => {
      const res = await createPost(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setContent("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm">
          🕯️
        </span>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX))}
            placeholder={`What's on your mind, ${handle}? No name attached.`}
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-muted-foreground/60"
          />

          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}

          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {content.length}/{MAX}
            </span>
            <button
              onClick={submit}
              disabled={pending || !content.trim()}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
