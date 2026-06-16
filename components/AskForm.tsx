// components/AskForm.tsx
// Send an anonymous question to a specific user. The asker is signed in but
// stays anonymous to the recipient.
"use client";

import { useState, useTransition } from "react";
import { askQuestion } from "@/app/actions/questions";

export default function AskForm({ username }: { username: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const text = content.trim();
    if (!text) {
      setError("Write a question first.");
      return;
    }

    startTransition(async () => {
      const res = await askQuestion(username, text);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setContent("");
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <p className="text-3xl">🕊️</p>
        <p className="mt-3 font-display text-lg font-medium">Sent anonymously</p>
        <p className="mt-1 text-sm text-muted-foreground">
          @{username} will never know it was you.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-5 rounded-full border border-border px-5 py-2 text-sm transition-colors hover:bg-secondary/40"
        >
          Ask another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 1000))}
        placeholder={`Ask @${username} anything…`}
        rows={4}
        className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-muted-foreground/60"
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{content.length}/1000</span>
        <button
          onClick={submit}
          disabled={pending || !content.trim()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send anonymously"}
        </button>
      </div>
    </div>
  );
}
