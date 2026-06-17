// components/AppBar.tsx
// Top bar shown across signed-in pages. Facebook-style on mobile: compact icon
// row that stays on a single line; full text labels appear on larger screens.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import NotificationBell from "@/components/NotificationBell";
import PresenceBeacon from "@/components/PresenceBeacon";
import { LogoMark } from "@/components/Logo";
import { Home, Users, MessageCircle, Mail } from "lucide-react";

export default function AppBar({ handle }: { handle: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const navItems = [
    { href: "/feed", label: "Feed", Icon: Home },
    { href: "/communities", label: "Communities", Icon: Users },
    { href: "/chat", label: "Chats", Icon: MessageCircle },
    { href: "/inbox", label: "Inbox", Icon: Mail },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <PresenceBeacon />
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
        {/* Brand */}
        <Link href="/feed" className="flex shrink-0 items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="hidden font-display text-xl font-semibold tracking-[0.18em] sm:inline">
            SERA
          </span>
        </Link>

        {/* Primary nav: icons on mobile, icon + text on desktop */}
        <nav className="flex flex-1 items-center justify-around gap-1 sm:flex-none sm:justify-end sm:gap-5">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="flex items-center gap-1.5 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground sm:p-0"
            >
              <Icon className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden text-sm sm:inline">{label}</span>
            </Link>
          ))}

          <Link
            href="/settings/invites"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline"
          >
            Invite
          </Link>

          <NotificationBell />
        </nav>

        {/* Account */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/u/${handle}`}
            aria-label="Your profile"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            @{handle}
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
