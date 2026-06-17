// app/reset-password/ResetPasswordForm.tsx
// Step 2 of recovery: the email link lands here with ?token=... We take a new
// password (twice) and submit it with the token. On success, send the user to
// sign in with their new password.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  // Better Auth appends ?error=INVALID_TOKEN if the link is bad/expired.
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (linkError || !token) {
    return (
      <div className="text-center">
        <p className="text-3xl">⚠️</p>
        <p className="mt-3 font-display text-lg font-medium">This link isn&apos;t valid</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Reset links expire after a short while and can only be used once.
          Request a fresh one and try again.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });

    if (resetError) {
      setError("Couldn't reset your password. The link may have expired — request a new one.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    // Brief beat so the user sees the success state, then to sign-in.
    setTimeout(() => router.push("/login"), 1500);
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-3xl">✅</p>
        <p className="mt-3 font-display text-lg font-medium">Password updated</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Taking you to sign in…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
