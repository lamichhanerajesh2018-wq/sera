// components/MessageRequestActions.tsx
// Accept or decline an incoming message request. On accept, the conversation
// opens for free chatting; on decline, it's removed. Used in the chat list's
// requests section and inside a pending conversation.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptConversation, declineConversation } from "@/app/actions/chat";

export default function MessageRequestActions({
  conversationId,
  size = "sm",
  onAccepted,
}: {
  conversationId: string;
  size?: "sm" | "md";
  onAccepted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptConversation(conversationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onAccepted?.();
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const res = await declineConversation(conversationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push("/chat");
      router.refresh();
    });
  }

  const pad = size === "md" ? "px-5 py-2.5 text-sm" : "px-4 py-1.5 text-xs";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={decline}
          disabled={pending}
          className={`rounded-full border border-border ${pad} text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50`}
        >
          Decline
        </button>
        <button
          onClick={accept}
          disabled={pending}
          className={`rounded-full bg-primary ${pad} font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50`}
        >
          {pending ? "…" : "Accept"}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
