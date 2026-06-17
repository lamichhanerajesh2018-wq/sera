// components/ShareAskLink.tsx
// Button on your own profile that opens a branded "send me anonymous messages"
// card you can share to your story (Instagram, WhatsApp, TikTok, Viber…) via the
// native share sheet — the viral loop.
"use client";

import { useState } from "react";
import ShareCard from "@/components/ShareCard";

export default function ShareAskLink({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Share my link
      </button>

      {open && (
        <ShareCard
          message=""
          handle={handle}
          variant="asklink"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
