// components/ContactForm.tsx
// Public contact form. Collects name, email, and a message, then sends it to
// the site owner via the sendContactMessage server action. Shows a friendly
// confirmation on success. No login required.
"use client";

import { useState, useTransition } from "react";
import { sendContactMessage } from "@/app/actions/contact";

const MAX = 4000;

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await sendContactMessage({ name, email, message });
      if (!res.ok) {
        setError(res.error || "Something went wrong. Please try again.");
        return;
      }
      setName("");
      setEmail("");
      setMessage("");
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-3xl">🕯️</p>
        <p className="mt-3 font-display text-lg font-medium">Message sent</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks for reaching out. We&apos;ll get back to you at the email you provided.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-5 rounded-full border border-border px-5 py-2 text-sm transition-colors hover:bg-secondary/40"
        >
          Send another
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-2xl border border-border bg-background/40 px-4 py-3 text-[15px] outline-none transition-colors focus:border-primary/50 placeholder:text-muted-foreground/60";

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputCls}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className={inputCls}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
          placeholder="How can we help?"
          rows={6}
          className={`${inputCls} resize-none leading-7`}
        />
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {message.length}/{MAX}
        </span>
        <button
          onClick={submit}
          disabled={pending || !name.trim() || !email.trim() || !message.trim()}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
        Your email is only used to reply to you — never shared or shown publicly.
      </p>
    </div>
  );
}
