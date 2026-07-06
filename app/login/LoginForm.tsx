// app/login/LoginForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Enter your name and password.");
      return;
    }

    setLoading(true);

    // Sign in by username — email stays private and isn't used to log in.
    const { error: authError } = await authClient.signIn.username({
      username: username.trim(),
      password,
    });

    if (authError) {
      setError("That name and password don't match.");
      setLoading(false);
      return;
    }

    router.push("/feed");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-white">Your handle</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="sera-3540"
          autoComplete="username"
          className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/15"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-white">Password or recovery code</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password or recovery code"
          autoComplete="current-password"
          className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/15"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-full bg-white font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <details className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
        <summary className="cursor-pointer text-white/50 transition-colors hover:text-white">
          Lost your password or recovery code?
        </summary>
        <p className="mt-3 leading-6 text-white/50">
          If you signed up with an email, you can{" "}
          <Link href="/forgot-password" className="text-violet-300 underline-offset-4 hover:underline">
            email yourself a reset link
          </Link>
          .
        </p>
        <p className="mt-2 leading-6 text-white/50">
          Signed up anonymously with no email? Your{" "}
          <span className="text-white">recovery code</span> (shown once when you joined)
          works in place of your password — enter it above with your handle to get back in.
        </p>
        <p className="mt-2 leading-6 text-white/50">
          If you&apos;ve lost both your password and your recovery code, the account can&apos;t be
          recovered. You can{" "}
          <Link href="/signup" className="text-violet-300 underline-offset-4 hover:underline">
            pick a new name
          </Link>{" "}
          and start fresh.
        </p>
      </details>
    </form>
  );
}
