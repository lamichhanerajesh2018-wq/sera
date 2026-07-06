"use client";

// Step 1 — Create Account. Google / Apple / Email, minimal inputs only.
// Google and Apple sign-in redirect away and back; OnboardingFlow detects the
// returning session and resumes at Step 2. The email path creates the account
// inline (no redirect) and advances immediately on success.
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { reserveUsername, logSignup } from "@/app/actions/signup";
import type { StepProps } from "@/components/onboarding/types";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3c-1.08.73-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.28a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l4 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16.36 1.43c0 1.14-.42 2.2-1.24 3.03-.86.87-2.14 1.53-3.2 1.44-.13-1.1.42-2.24 1.22-3.03.86-.85 2.32-1.5 3.22-1.44Zm3.2 17.13c-.53 1.22-.78 1.76-1.46 2.84-.95 1.5-2.28 3.37-3.94 3.39-1.47.02-1.85-.96-3.84-.95-1.99.01-2.41.97-3.88.95-1.66-.02-2.93-1.71-3.88-3.2C.2 17.9-.6 13.68 1 10.9c1.12-1.96 2.98-3.2 5.03-3.23 1.55-.03 3.02 1.04 3.97 1.04.94 0 2.73-1.29 4.6-1.1.78.03 2.99.32 4.4 2.4-.11.07-2.63 1.54-2.6 4.59.03 3.64 3.19 4.85 3.16 4.86Z" />
    </svg>
  );
}

const OAUTH_BUTTON =
  "flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.04] font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40";

export default function StepAccount({
  update,
  next,
  providers,
  refHandle,
}: StepProps & { providers: { google: boolean; apple: boolean }; refHandle: string }) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"google" | "apple" | "email" | null>(null);

  async function handleSocial(provider: "google" | "apple") {
    setError(null);
    setLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/onboarding",
      });
      // Browser navigates away here; OnboardingFlow resumes at Step 2 on return.
    } catch {
      setError("Could not start sign-in. Please try again.");
      setLoading(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
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

    setLoading("email");
    const handle = await reserveUsername();

    const { error: authError } = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: handle,
      username: handle,
    });

    if (authError) {
      setError(authError.message || "Could not create your account.");
      setLoading(null);
      return;
    }

    try {
      await logSignup(handle, refHandle);
    } catch {
      /* account already created */
    }

    update({ username: handle });
    next();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-6 py-14 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
          Welcome to SERA
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-white">
          Let&apos;s get you set up.
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Under two minutes. Just enough for SERA to start understanding you.
        </p>
      </motion.div>

      {refHandle && (
        <div className="mt-6 rounded-2xl border border-indigo-400/25 bg-indigo-400/5 p-3 text-center text-sm">
          <span className="text-white/50">Invited by </span>
          <span className="font-medium text-violet-300">@{refHandle}</span>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={() => handleSocial("google")}
          disabled={!providers.google || loading !== null}
          className={OAUTH_BUTTON}
        >
          <GoogleMark />
          {loading === "google" ? "Connecting…" : "Continue with Google"}
          {!providers.google && <span className="text-xs text-white/30">(not connected)</span>}
        </button>

        <button
          type="button"
          onClick={() => handleSocial("apple")}
          disabled={!providers.apple || loading !== null}
          className={OAUTH_BUTTON}
        >
          <AppleMark />
          {loading === "apple" ? "Connecting…" : "Continue with Apple"}
          {!providers.apple && <span className="text-xs text-white/30">(not connected)</span>}
        </button>

        <div className="relative py-2 text-center">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          <span className="relative bg-[#050509] px-3 text-xs text-white/30">or</span>
        </div>

        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="h-12 w-full rounded-full border border-white/15 font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
          >
            Continue with email
          </button>
        ) : (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
            onSubmit={handleEmailSubmit}
            className="space-y-3"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              disabled={loading !== null}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 8 characters)"
              autoComplete="new-password"
              disabled={loading !== null}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/15 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading !== null}
              className="h-12 w-full rounded-full bg-white font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading === "email" ? "Creating…" : "Create account"}
            </button>
          </motion.form>
        )}

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>

      <p className="mt-8 text-center text-xs leading-5 text-white/30">
        By continuing, you agree to SERA&apos;s Terms and Privacy Policy.
      </p>

      <p className="mt-4 text-center text-sm text-white/40">
        Already have an account?{" "}
        <Link href="/login" className="text-white underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
