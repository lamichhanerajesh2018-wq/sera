// app/ask/[username]/page.tsx
// Public-facing "ask me anything" page for a user's shareable link.
// Requires being signed in to ask (but the recipient never learns who asked).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getProfile } from "@/app/actions/profile";
import AppBar from "@/components/AppBar";
import AskForm from "@/components/AskForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `Ask @${username} anonymously — Sera` };
}

export default async function AskPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const me = await getCurrentUser();
  // Asking requires an account — send guests to sign up first, then back here.
  if (!me) redirect(`/login?callbackUrl=/ask/${username}`);

  const myHandle = (me as any).username || (me as any).displayUsername || "anon";

  const profile = await getProfile(username);
  if (!profile) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={myHandle} />

      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl">
            🕶️
          </span>
          <h1 className="font-display text-2xl font-medium">Ask @{profile.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your question is completely anonymous — they&apos;ll never know it was you.
          </p>
        </div>

        {profile.isMe ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              This is your own link. Share it so others can ask you anything.
            </p>
            <Link
              href="/inbox"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Go to your inbox
            </Link>
          </div>
        ) : (
          <AskForm username={profile.username} />
        )}
      </main>
    </div>
  );
}
