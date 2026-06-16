// components/MarkAllReadButton.tsx
// Small client button that marks every notification read, then refreshes the
// page so the list re-renders with updated state.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllRead } from "@/app/actions/notifications";

export default function MarkAllReadButton({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (!hasUnread && !done) return null;

  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={() =>
        startTransition(async () => {
          await markAllRead();
          setDone(true);
          router.refresh();
        })
      }
      className="text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
    >
      {pending ? "Marking…" : "Mark all read"}
    </button>
  );
}
