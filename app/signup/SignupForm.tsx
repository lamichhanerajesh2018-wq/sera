// app/signup/SignupForm.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { reserveUsername, logSignup, createAnonCredentials } from "@/app/actions/signup";

type Mode = "recoverable" | "anonymous";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Invite link: /signup?ref=<username>. Captured here, recorded after signup.
  const ref = (searchParams.get("ref") || "").trim().toLowerCase();
  const [mode, setMode] = useState<Mode>("recoverable");

  // shared
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // recoverable path
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // anonymous path — once set, we show the recovery-code screen instead
  const [recovery, setRecovery] = useState<{ handle: string; code: string } | null>(null);

  // ---- recoverable signup (email + password + verification email) --------
  async function handleRecoverable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const handle = await reserveUsername();

    const { error: authError } = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: handle,
      username: handle,
    });

    if (authError) {
      setError(authError.message || "Could not create your account.");
      setLoading(false);
      return;
    }

    // Record signup + referral, but never let it block entry to the app.
    try {
      await logSignup(handle, ref);
    } catch {
      /* account already created */
    }

    // Hard navigation guarantees a clean load of the authenticated app even if
    // client-side routing gets stuck after the session cookie is set.
    window.location.assign("/feed");
  }

  // ---- pure anonymous signup (instant, no email, recovery code) ----------
  async function handleAnonymous() {
    setError(null);
    setLoading(true);

    const creds = await createAnonCredentials();

    const { error: authError } = await authClient.signUp.email({
      email: creds.email,
      password: creds.password,
      name: creds.username,
      username: creds.username,
    });

    if (authError) {
      setError(authError.message || "Could not create your account.");
      setLoading(false);
      return;
    }

    try {
      await logSignup(creds.username, ref);
    } catch {
      /* account already created */
    }

    // Show the recovery code before sending them in — this is the ONLY time
    // it's ever visible.
    setRecovery({ handle: creds.username, code: creds.password });
    setLoading(false);
  }

  // ---- recovery-code screen (after anonymous signup) ---------------------
  if (recovery) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
          <p className="text-muted-foreground">You&apos;re known as</p>
          <p className="mt-1 font-display text-lg font-medium text-primary">{recovery.handle}</p>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Your recovery code</p>
          <p className="mt-2 select-all break-all font-mono text-base tracking-wide text-foreground">
            {recovery.code}
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(recovery.code)}
            className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Copy code
          </button>
        </div>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs leading-5 text-muted-foreground">
          <p className="font-medium text-destructive">Save this now — it won&apos;t be shown again.</p>
          <p className="mt-1">
            This code is the only way back into your account. There&apos;s no email
            to reset it. If you lose it, the account is gone for good. To log in
            later, use your handle <span className="text-foreground">{recovery.handle}</span> and this code.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.assign("/feed");
          }}
          className="h-11 w-full rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          I&apos;ve saved my code — continue
        </button>
      </div>
    );
  }

  // ---- main form ---------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* invited-by banner */}
      {ref && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center text-sm">
          <span className="text-muted-foreground">Invited by </span>
          <span className="font-medium text-primary">@{ref}</span>
        </div>
      )}

      {/* mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-background/40 p-1 text-sm">
        <button
          type="button"
          onClick={() => { setMode("recoverable"); setError(null); }}
          className={`rounded-full py-2 font-medium transition-colors ${
            mode === "recoverable"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Recoverable
        </button>
        <button
          type="button"
          onClick={() => { setMode("anonymous"); setError(null); }}
          className={`rounded-full py-2 font-medium transition-colors ${
            mode === "anonymous"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pure anonymous
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-background/40 p-4 text-sm">
        <p className="text-muted-foreground">You&apos;ll be known as</p>
        <p className="mt-1 font-display text-lg font-medium text-primary">sera-••••</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We assign you a random anonymous handle — it&apos;s all anyone ever sees.
        </p>
      </div>

      {mode === "recoverable" ? (
        <form onSubmit={handleRecoverable} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Private. Only used to recover your account — never shown to anyone.
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create recoverable account"}
          </button>

          <p className="text-center text-xs text-muted-foreground/70">
            We&apos;ll email you a verification link so you can get back in if you
            ever forget your password.
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-background/40 p-4 text-xs leading-5 text-muted-foreground">
            No email, no password to choose. We create your account instantly and
            give you a one-time recovery code. Maximum anonymity — but if you lose
            the code, the account can&apos;t be recovered.
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="button"
            onClick={handleAnonymous}
            disabled={loading}
            className="h-11 w-full rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create anonymous account"}
          </button>

          <p className="text-center text-xs text-muted-foreground/70">
            We keep minimal, hashed security logs to prevent abuse.
          </p>
        </div>
      )}
    </div>
  );
}
