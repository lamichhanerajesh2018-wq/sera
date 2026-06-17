// components/ChatThread.tsx
// The live message view for one conversation. Loads with the existing messages,
// subscribes to the conversation's Pusher channel for new ones in realtime, and
// sends via the sendMessage server action.
"use client";

import { useEffect, useRef, useState } from "react";
import { pusherClient } from "@/lib/pusher-client";
import { sendMessage } from "@/app/actions/chat";
import type { Message } from "@/lib/types";

export default function ChatThread({
  conversationId,
  myUserId,
  initialMessages,
  locked = false,
}: {
  conversationId: string;
  myUserId: string;
  initialMessages: Message[];
  locked?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to realtime updates for this conversation.
  useEffect(() => {
    const channel = pusherClient.subscribe(`conversation-${conversationId}`);

    channel.bind("new-message", (msg: Message) => {
      setMessages((prev) => {
        // Avoid duplicating our own just-sent message.
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`conversation-${conversationId}`);
    };
  }, [conversationId]);

  // Keep scrolled to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending || locked) return;

    setSending(true);
    setError(null);
    setDraft("");

    try {
      const res = await sendMessage(conversationId, text);
      if (res?.error) {
        // Surface the reason (moderation block, blocked user, etc.) and put the
        // text back so the user doesn't lose what they typed.
        setError(res.error);
        setDraft(text);
      } else if (res?.message) {
        // Add our own message immediately (the channel also echoes it, but we
        // dedupe by id above).
        setMessages((prev) =>
          prev.some((m) => m._id === res.message!._id) ? prev : [...prev, res.message!]
        );
      }
    } catch {
      setError("Couldn't send. Check your connection and try again.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello — anonymously.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === myUserId;
            return (
              <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="border-t border-border bg-background/70 px-4 py-3 backdrop-blur">
        {error && (
          <p className="mx-auto mb-2 max-w-2xl text-center text-xs text-destructive">{error}</p>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={locked}
            placeholder={locked ? "Waiting for them to accept your request…" : "Type a message…"}
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || locked || !draft.trim()}
            className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
