// components/PostShare.tsx
// Share control for a confession. Opens a small menu with: copy link, native
// share (Web Share API, mainly mobile), and a downloadable image card. Anyone
// can share — confessions are public — so this works for guests too.
"use client";

import { useState } from "react";
import ShareCard from "@/components/ShareCard";

export default function PostShare({
  postId,
  authorUsername,
  content,
}: {
  postId: string;
  authorUsername: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function postUrl() {
    return typeof window !== "undefined"
      ? `${window.location.origin}/post/${postId}`
      : `/post/${postId}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(postUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  async function nativeShare() {
    const url = postUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "A confession on Sera", text: content.slice(0, 120), url });
        setOpen(false);
      } catch {
        /* user cancelled; ignore */
      }
    } else {
      // No native share (most desktops) — fall back to copying.
      copyLink();
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 transition-colors hover:text-primary"
        aria-label="Share"
      >
        <span>↗</span> Share
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-8 left-0 z-50 w-48 overflow-hidden rounded-2xl border border-border bg-popover py-1 shadow-xl">
            <button
              onClick={() => {
                copyLink();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
            >
              <span>🔗</span> {copied ? "Link copied!" : "Copy link"}
            </button>

            {canNativeShare && (
              <button
                onClick={nativeShare}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
              >
                <span>📤</span> Share via…
              </button>
            )}

            <button
              onClick={() => {
                setCardOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
            >
              <span>🖼️</span> Image card
            </button>
          </div>
        </>
      )}

      {cardOpen && (
        <ShareCard
          message={content}
          handle={authorUsername}
          variant="post"
          onClose={() => setCardOpen(false)}
        />
      )}
    </div>
  );
}
