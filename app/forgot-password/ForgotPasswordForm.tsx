// app/forgot-password/ForgotPasswordForm.tsx
// Step 1 of recovery: enter your email, we send a reset link. We always show the
// same success message whether or not the email exists, so the form can't be
// used to discover which emails have accounts.
"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const addr = email.trim();
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // The redirect target is where the email link lands the user.
      await authClient.requestPasswordReset({
        email: addr,
        redirectTo: "/reset-password",
      });
    } catch {
      // Swallow — we show the same neutral message regardless, to avoid leaking
      // which emails are registered.
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center">
        <p className="text-3xl">📬</p>
        <p className="mt-3 font-display text-lg font-medium">Check your inbox</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          If an account uses that email, a reset link is on its way. The link expires soon,
          so use it before it does.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm transition-colors hover:bg-secondary/40"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Your email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="mt-2 h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>

      <p className="rounded-xl border border-border bg-background/40 px-4 py-3 text-xs leading-6 text-muted-foreground">
        Signed up anonymously with no email? There&apos;s no reset link — use your{" "}
        <span className="text-foreground">recovery code</span> in place of your password on the{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          sign-in page
        </Link>
        .
      </p>
    </form>
  );
}
