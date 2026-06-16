// components/BlockButton.tsx
// Block / unblock a user from their profile. Blocking stops them from sending
// you anonymous messages, asking questions, or chatting with you.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser, unblockUser } from "@/app/actions/blocks";

export default function BlockButton({
  username,
  initialBlocked,
}: {
  username: string;
  initialBlocked: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (blocked) {
        await unblockUser(username);
        setBlocked(false);
      } else {
        await blockUser(username);
        setBlocked(true);
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (blocked) {
    return (
      <button
        onClick={toggle}
        disabled={pending}
        className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        {pending ? "…" : "Unblock"}
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          disabled={pending}
          className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Confirm block"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
    >
      Block
    </button>
  );
}
