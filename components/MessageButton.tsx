// components/MessageButton.tsx
// On someone's profile: starts (or opens) an anonymous chat with them.
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/actions/chat";

export default function MessageButton({ username }: { username: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      const res = await startConversation(username);
      if (res?.conversationId) {
        router.push(`/chat/${res.conversationId}`);
      }
    });
  }

  return (
    <button
      onClick={go}
      disabled={pending}
      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "…" : "Message"}
    </button>
  );
}
