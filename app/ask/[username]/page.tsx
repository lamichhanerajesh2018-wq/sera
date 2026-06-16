// app/ask/[username]/page.tsx
// Public-facing "send an anonymous message" page for a user's shareable link.
// NO login required — anyone with the link can send. The recipient never learns
// who sent it. Abuse is contained by IP-hash rate limiting + AI moderation.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getProfile } from "@/app/actions/profile";
import AppBar from "@/components/AppBar";
import Logo from "@/components/Logo";
import AskForm from "@/components/AskForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `Send @${username} an anonymous message — Sera` };
}

export default async function AskPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Sender may or may not be signed in — both are fine.
  const me = await getCurrentUser();
  const myHandle = me ? ((me as any).username || (me as any).displayUsername || "anon") : null;

  const profile = await getProfile(username);
  if (!profile) notFound();

  return (
    <div className="flex flex-1 flex-col">
      {/* Signed-in visitors get the full app bar; guests get a simple branded
          header (so the page works with no account at all). */}
      {myHandle ? (
        <AppBar handle={myHandle} />
      ) : (
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
            <Logo href="/" size="sm" />
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get your own link
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl">
            🕶️
          </span>
          <h1 className="font-display text-2xl font-medium">Send @{profile.username} a message</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It&apos;s completely anonymous — they&apos;ll never know it was you.
          </p>
        </div>

        {profile.isMe ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              This is your own link. Share it so others can message you anonymously.
            </p>
            <Link
              href="/inbox"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Go to your inbox
            </Link>
          </div>
        ) : (
          <AskForm username={profile.username} signedIn={!!me} />
        )}
      </main>
    </div>
  );
}
