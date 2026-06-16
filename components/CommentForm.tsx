// components/CommentForm.tsx
// Adds a comment (or a reply, if parentId is set) to a post.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "@/app/actions/comments";

export default function CommentForm({
  postId,
  parentId = null,
  placeholder = "Add a reply…",
  onDone,
}: {
  postId: string;
  parentId?: string | null;
  placeholder?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const text = content.trim();
    if (!text) return;

    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("content", text);
    if (parentId) fd.set("parentId", parentId);

    startTransition(async () => {
      const res = await addComment(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setContent("");
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 1000))}
          placeholder={placeholder}
          rows={1}
          className="min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-background/40 px-3.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <button
          onClick={submit}
          disabled={pending || !content.trim()}
          className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Reply"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
