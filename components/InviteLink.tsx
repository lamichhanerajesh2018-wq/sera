// components/InviteLink.tsx
// Shows the user's personal invite link (/signup?ref=handle) with a copy button.
// Built on the client so it uses the real current origin.
"use client";

import { useState } from "react";

export default function InviteLink({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${handle}`
      : `/signup?ref=${handle}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-sm font-medium">Your invite link</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Share it anywhere. When someone signs up through it, they show up below.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-muted-foreground">
          {url}
        </code>
        <button
          onClick={copy}
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
