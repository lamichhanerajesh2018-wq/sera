// components/FeedSidebarLeft.tsx
// Navigation rail on the left of the feed (desktop only). Signed-in users get a
// mini identity card, quick links, their joined groups, popular groups and a
// compact invite link. Guests get a few reasons to sign up plus popular groups.
import Link from "next/link";
import InviteLinkCompact from "@/components/InviteLinkCompact";
import type { Community } from "@/lib/types";

const NAV = [
  { href: "/feed", label: "Feed", icon: "🏠" },
  { href: "/communities", label: "Communities", icon: "🌐" },
  { href: "/chat", label: "Messages", icon: "💬" },
  { href: "/inbox", label: "Q&A Inbox", icon: "✉️" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
];

const GUEST_POINTS = [
  { icon: "🕶️", text: "Post anonymously — a random @sera-XXXX handle, never your real name." },
  { icon: "🌐", text: "Join communities around what you're going through." },
  { icon: "💬", text: "Ghost chat and anonymous Q&A, one-on-one." },
];

// Pick a stable emoji for a community from its name, so the compact list looks
// like the landing page without needing an icon stored in the DB.
const ICONS = ["🚀", "🎓", "❤️", "🤖", "💻", "🧠", "🌙", "🔥", "🌱", "🎧", "✨", "🫂"];
function iconFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ICONS[h % ICONS.length];
}

function PopularCommunities({ communities }: { communities: Community[] }) {
  const top = communities.slice(0, 5);
  if (top.length === 0) return null;
  return (
    <section className="rounded-3xl border border-border bg-card p-3">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Popular communities
        </p>
      </div>
      <div className="space-y-0.5">
        {top.map((c) => (
          <Link
            key={c._id}
            href={`/c/${c.slug}`}
            className="flex items-center gap-2.5 truncate rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="shrink-0">{iconFor(c.name)}</span>
            <span className="truncate">{c.name}</span>
          </Link>
        ))}
      </div>
      <Link
        href="/communities"
        className="mt-1 block px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        See all →
      </Link>
    </section>
  );
}

export default function FeedSidebarLeft({
  handle,
  myCommunities = [],
  popularCommunities = [],
}: {
  handle: string | null;
  myCommunities?: Community[];
  popularCommunities?: Community[];
}) {
  return (
    <aside className="feed-rail">
      <div className="sticky top-24 space-y-4">
        {handle ? (
          <>
            {/* Identity mini-card */}
            <Link
              href={`/u/${handle}`}
              className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                👻
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">@{handle}</p>
                <p className="text-xs text-muted-foreground">View profile</p>
              </div>
            </Link>

            {/* Quick nav */}
            <nav className="space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Your communities */}
            {myCommunities.length > 0 && (
              <section className="rounded-3xl border border-border bg-card p-3">
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your groups
                </p>
                <div className="space-y-0.5">
                  {myCommunities.slice(0, 6).map((c) => (
                    <Link
                      key={c._id}
                      href={`/c/${c.slug}`}
                      className="block truncate rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted/40"
                    >
                      <span className="text-muted-foreground">#</span> {c.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Popular communities */}
            <PopularCommunities communities={popularCommunities} />

            {/* Invite link */}
            <InviteLinkCompact handle={handle} />
          </>
        ) : (
          <>
            {/* Why Sera — fills the rail and sells the product to guests */}
            <section className="rounded-3xl border border-border bg-card/50 p-4">
              <p className="font-display text-sm font-semibold">Why Sera</p>
              <ul className="mt-3 space-y-3">
                {GUEST_POINTS.map((p) => (
                  <li key={p.text} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
                    <span className="shrink-0 text-sm">{p.icon}</span>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Popular communities */}
            <PopularCommunities communities={popularCommunities} />
          </>
        )}
      </div>
    </aside>
  );
}
