// components/AppBar.tsx
// Top bar shown across signed-in pages: wordmark, primary nav, and the current
// user's handle with a sign-out control.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import NotificationBell from "@/components/NotificationBell";
import { LogoMark } from "@/components/Logo";

export default function AppBar({ handle }: { handle: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/feed" className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="font-display text-xl font-semibold tracking-[0.18em]">SERA</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <Link href="/feed" className="text-muted-foreground transition-colors hover:text-foreground">
            Feed
          </Link>
          <Link href="/communities" className="text-muted-foreground transition-colors hover:text-foreground">
            Communities
          </Link>
          <Link href="/chat" className="text-muted-foreground transition-colors hover:text-foreground">
            Chats
          </Link>
          <Link href="/inbox" className="text-muted-foreground transition-colors hover:text-foreground">
            Inbox
          </Link>
          <NotificationBell />
          <Link
            href={`/u/${handle}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            @{handle}
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
