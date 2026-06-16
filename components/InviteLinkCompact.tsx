// components/InviteLinkCompact.tsx
// Small invite card for the feed's left rail. Copies /signup?ref=handle to the
// clipboard. Uses the live origin so the link is shareable as-is.
"use client";

import { useState } from "react";
import { track } from "@/components/PostHogProvider";

export default function InviteLinkCompact({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/signup?ref=${handle}`
        : `/signup?ref=${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("invite_copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card/50 p-4">
      <p className="font-display text-sm font-semibold">Invite a friend</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Share Sera with someone who needs a quiet place to speak.
      </p>
      <button
        onClick={copy}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-medium transition-colors hover:bg-muted/40"
      >
        {copied ? "Link copied!" : "Copy invite link"}
      </button>
    </section>
  );
}
