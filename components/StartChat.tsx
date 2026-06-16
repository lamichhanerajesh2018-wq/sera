// components/StartChat.tsx
// Box to start a new anonymous chat by typing someone's username.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/actions/chat";

export default function StartChat() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go() {
    setError(null);
    const handle = username.trim();
    if (!handle) return;

    startTransition(async () => {
      const res = await startConversation(handle);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.conversationId) {
        router.push(`/chat/${res.conversationId}`);
      }
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Start a new chat</p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">@</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="username"
          className="h-10 flex-1 rounded-xl border border-border bg-background/40 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <button
          onClick={go}
          disabled={pending || !username.trim()}
          className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Chat"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
