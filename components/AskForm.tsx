// components/AskForm.tsx
// Send an anonymous message to a specific user. No login required — the sender
// stays anonymous to the recipient either way. After sending, guests get a
// nudge to create their own link (the viral loop).
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { askQuestion } from "@/app/actions/questions";
import { track } from "@/components/PostHogProvider";

const MAX = 1000;

export default function AskForm({
  username,
  signedIn = false,
}: {
  username: string;
  signedIn?: boolean;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const text = content.trim();
    if (!text) {
      setError("Write a message first.");
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
      track("message_sent", { signed_in: signedIn });
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
          Send another
        </button>

        {/* Viral loop: nudge guests to make their own link */}
        {!signedIn && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-medium">Want anonymous messages too?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your own Sera link and share it anywhere.
            </p>
            <Link
              href="/signup"
              className="mt-3 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get your link
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX))}
        placeholder={`Send @${username} an anonymous message…`}
        rows={4}
        className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-muted-foreground/60"
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {content.length}/{MAX}
        </span>
        <button
          onClick={submit}
          disabled={pending || !content.trim()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send anonymously"}
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
        Be kind. Messages are AI-moderated and rate-limited to prevent abuse.
      </p>
    </div>
  );
}
